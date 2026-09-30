export const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

/** Minutos inteiros decorridos desde um ISO date até `now`. */
export const minutesSince = (iso: string, now: number = Date.now()) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

/** "há 5 min" / "há 1h20" — tempo desde o pedido. */
export const waitingLabel = (iso: string, now: number = Date.now()) => {
  const min = minutesSince(iso, now);
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
};

/** Cor de alerta: âmbar comum até 10 min; vermelho (urgente) a partir de 10 min. */
export const waitingChipClass = (min: number) =>
  min >= 10
    ? "bg-destructive/15 text-destructive border border-destructive/40"
    : "bg-amber-500/15 text-amber-900 border border-amber-500/40";

export const greet = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};