import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { resetUserPlan } from "@/lib/services/resetService";

interface ResetPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  /** Chamado após reset bem-sucedido (antes do reload). */
  onResetComplete?: () => void;
}

const CONFIRM_WORD = "RESETAR";

export function ResetPlanDialog({ open, onOpenChange, userId, onResetComplete }: ResetPlanDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_WORD && !!userId && !loading;

  const handleConfirm = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const result = await resetUserPlan(userId);
      if (!result.ok) {
        toast.error("Não foi possível concluir o reset", {
          description: result.error ?? "Tente novamente em instantes.",
        });
        setLoading(false);
        return;
      }
      onResetComplete?.();
      toast.success("Plano resetado com sucesso", {
        description: "Recarregando a aplicação…",
      });
      // Recarrega para garantir reidratação 100% limpa de todos os hooks/estado.
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err) {
      toast.error("Erro inesperado no reset", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
      setLoading(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!loading) {
          onOpenChange(o);
          if (!o) setConfirmText("");
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Resetar plano
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Esta ação <strong className="text-foreground">apaga todos os seus dados financeiros</strong>:
                plano, renda, gastos, dívidas, aportes mensais, patrimônio, marcos, insights e progresso educacional.
              </p>
              <p>
                <strong className="text-foreground">Seu login será mantido</strong> — você continuará conseguindo entrar normalmente.
              </p>
              <p>
                Esta ação <strong className="text-destructive">não pode ser desfeita</strong>, exceto se você tiver um backup manual exportado.
              </p>
              <div className="pt-2">
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Para confirmar, digite <span className="font-mono">{CONFIRM_WORD}</span>:
                </label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  autoFocus
                  disabled={loading}
                  className="font-mono"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetando…
              </>
            ) : (
              "Resetar tudo"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}