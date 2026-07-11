import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatBRL } from "@/lib/types";
import { CalculationMemory } from "./CalculationMemory";
import {
  compareWithdrawalScenarios,
  FI_DISCLAIMER,
} from "@/lib/services/financialIndependenceCalculator";
import type { CoreMetrics } from "@/lib/services/metricsService";
import type { CalculatorMode } from "@/hooks/useCalculatorPreferences";

interface Props {
  metrics: CoreMetrics;
  mode: CalculatorMode;
  desiredMonthlyIncome: number;
  onDesiredChange: (v: number) => void;
}

export function FinancialIndependenceCalculator({ metrics, mode, desiredMonthlyIncome, onDesiredChange }: Props) {
  const [customRateStr, setCustomRateStr] = useState<string>("");

  const customRate = customRateStr.trim() ? Number(customRateStr) / 100 : undefined;
  const result = useMemo(
    () => compareWithdrawalScenarios({
      desiredMonthlyIncome,
      currentWealth: metrics.grossWealth,
      customMonthlyRate: mode === "detailed" ? customRate : undefined,
    }),
    [desiredMonthlyIncome, metrics.grossWealth, customRate, mode],
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Independência financeira — cenários educacionais</p>
        <p className="text-xs text-muted-foreground">Compara patrimônios de referência para uma renda mensal desejada.</p>
      </div>

      <Card className="glass-card p-4 space-y-2">
        <Label className="text-xs">Renda mensal desejada</Label>
        <Input type="number" min={0} value={desiredMonthlyIncome || ""}
          placeholder="Ex: 10000"
          onChange={(e) => onDesiredChange(Number(e.target.value) || 0)} />
        <p className="text-[11px] text-muted-foreground">Patrimônio atual considerado: {formatBRL(metrics.grossWealth)}</p>
      </Card>

      <div className="space-y-2">
        {result.scenarios.map((s) => (
          <Card key={s.key} className="glass-card p-3 space-y-1">
            <p className="text-sm font-semibold">{s.label}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Patrimônio de referência: </span>{formatBRL(s.targetWealth)}</div>
              <div><span className="text-muted-foreground">% alcançado: </span>{s.percentAchieved}%</div>
              <div><span className="text-muted-foreground">Faltante: </span>{formatBRL(s.gap)}</div>
              <div><span className="text-muted-foreground">Renda de ref. atual: </span>{formatBRL(s.referenceIncomeFromCurrent)}</div>
            </div>
          </Card>
        ))}
      </div>

      {mode === "detailed" && (
        <Card className="glass-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taxa personalizada</p>
          <Label className="text-xs">Taxa mensal de retirada (%)</Label>
          <Input type="number" min={0} step={0.1} value={customRateStr}
            placeholder="Ex: 0.35"
            onChange={(e) => setCustomRateStr(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Ex: 0,35% ao mês equivale a ~285× a renda desejada.</p>
        </Card>
      )}

      <Card className="glass-card p-3">
        <p className="text-[11px] text-muted-foreground italic leading-relaxed">{FI_DISCLAIMER}</p>
      </Card>

      <CalculationMemory
        formula="Patrimônio de referência = renda mensal desejada ÷ taxa mensal de retirada"
        inputs={[
          { label: "Renda mensal desejada", value: formatBRL(desiredMonthlyIncome) },
          { label: "Patrimônio atual", value: formatBRL(metrics.grossWealth) },
          { label: "Taxa personalizada", value: customRate ? `${(customRate * 100).toFixed(2)}%` : "—" },
        ]}
        intermediate={result.scenarios.map((s) => ({
          label: `${s.label} — meta`,
          value: formatBRL(s.targetWealth),
        }))}
        assumptions={[
          "Taxa mensal representa uma retirada hipotética constante.",
          "Multiplicadores 200 / 250 / 333 são referências educacionais.",
          "Renda mensal desejada é bruta e independente de tributação.",
        ]}
        limitations={[
          "Cenários não consideram inflação, impostos e custos operacionais.",
          "Volatilidade e mudanças na renda dos ativos alteram o resultado.",
          "Não há garantia de preservação do principal.",
        ]}
        source={{ name: "Cenários hipotéticos de retirada mensal — conteúdo educacional" }}
      />
    </div>
  );
}