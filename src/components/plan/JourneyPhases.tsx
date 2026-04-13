import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { PlanConfig, MonthRecord } from "@/lib/types";
import { AppData } from "@/lib/models";
import { detectCurrentPhase, JOURNEY_PHASES, JourneyPhase } from "@/lib/financialEngine";
import { ChevronRight, Check, Lock } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
}

const PHASE_ORDER: JourneyPhase[] = ["chaos", "control", "protection", "accumulation", "acceleration", "consolidation", "passive-income", "functional-wealth"];

export function JourneyPhases({ appData, config, monthRecords, startDate }: Props) {
  const currentPhase = useMemo(
    () => detectCurrentPhase(appData, config, monthRecords, startDate),
    [appData, config, monthRecords, startDate]
  );

  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  const phaseInfo = JOURNEY_PHASES.find(p => p.id === currentPhase)!;

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Current Phase Banner */}
      <Card className="glass-card-strong p-5 lg:p-8 text-center">
        <p className="text-4xl lg:text-5xl mb-2">{phaseInfo.emoji}</p>
        <h3 className="text-lg lg:text-xl font-bold">Você está na fase: {phaseInfo.name}</h3>
        <p className="text-sm lg:text-base text-muted-foreground mt-1">{phaseInfo.description}</p>
      </Card>

      {/* Phase Progress */}
      <div className="flex items-center justify-between px-2">
        {PHASE_ORDER.map((phase, i) => {
          const info = JOURNEY_PHASES.find(p => p.id === phase)!;
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

      {/* Details */}
      <Card className="glass-card p-4 lg:p-6 space-y-4 lg:space-y-5">
        <Section title="🎯 O que focar agora" items={phaseInfo.priorities} />
        <Section title="✅ Seus próximos passos" items={phaseInfo.nextSteps} />
        <Section title="💡 Dicas para esta fase" items={phaseInfo.recommendations} />
        <Section title="⚠️ Cuidado com" items={phaseInfo.commonRisks} variant="warning" />
        {phaseInfo.exitCriteria.length > 0 && (
          <Section title="🚪 O que falta para avançar" items={phaseInfo.exitCriteria} variant="accent" />
        )}
      </Card>

      {/* All Phases Mini List */}
      <Card className="glass-card p-4 lg:p-6">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">As 8 fases da jornada</h4>
        <div className="space-y-2">
          {JOURNEY_PHASES.map((phase, i) => {
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
                {isActive && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Você está aqui</span>}
                {isPast && <Check className="w-4 h-4 text-primary" />}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Section({ title, items, variant }: { title: string; items: string[]; variant?: "warning" | "accent" }) {
  const textColor = variant === "warning" ? "text-warning" : variant === "accent" ? "text-accent" : "text-foreground";
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
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
