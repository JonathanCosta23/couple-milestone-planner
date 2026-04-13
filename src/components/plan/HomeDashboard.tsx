import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData, EXPENSE_CATEGORY_ICONS, EXPENSE_CATEGORY_LABELS, ExpenseCategory } from "@/lib/models";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact, getCurrentMonthKey, monthKeyToFullLabel } from "@/lib/types";
import { calculateHealthScore, calculateDiagnostic } from "@/lib/financialEngine";
import { calculateStreak, getCurrentMonthDeposited } from "@/lib/calculator";
import {
  Activity, DollarSign, Wallet, CreditCard, AlertTriangle,
  TrendingUp, Shield, Target, CalendarClock, ArrowRight,
} from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  onNavigateToTab: (tab: string) => void;
  onOpenQuickDeposit: () => void;
}

export function HomeDashboard({ appData, config, monthRecords, startDate, onNavigateToTab, onOpenQuickDeposit }: Props) {
  const currentKey = getCurrentMonthKey();
  const score = useMemo(() => calculateHealthScore(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const diag = useMemo(() => calculateDiagnostic(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const currentMonth = useMemo(() => getCurrentMonthDeposited(config, monthRecords), [config, monthRecords]);
  const streak = useMemo(() => calculateStreak(config, monthRecords, startDate), [config, monthRecords, startDate]);

  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const monthExpenses = appData.expenses.filter(e => e.monthKey === currentKey);
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const fixedExpenses = monthExpenses.filter(e => e.type === "fixed").reduce((s, e) => s + e.amount, 0);
  const variableExpenses = monthExpenses.filter(e => e.type === "variable").reduce((s, e) => s + e.amount, 0);
  const totalDebtPayments = appData.debts.filter(d => d.active).reduce((s, d) => s + d.monthlyPayment, 0);
  const balance = totalIncome - totalExpenses - totalDebtPayments;

  const cardExpenses = monthExpenses.filter(e => e.category === "cartao").reduce((s, e) => s + e.amount, 0);

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

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{monthKeyToFullLabel(currentKey)}</p>
        <p className="text-lg font-bold mt-0.5">Visão Geral do Mês</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card className="glass-card p-4 text-center cursor-pointer hover:ring-1 hover:ring-primary/20" onClick={() => onNavigateToTab("diagnostico")}>
          <Activity className={`w-5 h-5 mx-auto mb-1 ${scoreColor}`} />
          <p className={`text-3xl font-extrabold ${scoreColor}`}>{score.total}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Score</p>
        </Card>
        <Card className="glass-card p-4 text-center">
          <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-lg font-extrabold text-gradient">
            {((diag.investedWealth / config.targetAmount) * 100).toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground uppercase">Rumo ao Milhão</p>
          <Progress value={Math.min(100, (diag.investedWealth / config.targetAmount) * 100)} className="h-1 mt-2" />
        </Card>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-3 gap-2 lg:gap-3">
        <StatCard icon={DollarSign} label="Receita" value={formatBRLCompact(totalIncome)} color="text-primary" onClick={() => onNavigateToTab("renda")} />
        <StatCard icon={Wallet} label="Despesas" value={formatBRLCompact(totalExpenses)} color="text-foreground" onClick={() => onNavigateToTab("gastos")} />
        <StatCard icon={TrendingUp} label="Saldo" value={formatBRLCompact(balance)} color={balance >= 0 ? "text-primary" : "text-destructive"} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">
        <MiniCard label="Fixos" value={formatBRLCompact(fixedExpenses)} />
        <MiniCard label="Variáveis" value={formatBRLCompact(variableExpenses)} />
        <MiniCard label="Dívidas" value={formatBRLCompact(totalDebtPayments)} accent={totalDebtPayments > 0 ? "text-destructive" : undefined} />
        <MiniCard label="Cartão" value={formatBRLCompact(cardExpenses)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="glass-card p-3 text-center cursor-pointer hover:ring-1 hover:ring-primary/20" onClick={() => onNavigateToTab("patrimonio")}>
          <p className="text-sm font-bold">{formatBRLCompact(diag.investedWealth)}</p>
          <p className="text-[9px] text-muted-foreground uppercase">Patrimônio Investido</p>
        </Card>
        <Card className="glass-card p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <Shield className={`w-3.5 h-3.5 ${diag.emergencyMonths >= 6 ? "text-primary" : diag.emergencyMonths >= 3 ? "text-warning" : "text-destructive"}`} />
            <p className="text-sm font-bold">{diag.emergencyMonths.toFixed(1)} meses</p>
          </div>
          <p className="text-[9px] text-muted-foreground uppercase">Reserva</p>
        </Card>
      </div>

      {topCategories.length > 0 && (
        <Card className="glass-card p-3">
          <p className="text-xs font-semibold mb-2">Maiores Gastos do Mês</p>
          <div className="space-y-2">
            {topCategories.map(([cat, amount]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span>{EXPENSE_CATEGORY_ICONS[cat as ExpenseCategory]}</span>
                  <span>{EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory]}</span>
                </div>
                <span className="font-semibold">{formatBRL(amount as number)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(upcomingDebts.length > 0 || upcomingExpenses.length > 0) && (
        <Card className="glass-card p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <CalendarClock className="w-4 h-4 text-warning" />
            <p className="text-xs font-semibold">Próximos Vencimentos</p>
          </div>
          <div className="space-y-1.5">
            {upcomingDebts.map(d => (
              <div key={d.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                <span className="truncate">{d.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground">dia {d.dueDay}</span>
                  <span className="font-semibold">{formatBRL(d.monthlyPayment)}</span>
                </div>
              </div>
            ))}
            {upcomingExpenses.map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
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

      <Card className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <div>
              <p className="text-sm font-semibold">Aportes do Mês</p>
              <p className="text-[10px] text-muted-foreground">Sequência: {streak} meses</p>
            </div>
          </div>
          <p className="text-sm font-bold">{(currentMonth.progress * 100).toFixed(0)}%</p>
        </div>
        <Progress value={currentMonth.progress * 100} className="h-2 mb-2" />
        <div className="flex justify-between text-xs text-muted-foreground mb-3">
          <span>{formatBRL(currentMonth.total)} / {formatBRL(currentMonth.planned)}</span>
        </div>
        <Button size="sm" className="w-full" onClick={onOpenQuickDeposit}>
          <DollarSign className="w-4 h-4 mr-1" /> Registrar depósito
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => onNavigateToTab("gastos")}>
          <Wallet className="w-3.5 h-3.5 mr-1.5" /> Gerenciar Gastos <ArrowRight className="w-3 h-3 ml-auto" />
        </Button>
        <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => onNavigateToTab("dividas")}>
          <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Ver Dívidas <ArrowRight className="w-3 h-3 ml-auto" />
        </Button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, onClick }: { icon: React.ElementType; label: string; value: string; color: string; onClick?: () => void }) {
  return (
    <Card className="glass-card p-3 text-center cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={onClick}>
      <Icon className={`w-4 h-4 mx-auto mb-0.5 ${color}`} />
      <p className={`text-sm font-bold truncate ${color}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
    </Card>
  );
}

function MiniCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/30">
      <p className={`text-xs font-bold truncate ${accent || ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
