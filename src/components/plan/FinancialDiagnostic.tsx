import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact } from "@/lib/types";
import { AppData } from "@/lib/models";
import { calculateHealthScore, calculateDiagnostic, HealthScoreBreakdown } from "@/lib/financialEngine";
import {
  Activity, TrendingUp, TrendingDown, Shield, AlertTriangle,
  PieChart, Wallet, Target, ArrowUpRight, ArrowDownRight, Lightbulb,
} from "lucide-react";
import { ContextualEducation } from "./ContextualEducation";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? "text-primary" : score >= 40 ? "text-warning" : "text-destructive";
  const bgColor = score >= 70 ? "bg-primary/10" : score >= 40 ? "bg-warning/10" : "bg-destructive/10";
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-32 h-32 lg:w-40 lg:h-40 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6"
          className={color} strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-full ${bgColor}`}>
        <span className={`text-3xl lg:text-4xl font-extrabold ${color}`}>{score}</span>
        <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

const SCORE_LABELS: { key: keyof HealthScoreBreakdown; label: string; icon: React.ElementType }[] = [
  { key: "balanceScore", label: "Equilíbrio", icon: PieChart },
  { key: "consistencyScore", label: "Consistência", icon: Activity },
  { key: "debtScore", label: "Dívidas", icon: AlertTriangle },
  { key: "emergencyScore", label: "Reserva", icon: Shield },
  { key: "flowClarityScore", label: "Clareza", icon: Lightbulb },
  { key: "allocationRiskScore", label: "Alocação", icon: Target },
  { key: "concentrationScore", label: "Concentração", icon: Wallet },
  { key: "disciplineScore", label: "Disciplina", icon: TrendingUp },
];

export function FinancialDiagnostic({ appData, config, monthRecords, startDate }: Props) {
  const score = useMemo(() => calculateHealthScore(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const diag = useMemo(() => calculateDiagnostic(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Health Score */}
      <Card className="glass-card-strong p-6 lg:p-8">
        <h3 className="text-sm lg:text-base font-bold uppercase tracking-wider text-muted-foreground mb-4 text-center">Score de Saúde Financeira</h3>
        <ScoreRing score={score.total} />
        <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 lg:gap-4 mt-5">
          {SCORE_LABELS.map(({ key, label, icon: Icon }) => {
            const val = score[key] as number;
            const color = val >= 70 ? "text-primary" : val >= 40 ? "text-warning" : "text-destructive";
            return (
              <div key={key} className="text-center space-y-1">
                <Icon className={`w-3.5 h-3.5 lg:w-4 lg:h-4 mx-auto ${color}`} />
                <p className={`text-sm lg:text-base font-bold ${color}`}>{val}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">{label}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Financial Overview */}
      <Card className="glass-card p-4 lg:p-6 space-y-3">
        <h3 className="text-sm lg:text-base font-bold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Diagnóstico do Mês
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
          <Metric label="Receita" value={formatBRL(diag.totalIncome)} icon={ArrowUpRight} positive />
          <Metric label="Despesas" value={formatBRL(diag.totalExpenses)} icon={ArrowDownRight} />
          <Metric label="Taxa Poupança" value={`${(diag.savingsRate * 100).toFixed(0)}%`} icon={TrendingUp}
            positive={diag.savingsRate > 0.15} />
          <Metric label="Investido" value={`${(diag.investmentRate * 100).toFixed(0)}%`} icon={Target}
            positive={diag.investmentRate > 0.1} />
          <Metric label="Gastos Fixos" value={`${(diag.fixedExpenseWeight * 100).toFixed(0)}%`} icon={PieChart} />
          <Metric label="Gastos Variáveis" value={`${(diag.variableExpenseWeight * 100).toFixed(0)}%`} icon={PieChart} />
          <Metric label="Peso Dívida" value={`${(diag.debtWeight * 100).toFixed(0)}%`} icon={AlertTriangle}
            positive={diag.debtWeight < 0.15} />
          <Metric label="Reserva" value={`${diag.emergencyMonths.toFixed(1)} meses`} icon={Shield}
            positive={diag.emergencyMonths >= 6} />
        </div>
      </Card>

      {/* Wealth Overview */}
      <Card className="glass-card p-4 lg:p-6 space-y-3">
        <h3 className="text-sm lg:text-base font-bold flex items-center gap-2">
          <Wallet className="w-4 h-4 text-accent" /> Patrimônio
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          <Metric label="Investido" value={formatBRLCompact(diag.investedWealth)} icon={TrendingUp} positive />
          <Metric label="Líquido" value={formatBRLCompact(diag.liquidNetWorth)} icon={Wallet}
            positive={diag.liquidNetWorth > 0} />
        </div>
        {diag.monthsToMillion && (
          <div className="text-center pt-2 border-t border-border/30">
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Previsão para o milhão</p>
            <p className="text-lg lg:text-xl font-bold text-primary">
              {Math.ceil(diag.monthsToMillion / 12)} anos ({diag.monthsToMillion} meses)
            </p>
          </div>
        )}
      </Card>

      {/* Bottleneck & Opportunity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
        <Card className="glass-card p-4 lg:p-5 border-destructive/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Maior Gargalo</p>
              <p className="text-sm lg:text-base font-medium">{diag.biggestBottleneck}</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4 lg:p-5 border-primary/20">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Maior Oportunidade</p>
              <p className="text-sm lg:text-base font-medium">{diag.biggestOpportunity}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Contextual Education */}
      <ContextualEducation
        appData={appData}
        config={config}
        monthRecords={monthRecords}
        startDate={startDate}
        context="diagnostic"
        maxSuggestions={2}
      />
    </div>
  );
}

function Metric({ label, value, icon: Icon, positive }: {
  label: string; value: string; icon: React.ElementType; positive?: boolean;
}) {
  return (
    <div className="text-center p-2 lg:p-3 rounded-lg bg-muted/30">
      <Icon className={`w-3.5 h-3.5 lg:w-4 lg:h-4 mx-auto mb-1 ${positive ? "text-primary" : "text-muted-foreground"}`} />
      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">{label}</p>
      <p className={`text-sm lg:text-base font-bold ${positive ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
