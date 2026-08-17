import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Pencil, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

type Sup = { id: string; name: string; phone: string | null; whatsapp: string | null; product_description: string | null; notes: string | null };

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — NaOrlaApp" }] }),
  component: Fornec,
});

function Fornec() {
  const qc = useQueryClient();
  const { data: sups = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data as Sup[];
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("suppliers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Removido"); },
  });
  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Fornecedores</p>
          <h1 className="font-display text-3xl">{sups.length} contatos</h1>
        </div>
        <SupDialog />
      </header>
      {sups.length === 0 ? <p className="text-sm text-muted-foreground">Cadastre seu primeiro fornecedor.</p> : (
        <ul className="divide-y divide-border border border-border">
          {sups.map(s => (
            <li key={s.id} className="flex items-center justify-between p-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground truncate">{s.product_description || "—"}</p>
              </div>
              <div className="flex items-center gap-1">
                {s.whatsapp && (
                  <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                    <Button size="icon" variant="ghost"><MessageCircle className="h-4 w-4" /></Button>
                  </a>
                )}
                <SupDialog sup={s} />
                <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SupDialog({ sup }: { sup?: Sup }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(sup?.name ?? "");
  const [phone, setPhone] = useState(sup?.phone ?? "");
  const [whatsapp, setWa] = useState(sup?.whatsapp ?? "");
  const [product_description, setDesc] = useState(sup?.product_description ?? "");
  const [notes, setNotes] = useState(sup?.notes ?? "");
  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const payload = { name, phone: phone || null, whatsapp: whatsapp || null, product_description: product_description || null, notes: notes || null };
      if (sup) { const { error } = await supabase.from("suppliers").update(payload).eq("id", sup.id); if (error) throw error; }
      else { const { error } = await supabase.from("suppliers").insert({ ...payload, user_id: u.user.id }); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Salvo"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {sup ? <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
          : <Button size="sm" className="uppercase tracking-wider text-xs"><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">{sup ? "Editar" : "Novo fornecedor"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={phone ?? ""} onChange={e => setPhone(e.target.value)} /></div>
          <div><Label>WhatsApp (com DDD)</Label><Input value={whatsapp ?? ""} onChange={e => setWa(e.target.value)} placeholder="5521..." /></div>
          <div><Label>O que fornece</Label><Input value={product_description ?? ""} onChange={e => setDesc(e.target.value)} /></div>
          <div><Label>Observações</Label><Input value={notes ?? ""} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button disabled={!name || save.isPending} onClick={() => save.mutate()} className="w-full uppercase tracking-wider text-xs">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}