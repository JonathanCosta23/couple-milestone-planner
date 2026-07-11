import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import type { CdiSimulationInput, TaxRegime } from "../types/cdi";
import { countBusinessDaysBetween, estimateBusinessDaysFromMonths } from "../services/businessDaysService";

interface Props {
  onSubmit: (input: CdiSimulationInput) => void;
}

export function CdiAdvancedForm({ onSubmit }: Props) {
  const [principal, setPrincipal] = useState("10000");
  const [cdiPercent, setCdiPercent] = useState("110");
  const [cdiAnnual, setCdiAnnual] = useState("10.65");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [contribAmount, setContribAmount] = useState("0");
  const [contribCount, setContribCount] = useState("0");
  const [contribFreqMonths, setContribFreqMonths] = useState("1");
  const [feeAnnual, setFeeAnnual] = useState("0");
  const [otherCosts, setOtherCosts] = useState("0");
  const [inflation, setInflation] = useState("4.5");
  const [regime, setRegime] = useState<TaxRegime>("taxable");

  const handleSubmit = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const businessDays = countBusinessDaysBetween(start, end) ?? estimateBusinessDaysFromMonths(24);
    const redeemCalendarDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    const input: CdiSimulationInput = {
      principal: Number(principal.replace(",", ".")),
      cdiPercent: Number(cdiPercent.replace(",", ".")) / 100,
      cdiAnnualRate: Number(cdiAnnual.replace(",", ".")) / 100,
      businessDays,
      taxRegime: regime,
      additionalContribution: Number(contribCount) > 0 ? {
        amount: Number(contribAmount.replace(",", ".")),
        frequencyMonths: Math.max(1, Number(contribFreqMonths)),
        count: Math.max(0, Number(contribCount)),
      } : undefined,
      annualFeeRate: Number(feeAnnual.replace(",", ".")) / 100,
      otherCosts: Number(otherCosts.replace(",", ".")),
      inflationAnnualRate: Number(inflation.replace(",", ".")) / 100,
      redeemHoldingDay: redeemCalendarDays,
    };
    onSubmit(input);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor inicial (R$)"><Input inputMode="decimal" value={principal} onChange={e => setPrincipal(e.target.value)} /></Field>
        <Field label="% do CDI"><Input inputMode="decimal" value={cdiPercent} onChange={e => setCdiPercent(e.target.value)} /></Field>
        <Field label="CDI a.a. (%)"><Input inputMode="decimal" value={cdiAnnual} onChange={e => setCdiAnnual(e.target.value)} /></Field>
        <Field label="Tributação">
          <Select value={regime} onValueChange={(v) => setRegime(v as TaxRegime)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="taxable">Tributável</SelectItem>
              <SelectItem value="exempt">Isento</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data inicial"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Field>
        <Field label="Data final"><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></Field>
      </div>

      <details className="rounded-md border border-border/60 bg-muted/20 p-3">
        <summary className="cursor-pointer text-xs font-medium">Aportes adicionais</summary>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Field label="Valor"><Input inputMode="decimal" value={contribAmount} onChange={e => setContribAmount(e.target.value)} /></Field>
          <Field label="Qtd"><Input inputMode="numeric" value={contribCount} onChange={e => setContribCount(e.target.value)} /></Field>
          <Field label="Freq (meses)"><Input inputMode="numeric" value={contribFreqMonths} onChange={e => setContribFreqMonths(e.target.value)} /></Field>
        </div>
      </details>

      <details className="rounded-md border border-border/60 bg-muted/20 p-3">
        <summary className="cursor-pointer text-xs font-medium">Custos e inflação</summary>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Field label="Taxa adm. a.a. (%)"><Input inputMode="decimal" value={feeAnnual} onChange={e => setFeeAnnual(e.target.value)} /></Field>
          <Field label="Outros custos (R$)"><Input inputMode="decimal" value={otherCosts} onChange={e => setOtherCosts(e.target.value)} /></Field>
          <Field label="Inflação a.a. (%)"><Input inputMode="decimal" value={inflation} onChange={e => setInflation(e.target.value)} /></Field>
        </div>
      </details>

      <Button className="w-full" onClick={handleSubmit}>Calcular simulação detalhada</Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium">{label}</Label>
      {children}
    </div>
  );
}