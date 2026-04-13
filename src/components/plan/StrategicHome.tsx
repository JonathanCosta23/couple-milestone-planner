import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact, getCurrentMonthKey, monthKeyToFullLabel, MILESTONES, getMotivationalMessages } from "@/lib/types";
import { calculateHealthScore, calculateDiagnostic, detectCurrentPhase, JOURNEY_PHASES, generateIncomeInsights } from "@/lib/financialEngine";
import { generateProjection, calculateStreak, getCurrentMonthDeposited, getReachedMilestones } from "@/lib/calculator";
import { generateNudges } from "@/lib/behavioralEngine";
import { EducationalTooltip } from "./EducationalTooltip";
import { MentorshipHome } from "./MentorshipHome";
import {
  Activity, Target, Shield, AlertTriangle, TrendingUp, DollarSign,
  Heart, Lightbulb, ArrowRight, Trophy, Zap, CreditCard, Wallet,
} from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  onNavigateToTab: (tab: string) => void;
  onOpenQuickDeposit: () => void;
}

export function StrategicHome({ appData, config, monthRecords, startDate, onNavigateToTab, onOpenQuickDeposit }: Props) {
  const currentKey = getCurrentMonthKey();
  const score = useMemo(() => calculateHealthScore(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const diag = useMemo(() => calculateDiagnostic(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const phase = useMemo(() => detectCurrentPhase(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const phaseInfo = JOURNEY_PHASES.find(p => p.id === phase)!;
  const streak = useMemo(() => calculateStreak(config, monthRecords, startDate), [config, monthRecords, startDate]);
  const currentMonth = useMemo(() => getCurrentMonthDeposited(config, monthRecords), [config, monthRecords]);
  const planned = useMemo(() => generateProjection(config, "planned", monthRecords, startDate), [config, monthRecords, startDate]);
  const reached = useMemo(() => getReachedMilestones(planned, MILESTONES), [planned]);
  const nudges = useMemo(() => generateNudges(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);

  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const totalDebts = appData.debts.filter(d => d.active).reduce((s, d) => s + d.monthlyPayment, 0);
  const monthlyInvestment = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);

  const scoreColor = score.total >= 70 ? "text-primary" : score.total >= 40 ? "text-warning" : "text-destructive";

  const isCouple = config.contributors.length > 1;
  const messages = getMotivationalMessages(isCouple);
  const messageIdx = Math.floor(Date.now() / 86400000) % messages.length;

  const closerToMillion: string[] = [];
  const awayFromMillion: string[] = [];
  if (streak > 0) closerToMillion.push(`Sequência de ${streak} meses ✅`);
  if (diag.savingsRate > 0.2) closerToMillion.push(`Taxa de poupança de ${(diag.savingsRate * 100).toFixed(0)}%`);
  if (diag.emergencyMonths >= 6) closerToMillion.push("Reserva de emergência completa");
  if (diag.debtWeight > 0.2) awayFromMillion.push(`${(diag.debtWeight * 100).toFixed(0)}% da renda vai para dívidas`);
  if (diag.savingsRate < 0.1 && totalIncome > 0) awayFromMillion.push("Taxa de poupança muito baixa");
  if (diag.cardDependency > 0.3) awayFromMillion.push("Alta dependência de cartão");

  const nextStep = phaseInfo.nextSteps[0] || "Continue acompanhando seus gastos";

  // Top nudge for home display
  const topNudge = nudges[0] || null;

  return (
    <div className="space-y-4">
      {/* Motivational */}
      <Card className="glass-card p-3 text-center border-primary/20">
        <div className="flex items-center justify-center gap-2 text-sm">
          <Heart className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-muted-foreground">{messages[messageIdx]}</span>
        </div>
      </Card>

      {/* Score + Phase */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="glass-card p-4 text-center cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all"
          onClick={() => onNavigateToTab("diagnostico")}>
          <Activity className={`w-5 h-5 mx-auto mb-1 ${scoreColor}`} />
          <p className={`text-3xl font-extrabold ${scoreColor}`}>{score.total}</p>
          <EducationalTooltip tipKey="score-financeiro">
            <p className="text-[10px] text-muted-foreground uppercase">Score Financeiro</p>
          </EducationalTooltip>
        </Card>
        <Card className="glass-card p-4 text-center cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all"
          onClick={() => onNavigateToTab("jornada")}>
          <p className="text-2xl mb-1">{phaseInfo.emoji}</p>
          <p className="text-sm font-bold truncate">{phaseInfo.name}</p>
          <p className="text-[10px] text-muted-foreground uppercase">Fase Atual</p>
        </Card>
      </div>

      {/* Wealth + Progress */}
      <Card className="glass-card-strong p-5 text-center">
        <EducationalTooltip tipKey="patrimonio-investido">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Patrimônio Investido</p>
        </EducationalTooltip>
        <p className="text-3xl font-extrabold text-gradient">{formatBRLCompact(diag.investedWealth)}</p>
        <div className="mt-3">
          <Progress value={Math.min(100, (diag.investedWealth / config.targetAmount) * 100)} className="h-2" />
          <EducationalTooltip tipKey="progresso-milhao">
            <p className="text-xs text-muted-foreground mt-1">
              {((diag.investedWealth / config.targetAmount) * 100).toFixed(1)}% rumo a {formatBRLCompact(config.targetAmount)}
            </p>
          </EducationalTooltip>
        </div>
        {diag.monthsToMillion && (
          <p className="text-xs text-muted-foreground mt-2">
            Previsão: <strong className="text-foreground">{Math.ceil(diag.monthsToMillion / 12)} anos</strong> ({diag.monthsToMillion} meses)
          </p>
        )}
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2">
        <QuickStat icon={DollarSign} label="Receita" value={formatBRLCompact(totalIncome)} color="text-primary" />
        <QuickStat icon={Wallet} label="Gasto" value={formatBRLCompact(diag.totalExpenses)} color="text-foreground" />
        <QuickStat icon={AlertTriangle} label="Dívidas" value={formatBRLCompact(totalDebts)} color="text-destructive" />
        <QuickStat icon={TrendingUp} label="Aporte" value={formatBRLCompact(monthlyInvestment)} color="text-accent" />
      </div>

      {/* Current Month */}
      <Card className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Aportes do Mês</p>
              <p className="text-[10px] text-muted-foreground">{monthKeyToFullLabel(currentKey)}</p>
            </div>
          </div>
          <EducationalTooltip tipKey="streak">
            <div className="flex items-center gap-1">
              <span className="text-lg">🔥</span>
              <span className="text-sm font-bold">{streak}</span>
            </div>
          </EducationalTooltip>
        </div>
        <Progress value={currentMonth.progress * 100} className="h-2 mb-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span>{formatBRL(currentMonth.total)} / {formatBRL(currentMonth.planned)}</span>
          <span>{(currentMonth.progress * 100).toFixed(0)}%</span>
        </div>
        <Button size="sm" className="w-full" onClick={onOpenQuickDeposit}>
          <DollarSign className="w-4 h-4 mr-1" /> Registrar depósito do mês
        </Button>
      </Card>

      {/* Reserve + Debts + Card */}
      <div className="grid grid-cols-3 gap-2">
        <StatusCard icon={Shield} label="Reserva" tipKey="reserva-emergencia"
          value={`${diag.emergencyMonths.toFixed(1)}m`}
          status={diag.emergencyMonths >= 6 ? "good" : diag.emergencyMonths >= 3 ? "warning" : "danger"} />
        <StatusCard icon={AlertTriangle} label="Dívidas" tipKey="divida-toxica"
          value={totalDebts > 0 ? formatBRLCompact(totalDebts) : "Zero"}
          status={totalDebts === 0 ? "good" : "danger"} />
        <StatusCard icon={CreditCard} label="Cartão" tipKey="divida-toxica"
          value={`${(diag.cardDependency * 100).toFixed(0)}%`}
          status={diag.cardDependency < 0.3 ? "good" : "warning"} />
      </div>

      {/* Mentorship Recommendations */}
      <MentorshipHome appData={appData} config={config} monthRecords={monthRecords} startDate={startDate} />

      {/* Top Nudge */}
      {topNudge && (
        <Card className="glass-card p-3 border-warning/20">
          <div className="flex items-start gap-2.5">
            <span className="text-lg shrink-0">{topNudge.icon}</span>
            <div>
              <p className="text-[10px] text-warning uppercase font-bold mb-0.5">Insight comportamental</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{topNudge.message}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Bottleneck & Opportunity */}
      <Card className="glass-card p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Maior gargalo</p>
            <p className="text-sm">{diag.biggestBottleneck}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Maior oportunidade</p>
            <p className="text-sm">{diag.biggestOpportunity}</p>
          </div>
        </div>
      </Card>

      {/* Next Best Step */}
      <Card className="glass-card p-4 border-primary/20">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Próximo Melhor Passo</p>
            <p className="text-sm font-semibold">{nextStep}</p>
          </div>
        </div>
      </Card>

      {/* Closer / Away from million */}
      <div className="grid grid-cols-1 gap-3">
        {closerToMillion.length > 0 && (
          <Card className="glass-card p-3 space-y-1.5">
            <p className="text-[10px] text-primary uppercase font-bold">O que aproxima do milhão</p>
            {closerToMillion.map((item, i) => (
              <p key={i} className="text-xs flex items-center gap-1.5"><TrendingUp className="w-3 h-3 text-primary" />{item}</p>
            ))}
          </Card>
        )}
        {awayFromMillion.length > 0 && (
          <Card className="glass-card p-3 space-y-1.5">
            <p className="text-[10px] text-destructive uppercase font-bold">O que afasta do milhão</p>
            {awayFromMillion.map((item, i) => (
              <p key={i} className="text-xs flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-destructive" />{item}</p>
            ))}
          </Card>
        )}
      </div>

      {/* Milestones */}
      <div className="flex flex-wrap gap-2">
        {MILESTONES.map(m => {
          const isReached = reached.includes(m);
          return (
            <div key={m} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isReached ? "bg-primary/20 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground"
            }`}>
              <Trophy className="w-3 h-3" />
              {formatBRLCompact(m)}
              {isReached && " ✓"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/30">
      <Icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${color}`} />
      <p className="text-xs font-bold truncate">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, status, tipKey }: { icon: React.ElementType; label: string; value: string; status: "good" | "warning" | "danger"; tipKey?: string }) {
  const colors = { good: "text-primary border-primary/20", warning: "text-warning border-warning/20", danger: "text-destructive border-destructive/20" };
  return (
    <Card className={`glass-card p-3 text-center border ${colors[status]}`}>
      <Icon className={`w-4 h-4 mx-auto mb-1 ${colors[status].split(" ")[0]}`} />
      <p className={`text-sm font-bold ${colors[status].split(" ")[0]}`}>{value}</p>
      {tipKey ? (
        <EducationalTooltip tipKey={tipKey}>
          <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
        </EducationalTooltip>
      ) : (
        <p className="text-[9px] text-muted-foreground uppercase">{label}</p>
      )}
    </Card>
  );
}
