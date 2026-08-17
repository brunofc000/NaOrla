import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { setEmployeeSession, getEmployeeSession } from "@/lib/employee-session";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — NaOrlaApp" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  // Signup
  const [name, setName] = useState("");
  const [kiosk, setKiosk] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [phone, setPhone] = useState("");

  // Funcionário
  const [funcCode, setFuncCode] = useState("");
  const [funcPass, setFuncPass] = useState("");
  const [funcRole, setFuncRole] = useState<"garcom" | "cozinha">("garcom");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    if (getEmployeeSession()) navigate({ to: "/cozinha", replace: true });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta! 🌊");
    navigate({ to: "/dashboard" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPass,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: { display_name: name, kiosk_name: kiosk, phone },
      },
    });
    setLoading(false);
    if (error) {
      const map: Record<string, string> = {
        weak_password: "Senha muito fraca. Use letras, números e símbolos.",
        user_already_exists: "Este e-mail já está cadastrado.",
        email_address_invalid: "E-mail inválido.",
      };
      return toast.error(map[(error as any).code] ?? error.message);
    }
    toast.success("Conta criada! ✅");
    navigate({ to: "/dashboard" });
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (result.error) {
      setLoading(false);
      return toast.error("Erro ao entrar com Google");
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  async function handleEmployee(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("employee_login", {
      _kiosk_code: funcCode.trim(),
      _password: funcPass,
      _role: funcRole,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setEmployeeSession({
      token: data.token,
      kiosk_user_id: data.kiosk_user_id,
      kiosk_name: data.kiosk_name,
      kiosk_code: data.kiosk_code,
      role: data.role,
    });
    toast.success(`Bem-vindo ao ${data.kiosk_name}`);
    navigate({ to: data.role === "cozinha" ? "/cozinha" : "/pedido" });
  }

  return (
    <div className="min-h-dvh grid place-items-center p-5 bg-background text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md border border-border bg-card p-8 sm:p-10"
      >
        <Link to="/" className="flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground font-display italic text-lg">
            N
          </span>
          <span className="font-display text-xl font-bold tracking-tight normal-case">
            NaOrla<span className="text-primary">APP</span>
          </span>
        </Link>
        <p className="mt-3 text-center text-xs uppercase tracking-[0.25em] text-primary">Acesse seu quiosque</p>

        <Tabs defaultValue="login" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login">Dono</TabsTrigger>
            <TabsTrigger value="signup">Cadastro</TabsTrigger>
            <TabsTrigger value="func">Funcionário</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4 pt-4">
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <Label htmlFor="le">E-mail</Label>
                <Input id="le" type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="lp">Senha</Label>
                <Input id="lp" type="password" required value={loginPass} onChange={e => setLoginPass(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-foreground text-background hover:bg-primary font-bold uppercase tracking-[0.2em] text-xs rounded-none h-11">
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 pt-4">
            <form onSubmit={handleSignup} className="space-y-3">
              <div>
                <Label htmlFor="n">Seu nome</Label>
                <Input id="n" required value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="k">Nome do seu quiosque</Label>
                <Input id="k" required placeholder="Ex: Quiosque do Tião" value={kiosk} onChange={e => setKiosk(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="se">E-mail</Label>
                  <Input id="se" type="email" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="ph">Telefone</Label>
                  <Input id="ph" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="sp">Senha</Label>
                <Input id="sp" type="password" required minLength={6} value={signupPass} onChange={e => setSignupPass(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-foreground text-background hover:bg-primary font-bold uppercase tracking-[0.2em] text-xs rounded-none h-11">
                {loading ? "Criando..." : "Criar conta"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="func" className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">Peça ao dono do quiosque o código e a senha do seu cargo.</p>
            <form onSubmit={handleEmployee} className="space-y-3">
              <div>
                <Label>Cargo</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button type="button" onClick={() => setFuncRole("garcom")} className={`border p-2 text-xs uppercase tracking-wider ${funcRole === "garcom" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>Garçom</button>
                  <button type="button" onClick={() => setFuncRole("cozinha")} className={`border p-2 text-xs uppercase tracking-wider ${funcRole === "cozinha" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>Cozinha</button>
                </div>
              </div>
              <div>
                <Label htmlFor="fc">Código do quiosque</Label>
                <Input id="fc" required placeholder="NA-XXXXXX" value={funcCode} onChange={e => setFuncCode(e.target.value.toUpperCase())} />
              </div>
              <div>
                <Label htmlFor="fp">Senha do cargo</Label>
                <Input id="fp" type="password" required value={funcPass} onChange={e => setFuncPass(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-foreground text-background hover:bg-primary font-bold uppercase tracking-[0.2em] text-xs rounded-none h-11">
                {loading ? "Entrando..." : "Entrar como funcionário"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full font-semibold rounded-none h-11 border-foreground" onClick={handleGoogle} disabled={loading}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continuar com Google
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline">Voltar ao início</Link>
        </p>
      </motion.div>
    </div>
  );
}