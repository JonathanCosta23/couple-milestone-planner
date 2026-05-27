import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp } from "lucide-react";
import { formatBRL, formatBRLCompact, MILESTONES } from "@/lib/types";
import { buildMilestoneProgress, getRelevantMilestones } from "@/lib/services/monthlySummary";

interface Props {
  currentWealth: number;
  /** Meta final do plano — usada para escalar a jornada e filtrar marcos. */
  targetAmount: number;
  /**
   * Meses estimados para o PRÓXIMO marco (não a meta final).
   * Deve vir de uma série de projeção cruzando o valor do próximo marco.
   * `null` ou `undefined` mostra "estimativa indisponível".
   */
  monthsToNextMilestone?: number | null;
  /** Streak atual de meses concluídos — usado para "ritmo". */
  streakMonths?: number;
}

export function MilestoneProgress({
  currentWealth,
  targetAmount,
  monthsToNextMilestone,
  streakMonths = 0,
}: Props) {
  const relevant = getRelevantMilestones(MILESTONES, targetAmount);
  const { previous, next, pct } = buildMilestoneProgress(currentWealth, relevant);
  const journeyPct = targetAmount > 0 ? Math.min(1, currentWealth / targetAmount) : 0;

  const paceLabel = streakMonths >= 6
    ? "Ritmo consistente"
    : streakMonths >= 3
      ? "Ritmo em construção"
      : "Ritmo inicial";

  return (
    <Card className="glass-card p-4 lg:p-5 space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Marcos patrimoniais
            </p>
            <p className="text-sm lg:text-base font-semibold">
              {previous > 0
                ? `Atual: ${formatBRLCompact(previous)} · Próximo: ${formatBRLCompact(next)}`
                : `Primeiro marco: ${formatBRLCompact(next)}`}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">Jornada</p>
          <p className="text-sm font-semibold tabular-nums">{Math.round(journeyPct * 100)}%</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatBRLCompact(previous)}</span>
          <span>{formatBRLCompact(next)}</span>
        </div>
        <Progress value={Math.round(pct * 100)} className="h-2 rounded-full" />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Faltam {formatBRL(Math.max(0, next - currentWealth))}
          </span>
          <span className="text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {monthsToNextMilestone != null && monthsToNextMilestone > 0
              ? `~${monthsToNextMilestone} meses`
              : "estimativa indisponível"}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-snug">
        {paceLabel}. Cada marco é uma referência de progresso, não uma promessa de retorno.
      </p>
    </Card>
  );
}