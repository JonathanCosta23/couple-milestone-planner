import { buildCdiCalculationBreakdown } from "../services/cdiCalculator";
import type { CdiCalculationResult } from "../types/cdi";

interface Props {
  result: CdiCalculationResult;
}

export function CdiCalculationBreakdown({ result }: Props) {
  const rows = buildCdiCalculationBreakdown(result);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">Entender o cálculo</p>
        <p className="text-xs text-muted-foreground">Fórmulas, premissas e regras aplicadas nesta simulação.</p>
      </div>
      <ul className="divide-y divide-border/60 rounded-md border border-border/60">
        {rows.map(r => (
          <li key={r.label} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium">{r.label}</p>
              {r.hint && <p className="text-[11px] text-muted-foreground">{r.hint}</p>}
            </div>
            <p className="font-mono text-xs">{r.value}</p>
          </li>
        ))}
      </ul>
      {result.sources.length > 0 && (
        <div className="rounded-md bg-muted/40 p-3">
          <p className="text-xs font-semibold">Fontes utilizadas</p>
          <ul className="mt-1 space-y-0.5">
            {result.sources.map(s => (
              <li key={s} className="text-[11px] text-muted-foreground">{s}</li>
            ))}
          </ul>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Limitações desta simulação</p>
          <ul className="mt-1 space-y-0.5">
            {result.warnings.map(w => (
              <li key={w} className="text-[11px] text-muted-foreground">{w}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Conteúdo educacional. Não constitui recomendação de investimento nem promessa de retorno.
      </p>
    </div>
  );
}