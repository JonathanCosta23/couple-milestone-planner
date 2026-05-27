import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlanConfig, MonthRecord } from "@/lib/types";
import { AppData } from "@/lib/models";
import type { FinancialCoreState } from "@/hooks/useFinancialCore";
import { JOURNEY_PHASES as OLD_PHASES } from "@/lib/financialEngine";
import { ChevronRight, Check, Lock, TrendingUp, TrendingDown, Shield, Activity, Target } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  core: FinancialCoreState;
}

const PHASE_ORDER = ["chaos", "control", "protection", "accumulation", "acceleration", "consolidation", "passive-income", "functional-wealth"] as const;

export function JourneyPhases({ appData, config, monthRecords, startDate, core }: Props) {
  const { journey, metrics, allocation } = core;
  const currentPhase = journey.currentPhase;
  const currentIdx = PHASE_ORDER.indexOf(currentPhase as typeof PHASE_ORDER[number]);

  // Use old phase info for detailed content (priorities, recommendations etc)
  const phaseInfo = OLD_PHASES.find(p => p.id === currentPhase) || OLD_PHASES[0];

  // Accelerators & delays derived from centralized metrics
  const accelerators: string[] = [];
  const delays: string[] = [];

  if (metrics.streak >= 3) accelerators.push("Consistência de aportes");
  if (metrics.reserveMonths >= 6) accelerators.push("Reserva de emergência completa");
  if (metrics.protectedRatio >= 0.6) accelerators.push("Boa proteção patrimonial");
  if (metrics.savingsRate >= 0.15) accelerators.push("Boa taxa de poupança");

  if (metrics.streak < 2) delays.push("Falta de regularidade nos aportes");
  if (metrics.toxicDebtCount > 0) delays.push("Dívidas tóxicas pesando na renda");
  if (metrics.reserveMonths < 3) delays.push("Reserva de emergência fraca");
  if (allocation.concentrationRisk === "high" || allocation.concentrationRisk === "critical") delays.push("Concentração excessiva");

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Current Phase Banner */}
      <Card className="glass-card-strong p-5 lg:p-8 text-center">
        <p className="text-4xl lg:text-5xl mb-2">{journey.phaseEmoji}</p>
        <h3 className="text-lg lg:text-xl font-bold">Fase: {journey.phaseName}</h3>
        <p className="text-sm lg:text-base text-muted-foreground mt-1 max-w-md mx-auto">{journey.phaseDescription}</p>
      </Card>

      {/* Progress to next */}
      {journey.nextPhase && (
        <Card className="glass-card p-4 lg:p-6">
          <h4 className="section-label mb-3">Progresso para a próxima fase</h4>
          <Progress value={journey.progressToNext * 100} className="h-2 mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {journey.completedCriteria.length > 0 && (
              <div>
                <p className="text-[10px] text-primary uppercase font-bold mb-1">✅ Conquistado</p>
                {journey.completedCriteria.map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Check className="w-3 h-3 text-primary" />{c}
                  </p>
                ))}
              </div>
            )}
            {journey.pendingCriteria.length > 0 && (
              <div>
                <p className="text-[10px] text-warning uppercase font-bold mb-1">⏳ Pendente</p>
                {journey.pendingCriteria.map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                    <ChevronRight className="w-3 h-3 text-warning" />{c}
                  </p>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Quality indicators — from centralized metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QualityCard icon={Activity} label="Estrutura" value={allocation.structuralScore} />
        <QualityCard icon={Shield} label="Proteção" value={Math.round(metrics.protectedRatio * 100)} />
        <QualityCard icon={Target} label="Disciplina" value={Math.min(100, Math.round(metrics.streak * 12))} />
        <QualityCard icon={TrendingUp} label="Poupança" value={Math.min(100, Math.round(metrics.savingsRate * 250))} />
      </div>

      {/* Phase Progress */}
      <div className="flex items-center justify-between px-2">
        {PHASE_ORDER.map((phase, i) => {
          const info = OLD_PHASES.find(p => p.id === phase)!;
          const isActive = i === currentIdx;
          const isPast = i < currentIdx;
          const isFuture = i > currentIdx;
          return (
            <div key={phase} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                isActive ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background" :
                isPast ? "bg-primary/20 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {isPast ? <Check className="w-3.5 h-3.5" /> :
                 isFuture ? <Lock className="w-3 h-3" /> :
                 <span className="text-xs">{info.emoji}</span>}
              </div>
              {i < PHASE_ORDER.length - 1 && (
                <div className={`w-3 sm:w-6 h-0.5 ${i < currentIdx ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* What accelerates / delays */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
        {accelerators.length > 0 && (
          <Card className="glass-card p-4 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold uppercase tracking-wider text-primary">O que te acelera</p>
            </div>
            <ul className="space-y-1.5">
              {accelerators.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {delays.length > 0 && (
          <Card className="glass-card p-4 border-warning/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-warning" />
              <p className="text-xs font-bold uppercase tracking-wider text-warning">O que te atrasa</p>
            </div>
            <ul className="space-y-1.5">
              {delays.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                  <ChevronRight className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Details */}
      <Card className="glass-card p-4 lg:p-6 space-y-4 lg:space-y-5">
        <Section title="🎯 O que focar agora" items={journey.priorities} />
        <Section title="✅ Seus próximos passos" items={phaseInfo.nextSteps} />
        <Section title="💡 Dicas para esta fase" items={phaseInfo.recommendations} />
        <Section title="⚠️ Cuidado com" items={phaseInfo.commonRisks} variant="warning" />
        {phaseInfo.exitCriteria.length > 0 && (
          <Section title="🚪 O que falta para avançar" items={phaseInfo.exitCriteria} variant="accent" />
        )}
      </Card>

      {/* All Phases */}
      <Card className="glass-card p-4 lg:p-6">
        <h4 className="section-label mb-3">As 8 fases da jornada</h4>
        <div className="space-y-2">
          {OLD_PHASES.map((phase, i) => {
            const isActive = phase.id === currentPhase;
            const isPast = i < currentIdx;
            return (
              <div key={phase.id} className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                isActive ? "bg-primary/10 border border-primary/20" :
                isPast ? "opacity-70" : "opacity-40"
              }`}>
                <span className="text-lg">{phase.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isActive ? "text-primary" : ""}`}>{phase.name}</p>
                </div>
                {isActive && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Aqui</span>}
                {isPast && <Check className="w-4 h-4 text-primary" />}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function QualityCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  const color = value >= 70 ? "text-primary" : value >= 40 ? "text-warning" : "text-destructive";
  return (
    <Card className="glass-card p-3 lg:p-4 text-center">
      <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">{label}</p>
    </Card>
  );
}

function Section({ title, items, variant }: { title: string; items: string[]; variant?: "warning" | "accent" }) {
  const textColor = variant === "warning" ? "text-warning" : variant === "accent" ? "text-accent" : "text-foreground";
  return (
    <div>
      <h4 className="section-label mb-2">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className={`flex items-start gap-2 text-sm ${textColor}`}>
            <ChevronRight className="w-3 h-3 shrink-0 mt-1 text-muted-foreground" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
