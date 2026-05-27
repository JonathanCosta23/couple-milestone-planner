import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact, getCurrentMonthKey, monthKeyToFullLabel, MILESTONES } from "@/lib/types";
import { getCurrentMonthDeposited } from "@/lib/calculator";
import { generateNudges } from "@/lib/behavioralEngine";
import { ContextualEducation } from "./ContextualEducation";
import { MonthlyExecutiveSummary } from "./MonthlyExecutiveSummary";
import { MilestoneProgress } from "./MilestoneProgress";
import type { FinancialCoreState } from "@/hooks/useFinancialCore";
import { findMonthsToCrossing, getRelevantMilestones } from "@/lib/services/monthlySummary";
import {
  DollarSign, Target, TrendingUp, Zap, AlertTriangle, Lightbulb, ArrowRight,
  Wallet, Shield, ChevronDown, ChevronUp, Eye, CheckCircle, Calendar, Settings2, Flame,
  Activity, Landmark, Compass, type LucideIcon,
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
  const hasTrackedMonth = monthRecords.some(m => m.completed || m.deposits.some(d => d.actualSelic > 0 || d.actualCDB > 0));

  return [
    { id: "cashflow", label: "Configure renda e gastos", description: "Para saber quanto sobra sem chute.", done: hasIncome && hasExpenses, tab: hasIncome ? "gastos" : "renda", Icon: Wallet, layer: "essencial" as const },
    { id: "goal", label: "Revise a meta mensal", description: "O valor planejado para investir no mês.", done: hasMonthlyGoal, tab: "simulador", Icon: Target, layer: "essencial" as const },
    { id: "aporte", label: "Registre o primeiro aporte", description: "Aporte é o dinheiro separado para investir.", done: hasAporte, tab: "", Icon: DollarSign, layer: "essencial" as const },
    { id: "tracking", label: "Acompanhe o mês", description: "Compare planejado e realizado sem planilha.", done: hasTrackedMonth, tab: "historico", Icon: Calendar, layer: "essencial" as const },
    { id: "advanced", label: "Explore depois", description: "Simulações, projeções e riscos ficam para a próxima camada.", done: false, tab: "simulador", Icon: Compass, layer: "avançado" as const },
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
  const essentialSteps = activationSteps.filter(s => s.layer === "essencial");
  const completedSteps = essentialSteps.filter(s => s.done).length;
  const allStepsComplete = completedSteps === essentialSteps.length;
  const plannedAmount = currentMonth.planned;
  const realizedAmount = currentMonth.total;
  const remainingAmount = Math.max(0, plannedAmount - realizedAmount);
  const monthProgress = plannedAmount > 0 ? currentMonth.progress : 0;
  const monthStatus = plannedAmount === 0
    ? { label: "Meta mensal pendente", tone: "text-warning", message: "Defina uma meta simples para acompanhar o mês." }
    : remainingAmount <= 0
      ? { label: "Mês no alvo", tone: "text-primary", message: "Você já bateu o planejado. Se quiser, marque o mês como concluído no aporte." }
      : realizedAmount > 0
        ? { label: "Em andamento", tone: "text-warning", message: "Continue registrando os aportes até fechar o mês." }
        : { label: "Aguardando aporte", tone: "text-muted-foreground", message: "Registre o primeiro aporte para atualizar seu tracking mensal." };

  // Invisible risk from insights
  const riskInsight = insights.biggestRisk;
  const invisibleRisk = riskInsight && riskInsight.severity === "critical"
    ? { risk: riskInsight.title, explanation: riskInsight.message }
    : null;

  const balance = metrics.totalIncome - metrics.totalExpenses - metrics.totalDebtPayment;
  const isCouple = metrics.isCouple;

  // Time to target
  const monthsToTarget = projection.monthsToTargetNominal;

  // Próximo marco real (não a meta final) e meses estimados para cruzá-lo
  // usando a série nominal projetada. Sem chumbar monthsToTargetNominal.
  const relevantMilestones = useMemo(
    () => getRelevantMilestones(MILESTONES, config.targetAmount),
    [config.targetAmount],
  );
  const nextMilestoneValue = useMemo(
    () => relevantMilestones.find((m) => metrics.grossWealth < m) ?? null,
    [relevantMilestones, metrics.grossWealth],
  );
  const monthsToNextMilestone = useMemo(
    () => (nextMilestoneValue ? findMonthsToCrossing(projection.nominal, nextMilestoneValue) : null),
    [projection.nominal, nextMilestoneValue],
  );

  // Empty state
  if (metrics.totalIncome === 0 && metrics.totalExpenses === 0 && metrics.grossWealth === 0) {
    return <EmptyHomeState onNavigateToTab={onNavigateToTab} onOpenQuickDeposit={onOpenQuickDeposit} activationSteps={activationSteps} />;
  }

  return (
    <div className="space-y-5 lg:space-y-6 pb-4">
      {topSlot && <div className="animate-fade-in-up">{topSlot}</div>}
      <MonthlyCockpit
        currentKey={currentKey}
        grossWealth={metrics.grossWealth}
        targetAmount={config.targetAmount}
        progressPct={progressPct}
        planned={plannedAmount}
        realized={realizedAmount}
        remaining={remainingAmount}
        monthProgress={monthProgress}
        status={monthStatus}
        streak={metrics.streak}
        completedThisYear={countCompletedMonthsThisYear(monthRecords)}
        isCouple={isCouple}
        perMember={currentMonth.perPerson}
        prescriptiveInsight={buildPrescriptiveInsight({
          planned: plannedAmount,
          realized: realizedAmount,
          remaining: remainingAmount,
          nextBestActionTitle: nextBestAction?.title,
        })}
        onPrimaryAction={onOpenQuickDeposit}
        onSecondaryAction={() => onNavigateToTab("historico")}
        onTertiaryAction={() => onNavigateToTab("simulador")}
        onOpenPatrimonio={() => onNavigateToTab("patrimonio")}
      />

      {/* ── Resumo Mensal Executivo + Próxima Melhor Ação ── */}
      <MonthlyExecutiveSummary
        config={config}
        monthRecords={monthRecords}
        nextActionContext={{
          nextMilestoneValue,
          nextMilestoneMonths: monthsToNextMilestone,
        }}
        onOpenQuickDeposit={onOpenQuickDeposit}
        onNavigateToTab={onNavigateToTab}
      />

      {/* ── Marcos patrimoniais (orientado a progresso) ── */}
      <MilestoneProgress
        currentWealth={metrics.grossWealth}
        targetAmount={config.targetAmount}
        monthsToNextMilestone={monthsToNextMilestone}
        streakMonths={metrics.streak}
      />

      {/* ── Desktop: Two-column action cards ── */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-5 lg:space-y-0">
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
        <IndicatorCard Icon={Activity} label="Estrutura" value={`${healthScore}`} sub={`Organização geral: ${healthLabel.toLowerCase()}`} valueColor={healthColor}
          onClick={() => onNavigateToTab("diagnostico")} />
        <IndicatorCard Icon={Shield} label="Reserva" value={`${metrics.reserveMonths.toFixed(1)}m`}
          sub={metrics.reserveStatus === "complete" ? "Dinheiro para imprevistos" : metrics.reserveStatus === "partial" ? "Proteção em construção" : "Comece pelos imprevistos"}
          valueColor={metrics.reserveStatus === "complete" ? "text-primary" : metrics.reserveStatus === "partial" ? "text-warning" : "text-destructive"} />
        <IndicatorCard Icon={TrendingUp} label="Poupança" value={metrics.totalIncome > 0 ? `${(metrics.savingsRate * 100).toFixed(0)}%` : "—"}
          sub={metrics.savingsRate >= 0.2 ? "Sobra para investir" : metrics.savingsRate >= 0.1 ? "Bom começo" : "Ajustar gastos"}
          valueColor={metrics.savingsRate >= 0.2 ? "text-primary" : metrics.savingsRate >= 0.1 ? "text-warning" : "text-destructive"} />
        <IndicatorCard Icon={Landmark} label="Concentração" value={`${(metrics.protectedRatio * 100).toFixed(0)}%`}
          sub={metrics.protectedRatio >= 0.6 ? "Risco bem dividido" : metrics.protectedRatio >= 0.3 ? "Revisar distribuição" : "Muito concentrado"}
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
              <p className="text-xs text-muted-foreground mt-0.5">Faça o essencial primeiro. O resto pode ficar para depois.</p>
            </div>
            <span className="text-xs text-muted-foreground">{completedSteps}/{essentialSteps.length}</span>
          </div>
          <Progress value={(completedSteps / essentialSteps.length) * 100} className="h-1.5 mb-3" />
          <div className="space-y-2">
            {activationSteps.map(step => (
              <button
                key={step.id}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all touch-target ${
                  step.done ? "opacity-60" : step.layer === "avançado" ? "hover:bg-muted/20 cursor-pointer opacity-80" : "hover:bg-muted/30 cursor-pointer"
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
                  <step.Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${step.done ? "line-through text-muted-foreground" : "font-medium"}`}>
                    {step.label}
                  </span>
                  <span className="block text-xs text-muted-foreground leading-relaxed mt-0.5">{step.description}</span>
                </span>
                {step.layer === "avançado" && <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5 shrink-0">depois</span>}
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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Explorar depois</p>
        <p className="text-xs text-muted-foreground mb-3">Projeção é uma estimativa do futuro. Concentração mostra se o patrimônio está pesado demais em um lugar. Governança ajuda planos de casal.</p>
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

function IndicatorCard({ Icon, label, value, sub, valueColor, onClick }: {
  Icon: LucideIcon; label: string; value: string; sub: string; valueColor: string; onClick?: () => void;
}) {
  return (
    <Card
      className={`glass-card p-3.5 lg:p-5 text-center ${onClick ? "cursor-pointer hover:ring-1 hover:ring-primary/20 active:scale-[0.97]" : ""} transition-all`}
      onClick={onClick}
    >
      <Icon className="w-4 h-4 lg:w-5 lg:h-5 mx-auto mb-1 text-muted-foreground" aria-hidden />
      <p className={`text-lg lg:text-xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mt-0.5">{label}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{sub}</p>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 px-2 py-2 text-center min-w-0">
      <p className="text-xs font-bold truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ============================================================================
// Monthly Execution Cockpit — Home top block
// ============================================================================

interface MonthStatus { label: string; tone: string; message: string }
interface PerMember { name: string; deposited: number; planned: number; pct: number }

function countCompletedMonthsThisYear(records: MonthRecord[]): number {
  const year = new Date().getFullYear();
  return records.filter(r => {
    if (!r.completed) return false;
    const y = parseInt((r.monthKey || "").split("-")[0], 10);
    return y === year;
  }).length;
}

function buildPrescriptiveInsight(args: {
  planned: number; realized: number; remaining: number; nextBestActionTitle?: string;
}): string {
  const { planned, realized, remaining, nextBestActionTitle } = args;
  if (planned <= 0) {
    return "Defina sua meta mensal de aporte para o cockpit começar a acompanhar.";
  }
  if (remaining <= 0) {
    return "Mês no alvo. Marque como concluído no registro de aporte para fechar o ciclo.";
  }
  if (realized <= 0) {
    return `Você ainda não registrou aporte este mês. Prioridade: lançar ${formatBRL(planned)}.`;
  }
  const shortfallPct = Math.round((remaining / planned) * 100);
  return `Você está ${shortfallPct}% abaixo do planejado neste mês. Prioridade: registrar os ${formatBRL(remaining)} restantes.` +
    (nextBestActionTitle ? "" : "");
}

interface MonthlyCockpitProps {
  currentKey: string;
  grossWealth: number;
  targetAmount: number;
  progressPct: number;
  planned: number;
  realized: number;
  remaining: number;
  monthProgress: number;
  status: MonthStatus;
  streak: number;
  completedThisYear: number;
  isCouple: boolean;
  perMember: PerMember[];
  prescriptiveInsight: string;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
  onTertiaryAction: () => void;
  onOpenPatrimonio: () => void;
}

function MonthlyCockpit({
  currentKey, grossWealth, targetAmount, progressPct,
  planned, realized, remaining, monthProgress, status,
  streak, completedThisYear, isCouple, perMember,
  prescriptiveInsight,
  onPrimaryAction, onSecondaryAction, onTertiaryAction, onOpenPatrimonio,
}: MonthlyCockpitProps) {
  const gap = Math.max(0, targetAmount - grossWealth);
  const validMembers = perMember.filter(m => m.name && m.name.trim().length > 0);

  return (
    <Card className="glass-card-hero p-5 lg:p-7 animate-fade-in-up">
      {/* Header: mês corrente + streak/ano */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold">
            Cockpit · {monthKeyToFullLabel(currentKey)}
          </p>
          <p className="text-base lg:text-lg font-semibold mt-0.5">Missão do mês</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {streak > 0 && (
            <div className="flex items-center gap-1 text-xs font-semibold text-primary">
              <Flame className="w-3.5 h-3.5" />
              {streak} {streak === 1 ? "mês" : "meses"}
            </div>
          )}
          <div className="text-xs text-muted-foreground" aria-label="Meses concluídos no ano">
            <Calendar className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            {completedThisYear}/12
          </div>
        </div>
      </div>

      {/* Linha 1: patrimônio + meta + gap */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-5">
        <CockpitMetric
          label="Patrimônio atual"
          value={formatBRLCompact(grossWealth)}
          sub={`${progressPct.toFixed(1)}% da meta`}
          onClick={onOpenPatrimonio}
          accent="text-gradient"
        />
        <CockpitMetric
          label="Meta final"
          value={formatBRLCompact(targetAmount)}
          sub="Objetivo patrimonial"
        />
        <CockpitMetric
          label="Gap até a meta"
          value={formatBRLCompact(gap)}
          sub="Distância restante"
          accent="text-foreground"
        />
      </div>
      <Progress value={progressPct} className="h-1.5 rounded-full mb-6" />

      {/* Linha 2: foco do mês */}
      <div className="flex items-end justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold">Aporte deste mês</p>
          <p className="text-2xl lg:text-3xl font-extrabold text-primary leading-none mt-1">
            {Math.round(monthProgress * 100)}%
          </p>
        </div>
        <div className="text-right">
          <p className={`text-xs sm:text-sm font-semibold ${status.tone}`}>{status.label}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            Falta <span className="font-semibold text-foreground">{formatBRL(remaining)}</span>
          </p>
        </div>
      </div>
      <Progress value={monthProgress * 100} className="h-2.5 rounded-full mb-4" />

      <div className="grid grid-cols-3 gap-2 mb-4">
        <MiniMetric label="Planejado" value={formatBRLCompact(planned)} />
        <MiniMetric label="Realizado" value={formatBRLCompact(realized)} />
        <MiniMetric label="Falta" value={formatBRLCompact(remaining)} />
      </div>

      {/* Per-member apenas em casal */}
      {isCouple && validMembers.length > 1 && (
        <div className="space-y-2 mb-4">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold">
            Progresso por participante
          </p>
          {validMembers.map((m, idx) => (
            <div key={`${m.name}-${idx}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium truncate">{m.name}</span>
                <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                  {formatBRLCompact(m.deposited)} / {formatBRLCompact(m.planned)}
                </span>
              </div>
              <Progress value={m.pct * 100} className="h-1.5 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Insight prescritivo */}
      <div className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2.5 mb-5 flex gap-2.5">
        <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm leading-relaxed">{prescriptiveInsight}</p>
      </div>

      {/* CTAs hierárquicos */}
      <div className="space-y-2">
        <Button
          className="w-full h-12 font-bold text-sm touch-target shadow-lg shadow-primary/20"
          onClick={onPrimaryAction}
        >
          <DollarSign className="w-4 h-4 mr-2" /> Cadastrar aporte agora
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-11 text-xs lg:text-sm rounded-xl touch-target"
            onClick={onSecondaryAction}
          >
            <Calendar className="w-4 h-4 mr-1.5" /> Ver mês atual
          </Button>
          <Button
            variant="ghost"
            className="h-11 text-xs lg:text-sm rounded-xl touch-target"
            onClick={onTertiaryAction}
          >
            <Settings2 className="w-4 h-4 mr-1.5" /> Ajustar plano
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CockpitMetric({ label, value, sub, accent, onClick }: {
  label: string; value: string; sub: string; accent?: string; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl bg-muted/20 px-3 py-2.5 transition-all min-w-0 ${
        onClick ? "hover:bg-muted/30 cursor-pointer" : "cursor-default"
      }`}
      disabled={!onClick}
    >
      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold truncate">{label}</p>
      <p className={`text-base lg:text-xl font-extrabold tabular-nums mt-0.5 truncate ${accent ?? "text-foreground"}`}>{value}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
    </button>
  );
}

function EmptyHomeState({ onNavigateToTab, onOpenQuickDeposit, activationSteps }: {
  onNavigateToTab: (tab: string) => void; onOpenQuickDeposit: () => void;
  activationSteps: ReturnType<typeof getActivationSteps>;
}) {
  const essentialSteps = activationSteps.filter(s => s.layer === "essencial");
  const completedSteps = essentialSteps.filter(s => s.done).length;

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
        <Progress value={(completedSteps / essentialSteps.length) * 100} className="h-2 max-w-xs mx-auto" />
        <p className="text-xs text-muted-foreground">{completedSteps} de {essentialSteps.length} passos essenciais completos</p>
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
                <step.Icon className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
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
