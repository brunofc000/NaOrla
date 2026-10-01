import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Search, Trash2, Minus, Plus, ShoppingCart, Users, UserPlus, BadgeDollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmployeeSession } from "@/lib/employee-session";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CatalogItem = {
  id: string;
  name: string;
  price: number;
  kind: "product" | "menu";
  stock?: number;
  category?: string;
};

type CartLine = CatalogItem & { quantity: number };

type Customer = { id: string; name: string; phone: string | null; cpf: string | null; notes: string | null };

export const Route = createFileRoute("/_authenticated/venda-avulsa")({
  head: () => ({ meta: [{ title: "Venda Avulsa — NaOrlaApp" }] }),
  component: VendaAvulsa,
});

function VendaAvulsa() {
  const employee = useEmployeeSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [method, setMethod] = useState<string>("dinheiro");
  const [customerId, setCustomerId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [customerDialog, setCustomerDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", cpf: "", notes: "" });

  // Cardápio (itens do menu)
  const { data: menuItems = [] } = useQuery({
    queryKey: ["walkin_menu", employee?.token ?? "owner"],
    queryFn: async (): Promise<CatalogItem[]> => {
      if (employee) {
        const { data, error } = await (supabase as any).rpc("employee_get_menu_v2", { _token: employee.token });
        if (error) throw error;
        return ((data ?? []) as any[])
          .filter(i => i.is_available)
          .map(i => ({ id: i.id, name: i.name, price: Number(i.price), kind: "menu" as const, category: i.category }));
      }
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, price, category")
        .eq("is_available", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return (data ?? []).map(i => ({ id: i.id, name: i.name, price: Number(i.price), kind: "menu" as const, category: i.category }));
    },
  });

  // Produtos do estoque
  const { data: products = [] } = useQuery({
    queryKey: ["walkin_products", employee?.token ?? "owner"],
    queryFn: async (): Promise<CatalogItem[]> => {
      if (employee) {
        const { data, error } = await (supabase as any).rpc("employee_get_products_v2", { _token: employee.token });
        if (error) throw error;
        return ((data ?? []) as any[]).map(p => ({
          id: p.id, name: p.name, price: Number(p.sell_price), kind: "product" as const,
          stock: Number(p.quantity), category: p.category,
        }));
      }
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sell_price, quantity, category")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map(p => ({
        id: p.id, name: p.name, price: Number(p.sell_price), kind: "product" as const,
        stock: Number(p.quantity), category: p.category,
      }));
    },
  });

  // Clientes fiéis (apenas dono)
  const isOwner = !employee;
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
    enabled: isOwner,
  });


  const catalog = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = [...menuItems, ...products];
    const filtered = term
      ? all.filter(i => i.name.toLowerCase().includes(term))
      : all;
    return filtered;
  }, [q, menuItems, products]);

  const add = (item: CatalogItem) => {
    setCart(prev => {
      const f = prev.find(p => p.id === item.id);
      if (f) return prev.map(p => p.id === item.id ? { ...p, quantity: p.quantity + 1 } : p);
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(item.name + " adicionado");
  };

  const inc = (id: string) => setCart(prev => prev.map(p => p.id === id ? { ...p, quantity: p.quantity + 1 } : p));
  const dec = (id: string) => setCart(prev => prev.flatMap(p => p.id === id ? (p.quantity > 1 ? [{ ...p, quantity: p.quantity - 1 }] : []) : [p]));
  const remove = (id: string) => setCart(prev => prev.filter(p => p.id !== id));

  const total = cart.reduce((s, p) => s + p.price * p.quantity, 0);
  const count = cart.reduce((s, p) => s + p.quantity, 0);

  const createCustomer = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sem sessão");
      const { data, error } = await supabase
        .from("customers")
        .insert({
          user_id: user.id,
          name: newCustomer.name.trim(),
          phone: newCustomer.phone.trim() || null,
          cpf: newCustomer.cpf.trim() || null,
          notes: newCustomer.notes.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (c) => {
      toast.success("Cliente cadastrado!");
      setCustomerId(c.id);
      setNewCustomer({ name: "", phone: "", cpf: "", notes: "" });
      setCustomerDialog(false);
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkout = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Adicione itens à venda");
      const items = cart.map(c => ({
        kind: c.kind,
        id: c.id,
        name: c.name,
        quantity: c.quantity,
        price: c.price,
      }));
      const { data, error } = await (supabase as any).rpc("create_walkin_sale", {
        _items: items,
        _payment_method: method,
        _customer_id: isOwner && customerId !== "none" ? customerId : null,
        _notes: notes.trim() || null,
        _token: employee?.token ?? null,
        _seller_name: employee?.employee_name ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      const fiado = method === "fiado";
      toast.success(fiado ? "Venda fiada registrada!" : "Venda registrada! " + brl(total));
      setCart([]);
      setNotes("");
      setCustomerId("none");
      setMethod("dinheiro");
      setCheckoutOpen(false);
      qc.invalidateQueries({ queryKey: ["walkin_products"] });
      qc.invalidateQueries({ queryKey: ["today_sales"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["customer_fiados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 pb-32">
      <button
        type="button"
        onClick={() => navigate({ to: employee ? "/pedido" : "/dashboard" })}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Venda avulsa</p>
        <h1 className="font-display text-3xl flex items-center gap-2">
          <ShoppingCart className="h-7 w-7" />
          Venda sem mesa
        </h1>
        <p className="text-sm text-muted-foreground">
          Para clientes que não estão em mesa nenhuma. Itens do cardápio e produtos do estoque juntos.
        </p>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar item ou produto…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="pl-10"
        />
      </div>

      {catalog.length === 0 && <p className="text-sm text-muted-foreground">Nada encontrado.</p>}

      <div className="grid grid-cols-2 gap-3">
        {catalog.map(item => (
          <button
            key={item.kind + item.id}
            type="button"
            onClick={() => add(item)}
            className="border border-border bg-muted/30 p-3 text-left space-y-1 hover:border-secondary hover:bg-secondary/10 transition-colors"
          >
            <p className="font-semibold text-sm leading-tight">{item.name}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              {item.kind === "menu" ? "Cardápio" : "Estoque"}
              {item.kind === "product" && item.stock !== undefined ? ` · ${item.stock} un` : ""}
            </p>
            <p className="text-sm font-bold text-primary">{brl(item.price)}</p>
          </button>
        ))}
      </div>


      {/* Rodapé do carrinho */}
      {count > 0 && (
        <div className="fixed bottom-16 left-0 right-0 border-t border-border bg-background/95 backdrop-blur px-5 py-3 z-30">
          <div className="mx-auto max-w-2xl">
            <ul className="mb-2 max-h-36 overflow-y-auto divide-y divide-border/60">
              {cart.map(c => (
                <li key={c.kind + c.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{brl(c.price * c.quantity)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => dec(c.id)} className="rounded border border-border p-1" aria-label="Diminuir">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{c.quantity}</span>
                    <button onClick={() => inc(c.id)} className="rounded border border-border p-1" aria-label="Aumentar">
                      <Plus className="h-3 w-3" />
                    </button>
                    <button onClick={() => remove(c.id)} className="rounded border border-border p-1 text-destructive ml-1" aria-label="Remover">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{count} {count === 1 ? "item" : "itens"}</p>
                <p className="font-display text-lg"><span className="text-primary">{brl(total)}</span></p>
              </div>
              <Button onClick={() => setCheckoutOpen(true)} className="uppercase tracking-wider text-xs">
                <BadgeDollarSign className="h-4 w-4 mr-2" />Finalizar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Finalização */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Finalizar venda avulsa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{count} {count === 1 ? "item" : "itens"}</p>
              <p className="font-display text-3xl font-bold text-primary">{brl(total)}</p>
            </div>

            {isOwner && (
              <div className="space-y-2 border border-border rounded-lg p-3">
                <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Users className="h-3.5 w-3.5" />Cliente fiel (opcional)
                </Label>
                <div className="flex gap-2">
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem cliente (venda avulsa)</SelectItem>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => setCustomerDialog(true)} title="Cadastrar novo cliente">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
                {customerId !== "none" && (
                  <p className="text-[11px] text-muted-foreground">
                    Vinculado ao cliente fiel. Escolha <strong>Fiado</strong> abaixo para cobrar depois.
                  </p>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs uppercase tracking-wider">Forma de Pagamento</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { id: "dinheiro", label: "Dinheiro" },
                  { id: "pix", label: "PIX" },
                  { id: "cartao", label: "Cartão" },
                  { id: "outro", label: "Outro" },
                  ...(isOwner ? [{ id: "fiado", label: "Fiado (pagar depois)" }] : []),
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                      method === m.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <span className="text-[11px] font-semibold uppercase">{m.label}</span>
                  </button>
                ))}
              </div>
              {method === "fiado" && customerId === "none" && (
                <p className="mt-2 text-xs text-destructive">Selecione um cliente fiel para vender fiado.</p>
              )}
            </div>

            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: cliente vai pagar sexta…" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full h-12 text-base font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => checkout.mutate()}
              disabled={checkout.isPending || (method === "fiado" && customerId === "none")}
            >
              {checkout.isPending ? "Processando…" : "Confirmar — " + brl(total)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cadastro rápido de cliente (dono) */}
      <Dialog open={customerDialog} onOpenChange={setCustomerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Novo cliente fiel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={newCustomer.cpf} onChange={e => setNewCustomer(p => ({ ...p, cpf: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Input value={newCustomer.notes} onChange={e => setNewCustomer(p => ({ ...p, notes: e.target.value }))} className="mt-1" placeholder="Ex: mora perto do quiosque…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => createCustomer.mutate()}
              disabled={createCustomer.isPending || !newCustomer.name.trim()}
            >
              {createCustomer.isPending ? "Salvando…" : "Salvar cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

