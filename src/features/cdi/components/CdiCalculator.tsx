import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { calculateCdiInvestment } from "../services/cdiCalculator";
import { useTaxRules } from "../hooks/useTaxRules";
import type { CdiCalculationResult, CdiSimulationInput } from "../types/cdi";
import { CdiSimpleForm } from "./CdiSimpleForm";
import { CdiAdvancedForm } from "./CdiAdvancedForm";
import { CdiResult } from "./CdiResult";
import { CdiComparison } from "./CdiComparison";

type Mode = "simple" | "detailed";

export function CdiCalculator() {
  const { taxRules, iofRules, loading } = useTaxRules();
  const [mode, setMode] = useState<Mode>("simple");
  const [result, setResult] = useState<CdiCalculationResult | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [lastInput, setLastInput] = useState<CdiSimulationInput | null>(null);

  const handleSimple = (input: CdiSimulationInput) => {
    setLastInput(input);
    setResult(calculateCdiInvestment(input, { taxRules, iofRules }, "simple"));
    setCompareOpen(false);
  };
  const handleAdvanced = (input: CdiSimulationInput) => {
    setLastInput(input);
    setResult(calculateCdiInvestment(input, { taxRules, iofRules }, "detailed"));
    setCompareOpen(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Calculadora CDI</h2>
            <p className="text-xs text-muted-foreground">Simule bruto, custos, IOF, IR e ganho real. Educacional. Sem recomendação de produto.</p>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant={mode === "simple" ? "default" : "outline"} className="text-xs h-8" onClick={() => setMode("simple")}>Simples</Button>
            <Button size="sm" variant={mode === "detailed" ? "default" : "outline"} className="text-xs h-8" onClick={() => setMode("detailed")}>Detalhado</Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        {mode === "simple"
          ? <CdiSimpleForm onSubmit={handleSimple} />
          : <CdiAdvancedForm onSubmit={handleAdvanced} />}
        {loading && <p className="mt-2 text-[11px] text-muted-foreground">Carregando regras tributárias…</p>}
      </Card>

      {result && (
        <Card className="p-4">
          <CdiResult result={result} onCompare={() => setCompareOpen(v => !v)} />
        </Card>
      )}

      {compareOpen && lastInput && (
        <Card className="p-4">
          <CdiComparison base={lastInput} taxRules={taxRules} iofRules={iofRules} />
        </Card>
      )}
    </div>
  );
}