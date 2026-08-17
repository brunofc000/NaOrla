import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ModulePlaceholder({
  title, emoji, description, features,
}: { title: string; emoji: string; description: string; features: string[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div>
        <p className="text-4xl">{emoji}</p>
        <h1 className="mt-2 text-2xl font-black">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="glass rounded-2xl p-5">
        <p className="font-bold">🚧 Em construção</p>
        <p className="mt-1 text-sm text-muted-foreground">Este módulo já tem banco de dados e segurança prontos. A interface chega na próxima iteração.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {features.map(f => <li key={f} className="flex gap-2">✓ {f}</li>)}
        </ul>
      </div>
      <Link to="/dashboard"><Button variant="outline" className="w-full">Voltar ao início</Button></Link>
    </motion.div>
  );
}