import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Calendar, ChevronRight, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — NaOrlaApp" }] }),
  component: Relatorios,
});

function Relatorios() {
  const [selectedClosure, setSelectedClosure] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const since = new Date(); since.setDate(since.getDate() - 30);
  const { data } = useQuery({
    queryKey: ["report-30d"],
    queryFn: async () => {
      const { data: txs, error } = await supabase
        .from("transactions").select("type, amount, created_at, category, payment_method")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return txs ?? [];
    },
  });

  const { data: closures = [] } = useQuery({
    queryKey: ["cash_closures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_closures")
        .select("*")
        .order("closed_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: closureOrders = [] } = useQuery({
    queryKey: ["closure_orders", selectedClosure?.id],
    queryFn: async () => {
      if (!selectedClosure) return [];
      const closureDate = new Date(selectedClosure.closed_at);
      const startOfDay = new Date(closureDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(closureDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_number, customer_name, status, total, payment_method, closed_at, closed_by, order_items(name, quantity, price)")
        .eq("status", "entregue")
        .gte("closed_at", startOfDay.toISOString())
        .lte("closed_at", endOfDay.toISOString())
        .order("closed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedClosure,
  });

  const { data: dayOrders = [] } = useQuery({
    queryKey: ["day_orders", selectedDay?.date?.toISOString()],
    queryFn: async () => {
      if (!selectedDay) return [];
      const startOfDay = new Date(selectedDay.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDay.date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const { data, error } = await supabase
        .from("orders")
        .select("id, table_number, customer_name, status, total, payment_method, closed_at, closed_by, order_items(name, quantity, price)")
        .eq("status", "entregue")
        .gte("closed_at", startOfDay.toISOString())
        .lte("closed_at", endOfDay.toISOString())
        .order("closed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedDay,
  });

  const { data: dayTransactions = [] } = useQuery({
    queryKey: ["day_transactions", selectedDay?.date?.toISOString()],
    queryFn: async () => {
      if (!selectedDay) return [];
      const startOfDay = new Date(selectedDay.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDay.date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const { data, error } = await supabase
        .from("transactions")
        .select("type, amount, description, category, payment_method, created_at")
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedDay,
  });

  const list = data ?? [];
  const income = list.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = list.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const profit = income - expense;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const day = list.filter(t => { const c = new Date(t.created_at); return c >= d && c < next; });
    const inc = day.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = day.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { date: d, inc, exp, profit: inc - exp };
  }).reverse();

  const max = Math.max(1, ...days.map(d => d.inc));

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Últimos 30 dias</p>
        <h1 className="font-display text-3xl">Relatórios</h1>
      </header>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="border border-border p-3">
          <div className="flex items-center gap-1 text-primary text-xs"><TrendingUp className="h-3 w-3" />Entradas</div>
          <p className="font-display text-xl mt-1">{brl(income)}</p>
        </div>
        <div className="border border-border p-3">
          <div className="flex items-center gap-1 text-destructive text-xs"><TrendingDown className="h-3 w-3" />Saídas</div>
          <p className="font-display text-xl mt-1">{brl(expense)}</p>
        </div>
        <div className="bg-muted p-3">
          <div className="flex items-center gap-1 text-primary text-xs"><DollarSign className="h-3 w-3" />Lucro</div>
          <p className="font-display text-xl mt-1">{brl(profit)}</p>
        </div>
      </div>

      <section>
        <h2 className="font-display text-xl mb-3">Últimos 7 dias</h2>
        <ul className="space-y-2">
          {days.map(d => (
            <li 
              key={d.date.toISOString()} 
              className="text-sm p-3 border border-border rounded-lg cursor-pointer hover:bg-muted transition-colors"
              onClick={() => setSelectedDay(d)}
            >
              <div className="flex justify-between mb-1">
                <span className="font-semibold">{d.date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                <span className={`font-bold ${d.profit >= 0 ? "text-primary" : "text-destructive"}`}>{brl(d.profit)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Entradas: {brl(d.inc)}</span>
                <span>Saídas: {brl(d.exp)}</span>
              </div>
              <div className="h-2 bg-muted overflow-hidden mt-1">
                <div className="h-full bg-primary" style={{ width: `${(d.inc / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Histórico de fechamentos */}
      <section>
        <h2 className="font-display text-xl mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Histórico de fechamentos
        </h2>
        {closures.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum fechamento registrado.</p>
        ) : (
          <ul className="space-y-2">
            {closures.map((c: any) => (
              <li
                key={c.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg cursor-pointer hover:bg-muted transition-colors"
                onClick={() => setSelectedClosure(c)}
              >
                <div>
                  <p className="font-semibold">
                    {new Date(c.closed_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.sales_count} vendas · Ticket médio: {brl(c.ticket_avg)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{brl(c.profit)}</p>
                    <p className="text-xs text-muted-foreground">Lucro</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Dialog de detalhes do fechamento */}
      {selectedClosure && (
        <Dialog open={!!selectedClosure} onOpenChange={() => setSelectedClosure(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">
                {new Date(selectedClosure.closed_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Fechado às {new Date(selectedClosure.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </DialogHeader>

            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-2 border border-border p-3">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Entradas</p>
                  <p className="font-display text-lg text-primary">{brl(selectedClosure.total_income)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Saídas</p>
                  <p className="font-display text-lg text-destructive">{brl(selectedClosure.total_expense)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Lucro</p>
                  <p className={`font-display text-lg ${selectedClosure.profit >= 0 ? "text-primary" : "text-destructive"}`}>{brl(selectedClosure.profit)}</p>
                </div>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Vendas: <span className="font-bold text-foreground">{selectedClosure.sales_count}</span></span>
                <span>Ticket médio: <span className="font-bold text-foreground">{brl(selectedClosure.ticket_avg)}</span></span>
              </div>

              {/* Pedidos fechados no dia */}
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Pedidos fechados ({closureOrders.length})
                </h3>
                {closureOrders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum pedido encontrado.</p>
                ) : (
                  <ul className="divide-y divide-border border border-border max-h-60 overflow-y-auto">
                    {closureOrders.map((o: any) => (
                      <li key={o.id} className="p-2 text-xs">
                        <div className="flex justify-between">
                          <span className="font-semibold">Mesa {o.table_number}</span>
                          <span className="font-bold">{brl(Number(o.total))}</span>
                        </div>
                        {o.closed_by && (
                          <p className="text-muted-foreground">
                            Fechado por {o.closed_by} às {new Date(o.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                        <p className="text-muted-foreground">
                          {o.payment_method === "dinheiro" ? "Dinheiro" :
                           o.payment_method === "pix" ? "PIX" :
                           o.payment_method === "cartao_debito" ? "Cartão Débito" :
                           o.payment_method === "cartao_credito" ? "Cartão Crédito" :
                           o.payment_method === "outro" ? "Outro" : o.payment_method}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedClosure(null)} className="uppercase tracking-wider text-xs">
                Fechar
              </Button>
              <Button onClick={() => window.print()} className="uppercase tracking-wider text-xs">
                Imprimir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de detalhes do dia */}
      {selectedDay && (
        <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">
                {selectedDay.date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Resumo do dia */}
              <div className="grid grid-cols-3 gap-2 border border-border p-3">
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Entradas</p>
                  <p className="font-display text-lg text-primary">{brl(selectedDay.inc)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Saídas</p>
                  <p className="font-display text-lg text-destructive">{brl(selectedDay.exp)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground">Lucro</p>
                  <p className={`font-display text-lg ${selectedDay.profit >= 0 ? "text-primary" : "text-destructive"}`}>{brl(selectedDay.profit)}</p>
                </div>
              </div>

              {/* Pedidos fechados no dia */}
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Pedidos fechados ({dayOrders.length})
                </h3>
                {dayOrders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum pedido encontrado.</p>
                ) : (
                  <ul className="divide-y divide-border border border-border max-h-40 overflow-y-auto">
                    {dayOrders.map((o: any) => (
                      <li key={o.id} className="p-2 text-xs">
                        <div className="flex justify-between">
                          <span className="font-semibold">Mesa {o.table_number}</span>
                          <span className="font-bold">{brl(Number(o.total))}</span>
                        </div>
                        {o.closed_by && (
                          <p className="text-muted-foreground">
                            Fechado por {o.closed_by} às {new Date(o.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                        <p className="text-muted-foreground">
                          {o.payment_method === "dinheiro" ? "Dinheiro" :
                           o.payment_method === "pix" ? "PIX" :
                           o.payment_method === "cartao_debito" ? "Cartão Débito" :
                           o.payment_method === "cartao_credito" ? "Cartão Crédito" :
                           o.payment_method === "outro" ? "Outro" : o.payment_method}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Transações do dia */}
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Transações ({dayTransactions.length})
                </h3>
                {dayTransactions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma transação encontrada.</p>
                ) : (
                  <ul className="divide-y divide-border border border-border max-h-40 overflow-y-auto">
                    {dayTransactions.map((t: any, i: number) => (
                      <li key={i} className="p-2 text-xs">
                        <div className="flex justify-between">
                          <span className="font-semibold">{t.description || t.category}</span>
                          <span className={`font-bold ${t.type === "income" ? "text-primary" : "text-destructive"}`}>
                            {t.type === "income" ? "+" : "-"}{brl(Number(t.amount))}
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {t.payment_method && ` · ${t.payment_method}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedDay(null)} className="uppercase tracking-wider text-xs">
                Fechar
              </Button>
              <Button onClick={() => window.print()} className="uppercase tracking-wider text-xs">
                Imprimir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}