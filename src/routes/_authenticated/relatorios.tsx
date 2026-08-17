import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — NaOrlaApp" }] }),
  component: Relatorios,
});

function Relatorios() {
  const since = new Date(); since.setDate(since.getDate() - 30);
  const { data } = useQuery({
    queryKey: ["report-30d"],
    queryFn: async () => {
      const { data: txs, error } = await supabase
        .from("transactions").select("type, amount, created_at, category")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return txs ?? [];
    },
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
            <li key={d.date.toISOString()} className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="font-semibold">{d.date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                <span className={`font-bold ${d.profit >= 0 ? "text-primary" : "text-destructive"}`}>{brl(d.profit)}</span>
              </div>
              <div className="h-2 bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(d.inc / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}