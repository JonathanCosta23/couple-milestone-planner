import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemo, useState } from "react";
import { compareCdiScenarios, type CdiScenarioInput } from "../services/cdiCalculator";
import type { CdiSimulationInput, IofRule, TaxRule } from "../types/cdi";

interface Props {
  base: CdiSimulationInput;
  taxRules: TaxRule[];
  iofRules: IofRule[];
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CdiComparison({ base, taxRules, iofRules }: Props) {
  const [percents, setPercents] = useState<string[]>(["90", "100", "110"]);
  const [custom, setCustom] = useState("");

  const scenarios = useMemo<CdiScenarioInput[]>(() => {
    const items = [...percents];
    if (custom.trim()) items.push(custom);
    return items
      .map(p => Number(p.replace(",", ".")))
      .filter(p => Number.isFinite(p) && p >= 0)
      .map(p => ({ ...base, label: `${p}% do CDI`, cdiPercent: p / 100 }));
  }, [base, percents, custom]);

  const results = useMemo(() => compareCdiScenarios(scenarios, { taxRules, iofRules }), [scenarios, taxRules, iofRules]);

  const maxNet = results.reduce((m, r) => Math.max(m, r.netValue), 0);
  const minNet = results.reduce((m, r) => (r.netValue < m ? r.netValue : m), Number.POSITIVE_INFINITY);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">Comparação de cenários</p>
        <p className="text-xs text-muted-foreground">Mesmo principal, prazo e tributação. Sem indicar produto adequado.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {percents.map((p, i) => (
          <div key={i} className="w-20">
            <Label className="text-[11px]">% CDI</Label>
            <Input inputMode="decimal" value={p} onChange={e => {
              const next = [...percents]; next[i] = e.target.value; setPercents(next);
            }} />
          </div>
        ))}
        <div className="w-24">
          <Label className="text-[11px]">Personalizado</Label>
          <Input inputMode="decimal" value={custom} onChange={e => setCustom(e.target.value)} placeholder="ex: 115" />
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setPercents(p => [...p, "100"])}>
          + cenário
        </Button>
      </div>

      <ul className="divide-y divide-border/60 rounded-md border border-border/60">
        {results.map(r => {
          const isMax = r.netValue === maxNet;
          const isMin = r.netValue === minNet && results.length > 1 && minNet !== maxNet;
          return (
            <li key={r.label} className="grid gap-1 px-3 py-2 sm:grid-cols-5 sm:items-center">
              <p className="text-xs font-semibold sm:col-span-1">{r.label}</p>
              <p className="text-[11px] text-muted-foreground">Bruto: <span className="font-mono">{brl(r.grossValue)}</span></p>
              <p className="text-[11px] text-muted-foreground">Impostos: <span className="font-mono">{brl(r.iof + r.incomeTax)}</span></p>
              <p className="text-[11px] text-muted-foreground">Líquido: <span className="font-mono">{brl(r.netValue)}</span></p>
              <p className="text-[11px]">
                {isMax && <span className="text-muted-foreground">maior resultado líquido nesta simulação</span>}
                {isMin && <span className="text-muted-foreground">menor resultado líquido nesta simulação</span>}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Um percentual maior do CDI não indica automaticamente melhor escolha: liquidez, prazo, tributação, custos, risco do emissor e cobertura aplicável também influenciam.
      </p>
    </div>
  );
}