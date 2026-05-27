import { useMemo, type ComponentType } from "react";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact } from "@/lib/types";
import { simulateScenario, ScenarioResult } from "@/lib/calculator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, PauseCircle, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

interface ScenarioSimulatorProps {
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
}

const scenarios: { key: "pause6" | "pause12" | "increase10" | "decrease20"; icon: ComponentType<{ className?: string }>; label: string; color: string }[] = [
  { key: "pause6", icon: PauseCircle, label: "Pausar 6 meses", color: "text-warning" },
  { key: "pause12", icon: PauseCircle, label: "Pausar 1 ano", color: "text-destructive" },
  { key: "increase10", icon: TrendingUp, label: "Aumentar +10%", color: "text-primary" },
  { key: "decrease20", icon: TrendingDown, label: "Reduzir −20%", color: "text-warning" },
];

export function ScenarioSimulator({ config, monthRecords, startDate }: ScenarioSimulatorProps) {
  const results = useMemo(() => {
    return scenarios.map((s) => ({
      ...s,
      result: simulateScenario(config, monthRecords, startDate, s.key),
    }));
  }, [config, monthRecords, startDate]);

  return (
    <Card className="glass-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-accent" />
        <h3 className="font-semibold text-sm">Cenários de Vida Real</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {results.map(({ key, icon: Icon, label, color, result }) => (
          <div key={key} className="rounded-xl bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patrimônio final</span>
                <span className="font-semibold">{formatBRLCompact(result.finalWealth)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Diferença</span>
                <span className={`font-semibold ${result.difference >= 0 ? "text-primary" : "text-destructive"}`}>
                  {result.difference >= 0 ? "+" : ""}{formatBRLCompact(result.difference)}
                </span>
              </div>
              {result.monthsToTarget && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meta em</span>
                  <span className="font-semibold">{Math.ceil(result.monthsToTarget / 12)} anos</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
