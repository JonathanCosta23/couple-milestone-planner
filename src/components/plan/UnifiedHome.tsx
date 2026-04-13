import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact, getCurrentMonthKey, monthKeyToFullLabel } from "@/lib/types";
import { calculateHealthScore, calculateDiagnostic, generateStructuralAlerts, getNextBestAction, calculatePortfolioSecurity } from "@/lib/financialEngine";
import { calculateStreak, getCurrentMonthDeposited } from "@/lib/calculator";
import { generateMentorRecommendations, generateNudges } from "@/lib/behavioralEngine";
import { ContextualEducation } from "./ContextualEducation";
import {
  DollarSign, Target, TrendingUp, Zap, AlertTriangle, Lightbulb, ArrowRight,
  Wallet, Shield, ChevronDown, ChevronUp, Eye, CheckCircle,
} from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  onNavigateToTab: (tab: string) => void;
  onOpenQuickDeposit: () => void;
}

// Activation checklist
function getActivationSteps(appData: AppData, monthRecords: MonthRecord[]) {
  const hasIncome = appData.incomes.length > 0;
  const hasExpenses = appData.expenses.length > 0;
  const hasDebt = appData.debts.length > 0;
  const hasAporte = monthRecords.some(m => m.deposits.some(d => d.actualSelic > 0 || d.actualCDB > 0));
  const hasInvestment = appData.investments.length > 0;

  return [
    { id: "income", label: "Cadastrar sua renda", done: hasIncome, tab: "renda", emoji: "💵" },
    { id: "expense", label: "Registrar gastos do mês", done: hasExpenses, tab: "gastos", emoji: "🛒" },
    { id: "aporte", label: "Fazer seu primeiro aporte", done: hasAporte, tab: "", emoji: "💰" },
    { id: "investment", label: "Cadastrar um investimento", done: hasInvestment, tab: "patrimonio", emoji: "📈" },
  ];
}

// Invisible risk detection
function detectInvisibleRisk(appData: AppData, config: PlanConfig, diag: ReturnType<typeof calculateDiagnostic>): { risk: string; explanation: string } | null {
  const investments = appData.investments.filter(i => i.active);
  const totalInvested = investments.reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;

  // FGC concentration
  const byInstitution = new Map<string, number>();
  investments.filter(i => ["cdb", "lci-lca", "poupanca"].includes(i.type)).forEach(i => {
    byInstitution.set(i.institution, (byInstitution.get(i.institution) || 0) + i.currentBalance);
  });
  for (const [inst, bal] of byInstitution) {
    if (bal > 200_000) {
      return { risk: `Limite FGC quase atingido em ${inst}`, explanation: "Acima de R$ 250 mil, o FGC não protege mais. Distribua entre instituições." };
    }
  }

  // Investing without emergency fund
  if (diag.emergencyMonths < 2 && totalInvested > 10_000) {
    return { risk: "Crescendo sem rede de segurança", explanation: "Seu patrimônio cresce, mas sem reserva de emergência um imprevisto pode forçar vendas com prejuízo." };
  }

  // High concentration in single institution
  const byInst = new Map<string, number>();
  investments.forEach(i => byInst.set(i.institution, (byInst.get(i.institution) || 0) + i.currentBalance));
  const maxConc = totalInvested > 0 ? Math.max(...(byInst.size > 0 ? [...byInst.values()] : [0])) / totalInvested : 0;
  if (maxConc > 0.8 && totalInvested > 30_000) {
    return { risk: "Patrimônio concentrado em uma só instituição", explanation: "Se algo acontecer com essa instituição, seu patrimônio inteiro está exposto." };
  }

  // Nominal ≠ Real gap warning
  if (totalInvested > 50_000) {
    return { risk: "Sua meta nominal não é sua meta real", explanation: "R$ 1 milhão daqui a 20 anos vale menos que R$ 1 milhão hoje. Considere a inflação no planejamento." };
  }

  return null;
}

