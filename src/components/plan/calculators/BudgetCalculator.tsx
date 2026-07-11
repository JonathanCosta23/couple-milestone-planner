import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/types";
import { CalculationMemory } from "./CalculationMemory";
import {
  calculateBudgetDistribution,
  classifyBudgetDistribution,
  DEFAULT_BUDGET_PERCENTS,
  type BudgetInput,
  type BudgetResult,
} from "@/lib/services/budgetCalculator";
import type { CoreMetrics } from "@/lib/services/metricsService";
import type { CalculatorMode } from "@/hooks/useCalculatorPreferences";

interface Props {
  metrics: CoreMetrics;
  mode: CalculatorMode;
  percents: { needs: number; wants: number; wealth: number };
  onPercentsChange: (p: { needs: number; wants: number; wealth: number }) => void;
}

export function BudgetCalculator({ metrics, mode, percents, onPercentsChange }: Props) {
  const [netIncomeOverride, setNetIncomeOverride] = useState<string>("");
  const [essentialOverride, setEssentialOverride] = useState<string>("");
  const [nonEssentialOverride, setNonEssentialOverride] = useState<string>("");

  const input: BudgetInput = useMemo(() => ({
    netIncome: parseNumber(netIncomeOverride, metrics.totalIncome),
    essentialExpenses: parseNumber(essentialOverride, metrics.essentialExpenses),
    nonEssentialExpenses: parseNumber(nonEssentialOverride, metrics.nonEssentialExpenses),
    debtPayments: metrics.totalDebtPayment,
    contributions: metrics.monthlyContribution,
    percents,
  }), [metrics, netIncomeOverride, essentialOverride, nonEssentialOverride, percents]);

  const result = useMemo(() => calculateBudgetDistribution(input), [input]);
  const summary = classifyBudgetDistribution(result);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Diagnóstico do orçamento</p>
        <p className="text-xs text-muted-foreground">Distribuição educacional 50-30-20 sobre a renda líquida.</p>
      </div>

      <Card className="glass-card p-4 space-y-2">
        <p className="text-lg font-bold">{summary.headline}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{summary.detail}</p>
      </Card>

      <CategoryRow name="Necessidades essenciais" cat={result.needs} />
      <CategoryRow name="Qualidade de vida e desejos" cat={result.wants} />
      <CategoryRow name="Construção patrimonial" cat={result.wealth} />

      <Card className="glass-card p-3 space-y-1">
        <RowLine label="Renda líquida" value={formatBRL(result.netIncome)} />
        <RowLine label="Dívidas (fora de investimento)" value={formatBRL(result.debts.actual)} />
        <RowLine label="Renda livre" value={formatBRL(result.freeIncome)} />
        <RowLine label="Taxa de poupança" value={`${(result.savingsRate * 100).toFixed(0)}%`} />
      </Card>

      {mode === "detailed" && (
        <Card className="glass-card p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ajustar percentuais</p>
          <PercentInput label="Necessidades" value={percents.needs} onChange={(v) => onPercentsChange({ ...percents, needs: v })} />
          <PercentInput label="Qualidade de vida" value={percents.wants} onChange={(v) => onPercentsChange({ ...percents, wants: v })} />
          <PercentInput label="Construção patrimonial" value={percents.wealth} onChange={(v) => onPercentsChange({ ...percents, wealth: v })} />
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => onPercentsChange(DEFAULT_BUDGET_PERCENTS)}>
            Restaurar 50/30/20
          </Button>

          <div className="pt-2 space-y-2 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ajustar dados (opcional)</p>
            <OverrideField label="Renda líquida mensal" placeholder={metrics.totalIncome.toString()} value={netIncomeOverride} onChange={setNetIncomeOverride} />
            <OverrideField label="Despesas essenciais" placeholder={metrics.essentialExpenses.toString()} value={essentialOverride} onChange={setEssentialOverride} />
            <OverrideField label="Despesas não essenciais" placeholder={metrics.nonEssentialExpenses.toString()} value={nonEssentialOverride} onChange={setNonEssentialOverride} />
          </div>
        </Card>
      )}

      <CalculationMemory
        formula="Categoria = renda líquida × percentual da categoria"
        inputs={[
          { label: "Renda líquida", value: formatBRL(result.netIncome) },
          { label: "Despesas essenciais", value: formatBRL(result.needs.actual) },
          { label: "Despesas não essenciais", value: formatBRL(result.wants.actual) },
          { label: "Dívidas", value: formatBRL(result.debts.actual) },
          { label: "Aportes", value: formatBRL(result.wealth.actual) },
          { label: "% Necessidades", value: fmtPct(percents.needs) },
          { label: "% Qualidade de vida", value: fmtPct(percents.wants) },
          { label: "% Construção patrimonial", value: fmtPct(percents.wealth) },
        ]}
        intermediate={[
          { label: "Referência necessidades", value: formatBRL(result.needs.reference) },
          { label: "Referência qualidade de vida", value: formatBRL(result.wants.reference) },
          { label: "Referência construção patrimonial", value: formatBRL(result.wealth.reference) },
        ]}
        assumptions={[
          "Percentuais 50/30/20 são referências educacionais, não regras universais.",
          "Dívidas não são contabilizadas dentro de construção patrimonial.",
          "Renda líquida representa o valor efetivamente recebido no mês.",
        ]}
        limitations={[
          "Situações irregulares (renda sazonal, meses atípicos) exigem análise adicional.",
          "Percentuais devem ser ajustados à realidade individual.",
        ]}
        source={{ name: "Elizabeth Warren — All Your Worth (conceito 50/30/20)" }}
      />
    </div>
  );
}

function BadgeForState(state: BudgetResult["needs"]["state"]) {
  const map: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
    on_reference: { label: "Dentro da referência", variant: "secondary" },
    above_reference: { label: "Acima da referência", variant: "outline" },
    below_reference: { label: "Abaixo da referência", variant: "outline" },
    incomplete_data: { label: "Dados incompletos", variant: "outline" },
    rigid_structure: { label: "Estrutura rígida", variant: "outline" },
    growing_capacity: { label: "Capacidade em evolução", variant: "outline" },
  };
  return map[state] ?? map.incomplete_data;
}

function CategoryRow({ name, cat }: { name: string; cat: BudgetResult["needs"] }) {
  const b = BadgeForState(cat.state);
  return (
    <Card className="glass-card p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{name}</p>
        <Badge variant={b.variant} className="text-[10px]">{b.label}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">Referência: </span>{formatBRL(cat.reference)}</div>
        <div><span className="text-muted-foreground">Real: </span>{formatBRL(cat.actual)}</div>
        <div><span className="text-muted-foreground">% renda: </span>{(cat.percentOfIncome * 100).toFixed(0)}%</div>
        <div><span className="text-muted-foreground">Diferença: </span>{formatBRL(cat.diff)}</div>
      </div>
    </Card>
  );
}

function RowLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PercentInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} max={100} step={1} value={Math.round(value * 100)}
        onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))) / 100)} />
    </div>
  );
}

function OverrideField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function parseNumber(raw: string, fallback: number): number {
  if (!raw.trim()) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}