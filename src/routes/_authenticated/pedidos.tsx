import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Receipt, Trash2, Minus, Plus, X, PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { useEmployeeSession } from "@/lib/employee-session";

type OrderItem = { id: string; name: string; quantity: number; price: number; notes?: string | null; delivered?: boolean; created_at?: string };
type Order = {
  id: string;
  table_number: string;
  customer_name: string | null;
  status: string;
  total: number;
  notes: string | null;
  created_at: string;
  order_items: OrderItem[];
};

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  preparando: "Em preparação",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  novo: "bg-muted text-foreground",
  preparando: "bg-amber-500/20 text-amber-900",
  pronto: "bg-emerald-500/20 text-emerald-900",
  entregue: "bg-secondary/30 text-foreground",
  cancelado: "bg-destructive/20 text-destructive",
};

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — NaOrlaApp" }] }),
  component: PedidosPage,
});

function PedidosPage() {
  const employee = useEmployeeSession();
  return employee ? <PedidosWaiter /> : <PedidosOwner />;
}

function PedidosOwner() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todos" | "pagos" | "abertos" | "cancelados">("todos");
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["owner_all_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_number, customer_name, status, total, notes, created_at, order_items(id, name, quantity, price, notes, delivered, created_at)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });

  const term = q.trim().toLowerCase();
  const visible = orders
    .filter(o => {
      if (filter === "pagos") return o.status === "entregue";
      if (filter === "cancelados") return o.status === "cancelado";
      if (filter === "abertos") return o.status !== "entregue" && o.status !== "cancelado";
      return true;
    })
    .filter(o =>
      !term ||
      o.table_number?.toLowerCase().includes(term) ||
      (o.customer_name ?? "").toLowerCase().includes(term) ||
      o.order_items.some(i => i.name.toLowerCase().includes(term))
    );

  // Group by day (yyyy-mm-dd in local tz)
  const groups = new Map<string, Order[]>();
  for (const o of visible) {
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(o);
  }
  const days = Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  function dayLabel(key: string) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0,0,0,0);
    const ydate = new Date(today); ydate.setDate(ydate.getDate() - 1);
    if (date.getTime() === today.getTime()) return "Hoje";
    if (date.getTime() === ydate.getTime()) return "Ontem";
    return date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Histórico completo separado por dia, com balanço automático.</p>
      </div>
      <Input placeholder="Buscar por mesa, cliente ou item…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {([
          ["todos", "Todos"],
          ["pagos", "Cobrados"],
          ["abertos", "Em aberto"],
          ["cancelados", "Cancelados"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              filter === k ? "border-secondary bg-secondary/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && days.length === 0 && <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>}

      {days.map(([key, list]) => {
        const paid = list.filter(o => o.status === "entregue");
        const open = list.filter(o => o.status !== "entregue" && o.status !== "cancelado");
        const cancelled = list.filter(o => o.status === "cancelado");
        const revenue = paid.reduce((s, o) => s + Number(o.total ?? 0), 0);
        const cancelledTotal = cancelled.reduce((s, o) => s + Number(o.total ?? 0), 0);
        const soldItems = new Map<string, { qty: number; total: number }>();
        for (const o of paid) {
          for (const it of o.order_items) {
            const cur = soldItems.get(it.name) ?? { qty: 0, total: 0 };
            cur.qty += it.quantity ?? 0;
            cur.total += Number(it.price ?? 0) * (it.quantity ?? 0);
            soldItems.set(it.name, cur);
          }
        }
        const sold = Array.from(soldItems.entries()).sort((a, b) => b[1].qty - a[1].qty);
        const totalUnits = sold.reduce((s, [, v]) => s + v.qty, 0);

        const cancelledItems = new Map<string, { qty: number; total: number }>();
        for (const o of cancelled) {
          for (const it of o.order_items) {
            const cur = cancelledItems.get(it.name) ?? { qty: 0, total: 0 };
            cur.qty += it.quantity ?? 0;
            cur.total += Number(it.price ?? 0) * (it.quantity ?? 0);
            cancelledItems.set(it.name, cur);
          }
        }
        const cancelledList = Array.from(cancelledItems.entries()).sort((a, b) => b[1].qty - a[1].qty);

        return (
          <section key={key} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold capitalize">{dayLabel(key)}</h2>
              <span className="text-xs text-muted-foreground">{list.length} pedidos</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Cobrado" value={brl(revenue)} accent />
              <Stat label="Pedidos pagos" value={String(paid.length)} />
              <Stat label="Em aberto" value={String(open.length)} />
              <Stat label="Cancelados" value={`${cancelled.length} · ${brl(cancelledTotal)}`} />
              <Stat label="Itens vendidos" value={String(totalUnits)} />
            </div>
            {sold.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Produtos vendidos</p>
                <ul className="space-y-1 text-sm">
                  {sold.map(([name, v]) => (
                    <li key={name} className="flex justify-between gap-2">
                      <span>{v.qty}× {name}</span>
                      <span className="font-semibold text-secondary">{brl(v.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cancelledList.length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-destructive">Produtos cancelados</p>
                <ul className="space-y-1 text-sm">
                  {cancelledList.map(([name, v]) => (
                    <li key={name} className="flex justify-between gap-2">
                      <span>{v.qty}× {name}</span>
                      <span className="font-semibold text-destructive">−{brl(v.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="space-y-2">
              {list.map(o => (
                <li key={o.id} className="rounded-lg border border-border bg-card text-sm">
                  <details className="group">
                    <summary className="flex cursor-pointer items-start justify-between gap-2 p-3 list-none [&::-webkit-details-marker]:hidden">
                      <div>
                        <p className="font-semibold">Mesa {o.table_number} · {o.customer_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {o.order_items.length} itens · toque para ver
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[o.status] ?? "bg-muted"}`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                        <p className="mt-1 font-bold">{brl(Number(o.total ?? 0))}</p>
                      </div>
                    </summary>
                    <ul className="space-y-1 border-t border-border px-3 py-2 text-sm">
                      {o.order_items.map(i => (
                        <li key={i.id} className="flex justify-between gap-2">
                          <span>
                            {i.quantity}× {i.name}
                            {i.notes && <span className="block text-xs text-muted-foreground">obs: {i.notes}</span>}
                          </span>
                          <span className="text-muted-foreground">{brl(Number(i.price) * i.quantity)}</span>
                        </li>
                      ))}
                      {o.notes && <li className="text-xs text-muted-foreground">Obs. geral: {o.notes}</li>}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-black ${accent ? "text-secondary" : ""}`}>{value}</p>
    </div>
  );
}

function PedidosWaiter() {
  const employee = useEmployeeSession();
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const [closing, setClosing] = useState<Order | null>(null);
  const [method, setMethod] = useState<"dinheiro" | "pix" | "cartao" | "outro">("pix");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["waiter_orders", employee?.token ?? "owner"],
    queryFn: async () => {
      if (employee) {
        const { data, error } = await (supabase as any).rpc("employee_get_kitchen_orders_v2", { _token: employee.token });
        if (error) throw error;
        return (data ?? []) as Order[];
      }
      // Owner view: query orders directly
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_number, customer_name, status, total, notes, created_at, order_items(id, name, quantity, price, notes, delivered)")
        .in("status", ["novo", "preparando", "pronto"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
    refetchInterval: 12000,
    refetchIntervalInBackground: false,
  });

  const toggleDelivered = useMutation({
    mutationFn: async ({ itemId, delivered }: { itemId: string; delivered: boolean }) => {
      if (!employee) throw new Error("Sessão expirada");
      const { error } = await (supabase as any).rpc("employee_set_item_delivered_v2", {
        _token: employee.token, _item_id: itemId, _delivered: delivered,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waiter_orders"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const closeOrder = useMutation({
    mutationFn: async ({ orderId, paymentMethod }: { orderId: string; paymentMethod: string }) => {
      if (!employee) throw new Error("Apenas funcionários podem fechar mesas");
      const { error } = await (supabase as any).rpc("employee_close_order_v2", {
        _token: employee.token, _order_id: orderId, _payment_method: paymentMethod,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mesa fechada e pagamento registrado!");
      setClosing(null);
      qc.invalidateQueries({ queryKey: ["waiter_orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao fechar mesa"),
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      if (!employee) throw new Error("Sessão expirada");
      const { error } = await (supabase as any).rpc("employee_remove_order_item_v2", { _token: employee.token, _item_id: itemId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waiter_orders"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const updateQty = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (!employee) throw new Error("Sessão expirada");
      const { error } = await (supabase as any).rpc("employee_update_item_quantity_v2", {
        _token: employee.token, _item_id: itemId, _quantity: quantity,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waiter_orders"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao alterar"),
  });

  const cancelOrder = useMutation({
    mutationFn: async (orderId: string) => {
      if (!employee) throw new Error("Sessão expirada");
      const { error } = await (supabase as any).rpc("employee_cancel_order_v2", { _token: employee.token, _order_id: orderId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pedido cancelado"); qc.invalidateQueries({ queryKey: ["waiter_orders"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cancelar"),
  });

  const term = q.trim().toLowerCase();
  const filtered = term
    ? orders.filter(o =>
        o.table_number?.toLowerCase().includes(term) ||
        (o.customer_name ?? "").toLowerCase().includes(term) ||
        o.status.toLowerCase().includes(term) ||
        o.order_items.some(i => i.name.toLowerCase().includes(term))
      )
    : orders;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Veja o status dos pedidos em andamento.</p>
      </div>
      <Input
        placeholder="Buscar por mesa, cliente, item ou status…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
      )}
      <ul className="space-y-3">
        {filtered.map(o => (
          <li key={o.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">Mesa {o.table_number}</p>
                {o.customer_name && <p className="text-sm text-muted-foreground">{o.customer_name}</p>}
                <p className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[o.status] ?? "bg-muted"}`}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                {employee && (
                  <Link
                    to="/pedido"
                    search={{ mesa: o.table_number }}
                    aria-label="Adicionar itens"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:opacity-90"
                  >
                    <PlusCircle className="h-5 w-5" />
                  </Link>
                )}
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {o.order_items.map(i => (
                <li key={i.id} className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleDelivered.mutate({ itemId: i.id, delivered: !i.delivered })}
                    disabled={toggleDelivered.isPending}
                    className="flex flex-1 items-start gap-2 text-left"
                    aria-label={i.delivered ? "Marcar como pendente" : "Marcar como entregue"}
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                      i.delivered ? "border-emerald-600 bg-emerald-600 text-white" : "border-border bg-background"
                    }`}>
                      {i.delivered && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className={i.delivered ? "line-through text-muted-foreground" : ""}>
                      {i.quantity}× {i.name}
                      {i.created_at && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {new Date(i.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {i.notes && <span className="block text-xs text-muted-foreground">obs: {i.notes}</span>}
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    {employee && !i.delivered && (
                      <>
                        <button
                          type="button"
                          aria-label="Diminuir"
                          onClick={() => updateQty.mutate({ itemId: i.id, quantity: Math.max(1, i.quantity - 1) })}
                          disabled={updateQty.isPending || i.quantity <= 1}
                          className="rounded border border-border p-1 disabled:opacity-40"
                        ><Minus className="h-3 w-3" /></button>
                        <button
                          type="button"
                          aria-label="Aumentar"
                          onClick={() => updateQty.mutate({ itemId: i.id, quantity: i.quantity + 1 })}
                          disabled={updateQty.isPending}
                          className="rounded border border-border p-1"
                        ><Plus className="h-3 w-3" /></button>
                        <button
                          type="button"
                          aria-label="Remover item"
                          onClick={() => { if (confirm(`Remover ${i.name}?`)) removeItem.mutate(i.id); }}
                          disabled={removeItem.isPending}
                          className="rounded border border-border p-1 text-destructive"
                        ><Trash2 className="h-3 w-3" /></button>
                      </>
                    )}
                    <span className="ml-1 text-muted-foreground">{brl(i.price * i.quantity)}</span>
                  </div>
                </li>
              ))}
            </ul>
            {o.notes && <p className="mt-2 text-xs text-muted-foreground">Obs. geral: {o.notes}</p>}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Total {brl(o.total)}</p>
              {employee && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { if (confirm(`Cancelar pedido da mesa ${o.table_number}?`)) cancelOrder.mutate(o.id); }}>
                    <X className="mr-1 h-4 w-4" /> Cancelar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { setClosing(o); setMethod("pix"); }}>
                    <Receipt className="mr-1 h-4 w-4" /> Fechar mesa
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {closing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => !closeOrder.isPending && setClosing(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Fechar mesa {closing.table_number}</h2>
            <p className="text-sm text-muted-foreground">Confira o total e a forma de pagamento.</p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
              {closing.order_items.map(i => (
                <li key={i.id} className="flex justify-between">
                  <span>{i.quantity}× {i.name}</span>
                  <span className="text-muted-foreground">{brl(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-xl font-black text-secondary">{brl(closing.total)}</span>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {(["dinheiro","pix","cartao","outro"] as const).map(m => (
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
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setClosing(null)} disabled={closeOrder.isPending}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={() => closeOrder.mutate({ orderId: closing.id, paymentMethod: method })} disabled={closeOrder.isPending}>
                {closeOrder.isPending ? "Fechando…" : "Confirmar pagamento"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}