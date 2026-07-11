/**
 * MonthlyCockpit — bloco principal da Home (cockpit do mês).
 *
 * Extraído de `UnifiedHome.tsx` para reduzir o tamanho do arquivo e isolar a
 * apresentação do cockpit. Sem alteração de comportamento ou layout.
 */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBRL, formatBRLCompact, monthKeyToFullLabel, MonthRecord } from "@/lib/types";
import {
  DollarSign, Zap, Calendar, Settings2, Flame,
  type LucideIcon,
} from "lucide-react";

export interface MonthStatus { label: string; tone: string; message: string }
export interface PerMember { name: string; deposited: number; planned: number; pct: number }

export function countCompletedMonthsThisYear(records: MonthRecord[]): number {
  const year = new Date().getFullYear();
  return records.filter((r) => {
    if (!r.completed) return false;
    const y = parseInt((r.monthKey || "").split("-")[0], 10);
    return y === year;
  }).length;
}

export function buildPrescriptiveInsight(args: {
  planned: number;
  realized: number;
  remaining: number;
  nextBestActionTitle?: string;
}): string {
  const { planned, realized, remaining } = args;
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
  return `Você está ${shortfallPct}% abaixo do planejado neste mês. Prioridade: registrar os ${formatBRL(remaining)} restantes.`;
}

export interface MonthlyCockpitProps {
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

export function MonthlyCockpit({
  currentKey, grossWealth, targetAmount, progressPct,
  planned, realized, remaining, monthProgress, status,
  streak, completedThisYear, isCouple, perMember,
  prescriptiveInsight,
  onPrimaryAction, onSecondaryAction, onTertiaryAction, onOpenPatrimonio,
}: MonthlyCockpitProps) {
  const gap = Math.max(0, targetAmount - grossWealth);
  const validMembers = perMember.filter((m) => m.name && m.name.trim().length > 0);

  return (
    <Card className="glass-card-hero p-5 lg:p-7 animate-fade-in-up">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold">
            Cockpit · {monthKeyToFullLabel(currentKey)}
          </p>
          <h2 className="text-base lg:text-lg font-semibold mt-0.5">Missão do mês</h2>
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

      <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-5">
        <CockpitMetric label="Patrimônio atual" value={formatBRLCompact(grossWealth)} sub={`${progressPct.toFixed(1)}% da meta`} onClick={onOpenPatrimonio} accent="text-gradient" />
        <CockpitMetric label="Meta final" value={formatBRLCompact(targetAmount)} sub="Objetivo patrimonial" />
        <CockpitMetric label="Gap até a meta" value={formatBRLCompact(gap)} sub="Distância restante" accent="text-foreground" />
      </div>
      <Progress value={progressPct} className="h-1.5 rounded-full mb-6" />

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

      {isCouple && validMembers.length > 1 && (
        <div className="space-y-2 mb-4">
          <h3 className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold">
            Progresso por participante
          </h3>
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

      <div className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2.5 mb-5 flex gap-2.5">
        <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm leading-relaxed">{prescriptiveInsight}</p>
      </div>

      <div className="space-y-2">
        <Button className="w-full h-12 font-bold text-sm touch-target shadow-lg shadow-primary/20" onClick={onPrimaryAction}>
          <DollarSign className="w-4 h-4 mr-2" /> Cadastrar aporte agora
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 text-xs lg:text-sm rounded-xl touch-target" onClick={onSecondaryAction}>
            <Calendar className="w-4 h-4 mr-1.5" /> Ver mês atual
          </Button>
          <Button variant="ghost" className="h-11 text-xs lg:text-sm rounded-xl touch-target" onClick={onTertiaryAction}>
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 px-2 py-2 text-center min-w-0">
      <p className="text-xs font-bold truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export function IndicatorCard({ Icon, label, value, sub, valueColor, onClick }: {
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
