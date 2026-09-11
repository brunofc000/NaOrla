import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Wallet, Package, BarChart3, Users, UtensilsCrossed, Truck, Bell, ChefHat, ClipboardList, Calculator,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { brl, greet } from "@/lib/format";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Início — NaOrlaApp" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: profile } = useProfile();

  const { data: today } = useQuery({
    queryKey: ["dashboard-today"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data: txs } = await supabase
        .from("transactions")
        .select("type, amount, created_at, description, payment_method, category")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false });
      const income = txs?.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
      const expense = txs?.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0) ?? 0;
      const salesCount = txs?.filter(t => t.type === "income").length ?? 0;
      return { income, expense, profit: income - expense, ticket: salesCount ? income / salesCount : 0, salesCount, last: txs?.slice(0, 5) ?? [], all: txs ?? [] };
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ["dashboard-lowstock"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, quantity, min_quantity").eq("is_active", true);
      return data?.filter(p => p.quantity <= p.min_quantity) ?? [];
    },
  });

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm text-muted-foreground">{greet()},</p>
        <h1 className="text-2xl font-black">
          {profile?.display_name || "Dono"} ☀️
        </h1>
        <p className="text-sm text-muted-foreground">
          Seu quiosque <span className="font-semibold text-foreground">{profile?.kiosk_name || "—"}</span> está pronto!
        </p>
      </motion.div>

      {/* Resumo do dia (compacto) + fechamento */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="grid grid-cols-3 gap-3 text-sm flex-1">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entradas</p>
              <p className="font-bold text-success">{brl(today?.income ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saídas</p>
              <p className="font-bold text-destructive">{brl(today?.expense ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vendas</p>
              <p className="font-bold">{today?.salesCount ?? 0}</p>
            </div>
          </div>
        </div>
        <CashCloseDialog txs={today?.all ?? []} />
      </motion.div>

      {/* Ações rápidas */}
      <div>
        <h2 className="mb-3 font-bold">Ações rápidas</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction to="/caixa" icon={<Wallet />} label="Registrar venda" tint="gradient-ocean" />
          <QuickAction to="/estoque" icon={<Package />} label="Baixar estoque" tint="bg-secondary/20" />
          <QuickAction to="/funcionarios" icon={<Users />} label="Funcionários" tint="bg-primary/20" />
          <QuickAction to="/relatorios" icon={<BarChart3 />} label="Relatórios" tint="bg-warning/20" />
        </div>
      </div>

      {/* Cards módulos extras */}
      <div>
        <h2 className="mb-3 font-bold">Mais módulos</h2>
        <div className="grid grid-cols-2 gap-3">
          <ModuleCard to="/cardapio" icon={<UtensilsCrossed />} label="Cardápio" />
          <ModuleCard to="/cozinha" icon={<ChefHat />} label="Cozinha" />
          <ModuleCard to="/pedidos" icon={<ClipboardList />} label="Pedidos" />
          <ModuleCard to="/fornecedores" icon={<Truck />} label="Fornecedores" />
          <ModuleCard to="/alertas" icon={<Bell />} label="Alertas" badge={lowStock?.length} />
        </div>
      </div>

      {/* Alertas */}
      {lowStock && lowStock.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h3 className="flex items-center gap-2 font-bold text-warning"><Bell className="h-4 w-4" /> Estoque baixo</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {lowStock.slice(0, 3).map(p => (
              <li key={p.id} className="flex justify-between">
                <span>📦 {p.name}</span>
                <span className="text-muted-foreground">{p.quantity} restantes</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Últimas transações */}
      <div className="glass rounded-2xl p-4">
        <h3 className="font-bold">Últimas transações</h3>
        {today?.last.length ? (
          <ul className="mt-3 divide-y divide-border/40">
            {today.last.map((t, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{t.description || (t.type === "income" ? "Venda" : "Despesa")}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <span className={`font-black ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                  {t.type === "income" ? "+" : "−"} {brl(Number(t.amount))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma transação hoje. Bora começar! 🌊</p>
        )}
      </div>
    </div>
  );
}

function QuickAction({ to, icon, label, tint }: { to: string; icon: React.ReactNode; label: string; tint: string }) {
  return (
    <Link to={to} className={`glass rounded-2xl p-4 flex flex-col items-start gap-3 transition-transform active:scale-95`}>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tint} text-white`}>{icon}</span>
      <span className="font-bold text-sm">{label}</span>
    </Link>
  );
}

function ModuleCard({ to, icon, label, badge }: { to: string; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <Link to={to} className="glass rounded-2xl p-4 flex items-center gap-3 transition-transform active:scale-95 relative">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-foreground">{icon}</span>
      <span className="font-semibold text-sm">{label}</span>
      {!!badge && badge > 0 && (
        <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs font-black text-destructive-foreground">{badge}</span>
      )}
    </Link>
  );
}

type Tx = { type: string; amount: number | string; payment_method?: string | null; category?: string | null };

function CashCloseDialog({ txs }: { txs: Tx[] }) {
  const [open, setOpen] = useState(false);
  const income = txs.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const profit = income - expense;
  const salesCount = txs.filter(t => t.type === "income").length;
  const ticket = salesCount ? income / salesCount : 0;

  const methods = ["dinheiro", "pix", "credito", "debito", "cartao", "outro"];
  const byMethod = methods.map(m => {
    const inc = txs.filter(t => t.type === "income" && (t.payment_method ?? "").toLowerCase() === m).reduce((s, t) => s + Number(t.amount), 0);
    const exp = txs.filter(t => t.type === "expense" && (t.payment_method ?? "").toLowerCase() === m).reduce((s, t) => s + Number(t.amount), 0);
    return { m, inc, exp };
  }).filter(r => r.inc !== 0 || r.exp !== 0);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="mt-3 w-full uppercase tracking-wider text-xs"
      >
        <Calculator className="h-4 w-4 mr-2" />Fechar caixa do dia
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md print:shadow-none">
          <DialogHeader>
            <DialogTitle className="font-display">Fechamento do caixa</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 border border-border p-3">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Entradas</p>
                <p className="font-display text-lg text-success">{brl(income)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Saídas</p>
                <p className="font-display text-lg text-destructive">{brl(expense)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Lucro</p>
                <p className={`font-display text-lg ${profit >= 0 ? "text-success" : "text-destructive"}`}>{brl(profit)}</p>
              </div>
            </div>

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Vendas: <span className="font-bold text-foreground">{salesCount}</span></span>
              <span>Ticket médio: <span className="font-bold text-foreground">{brl(ticket)}</span></span>
            </div>

            {byMethod.length > 0 && (
              <div className="border border-border">
                <div className="grid grid-cols-3 gap-px bg-border text-[10px] uppercase tracking-wider">
                  <div className="bg-muted px-2 py-1.5">Forma</div>
                  <div className="bg-muted px-2 py-1.5 text-right">Entradas</div>
                  <div className="bg-muted px-2 py-1.5 text-right">Saídas</div>
                </div>
                {byMethod.map(r => (
                  <div key={r.m} className="grid grid-cols-3 gap-px bg-border text-xs">
                    <div className="bg-background px-2 py-1.5 capitalize">{r.m}</div>
                    <div className="bg-background px-2 py-1.5 text-right text-success">{brl(r.inc)}</div>
                    <div className="bg-background px-2 py-1.5 text-right text-destructive">{brl(r.exp)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => window.print()} className="uppercase tracking-wider text-xs">Imprimir</Button>
            <Button onClick={() => setOpen(false)} className="uppercase tracking-wider text-xs" type="button">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}