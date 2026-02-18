import { useMemo } from "react";
import { PlanConfig, MonthRecord, MILESTONES, monthKeyToLabel } from "@/lib/types";
import { getAchievementTimeline } from "@/lib/calculator";
import { Card } from "@/components/ui/card";
import { Trophy, Circle, CheckCircle2 } from "lucide-react";

interface AchievementTimelineProps {
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
}

export function AchievementTimeline({ config, monthRecords, startDate }: AchievementTimelineProps) {
  const achievements = useMemo(
    () => getAchievementTimeline(config, monthRecords, startDate, MILESTONES),
    [config, monthRecords, startDate]
  );

  if (achievements.length === 0) return null;

  return (
    <Card className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">Linha do Tempo de Conquistas</h3>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border" />

        <div className="space-y-3">
          {achievements.map((a, i) => (
            <div key={i} className="flex items-start gap-3 relative">
              <div className="shrink-0 z-10">
                {a.reached ? (
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                ) : (
                  <Circle className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${a.reached ? "text-foreground" : "text-muted-foreground"}`}>
                    {a.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{monthKeyToLabel(a.date)}</span>
                </div>
                {a.reached && (
                  <span className="text-[10px] text-primary font-medium">Alcançado ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
