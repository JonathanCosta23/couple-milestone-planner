import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/types";
import { CalculationMemory } from "./CalculationMemory";
import {
  calculateEmergencyFund,
  computeEligibleReserve,
  suggestEmergencyFundRange,
  type IncomeType,
  type ReserveState,
} from "@/lib/services/emergencyFundCalculator";
import type { AppData } from "@/lib/models";
import type { CoreMetrics } from "@/lib/services/metricsService";
import type { CalculatorMode } from "@/hooks/useCalculatorPreferences";

interface Props {
  appData: AppData;
  metrics: CoreMetrics;
  mode: CalculatorMode;
  months: number;
  onMonthsChange: (m: number) => void;
}

const RESERVE_LABEL: Record<ReserveState, string> = {
  not_started: "Não iniciada",
  building: "Em formação",
  basic_complete: "Reserva básica concluída",
  intermediate_complete: "Reserva intermediária concluída",
  extended_complete: "Reserva ampliada concluída",
  insufficient_data: "Dados insuficientes",
};

export function EmergencyFundCalculator({ appData, metrics, mode, months, onMonthsChange }: Props) {
  const [essentialOverride, setEssentialOverride] = useState<string>("");
  const [contributionOverride, setContributionOverride] = useState<string>("");

  const eligibility = useMemo(
    () => computeEligibleReserve(appData.investments.map((i) => ({
      type: i.type, currentBalance: i.currentBalance, liquidity: i.liquidity as string | undefined,
      maturityDate: (i as { maturityDate?: string }).maturityDate, active: i.active,
    }))),
    [appData.investments],
  );

  const essential = essentialOverride.trim() ? Number(essentialOverride) : metrics.essentialExpenses;
  const contribution = contributionOverride.trim() ? Number(contributionOverride) : 0;

  const result = useMemo(() => calculateEmergencyFund({
    essentialMonthlyExpenses: essential,
    months,
    currentEligibleReserve: eligibility.eligibleTotal,
    monthlyContributionToReserve: contribution,
  }), [essential, months, eligibility.eligibleTotal, contribution]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Reserva de emergência</p>
        <p className="text-xs text-muted-foreground">Baseada em despesas essenciais, não no salário total.</p>
      </div>

      <Card className="glass-card p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Quanto custa manter sua vida essencial por mês?</Label>
          <Input type="number" min={0} value={essentialOverride}
            placeholder={metrics.essentialExpenses > 0 ? metrics.essentialExpenses.toString() : "Ex: 4000"}
            onChange={(e) => setEssentialOverride(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Para quantos meses deseja se proteger?</Label>
          <div className="flex gap-1.5 flex-wrap">
            {[3, 6, 9, 12].map((m) => (
              <Button key={m} size="sm" variant={months === m ? "default" : "outline"} className="text-xs h-8"
                onClick={() => onMonthsChange(m)}>{m} meses</Button>
            ))}
          </div>
          {mode === "detailed" && (
            <div className="pt-2">
              <Label className="text-xs">Personalizado (meses)</Label>
              <Input type="number" min={1} max={36} value={months} onChange={(e) => onMonthsChange(Number(e.target.value) || 6)} />
            </div>
          )}
        </div>
      </Card>

      <Card className="glass-card p-4 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Estado</p>
          <Badge variant="secondary" className="text-[10px]">{RESERVE_LABEL[result.state]}</Badge>
        </div>
        <p className="text-lg font-bold">Meta: {formatBRL(result.target)}</p>
        <p className="text-xs text-muted-foreground">Reserva atual elegível: {formatBRL(result.currentEligibleReserve)}</p>
        <p className="text-xs text-muted-foreground">Faltam: {formatBRL(result.gap)}</p>
        <p className="text-xs text-muted-foreground">Progresso: {result.progressPercentage}%</p>
        {result.estimatedMonthsToComplete !== null && result.estimatedMonthsToComplete > 0 && (
          <p className="text-xs text-muted-foreground">Prazo estimado: {result.estimatedMonthsToComplete} meses</p>
        )}
      </Card>

      {eligibility.hasUnclassified && (
        <Card className="glass-card p-3">
          <p className="text-xs text-muted-foreground">
            Parte do seu patrimônio ainda precisa ser classificada para determinar quanto realmente funciona como reserva de emergência.
          </p>
        </Card>
      )}

      {mode === "detailed" && (
        <>
          <Card className="glass-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comparar cenários</p>
            {result.scenarios.map((s) => (
              <div key={s.months} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{s.months} meses</span>
                <span className="font-medium">{formatBRL(s.target)}</span>
              </div>
            ))}
          </Card>

          <Card className="glass-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ativos elegíveis</p>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Elegíveis</span><span>{formatBRL(eligibility.eligibleTotal)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Não elegíveis</span><span>{formatBRL(eligibility.ineligibleTotal)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Sem classificação</span><span>{formatBRL(eligibility.unclassifiedTotal)}</span></div>
          </Card>

          <StabilityHint mode={mode} />

          <Card className="glass-card p-3 space-y-1">
            <Label className="text-xs">Aporte mensal destinado à reserva</Label>
            <Input type="number" min={0} placeholder="0" value={contributionOverride} onChange={(e) => setContributionOverride(e.target.value)} />
          </Card>
        </>
      )}

      <CalculationMemory
        formula="Reserva-alvo = despesas essenciais mensais × meses de proteção"
        inputs={[
          { label: "Despesas essenciais", value: formatBRL(result.essentialMonthlyExpenses) },
          { label: "Meses", value: `${result.months}` },
          { label: "Reserva elegível atual", value: formatBRL(result.currentEligibleReserve) },
        ]}
        intermediate={[
          { label: "Meta", value: formatBRL(result.target) },
          { label: "Faltante", value: formatBRL(result.gap) },
        ]}
        assumptions={[
          "Cálculo usa despesas essenciais, não o salário bruto.",
          "Reserva elegível considera liquidez e baixo risco de perda nominal no curto prazo.",
          "Cenários (3/6/9/12) são referências educacionais e podem ser ajustados.",
        ]}
        limitations={[
          "Estabilidade real da renda depende de contexto individual.",
          "Ativos ainda não classificados não entram na reserva elegível.",
          "Meta atingida não significa 'totalmente protegido' — imprevistos podem exceder a reserva.",
        ]}
        source={{ name: "Conceito de reserva de emergência (educação financeira geral)" }}
      />
    </div>
  );
}

function StabilityHint({ mode }: { mode: CalculatorMode }) {
  const [open, setOpen] = useState(false);
  const [incomeType, setIncomeType] = useState<IncomeType>("clt");
  const [dependents, setDependents] = useState(0);
  const [varies, setVaries] = useState(false);
  const [hasSecond, setHasSecond] = useState(false);
  const [shortDebt, setShortDebt] = useState(false);
  const [medical, setMedical] = useState(false);
  const [recover, setRecover] = useState(3);

  const suggestion = suggestEmergencyFundRange({
    incomeType,
    dependents,
    hasSecondIncome: hasSecond,
    incomeVariesSignificantly: varies,
    hasRelevantInsurance: false,
    hasRecurringMedicalExpenses: medical,
    hasShortTermDebt: shortDebt,
    estimatedMonthsToRecoverIncome: recover,
  });

  if (mode !== "detailed") return null;
  return (
    <Card className="glass-card p-3 space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {open ? "Ocultar" : "Estimar faixa educacional"}
      </button>
      {open && (
        <div className="space-y-2 text-xs">
          <div>
            <Label className="text-xs">Tipo de renda</Label>
            <select value={incomeType} onChange={(e) => setIncomeType(e.target.value as IncomeType)}
              className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1 text-sm">
              <option value="clt">CLT</option>
              <option value="servidor">Servidor</option>
              <option value="pj">PJ</option>
              <option value="autonomo">Autônomo</option>
              <option value="empresario">Empresário</option>
              <option value="aposentado">Aposentado</option>
              <option value="variavel">Renda variável</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Dependentes" value={dependents} onChange={setDependents} />
            <NumField label="Meses p/ recompor" value={recover} onChange={setRecover} />
          </div>
          <Toggle label="Segunda fonte de renda" value={hasSecond} onChange={setHasSecond} />
          <Toggle label="Renda varia muito" value={varies} onChange={setVaries} />
          <Toggle label="Dívidas de curto prazo" value={shortDebt} onChange={setShortDebt} />
          <Toggle label="Despesas médicas recorrentes" value={medical} onChange={setMedical} />
          <p className="pt-1 text-muted-foreground">
            Faixa sugerida: <strong className="text-foreground">{suggestion.minMonths}–{suggestion.maxMonths} meses</strong>. {suggestion.rationale}
          </p>
          <p className="text-[10px] text-muted-foreground italic">Sugestão educacional. Ajuste conforme sua realidade.</p>
        </div>
      )}
    </Card>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}