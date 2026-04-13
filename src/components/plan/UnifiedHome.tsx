import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact, getCurrentMonthKey, monthKeyToFullLabel } from "@/lib/types";
import { calculateHealthScore, calculateDiagnostic, detectCurrentPhase, JOURNEY_PHASES } from "@/lib/financialEngine";
import { calculateStreak, getCurrentMonthDeposited } from "@/lib/calculator";
import { generateMentorRecommendations } from "@/lib/behavioralEngine";
import { EducationalTooltip } from "./EducationalTooltip";
import {
  DollarSign, Target, Shield, TrendingUp,
  Zap, AlertTriangle, Lightbulb, ArrowRight,
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

  const progressPct = Math.min(100, (diag.investedWealth / config.targetAmount) * 100);
  const scoreColor = score.total >= 70 ? "text-primary" : score.total >= 40 ? "text-warning" : "text-destructive";
  const nextStep = recs[0] || null;

  return (
    <div className="space-y-4 pb-4">
      {/* ── BLOCO 1: Progresso rumo à meta ── */}
      <Card className="glass-card-strong p-5">
        <div className="flex items-center justify-between mb-3">
          <EducationalTooltip tipKey="patrimonio-investido">
            <span className="section-label">Patrimônio investido</span>
          </EducationalTooltip>
          {diag.monthsToMillion && (
            <span className="text-[11px] text-muted-foreground">
              ~{Math.ceil(diag.monthsToMillion / 12)} anos restantes
            </span>
          )}
        </div>
        <p className="text-3xl font-extrabold text-gradient mb-3">{formatBRLCompact(diag.investedWealth)}</p>
        <Progress value={progressPct} className="h-2.5 rounded-full" />
        <p className="text-xs text-muted-foreground mt-2">
          {progressPct.toFixed(1)}% da meta de {formatBRLCompact(config.targetAmount)}
        </p>
      </Card>

      {/* ── BLOCO 2: Meta do mês + ação ── */}
      <Card className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-muted-foreground">{monthKeyToFullLabel(currentKey)}</p>
            <p className="text-sm font-semibold mt-0.5">Aportes do mês</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{(currentMonth.progress * 100).toFixed(0)}%</p>
            {streak > 0 && (
              <p className="text-[10px] text-muted-foreground">🔥 {streak} {streak === 1 ? "mês" : "meses"}</p>
            )}
          </div>
        </div>
        <Progress value={currentMonth.progress * 100} className="h-2 rounded-full mb-2" />
        <p className="text-xs text-muted-foreground mb-3">
          {formatBRL(currentMonth.total)} de {formatBRL(currentMonth.planned)}
        </p>
        <Button className="w-full h-11 font-semibold" onClick={onOpenQuickDeposit}>
          <DollarSign className="w-4 h-4 mr-1.5" /> Registrar aporte
        </Button>
      </Card>

      {/* ── BLOCO 3: Próximo melhor passo ── */}
      {nextStep && (
        <Card className="glass-card p-4 border-l-4 border-l-primary">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] text-primary font-bold uppercase mb-0.5">Próximo passo</p>
              <p className="text-sm font-semibold">{nextStep.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{nextStep.description}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── BLOCO 4: Indicadores rápidos ── */}
      <div className="grid grid-cols-3 gap-2">
        <IndicatorCard
          label="Saúde"
          value={`${score.total}`}
          valueColor={scoreColor}
          sub={phaseInfo.emoji}
          onClick={() => onNavigateToTab("diagnostico")}
        />
        <IndicatorCard
          label="Reserva"
          value={`${diag.emergencyMonths.toFixed(1)}m`}
          valueColor={diag.emergencyMonths >= 6 ? "text-primary" : diag.emergencyMonths >= 3 ? "text-warning" : "text-destructive"}
          sub={diag.emergencyMonths >= 6 ? "✓" : ""}
        />
        <IndicatorCard
          label="Poupança"
          value={totalIncome > 0 ? `${(diag.savingsRate * 100).toFixed(0)}%` : "—"}
          valueColor={diag.savingsRate >= 0.2 ? "text-primary" : diag.savingsRate >= 0.1 ? "text-warning" : "text-destructive"}
        />
      </div>

      {/* ── BLOCO 5: Alerta principal ── */}
      <Card className="glass-card p-4">
        <div className="flex items-start gap-2.5 mb-3">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="section-label mb-0.5">O que mais atrapalha</p>
            <p className="text-sm">{diag.biggestBottleneck}</p>
          </div>
        </div>
        <div className="h-px bg-border/40 my-2" />
        <div className="flex items-start gap-2.5">
          <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="section-label mb-0.5">Maior oportunidade</p>
            <p className="text-sm">{diag.biggestOpportunity}</p>
          </div>
        </div>
      </Card>

      {/* ── Resumo financeiro do mês ── */}
      {(totalIncome > 0 || totalExpenses > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Receita" value={formatBRLCompact(totalIncome)} color="text-primary" />
          <MiniStat label="Gastos" value={formatBRLCompact(totalExpenses)} color="text-foreground" />
          <MiniStat label="Saldo" value={formatBRLCompact(balance)} color={balance >= 0 ? "text-primary" : "text-destructive"} />
        </div>
      )}

      {/* ── Recomendações adicionais do mentor ── */}
      {recs.length > 1 && (
        <Card className="glass-card p-4">
          <p className="section-label mb-3">Seu mentor sugere</p>
          <div className="space-y-2.5">
            {recs.slice(1, 4).map((rec, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40">
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

      {/* ── Estado vazio ── */}
      {totalIncome === 0 && monthExpenses.length === 0 && (
        <Card className="glass-card p-6 text-center space-y-3">
          <p className="text-3xl">📊</p>
          <p className="text-sm font-semibold">Comece registrando seus aportes</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Use o botão "Registrar aporte" acima para começar. Quanto mais dados você cadastrar, mais inteligente o app fica.
          </p>
        </Card>
      )}

      {/* ── Atalhos ── */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="h-10 text-xs justify-between rounded-xl px-3"
          onClick={() => onNavigateToTab("simulador")}>
          <span className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Simulador
          </span>
          <ArrowRight className="w-3 h-3" />
        </Button>
        <Button variant="outline" size="sm" className="h-10 text-xs justify-between rounded-xl px-3"
          onClick={() => onNavigateToTab("armadilhas")}>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Armadilhas
          </span>
          <ArrowRight className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function IndicatorCard({ label, value, valueColor, sub, onClick }: {
  label: string; value: string; valueColor: string; sub?: string; onClick?: () => void;
}) {
  return (
    <Card className={`glass-card p-3 text-center ${onClick ? "cursor-pointer active:scale-[0.97]" : ""} transition-transform`}
      onClick={onClick}>
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{label}</p>
      {sub && <p className="text-xs mt-0.5">{sub}</p>}
    </Card>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="glass-card p-2.5 text-center">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
    </Card>
  );
}
