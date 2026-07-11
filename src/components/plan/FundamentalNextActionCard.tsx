import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target } from "lucide-react";
import { computeFundamentalNextAction, type FundamentalContext } from "@/lib/services/fundamentalNextAction";

interface Props {
  ctx: FundamentalContext;
  onNavigate: (tab: string, sub?: string) => void;
}

export function FundamentalNextActionCard({ ctx, onNavigate }: Props) {
  const action = computeFundamentalNextAction(ctx);
  return (
    <Card className="glass-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0 space-y-1 flex-1">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Próxima ação fundamental</p>
          <p className="text-sm font-semibold">{action.headline}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{action.detail}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-between rounded-xl touch-target"
        onClick={() => onNavigate(action.ctaTarget.tab, action.ctaTarget.sub)}
      >
        <span>{action.ctaLabel}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </Card>
  );
}