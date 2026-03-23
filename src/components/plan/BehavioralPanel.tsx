import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord } from "@/lib/types";
import { generateNudges, calculateHabitMetrics, BehavioralNudge } from "@/lib/behavioralEngine";
import { Brain, Flame, TrendingUp, TrendingDown, Minus, Eye, CreditCard, Target, Calendar } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
}

export function BehavioralPanel({ appData, config, monthRecords, startDate }: Props) {
  const nudges = useMemo(() => generateNudges(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const habits = useMemo(() => calculateHabitMetrics(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);

  const trendIcon = habits.trend === "improving" ? TrendingUp : habits.trend === "declining" ? TrendingDown : Minus;
  const trendColor = habits.trend === "improving" ? "text-primary" : habits.trend === "declining" ? "text-destructive" : "text-muted-foreground";
  const trendLabel = habits.trend === "improving" ? "Melhorando" : habits.trend === "declining" ? "Piorando" : "Estável";
  const TrendIcon = trendIcon;

  return (
    <div className="space-y-4">
      <Card className="glass-card-strong p-4 text-center">
        <Brain className="w-6 h-6 text-primary mx-auto mb-2" />
        <h3 className="font-bold">Inteligência Comportamental</h3>
        <p className="text-xs text-muted-foreground mt-1">Insights sobre seus hábitos financeiros</p>
      </Card>

      {/* Discipline Overview */}
      <Card className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Disciplina Geral</p>
          <div className="flex items-center gap-1.5">
            <TrendIcon className={`w-4 h-4 ${trendColor}`} />
            <span className={`text-xs font-medium ${trendColor}`}>{trendLabel}</span>
          </div>
        </div>
        <div className="text-center mb-3">
          <p className="text-3xl font-extrabold text-primary">{habits.overallDiscipline}</p>
          <p className="text-[10px] text-muted-foreground uppercase">de 100</p>
        </div>
        <div className="space-y-3">
          <HabitBar icon={Flame} label="Sequência de aportes" value={Math.min(100, habits.contributionStreak * 12)} detail={`${habits.contributionStreak} meses`} />
          <HabitBar icon={Target} label="Disciplina mensal" value={habits.monthlyDiscipline} />
          <HabitBar icon={Eye} label="Controle de gastos" value={habits.expenseTracking} />
          <HabitBar icon={CreditCard} label="Controle do cartão" value={habits.cardControl} />
          <HabitBar icon={Calendar} label="Dias sem impulso" value={Math.min(100, habits.impulseFreedays * 3.3)} detail={`~${habits.impulseFreedays} dias`} />
        </div>
      </Card>

      {/* Nudges */}
      {nudges.length > 0 && (
        <Card className="glass-card p-4 space-y-3">
          <p className="text-sm font-semibold">Alertas e Insights</p>
          {nudges.slice(0, 5).map(nudge => (
            <NudgeCard key={nudge.id} nudge={nudge} />
          ))}
        </Card>
      )}

      {nudges.length === 0 && (
        <Card className="glass-card p-6 text-center">
          <p className="text-2xl mb-2">🎯</p>
          <p className="text-sm font-semibold">Tudo certo por aqui!</p>
          <p className="text-xs text-muted-foreground">Continue cadastrando dados para insights mais precisos.</p>
        </Card>
      )}
    </div>
  );
}

function HabitBar({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: number; detail?: string }) {
  const color = value >= 70 ? "text-primary" : value >= 40 ? "text-warning" : "text-destructive";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          <span className="text-muted-foreground">{label}</span>
        </div>
        <span className={`font-semibold ${color}`}>{detail || `${Math.round(value)}%`}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function NudgeCard({ nudge }: { nudge: BehavioralNudge }) {
  const borderColor = nudge.type === "warning" ? "border-warning/20" : nudge.type === "praise" ? "border-primary/20" : nudge.type === "action" ? "border-accent/20" : "border-border";
  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30 border ${borderColor}`}>
      <span className="text-lg shrink-0">{nudge.icon}</span>
      <p className="text-xs text-muted-foreground leading-relaxed">{nudge.message}</p>
    </div>
  );
}
