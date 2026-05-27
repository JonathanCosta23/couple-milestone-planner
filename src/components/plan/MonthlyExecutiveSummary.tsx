import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBRL } from "@/lib/types";
import type { PlanConfig, MonthRecord } from "@/lib/types";
import {
  buildMonthlySummary,
  computeNextBestAction,
  type NextBestActionContext,
} from "@/lib/services/monthlySummary";
import { calculateDisciplineScore } from "@/lib/services/disciplineScore";
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Info,
  Activity,
} from "lucide-react";

interface Props {
  config: PlanConfig;
  monthRecords: MonthRecord[];
  nextActionContext?: NextBestActionContext;
  onOpenQuickDeposit: () => void;
  onNavigateToTab: (tab: string) => void;
}

const STATUS_META: Record<string, { label: string; tone: string; Icon: typeof Calendar }> = {
  no_plan: { label: "Sem meta definida", tone: "text-muted-foreground", Icon: AlertCircle },
  pending: { label: "Aguardando aporte", tone: "text-warning", Icon: AlertCircle },
  partial: { label: "Em andamento", tone: "text-warning", Icon: Activity },
  completed: { label: "Mês no alvo", tone: "text-primary", Icon: CheckCircle2 },
};

export function MonthlyExecutiveSummary({
  config,
  monthRecords,
  nextActionContext,
  onOpenQuickDeposit,
  onNavigateToTab,
}: Props) {
  const summary = useMemo(
    () => buildMonthlySummary(config, monthRecords),
    [config, monthRecords],
  );
  const score = useMemo(
    () => calculateDisciplineScore(config, monthRecords),
    [config, monthRecords],
  );
  const action = useMemo(
    () => computeNextBestAction(summary, nextActionContext),
    [summary, nextActionContext],
  );

  const status = STATUS_META[summary.status];
  const StatusIcon = status.Icon;
  const executionPctLabel = summary.planned > 0
    ? `${Math.round(summary.executionPct * 100)}%`
    : "—";

  const scoreTone = score.total >= 65
    ? "text-primary"
    : score.total >= 40
      ? "text-warning"
      : "text-destructive";

  const handleAction = () => {
    if (action.tab === "") onOpenQuickDeposit();
    else onNavigateToTab(action.tab);
  };

  return (
    <Card className="glass-card p-4 lg:p-5 space-y-4 animate-fade-in-up">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-muted-foreground">
            Resumo do mês
          </p>
          <p className="text-base lg:text-lg font-semibold capitalize">{summary.monthLabel}</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${status.tone}`}>
          <StatusIcon className="w-4 h-4" />
          <span>{status.label}</span>
        </div>
      </div>

      {/* Números chave */}
      <div className="grid grid-cols-3 gap-2 lg:gap-3">
        <SummaryCell label="Planejado" value={formatBRL(summary.planned)} />
        <SummaryCell label="Realizado" value={formatBRL(summary.realized)} highlight />
        <SummaryCell
          label="Faltam"
          value={formatBRL(summary.remaining)}
          tone={summary.remaining > 0 ? "text-warning" : "text-primary"}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Execução do mês</span>
          <span className="font-semibold">{executionPctLabel}</span>
        </div>
        <Progress value={Math.round(summary.executionPct * 100)} className="h-2 rounded-full" />
      </div>

      {summary.isCouple && summary.perMember.length > 1 && (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          {summary.perMember.map((m, idx) => (
            <div key={`${m.name || "membro"}-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{m.name}</span>
                <span className="font-medium">
                  {formatBRL(m.realized)} <span className="text-muted-foreground">/ {formatBRL(m.planned)}</span>
                </span>
              </div>
              <Progress value={Math.round(m.pct * 100)} className="h-1.5 rounded-full" />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs lg:text-sm text-muted-foreground leading-snug">{summary.diagnostic}</p>

      {/* Score de disciplina */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Disciplina de execução
            </p>
            {/* Popover funciona em toque (mobile) e clique (desktop), ao
                contrário do Tooltip que só responde a hover. */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Como o score é calculado"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="max-w-[280px] text-xs leading-snug">
                {score.explanation}
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{score.label}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-bold tabular-nums ${scoreTone}`}>{score.total}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">/ 100</p>
        </div>
      </div>

      {/* Próxima melhor ação */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 lg:p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-wider font-bold text-primary">
          Próxima melhor ação
        </p>
        <p className="text-sm lg:text-base font-semibold leading-snug">{action.title}</p>
        <p className="text-xs text-muted-foreground leading-snug">{action.description}</p>
        <Button onClick={handleAction} size="sm" className="w-full sm:w-auto gap-1.5">
          {action.ctaLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
}

function SummaryCell({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/30 p-2.5 lg:p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
        {label}
      </p>
      <p
        className={`mt-0.5 font-bold tabular-nums leading-tight ${
          tone ?? (highlight ? "text-foreground text-base lg:text-lg" : "text-foreground text-sm lg:text-base")
        }`}
      >
        {value}
      </p>
    </div>
  );
}