import { useMemo, useState } from "react";
import { History, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { saveAppData } from "@/lib/appStorage";
import { savePlanData, saveBackup } from "@/lib/storage";
import type { AppData } from "@/lib/models";
import type { PlanData } from "@/lib/types";

const PRE_MIGRATION_BACKUP_KEY = "plano-do-milhao-pre-migration-backup";
const LEGACY_PLAN_KEY = "plano-do-milhao-v6";
const LEGACY_APP_KEY = "plano-do-milhao-app-v7";

interface BackupSnapshot {
  [LEGACY_PLAN_KEY]?: string | null;
  [LEGACY_APP_KEY]?: string | null;
  _backupAt?: string;
}

function readBackup(): BackupSnapshot | null {
  try {
    const raw = localStorage.getItem(PRE_MIGRATION_BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BackupSnapshot;
  } catch {
    return null;
  }
}

function formatDate(iso?: string): string {
  if (!iso) return "data desconhecida";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RestoreBackupButton() {
  const [open, setOpen] = useState(false);
  const backup = useMemo(() => readBackup(), [open]);
  const hasBackup = !!backup && (backup[LEGACY_PLAN_KEY] || backup[LEGACY_APP_KEY]);

  const handleRestore = () => {
    if (!backup) return;
    try {
      // Backup do estado atual antes de restaurar — duplo seguro.
      const currentApp = localStorage.getItem(LEGACY_APP_KEY);
      const currentPlan = localStorage.getItem(LEGACY_PLAN_KEY);
      if (currentPlan) {
        try {
          saveBackup(JSON.parse(currentPlan) as PlanData);
        } catch {
          /* ignore parse error */
        }
      }
      if (currentApp) {
        localStorage.setItem(`${LEGACY_APP_KEY}-prev`, currentApp);
      }

      // Restaura snapshot.
      if (backup[LEGACY_APP_KEY]) {
        const parsed = JSON.parse(backup[LEGACY_APP_KEY] as string) as AppData;
        saveAppData(parsed);
      }
      if (backup[LEGACY_PLAN_KEY]) {
        const parsed = JSON.parse(backup[LEGACY_PLAN_KEY] as string) as PlanData;
        savePlanData(parsed);
      }
      toast.success("Backup restaurado. Recarregando...", { duration: 1500 });
      setOpen(false);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error("[RestoreBackup] erro:", err);
      toast.error("Não foi possível restaurar o backup.");
    }
  };

  if (!hasBackup) {
    return (
      <Button
        variant="outline"
        className="w-full justify-start h-12 rounded-xl text-muted-foreground"
        disabled
        title="Nenhum backup disponível"
      >
        <History className="w-4 h-4 mr-2.5" />
        Restaurar backup (indisponível)
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start h-12 rounded-xl"
        onClick={() => setOpen(true)}
      >
        <History className="w-4 h-4 mr-2.5" />
        Restaurar backup ({formatDate(backup?._backupAt)})
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Restaurar backup local?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Vamos voltar o app para a versão salva em{" "}
                <strong>{formatDate(backup?._backupAt)}</strong>.
              </span>
              <span className="block">
                Os dados atuais deste dispositivo serão guardados em um segundo backup
                automático antes da restauração — nada é apagado de forma definitiva.
              </span>
              <span className="block text-xs text-muted-foreground">
                A página será recarregada ao final.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              Restaurar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
