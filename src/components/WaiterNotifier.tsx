import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmployeeSession } from "@/lib/employee-session";

type ReadyOrder = { id: string; table_number: string };

export function WaiterNotifier() {
  const employee = useEmployeeSession();
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    if (!employee || employee.role !== "garcom") return;
    let cancelled = false;

    async function tick() {
      if (!employee) return;
      const { data, error } = await (supabase as any).rpc("employee_get_kitchen_orders_v2", { _token: employee.token });
      if (cancelled || error || !Array.isArray(data)) return;
      const ready = (data as Array<{ id: string; status: string; table_number: string }>)
        .filter(o => o.status === "pronto")
        .map(o => ({ id: o.id, table_number: o.table_number } as ReadyOrder));
      if (!primed.current) {
        ready.forEach(o => seen.current.add(o.id));
        primed.current = true;
        return;
      }
      ready.forEach(o => {
        if (!seen.current.has(o.id)) {
          seen.current.add(o.id);
          toast.success(`Mesa ${o.table_number} — pedido pronto para entregar!`, { duration: 8000 });
        }
      });
    }

    tick();
    const i = setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, 20000);
    return () => { cancelled = true; clearInterval(i); };
  }, [employee]);

  return null;
}