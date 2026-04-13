import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact } from "@/lib/types";
import { AppData } from "@/lib/models";
import { calculateHealthScore, calculateDiagnostic, calculatePortfolioSecurity, HealthScoreBreakdown } from "@/lib/financialEngine";
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
        <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">de 100</span>
      </div>
    </div>
  );
}

// Each dimension gets: why + what to do
function getDimensionExplanation(key: keyof HealthScoreBreakdown, value: number, diag: ReturnType<typeof calculateDiagnostic>): { cause: string; action: string } {
  const explanations: Record<string, { cause: string; action: string }> = {
    balanceScore: value >= 70
      ? { cause: "Sua renda cobre bem seus gastos e dívidas.", action: "Mantenha o equilíbrio e aumente o aporte quando possível." }
      : value >= 40
      ? { cause: "Uma parte significativa da renda está comprometida com gastos ou dívidas.", action: "Identifique os maiores gastos variáveis e veja onde cortar." }
      : { cause: "Quase tudo que entra está saindo. Sobra pouco ou nada.", action: "Faça um raio-X dos gastos e elimine os não-essenciais este mês." },
    consistencyScore: value >= 70
      ? { cause: "Você tem mantido aportes regulares. Ótimo ritmo.", action: "Continue assim — consistência vale mais que valor alto." }
      : value >= 40
      ? { cause: "Alguns meses ficaram sem aporte.", action: "Tente automatizar o aporte para não esquecer." }
      : { cause: "Poucos ou nenhum aporte recente registrado.", action: "Registre seu próximo aporte agora, mesmo que pequeno." },
    debtScore: value >= 70
      ? { cause: "Suas dívidas estão sob controle ou inexistentes.", action: "Foque em não criar novas dívidas de alto custo." }
      : value >= 40
      ? { cause: "As dívidas estão consumindo uma fatia relevante da sua renda.", action: "Priorize quitar as dívidas com maior taxa de juros." }
      : { cause: "Dívidas tóxicas ou de alto custo estão travando seu progresso.", action: "Negocie ou quite a dívida mais cara antes de investir." },
    emergencyScore: value >= 70
      ? { cause: "Sua reserva de emergência cobre pelo menos 6 meses de gastos.", action: "Reserva completa — foque em crescimento patrimonial." }
      : value >= 40
      ? { cause: `Sua reserva cobre ${diag.emergencyMonths.toFixed(1)} meses. O ideal é pelo menos 6.`, action: "Continue direcionando para Tesouro Selic até completar." }
      : { cause: "Sem reserva adequada, qualquer imprevisto pode destruir o plano.", action: "Priorize montar 3 meses de reserva antes de tudo." },
    flowClarityScore: value >= 70
      ? { cause: "Você tem renda, gastos e dívidas mapeados. Boa visibilidade.", action: "Mantenha o registro atualizado todo mês." }
      : value >= 40
      ? { cause: "Faltam alguns dados para o app gerar recomendações precisas.", action: "Cadastre o que falta: renda, gastos ou dívidas." }
      : { cause: "Sem dados cadastrados, o motor não pode te ajudar de verdade.", action: "Comece cadastrando sua renda principal." },
    allocationRiskScore: value >= 70
      ? { cause: "A maior parte do patrimônio está em ativos seguros.", action: "Diversifique gradualmente quando a base estiver sólida." }
      : value >= 40
      ? { cause: "Há exposição relevante a ativos de risco.", action: "Reforce a base com renda fixa antes de expandir em risco." }
      : { cause: "Grande parte do patrimônio está em ativos voláteis.", action: "Considere rebalancear para proteger o que já construiu." },
    concentrationScore: value >= 70
      ? { cause: "Seu patrimônio está distribuído entre instituições.", action: "Continue monitorando os limites do FGC." }
      : value >= 40
      ? { cause: "Há concentração moderada em poucas instituições.", action: "Abra conta em outra instituição para distribuir melhor." }
      : { cause: "A maior parte está em uma só instituição — risco invisível alto.", action: "Distribua entre 2-3 instituições diferentes urgentemente." },
    disciplineScore: value >= 70
      ? { cause: "Você investe uma boa fração da renda com regularidade.", action: "Tente aumentar o aporte em 5-10% quando puder." }
      : value >= 40
      ? { cause: "O percentual investido ou a regularidade podem melhorar.", action: "Defina um valor fixo mensal e automatize." }
      : { cause: "A disciplina financeira precisa de atenção urgente.", action: "Comece com qualquer valor fixo — o hábito importa mais." },
  };
  return explanations[key] || { cause: "", action: "" };
}

const SCORE_LABELS: { key: keyof HealthScoreBreakdown; label: string; description: string; icon: React.ElementType }[] = [
  { key: "balanceScore", label: "Equilíbrio", description: "Quanto sobra da sua renda", icon: PieChart },
  { key: "consistencyScore", label: "Constância", description: "Frequência dos seus aportes", icon: Activity },
  { key: "debtScore", label: "Dívidas", description: "Peso das dívidas na sua renda", icon: AlertTriangle },
  { key: "emergencyScore", label: "Reserva", description: "Meses cobertos pela reserva", icon: Shield },
  { key: "flowClarityScore", label: "Organização", description: "Controle de receita e gastos", icon: Lightbulb },
  { key: "allocationRiskScore", label: "Segurança", description: "Qualidade dos investimentos", icon: Target },
  { key: "concentrationScore", label: "Diversificação", description: "Distribuição entre instituições", icon: Wallet },
  { key: "disciplineScore", label: "Disciplina", description: "Compromisso com o plano", icon: TrendingUp },
];

