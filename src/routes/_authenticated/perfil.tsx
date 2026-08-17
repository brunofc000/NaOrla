import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({ meta: [{ title: "Perfil — NaOrlaApp" }] }),
  component: Perfil,
});

function Perfil() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const [display_name, setName] = useState("");
  const [kiosk_name, setKiosk] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [employeePass, setEmployeePass] = useState("");
  const [kitchenPass, setKitchenPass] = useState("");

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? "");
    setKiosk(profile.kiosk_name ?? "");
    setPhone(profile.phone ?? "");
    setAddress(profile.address ?? "");
    // Password is stored hashed — never prefill the input.
    setEmployeePass("");
    setKitchenPass("");
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      const { error } = await supabase.from("profiles")
        .update({ display_name, kiosk_name, phone: phone || null, address: address || null })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Perfil salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function regenCode() {
    if (!profile) return;
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    const { error } = await supabase.from("profiles").update({ waiter_code: code }).eq("id", profile.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Novo código gerado");
  }

  const saveEmployeePass = useMutation({
    mutationFn: async (action: "save" | "remove") => {
      if (!profile) return;
      if (action === "save" && !employeePass) throw new Error("Digite uma nova senha");
      const { error } = await (supabase as any).from("profiles")
        .update({ employee_password: action === "remove" ? null : employeePass })
        .eq("id", profile.id);
      if (error) throw error;
      setEmployeePass("");
    },
    onSuccess: (_d, action) => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(action === "remove" ? "Senha removida" : "Senha atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveKitchenPass = useMutation({
    mutationFn: async (action: "save" | "remove") => {
      if (!profile) return;
      if (action === "save" && !kitchenPass) throw new Error("Digite uma nova senha");
      const { error } = await (supabase as any).from("profiles")
        .update({ kitchen_password: action === "remove" ? null : kitchenPass })
        .eq("id", profile.id);
      if (error) throw error;
      setKitchenPass("");
    },
    onSuccess: (_d, action) => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(action === "remove" ? "Senha da cozinha removida" : "Senha da cozinha atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Sua conta</p>
        <h1 className="font-display text-3xl">Perfil</h1>
      </header>
      <div className="space-y-3">
        <div><Label>Seu nome</Label><Input value={display_name} onChange={e => setName(e.target.value)} /></div>
        <div><Label>Nome do quiosque</Label><Input value={kiosk_name} onChange={e => setKiosk(e.target.value)} /></div>
        <div><Label>Telefone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
        <div><Label>Endereço</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full uppercase tracking-wider text-xs">Salvar</Button>

      <div className="border border-border p-4 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Acesso dos funcionários</p>
        <p className="text-xs text-muted-foreground">Há duas senhas separadas: uma para os <strong>garçons</strong> (lançam pedidos) e outra para a <strong>cozinha</strong> (vê e marca os pedidos). Compartilhe a senha correta com cada cargo.</p>
        <div>
          <Label>Código do quiosque</Label>
          <div className="flex items-center gap-2">
            <p className="font-display text-2xl tracking-widest flex-1">{(profile as any)?.kiosk_code ?? "—"}</p>
            <Button size="icon" variant="outline" onClick={() => { const c = (profile as any)?.kiosk_code; if (c) { navigator.clipboard.writeText(c); toast.success("Copiado"); } }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <Label>Senha dos garçons</Label>
          <Input type="password" value={employeePass} onChange={e => setEmployeePass(e.target.value)} placeholder={(profile as any)?.employee_password ? "digite para trocar a senha" : "definir senha"} />
          <p className="text-[11px] text-muted-foreground mt-1">
            {(profile as any)?.employee_password ? "Já existe uma senha de garçom. Digite uma nova para substituir, ou remova." : "Ainda não há senha de garçom. Defina uma para liberar."}
          </p>
          <div className="flex gap-2 mt-2">
            <Button onClick={() => saveEmployeePass.mutate("save")} disabled={saveEmployeePass.isPending || !employeePass} className="flex-1 uppercase tracking-wider text-xs">
              {(profile as any)?.employee_password ? "Trocar" : "Criar"}
            </Button>
            {(profile as any)?.employee_password && (
              <Button variant="outline" onClick={() => saveEmployeePass.mutate("remove")} disabled={saveEmployeePass.isPending} className="uppercase tracking-wider text-xs">
                Remover
              </Button>
            )}
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <Label>Senha da cozinha</Label>
          <Input type="password" value={kitchenPass} onChange={e => setKitchenPass(e.target.value)} placeholder={(profile as any)?.kitchen_password ? "digite para trocar a senha" : "definir senha"} />
          <p className="text-[11px] text-muted-foreground mt-1">
            {(profile as any)?.kitchen_password ? "Já existe uma senha da cozinha. Digite uma nova para substituir, ou remova." : "Ainda não há senha da cozinha. Defina uma para liberar."}
          </p>
          <div className="flex gap-2 mt-2">
            <Button onClick={() => saveKitchenPass.mutate("save")} disabled={saveKitchenPass.isPending || !kitchenPass} className="flex-1 uppercase tracking-wider text-xs">
              {(profile as any)?.kitchen_password ? "Trocar" : "Criar"}
            </Button>
            {(profile as any)?.kitchen_password && (
              <Button variant="outline" onClick={() => saveKitchenPass.mutate("remove")} disabled={saveKitchenPass.isPending} className="uppercase tracking-wider text-xs">
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="border border-border p-4 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Código do garçom</p>
        <p className="text-xs text-muted-foreground">Só os funcionários devem saber. É usado para liberar pedidos online dos clientes para a cozinha.</p>
        <div className="flex items-center gap-2">
          <p className="font-display text-3xl tracking-widest flex-1">{profile?.waiter_code ?? "------"}</p>
          <Button size="icon" variant="outline" onClick={() => { if (profile?.waiter_code) { navigator.clipboard.writeText(profile.waiter_code); toast.success("Copiado"); } }}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={regenCode}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="border-t border-border pt-5">
        <p className="text-xs text-muted-foreground mb-2">Plano: {profile?.is_pro ? "Premium" : "Grátis"}</p>
        <Button variant="outline" onClick={signOut} className="w-full uppercase tracking-wider text-xs"><LogOut className="h-4 w-4 mr-2" />Sair</Button>
      </div>
    </div>
  );
}