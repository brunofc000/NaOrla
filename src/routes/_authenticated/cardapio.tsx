import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, QrCode, Download, Copy, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { useEmployeeSession } from "@/lib/employee-session";

const DEFAULT_CATEGORIES = [
  "Bebidas",
  "Porções",
  "Petiscos",
  "Pratos",
  "Sobremesas",
  "Combos",
  "Extras",
];

type Item = { id: string; name: string; description: string | null; price: number; category: string; is_available: boolean; image_url: string | null };

export const Route = createFileRoute("/_authenticated/cardapio")({
  head: () => ({ meta: [{ title: "Cardápio — NaOrlaApp" }] }),
  component: Cardapio,
});

function Cardapio() {
  const qc = useQueryClient();
  const employee = useEmployeeSession();
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    if (employee) { setUserId(employee.kiosk_user_id); return; }
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [employee]);
  const { data: items = [] } = useQuery({
    queryKey: ["menu_items", employee?.kiosk_user_id ?? "owner"],
    queryFn: async () => {
      if (employee) {
        const { data, error } = await (supabase as any).rpc("employee_get_menu_v2", {
          _token: employee.token,
        });
        if (error) throw error;
        return (data ?? []) as Item[];
      }
      const { data, error } = await supabase.from("menu_items").select("*").order("category").order("name");
      if (error) throw error;
      return data as Item[];
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("menu_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["menu_items"] }); toast.success("Removido"); },
  });
  const toggle = useMutation({
    mutationFn: async (i: Item) => { const { error } = await supabase.from("menu_items").update({ is_available: !i.is_available }).eq("id", i.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu_items"] }),
  });

  const byCat = items.reduce<Record<string, Item[]>>((acc, i) => { (acc[i.category] ??= []).push(i); return acc; }, {});

  return (
    <div className="space-y-5">
      {!employee && <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>}
      <header className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Cardápio</p>
          <h1 className="font-display text-3xl">{items.length} itens</h1>
        </div>
        {!employee && (
          <div className="flex gap-2">
            {userId && <QrDialog userId={userId} />}
            <ItemDialog />
          </div>
        )}
      </header>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Adicione seu primeiro item.</p>}
      {Object.entries(byCat).map(([cat, list]) => (
        <section key={cat}>
          <h2 className="font-display text-xl mb-2 uppercase text-primary text-sm tracking-wider">{cat}</h2>
          <ul className="divide-y divide-border border border-border">
            {list.map(i => (
              <li key={i.id} className={`flex items-center justify-between p-3 text-sm ${!i.is_available ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  {i.image_url && <img src={i.image_url} alt={i.name} className="float-left h-12 w-12 object-cover mr-2 border border-border" />}
                  <p className="font-semibold">{i.name}</p>
                  {i.description && <p className="text-xs text-muted-foreground">{i.description}</p>}
                  <p className="text-xs font-bold text-primary">{brl(i.price)}</p>
                </div>
                {!employee && (
                  <div className="flex items-center gap-2">
                    <Switch checked={i.is_available} onCheckedChange={() => toggle.mutate(i)} />
                    <ItemDialog item={i} />
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(i.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ItemDialog({ item }: { item?: Item }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(String(item?.price ?? 0));
  const [category, setCategory] = useState(item?.category ?? "Bebidas");
  const [customCategory, setCustomCategory] = useState("");
  const [isCustom, setIsCustom] = useState(item?.category ? !DEFAULT_CATEGORIES.includes(item.category) : false);
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? "");
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const path = `${u.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("kiosk-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      // 1-year signed URL (shorter window reduces exposure if the menu item is later removed).
      const { data: signed } = await supabase.storage.from("kiosk-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) setImageUrl(signed.signedUrl);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const finalCategory = isCustom ? (customCategory || "Outros") : category;
      const payload = { name, description: description || null, price: Number(price.replace(",", ".")), category: finalCategory, image_url: imageUrl || null };
      if (item) {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").insert({ ...payload, user_id: u.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["menu_items"] }); toast.success("Salvo"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item
          ? <Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button>
          : <Button size="sm" className="uppercase tracking-wider text-xs"><Plus className="h-4 w-4 mr-1" />Novo</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">{item ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Descrição</Label><Input value={description ?? ""} onChange={e => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Preço</Label><Input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} /></div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={isCustom ? "__custom" : category}
                onValueChange={v => {
                  if (v === "__custom") { setIsCustom(true); setCategory("Outros"); }
                  else { setIsCustom(false); setCategory(v); }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__custom">Outro...</SelectItem>
                </SelectContent>
              </Select>
              {isCustom && (
                <Input className="mt-2" placeholder="Nome da categoria" value={customCategory} onChange={e => setCustomCategory(e.target.value)} />
              )}
            </div>
          </div>
          <div>
            <Label>Imagem (opcional)</Label>
            {imageUrl ? (
              <div className="relative inline-block mt-1">
                <img src={imageUrl} alt="" className="h-24 w-24 object-cover border border-border" />
                <button type="button" onClick={() => setImageUrl("")} className="absolute -top-2 -right-2 bg-background border border-border p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex items-center justify-center gap-2 border border-dashed border-border p-4 cursor-pointer text-xs uppercase tracking-wider text-muted-foreground hover:bg-muted">
                <ImagePlus className="h-4 w-4" />
                {uploading ? "Enviando…" : "Adicionar foto"}
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!name || save.isPending} onClick={() => save.mutate()} className="w-full uppercase tracking-wider text-xs">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QrDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/m/${userId}` : "";

  const download = () => {
    const canvas = document.getElementById("menu-qr") as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "cardapio-qrcode.png";
    a.click();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="uppercase tracking-wider text-xs">
          <QrCode className="h-4 w-4 mr-1" />QR
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">QR Code do cardápio</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Imprima e coloque nas mesas. Os clientes apontam a câmera e veem seu cardápio.</p>
        <div className="flex justify-center p-6 bg-white">
          <QRCodeCanvas id="menu-qr" value={url} size={240} includeMargin level="M" />
        </div>
        <div className="text-[11px] break-all text-center text-muted-foreground border border-border p-2">{url}</div>
        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={copy} className="flex-1 uppercase tracking-wider text-xs">
            <Copy className="h-4 w-4 mr-1" />Copiar link
          </Button>
          <Button onClick={download} className="flex-1 uppercase tracking-wider text-xs">
            <Download className="h-4 w-4 mr-1" />Baixar PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}