import { useState, useRef, useEffect } from "react";
import { Camera, Banknote, QrCode, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface CameraScannerProps {
  onScan: (code: string) => void;
}

export function CameraScanner({ onScan }: CameraScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted || !containerRef.current) return;
        const scanner = new Html5Qrcode("venda-barcode-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (text: string) => { if (mounted) onScan(text); },
          () => {}
        );
      } catch (err: any) {
        if (mounted) setError(err?.message || "Erro ao acessar a câmera.");
      }
    };
    start();
    return () => {
      mounted = false;
      if (scannerRef.current) {
        try { const s = scannerRef.current.getState(); if (s === 2) scannerRef.current.stop(); } catch (e) { /* ignore */ }
      }
    };
  }, [onScan]);

  if (error) {
    return (
      <div className="text-center py-8">
        <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground mt-1">Use a opção "Digitar código" como alternativa.</p>
      </div>
    );
  }

  return <div id="venda-barcode-reader" ref={containerRef} className="w-full rounded-lg overflow-hidden bg-black min-h-[280px]" />;
}

export interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  total: number;
  cartCount: number;
  onConfirm: (method: string) => void;
  isPending: boolean;
}

export function CheckoutDialog({ open, onOpenChange, total, cartCount, onConfirm, isPending }: CheckoutDialogProps) {
  const [method, setMethod] = useState("dinheiro");
  const [cashReceived, setCashReceived] = useState("");
  const [cardType, setCardType] = useState("debito");
  const cashNum = Number(cashReceived.replace(",", ".")) || 0;
  const change = method === "dinheiro" && cashNum >= total ? cashNum - total : 0;
  const handleConfirm = () => {
    onConfirm(method === "cartao" ? "cartao_" + cardType : method);
    setCashReceived("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-display">Finalizar Venda</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{cartCount} {cartCount === 1 ? "item" : "itens"}</p>
            <p className="font-display text-3xl font-bold text-primary">{brl(total)}</p>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider">Forma de Pagamento</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[
                { id: "dinheiro", icon: Banknote, label: "Dinheiro" },
                { id: "pix", icon: QrCode, label: "PIX" },
                { id: "cartao", icon: CreditCard, label: "Cartão" },
                { id: "outro", icon: CreditCard, label: "Outro" },
              ].map(m => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  className={"flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors " + (method === m.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground")}>
                  <m.icon className="h-5 w-5" /><span className="text-[10px] font-semibold uppercase">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          {method === "cartao" && (
            <div><Label className="text-xs">Tipo do Cartão</Label>
              <Select value={cardType} onValueChange={setCardType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="debito">Débito</SelectItem><SelectItem value="credito">Crédito</SelectItem></SelectContent>
              </Select>
            </div>
          )}
          {method === "dinheiro" && (
            <div>
              <Label className="text-xs">Valor Recebido</Label>
              <Input inputMode="decimal" placeholder="0,00" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="mt-1 text-lg" autoFocus />
              {cashNum > 0 && (
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">{cashNum >= total ? "Troco:" : "Falta:"}</span>
                  <span className={"font-bold " + (cashNum >= total ? "text-emerald-600" : "text-destructive")}>{cashNum >= total ? brl(change) : brl(total - cashNum)}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button className="w-full h-12 text-base font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleConfirm} disabled={isPending || (method === "dinheiro" && cashNum < total)}>
            {isPending ? "Processando…" : "Confirmar — " + brl(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

