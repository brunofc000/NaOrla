import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Trash2, X } from "lucide-react";
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