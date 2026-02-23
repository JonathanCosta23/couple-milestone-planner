import { formatBRL, MILESTONES } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";

interface MilestoneAlertProps {
  milestone: number | null;
  onDismiss: () => void;
}

export function MilestoneAlert({ milestone, onDismiss }: MilestoneAlertProps) {
  if (!milestone) return null;

  const emojis = ["🎉", "🚀", "💰", "🏆", "👑"];
  const idx = MILESTONES.indexOf(milestone);
  const emoji = emojis[idx] || "🎉";

  return (
    <Dialog open={!!milestone} onOpenChange={() => onDismiss()}>
      <DialogContent className="glass-card-strong text-center max-w-sm">
        <div className="flex flex-col space-y-1.5 text-center">
          <DialogTitle className="text-2xl">
            <span className="animate-milestone-pop inline-block text-5xl mb-3">{emoji}</span>
            <br />
            Marco alcançado!
          </DialogTitle>
        </div>
        <DialogDescription asChild>
          <div className="space-y-2">
            <p className="text-lg text-foreground">
              Vocês atingiram <strong className="text-primary text-xl">{formatBRL(milestone)}</strong> no cenário planejado!
            </p>
            <p className="text-sm text-muted-foreground">Continue assim e o milhão está cada vez mais perto.</p>
          </div>
        </DialogDescription>
        <Button onClick={onDismiss} className="mt-4 w-full">
          <Trophy className="w-4 h-4 mr-2" /> Continuar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
