import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact, getCurrentMonthKey, monthKeyToFullLabel } from "@/lib/types";
import { getCurrentMonthDeposited } from "@/lib/calculator";
import { generateNudges } from "@/lib/behavioralEngine";
import { ContextualEducation } from "./ContextualEducation";
import type { FinancialCoreState } from "@/hooks/useFinancialCore";
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
  core: FinancialCoreState;
  /** Slot opcional renderizado no topo da Home (ex.: PlanModeChip). */
  topSlot?: React.ReactNode;
}

function getActivationSteps(appData: AppData, config: PlanConfig, monthRecords: MonthRecord[]) {
  const hasIncome = appData.incomes.length > 0;
  const hasExpenses = appData.expenses.length > 0;
  const hasAporte = monthRecords.some(m => m.deposits.some(d => d.actualSelic > 0 || d.actualCDB > 0));
  const hasMonthlyGoal = config.contributors.some(c => c.plannedSelic > 0 || c.plannedCDB > 0);

  return [
    { id: "cashflow", label: "Configure sua renda e gastos", description: "Mostra quanto sobra para investir com segurança.", done: hasIncome && hasExpenses, tab: hasIncome ? "gastos" : "renda", emoji: "💵" },
    { id: "goal", label: "Revise sua meta mensal", description: "A meta mensal é o valor planejado para aportar todo mês.", done: hasMonthlyGoal, tab: "simulador", emoji: "🎯" },
    { id: "aporte", label: "Registre seu primeiro aporte", description: "Aporte é o dinheiro que você separou para investir.", done: hasAporte, tab: "", emoji: "💰" },
  ];
}

