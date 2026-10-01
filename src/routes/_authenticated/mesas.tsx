import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock, Users, PlusCircle, PenLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, minutesSince, waitingLabel, waitingChipClass } from "@/lib/format";
import { Button } from "@/components/ui/button";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes: string | null;
  delivered: boolean;
  created_at?: string | null;
  placed_by?: string | null;
};

type Order = {
  id: string;
  table_number: string;
  customer_name: string | null;
  status: string;
  total: number;
  notes: string | null;
  created_at: string;
  placed_by: string | null;
  order_items: OrderItem[];
};

type TableGroup = {
  table: string;
  orders: Order[];
  itemsCount: number;
  pendingCount: number;
  total: number;
  firstAt: string;
  customers: string[];
  oldestPending: { name: string; since: string } | null;
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

export const Route = createFileRoute("/_authenticated/mesas")({
  head: () => ({ meta: [{ title: "Pedidos — NaOrlaApp" }] }),
  component: MesasPage,
});

function MesasPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const navigate = useNavigate();

  // Relógio para atualizar os "há X min" sem depender de refetch
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["owner_open_tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_number, customer_name, status, total, notes, created_at, placed_by, order_items(id, name, quantity, price, notes, delivered, created_at, placed_by)")
        .in("status", ["novo", "preparando", "pronto"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  // Agrupa os pedidos abertos por mesa
  const tables: TableGroup[] = [];
  const index = new Map<string, TableGroup>();
  for (const o of orders) {
    const key = o.table_number ?? "";
    let group = index.get(key);
    if (!group) {
      group = { table: key, orders: [], itemsCount: 0, pendingCount: 0, total: 0, firstAt: o.created_at, customers: [], oldestPending: null };
      index.set(key, group);
      tables.push(group);
    }
    group.orders.push(o);
    group.total += Number(o.total ?? 0);
    if (o.created_at < group.firstAt) group.firstAt = o.created_at;
    if (o.customer_name && !group.customers.includes(o.customer_name)) group.customers.push(o.customer_name);
    for (const it of o.order_items ?? []) {
      group.itemsCount += 1;
      if (!it.delivered) {
        group.pendingCount += 1;
        const since = it.created_at ?? o.created_at;
        if (!group.oldestPending || since < group.oldestPending.since) {
          group.oldestPending = { name: it.name, since };
        }
      }
    }
  }
  tables.sort((a, b) => a.table.localeCompare(b.table, "pt-BR", { numeric: true }));

  const table = selected ? tables.find(t => t.table === selected) : undefined;
  if (table) return <TableDetail table={table} now={now} onBack={() => setSelected(null)} />;

  const totalPending = tables.reduce((s, t) => s + t.pendingCount, 0);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Pedidos</p>
        <h1 className="font-display text-3xl flex items-center gap-2">
          <Users className="h-7 w-7" />
          {tables.length} mesa{tables.length === 1 ? "" : "s"} aberta{tables.length === 1 ? "" : "s"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Mesas com pedidos em aberto agora. Toque numa mesa para ver os pedidos e a entrega.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 uppercase tracking-wider text-xs"
          onClick={() => navigate({ to: "/pedido" })}
        >
          <PlusCircle className="h-4 w-4 mr-2" />Adicionar pedido
        </Button>
      </header>

      {totalPending > 0 && (
        <div className="flex items-center gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            {totalPending} item{totalPending === 1 ? "" : "ns"} ainda não {totalPending === 1 ? "foi entregue" : "foram entregues"} pelo garçom.
          </span>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && tables.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma mesa aberta no momento.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {tables.map(t => (
          <button
            key={t.table}
            type="button"
            onClick={() => setSelected(t.table)}
            className="border border-border bg-muted/30 p-3 text-left space-y-1 transition-colors hover:border-secondary hover:bg-secondary/10"
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-lg">Mesa {t.table}</p>
              {t.pendingCount > 0 ? (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  {t.pendingCount} pendente{t.pendingCount === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                  Tudo entregue
                </span>
              )}
            </div>
            {t.oldestPending && (
              <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${waitingChipClass(minutesSince(t.oldestPending.since, now))}`}>
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  Pediu {t.oldestPending.name} {waitingLabel(t.oldestPending.since, now)}
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t.orders.length} pedido{t.orders.length === 1 ? "" : "s"} · desde{" "}
              {new Date(t.firstAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            {t.customers.length > 0 && (
              <p className="text-xs text-muted-foreground truncate">{t.customers.join(", ")}</p>
            )}
            <p className="text-sm font-bold">{brl(t.total)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function TableDetail({ table, now, onBack }: { table: TableGroup; now: number; onBack: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <Button
          variant="outline"
          size="sm"
          className="uppercase tracking-wider text-xs"
          onClick={() => navigate({ to: "/pedido", search: { mesa: table.table } })}
        >
          <PlusCircle className="h-4 w-4 mr-2" />Adicionar pedido
        </Button>
      </div>

      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Pedidos da mesa</p>
        <h1 className="font-display text-3xl">Mesa {table.table}</h1>
        {table.customers.length > 0 && (
          <p className="text-sm text-muted-foreground">{table.customers.join(", ")}</p>
        )}
      </header>

      <div className="grid grid-cols-3 gap-3">
        <div className="border border-border bg-muted/30 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pedidos</p>
          <p className="font-display text-2xl">{table.orders.length}</p>
        </div>
        <div className="border border-border bg-muted/30 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">A entregar</p>
          <p className={`font-display text-2xl ${table.pendingCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {table.pendingCount}
          </p>
        </div>
        <div className="border border-border bg-muted/30 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="font-display text-2xl">{brl(table.total)}</p>
        </div>
      </div>

      {table.orders.map(o => {
        const deliveredCount = (o.order_items ?? []).filter(i => i.delivered).length;
        const itemsCount = (o.order_items ?? []).length;
        return (
          <article key={o.id} className="border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-display text-lg">Pedido</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[o.status] ?? "bg-muted text-foreground"}`}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                {o.placed_by && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <PenLine className="h-3 w-3" />
                    {o.placed_by === "Dono" ? "Anotado pelo Dono" : `Anotado por ${o.placed_by}`}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            {o.customer_name && <p className="text-xs text-muted-foreground">{o.customer_name}</p>}

            <ul className="text-sm divide-y divide-border/60">
              {(o.order_items ?? []).map(it => (
                <li key={it.id} className="py-1.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p>
                      <span className="font-bold text-primary mr-1">{it.quantity}×</span>
                      {it.name}
                    </p>
                    {it.notes && <p className="text-[11px] italic text-muted-foreground">obs: {it.notes}</p>}
                    {it.placed_by && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <PenLine className="h-3 w-3" />
                        anotado por {it.placed_by}
                      </p>
                    )}
                  </div>
                  {it.delivered ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                      <Check className="h-3 w-3" />
                      Entregue
                    </span>
                  ) : (
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${waitingChipClass(minutesSince(it.created_at ?? o.created_at, now))}`}>
                      <Clock className="h-3 w-3" />
                      Pendente {waitingLabel(it.created_at ?? o.created_at, now)}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {o.notes && (
              <p className="text-[11px] italic text-muted-foreground border-t border-border pt-1">obs geral: {o.notes}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {deliveredCount === itemsCount
                  ? "Todos os itens entregues pelo garçom"
                  : `Garçom entregou ${deliveredCount} de ${itemsCount} item${itemsCount === 1 ? "" : "s"}`}
              </p>
              <p className="text-sm font-bold">{brl(Number(o.total))}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}


