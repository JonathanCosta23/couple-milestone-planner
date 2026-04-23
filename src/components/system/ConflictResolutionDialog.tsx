/**
 * ConflictResolutionDialog — Avisa o usuário quando um write offline
 * encontrou uma versão mais nova no servidor (edição em outro dispositivo).
 *
 * Decisão de produto: não auto-resolver. O usuário escolhe explicitamente:
 *  - Manter minha versão (sobrescreve a nuvem)
 *  - Manter a da nuvem (descarta minha edição offline)
 *  - Adiar (fica na fila para depois)
 */
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
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export interface ConflictDescriptor {
  entityLabel: string;
  /** Resumo legível da minha versão (offline). */
  mineSummary: string;
  /** Resumo legível da versão da nuvem. */
  cloudSummary: string;
  /** Quando minha edição foi feita (ISO). */
  mineAt: string;
  /** Quando a nuvem foi atualizada (ISO). */
  cloudAt: string;
}

interface Props {
  open: boolean;
  conflict: ConflictDescriptor | null;
  onKeepMine: () => void;
  onKeepCloud: () => void;
  onPostpone: () => void;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ConflictResolutionDialog({
  open,
  conflict,
  onKeepMine,
  onKeepCloud,
  onPostpone,
}: Props) {
  if (!conflict) return null;
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="w-5 h-5" />
            <AlertDialogTitle>Conflito de edição</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-foreground/80">
            Esse <span className="font-medium">{conflict.entityLabel}</span> foi alterado em
            outro dispositivo enquanto você estava sem conexão. Qual versão você quer manter?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3 py-2">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="text-xs uppercase tracking-wide text-primary font-medium mb-1">
              Sua versão (offline) · {formatWhen(conflict.mineAt)}
            </div>
            <div className="text-sm">{conflict.mineSummary}</div>
          </div>
          <div className="rounded-lg border border-muted p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
              Versão na nuvem · {formatWhen(conflict.cloudAt)}
            </div>
            <div className="text-sm">{conflict.cloudSummary}</div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onPostpone}>
            Decidir depois
          </Button>
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={onKeepCloud}>
              Manter da nuvem
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onKeepMine}>Manter minha versão</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
