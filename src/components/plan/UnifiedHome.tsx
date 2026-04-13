import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData, EXPENSE_CATEGORY_ICONS, EXPENSE_CATEGORY_LABELS, ExpenseCategory } from "@/lib/models";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact, getCurrentMonthKey, monthKeyToFullLabel } from "@/lib/types";
import { calculateHealthScore, calculateDiagnostic, detectCurrentPhase, JOURNEY_PHASES } from "@/lib/financialEngine";
import { calculateStreak, getCurrentMonthDeposited } from "@/lib/calculator";
import { generateMentorRecommendations } from "@/lib/behavioralEngine";
import { EducationalTooltip } from "./EducationalTooltip";
import {
  Activity, DollarSign, Wallet, TrendingUp, Shield, Target,
  CalendarClock, ArrowRight, Zap, AlertTriangle, Lightbulb, Sparkles,
} from "lucide-react";

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
  const score = useMemo(() => calculateHealthScore(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const diag = useMemo(() => calculateDiagnostic(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const phase = useMemo(() => detectCurrentPhase(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const phaseInfo = JOURNEY_PHASES.find(p => p.id === phase)!;
  const currentMonth = useMemo(() => getCurrentMonthDeposited(config, monthRecords), [config, monthRecords]);
  const streak = useMemo(() => calculateStreak(config, monthRecords, startDate), [config, monthRecords, startDate]);
  const recs = useMemo(() => generateMentorRecommendations(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);

  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const monthExpenses = appData.expenses.filter(e => e.monthKey === currentKey);
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalDebtPayments = appData.debts.filter(d => d.active).reduce((s, d) => s + d.monthlyPayment, 0);
  const balance = totalIncome - totalExpenses - totalDebtPayments;

  const today = new Date();
  const upcomingDebts = appData.debts
    .filter(d => d.active && d.dueDay >= today.getDate())
    .sort((a, b) => a.dueDay - b.dueDay)
    .slice(0, 3);
  const upcomingExpenses = monthExpenses
    .filter(e => e.status === "pending" && e.dueDate)
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .slice(0, 3);

  const byCategory: Partial<Record<ExpenseCategory, number>> = {};
  monthExpenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
  const topCategories = Object.entries(byCategory).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 4);

  const scoreColor = score.total >= 70 ? "text-primary" : score.total >= 40 ? "text-warning" : "text-destructive";
  const nextStep = recs[0] || null;
  const hasData = totalIncome > 0 || monthExpenses.length > 0;

  return (
    <div className="space-y-4 pb-4">
      {/* ═══ CAMADA 1: O essencial — patrimônio, meta, próximo passo ═══ */}

      {/* Patrimônio investido + progresso */}
      <Card className="glass-card-strong p-5 text-center">
        <EducationalTooltip tipKey="patrimonio-investido">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Patrimônio investido</p>
        </EducationalTooltip>
        <p className="text-3xl font-extrabold text-gradient">{formatBRLCompact(diag.investedWealth)}</p>
        <div className="mt-3">
          <Progress value={Math.min(100, (diag.investedWealth / config.targetAmount) * 100)} className="h-2.5 rounded-full" />
          <p className="text-xs text-muted-foreground mt-1.5">
            {((diag.investedWealth / config.targetAmount) * 100).toFixed(1)}% rumo a {formatBRLCompact(config.targetAmount)}
          </p>
        </div>
        {diag.monthsToMillion && (
          <p className="text-xs text-muted-foreground mt-2">
            Previsão: <strong className="text-foreground">{Math.ceil(diag.monthsToMillion / 12)} anos</strong>
          </p>
        )}
      </Card>

      {/* Score + Fase lado a lado */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card p-4 text-center cursor-pointer hover:ring-1 hover:ring-primary/20 active:scale-[0.98] transition-all"
          onClick={() => onNavigateToTab("diagnostico")}>
          <Activity className={`w-5 h-5 mx-auto mb-1 ${scoreColor}`} />
          <p className={`text-3xl font-extrabold ${scoreColor}`}>{score.total}</p>
          <EducationalTooltip tipKey="score-financeiro">
            <p className="text-[10px] text-muted-foreground uppercase">Saúde financeira</p>
          </EducationalTooltip>
        </Card>
        <Card className="glass-card p-4 text-center cursor-pointer hover:ring-1 hover:ring-primary/20 active:scale-[0.98] transition-all"
          onClick={() => onNavigateToTab("jornada")}>
          <p className="text-2xl mb-1">{phaseInfo.emoji}</p>
          <p className="text-sm font-bold truncate">{phaseInfo.name}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Sua fase atual</p>
        </Card>
      </div>

      {/* Próximo melhor passo (mentor) */}
      {nextStep && (
        <Card className="glass-card p-4 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-primary/10 shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-primary uppercase font-bold mb-0.5">Próximo passo recomendado</p>
              <p className="text-sm font-semibold">{nextStep.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{nextStep.description}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ═══ CAMADA 2: Mês atual — fluxo, aportes, vencimentos ═══ */}

      <div className="pt-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 px-1">
          {monthKeyToFullLabel(currentKey)}
        </p>
      </div>

      {/* Aportes do mês */}
      <Card className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Aportes do mês</p>
              {streak > 0 && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  🔥 {streak} {streak === 1 ? "mês seguido" : "meses seguidos"}
                </p>
              )}
            </div>
          </div>
          <p className="text-sm font-bold text-primary">{(currentMonth.progress * 100).toFixed(0)}%</p>
        </div>
        <Progress value={currentMonth.progress * 100} className="h-2.5 rounded-full mb-2" />
        <div className="flex justify-between text-xs text-muted-foreground mb-3">
          <span>{formatBRL(currentMonth.total)} de {formatBRL(currentMonth.planned)}</span>
        </div>
        <Button size="sm" className="w-full h-10 text-sm font-semibold" onClick={onOpenQuickDeposit}>
          <DollarSign className="w-4 h-4 mr-1.5" /> Registrar aporte
        </Button>
      </Card>

      {/* Resumo financeiro */}
      <div className="grid grid-cols-3 gap-2">
        <QuickStat label="Receita" value={formatBRLCompact(totalIncome)} color="text-primary" onClick={() => onNavigateToTab("renda")} />
        <QuickStat label="Gastos" value={formatBRLCompact(totalExpenses)} color="text-foreground" onClick={() => onNavigateToTab("gastos")} />
        <QuickStat label="Saldo" value={formatBRLCompact(balance)} color={balance >= 0 ? "text-primary" : "text-destructive"} />
      </div>

      {/* Indicadores de proteção */}
      <div className="grid grid-cols-3 gap-2">
        <StatusBadge
          icon={Shield}
          label="Reserva"
          value={`${diag.emergencyMonths.toFixed(1)}m`}
          status={diag.emergencyMonths >= 6 ? "good" : diag.emergencyMonths >= 3 ? "warning" : "danger"}
        />
        <StatusBadge
          icon={AlertTriangle}
          label="Dívidas"
          value={totalDebtPayments > 0 ? formatBRLCompact(totalDebtPayments) : "Nenhuma"}
          status={totalDebtPayments === 0 ? "good" : "warning"}
        />
        <StatusBadge
          icon={TrendingUp}
          label="Poupança"
          value={totalIncome > 0 ? `${(diag.savingsRate * 100).toFixed(0)}%` : "—"}
          status={diag.savingsRate >= 0.2 ? "good" : diag.savingsRate >= 0.1 ? "warning" : "danger"}
        />
      </div>

      {/* Próximos vencimentos */}
      {(upcomingDebts.length > 0 || upcomingExpenses.length > 0) && (
        <Card className="glass-card p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <CalendarClock className="w-4 h-4 text-warning" />
            <p className="text-xs font-semibold">Próximos vencimentos</p>
          </div>
          <div className="space-y-1.5">
            {upcomingDebts.map(d => (
              <div key={d.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                <span className="truncate">{d.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground">dia {d.dueDay}</span>
                  <span className="font-semibold">{formatBRL(d.monthlyPayment)}</span>
                </div>
              </div>
            ))}
            {upcomingExpenses.map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                <span className="truncate">{e.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground">{e.dueDate?.slice(8)}/{e.dueDate?.slice(5, 7)}</span>
                  <span className="font-semibold">{formatBRL(e.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Maiores gastos */}
      {topCategories.length > 0 && (
        <Card className="glass-card p-3">
          <p className="text-xs font-semibold mb-2">Onde mais gastou este mês</p>
          <div className="space-y-2">
            {topCategories.map(([cat, amount]) => {
              const pct = totalExpenses > 0 ? ((amount as number) / totalExpenses) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span>{EXPENSE_CATEGORY_ICONS[cat as ExpenseCategory]}</span>
                      <span>{EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory]}</span>
                    </div>
                    <span className="font-semibold">{formatBRL(amount as number)}</span>
                  </div>
                  <Progress value={pct} className="h-1" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ═══ CAMADA 3: Inteligência — gargalo, oportunidade, mentor ═══ */}

      {/* Gargalo + Oportunidade */}
      <Card className="glass-card p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">O que mais atrapalha</p>
            <p className="text-sm">{diag.biggestBottleneck}</p>
          </div>
        </div>
        <div className="h-px bg-border/50" />
        <div className="flex items-start gap-2.5">
          <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Maior oportunidade</p>
            <p className="text-sm">{diag.biggestOpportunity}</p>
          </div>
        </div>
      </Card>

      {/* Recomendações do mentor (além da primeira) */}
      {recs.length > 1 && (
        <Card className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Seu mentor sugere</p>
          </div>
          <div className="space-y-2">
            {recs.slice(1, 4).map((rec, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30">
                <span className="text-base shrink-0">{rec.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{rec.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Estado vazio educativo */}
      {!hasData && (
        <Card className="glass-card p-6 text-center space-y-3">
          <p className="text-3xl">📊</p>
          <div>
            <p className="text-sm font-semibold">Comece cadastrando suas receitas e gastos</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Quanto mais dados você registrar, mais inteligente o app fica.
              Comece pelo básico: quanto você ganha e quanto gasta por mês.
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" onClick={() => onNavigateToTab("renda")}>
              <DollarSign className="w-3.5 h-3.5 mr-1" /> Adicionar renda
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigateToTab("gastos")}>
              <Wallet className="w-3.5 h-3.5 mr-1" /> Adicionar gastos
            </Button>
          </div>
        </Card>
      )}

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="text-xs h-10 justify-start rounded-xl" onClick={() => onNavigateToTab("gastos")}>
          <Wallet className="w-3.5 h-3.5 mr-1.5" /> Gastos <ArrowRight className="w-3 h-3 ml-auto" />
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-10 justify-start rounded-xl" onClick={() => onNavigateToTab("dividas")}>
          <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Dívidas <ArrowRight className="w-3 h-3 ml-auto" />
        </Button>
      </div>
    </div>
  );
}

function QuickStat({ label, value, color, onClick }: { label: string; value: string; color: string; onClick?: () => void }) {
  return (
    <Card className={`glass-card p-3 text-center ${onClick ? "cursor-pointer hover:ring-1 hover:ring-primary/20 active:scale-[0.98]" : ""} transition-all`} onClick={onClick}>
      <p className={`text-sm font-bold truncate ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
    </Card>
  );
}

function StatusBadge({ icon: Icon, label, value, status }: { icon: React.ElementType; label: string; value: string; status: "good" | "warning" | "danger" }) {
  const styles = {
    good: "text-primary border-primary/20",
    warning: "text-warning border-warning/20",
    danger: "text-destructive border-destructive/20",
  };
  return (
    <Card className={`glass-card p-2.5 text-center border ${styles[status]}`}>
      <Icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${styles[status].split(" ")[0]}`} />
      <p className={`text-xs font-bold ${styles[status].split(" ")[0]}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
    </Card>
  );
}
