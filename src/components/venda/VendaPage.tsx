import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShoppingCart, Trash2, Plus, Minus, X, Search, ScanBarcode, Lock, AlertTriangle, History, Camera, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CameraScanner, CheckoutDialog } from "@/components/venda/PdvComponents";
type Product = { id: string; name: string; barcode: string | null; sell_price: number; quantity: number; unit: string; category: string };
type CartItem = { product_id: string; name: string; price: number; quantity: number; max_quantity: number; unit: string };
type CompletedSale = { id: string; amount: number; payment_method: string; created_at: string; description: string; sale_items: { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_id: string | null }[] };
export default function VendaPage() {
  const qc = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancellingSale, setCancellingSale] = useState<CompletedSale | null>(null);
  const [cancelPassword, setCancelPassword] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<"camera" | "manual" | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const lastInputTime = useRef<number>(0);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: todaySales = [] } = useQuery({
    queryKey: ["today_sales"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data: txs, error } = await supabase.from("transactions").select("*, sale_items(*)").eq("type", "income").gte("created_at", start.toISOString()).order("created_at", { ascending: false });
      if (error) throw error;
      return (txs ?? []) as unknown as CompletedSale[];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sem sessão");
      const { data, error } = await supabase.from("profiles").select("cancel_password").eq("id", user.id).single();
      if (error) {
        // cancel_password column may not exist yet, return null
        return { cancel_password: null };
      }
      return data;
    },
  });

  const searchLower = searchQuery.trim().toLowerCase();
  const searchResults = searchLower.length > 0
    ? products.filter(p => p.name.toLowerCase().includes(searchLower) || (p.barcode && p.barcode.includes(searchLower)))
    : [];

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= existing.max_quantity) { toast.error("Estoque máximo atingido"); return prev; }
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product_id: product.id, name: product.name, price: Number(product.sell_price), quantity: 1, max_quantity: product.quantity, unit: product.unit }];
    });
    setSearchQuery("");
    toast.success(product.name + " adicionado");
    // Re-focus immediately for next scan (USB scanner or manual)
    setTimeout(() => searchRef.current?.focus(), 10);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const query = searchQuery.trim();
    if (!query) return;
    const byBarcode = products.find(p => p.barcode === query);
    if (byBarcode) { addToCart(byBarcode); return; }
    const byName = products.find(p => p.name.toLowerCase() === query.toLowerCase());
    if (byName) { addToCart(byName); return; }
    if (searchResults.length === 1) { addToCart(searchResults[0]); return; }
    toast.error("Produto não encontrado");
  }, [searchQuery, products, searchResults, addToCart]);

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product_id !== productId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return null as any;
      if (newQty > i.max_quantity) { toast.error("Estoque máximo atingido"); return i; }
      return { ...i, quantity: newQty };
    }).filter(Boolean));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(i => i.product_id !== productId));
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const checkout = useMutation({
    mutationFn: async (paymentMethod: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sem sessão");
      const { data: tx, error: txError } = await supabase.from("transactions").insert({
        user_id: user.id, type: "income", amount: cartTotal,
        description: "Venda PDV - " + cartCount + " itens", category: "venda", payment_method: paymentMethod,
      }).select().single();
      if (txError) throw txError;
      const saleItems = cart.map(item => ({
        transaction_id: tx.id, user_id: user.id, product_id: item.product_id,
        product_name: item.name, quantity: item.quantity, unit_price: item.price, total_price: item.price * item.quantity,
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) throw itemsError;
      for (const item of cart) {
        const product = products.find(p => p.id === item.product_id);
        if (product) await supabase.from("products").update({ quantity: product.quantity - item.quantity }).eq("id", item.product_id);
      }
      return tx;
    },
    onSuccess: () => {
      toast.success("Venda finalizada! " + brl(cartTotal));
      setCart([]); setCheckoutOpen(false);
      qc.invalidateQueries({ queryKey: ["today_sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelSale = useMutation({
    mutationFn: async (sale: CompletedSale) => {
      const storedPassword = profile?.cancel_password;
      if (storedPassword && cancelPassword !== storedPassword) throw new Error("Senha incorreta");
      const { error: txError } = await supabase.from("transactions").update({
        description: "[CANCELADA] " + sale.description, amount: 0,
      }).eq("id", sale.id);
      if (txError) throw txError;
      for (const item of sale.sale_items) {
        if (item.product_id) {
          const product = products.find(p => p.id === item.product_id);
          if (product) await supabase.from("products").update({ quantity: product.quantity + item.quantity }).eq("id", item.product_id);
        }
      }
      return sale;
    },
    onSuccess: () => {
      toast.success("Venda cancelada. Estoque restaurado.");
      setCancellingSale(null); setCancelPassword("");
      qc.invalidateQueries({ queryKey: ["today_sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => { searchRef.current?.focus(); }, []);
  // Re-focus after cart changes (critical for USB scanners)
  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 50); }, [cart]);
  // Re-focus when window regains focus (USB scanner may steal focus)
  useEffect(() => {
    const handleFocus = () => setTimeout(() => searchRef.current?.focus(), 100);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);
  // Keyboard shortcut: F2 to open checkout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2" && cart.length !== 0) {
        e.preventDefault();
        setCheckoutOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart]);
  const activeSales = todaySales.filter(s => !s.description?.includes("[CANCELADA]"));

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-primary">PDV</p>
            <h1 className="font-display text-lg font-bold">Registrar Venda</h1>
          </div>
        </div>
        <Button variant="outline" size="sm" className="uppercase tracking-wider text-xs" onClick={() => setHistoryOpen(true)}>
          <History className="h-4 w-4 mr-1" />Hoje ({activeSales.length})
        </Button>
      </header>

      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input ref={searchRef} placeholder="Escanear código de barras ou pesquisar..." value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); lastInputTime.current = Date.now(); }}
              onKeyDown={e => { if (e.key === "Enter") handleSearchSubmit(); }}
              className="pl-10 pr-10 h-12 text-base font-mono" inputMode="search" autoComplete="off" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" title="Escanear com câmera do celular" onClick={() => setScannerOpen(true)}>
            <Camera className="h-5 w-5" />
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 bg-background border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {searchResults.slice(0, 8).map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-0 text-left">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.quantity} {p.unit} em estoque{p.barcode ? <span className="ml-2 font-mono">#{p.barcode}</span> : null}</p>
                </div>
                <span className="font-bold text-primary shrink-0 ml-3">{brl(p.sell_price)}</span>
              </button>
            ))}
          </div>
        )}
        {searchQuery && searchResults.length === 0 && (
          <div className="mt-2 bg-background border border-border rounded-lg p-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-display">Carrinho vazio</p>
            <p className="text-sm text-center max-w-xs">Use o leitor de código de barras, pesquise pelo nome, ou clique na câmera para escanear</p>
          </div>
        ) : (
          <div className="py-3 space-y-2">
            {cart.map(item => (
              <div key={item.product_id} className="flex items-center gap-3 bg-card border border-border rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{brl(item.price)} / {item.unit}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-8 text-center font-bold text-lg">{item.quantity}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.product_id, 1)} disabled={item.quantity >= item.max_quantity}><Plus className="h-3 w-3" /></Button>
                </div>
                <span className="font-bold text-primary w-20 text-right">{brl(item.price * item.quantity)}</span>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeFromCart(item.product_id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length !== 0 && (
        <>
          {/* Resumo do carrinho - fixo no rodapé */}
          <div className="border-t border-border bg-background/95 backdrop-blur px-4 py-3 fixed bottom-0 left-0 right-0 z-20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{cartCount} {cartCount === 1 ? "item" : "itens"}</p>
                <p className="font-display text-xl font-bold">{brl(cartTotal)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setCart([])}><Trash2 className="h-4 w-4 mr-1" />Limpar</Button>
                <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">F2</span>
              </div>
            </div>
          </div>

          {/* Botão Finalizar - fixo na lateral direita, mais para cima */}
          <button
            onClick={() => setCheckoutOpen(true)}
            className="fixed right-4 bottom-24 z-30 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider text-sm
              h-14 px-6 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>Finalizar · {brl(cartTotal)}</span>
            <kbd className="text-[10px] font-mono bg-emerald-800/60 rounded px-1.5 py-0.5 ml-1">F2</kbd>
          </button>
        </>
      )}

      <ScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} scannerMode={scannerMode} setScannerMode={setScannerMode}
        manualBarcode={manualBarcode} setManualBarcode={setManualBarcode} products={products} addToCart={addToCart} />
      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} total={cartTotal} cartCount={cartCount}
        onConfirm={(method) => checkout.mutate(method)} isPending={checkout.isPending} />
      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} todaySales={todaySales} setCancellingSale={setCancellingSale} />
      <CancelDialog cancellingSale={cancellingSale} setCancellingSale={setCancellingSale} cancelPassword={cancelPassword}
        setCancelPassword={setCancelPassword} profile={profile} cancelSale={cancelSale} />
    </div>
  );
}

