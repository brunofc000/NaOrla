import { createFileRoute } from "@tanstack/react-router";
import VendaPage from "@/components/venda/VendaPage";

export const Route = createFileRoute("/_authenticated/venda")({
  head: () => ({ meta: [{ title: "Registrar Venda — NaOrlaApp" }] }),
  component: VendaPage,
});

