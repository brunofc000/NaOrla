import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NaOrlaApp — Gestão completa para o seu quiosque de praia" },
      { name: "description", content: "Controle caixa, estoque, funcionários e cardápio do seu quiosque, barraca ou ponto de praia. Simples, rápido e feito pra quem tem mão molhada." },
      { property: "og:title", content: "NaOrlaApp — Gestão para quiosques de praia" },
      { property: "og:description", content: "Caixa, estoque, funcionários e cardápio no seu bolso." },
    ],
  }),
  component: Landing,
});

const modules = [
  { title: "Vendas rápidas", desc: "Feche pedidos em segundos, mesmo no pico do movimento." },
  { title: "Estoque inteligente", desc: "Saiba exatamente quando o gelo ou a cerveja vai acabar." },
  { title: "Gestão de equipe", desc: "Controle turnos e comissões de garçons sem planilhas." },
  { title: "Relatórios diários", desc: "Resumo do dia direto no celular ao fechar o caixa." },
  { title: "Cardápio digital", desc: "Atualize preços e itens em tempo real pelo celular." },
  { title: "Fornecedores", desc: "Histórico de compras e contatos essenciais organizados." },
  { title: "Fluxo de caixa", desc: "Entradas e saídas com clareza pra não perder um centavo." },
  { title: "Suporte praia", desc: "Gente que entende sua rotina pronta pra ajudar." },
];

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
};

function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground px-5 py-10 lg:px-12 selection:bg-muted selection:text-primary">
      <div className="mx-auto max-w-6xl space-y-24">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground font-display italic text-lg">
              N
            </span>
            <span className="font-display text-xl font-bold tracking-tight normal-case">
              NaOrla<span className="text-primary">APP</span>
            </span>
          </Link>
          <Link to="/auth" className="text-sm font-semibold border-b border-foreground pb-0.5 hover:text-primary hover:border-primary transition-colors">
            Entrar
          </Link>
        </header>

        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="text-center space-y-6 pt-8"
        >
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Feito para quem vive da praia</p>
          <h1 className="font-display text-4xl md:text-6xl font-medium max-w-3xl mx-auto leading-[1.1]">
            Venda mais, perca menos e durma tranquilo
          </h1>
          <p className="text-primary text-lg md:text-xl font-light italic">
            Do primeiro pedido ao fechamento do caixa, tudo na palma da sua mão.
          </p>
          <div className="pt-4">
            <Link
              to="/auth"
              className="inline-block px-8 py-4 bg-foreground text-background text-xs font-bold uppercase tracking-[0.2em] hover:bg-primary transition-colors"
            >
              Começar grátis
            </Link>
          </div>
        </motion.section>

        {/* Features */}
        <motion.section
          {...fade}
          className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border border border-border"
        >
          {modules.map((m, i) => (
            <motion.article
              key={m.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.04 }}
              className="bg-background p-8 space-y-3 hover:bg-muted/40 transition-colors"
            >
              <span className="block font-display italic text-sm text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-xl">{m.title}</h3>
              <p className="text-sm text-foreground/70 leading-relaxed">{m.desc}</p>
            </motion.article>
          ))}
        </motion.section>

        {/* Pricing */}
        <motion.section {...fade} id="planos" className="space-y-12">
          <div className="text-center space-y-2">
            <h2 className="font-display text-3xl md:text-4xl">Plano simples, lucro direto</h2>
            <p className="text-xs text-primary uppercase tracking-[0.3em]">Escolha sua jornada</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Grátis */}
            <div className="border border-border p-10 flex flex-col">
              <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Grátis</span>
                <div className="mt-2 flex items-baseline">
                  <span className="font-display text-4xl">R$ 0</span>
                </div>
              </div>
              <ul className="space-y-4 mb-12 flex-grow text-sm">
                {["Caixa do dia", "Cardápio até 20 itens", "Estoque básico", "1 funcionário"].map((t) => (
                  <li key={t} className="flex items-center gap-3"><span className="text-primary">—</span> {t}</li>
                ))}
              </ul>
              <Link
                to="/auth"
                className="w-full py-4 border border-foreground text-center text-xs font-bold uppercase tracking-[0.25em] hover:bg-muted transition-colors"
              >
                Começar grátis
              </Link>
            </div>

            {/* Premium */}
            <div className="bg-muted p-10 flex flex-col relative">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 uppercase tracking-wide">
                Mais escolhido
              </div>
              <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Premium</span>
                <div className="mt-2 flex items-baseline">
                  <span className="font-display text-4xl">R$ 19,90</span>
                  <span className="text-xs ml-1">/mês</span>
                </div>
              </div>
              <ul className="space-y-4 mb-12 flex-grow text-sm">
                {[
                  "Tudo do Grátis",
                  "Relatórios completos + PDF",
                  "Funcionários ilimitados + ponto",
                  "Fornecedores e compras",
                  "Cardápio ilimitado com fotos",
                  "Backup automático",
                  "Sem anúncios",
                ].map((t, idx) => (
                  <li key={t} className={`flex items-center gap-3 ${idx === 0 ? "font-bold" : ""}`}>
                    <span className="text-primary">+</span> {t}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className="w-full py-4 bg-primary text-primary-foreground text-center text-xs font-bold uppercase tracking-[0.25em] hover:bg-foreground transition-colors"
              >
                Assinar agora
              </Link>
            </div>
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section {...fade} className="bg-foreground text-background p-12 md:p-20 text-center space-y-8">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="font-display text-3xl md:text-4xl">Pronto pra abrir o quiosque sem caos?</h2>
            <p className="text-background/70 text-sm">Crie sua conta em 30 segundos. Sem cartão de crédito.</p>
          </div>
          <Link
            to="/auth"
            className="inline-block px-10 py-5 bg-background text-foreground font-bold uppercase tracking-[0.25em] text-xs hover:bg-muted transition-colors"
          >
            Entrar no NaOrlaApp
          </Link>
        </motion.section>

        {/* Footer */}
        <footer className="pt-12 border-t border-border text-[10px] text-primary flex justify-between uppercase tracking-[0.25em]">
          <span>© {new Date().getFullYear()} NAORLAAPP</span>
          <span>Feito por quem vive da praia</span>
        </footer>
      </div>
    </div>
  );
}
