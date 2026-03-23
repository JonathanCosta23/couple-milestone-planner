import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord } from "@/lib/types";
import { generateMentorRecommendations, MentorRecommendation } from "@/lib/behavioralEngine";
import { Sparkles } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
}

export function MentorshipHome({ appData, config, monthRecords, startDate }: Props) {
  const recs = useMemo(
    () => generateMentorRecommendations(appData, config, monthRecords, startDate),
    [appData, config, monthRecords, startDate]
  );

  if (recs.length === 0) return null;

  const typeColors: Record<string, string> = {
    fix: "border-destructive/20",
    cut: "border-warning/20",
    increase: "border-primary/20",
    accelerate: "border-accent/20",
    learn: "border-border",
  };

  return (
    <Card className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Recomendações do Mentor</p>
      </div>
      <div className="space-y-2">
        {recs.slice(0, 4).map((rec, i) => (
          <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30 border ${typeColors[rec.type] || "border-border"}`}>
            <span className="text-lg shrink-0">{rec.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold">{rec.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{rec.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
