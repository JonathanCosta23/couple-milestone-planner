import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImportPreview } from "@/lib/storage";
import { AlertTriangle, FileCheck, Upload } from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ImportPreview | null;
  onConfirm: () => void;
}

export function ImportDialog({ open, onOpenChange, preview, onConfirm }: ImportDialogProps) {
  if (!preview) return null;

  if (!preview.valid) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-card max-w-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
            <DialogTitle className="text-lg">Erro na importação</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {preview.errorMessage}
            </DialogDescription>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full mt-2">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const exportDate = preview.exportedAt
    ? new Date(preview.exportedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <FileCheck className="w-10 h-10 text-primary" />
          <DialogTitle className="text-lg">Confirmar importação</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 w-full text-left">
              <p className="text-sm text-muted-foreground text-center">
                Esta ação substituirá seus dados atuais. Um backup será salvo automaticamente.
              </p>
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Versão</span>
                  <span className="font-medium text-foreground">{preview.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meses preenchidos</span>
                  <span className="font-medium text-foreground">{preview.filledMonths}</span>
                </div>
                {exportDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exportado em</span>
                    <span className="font-medium text-foreground">{exportDate}</span>
                  </div>
                )}
              </div>
            </div>
          </DialogDescription>
          <div className="flex gap-2 w-full mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={onConfirm} className="flex-1 gap-1.5">
              <Upload className="w-4 h-4" /> Importar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
