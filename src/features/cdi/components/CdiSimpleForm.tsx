import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import type { CdiSimulationInput, TaxRegime } from "../types/cdi";
import { estimateBusinessDaysFromMonths, estimateBusinessDaysFromYears } from "../services/businessDaysService";

interface Props {
  onSubmit: (input: CdiSimulationInput) => void;
}

export function CdiSimpleForm({ onSubmit }: Props) {
  const [principal, setPrincipal] = useState<string>("10000");
  const [cdiPercent, setCdiPercent] = useState<string>("100");
  const [cdiAnnual, setCdiAnnual] = useState<string>("10.65");
  const [periodValue, setPeriodValue] = useState<string>("2");
  const [periodUnit, setPeriodUnit] = useState<"months" | "years">("years");
  const [regime, setRegime] = useState<TaxRegime>("taxable");

  const handleSubmit = () => {
    const p = Number(principal.replace(",", "."));
    const pct = Number(cdiPercent.replace(",", ".")) / 100;
    const cdi = Number(cdiAnnual.replace(",", ".")) / 100;
    const period = Number(periodValue.replace(",", "."));
    const bd = periodUnit === "years" ? estimateBusinessDaysFromYears(period) : estimateBusinessDaysFromMonths(period);
    onSubmit({ principal: p, cdiPercent: pct, cdiAnnualRate: cdi, businessDays: bd, taxRegime: regime });
  };

  return (
    <div className="space-y-3">
      <Field label="Quanto deseja investir? (R$)">
        <Input inputMode="decimal" value={principal} onChange={e => setPrincipal(e.target.value)} />
      </Field>
      <Field label="Quanto o produto rende do CDI? (%)">
        <Input inputMode="decimal" value={cdiPercent} onChange={e => setCdiPercent(e.target.value)} />
      </Field>
      <Field label="CDI anual para a simulação (%)">
        <Input inputMode="decimal" value={cdiAnnual} onChange={e => setCdiAnnual(e.target.value)} />
        <p className="text-[11px] text-muted-foreground">Informe a taxa CDI que quer testar. Nenhum valor é presumido.</p>
      </Field>
      <Field label="Por quanto tempo?">
        <div className="flex gap-2">
          <Input inputMode="decimal" value={periodValue} onChange={e => setPeriodValue(e.target.value)} className="flex-1" />
          <Select value={periodUnit} onValueChange={(v) => setPeriodUnit(v as "months" | "years")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="months">Meses</SelectItem>
              <SelectItem value="years">Anos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Field>
      <Field label="Tributação">
        <Select value={regime} onValueChange={(v) => setRegime(v as TaxRegime)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="taxable">Tributável (CDB, Tesouro Selic)</SelectItem>
            <SelectItem value="exempt">Isento (LCI, LCA)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Button className="w-full" onClick={handleSubmit}>Calcular estimativa</Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}