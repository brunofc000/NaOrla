import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle2, ChefHat, Package } from "lucide-react";

type OrderStatus = {
  order_id: string;
  status: string;
  created_at: string;
  items: { name: string; quantity: number; status: string }[];
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  novo: { label: "Pedido recebido", icon: Package, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  preparando: { label: "Preparando", icon: ChefHat, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  pronto: { label: "Pronto para retirar!", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
};

export function CustomerOrderTracker({ userId, table, customerName }: {
  userId: string; table: string; customerName: string;
}) {
  const { data: orders = [] } = useQuery({
    queryKey: ["customer_orders", userId, table, customerName],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_order_status" as any, {
        _kiosk_user_id: userId,
        _table_number: table,
        _customer_name: customerName,
      });
      if (error) throw error;
      return (data ?? []) as OrderStatus[];
    },
    refetchInterval: 15000,
  });

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-display text-lg">Nenhum pedido ativo</p>
        <p className="text-sm">Faça seu pedido pelo cardápio</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const config = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.novo;
        const Icon = config.icon;
        const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
        return (
          <div key={order.order_id} className={`border rounded-xl p-4 ${config.bg}`}>
            <div className="flex items-center gap-3 mb-3">
              <Icon className={`h-6 w-6 ${config.color}`} />
              <div className="flex-1">
                <p className={`font-display text-lg font-bold ${config.color}`}>{config.label}</p>
                <p className="text-xs text-muted-foreground">
                  {elapsed < 1 ? "Agora" : elapsed === 1 ? "1 minuto atrás" : `${elapsed} minutos atrás`}
                </p>
              </div>
              {order.status === "preparando" && (
                <div className="text-right">
                  <Clock className="h-4 w-4 inline text-amber-500 mr-1" />
                  <span className="text-sm font-semibold text-amber-700">~15 min</span>
                </div>
              )}
              {order.status === "pronto" && (
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-200 px-2 py-1 rounded">
                  Retirar!
                </span>
              )}
            </div>
            <div className="space-y-1">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span>{item.quantity}× {item.name}</span>
                  <span className={`text-xs font-semibold ${config.color}`}>
                    {order.status === "pronto" ? "✓ Pronto" : order.status === "preparando" ? "Preparando..." : "Na fila"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}