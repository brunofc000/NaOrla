import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { brl } from "@/lib/format";

type Emp = { id: string; name: string; role: string; phone: string | null; daily_rate: number; is_active: boolean };

export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários — NaOrlaApp" }] }),
  component: Funcs,
});

function Funcs() {
  const qc = useQueryClient();
  const { data: emps = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Emp[];
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("employees").update({ is_active: false }).eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); toast.success("Removido"); },
  });
  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Equipe</p>
          <h1 className="font-display text-3xl">{emps.length} funcionários</h1>
        </div>
        <EmpDialog />
      </header>
      {emps.length === 0 ? <p className="text-sm text-muted-foreground">Cadastre seu primeiro funcionário.</p> : (
        <ul className="divide-y divide-border border border-border">
          {emps.map(e => (
            <li key={e.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <p className="font-semibold">{e.name}</p>
                <p className="text-xs text-muted-foreground">{e.role} · {brl(e.daily_rate)}/dia{e.phone ? ` · ${e.phone}` : ""}</p>
              </div>
              <div className="flex items-center gap-1">
                <EmpDialog emp={e} />
                <Button size="icon" variant="ghost" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmpDialog({ emp }: { emp?: Emp }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(emp?.name ?? "");
  const [role, setRole] = useState(emp?.role ?? "garçom");
  const [phone, setPhone] = useState(emp?.phone ?? "");
  const [daily_rate, setRate] = useState(String(emp?.daily_rate ?? 0));
  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const payload = { name, role, phone: phone || null, daily_rate: Number(daily_rate.replace(",", ".")) };
      if (emp) { const { error } = await supabase.from("employees").update(payload).eq("id", emp.id); if (error) throw error; }
      else { const { error } = await supabase.from("employees").insert({ ...payload, user_id: u.user.id }); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); toast.success("Salvo"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {emp ? <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
          : <Button size="sm" className="uppercase tracking-wider text-xs"><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">{emp ? "Editar" : "Novo funcionário"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Função</Label><Input value={role} onChange={e => setRole(e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={phone ?? ""} onChange={e => setPhone(e.target.value)} /></div>
          <div><Label>Diária (R$)</Label><Input inputMode="decimal" value={daily_rate} onChange={e => setRate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button disabled={!name || save.isPending} onClick={() => save.mutate()} className="w-full uppercase tracking-wider text-xs">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}