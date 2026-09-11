import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users, DollarSign, TrendingUp, Settings, LogOut, Trash2, UserX, UserCheck, Crown, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — NaOrlaApp" }] }),
  component: AdminPanel,
});

function AdminPanel() {
  const qc = useQueryClient();
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

  // Mutation para atualizar plano
  const updatePlan = useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
      const { error } = await supabase.from("profiles").update({ plan }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_clients"] }); toast.success("Plano atualizado!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutation para ativar/desativar
  const toggleActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_clients"] }); toast.success("Status atualizado!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutation para deletar
  const deleteClient = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_clients"] }); setSelectedClient(null); toast.success("Cliente removido!"); },
    onError: (e: Error) => toast.error(e.message),
  });

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
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{c.display_name || "—"}</p>
                        {!c.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-semibold">INATIVO</span>}
                        {c.plan === "pro" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                        {c.plan === "business" && <Shield className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{c.kiosk_name || "—"} · {c.kiosk_code || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      c.plan === "pro" ? "bg-amber-100 text-amber-700" :
                      c.plan === "business" ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {c.plan === "pro" ? "PRO" : c.plan === "business" ? "BUSINESS" : "FREE"}
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
            <DialogHeader><DialogTitle className="font-display">Gerenciar cliente</DialogTitle></DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">Nome</p><p className="font-semibold">{selectedClient.display_name || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Quiosque</p><p className="font-semibold">{selectedClient.kiosk_name || "—"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">Código</p><p className="font-mono font-semibold">{selectedClient.kiosk_code || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Telefone</p><p className="font-semibold">{selectedClient.phone || "—"}</p></div>
              </div>
              <div><p className="text-xs text-muted-foreground">Cadastrado em</p><p className="font-semibold">{selectedClient.created_at ? new Date(selectedClient.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</p></div>

              {/* Status */}
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">Status</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={selectedClient.is_active ? "default" : "outline"}
                    onClick={() => toggleActive.mutate({ userId: selectedClient.id, isActive: true })}
                    disabled={toggleActive.isPending}
                  >
                    <UserCheck className="h-3.5 w-3.5 mr-1" /> Ativo
                  </Button>
                  <Button
                    size="sm"
                    variant={!selectedClient.is_active ? "destructive" : "outline"}
                    onClick={() => toggleActive.mutate({ userId: selectedClient.id, isActive: false })}
                    disabled={toggleActive.isPending}
                  >
                    <UserX className="h-3.5 w-3.5 mr-1" /> Inativo
                  </Button>
                </div>
              </div>

              {/* Plano */}
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">Plano</p>
                <div className="flex gap-2">
                  {["free", "pro", "business"].map(plan => (
                    <Button
                      key={plan}
                      size="sm"
                      variant={selectedClient.plan === plan ? "default" : "outline"}
                      onClick={() => updatePlan.mutate({ userId: selectedClient.id, plan })}
                      disabled={updatePlan.isPending}
                      className="uppercase tracking-wider text-[10px]"
                    >
                      {plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Business"}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Deletar */}
              <div className="border-t border-border pt-3">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(`Tem certeza que deseja excluir ${selectedClient.display_name}? Essa ação é irreversível.`)) {
                      deleteClient.mutate(selectedClient.id);
                    }
                  }}
                  disabled={deleteClient.isPending}
                  className="w-full uppercase tracking-wider text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir permanentemente
                </Button>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setSelectedClient(null)} className="uppercase tracking-wider text-xs">Fechar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}