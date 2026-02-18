import { useMemo, useState, useEffect } from "react";
import { PlanConfig, MonthRecord, FinancialProfile, EmotionalGoal, EMOTIONAL_GOAL_LABELS, formatBRL, formatBRLCompact, getCurrentMonthKey, monthKeyToFullLabel, MOTIVATIONAL_MESSAGES, MILESTONES, EMPTY_DEPOSIT } from "@/lib/types";
import { generateProjection, calculateStreak, calculateSkipMonthCost, getMissedMonths, calculateDelayMonths, getCurrentMonthDeposited, getContributionTotals, getAgeTimeline, getReachedMilestones, isMonthComplete, getSavingsRate, getFinancialSafetyMonths } from "@/lib/calculator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Target, TrendingUp, AlertTriangle, Heart, Clock,
  DollarSign, Users, CalendarClock, Trophy, Copy, Sparkles, Shield, PieChart,
} from "lucide-react";
import { toast } from "sonner";
import { AchievementTimeline } from "./AchievementTimeline";
import { MonthlyInsights } from "./MonthlyInsights";

interface HomeDashboardProps {
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  onNavigateToTracker: () => void;
  onOpenQuickDeposit: () => void;
  profile?: FinancialProfile;
  emotionalGoal?: EmotionalGoal;
  emotionalGoalCustom?: string;
}

function useAnimatedCounter(target: number, duration: number = 1500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

function StreakDisplay({ streak }: { streak: number }) {
  const flames = Math.min(streak, 5);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1">
        {Array.from({ length: Math.max(1, flames) }).map((_, i) => (
          <span key={i} className="text-lg" style={{ opacity: streak > 0 ? 1 : 0.3 }}>🔥</span>
        ))}
      </div>
      <span className="text-2xl font-bold">{streak}</span>
      <span className="text-xs text-muted-foreground">{streak === 1 ? "mês" : "meses"}</span>
    </div>
  );
}

