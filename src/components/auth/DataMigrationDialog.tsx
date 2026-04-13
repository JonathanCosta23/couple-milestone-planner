import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Cloud, Smartphone, Loader2, AlertTriangle } from "lucide-react";

interface DataMigrationDialogProps {
  open: boolean;
  hasCloudData: boolean;
  onMigrateLocal: () => void;
  onKeepCloud: () => void;
  onClose: () => void;
  loading?: boolean;
}

export function DataMigrationDialog({
  open,
  hasCloudData,
  onMigrateLocal,
  onKeepCloud,
  onClose,
  loading = false,
}: DataMigrationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Dados encontrados neste dispositivo
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Encontramos um plano financeiro salvo neste navegador. O que deseja fazer?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <Button
            variant="default"
            className="w-full h-auto py-4 rounded-xl flex-col items-start gap-1"
            onClick={onMigrateLocal}
            disabled={loading}
          >
            <div className="flex items-center gap-2 font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
              Salvar dados locais na minha conta
            </div>
            <span className="text-xs font-normal opacity-80">
              {hasCloudData
                ? "Os dados da conta serão substituídos pelos dados deste dispositivo."
                : "Seus dados serão sincronizados com segurança na nuvem."}
            </span>
          </Button>

          {hasCloudData && (
            <Button
              variant="outline"
              className="w-full h-auto py-4 rounded-xl flex-col items-start gap-1"
              onClick={onKeepCloud}
              disabled={loading}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Smartphone className="w-4 h-4" />
                Manter dados da minha conta
              </div>
              <span className="text-xs font-normal text-muted-foreground">
                Os dados deste dispositivo serão descartados. Seus dados salvos na nuvem serão usados.
              </span>
            </Button>
          )}

          <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={onClose} disabled={loading}>
            Decidir depois
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
