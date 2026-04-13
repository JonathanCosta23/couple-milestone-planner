import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact } from "@/lib/types";
import { AppData } from "@/lib/models";
import type { FinancialCoreState } from "@/hooks/useFinancialCore";
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
  core: FinancialCoreState;
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
        <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">de 100</span>
      </div>
    </div>
  );
}

interface DimensionInfo {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  value: number;
  cause: string;
  action: string;
}

function buildDimensions(m: FinancialCoreState): DimensionInfo[] {
  const { metrics, allocation } = m;
  const balanceScore = metrics.totalIncome > 0
    ? Math.min(100, Math.max(0, ((metrics.totalIncome - metrics.totalExpenses - metrics.totalDebtPayment) / metrics.totalIncome) * 100))
    : 50;
  const consistencyScore = Math.min(100, metrics.streak * 15);
  const debtRatio = metrics.totalIncome > 0 ? metrics.totalDebtPayment / metrics.totalIncome : 0;
  const debtScore = Math.max(0, 100 - debtRatio * 200 - metrics.toxicDebtCount * 15);
  const emergencyScore = Math.min(100, metrics.reserveMonths * 16.67);
  const hasIncome = metrics.totalIncome > 0;
  const hasExpenses = metrics.totalExpenses > 0;
  const flowClarityScore = (hasIncome ? 40 : 0) + (hasExpenses ? 40 : 0) + 20;
  const allocationRiskScore = Math.min(100, metrics.protectedRatio * 80 + 20);
  const concentrationScore = Math.max(0, 100 - metrics.maxConcentrationByInstitution * 60);
  const savingsRate = metrics.savingsRate;
  const disciplineScore = Math.min(100, savingsRate * 300 + consistencyScore * 0.3);

  const dims: DimensionInfo[] = [
    {
      key: "balance", label: "Equilíbrio", description: "Quanto sobra da sua renda", icon: PieChart,
      value: Math.round(balanceScore),
      cause: balanceScore >= 70 ? "Sua renda cobre bem seus gastos e dívidas." : balanceScore >= 40 ? "Parte significativa da renda está comprometida." : "Quase tudo que entra está saindo.",
      action: balanceScore >= 70 ? "Mantenha e aumente o aporte quando possível." : "Identifique os maiores gastos variáveis e veja onde cortar.",
    },
    {
      key: "consistency", label: "Constância", description: "Frequência dos seus aportes", icon: Activity,
      value: Math.round(consistencyScore),
      cause: consistencyScore >= 70 ? "Você tem mantido aportes regulares." : "Alguns meses ficaram sem aporte.",
      action: consistencyScore >= 70 ? "Continue — consistência vale mais que valor alto." : "Tente automatizar o aporte para não esquecer.",
    },
    {
      key: "debt", label: "Dívidas", description: "Peso das dívidas na sua renda", icon: AlertTriangle,
      value: Math.round(debtScore),
      cause: debtScore >= 70 ? "Dívidas sob controle." : "Dívidas consumindo fatia relevante da renda.",
      action: debtScore >= 70 ? "Foque em não criar novas dívidas." : "Priorize quitar as de maior taxa de juros.",
    },
    {
      key: "emergency", label: "Reserva", description: "Meses cobertos pela reserva", icon: Shield,
      value: Math.round(emergencyScore),
      cause: emergencyScore >= 70 ? "Reserva cobre pelo menos 6 meses." : `Reserva cobre ${metrics.reserveMonths.toFixed(1)} meses.`,
      action: emergencyScore >= 70 ? "Reserva completa — foque em crescimento." : "Continue direcionando para Tesouro Selic.",
    },
    {
      key: "flow", label: "Organização", description: "Controle de receita e gastos", icon: Lightbulb,
      value: Math.round(flowClarityScore),
      cause: flowClarityScore >= 70 ? "Boa visibilidade do fluxo." : "Faltam dados para recomendações precisas.",
      action: flowClarityScore >= 70 ? "Mantenha atualizado todo mês." : "Cadastre renda, gastos ou dívidas.",
    },
    {
      key: "allocation", label: "Segurança", description: "Qualidade dos investimentos", icon: Target,
      value: Math.round(allocationRiskScore),
      cause: allocationRiskScore >= 70 ? "Maior parte em ativos seguros." : "Exposição relevante a ativos de risco.",
      action: allocationRiskScore >= 70 ? "Diversifique gradualmente." : "Reforce a base com renda fixa.",
    },
    {
      key: "concentration", label: "Diversificação", description: "Distribuição entre instituições", icon: Wallet,
      value: Math.round(concentrationScore),
      cause: concentrationScore >= 70 ? "Patrimônio distribuído." : "Concentração em poucas instituições.",
      action: concentrationScore >= 70 ? "Continue monitorando FGC." : "Distribua entre 2-3 instituições.",
    },
    {
      key: "discipline", label: "Disciplina", description: "Compromisso com o plano", icon: TrendingUp,
      value: Math.round(disciplineScore),
      cause: disciplineScore >= 70 ? "Boa fração da renda investida." : "Percentual investido pode melhorar.",
      action: disciplineScore >= 70 ? "Aumente em 5-10% quando puder." : "Comece com qualquer valor fixo.",
    },
  ];
  return dims;
}

