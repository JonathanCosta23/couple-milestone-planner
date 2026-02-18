import { useMemo } from "react";
import { PlanConfig, MonthRecord, FinancialProfile, formatBRL, getCurrentMonthKey } from "@/lib/types";
import { getMonthlyInsights } from "@/lib/calculator";
import { Card } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

interface MonthlyInsightsProps {
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  profile?: FinancialProfile;
}

export function MonthlyInsights({ config, monthRecords, startDate, profile }: MonthlyInsightsProps) {
  const insights = useMemo(
    () => getMonthlyInsights(config, monthRecords, startDate, profile),
    [config, monthRecords, startDate, profile]
  );

  if (insights.length === 0) return null;

  return (
    <Card className="glass-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-accent" />
        <h3 className="font-semibold text-sm">Insights do Mês</h3>
      </div>
      <div className="space-y-1.5">
        {insights.map((insight, i) => (
          <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            {insight}
          </p>
        ))}
      </div>
    </Card>
  );
}
