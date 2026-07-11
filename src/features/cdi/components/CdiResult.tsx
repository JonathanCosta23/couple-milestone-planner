import { Button } from "@/components/ui/button";
import type { CdiCalculationResult } from "../types/cdi";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { CdiCalculationBreakdown } from "./CdiCalculationBreakdown";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  result: CdiCalculationResult;
  onCompare?: () => void;
}

export function CdiResult({ result, onCompare }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor líquido estimado</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{brl(result.netValue)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Estimativa. O CDI real pode variar no período.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Total investido" value={brl(result.totalInvested)} />
        <Metric label="Rendimento bruto" value={brl(result.grossYield)} />
        <Metric label="Impostos estimados" value={brl(result.iof + result.incomeTax)} />
        <Metric label="Rendimento líquido" value={brl(result.netYield)} />
        {result.input.inflationAnnualRate != null && (
          <>
            <Metric label="Valor real estimado" value={brl(result.realValue)} />
            <Metric label="Ganho real estimado" value={brl(result.realYield)} />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowDetails(v => !v)}>
          {showDetails ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
          Entender o cálculo
        </Button>
        {onCompare && (
          <Button size="sm" variant="outline" className="text-xs" onClick={onCompare}>
            Comparar cenários
          </Button>
        )}
      </div>

      {showDetails && (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <CdiCalculationBreakdown result={result} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}