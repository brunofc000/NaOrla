import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ open, onOpenChange, onScan }: BarcodeScannerProps) {
  const [mode, setMode] = useState<"camera" | "manual" | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setMode(null);
      setManualCode("");
      setError(null);
    }
  }, [open]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
  };

  const startScanner = async () => {
    setError(null);
    await stopScanner();

    if (!containerRef.current) return;

    try {
      const scanner = new Html5Qrcode("barcode-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          onScan(decodedText);
          onOpenChange(false);
        },
        () => {
          // Ignore errors during scanning
        }
      );
    } catch (err: any) {
      setError(err?.message || "Erro ao acessar a câmera. Verifique as permissões.");
      setMode(null);
    }
  };

  const handleModeSelect = async (selectedMode: "camera" | "manual") => {
    setMode(selectedMode);
    if (selectedMode === "camera") {
      setTimeout(() => startScanner(), 100);
    }
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (code) {
      onScan(code);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Código de Barras</DialogTitle>
        </DialogHeader>

        {!mode ? (
          <div className="space-y-3">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {error}
              </p>
            )}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={() => handleModeSelect("camera")}
            >
              <Camera className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">Escanear com câmera</p>
                <p className="text-xs text-muted-foreground">Aponte para o código de barras</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={() => handleModeSelect("manual")}
            >
              <Keyboard className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">Digitar código</p>
                <p className="text-xs text-muted-foreground">Insira o código manualmente</p>
              </div>
            </Button>
          </div>
        ) : mode === "camera" ? (
          <div className="space-y-3">
            <div
              id="barcode-reader"
              ref={containerRef}
              className="w-full rounded-lg overflow-hidden bg-black"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                stopScanner();
                setMode(null);
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar leitura
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              placeholder="Digite o código de barras"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualSubmit();
              }}
              autoFocus
              inputMode="numeric"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setMode(null)}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleManualSubmit}
                disabled={!manualCode.trim()}
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}