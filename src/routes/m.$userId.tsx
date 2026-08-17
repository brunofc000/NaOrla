import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus, ShoppingBag, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/m/$userId")({
  head: () => ({ meta: [{ title: "Cardápio" }] }),
  component: PublicMenu,
});

type Item = { id: string; name: string; description: string | null; price: number; category: string; image_url?: string | null };
type CartLine = { id: string; name: string; price: number; quantity: number };

function PublicMenu() {
  const { userId } = Route.useParams();
  const storageKey = `cart:${userId}`;
  const tableKey = `table:${userId}`;
  const [table, setTable] = useState<string>("");
  const [askTable, setAskTable] = useState(false);
  const [tableInput, setTableInput] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem(tableKey) : null;
    if (t) setTable(t);
    else setAskTable(true);
    const c = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    if (c) try { setCart(JSON.parse(c)); } catch {/* ignore */}
  }, [storageKey, tableKey]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, storageKey]);

  const { data: profile } = useQuery({
    queryKey: ["public_profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("kiosk_name").eq("id", userId).maybeSingle();
      return data;
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["public_menu", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id,name,description,price,category,image_url")
        .eq("user_id", userId)
        .eq("is_available", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  const byCat = items.reduce<Record<string, Item[]>>((acc, i) => {
    (acc[i.category] ??= []).push(i);
    return acc;
  }, {});

  const add = (i: Item) => setCart(prev => {
    const f = prev.find(p => p.id === i.id);
    if (f) return prev.map(p => p.id === i.id ? { ...p, quantity: p.quantity + 1 } : p);
    return [...prev, { id: i.id, name: i.name, price: Number(i.price), quantity: 1 }];
  });
  const dec = (id: string) => setCart(prev => prev.flatMap(p => p.id === id ? (p.quantity > 1 ? [{ ...p, quantity: p.quantity - 1 }] : []) : [p]));
  const remove = (id: string) => setCart(prev => prev.filter(p => p.id !== id));
  const total = cart.reduce((s, p) => s + p.price * p.quantity, 0);
  const count = cart.reduce((s, p) => s + p.quantity, 0);

  function confirmTable() {
    const t = tableInput.trim();
    if (!t) return;
    setTable(t);
    if (typeof window !== "undefined") localStorage.setItem(tableKey, t);
    setAskTable(false);
  }

  function changeTable() {
    setTableInput(table);
    setAskTable(true);
  }

  return (
    <div className="min-h-dvh bg-background text-foreground pb-32">
      {/* Hero */}
      <header className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-3xl px-6 pt-14 pb-10 text-center space-y-3">
          <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Cardápio digital</p>
          <h1 className="font-display text-5xl leading-none">{profile?.kiosk_name ?? "Quiosque"}</h1>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="h-px w-8 bg-border" />
            <p className="text-[11px] uppercase tracking-[0.3em] text-primary">à beira-mar</p>
            <span className="h-px w-8 bg-border" />
          </div>
          {table && (
            <button onClick={changeTable} className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 border border-border bg-background text-[11px] uppercase tracking-[0.25em] hover:bg-muted transition-colors">
              <Check className="h-3 w-3" />Mesa {table} · trocar
            </button>
          )}
        </div>

        {/* Tabs de categoria */}
        {Object.keys(byCat).length > 0 && (
          <nav className="border-t border-border overflow-x-auto">
            <div className="mx-auto max-w-3xl px-6 flex gap-6 whitespace-nowrap">
              {Object.keys(byCat).map(cat => (
                <a key={cat} href={`#cat-${cat}`} className="py-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground hover:text-primary border-b-2 border-transparent hover:border-primary transition-colors">
                  {cat}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12 space-y-14">
        {isLoading && <p className="text-center text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && items.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Nenhum item disponível no momento.</p>
        )}
        {Object.entries(byCat).map(([cat, list]) => (
          <section key={cat} id={`cat-${cat}`} className="scroll-mt-20">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="font-display text-2xl">{cat}</h2>
              <span className="flex-1 h-px bg-border" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{list.length} itens</span>
            </div>
            <ul className="space-y-1">
              {list.map((i) => {
                const inCart = cart.find(c => c.id === i.id);
                return (
                  <li key={i.id} className="group flex items-baseline gap-4 py-4 border-b border-dashed border-border/60 hover:border-primary/40 transition-colors">
                    {i.image_url && (
                      <img src={i.image_url} alt={i.name} className="h-20 w-20 object-cover border border-border shrink-0 self-center" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <p className="font-display text-lg leading-tight">{i.name}</p>
                        <span className="flex-1 border-b border-dotted border-border/70 translate-y-[-4px]" />
                        <p className="font-display text-lg text-primary tabular-nums">{brl(i.price)}</p>
                      </div>
                      {i.description && <p className="text-sm text-muted-foreground mt-1 leading-relaxed pr-4">{i.description}</p>}
                    </div>
                    <Button
                      size="sm"
                      variant={inCart ? "secondary" : "outline"}
                      onClick={() => add(i)}
                      className="uppercase tracking-[0.2em] text-[10px] shrink-0 self-center min-w-[90px]"
                    >
                      {inCart ? <><Check className="h-3 w-3 mr-1" />{inCart.quantity} no pedido</> : <><Plus className="h-3 w-3 mr-1" />Adicionar</>}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {items.length > 0 && (
          <footer className="text-center pt-8 border-t border-border">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Pedido feito pela mesa · pagamento no caixa</p>
          </footer>
        )}
      </div>

      {/* Carrinho fixo */}
      {count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm px-5 py-4 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.15)]">
          <div className="mx-auto max-w-3xl flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Mesa {table || "—"}</p>
              <p className="font-display text-xl tabular-nums">{count} {count === 1 ? "item" : "itens"} · <span className="text-primary">{brl(total)}</span></p>
            </div>
            <Button onClick={() => setCheckout(true)} className="uppercase tracking-[0.25em] text-[11px] h-11 px-5">
              <ShoppingBag className="h-4 w-4 mr-2" />Finalizar
            </Button>
          </div>
        </div>
      )}

      {/* Diálogo: pedir mesa */}
      <Dialog open={askTable} onOpenChange={(o) => { if (!o && table) setAskTable(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Qual a sua mesa?</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Digite o número da sua mesa para começar.</p>
          <Input autoFocus value={tableInput} onChange={e => setTableInput(e.target.value)} placeholder="Ex: 5"
            onKeyDown={e => { if (e.key === "Enter") confirmTable(); }} />
          <DialogFooter>
            <Button onClick={confirmTable} disabled={!tableInput.trim()} className="w-full uppercase tracking-wider text-xs">Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: checkout */}
      <CheckoutDialog
        open={checkout}
        onOpenChange={setCheckout}
        cart={cart}
        total={total}
        userId={userId}
        table={table}
        onPlaced={() => { setCart([]); if (typeof window !== "undefined") localStorage.removeItem(storageKey); setCheckout(false); }}
        onUpdate={{ inc: add, dec, remove }}
        items={items}
      />
    </div>
  );
}

function CheckoutDialog({
  open, onOpenChange, cart, total, userId, table, onPlaced, onUpdate, items,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  cart: CartLine[]; total: number; userId: string; table: string;
  onPlaced: () => void;
  onUpdate: { inc: (i: Item) => void; dec: (id: string) => void; remove: (id: string) => void };
  items: Item[];
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState("");

  const place = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("place_order", {
        _kiosk_user_id: userId,
        _table_number: table,
        _customer_name: name,
        _customer_phone: phone,
        _customer_cpf: cpf,
        _waiter_code: code,
        _items: cart.map(c => ({ menu_item_id: c.id, quantity: c.quantity })),
        _notes: notes || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Pedido enviado para a cozinha!"); onPlaced(); setName(""); setPhone(""); setCpf(""); setNotes(""); setCode(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const itemMap = new Map(items.map(i => [i.id, i]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Revisar pedido — Mesa {table}</DialogTitle></DialogHeader>
        <ul className="divide-y divide-border border border-border">
          {cart.map(c => (
            <li key={c.id} className="flex items-center gap-2 p-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">{brl(c.price)} cada</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onUpdate.dec(c.id)}><Minus className="h-3 w-3" /></Button>
                <span className="w-6 text-center font-bold">{c.quantity}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => { const it = itemMap.get(c.id); if (it) onUpdate.inc(it); }}><Plus className="h-3 w-3" /></Button>
              </div>
              <Button size="icon" variant="ghost" onClick={() => onUpdate.remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
        <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
          <span>Total</span><span className="text-primary">{brl(total)}</span>
        </div>

        <div className="space-y-3 pt-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Seus dados</p>
          <div><Label>Nome completo</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Telefone</Label><Input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div><Label>CPF</Label><Input inputMode="numeric" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="Só números" /></div>
          </div>
          <div><Label>Observações (opcional)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Sem cebola, etc." /></div>
          <div className="border-t border-border pt-3">
            <Label>Código do garçom</Label>
            <Input inputMode="numeric" value={code} onChange={e => setCode(e.target.value)} placeholder="Peça ao garçom" />
            <p className="text-[11px] text-muted-foreground mt-1">O garçom precisa digitar o código para liberar seu pedido na cozinha.</p>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!name || !phone || !cpf || !code || cart.length === 0 || place.isPending}
            onClick={() => place.mutate()}
            className="w-full uppercase tracking-wider text-xs"
          >
            {place.isPending ? "Enviando…" : `Enviar pedido · ${brl(total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}