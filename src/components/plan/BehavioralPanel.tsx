import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord } from "@/lib/types";
import { generateNudges, calculateHabitMetrics, BehavioralNudge } from "@/lib/behavioralEngine";
import type { FinancialCoreState } from "@/hooks/useFinancialCore";
import { Brain, Flame, TrendingUp, TrendingDown, Minus, Eye, CreditCard, Target, Calendar, ChevronRight } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  core: FinancialCoreState;
}

export function BehavioralPanel({ appData, config, monthRecords, startDate, core }: Props) {
  const nudges = useMemo(() => generateNudges(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const habits = useMemo(() => calculateHabitMetrics(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const { metrics, journey } = core;

  const trendIcon = habits.trend === "improving" ? TrendingUp : habits.trend === "declining" ? TrendingDown : Minus;
  const trendColor = habits.trend === "improving" ? "text-primary" : habits.trend === "declining" ? "text-destructive" : "text-muted-foreground";
  const trendLabel = habits.trend === "improving" ? "Melhorando" : habits.trend === "declining" ? "Precisa de atenção" : "Estável";
  const TrendIcon = trendIcon;

  return (
    <div className="space-y-4 lg:space-y-6">
      <Card className="glass-card-strong p-4 lg:p-6 text-center">
        <Brain className="w-6 h-6 lg:w-8 lg:h-8 text-primary mx-auto mb-2" />
        <h3 className="font-bold lg:text-lg">Seus hábitos financeiros</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Como seu comportamento impacta sua meta — e o que ajustar</p>
      </Card>

      {/* Connection to Journey — consistent phase */}
      <Card className="glass-card p-4 lg:p-5">
        <h4 className="section-label mb-3">Fase atual da jornada</h4>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{journey.phaseEmoji}</span>
          <div>
            <p className="text-sm font-bold">{journey.phaseName}</p>
            <p className="text-xs text-muted-foreground">{journey.phaseDescription}</p>
          </div>
        </div>
      </Card>

      {/* Discipline Overview */}
      <Card className="glass-card p-4 lg:p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Nível de disciplina</p>
          <div className="flex items-center gap-1.5">
            <TrendIcon className={`w-4 h-4 ${trendColor}`} />
            <span className={`text-xs font-medium ${trendColor}`}>{trendLabel}</span>
          </div>
        </div>
        <div className="text-center mb-3">
          <p className="text-3xl lg:text-4xl font-extrabold text-primary">{habits.overallDiscipline}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">de 100</p>
        </div>
        <div className="space-y-3">
          <HabitBar icon={Flame} label="Aportes consecutivos" value={Math.min(100, metrics.streak * 12)} detail={`${metrics.streak} meses`} />
          <HabitBar icon={Target} label="Compromisso com o plano" value={habits.monthlyDiscipline} />
          <HabitBar icon={Eye} label="Controle de gastos" value={habits.expenseTracking} />
          <HabitBar icon={CreditCard} label="Uso consciente do cartão" value={habits.cardControl} />
          <HabitBar icon={Calendar} label="Dias sem compra por impulso" value={Math.min(100, habits.impulseFreedays * 3.3)} detail={`~${habits.impulseFreedays} dias`} />
        </div>
      </Card>

      {/* What improves and what hurts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="glass-card p-4 border-primary/20">
          <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">💪 O que te fortalece</p>
          <ul className="space-y-1.5">
            {metrics.streak >= 2 && <BehaviorItem text="Consistência nos aportes" positive />}
            {habits.cardControl >= 60 && <BehaviorItem text="Controle do cartão de crédito" positive />}
            {habits.expenseTracking >= 60 && <BehaviorItem text="Registro de gastos e renda" positive />}
            {habits.monthlyDiscipline >= 50 && <BehaviorItem text="Boa taxa de poupança" positive />}
            {habits.overallDiscipline < 30 && <li className="text-xs text-muted-foreground">Cadastre mais dados para gerar insights.</li>}
          </ul>
        </Card>
        <Card className="glass-card p-4 border-warning/20">
          <p className="text-xs font-bold uppercase tracking-wider text-warning mb-2">⚠️ O que te atrasa</p>
          <ul className="space-y-1.5">
            {metrics.streak < 2 && <BehaviorItem text="Falta de regularidade nos aportes" />}
            {habits.cardControl < 40 && <BehaviorItem text="Uso excessivo do cartão" />}
            {habits.expenseTracking < 40 && <BehaviorItem text="Poucos dados cadastrados" />}
            {habits.monthlyDiscipline < 30 && <BehaviorItem text="Taxa de poupança muito baixa" />}
          </ul>
        </Card>
      </div>

      {/* Nudges */}
      {nudges.length > 0 && (
        <Card className="glass-card p-4 space-y-3">
          <p className="text-sm font-semibold">O que o app percebeu</p>
          {nudges.slice(0, 5).map(nudge => (
            <NudgeCard key={nudge.id} nudge={nudge} />
          ))}
        </Card>
      )}

      {nudges.length === 0 && (
        <Card className="glass-card p-6 text-center">
          <p className="text-2xl mb-2">🎯</p>
          <p className="text-sm font-semibold">Tudo em ordem por aqui</p>
          <p className="text-xs text-muted-foreground">Continue cadastrando seus dados — quanto mais informação, melhores os insights.</p>
        </Card>
      )}
    </div>
  );
}

function BehaviorItem({ text, positive }: { text: string; positive?: boolean }) {
  return (
    <li className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
      <ChevronRight className={`w-3 h-3 shrink-0 mt-0.5 ${positive ? "text-primary" : "text-warning"}`} />
      <span>{text}</span>
    </li>
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
      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{nudge.message}</p>
    </div>
  );
}
