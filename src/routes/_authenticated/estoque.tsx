import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, AlertTriangle, Pencil, Trash2, History, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/format";

type Product = { id: string; name: string; quantity: number; min_quantity: number; cost_price: number; sell_price: number; unit: string; category: string };

const DEFAULT_STOCK_CATEGORIES = [
  "Bebidas",
  "Comidas",
  "Limpeza",
  "Embalagens",
  "Descartáveis",
  "Ingredientes",
  "Outros",
];

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({ meta: [{ title: "Estoque — NaOrlaApp" }] }),
  component: Estoque,
});

function Estoque() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: stockHistory = [] } = useQuery({
    queryKey: ["stock_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_history")
        .select("*, products(name, unit)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Produto removido"); },
  });

  const low = products.filter(p => p.quantity <= p.min_quantity);

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Estoque</p>
          <h1 className="font-display text-3xl">{products.length} produtos</h1>
        </div>
        <ProductDialog />
      </header>

      {low.length > 0 && (
        <div className="border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-bold text-destructive"><AlertTriangle className="h-4 w-4" />{low.length} produto(s) abaixo do mínimo</p>
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cadastre seu primeiro produto.</p>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {products.map(p => (
            <li key={p.id} className="flex items-center justify-between p-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.quantity} {p.unit} · {brl(p.sell_price)} · {p.category}</p>
              </div>
              <div className="flex items-center gap-1">
                {p.quantity <= p.min_quantity && <AlertTriangle className="h-4 w-4 text-destructive" />}
                <ProductDialog product={p} />
                <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Histórico de estoque */}
      <section>
        <h2 className="font-display text-xl mb-3 flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de estoque
        </h2>
        {stockHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
        ) : (
          <ul className="divide-y divide-border border border-border">
            {stockHistory.map((h: any) => (
              <li key={h.id} className="flex items-center justify-between p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{h.products?.name ?? 'Produto removido'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleDateString("pt-BR")} {new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {h.notes && ` · ${h.notes}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {h.quantity_change < 0 ? (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  )}
                  <span className={`font-bold ${h.quantity_change < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                    {h.quantity_change > 0 ? '+' : ''}{h.quantity_change} {h.products?.unit ?? 'un'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    (abastecido: <span className="font-medium">{h.previous_quantity}</span> → atual: <span className="font-bold">{h.new_quantity}</span>)
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProductDialog({ product }: { product?: Product }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product?.name ?? "");
  const [quantity, setQuantity] = useState(String(product?.quantity ?? 0));
  const [sell_price, setSell] = useState(String(product?.sell_price ?? "").replace(".", ","));
  const [cost_price, setCost] = useState(String(product?.cost_price ?? "").replace(".", ","));
  const [unit, setUnit] = useState(product?.unit ?? "un");
  const [category, setCategory] = useState(product?.category ?? "Bebidas");
  const [customCategory, setCustomCategory] = useState("");
  const [isCustom, setIsCustom] = useState(product?.category ? !DEFAULT_STOCK_CATEGORIES.includes(product.category) : false);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const finalCategory = isCustom ? (customCategory || "Outros") : category;
      const payload = {
        name, unit, category: finalCategory,
        quantity: Number(quantity), min_quantity: 0,
        sell_price: Number(sell_price.replace(",", ".")), cost_price: Number(cost_price.replace(",", ".")),
      };
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({ ...payload, user_id: u.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); toast.success("Salvo"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {product
          ? <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
          : <Button size="sm" className="uppercase tracking-wider text-xs"><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">{product ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Quantidade</Label><Input inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Preço venda</Label><Input type="text" inputMode="decimal" placeholder="0,00" value={sell_price} onChange={e => setSell(e.target.value)} /></div>
            <div><Label>Custo</Label><Input type="text" inputMode="decimal" placeholder="0,00" value={cost_price} onChange={e => setCost(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Unidade</Label><Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="un, kg, L" /></div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={isCustom ? "__custom" : category}
                onValueChange={v => {
                  if (v === "__custom") { setIsCustom(true); setCategory(""); }
                  else { setIsCustom(false); setCategory(v); }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_STOCK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__custom">Personalizado...</SelectItem>
                </SelectContent>
              </Select>
              {isCustom && (
                <Input className="mt-2" placeholder="Nome da categoria" value={customCategory} onChange={e => setCustomCategory(e.target.value)} />
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!name || save.isPending} onClick={() => save.mutate()} className="w-full uppercase tracking-wider text-xs">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}