import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlanConfig, MonthRecord } from "@/lib/types";
import { AppData } from "@/lib/models";
import { detectCurrentPhase, JOURNEY_PHASES, JourneyPhase, calculateHealthScore, calculateDiagnostic, calculatePortfolioSecurity } from "@/lib/financialEngine";
import { calculateStreak } from "@/lib/calculator";
import { ChevronRight, Check, Lock, TrendingUp, TrendingDown, Shield, Activity, Target } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
}

// Evolution stages based on structural quality, not just total
type EvolutionStage = "desorganizado" | "em-ajuste" | "protegendo" | "consistente" | "acumulando" | "estruturado" | "diversificado" | "estrategico";

const EVOLUTION_STAGES: { id: EvolutionStage; label: string; emoji: string; description: string }[] = [
  { id: "desorganizado", label: "Desorganizado", emoji: "🌪️", description: "Ainda sem visão clara do fluxo financeiro" },
  { id: "em-ajuste", label: "Em ajuste", emoji: "🔧", description: "Começando a organizar receitas e gastos" },
  { id: "protegendo", label: "Protegendo a base", emoji: "🛡️", description: "Construindo reserva e eliminando dívidas" },
  { id: "consistente", label: "Consistente", emoji: "🎯", description: "Aportando com regularidade e disciplina" },
  { id: "acumulando", label: "Acumulando com segurança", emoji: "📈", description: "Patrimônio crescendo com estrutura" },
  { id: "estruturado", label: "Estruturado", emoji: "🏗️", description: "Buckets equilibrados e proteção adequada" },
  { id: "diversificado", label: "Diversificado", emoji: "💎", description: "Patrimônio distribuído e protegido" },
  { id: "estrategico", label: "Estratégico", emoji: "👑", description: "Arquitetura madura e renda passiva" },
];

function detectEvolutionStage(
  appData: AppData, config: PlanConfig, monthRecords: MonthRecord[], startDate: string
): EvolutionStage {
  const score = calculateHealthScore(appData, config, monthRecords, startDate);
  const diag = calculateDiagnostic(appData, config, monthRecords, startDate);
  const security = calculatePortfolioSecurity(appData, config);
  const streak = calculateStreak(config, monthRecords, startDate);
  const hasData = appData.incomes.length > 0 || appData.expenses.length > 0;

  if (!hasData && score.total < 30) return "desorganizado";
  if (score.flowClarityScore < 60) return "em-ajuste";
  if (diag.emergencyMonths < 3 || score.debtScore < 50) return "protegendo";
  if (streak < 3 || score.consistencyScore < 50) return "consistente";
  if (diag.investedWealth < 100_000) return "acumulando";
  if (security.total < 60 || security.concentrationLevel === "high") return "estruturado";
  if (diag.investedWealth < 500_000) return "diversificado";
  return "estrategico";
}

const PHASE_ORDER: JourneyPhase[] = ["chaos", "control", "protection", "accumulation", "acceleration", "consolidation", "passive-income", "functional-wealth"];

export function JourneyPhases({ appData, config, monthRecords, startDate }: Props) {
  const currentPhase = useMemo(
    () => detectCurrentPhase(appData, config, monthRecords, startDate),
    [appData, config, monthRecords, startDate]
  );
  const evolutionStage = useMemo(
    () => detectEvolutionStage(appData, config, monthRecords, startDate),
    [appData, config, monthRecords, startDate]
  );
  const score = useMemo(() => calculateHealthScore(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const security = useMemo(() => calculatePortfolioSecurity(appData, config), [appData, config]);
  const streak = useMemo(() => calculateStreak(config, monthRecords, startDate), [config, monthRecords, startDate]);

  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  const phaseInfo = JOURNEY_PHASES.find(p => p.id === currentPhase)!;
  const evolutionInfo = EVOLUTION_STAGES.find(s => s.id === evolutionStage)!;
  const evolutionIdx = EVOLUTION_STAGES.findIndex(s => s.id === evolutionStage);

  // What accelerates and what delays
  const accelerators: string[] = [];
  const delays: string[] = [];

  if (streak >= 3) accelerators.push("Consistência de aportes");
  if (score.emergencyScore >= 70) accelerators.push("Reserva de emergência sólida");
  if (security.protectedPercentage >= 0.6) accelerators.push("Boa proteção patrimonial");
  if (score.balanceScore >= 70) accelerators.push("Equilíbrio entre renda e gastos");

  if (streak < 2) delays.push("Falta de regularidade nos aportes");
  if (score.debtScore < 50) delays.push("Peso das dívidas na renda");
  if (score.emergencyScore < 40) delays.push("Reserva de emergência fraca");
  if (security.concentrationLevel === "high") delays.push("Concentração excessiva");
  if (score.flowClarityScore < 50) delays.push("Falta de dados cadastrados");

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Current Phase Banner */}
      <Card className="glass-card-strong p-5 lg:p-8 text-center">
        <p className="text-4xl lg:text-5xl mb-2">{phaseInfo.emoji}</p>
        <h3 className="text-lg lg:text-xl font-bold">Fase: {phaseInfo.name}</h3>
        <p className="text-sm lg:text-base text-muted-foreground mt-1 max-w-md mx-auto">{phaseInfo.description}</p>
      </Card>

      {/* Evolution Stage (behavioral) */}
      <Card className="glass-card p-4 lg:p-6">
        <h4 className="section-label mb-3">Seu estágio de evolução</h4>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{evolutionInfo.emoji}</span>
          <div>
            <p className="text-sm font-bold">{evolutionInfo.label}</p>
            <p className="text-xs text-muted-foreground">{evolutionInfo.description}</p>
          </div>
        </div>
        <div className="flex gap-1 mb-2">
          {EVOLUTION_STAGES.map((stage, i) => (
            <div
              key={stage.id}
              className={`h-2 flex-1 rounded-full transition-all ${
                i <= evolutionIdx ? "bg-primary" : "bg-muted/40"
              }`}
              title={stage.label}
            />
          ))}
        </div>
        <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
          {evolutionIdx + 1} de {EVOLUTION_STAGES.length} estágios
        </p>
      </Card>

      {/* Structural quality indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QualityCard icon={Activity} label="Saúde" value={score.total} />
        <QualityCard icon={Shield} label="Proteção" value={security.total} />
        <QualityCard icon={Target} label="Disciplina" value={score.disciplineScore} />
        <QualityCard icon={TrendingUp} label="Constância" value={score.consistencyScore} />
      </div>

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
        <h4 className="section-label mb-3">As 8 fases da jornada</h4>
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