export function UnifiedHome({ appData, config, monthRecords, startDate, onNavigateToTab, onOpenQuickDeposit, core, topSlot }: Props) {
  const currentKey = getCurrentMonthKey();
  const [showFinancials, setShowFinancials] = useState(false);
  const [titularFilter, setTitularFilter] = useState<string>("all");
  const { metrics, insights, allocation, projection } = core;

  const currentMonth = useMemo(() => getCurrentMonthDeposited(config, monthRecords), [config, monthRecords]);
  const nudges = useMemo(() => generateNudges(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);

  const progressPct = Math.min(100, (metrics.grossWealth / config.targetAmount) * 100);
  const topNudge = nudges[0] || null;
  const nextBestAction = insights.nextBestAction;
  const biggestBottleneck = insights.biggestBottleneck;

  const scoreColor = core.metrics.streak >= 3 ? "text-primary" : metrics.savingsRate >= 0.1 ? "text-warning" : "text-destructive";

  // Health score from allocation structural score
  const healthScore = allocation.structuralScore;
  const healthLabel = healthScore >= 70 ? "Saudável" : healthScore >= 40 ? "Atenção" : "Crítico";
  const healthColor = healthScore >= 70 ? "text-primary" : healthScore >= 40 ? "text-warning" : "text-destructive";

  const activationSteps = useMemo(() => getActivationSteps(appData, config, monthRecords), [appData, config, monthRecords]);
  const completedSteps = activationSteps.filter(s => s.done).length;
  const allStepsComplete = completedSteps === activationSteps.length;

  // Invisible risk from insights
  const riskInsight = insights.biggestRisk;
  const invisibleRisk = riskInsight && riskInsight.severity === "critical"
    ? { risk: riskInsight.title, explanation: riskInsight.message }
    : null;

  const balance = metrics.totalIncome - metrics.totalExpenses - metrics.totalDebtPayment;
  const isCouple = metrics.isCouple;

  // Time to target
  const monthsToTarget = projection.monthsToTargetNominal;

  // Empty state
  if (metrics.totalIncome === 0 && metrics.totalExpenses === 0 && metrics.grossWealth === 0) {
    return <EmptyHomeState onNavigateToTab={onNavigateToTab} onOpenQuickDeposit={onOpenQuickDeposit} activationSteps={activationSteps} />;
  }

  return (
    <div className="space-y-5 lg:space-y-6 pb-4">
      {topSlot && <div className="animate-fade-in-up">{topSlot}</div>}
      {/* ── Desktop: Two-column hero layout ── */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-5 lg:space-y-0">
        {/* ── 1. CARD HERO: Meta do mês ── */}
        <Card className="glass-card-hero p-5 lg:p-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs sm:text-sm text-muted-foreground">{monthKeyToFullLabel(currentKey)}</p>
            {metrics.streak > 0 && (
              <span className="text-xs font-medium text-primary">🔥 {metrics.streak} {metrics.streak === 1 ? "mês seguido" : "meses seguidos"}</span>
            )}
          </div>
          <p className="section-title lg:text-lg mb-1">Aporte do mês</p>
          <p className="text-xs sm:text-sm text-muted-foreground mb-3">
            Este é o dinheiro que {isCouple ? "vocês reservaram" : "você reservou"} para investir neste mês.
          </p>
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
          <Button className="w-full h-12 font-bold text-sm touch-target shadow-lg shadow-primary/20" onClick={onOpenQuickDeposit}>
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
                  <p className="text-xs sm:text-sm text-muted-foreground">Patrimônio atual</p>
                  <p className="text-lg lg:text-2xl font-extrabold text-gradient">{formatBRLCompact(metrics.grossWealth)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs sm:text-sm font-semibold text-foreground">{progressPct.toFixed(1)}%</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">da meta</p>
              </div>
            </div>
            <Progress value={progressPct} className="h-1.5 rounded-full mt-3" />
          </div>
          {monthsToTarget && (
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-3">
              Patrimônio é tudo que já foi acumulado. A projeção estima o caminho se o ritmo atual continuar.
            </p>
          )}
        </Card>
      </div>

      {/* ── 2. Next action made explicit ── */}
      <Card className="action-card animate-fade-in-up" style={{ animationDelay: "0.08s" }}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-primary font-bold uppercase tracking-wider mb-0.5">Faça agora</p>
            <p className="text-sm lg:text-base font-semibold leading-snug">
              {nextBestAction?.title || "Registre o aporte deste mês"}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              {nextBestAction?.message || "Isso mantém seu histórico atualizado e mostra se a meta mensal está no caminho certo."}
            </p>
          </div>
          <Button size="sm" className="hidden sm:inline-flex shrink-0" onClick={onOpenQuickDeposit}>
            Registrar aporte
          </Button>
        </div>
      </Card>

      {/* ── Desktop: Two-column action cards ── */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-5 lg:space-y-0">
        {/* ── 3. Próximo melhor passo ── */}
        {false && nextBestAction && (
          <Card className="action-card animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-primary font-bold uppercase tracking-wider mb-0.5">Próximo passo</p>
                <p className="text-sm lg:text-base font-semibold leading-snug">{nextBestAction.title}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">{nextBestAction.message}</p>
              </div>
            </div>
          </Card>
        )}

        {/* ── 4. Principal gargalo ── */}
        {biggestBottleneck && (
          <Card className="alert-card animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-warning font-bold uppercase tracking-wider mb-0.5">Maior obstáculo agora</p>
                <p className="text-sm lg:text-base leading-snug">{biggestBottleneck.title}</p>
              </div>
            </div>
          </Card>
        )}
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

      {/* ── 6. Indicadores rápidos ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
        <IndicatorCard icon="💪" label="Estrutura" value={`${healthScore}`} sub={`Organização geral: ${healthLabel.toLowerCase()}`} valueColor={healthColor}
          onClick={() => onNavigateToTab("diagnostico")} />
        <IndicatorCard icon="🛡️" label="Reserva" value={`${metrics.reserveMonths.toFixed(1)}m`}
          sub={metrics.reserveStatus === "complete" ? "Meses protegidos" : metrics.reserveStatus === "partial" ? "Proteção em construção" : "Falta proteção"}
          valueColor={metrics.reserveStatus === "complete" ? "text-primary" : metrics.reserveStatus === "partial" ? "text-warning" : "text-destructive"} />
        <IndicatorCard icon="📈" label="Poupança" value={metrics.totalIncome > 0 ? `${(metrics.savingsRate * 100).toFixed(0)}%` : "—"}
          sub={metrics.savingsRate >= 0.2 ? "Sobra para investir" : metrics.savingsRate >= 0.1 ? "Bom começo" : "Ajustar gastos"}
          valueColor={metrics.savingsRate >= 0.2 ? "text-primary" : metrics.savingsRate >= 0.1 ? "text-warning" : "text-destructive"} />
        <IndicatorCard icon="🏛️" label="Proteção" value={`${(metrics.protectedRatio * 100).toFixed(0)}%`}
          sub={metrics.protectedRatio >= 0.6 ? "Bem distribuído" : metrics.protectedRatio >= 0.3 ? "Revisar concentração" : "Risco concentrado"}
          valueColor={metrics.protectedRatio >= 0.6 ? "text-primary" : metrics.protectedRatio >= 0.3 ? "text-warning" : "text-destructive"}
          onClick={() => onNavigateToTab("estrutura")} />
      </div>

      {/* ── Resumo de ativos cadastrados ── */}
      {(() => {
        const activeInvestments = appData.investments.filter(i => i.active);
        if (activeInvestments.length === 0) return null;

        const isCoupleActive = appData.mode === "casal" && appData.partner && !appData.partner.removedAt;
        const primaryId = appData.primaryProfile.id;
        const partnerId = appData.partner?.profile.id;
        const primaryName = appData.primaryProfile.name?.trim() || "Você";
        const partnerName = appData.partner?.profile.name?.trim() || "Parceiro(a)";

        const filtered = isCoupleActive && titularFilter !== "all"
          ? activeInvestments.filter(i => (i.titular || i.profileId) === titularFilter)
          : activeInvestments;

        const totalFiltered = filtered.reduce((s, i) => s + (i.currentBalance || 0), 0);
        const bucketMap = new Map<string, { label: string; amount: number }>();
        filtered.forEach(inv => {
          const id = inv.bucket || "crescimento";
          const existing = bucketMap.get(id);
          const label = allocation.buckets.find(b => b.id === id)?.label || id;
          bucketMap.set(id, { label, amount: (existing?.amount || 0) + (inv.currentBalance || 0) });
        });
        const bucketsToShow = Array.from(bucketMap.entries())
          .map(([id, v]) => ({ id, label: v.label, amount: v.amount, percentage: totalFiltered > 0 ? v.amount / totalFiltered : 0 }))
          .filter(b => b.amount > 0)
          .sort((a, b) => b.amount - a.amount);

        return (
          <Card className="glass-card p-4 lg:p-5 animate-fade-in-up">
            <div
              className="flex items-center justify-between mb-3 cursor-pointer"
              onClick={() => onNavigateToTab("patrimonio")}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold">Seu patrimônio</p>
                  <p className="text-sm lg:text-base font-semibold">
                    {filtered.length} {filtered.length === 1 ? "ativo" : "ativos"} · {formatBRLCompact(totalFiltered)}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>

            {isCoupleActive && (
              <div className="flex gap-1.5 mb-3" onClick={(e) => e.stopPropagation()}>
                {[
                  { id: "all", label: "Todos" },
                  { id: primaryId, label: primaryName },
                  ...(partnerId ? [{ id: partnerId, label: partnerName }] : []),
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setTitularFilter(opt.id)}
                    className={`flex-1 text-[11px] px-2 py-1.5 rounded-lg font-medium transition-colors ${
                      titularFilter === opt.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {bucketsToShow.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Sem ativos para este titular</p>
            ) : (
              <div className="space-y-2">
                {bucketsToShow.map(bucket => (
                  <div key={bucket.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate">{bucket.label}</span>
                      <span className="font-medium shrink-0 ml-2">
                        {formatBRLCompact(bucket.amount)} <span className="text-muted-foreground">({(bucket.percentage * 100).toFixed(0)}%)</span>
                      </span>
                    </div>
                    <Progress value={bucket.percentage * 100} className="h-1.5 rounded-full" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })()}

      {/* ── Activation checklist ── */}
      {!allStepsComplete && (
        <Card className="glass-card p-4 lg:p-5 animate-fade-in-up">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold">Comece por aqui</p>
              <p className="text-xs text-muted-foreground mt-0.5">Três ações simples para deixar o plano útil no dia a dia.</p>
            </div>
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
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${step.done ? "line-through text-muted-foreground" : "font-medium"}`}>
                    {step.label}
                  </span>
                  <span className="block text-xs text-muted-foreground leading-relaxed mt-0.5">{step.description}</span>
                </span>
                {!step.done && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ── Resumo financeiro (colapsável) ── */}
      {(metrics.totalIncome > 0 || metrics.totalExpenses > 0) && (
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
                <span className="font-semibold text-primary">{formatBRL(metrics.totalIncome)}</span>
              </div>
              <div className="flex justify-between text-sm lg:text-base">
                <span className="text-muted-foreground">O que sai (gastos)</span>
                <span className="font-semibold">{formatBRL(metrics.totalExpenses)}</span>
              </div>
              {metrics.totalDebtPayment > 0 && (
                <div className="flex justify-between text-sm lg:text-base">
                  <span className="text-muted-foreground">O que sai (dívidas)</span>
                  <span className="font-semibold text-destructive">{formatBRL(metrics.totalDebtPayment)}</span>
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
      <div className="pt-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Explorar quando quiser</p>
        <p className="text-xs text-muted-foreground mb-3">Áreas avançadas para entender riscos, concentração e cenários sem atrapalhar a ação principal.</p>
      </div>
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
