/**
 * cdiTaxService — fornece regras tributárias versionadas para a Calculadora CDI.
 * Nunca hardcode alíquotas em componentes React.
 */
import { supabase } from "@/integrations/supabase/client";
import type { IofRule, TaxRule } from "../types/cdi";

/** Fallback local usado se a rede falhar. Marcado como offline. */
const FALLBACK_IR: TaxRule[] = [
  { id: "fallback-ir-1", jurisdiction: "BR", tax_type: "income_tax", product_category: "fixed_income_taxable", min_days: 0, max_days: 180, rate: 0.225, calculation_base: "yield", effective_date: "2005-01-01", source_url: null, source_name: "Fallback local", last_verified_at: "2026-07-11", version: "1.0-fallback", active: true },
  { id: "fallback-ir-2", jurisdiction: "BR", tax_type: "income_tax", product_category: "fixed_income_taxable", min_days: 181, max_days: 360, rate: 0.20, calculation_base: "yield", effective_date: "2005-01-01", source_url: null, source_name: "Fallback local", last_verified_at: "2026-07-11", version: "1.0-fallback", active: true },
  { id: "fallback-ir-3", jurisdiction: "BR", tax_type: "income_tax", product_category: "fixed_income_taxable", min_days: 361, max_days: 720, rate: 0.175, calculation_base: "yield", effective_date: "2005-01-01", source_url: null, source_name: "Fallback local", last_verified_at: "2026-07-11", version: "1.0-fallback", active: true },
  { id: "fallback-ir-4", jurisdiction: "BR", tax_type: "income_tax", product_category: "fixed_income_taxable", min_days: 721, max_days: null, rate: 0.15, calculation_base: "yield", effective_date: "2005-01-01", source_url: null, source_name: "Fallback local", last_verified_at: "2026-07-11", version: "1.0-fallback", active: true },
];

const FALLBACK_IOF: IofRule[] = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  // IOF regressivo aproximado, fica 0 no dia 30
  const rate = day >= 30 ? 0 : Math.max(0, Math.round((96 - (day - 1) * (96 / 29)) ) / 100);
  return { id: `fallback-iof-${day}`, product_category: "fixed_income_taxable", holding_day: day, rate, effective_date: "1999-01-01", source_url: null, source_name: "Fallback local", last_verified_at: "2026-07-11", version: "1.0-fallback", active: true };
});

export interface IncomeTaxLookup {
  rate: number;
  rule: TaxRule | null;
  version: string;
}

export interface IofLookup {
  rate: number;
  rule: IofRule | null;
  version: string;
}

/** Seleciona alíquota IR conforme dias corridos e categoria. Não hardcoded no componente. */
export function calculateIncomeTaxRate(days: number, category: string, rules: TaxRule[]): IncomeTaxLookup {
  if (category === "fixed_income_exempt") {
    const rule = rules.find(r => r.product_category === "fixed_income_exempt" && r.active) ?? null;
    return { rate: 0, rule, version: rule?.version ?? "n/a" };
  }
  const applicable = rules
    .filter(r => r.active && r.tax_type === "income_tax" && r.product_category === category)
    .find(r => days >= r.min_days && (r.max_days === null || days <= r.max_days));
  if (!applicable) return { rate: 0, rule: null, version: "unknown" };
  return { rate: Number(applicable.rate), rule: applicable, version: applicable.version };
}

/** IR calculado sobre rendimento tributável (nunca sobre o principal). */
export function calculateIncomeTax(taxableYield: number, rate: number): number {
  if (!Number.isFinite(taxableYield) || taxableYield <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return taxableYield * rate;
}

/** Localiza a alíquota IOF para o dia de resgate (dia corrido). */
export function calculateIofRate(holdingDay: number, category: string, rules: IofRule[]): IofLookup {
  if (category === "fixed_income_exempt") {
    return { rate: 0, rule: null, version: "exempt" };
  }
  if (!Number.isFinite(holdingDay) || holdingDay < 1) {
    return { rate: 0, rule: null, version: "n/a" };
  }
  if (holdingDay >= 30) return { rate: 0, rule: null, version: "expired" };
  const rule = rules.find(r => r.active && r.product_category === category && r.holding_day === holdingDay) ?? null;
  return { rate: rule ? Number(rule.rate) : 0, rule, version: rule?.version ?? "unknown" };
}

/** IOF calculado sobre rendimento (nunca sobre o principal). */
export function calculateIof(taxableYield: number, rate: number): number {
  if (!Number.isFinite(taxableYield) || taxableYield <= 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return taxableYield * rate;
}

// ---- Data access ---------------------------------------------------------

export async function fetchTaxRules(): Promise<TaxRule[]> {
  try {
    const { data, error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("tax_rules" as any)
      .select("*")
      .eq("active", true);
    if (error) throw error;
    if (!data || (data as unknown as TaxRule[]).length === 0) return FALLBACK_IR;
    return data as unknown as TaxRule[];
  } catch {
    return FALLBACK_IR;
  }
}

export async function fetchIofRules(): Promise<IofRule[]> {
  try {
    const { data, error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("iof_rules" as any)
      .select("*")
      .eq("active", true);
    if (error) throw error;
    if (!data || (data as unknown as IofRule[]).length === 0) return FALLBACK_IOF;
    return data as unknown as IofRule[];
  } catch {
    return FALLBACK_IOF;
  }
}

export const __TEST__ = { FALLBACK_IR, FALLBACK_IOF };