export function FinancialDiagnostic({ appData, config, monthRecords, startDate, core }: Props) {
  const { metrics, allocation, projection, insights } = core;

  const dimensions = useMemo(() => buildDimensions(core), [core]);

  // Weighted total
  const weights = [0.15, 0.15, 0.15, 0.12, 0.08, 0.1, 0.1, 0.15];
  const totalScore = Math.min(100, Math.max(0, Math.round(
    dimensions.reduce((s, d, i) => s + d.value * weights[i], 0)
  )));

  const scoreInterpretation = totalScore >= 70
    ? "Sua saúde financeira está boa. Continue assim e foque em manter a consistência."
    : totalScore >= 40
    ? "Há pontos que merecem atenção. Veja abaixo o que pode melhorar primeiro."
    : "Sua situação precisa de ajustes. Comece pelos itens mais baixos.";

  const sorted = [...dimensions].sort((a, b) => a.value - b.value);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  return (
    <div className="space-y-4 lg:space-y-6">
      <Card className="glass-card-strong p-6 lg:p-8">
        <h3 className="section-label mb-2 text-center">Sua saúde financeira</h3>
        <p className="text-xs sm:text-sm text-muted-foreground text-center mb-4 max-w-md mx-auto">{scoreInterpretation}</p>
        <ScoreRing score={totalScore} />
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Ponto mais fraco</p>
            <p className="text-sm font-bold text-destructive">{weakest.label}: {weakest.value}</p>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Ponto mais forte</p>
            <p className="text-sm font-bold text-primary">{strongest.label}: {strongest.value}</p>
          </div>
        </div>
      </Card>

      <Card className="glass-card p-4 lg:p-6 space-y-4">
        <h3 className="section-label">Diagnóstico por dimensão</h3>
        {dimensions.map(d => {
          const color = d.value >= 70 ? "text-primary" : d.value >= 40 ? "text-warning" : "text-destructive";
          const Icon = d.icon;
          return (
            <div key={d.key} className="space-y-2 pb-3 border-b border-border/30 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <div>
                    <p className="text-sm font-semibold">{d.label}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{d.description}</p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${color}`}>{d.value}</span>
              </div>
              <Progress value={d.value} className="h-1.5" />
              <div className="pl-6 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Por quê:</span> {d.cause}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">O que fazer:</span> {d.action}
                </p>
              </div>
            </div>
          );
        })}
      </Card>

      <Card className="glass-card p-4 lg:p-6 space-y-3">
        <h3 className="text-sm lg:text-base font-bold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Raio-X do seu mês
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
          <Metric label="O que entra" value={formatBRL(metrics.totalIncome)} icon={ArrowUpRight} positive />
          <Metric label="O que sai" value={formatBRL(metrics.totalExpenses)} icon={ArrowDownRight} />
          <Metric label="Sobra para investir" value={`${(metrics.savingsRate * 100).toFixed(0)}%`} icon={TrendingUp} positive={metrics.savingsRate > 0.15} />
          <Metric label="Já investe" value={`${(metrics.investmentRate * 100).toFixed(0)}%`} icon={Target} positive={metrics.investmentRate > 0.1} />
          <Metric label="Gastos fixos" value={`${metrics.totalIncome > 0 ? ((metrics.fixedExpenses / metrics.totalIncome) * 100).toFixed(0) : 0}%`} icon={PieChart} />
          <Metric label="Gastos variáveis" value={`${metrics.totalIncome > 0 ? ((metrics.variableExpenses / metrics.totalIncome) * 100).toFixed(0) : 0}%`} icon={PieChart} />
          <Metric label="Peso da dívida" value={`${(metrics.debtWeight * 100).toFixed(0)}%`} icon={AlertTriangle} positive={metrics.debtWeight < 0.15} />
          <Metric label="Reserva" value={`${metrics.reserveMonths.toFixed(1)} meses`} icon={Shield} positive={metrics.reserveMonths >= 6} />
        </div>
      </Card>

      <Card className="glass-card p-4 lg:p-6 space-y-3">
        <h3 className="text-sm lg:text-base font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" /> Qualidade da proteção
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
          <Metric label="Protegido (FGC+Soberano)" value={`${(metrics.protectedRatio * 100).toFixed(0)}%`} icon={Shield} positive={metrics.protectedRatio >= 0.6} />
          <Metric label="Liquidez imediata" value={`${(metrics.liquidityRatio * 100).toFixed(0)}%`} icon={Wallet} positive={metrics.liquidityRatio >= 0.3} />
          <Metric label="Concentração" value={allocation.concentrationRisk === "low" ? "Baixa" : allocation.concentrationRisk === "medium" ? "Média" : "Alta"} icon={PieChart}
            positive={allocation.concentrationRisk === "low"} />
          <Metric label="Robustez geral" value={`${allocation.structuralScore}/100`} icon={Target} positive={allocation.structuralScore >= 70} />
        </div>
      </Card>

      <Card className="glass-card p-4 lg:p-6 space-y-3">
        <h3 className="text-sm lg:text-base font-bold flex items-center gap-2">
          <Wallet className="w-4 h-4 text-accent" /> Seu patrimônio
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          <Metric label="Total investido" value={formatBRLCompact(metrics.grossWealth)} icon={TrendingUp} positive />
          <Metric label="Patrimônio líquido" value={formatBRLCompact(metrics.netWealth)} icon={Wallet} positive={metrics.netWealth > 0} />
        </div>
        {projection.monthsToTargetNominal && (
          <div className="text-center pt-2 border-t border-border/30">
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Estimativa para alcançar a meta (nominal)</p>
            <p className="text-lg lg:text-xl font-bold text-primary">
              ~{Math.ceil(projection.monthsToTargetNominal / 12)} anos ({projection.monthsToTargetNominal} meses)
            </p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
        {insights.biggestBottleneck && (
          <Card className="glass-card p-4 lg:p-5 border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">O que mais atrasa sua meta</p>
                <p className="text-sm lg:text-base font-medium">{insights.biggestBottleneck.title}</p>
              </div>
            </div>
          </Card>
        )}
        {insights.nextBestAction && (
          <Card className="glass-card p-4 lg:p-5 border-primary/20">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Próximo melhor passo</p>
                <p className="text-sm lg:text-base font-medium">{insights.nextBestAction.title}</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <ContextualEducation appData={appData} config={config} monthRecords={monthRecords} startDate={startDate} context="diagnostic" maxSuggestions={2} />
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
