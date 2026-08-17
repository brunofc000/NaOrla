import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { useEmployeeSession } from "@/lib/employee-session";

type Status = "novo" | "preparando" | "pronto" | "entregue" | "cancelado";
type Order = {
  id: string; table_number: string; customer_name: string; customer_phone: string;
  status: Status; total: number; notes: string | null; created_at: string;
  order_items: { id: string; name: string; quantity: number; price: number; notes: string | null }[];
};

export const Route = createFileRoute("/_authenticated/cozinha")({
  head: () => ({ meta: [{ title: "Cozinha — NaOrlaApp" }] }),
  component: Cozinha,
});

const COLS: { key: Status; label: string; next?: Status }[] = [
  { key: "novo", label: "Novos", next: "preparando" },
  { key: "preparando", label: "Preparando", next: "pronto" },
  { key: "pronto", label: "Prontos", next: "entregue" },
];

function Cozinha() {
  const qc = useQueryClient();
  const employee = useEmployeeSession();

  const { data: orders = [] } = useQuery({
    queryKey: ["orders-kitchen", employee?.kiosk_user_id ?? "owner"],
    queryFn: async () => {
      if (employee) {
        const { data, error } = await (supabase as any).rpc("employee_get_kitchen_orders_v2", {
          _token: employee.token,
        });
        if (error) throw error;
        return (data ?? []) as Order[];
      }
      const { data, error } = await supabase
        .from("orders")
        .select("id,table_number,customer_name,customer_phone,status,total,notes,created_at,order_items(id,name,quantity,price,notes)")
        .in("status", ["novo", "preparando", "pronto"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Order[];
    },
    refetchInterval: 20000,
  });

  useEffect(() => {
    // Realtime disabled for orders/order_items (sensitive data). Polling via refetchInterval is enough.
  }, [qc, employee]);

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      if (employee) {
        const { error } = await (supabase as any).rpc("employee_update_order_status_v2", {
          _token: employee.token,
          _order_id: id,
          _status: status,
        });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders-kitchen", employee?.kiosk_user_id ?? "owner"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped: Record<Status, Order[]> = { novo: [], preparando: [], pronto: [], entregue: [], cancelado: [] };
  orders.forEach(o => grouped[o.status].push(o));

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Cozinha</p>
          <h1 className="font-display text-3xl flex items-center gap-2"><ChefHat className="h-7 w-7" />{orders.length} ativos</h1>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {COLS.map(col => (
          <section key={col.key} className="space-y-3">
            <h2 className="font-display text-sm uppercase tracking-wider text-primary border-b border-border pb-2">
              {col.label} <span className="text-muted-foreground">({grouped[col.key].length})</span>
            </h2>
            {grouped[col.key].length === 0 && <p className="text-xs text-muted-foreground">—</p>}
            {grouped[col.key].map(o => (
              <article key={o.id} className="border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-display text-lg">Mesa {o.table_number}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <p className="text-xs text-muted-foreground">{o.customer_name} · {o.customer_phone}</p>
                <ul className="text-sm divide-y divide-border/60">
                  {o.order_items.map(it => (
                    <li key={it.id} className="py-1.5">
                      <span className="font-bold text-primary mr-1">{it.quantity}×</span>{it.name}
                      {it.notes && <p className="text-[11px] italic text-muted-foreground">obs: {it.notes}</p>}
                    </li>
                  ))}
                </ul>
                {o.notes && <p className="text-[11px] italic text-muted-foreground border-t border-border pt-1">obs geral: {o.notes}</p>}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-sm font-bold">{brl(Number(o.total))}</p>
                  <div className="flex gap-1">
                    {col.next && (
                      <Button size="sm" onClick={() => update.mutate({ id: o.id, status: col.next! })} className="uppercase tracking-wider text-[11px]">
                        {col.next === "preparando" ? "Iniciar" : col.next === "pronto" ? "Pronto" : "Entregar"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => update.mutate({ id: o.id, status: "cancelado" })} className="uppercase tracking-wider text-[11px]">Cancelar</Button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}