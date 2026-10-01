import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Users, UserPlus, Pencil, Check, Clock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Customer = { id: string; name: string; phone: string | null; cpf: string | null; notes: string | null; created_at: string };

type FiadoTx = {
  id: string;
  amount: number;
  description: string;
  payment_method: string;
  created_at: string;
  fiado_paid_at: string | null;
  is_fiado: boolean;
  customer_id: string | null;
};

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes Fiéis — NaOrlaApp" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Customer | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", cpf: "", notes: "" });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  // Todas as vendas fiadas (pagas e em aberto)
  const { data: fiadoTxs = [] } = useQuery({
    queryKey: ["customer_fiados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, description, payment_method, created_at, fiado_paid_at, is_fiado, customer_id")
        .eq("is_fiado", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FiadoTx[];
    },
    refetchInterval: 30000,
  });

  const openByCustomer = (customerId: string) =>
    fiadoTxs.filter(t => t.customer_id === customerId && !t.fiado_paid_at);

  const totalOpen = fiadoTxs.filter(t => !t.fiado_paid_at).reduce((s, t) => s + Number(t.amount), 0);

  const saveCustomer = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        cpf: form.cpf.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sem sessão");
        const { error } = await supabase.from("customers").insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Cliente atualizado!" : "Cliente cadastrado!");
      setDialogOpen(false);
      setEditing(null);
      setForm({ name: "", phone: "", cpf: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (txId: string) => {
      const { error } = await supabase
        .from("transactions")
        .update({ fiado_paid_at: new Date().toISOString() })
        .eq("id", txId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como pago!");
      qc.invalidateQueries({ queryKey: ["customer_fiados"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate({ to: "/dashboard" })}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Clientes fiéis</p>
          <h1 className="font-display text-3xl flex items-center gap-2">
            <Users className="h-7 w-7" />
            Clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Vendas fiadas em aberto: <strong className={totalOpen > 0 ? "text-destructive" : "text-emerald-600"}>{brl(totalOpen)}</strong>
          </p>
        </div>
        <Button
          onClick={() => { setEditing(null); setForm({ name: "", phone: "", cpf: "", notes: "" }); setDialogOpen(true); }}
          className="uppercase tracking-wider text-xs"
        >
          <UserPlus className="h-4 w-4 mr-2" />Novo
        </Button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && customers.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
      )}

      <div className="space-y-3">
        {customers.map(c => {
          const open = openByCustomer(c.id);
          const openTotal = open.reduce((s, t) => s + Number(t.amount), 0);
          return (
            <article key={c.id} className="border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-lg truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.phone || "sem telefone"}
                    {c.cpf ? ` · CPF ${c.cpf}` : ""}
                  </p>
                  {c.notes && <p className="text-[11px] italic text-muted-foreground">{c.notes}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditing(c); setForm({ name: c.name, phone: c.phone ?? "", cpf: c.cpf ?? "", notes: c.notes ?? "" }); setDialogOpen(true); }}
                    className="rounded border border-border p-1.5"
                    aria-label="Editar cliente"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                {openTotal > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 border border-destructive/40 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                    <Clock className="h-3 w-3" />
                    Deve {brl(openTotal)} · {open.length} venda{open.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                    <Check className="h-3 w-3" />
                    Tudo em dia
                  </span>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="uppercase tracking-wider text-[11px]" onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                    {selected?.id === c.id ? "Fechar" : "Ver fiados"}
                  </Button>
                  <Button size="sm" variant="secondary" className="uppercase tracking-wider text-[11px]" onClick={() => navigate({ to: "/venda-avulsa" })}>
                    Vender
                  </Button>
                </div>
              </div>

              {selected?.id === c.id && (
                <ul className="divide-y divide-border border border-border rounded-lg">
                  {fiadoTxs.filter(t => t.customer_id === c.id).map(t => (
                    <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className={`text-sm ${t.fiado_paid_at ? "text-muted-foreground" : "font-semibold"}`}>
                          {brl(Number(t.amount))} · {new Date(t.created_at).toLocaleDateString("pt-BR")}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{t.description}</p>
                      </div>
                      {t.fiado_paid_at ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 shrink-0">
                          <Check className="h-3 w-3" />Pago
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          className="uppercase tracking-wider text-[11px] shrink-0"
                          onClick={() => markPaid.mutate(t.id)}
                          disabled={markPaid.isPending}
                        >
                          Marcar como pago
                        </Button>
                      )}
                    </li>
                  ))}
                  {fiadoTxs.filter(t => t.customer_id === c.id).length === 0 && (
                    <li className="px-3 py-2 text-xs text-muted-foreground">Nenhuma venda fiada ainda.</li>
                  )}
                </ul>
              )}
            </article>
          );
        })}
      </div>

      {/* Cadastro / edição de cliente */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar cliente" : "Novo cliente fiel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="mt-1" placeholder="Ex: mora perto do quiosque…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveCustomer.mutate()} disabled={saveCustomer.isPending || !form.name.trim()}>
              {saveCustomer.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