export function UnifiedHome({ appData, config, monthRecords, startDate, onNavigateToTab, onOpenQuickDeposit }: Props) {
  const currentKey = getCurrentMonthKey();
  const [showFinancials, setShowFinancials] = useState(false);

  const score = useMemo(() => calculateHealthScore(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const diag = useMemo(() => calculateDiagnostic(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const currentMonth = useMemo(() => getCurrentMonthDeposited(config, monthRecords), [config, monthRecords]);
  const streak = useMemo(() => calculateStreak(config, monthRecords, startDate), [config, monthRecords, startDate]);
  const recs = useMemo(() => generateMentorRecommendations(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const nudges = useMemo(() => generateNudges(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const structuralAlerts = useMemo(() => generateStructuralAlerts(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const nextBestAction = useMemo(() => getNextBestAction(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const portfolioSecurity = useMemo(() => calculatePortfolioSecurity(appData, config), [appData, config]);
  const isCouple = config.contributors.length > 1;

  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const monthExpenses = appData.expenses.filter(e => e.monthKey === currentKey);
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalDebtPayments = appData.debts.filter(d => d.active).reduce((s, d) => s + d.monthlyPayment, 0);
  const balance = totalIncome - totalExpenses - totalDebtPayments;
  const progressPct = Math.min(100, (diag.investedWealth / config.targetAmount) * 100);
  const nextStep = recs[0] || null;
  const topNudge = nudges[0] || null;

  const scoreColor = score.total >= 70 ? "text-primary" : score.total >= 40 ? "text-warning" : "text-destructive";
  const scoreLabel = score.total >= 70 ? "Saudável" : score.total >= 40 ? "Atenção" : "Crítico";

  const activationSteps = useMemo(() => getActivationSteps(appData, monthRecords), [appData, monthRecords]);
  const completedSteps = activationSteps.filter(s => s.done).length;
  const allStepsComplete = completedSteps === activationSteps.length;
  const invisibleRisk = useMemo(() => detectInvisibleRisk(appData, config, diag), [appData, config, diag]);

  // Empty state
  if (totalIncome === 0 && monthExpenses.length === 0 && diag.investedWealth === 0) {
    return <EmptyHomeState onNavigateToTab={onNavigateToTab} onOpenQuickDeposit={onOpenQuickDeposit} activationSteps={activationSteps} />;
  }

  return (
    <div className="space-y-5 lg:space-y-6 pb-4">
      {/* ── Desktop: Two-column hero layout ── */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-5 lg:space-y-0">
        {/* ── 1. CARD HERO: Meta do mês ── */}
        <Card className="glass-card-hero p-5 lg:p-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs sm:text-sm text-muted-foreground">{monthKeyToFullLabel(currentKey)}</p>
            {streak > 0 && (
              <span className="text-xs font-medium text-primary">🔥 {streak} {streak === 1 ? "mês seguido" : "meses seguidos"}</span>
            )}
          </div>
          <p className="section-title lg:text-lg mb-1">Aporte do mês</p>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-2xl lg:text-3xl font-extrabold text-primary">{(currentMonth.progress * 100).toFixed(0)}%</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {formatBRL(currentMonth.total)} de {formatBRL(currentMonth.planned)}
              </p>
            </div>
            <div className="text-right">
              {currentMonth.planned - currentMonth.total > 0 && (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Faltam <span className="font-semibold text-foreground">{formatBRL(currentMonth.planned - currentMonth.total)}</span>
                </p>
              )}
            </div>
          </div>
          <Progress value={currentMonth.progress * 100} className="h-2.5 rounded-full mb-4" />
          <Button className="w-full h-12 font-semibold text-sm touch-target" onClick={onOpenQuickDeposit}>
            <DollarSign className="w-4 h-4 mr-2" /> Registrar aporte
          </Button>
        </Card>

        {/* ── 2. Patrimônio investido ── */}
        <Card className="glass-card p-4 lg:p-6 cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all flex flex-col justify-between" onClick={() => onNavigateToTab("patrimonio")}>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total investido</p>
                  <p className="text-lg lg:text-2xl font-extrabold text-gradient">{formatBRLCompact(diag.investedWealth)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs sm:text-sm font-semibold text-foreground">{progressPct.toFixed(1)}%</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">da meta</p>
              </div>
            </div>
            <Progress value={progressPct} className="h-1.5 rounded-full mt-3" />
          </div>
          {diag.monthsToMillion && (
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-3">
              No ritmo atual, {isCouple ? "vocês chegam" : "você chega"} em {formatBRLCompact(config.targetAmount)} em ~{Math.ceil(diag.monthsToMillion / 12)} anos
            </p>
          )}
        </Card>
      </div>

      {/* ── Desktop: Two-column action cards ── */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-5 lg:space-y-0">
        {/* ── 3. Próximo melhor passo ── */}
        {nextStep && (
          <Card className="action-card animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-primary font-bold uppercase tracking-wider mb-0.5">Próximo passo</p>
                <p className="text-sm lg:text-base font-semibold leading-snug">{nextStep.title}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">{nextStep.description}</p>
              </div>
            </div>
          </Card>
        )}

        {/* ── 4. Principal gargalo ── */}
        <Card className="alert-card animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-warning font-bold uppercase tracking-wider mb-0.5">Maior obstáculo agora</p>
              <p className="text-sm lg:text-base leading-snug">{diag.biggestBottleneck}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 5. Risco invisível ── */}
      {invisibleRisk && (
        <Card className="glass-card p-4 lg:p-5 border-destructive/20 animate-fade-in-up" style={{ animationDelay: "0.18s" }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-destructive font-bold uppercase tracking-wider mb-0.5">Risco invisível</p>
              <p className="text-sm lg:text-base font-medium">{invisibleRisk.risk}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{invisibleRisk.explanation}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── 5b. Structural Alert ── */}
      {structuralAlerts.length > 0 && !invisibleRisk && (
        <Card className="glass-card p-4 lg:p-5 border-primary/20 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-primary font-bold uppercase tracking-wider mb-0.5">Estrutura do Patrimônio</p>
              <p className="text-sm lg:text-base font-medium">{nextBestAction.action}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{nextBestAction.reason}</p>
              <Button variant="link" size="sm" className="px-0 h-auto text-xs text-primary mt-1" onClick={() => onNavigateToTab("estrutura")}>
                Ver arquitetura completa →
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── 6. Indicadores rápidos ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
        <IndicatorCard icon="💪" label="Saúde financeira" value={`${score.total}`} sub={scoreLabel} valueColor={scoreColor}
          onClick={() => onNavigateToTab("diagnostico")} />
        <IndicatorCard icon="🛡️" label="Reserva" value={`${diag.emergencyMonths.toFixed(1)}m`}
          sub={diag.emergencyMonths >= 6 ? "Segura" : diag.emergencyMonths >= 3 ? "Em construção" : "Insuficiente"}
          valueColor={diag.emergencyMonths >= 6 ? "text-primary" : diag.emergencyMonths >= 3 ? "text-warning" : "text-destructive"} />
        <IndicatorCard icon="📈" label="Poupança" value={totalIncome > 0 ? `${(diag.savingsRate * 100).toFixed(0)}%` : "—"}
          sub={diag.savingsRate >= 0.2 ? "Excelente" : diag.savingsRate >= 0.1 ? "Bom começo" : "Pode melhorar"}
          valueColor={diag.savingsRate >= 0.2 ? "text-primary" : diag.savingsRate >= 0.1 ? "text-warning" : "text-destructive"} />
        <IndicatorCard icon="🏛️" label="Proteção" value={`${(portfolioSecurity.protectedPercentage * 100).toFixed(0)}%`}
          sub={portfolioSecurity.overallStatus === "strong" ? "Sólida" : portfolioSecurity.overallStatus === "moderate" ? "Moderada" : "Frágil"}
          valueColor={portfolioSecurity.overallStatus === "strong" ? "text-primary" : portfolioSecurity.overallStatus === "moderate" ? "text-warning" : "text-destructive"}
          onClick={() => onNavigateToTab("estrutura")} />
      </div>

      {/* ── Activation checklist (if not all done) ── */}
      {!allStepsComplete && (
        <Card className="glass-card p-4 lg:p-5 animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Primeiros passos</p>
            <span className="text-xs text-muted-foreground">{completedSteps}/{activationSteps.length}</span>
          </div>
          <Progress value={(completedSteps / activationSteps.length) * 100} className="h-1.5 mb-3" />
          <div className="space-y-2">
            {activationSteps.map(step => (
              <button
                key={step.id}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all touch-target ${
                  step.done ? "opacity-60" : "hover:bg-muted/30 cursor-pointer"
                }`}
                onClick={() => {
                  if (!step.done && step.tab) onNavigateToTab(step.tab);
                  if (!step.done && !step.tab) onOpenQuickDeposit();
                }}
                disabled={step.done}
              >
                {step.done ? (
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <span className="text-lg shrink-0">{step.emoji}</span>
                )}
                <span className={`text-sm ${step.done ? "line-through text-muted-foreground" : "font-medium"}`}>
                  {step.label}
                </span>
                {!step.done && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ── Resumo financeiro (colapsável) ── */}
      {(totalIncome > 0 || totalExpenses > 0) && (
        <Card className="glass-card overflow-hidden">
          <button className="w-full p-4 lg:p-5 flex items-center justify-between touch-target"
            onClick={() => setShowFinancials(!showFinancials)}>
            <div className="flex items-center gap-2.5">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm lg:text-base font-semibold">Resumo do mês</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm lg:text-base font-bold ${balance >= 0 ? "text-primary" : "text-destructive"}`}>
                {balance >= 0 ? "+" : ""}{formatBRLCompact(balance)}
              </span>
              {showFinancials ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>
          {showFinancials && (
            <div className="px-4 lg:px-5 pb-4 lg:pb-5 space-y-2 animate-fade-in-up">
              <div className="flex justify-between text-sm lg:text-base">
                <span className="text-muted-foreground">O que entra</span>
                <span className="font-semibold text-primary">{formatBRL(totalIncome)}</span>
              </div>
              <div className="flex justify-between text-sm lg:text-base">
                <span className="text-muted-foreground">O que sai (gastos)</span>
                <span className="font-semibold">{formatBRL(totalExpenses)}</span>
              </div>
              {totalDebtPayments > 0 && (
                <div className="flex justify-between text-sm lg:text-base">
                  <span className="text-muted-foreground">O que sai (dívidas)</span>
                  <span className="font-semibold text-destructive">{formatBRL(totalDebtPayments)}</span>
                </div>
              )}
              <div className="h-px bg-border/60 my-1" />
              <div className="flex justify-between text-sm lg:text-base font-bold">
                <span>Sobra para investir</span>
                <span className={balance >= 0 ? "text-primary" : "text-destructive"}>{formatBRL(balance)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" size="sm" className="text-xs h-10 rounded-xl touch-target" onClick={() => onNavigateToTab("renda")}>
                  Ver renda
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-10 rounded-xl touch-target" onClick={() => onNavigateToTab("gastos")}>
                  Ver gastos
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Insight comportamental ── */}
      {topNudge && (
        <Card className="glass-card p-4 lg:p-5 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0">{topNudge.icon}</span>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                {topNudge.type === "praise" ? "Bom trabalho" : topNudge.type === "warning" ? "Ponto de atenção" : "Dica prática"}
              </p>
              <p className="text-sm lg:text-base leading-relaxed">{topNudge.message}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Educação contextual ── */}
      <ContextualEducation appData={appData} config={config} monthRecords={monthRecords} startDate={startDate} context="home" maxSuggestions={1} />

      {/* ── Atalhos ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Button variant="outline" size="sm" className="h-11 text-xs lg:text-sm justify-between rounded-xl px-4 touch-target"
          onClick={() => onNavigateToTab("simulador")}>
          <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Simular cenários</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="h-11 text-xs lg:text-sm justify-between rounded-xl px-4 touch-target"
          onClick={() => onNavigateToTab("armadilhas")}>
          <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> Radar de riscos</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="h-11 text-xs lg:text-sm justify-between rounded-xl px-4 touch-target"
          onClick={() => onNavigateToTab("estrutura")}>
          <span className="flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Arquitetura</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="h-11 text-xs lg:text-sm justify-between rounded-xl px-4 touch-target"
          onClick={() => onNavigateToTab("jornada")}>
          <span className="flex items-center gap-2"><Target className="w-4 h-4" /> Sua jornada</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ── Indicator Card ── */
function IndicatorCard({ icon, label, value, sub, valueColor, onClick }: {
  icon: string; label: string; value: string; sub: string; valueColor: string; onClick?: () => void;
}) {
  return (
    <Card
      className={`glass-card p-3.5 lg:p-5 text-center ${onClick ? "cursor-pointer hover:ring-1 hover:ring-primary/20 active:scale-[0.97]" : ""} transition-all`}
      onClick={onClick}
    >
      <p className="text-sm lg:text-base mb-1">{icon}</p>
      <p className={`text-lg lg:text-xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mt-0.5">{label}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{sub}</p>
    </Card>
  );
}

/* ── Empty Home State ── */
function EmptyHomeState({ onNavigateToTab, onOpenQuickDeposit, activationSteps }: {
  onNavigateToTab: (tab: string) => void; onOpenQuickDeposit: () => void;
  activationSteps: ReturnType<typeof getActivationSteps>;
}) {
  const completedSteps = activationSteps.filter(s => s.done).length;

  return (
    <div className="space-y-5 lg:space-y-6 pb-4">
      <Card className="glass-card-hero p-6 lg:p-8 text-center space-y-4 animate-fade-in-up lg:max-w-xl lg:mx-auto">
        <p className="text-4xl lg:text-5xl">🚀</p>
        <div>
          <p className="text-lg lg:text-xl font-bold">Tudo pronto para começar!</p>
          <p className="text-sm lg:text-base text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
            Complete os passos abaixo para desbloquear seu primeiro diagnóstico financeiro.
          </p>
        </div>
        <Progress value={(completedSteps / activationSteps.length) * 100} className="h-2 max-w-xs mx-auto" />
        <p className="text-xs text-muted-foreground">{completedSteps} de {activationSteps.length} passos completos</p>
      </Card>

      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {activationSteps.map(step => (
          <Card
            key={step.id}
            className={`glass-card p-4 lg:p-5 cursor-pointer hover:ring-1 hover:ring-primary/20 active:scale-[0.98] transition-all touch-target ${step.done ? "opacity-60" : ""}`}
            onClick={() => {
              if (step.tab) onNavigateToTab(step.tab);
              else onOpenQuickDeposit();
            }}
          >
            <div className="flex items-center gap-3">
              {step.done ? (
                <CheckCircle className="w-6 h-6 text-primary shrink-0" />
              ) : (
                <span className="text-2xl shrink-0">{step.emoji}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm lg:text-base font-semibold ${step.done ? "line-through" : ""}`}>{step.label}</p>
              </div>
              {!step.done && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
