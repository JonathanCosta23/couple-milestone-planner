import { ResponsiveModal } from "@/components/ui/responsive-modal";
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
      <ResponsiveModal open={open} onOpenChange={onOpenChange} maxWidth="max-w-sm">
        <div className="flex flex-col items-center gap-3 text-center pt-2">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <h2 className="text-lg font-semibold">Erro na importação</h2>
          <p className="text-sm text-muted-foreground">{preview.errorMessage}</p>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full mt-2 h-11">
            Fechar
          </Button>
        </div>
      </ResponsiveModal>
    );
  }

  const exportDate = preview.exportedAt
    ? new Date(preview.exportedAt).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} maxWidth="max-w-sm">
      <div className="flex flex-col items-center gap-3 text-center pt-2">
        <FileCheck className="w-10 h-10 text-primary" />
        <h2 className="text-lg font-semibold">Confirmar importação</h2>
        <div className="space-y-3 w-full text-left">
          <p className="text-sm text-muted-foreground text-center">
            Esta ação substituirá seus dados atuais. Um backup será salvo automaticamente.
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Versão</span>
              <span className="font-medium text-foreground truncate">{preview.version}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Meses preenchidos</span>
              <span className="font-medium text-foreground">{preview.filledMonths}</span>
            </div>
            {exportDate && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Exportado em</span>
                <span className="font-medium text-foreground truncate">{exportDate}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 w-full mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-11">
            Cancelar
          </Button>
          <Button onClick={onConfirm} className="flex-1 gap-1.5 h-11">
            <Upload className="w-4 h-4" /> Importar
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