function ScannerDialog({ open, onOpenChange, scannerMode, setScannerMode, manualBarcode, setManualBarcode, products, addToCart }: any) {
  const handleBarcode = (code: string) => {
    const product = products.find((p: Product) => p.barcode === code);
    if (product) { addToCart(product); onOpenChange(false); setScannerMode(null); }
    else toast.error("Código " + code + " não encontrado");
  };
  const handleScannerOpenChange = (o: boolean) => { onOpenChange(o); if (!o) setScannerMode(null); };
  return (
    <Dialog open={open} onOpenChange={handleScannerOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display">Escanear Código</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Para leitor USB, use o campo principal na tela.</p>
        {!scannerMode && (
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-3 h-14" onClick={() => setScannerMode("camera")}>
              <Camera className="h-5 w-5 text-primary" /><div className="text-left"><p className="font-semibold">Câmera do celular</p><p className="text-xs text-muted-foreground">Aponte para o código de barras</p></div>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 h-14" onClick={() => setScannerMode("manual")}>
              <Keyboard className="h-5 w-5 text-primary" /><div className="text-left"><p className="font-semibold">Digitar código</p><p className="text-xs text-muted-foreground">Insira o código manualmente</p></div>
            </Button>
          </div>
        )}
        {scannerMode === "camera" && (
          <div className="space-y-3">
            <CameraScanner onScan={handleBarcode} />
            <Button variant="outline" className="w-full" onClick={() => setScannerMode(null)}>Voltar</Button>
          </div>
        )}
        {scannerMode === "manual" && (
          <div className="space-y-3">
            <Input placeholder="Digite o código de barras" value={manualBarcode} onChange={(e: any) => setManualBarcode(e.target.value)}
              onKeyDown={(e: any) => { if (e.key === "Enter" && manualBarcode.trim()) handleBarcode(manualBarcode.trim()); }} autoFocus inputMode="numeric" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setScannerMode(null)}>Voltar</Button>
              <Button className="flex-1" disabled={!manualBarcode.trim()} onClick={() => handleBarcode(manualBarcode.trim())}>Confirmar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ open, onOpenChange, todaySales, setCancellingSale }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Vendas de Hoje</DialogTitle></DialogHeader>
        {todaySales.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma venda hoje.</p>
        ) : (
          <div className="space-y-3">
            {todaySales.map((sale: CompletedSale) => {
              const cancelled = sale.description?.includes("[CANCELADA]");
              return (
                <div key={sale.id} className={"border rounded-lg p-3 " + (cancelled ? "border-destructive/30 bg-destructive/5 opacity-60" : "border-border")}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className={"font-semibold " + (cancelled ? "line-through text-destructive" : "")}>{cancelled ? "CANCELADA" : sale.payment_method?.toUpperCase() || "DINHEIRO"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={"font-bold " + (cancelled ? "line-through text-destructive" : "text-primary")}>{brl(Number(sale.amount))}</span>
                      {!cancelled && (<Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setCancellingSale(sale)}><X className="h-4 w-4" /></Button>)}
                    </div>
                  </div>
                  {sale.sale_items?.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {sale.sale_items.map((item: any) => (<p key={item.id} className={cancelled ? "line-through" : ""}>{item.quantity}× {item.product_name} — {brl(Number(item.total_price))}</p>))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ cancellingSale, setCancellingSale, cancelPassword, setCancelPassword, profile, cancelSale }: any) {
  const handleOpenChange = (open: boolean) => {
    if (!open) { setCancellingSale(null); setCancelPassword(""); }
  };
  return (
    <Dialog open={!!cancellingSale} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Cancelar Venda</DialogTitle></DialogHeader>
        {cancellingSale && (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm font-semibold">{cancellingSale.payment_method?.toUpperCase() || "DINHEIRO"} — {brl(Number(cancellingSale.amount))}</p>
              <div className="text-xs text-muted-foreground mt-1">
                {cancellingSale.sale_items?.map((item: any) => <p key={item.id}>{item.quantity}× {item.product_name}</p>)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Os itens serão devolvidos ao estoque.</p>
            {profile?.cancel_password && (
              <div>
                <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Senha de cancelamento</Label>
                <Input type="password" value={cancelPassword} onChange={(e: any) => setCancelPassword(e.target.value)} placeholder="Senha do dono" className="mt-1" autoFocus />
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setCancellingSale(null); setCancelPassword(""); }} disabled={cancelSale.isPending}>Voltar</Button>
              <Button variant="destructive" onClick={() => cancelSale.mutate(cancellingSale)} disabled={cancelSale.isPending || (!!profile?.cancel_password && !cancelPassword)}>
                {cancelSale.isPending ? "Cancelando…" : "Confirmar Cancelamento"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
