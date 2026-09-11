import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users, DollarSign, TrendingUp, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — NaOrlaApp" }] }),
  component: AdminPanel,
});

function AdminPanel() {
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["admin_clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin_stats"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: orders } = await supabase.from("orders").select("total").eq("status", "entregue").gte("created_at", today.toISOString());
      return { totalClients: count ?? 0, todayOrders: orders?.length ?? 0, todayRevenue: orders?.reduce((s, o) => s + Number(o.total), 0) ?? 0 };
    },
  });

  const handleLogout = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card px-5 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-destructive text-destructive-foreground font-display italic text-lg">A</span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-destructive">Painel Admin</p>
              <h1 className="font-display text-xl">NaOrla</h1>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Sair</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4" />Clientes</div>
            <p className="font-display text-2xl mt-1">{stats?.totalClients ?? 0}</p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-4 w-4" />Pedidos hoje</div>
            <p className="font-display text-2xl mt-1">{stats?.todayOrders ?? 0}</p>
          </div>
          <div className="border border-border rounded-lg p-4 bg-primary/5">
            <div className="flex items-center gap-2 text-xs text-primary"><DollarSign className="h-4 w-4" />Faturamento hoje</div>
            <p className="font-display text-2xl mt-1">{brl(stats?.todayRevenue ?? 0)}</p>
          </div>
        </div>

        <section>
          <h2 className="font-display text-xl mb-3 flex items-center gap-2"><Users className="h-5 w-5" />Clientes ({clients.length})</h2>
          {clients.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum cliente.</p> : (
            <div className="border border-border rounded-lg overflow-hidden">
              {clients.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedClient(c)}>
                  <div>
                    <p className="font-semibold text-sm">{c.display_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{c.kiosk_name || "—"} · {c.kiosk_code || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : ""}
                    </span>
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {selectedClient && (
        <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Detalhes do cliente</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">Nome</p><p className="font-semibold">{selectedClient.display_name || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Quiosque</p><p className="font-semibold">{selectedClient.kiosk_name || "—"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">Código</p><p className="font-mono font-semibold">{selectedClient.kiosk_code || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Telefone</p><p className="font-semibold">{selectedClient.phone || "—"}</p></div>
              </div>
              <div><p className="text-xs text-muted-foreground">ID</p><p className="font-mono text-xs break-all">{selectedClient.id}</p></div>
              <div><p className="text-xs text-muted-foreground">Cadastrado em</p><p className="font-semibold">{selectedClient.created_at ? new Date(selectedClient.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</p></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setSelectedClient(null)} className="uppercase tracking-wider text-xs">Fechar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}