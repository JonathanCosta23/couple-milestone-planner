/**
 * CalculatorsPanel — Hub das calculadoras fundamentais.
 * Renderizado em Mais > Calculadoras. Não altera navegação principal.
 */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BudgetCalculator } from "./BudgetCalculator";
import { EmergencyFundCalculator } from "./EmergencyFundCalculator";
import { FinancialIndependenceCalculator } from "./FinancialIndependenceCalculator";
import { useCalculatorPreferences } from "@/hooks/useCalculatorPreferences";
import type { AppData } from "@/lib/models";
import type { CoreMetrics } from "@/lib/services/metricsService";

interface Props {
  appData: AppData;
  metrics: CoreMetrics;
}

export function CalculatorsPanel({ appData, metrics }: Props) {
  const { prefs, update } = useCalculatorPreferences();

  return (
    <div className="space-y-4">
      <Card className="glass-card-strong p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Calculadoras fundamentais</p>
            <p className="text-xs text-muted-foreground">Conteúdo educacional. Não constitui recomendação de investimento.</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant={prefs.mode === "simple" ? "default" : "outline"} className="text-xs h-8" onClick={() => update("mode", "simple")}>Simples</Button>
            <Button size="sm" variant={prefs.mode === "detailed" ? "default" : "outline"} className="text-xs h-8" onClick={() => update("mode", "detailed")}>Detalhado</Button>
          </div>
        </div>
      </Card>

      <Card className="glass-card p-4">
        <BudgetCalculator
          metrics={metrics}
          mode={prefs.mode}
          percents={prefs.budgetPercents}
          onPercentsChange={(p) => update("budgetPercents", p)}
        />
      </Card>

      <Card className="glass-card p-4">
        <EmergencyFundCalculator
          appData={appData}
          metrics={metrics}
          mode={prefs.mode}
          months={prefs.emergencyMonths}
          onMonthsChange={(m) => update("emergencyMonths", m)}
        />
      </Card>

      <Card className="glass-card p-4">
        <FinancialIndependenceCalculator
          metrics={metrics}
          mode={prefs.mode}
          desiredMonthlyIncome={prefs.desiredMonthlyIncome}
          onDesiredChange={(v) => update("desiredMonthlyIncome", v)}
        />
      </Card>
    </div>
  );
}