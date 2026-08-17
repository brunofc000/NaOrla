import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmployeeSession } from "@/lib/employee-session";

type Item = { id: string; name: string; price: number; category: string; is_available: boolean };
type Line = { id: string; name: string; price: number; quantity: number; notes?: string };

export const Route = createFileRoute("/_authenticated/pedido")({
  head: () => ({ meta: [{ title: "Novo Pedido — NaOrlaApp" }] }),
  validateSearch: z.object({ mesa: z.string().optional() }),
  component: NovoPedido,
});

function NovoPedido() {
  const employee = useEmployeeSession();
  const navigate = useNavigate();
  const { mesa } = Route.useSearch();
  const [table, setTable] = useState(mesa ?? "");
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<Line[]>([]);

  const { data: items = [] } = useQuery({
    queryKey: ["employee_menu", employee?.kiosk_user_id ?? "owner"],
    queryFn: async () => {
      if (employee) {
        const { data, error } = await (supabase as any).rpc("employee_get_menu_v2", { _token: employee.token });
        if (error) throw error;
        return ((data ?? []) as Item[]).filter(i => i.is_available);
      }
      const { data, error } = await supabase.from("menu_items").select("*").eq("is_available", true).order("category").order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  const add = (i: Item) => setCart(prev => {
    const f = prev.find(p => p.id === i.id);
    if (f) return prev.map(p => p.id === i.id ? { ...p, quantity: p.quantity + 1 } : p);
    return [...prev, { id: i.id, name: i.name, price: Number(i.price), quantity: 1 }];
  });
  const dec = (id: string) => setCart(prev => prev.flatMap(p => p.id === id ? (p.quantity > 1 ? [{ ...p, quantity: p.quantity - 1 }] : []) : [p]));
  const remove = (id: string) => setCart(prev => prev.filter(p => p.id !== id));
  const setItemNotes = (id: string, value: string) => setCart(prev => prev.map(p => p.id === id ? { ...p, notes: value } : p));
  const total = cart.reduce((s, p) => s + p.price * p.quantity, 0);
  const count = cart.reduce((s, p) => s + p.quantity, 0);

  const byCat = items.reduce<Record<string, Item[]>>((acc, i) => { (acc[i.category] ??= []).push(i); return acc; }, {});

  const send = useMutation({
    mutationFn: async () => {
      if (!table.trim()) throw new Error("Informe a mesa");
      if (cart.length === 0) throw new Error("Adicione itens ao pedido");
      if (!employee) throw new Error("Sessão de funcionário necessária");
      const { error } = await (supabase as any).rpc("employee_place_order_v2", {
        _token: employee.token,
        _table_number: table.trim(),
        _customer_name: customer.trim(),
        _items: cart.map(c => ({ menu_item_id: c.id, quantity: c.quantity, notes: c.notes?.trim() || undefined })),
        _notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido enviado para a cozinha!");
      setCart([]); setTable(""); setCustomer(""); setNotes("");
      navigate({ to: "/cozinha" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 pb-32">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Garçom</p>
        <h1 className="font-display text-3xl">Novo pedido</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div><Label>Mesa</Label><Input value={table} onChange={e => setTable(e.target.value)} placeholder="Ex: 5" /></div>
        <div><Label>Cliente (opcional)</Label><Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Nome" /></div>
      </div>
      <div><Label>Observações gerais do pedido</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: levar tudo junto" /></div>

      {Object.entries(byCat).map(([cat, list]) => (
        <section key={cat}>
          <h2 className="text-sm uppercase tracking-wider text-primary mb-2">{cat}</h2>
          <ul className="divide-y divide-border border border-border">
            {list.map(i => {
              const inCart = cart.find(c => c.id === i.id);
              return (
                <li key={i.id} className="p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{i.name}</p>
                      <p className="text-xs text-primary font-bold">{brl(i.price)}</p>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => dec(i.id)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-7 text-center font-bold">{inCart.quantity}</span>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => add(i)}><Plus className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => add(i)} className="uppercase tracking-wider text-[10px]">
                        <Plus className="h-3 w-3 mr-1" />Add
                      </Button>
                    )}
                  </div>
                  {inCart && (
                    <Input
                      value={inCart.notes ?? ""}
                      onChange={e => setItemNotes(i.id, e.target.value)}
                      placeholder={`Observação de ${i.name} (ex: sem cebola)`}
                      className="h-8 text-xs"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item disponível no cardápio.</p>}

      {count > 0 && (
        <div className="fixed bottom-[72px] left-0 right-0 border-t border-border bg-background/95 backdrop-blur px-5 py-3 z-30">
          <div className="mx-auto max-w-2xl flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Mesa {table || "—"}</p>
              <p className="font-display text-lg">{count} {count === 1 ? "item" : "itens"} · <span className="text-primary">{brl(total)}</span></p>
            </div>
            <Button onClick={() => send.mutate()} disabled={send.isPending || !table.trim()} className="uppercase tracking-wider text-xs">
              <Send className="h-4 w-4 mr-2" />{send.isPending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}