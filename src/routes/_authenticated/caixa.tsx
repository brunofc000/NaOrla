import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Trash2, X, Receipt, Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/caixa")({
  head: () => ({ meta: [{ title: "Caixa — NaOrlaApp" }] }),
  component: Caixa,
});

function Caixa() {
  const qc = useQueryClient();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { data: txs = [] } = useQuery({
    queryKey: ["transactions", "today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions").select("*")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: openOrders = [] } = useQuery({
    queryKey: ["open_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_number, customer_name, status, total, notes, created_at, order_items(id, name, quantity, price, notes)")
        .in("status", ["novo", "preparando", "pronto"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const { data: closedToday = [] } = useQuery({
    queryKey: ["closed_orders_today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_number, customer_name, status, total, notes, created_at, closed_at, closed_by, order_items(id, name, quantity, price, notes)")
        .eq("status", "entregue")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [closing, setClosing] = useState<any>(null);
  const [method, setMethod] = useState<"dinheiro" | "pix" | "cartao" | "outro">("pix");
  const [cardType, setCardType] = useState<"debito" | "credito">("debito");
  const [sangriaOpen, setSangriaOpen] = useState(false);
  const [sangriaAmount, setSangriaAmount] = useState("");
  const [sangriaDescription, setSangriaDescription] = useState("");

  const sangria = useMutation({
    mutationFn: async () => {
      const amount = Number(sangriaAmount.replace(",", "."));
      if (isNaN(amount) || amount <= 0) throw new Error("Valor inválido");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user.id,
        type: "expense",
        amount,
        description: sangriaDescription || "Sangria",
        category: "sangria",
        payment_method: "dinheiro",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Sangria registrada!");
      setSangriaOpen(false);
      setSangriaAmount("");
      setSangriaDescription("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeOrder = useMutation({
    mutationFn: async ({ orderId, paymentMethod }: { orderId: string; paymentMethod: string }) => {
      const { error } = await (supabase as any).rpc("close_order", {
        _order_id: orderId,
        _payment_method: paymentMethod,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["open_orders"] });
      qc.invalidateQueries({ queryKey: ["closed_orders_today"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Mesa fechada!");
      setClosing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const income = txs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); toast.success("Removido"); },
  });

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Caixa · Hoje</p>
        <h1 className="font-display text-3xl">Movimento do dia</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border p-4">
          <div className="flex items-center gap-1 text-primary text-xs"><TrendingUp className="h-3 w-3" />Entradas</div>
          <p className="mt-1 font-display text-2xl">{brl(income)}</p>
        </div>
        <div className="border border-border p-4">
          <div className="flex items-center gap-1 text-destructive text-xs"><TrendingDown className="h-3 w-3" />Saídas</div>
          <p className="mt-1 font-display text-2xl">{brl(expense)}</p>
        </div>
      </div>
      <div className="bg-muted p-4">
        <p className="text-xs uppercase tracking-wider text-primary">Lucro</p>
        <p className="font-display text-3xl">{brl(income - expense)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="w-full uppercase tracking-wider text-xs"
          onClick={() => setSangriaOpen(true)}
        >
          <Minus className="h-4 w-4 mr-2" />Sangria
        </Button>
        <Link to="/relatorios" className="w-full">
          <Button variant="outline" className="w-full uppercase tracking-wider text-xs">
            <Receipt className="h-4 w-4 mr-2" />Relatório
          </Button>
        </Link>
      </div>

      {/* Dialog de Sangria */}
      <Dialog open={sangriaOpen} onOpenChange={setSangriaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Registrar Sangria</DialogTitle>
            <p className="text-xs text-muted-foreground">Retirada de dinheiro do caixa</p>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={sangriaAmount}
                onChange={e => setSangriaAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Ex: Troco, pagamento fornecedor..."
                value={sangriaDescription}
                onChange={e => setSangriaDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSangriaOpen(false)}
              className="uppercase tracking-wider text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => sangria.mutate()}
              disabled={sangria.isPending || !sangriaAmount}
              className="uppercase tracking-wider text-xs"
            >
              {sangria.isPending ? "Registrando..." : "Confirmar Sangria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 gap-3">
        <TransactionDialog type="income" />
        <TransactionDialog type="expense" />
      </div>

      <section>
        <h2 className="font-display text-xl mb-3">Lançamentos</h2>
        {txs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lançamento hoje. Bora começar! 🌊</p>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {txs.map(t => (
              <li key={t.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-semibold">{t.description || (t.type === "income" ? "Venda" : "Despesa")}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {t.payment_method} · {t.category}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${t.type === "income" ? "text-primary" : "text-destructive"}`}>
                    {t.type === "income" ? "+" : "−"} {brl(Number(t.amount))}
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mesas em aberto */}
      <section>
        <h2 className="font-display text-xl mb-3">Mesas em aberto ({openOrders.length})</h2>
        {openOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma mesa em aberto no momento.</p>
        ) : (
          <ul className="space-y-3">
            {openOrders.map((o: any) => (
              <li key={o.id} className="border border-amber-200 bg-amber-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold">Mesa {o.table_number}</p>
                    {o.customer_name && <p className="text-xs text-muted-foreground">{o.customer_name}</p>}
                  </div>
                  <span className="font-display text-lg text-primary">{brl(Number(o.total))}</span>
                </div>
                <ul className="text-sm space-y-1 mb-3">
                  {o.order_items.map((i: any) => (
                    <li key={i.id} className="flex justify-between">
                      <span>{i.quantity}× {i.name}</span>
                      <span className="text-muted-foreground">{brl(Number(i.price) * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
                {o.notes && <p className="text-xs text-muted-foreground mb-2">Obs: {o.notes}</p>}
                <Button
                  size="sm"
                  className="w-full uppercase tracking-wider text-xs"
                  onClick={() => { setClosing(o); setMethod("pix"); }}
                >
                  <Receipt className="h-4 w-4 mr-2" /> Fechar mesa
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mesas fechadas hoje */}
      <section>
        <h2 className="font-display text-xl mb-3">Mesas fechadas hoje ({closedToday.length})</h2>
        {closedToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma mesa fechada hoje.</p>
        ) : (
          <ul className="space-y-2">
            {closedToday.map((o: any) => (
              <li key={o.id} className="flex items-center justify-between p-3 text-sm border border-emerald-200 bg-emerald-50 rounded-lg">
                <div>
                  <p className="font-semibold">Mesa {o.table_number}</p>
                  {o.customer_name && <p className="text-xs text-muted-foreground">{o.customer_name}</p>}
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {o.closed_by && (
                    <p className="text-xs text-emerald-600 font-medium">
                      Fechado por {o.closed_by} {o.closed_at ? `às ${new Date(o.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-primary">{brl(Number(o.total))}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Modal de fechamento de mesa */}
      {closing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => !closeOrder.isPending && setClosing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Fechar mesa {closing.table_number}</h2>
            <p className="text-sm text-muted-foreground">Confira o total e a forma de pagamento.</p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
              {closing.order_items.map((i: any) => (
                <li key={i.id} className="flex justify-between">
                  <span>{i.quantity}× {i.name}</span>
                  <span className="text-muted-foreground">{brl(Number(i.price) * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-xl font-black text-secondary">{brl(Number(closing.total))}</span>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {(["dinheiro", "pix", "cartao", "outro"] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold capitalize transition ${
                      method === m ? "border-secondary bg-secondary/20" : "border-border bg-background"
                    }`}
                  >
                    {m === "cartao" ? "Cartão" : m}
                  </button>
                ))}
              </div>
              {method === "cartao" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCardType("debito")}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold transition ${
                      cardType === "debito" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"
                    }`}
                  >
                    Débito
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardType("credito")}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold transition ${
                      cardType === "credito" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"
                    }`}
                  >
                    Crédito
                  </button>
                </div>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setClosing(null)} disabled={closeOrder.isPending}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={() => closeOrder.mutate({ orderId: closing.id, paymentMethod: method === "cartao" ? `cartao_${cardType}` : method })} disabled={closeOrder.isPending}>
                {closeOrder.isPending ? "Fechando…" : "Confirmar pagamento"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionDialog({ type }: { type: "income" | "expense" }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const defaultCat = type === "income" ? "venda" : "geral";
  const categories = type === "income"
    ? ["venda", "servico", "outros"]
    : ["geral", "fornecedor", "funcionario", "aluguel", "outros"];
  const methods = ["dinheiro", "pix", "credito", "debito"];

  type Row = { amount: string; description: string; category: string; method: string };
  const emptyRow = (): Row => ({ amount: "", description: "", category: defaultCat, method: "dinheiro" });
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const amountRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!open) setRows([emptyRow()]);
  }, [open]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows(r => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addRow = () => setRows(r => [...r, emptyRow()]);
  const removeRow = (i: number) =>
    setRows(r => (r.length === 1 ? [emptyRow()] : r.filter((_, idx) => idx !== i)));

  const handleKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const isLast = i === rows.length - 1;
      if (isLast) addRow();
      setTimeout(() => amountRefs.current[i + 1]?.focus(), 0);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const payload = rows
        .filter(r => r.amount.trim() !== "")
        .map(r => ({
          user_id: u.user!.id,
          type,
          amount: Number(r.amount.replace(",", ".")),
          description: r.description,
          category: r.category,
          payment_method: r.method,
        }));
      if (payload.length === 0) throw new Error("Informe ao menos um valor");
      const { error } = await supabase.from("transactions").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard-today"] });
      toast.success(`${n} ${n === 1 ? "lançamento" : "lançamentos"} salvos`);
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = rows.reduce((s, r) => s + (Number(r.amount.replace(",", ".")) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={type === "income" ? "default" : "outline"} className="h-14 uppercase tracking-wider text-xs font-bold">
          <Plus className="h-4 w-4 mr-1" />{type === "income" ? "Entrada" : "Saída"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {type === "income" ? "Entradas do dia" : "Saídas do dia"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Digite o valor e pressione <kbd className="px-1 border border-border">Enter</kbd> para adicionar uma nova linha. Salve uma ou todas de uma vez.
          </p>
        </DialogHeader>

        <div className="border border-border">
          <div className="grid grid-cols-[1fr_2fr_1.2fr_1.2fr_auto] gap-px bg-border text-[10px] uppercase tracking-wider">
            <div className="bg-muted px-2 py-1.5">Valor</div>
            <div className="bg-muted px-2 py-1.5">Descrição</div>
            <div className="bg-muted px-2 py-1.5">Categoria</div>
            <div className="bg-muted px-2 py-1.5">Pagamento</div>
            <div className="bg-muted px-2 py-1.5 w-8" />
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_1.2fr_1.2fr_auto] gap-px bg-border">
                <Input
                  ref={el => { amountRefs.current[i] = el; }}
                  inputMode="decimal"
                  value={row.amount}
                  onChange={e => update(i, { amount: e.target.value })}
                  onKeyDown={handleKey(i)}
                  placeholder="0,00"
                  className="rounded-none border-0 h-10 bg-background"
                />
                <Input
                  value={row.description}
                  onChange={e => update(i, { description: e.target.value })}
                  onKeyDown={handleKey(i)}
                  placeholder={type === "income" ? "Ex: 2 cervejas" : "Ex: gelo"}
                  className="rounded-none border-0 h-10 bg-background"
                />
                <Select value={row.category} onValueChange={v => update(i, { category: v })}>
                  <SelectTrigger className="rounded-none border-0 h-10 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={row.method} onValueChange={v => update(i, { method: v })}>
                  <SelectTrigger className="rounded-none border-0 h-10 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {methods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="bg-background hover:bg-muted px-2 flex items-center justify-center"
                  aria-label="Remover linha"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="uppercase tracking-wider text-[10px]">
            <Plus className="h-3 w-3 mr-1" />Adicionar linha
          </Button>
          <p className="text-xs">
            Total: <span className="font-display text-base">{brl(total)}</span>
          </p>
        </div>

        <DialogFooter>
          <Button
            disabled={save.isPending || total === 0}
            onClick={() => save.mutate()}
            className="w-full uppercase tracking-wider text-xs"
          >
            Salvar tudo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}