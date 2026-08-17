import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { getEmployeeSession } from "@/lib/employee-session";
import { WaiterNotifier } from "@/components/WaiterNotifier";

const WAITER_ALLOWED = ["/pedido", "/pedidos", "/cardapio"];
const KITCHEN_ALLOWED = ["/cozinha", "/cardapio"];

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const emp = getEmployeeSession();
    if (emp) {
      const path = location.pathname;
      const list = emp.role === "cozinha" ? KITCHEN_ALLOWED : WAITER_ALLOWED;
      const home = emp.role === "cozinha" ? "/cozinha" : "/pedido";
      const allowed = list.some(p => path === p || path.startsWith(p + "/"));
      if (!allowed) throw redirect({ to: home });
      return { user: null, employee: emp };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user, employee: null };
  },
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  return (
    <div className="min-h-dvh pb-24">
      <div className="mx-auto max-w-2xl px-4 py-5">
        <Outlet />
      </div>
      <BottomNav />
      <WaiterNotifier />
    </div>
  );
}