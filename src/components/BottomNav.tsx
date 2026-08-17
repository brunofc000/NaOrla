import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, Package, BarChart3, User, ChefHat, BookOpen, LogOut, ClipboardList, ListChecks } from "lucide-react";
import { useEmployeeSession, clearEmployeeSession, getEmployeeSession } from "@/lib/employee-session";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

const ownerItems = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/caixa", label: "Caixa", icon: Wallet },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

const waiterItems = [
  { to: "/pedido", label: "Pedido", icon: ClipboardList },
  { to: "/pedidos", label: "Status", icon: ListChecks },
  { to: "/cardapio", label: "Cardápio", icon: BookOpen },
] as const;

const kitchenItems = [
  { to: "/cozinha", label: "Cozinha", icon: ChefHat },
  { to: "/cardapio", label: "Cardápio", icon: BookOpen },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const employee = useEmployeeSession();
  const navigate = useNavigate();
  const items = employee
    ? (employee.role === "cozinha" ? kitchenItems : waiterItems)
    : ownerItems;
  const cols = employee ? items.length + 1 : items.length;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/40 pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition-colors ${
                  active ? "text-secondary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        {employee && (
          <li>
            <button
              onClick={async () => {
                const s = getEmployeeSession();
                if (s?.token) {
                  try { await (supabase as any).rpc("employee_logout", { _token: s.token }); } catch { /* ignore */ }
                }
                clearEmployeeSession();
                navigate({ to: "/auth", replace: true });
              }}
              className="flex w-full flex-col items-center justify-center gap-1 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}