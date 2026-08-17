import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Bell } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

type Rem = { id: string; title: string; reminder_date: string; recurrence: string; is_active: boolean };

export const Route = createFileRoute("/_authenticated/alertas")({
  head: () => ({ meta: [{ title: "Alertas — NaOrlaApp" }] }),
  component: Alertas,
});

function Alertas() {
  const qc = useQueryClient();
  const { data: rems = [] } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reminders").select("*").eq("is_active", true).order("reminder_date");
      if (error) throw error;
      return data as Rem[];
    },
  });
  const { data: low = [] } = useQuery({
    queryKey: ["lowstock"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, quantity, min_quantity, unit").eq("is_active", true);
      if (error) throw error;
      return (data ?? []).filter(p => p.quantity <= p.min_quantity);
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("reminders").update({ is_active: false }).eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reminders"] }); toast.success("Concluído"); },
  });
  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Avisos</p>
          <h1 className="font-display text-3xl">Alertas</h1>
        </div>
        <RemDialog />
      </header>

      {low.length > 0 && (
        <section>
          <h2 className="font-display text-lg mb-2 text-destructive flex items-center gap-2"><Bell className="h-4 w-4" />Estoque baixo</h2>
          <ul className="divide-y divide-border border border-destructive/40">
            {low.map(p => (
              <li key={p.id} className="flex justify-between p-3 text-sm">
                <span>📦 {p.name}</span>
                <span className="text-muted-foreground">{p.quantity} {p.unit}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg mb-2">Lembretes</h2>
        {rems.length === 0 ? <p className="text-sm text-muted-foreground">Nada agendado.</p> : (
          <ul className="divide-y divide-border border border-border">
            {rems.map(r => (
              <li key={r.id} className="flex justify-between items-center p-3 text-sm">
                <div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.reminder_date).toLocaleDateString("pt-BR")} · {r.recurrence}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RemDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [reminder_date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [recurrence, setRec] = useState("none");
  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await supabase.from("reminders").insert({ user_id: u.user.id, title, reminder_date, recurrence });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reminders"] }); toast.success("Salvo"); setOpen(false); setTitle(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="uppercase tracking-wider text-xs"><Plus className="h-4 w-4 mr-1" />Novo</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">Novo lembrete</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Pagar fornecedor" /></div>
          <div><Label>Data</Label><Input type="date" value={reminder_date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label>Recorrência</Label><Input value={recurrence} onChange={e => setRec(e.target.value)} placeholder="none, daily, weekly, monthly" /></div>
        </div>
        <DialogFooter>
          <Button disabled={!title || save.isPending} onClick={() => save.mutate()} className="w-full uppercase tracking-wider text-xs">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}