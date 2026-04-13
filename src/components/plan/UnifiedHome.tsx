import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact, getCurrentMonthKey, monthKeyToFullLabel } from "@/lib/types";
import { calculateHealthScore, calculateDiagnostic } from "@/lib/financialEngine";
import { calculateStreak, getCurrentMonthDeposited } from "@/lib/calculator";
import { generateMentorRecommendations } from "@/lib/behavioralEngine";
import { generateNudges } from "@/lib/behavioralEngine";
import { EducationalTooltip } from "./EducationalTooltip";
import { ContextualEducation } from "./ContextualEducation";
import {
  DollarSign, Target, TrendingUp, Zap, AlertTriangle, Lightbulb, ArrowRight,
  Wallet, Shield, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  onNavigateToTab: (tab: string) => void;
  onOpenQuickDeposit: () => void;
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

  // Empty state
  if (totalIncome === 0 && monthExpenses.length === 0 && diag.investedWealth === 0) {
    return <EmptyHomeState onNavigateToTab={onNavigateToTab} onOpenQuickDeposit={onOpenQuickDeposit} />;
  }

  return (
    <div className="space-y-5 lg:space-y-6 pb-4">
      {/* ── 1. CARD HERO: Meta do mês ── */}
      <Card className="glass-card-hero p-5 lg:p-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">{monthKeyToFullLabel(currentKey)}</p>
          {streak > 0 && (
            <span className="text-xs font-medium text-primary">🔥 {streak} {streak === 1 ? "mês seguido" : "meses seguidos"}</span>
          )}
        </div>
        <p className="section-title mb-1">Meta de aporte do mês</p>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-2xl font-extrabold text-primary">{(currentMonth.progress * 100).toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatBRL(currentMonth.total)} de {formatBRL(currentMonth.planned)}
            </p>
          </div>
          <div className="text-right">
            {currentMonth.planned - currentMonth.total > 0 && (
              <p className="text-xs text-muted-foreground">
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

      {/* ── 2. Patrimônio investido (compacto) ── */}
      <Card className="glass-card p-4 cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => onNavigateToTab("patrimonio")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Patrimônio investido</p>
              <p className="text-lg font-extrabold text-gradient">{formatBRLCompact(diag.investedWealth)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-foreground">{progressPct.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground">da meta</p>
          </div>
        </div>
        <Progress value={progressPct} className="h-1.5 rounded-full mt-3" />
        {diag.monthsToMillion && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Estimativa: ~{Math.ceil(diag.monthsToMillion / 12)} anos para a meta de {formatBRLCompact(config.targetAmount)}
          </p>
        )}
      </Card>

      {/* ── 3. Próximo melhor passo (único, destacado) ── */}
      {nextStep && (
        <Card className="action-card animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-primary font-bold uppercase tracking-wider mb-0.5">Seu próximo passo</p>
              <p className="text-sm font-semibold leading-snug">{nextStep.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{nextStep.description}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── 4. Principal gargalo ── */}
      <Card className="alert-card animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-warning font-bold uppercase tracking-wider mb-0.5">O que mais atrapalha</p>
            <p className="text-sm leading-snug">{diag.biggestBottleneck}</p>
          </div>
        </div>
      </Card>

      {/* ── 5. Indicadores rápidos ── */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-3 gap-3 lg:gap-4">
        <IndicatorCard
          icon="💪"
          label="Saúde"
          value={`${score.total}`}
          sub={scoreLabel}
          valueColor={scoreColor}
          onClick={() => onNavigateToTab("diagnostico")}
        />
        <IndicatorCard
          icon="🛡️"
          label="Reserva"
          value={`${diag.emergencyMonths.toFixed(1)}m`}
          sub={diag.emergencyMonths >= 6 ? "Completa" : diag.emergencyMonths >= 3 ? "Parcial" : "Baixa"}
          valueColor={diag.emergencyMonths >= 6 ? "text-primary" : diag.emergencyMonths >= 3 ? "text-warning" : "text-destructive"}
        />
        <IndicatorCard
          icon="📈"
          label="Poupança"
          value={totalIncome > 0 ? `${(diag.savingsRate * 100).toFixed(0)}%` : "—"}
          sub={diag.savingsRate >= 0.2 ? "Ótimo" : diag.savingsRate >= 0.1 ? "Regular" : "Baixa"}
          valueColor={diag.savingsRate >= 0.2 ? "text-primary" : diag.savingsRate >= 0.1 ? "text-warning" : "text-destructive"}
        />
      </div>

      {/* ── 6. Resumo financeiro (colapsável) ── */}
      {(totalIncome > 0 || totalExpenses > 0) && (
        <Card className="glass-card overflow-hidden">
          <button
            className="w-full p-4 flex items-center justify-between touch-target"
            onClick={() => setShowFinancials(!showFinancials)}
          >
            <div className="flex items-center gap-2.5">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Resumo do mês</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold ${balance >= 0 ? "text-primary" : "text-destructive"}`}>
                {balance >= 0 ? "+" : ""}{formatBRLCompact(balance)}
              </span>
              {showFinancials ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>
          {showFinancials && (
            <div className="px-4 pb-4 space-y-2 animate-fade-in-up">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Receita</span>
                <span className="font-semibold text-primary">{formatBRL(totalIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Despesas</span>
                <span className="font-semibold">{formatBRL(totalExpenses)}</span>
              </div>
              {totalDebtPayments > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dívidas</span>
                  <span className="font-semibold text-destructive">{formatBRL(totalDebtPayments)}</span>
                </div>
              )}
              <div className="h-px bg-border/60 my-1" />
              <div className="flex justify-between text-sm font-bold">
                <span>Saldo disponível</span>
                <span className={balance >= 0 ? "text-primary" : "text-destructive"}>{formatBRL(balance)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" size="sm" className="text-xs h-10 rounded-xl touch-target" onClick={() => onNavigateToTab("renda")}>
                  Gerenciar renda
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-10 rounded-xl touch-target" onClick={() => onNavigateToTab("gastos")}>
                  Ver gastos
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── 7. Insight comportamental contextual (só 1, o mais relevante) ── */}
      {topNudge && (
        <Card className="glass-card p-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0">{topNudge.icon}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                {topNudge.type === "praise" ? "Parabéns" : topNudge.type === "warning" ? "Atenção" : "Dica"}
              </p>
              <p className="text-sm leading-relaxed">{topNudge.message}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── 8. Educação contextual ── */}
      <ContextualEducation
        appData={appData}
        config={config}
        monthRecords={monthRecords}
        startDate={startDate}
        context="home"
        maxSuggestions={1}
      />

      {/* ── 9. Atalhos ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Button variant="outline" size="sm" className="h-11 text-xs justify-between rounded-xl px-4 touch-target"
          onClick={() => onNavigateToTab("simulador")}>
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Simulador
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="h-11 text-xs justify-between rounded-xl px-4 touch-target"
          onClick={() => onNavigateToTab("armadilhas")}>
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> Armadilhas
          </span>
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
      className={`glass-card p-3.5 text-center ${onClick ? "cursor-pointer hover:ring-1 hover:ring-primary/20 active:scale-[0.97]" : ""} transition-all`}
      onClick={onClick}
    >
      <p className="text-sm mb-1">{icon}</p>
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </Card>
  );
}

/* ── Empty Home State ── */
function EmptyHomeState({ onNavigateToTab, onOpenQuickDeposit }: { onNavigateToTab: (tab: string) => void; onOpenQuickDeposit: () => void }) {
  return (
    <div className="space-y-5 pb-4">
      <Card className="glass-card-hero p-6 text-center space-y-4 animate-fade-in-up">
        <p className="text-4xl">🚀</p>
        <div>
          <p className="text-lg font-bold">Tudo pronto para começar!</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
            Registre seu primeiro aporte e veja sua jornada ganhar forma. Cada passo conta.
          </p>
        </div>
        <Button className="w-full h-12 font-semibold text-sm touch-target" onClick={onOpenQuickDeposit}>
          <DollarSign className="w-4 h-4 mr-2" /> Registrar meu primeiro aporte
        </Button>
      </Card>

      <div className="space-y-3">
        <QuickAction
          emoji="💵"
          title="Cadastrar sua renda"
          description="Para calcular quanto você pode investir sem se apertar."
          onClick={() => onNavigateToTab("renda")}
        />
        <QuickAction
          emoji="🛒"
          title="Cadastrar seus gastos"
          description="Para descobrir seu verdadeiro potencial de aporte."
          onClick={() => onNavigateToTab("gastos")}
        />
        <QuickAction
          emoji="📋"
          title="Cadastrar suas dívidas"
          description="Para entender quanto elas atrasam sua meta."
          onClick={() => onNavigateToTab("dividas")}
        />
      </div>
    </div>
  );
}

function QuickAction({ emoji, title, description, onClick }: { emoji: string; title: string; description: string; onClick: () => void }) {
  return (
    <Card className="glass-card p-4 cursor-pointer hover:ring-1 hover:ring-primary/20 active:scale-[0.98] transition-all touch-target" onClick={onClick}>
      <div className="flex items-center gap-3">
        <span className="text-2xl shrink-0">{emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
    </Card>
  );
}