export function HomeDashboard({ config, monthRecords, startDate, onNavigateToTracker, onOpenQuickDeposit, profile, emotionalGoal, emotionalGoalCustom }: HomeDashboardProps) {
  const currentKey = getCurrentMonthKey();

  const planned = useMemo(() => generateProjection(config, "planned", monthRecords, startDate), [config, monthRecords, startDate]);
  const actual = useMemo(() => generateProjection(config, "actual", monthRecords, startDate), [config, monthRecords, startDate]);
  const streak = useMemo(() => calculateStreak(config, monthRecords, startDate), [config, monthRecords, startDate]);
  const currentMonth = useMemo(() => getCurrentMonthDeposited(config, monthRecords), [config, monthRecords]);
  const contributions = useMemo(() => getContributionTotals(config, monthRecords), [config, monthRecords]);
  const skipCost = useMemo(() => calculateSkipMonthCost(config), [config]);
  const missedMonths = useMemo(() => getMissedMonths(config, monthRecords, startDate), [config, monthRecords, startDate]);
  const delayMonths = useMemo(() => calculateDelayMonths(config, monthRecords, startDate), [config, monthRecords, startDate]);
  const ageTimeline = useMemo(() => getAgeTimeline(config, monthRecords, startDate), [config, monthRecords, startDate]);

  const currentActualIdx = monthRecords.length > 0 ? Math.min(monthRecords.length, actual.length) - 1 : -1;
  const currentBalance = currentActualIdx >= 0 ? actual[currentActualIdx].totalBalance : config.initialAmount;
  const animatedBalance = useAnimatedCounter(currentBalance);

  const plannedTargetIdx = planned.findIndex((r) => r.totalBalance >= config.targetAmount);
  const monthsToGoal = plannedTargetIdx >= 0 ? plannedTargetIdx + 1 : config.years * 12;
  const yearsToGoal = Math.ceil(monthsToGoal / 12);
  const targetYear = parseInt(startDate.split("-")[0]) + yearsToGoal;

  const messageIdx = Math.floor(Date.now() / 86400000) % MOTIVATIONAL_MESSAGES.length;
  const motivation = MOTIVATIONAL_MESSAGES[messageIdx];

  const isCurrentComplete = isMonthComplete(config, monthRecords, currentKey);

  const goalLabel = emotionalGoal
    ? emotionalGoal === "outro" ? (emotionalGoalCustom || "Objetivo pessoal") : EMOTIONAL_GOAL_LABELS[emotionalGoal]
    : null;

  const handleCopyDeposits = () => {
    const lines = config.contributors
      .filter((c) => c.plannedSelic > 0 || c.plannedCDB > 0)
      .map((c) => {
        const parts: string[] = [];
        if (c.plannedSelic > 0) parts.push(`Selic: ${formatBRL(c.plannedSelic)}`);
        if (c.plannedCDB > 0) parts.push(`CDB: ${formatBRL(c.plannedCDB)}`);
        return `${c.name}: ${parts.join(" | ")}`;
      });
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Valores copiados!");
  };

  return (
    <div className="space-y-4">
      {/* Emotional goal banner */}
      {goalLabel && (
        <Card className="glass-card p-3 text-center border-primary/20">
          <p className="text-xs text-muted-foreground">Plano rumo ao milhão para:</p>
          <p className="text-sm font-semibold text-primary">{goalLabel}</p>
        </Card>
      )}

      {/* Motivational banner */}
      <Card className="glass-card p-4 text-center border-primary/20">
        <div className="flex items-center justify-center gap-2 text-sm">
          <Heart className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-muted-foreground">{motivation}</span>
        </div>
      </Card>

      {/* Animated Wealth Counter */}
      <Card className="glass-card-strong p-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Vocês já acumularam</p>
        <p className="text-3xl md:text-4xl font-extrabold text-gradient leading-tight">
          {formatBRL(Math.round(animatedBalance))}
        </p>
        <div className="mt-3">
          <StreakDisplay streak={streak} />
        </div>
      </Card>

      {/* Financial Safety Indicators */}
      {profile && ((profile.incomeJonathan || 0) > 0 || (profile.incomeIsabella || 0) > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="glass-card p-3 text-center">
            <PieChart className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground uppercase">Taxa de Poupança</p>
            <p className="text-lg font-bold text-primary">{(getSavingsRate(profile, config) * 100).toFixed(0)}%</p>
          </Card>
          {getFinancialSafetyMonths(profile) > 0 && (
            <Card className="glass-card p-3 text-center">
              <Shield className="w-4 h-4 text-accent mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground uppercase">Segurança Financeira</p>
              <p className="text-lg font-bold">{getFinancialSafetyMonths(profile).toFixed(1)} meses</p>
            </Card>
          )}
        </div>
      )}

      {/* Current Month Focus */}
      <Card className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold text-sm">Meta do Mês</h3>
              <p className="text-xs text-muted-foreground">{monthKeyToFullLabel(currentKey)}</p>
            </div>
          </div>
          {isCurrentComplete && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Concluído ✓</span>
          )}
        </div>

        <div className="grid grid-cols-3 text-center gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Planejado</p>
            <p className="font-bold text-sm">{formatBRL(currentMonth.planned)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Depositado</p>
            <p className="font-bold text-sm text-primary">{formatBRL(currentMonth.total)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Faltam</p>
            <p className="font-bold text-sm">{formatBRL(currentMonth.remaining)}</p>
          </div>
        </div>

        <Progress value={currentMonth.progress * 100} className="h-2" />

        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={onOpenQuickDeposit}>
            <DollarSign className="w-4 h-4 mr-1" /> Registrar depósito do mês
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopyDeposits}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Couple Progress */}
      <Card className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-sm">Progresso do Casal</h3>
        </div>

        {currentMonth.perPerson.map((p, i) => (
          p.planned > 0 && (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${i === 0 ? "bg-primary" : "bg-accent"}`} />
                  {p.name}
                </span>
                <span className="text-muted-foreground">{(p.pct * 100).toFixed(0)}% este mês</span>
              </div>
              <Progress value={p.pct * 100} className="h-1.5" />
            </div>
          )
        ))}

        {contributions.some((c) => c.total > 0) && (
          <div className="pt-2 border-t border-border/30 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Contribuição Total</p>
            {contributions.map((c, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${i === 0 ? "bg-primary" : "bg-accent"}`} />
                  {c.name}
                </span>
                <span>{formatBRL(c.total)} ({(c.percentage * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Monthly Insights */}
      <MonthlyInsights config={config} monthRecords={monthRecords} startDate={startDate} profile={profile} />

      {/* Countdown */}
      <Card className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Contagem Regressiva para R$1M</h3>
        </div>
        <div className="grid grid-cols-3 text-center gap-3">
          <div>
            <p className="text-2xl font-bold text-foreground">{yearsToGoal}</p>
            <p className="text-[10px] text-muted-foreground">anos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{monthsToGoal}</p>
            <p className="text-[10px] text-muted-foreground">meses</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{targetYear}</p>
            <p className="text-[10px] text-muted-foreground">ano previsto</p>
          </div>
        </div>
      </Card>

      {/* Delay Impact Warning */}
      {missedMonths > 0 && (
        <Card className="glass-card p-4 border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                Vocês atrasaram {missedMonths} {missedMonths === 1 ? "mês" : "meses"}
                {delayMonths > 0 && <span> — nova previsão: <strong className="text-warning">+{delayMonths} meses</strong></span>}
              </p>
              <p className="text-xs text-muted-foreground">
                Pular este mês pode custar <strong className="text-foreground">{formatBRL(skipCost)}</strong> no futuro.
              </p>
            </div>
          </div>
        </Card>
      )}

      {missedMonths === 0 && (
        <Card className="glass-card p-4 border-primary/20">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Vocês estão em dia! 🎉</p>
              <p className="text-xs text-muted-foreground">
                Pular um mês custaria <strong className="text-foreground">{formatBRL(skipCost)}</strong> em juros compostos. Continue assim!
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Achievement Timeline */}
      <AchievementTimeline config={config} monthRecords={monthRecords} startDate={startDate} />

      {/* Age Timeline */}
      {ageTimeline.length > 0 && (
        <Card className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-sm">Patrimônio por Idade</h3>
          </div>
          <div className="space-y-2">
            {Array.from(new Set(ageTimeline.map((t) => t.age))).map((age) => {
              const items = ageTimeline.filter((t) => t.age === age);
              return (
                <div key={age} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium min-w-[45px] text-center">{age} anos</span>
                    <span className="text-xs text-muted-foreground">({items[0].year})</span>
                  </div>
                  <span className="text-sm font-semibold">{formatBRLCompact(items[0].balance)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Milestones */}
      <div className="flex flex-wrap gap-2">
        {MILESTONES.map((m) => {
          const reached = getReachedMilestones(planned, [m]).length > 0;
          return (
            <div key={m} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              reached ? "bg-primary/20 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground"
            }`}>
              <Trophy className="w-3 h-3" />
              {formatBRLCompact(m)}
              {reached && " ✓"}
            </div>
          );
        })}
      </div>
    </div>
  );
}