export function FinancialDiagnostic({ appData, config, monthRecords, startDate }: Props) {
  const score = useMemo(() => calculateHealthScore(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const diag = useMemo(() => calculateDiagnostic(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const portfolioSecurity = useMemo(() => calculatePortfolioSecurity(appData, config), [appData, config]);

  const scoreInterpretation = score.total >= 70
    ? "Sua saúde financeira está boa. Continue assim e foque em manter a consistência."
    : score.total >= 40
    ? "Há pontos que merecem atenção. Veja abaixo o que pode melhorar primeiro."
    : "Sua situação precisa de ajustes. Comece pelos itens mais baixos — pequenas mudanças fazem diferença.";

  // Find weakest and strongest dimensions
  const dimensionValues = SCORE_LABELS.map(s => ({ ...s, value: score[s.key] as number }));
  const weakest = [...dimensionValues].sort((a, b) => a.value - b.value)[0];
  const strongest = [...dimensionValues].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Health Score */}
      <Card className="glass-card-strong p-6 lg:p-8">
        <h3 className="section-label mb-2 text-center">Sua saúde financeira</h3>
        <p className="text-xs sm:text-sm text-muted-foreground text-center mb-4 max-w-md mx-auto">{scoreInterpretation}</p>
        <ScoreRing score={score.total} />

        {/* Quick summary: weakest + strongest */}
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

      {/* Each dimension with cause + action */}
      <Card className="glass-card p-4 lg:p-6 space-y-4">
        <h3 className="section-label">Diagnóstico por dimensão</h3>
        {SCORE_LABELS.map(({ key, label, description, icon: Icon }) => {
          const val = score[key] as number;
          const color = val >= 70 ? "text-primary" : val >= 40 ? "text-warning" : "text-destructive";
          const barColor = val >= 70 ? "bg-primary" : val >= 40 ? "bg-warning" : "bg-destructive";
          const explanation = getDimensionExplanation(key, val, diag);

          return (
            <div key={key} className="space-y-2 pb-3 border-b border-border/30 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${color}`}>{val}</span>
              </div>
              <Progress value={val} className="h-1.5" />
              <div className="pl-6 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Por quê:</span> {explanation.cause}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">O que fazer:</span> {explanation.action}
                </p>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Financial Overview */}
      <Card className="glass-card p-4 lg:p-6 space-y-3">
        <h3 className="text-sm lg:text-base font-bold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Raio-X do seu mês
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
          <Metric label="O que entra" value={formatBRL(diag.totalIncome)} icon={ArrowUpRight} positive />
          <Metric label="O que sai" value={formatBRL(diag.totalExpenses)} icon={ArrowDownRight} />
          <Metric label="Sobra para investir" value={`${(diag.savingsRate * 100).toFixed(0)}%`} icon={TrendingUp}
            positive={diag.savingsRate > 0.15} />
          <Metric label="Já investe" value={`${(diag.investmentRate * 100).toFixed(0)}%`} icon={Target}
            positive={diag.investmentRate > 0.1} />
          <Metric label="Gastos fixos" value={`${(diag.fixedExpenseWeight * 100).toFixed(0)}%`} icon={PieChart} />
          <Metric label="Gastos variáveis" value={`${(diag.variableExpenseWeight * 100).toFixed(0)}%`} icon={PieChart} />
          <Metric label="Peso da dívida" value={`${(diag.debtWeight * 100).toFixed(0)}%`} icon={AlertTriangle}
            positive={diag.debtWeight < 0.15} />
          <Metric label="Reserva" value={`${diag.emergencyMonths.toFixed(1)} meses`} icon={Shield}
            positive={diag.emergencyMonths >= 6} />
        </div>
      </Card>

      {/* Protection Quality */}
      <Card className="glass-card p-4 lg:p-6 space-y-3">
        <h3 className="text-sm lg:text-base font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" /> Qualidade da proteção
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
          <Metric label="Protegido (FGC+Soberano)" value={`${(portfolioSecurity.protectedPercentage * 100).toFixed(0)}%`} icon={Shield}
            positive={portfolioSecurity.protectedPercentage >= 0.6} />
          <Metric label="Liquidez imediata" value={`${(portfolioSecurity.liquidityPercentage * 100).toFixed(0)}%`} icon={Wallet}
            positive={portfolioSecurity.liquidityPercentage >= 0.3} />
          <Metric label="Concentração" value={portfolioSecurity.concentrationLevel === "low" ? "Baixa" : portfolioSecurity.concentrationLevel === "medium" ? "Média" : "Alta"} icon={PieChart}
            positive={portfolioSecurity.concentrationLevel === "low"} />
          <Metric label="Robustez geral" value={`${portfolioSecurity.total}/100`} icon={Target}
            positive={portfolioSecurity.total >= 70} />
        </div>
      </Card>

      {/* Wealth Overview */}
      <Card className="glass-card p-4 lg:p-6 space-y-3">
        <h3 className="text-sm lg:text-base font-bold flex items-center gap-2">
          <Wallet className="w-4 h-4 text-accent" /> Seu patrimônio
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          <Metric label="Total investido" value={formatBRLCompact(diag.investedWealth)} icon={TrendingUp} positive />
          <Metric label="Patrimônio líquido" value={formatBRLCompact(diag.liquidNetWorth)} icon={Wallet}
            positive={diag.liquidNetWorth > 0} />
        </div>
        {diag.monthsToMillion && (
          <div className="text-center pt-2 border-t border-border/30">
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Estimativa para alcançar a meta</p>
            <p className="text-lg lg:text-xl font-bold text-primary">
              ~{Math.ceil(diag.monthsToMillion / 12)} anos ({diag.monthsToMillion} meses)
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
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">O que mais atrasa sua meta</p>
              <p className="text-sm lg:text-base font-medium">{diag.biggestBottleneck}</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4 lg:p-5 border-primary/20">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Onde você pode acelerar</p>
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
