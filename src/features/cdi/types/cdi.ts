/**
 * Tipos da Calculadora CDI.
 * Contrato entre serviços puros e componentes React.
 */

export type TaxRegime = "taxable" | "exempt";

export interface CdiSimulationInput {
  principal: number;
  cdiPercent: number;      // ex: 1.10 para 110% do CDI
  cdiAnnualRate: number;   // ex: 0.10 para 10% a.a.
  businessDays: number;    // dias úteis totais
  taxRegime: TaxRegime;
  additionalContribution?: {
    amount: number;
    frequencyMonths: number; // 1 = mensal
    count: number;
  };
  annualFeeRate?: number;    // taxa administrativa a.a.
  otherCosts?: number;       // custos fixos totais informados
  inflationAnnualRate?: number;
  redeemHoldingDay?: number; // dia corrido de resgate (para IOF)
}

export interface ContributionSlice {
  principal: number;
  entryDay: number; // dia útil de entrada relativo ao início
  businessDays: number;
  grossValue: number;
  grossYield: number;
  incomeTax: number;
  iof: number;
  netValue: number;
}

export interface CdiCalculationResult {
  input: CdiSimulationInput;
  dailyRate: number;
  productDailyRate: number;
  totalInvested: number;
  grossValue: number;
  grossYield: number;
  costs: number;
  iof: number;
  incomeTax: number;
  netValue: number;
  netYield: number;
  inflationAccumulated: number;
  realValue: number;
  realYield: number;
  incomeTaxRate: number;
  iofRate: number;
  contributions: ContributionSlice[];
  rulesVersion: {
    incomeTax?: string;
    iof?: string;
  };
  sources: string[];
  warnings: string[];
  mode: "simple" | "detailed" | "historical";
}

export interface TaxRule {
  id: string;
  jurisdiction: string;
  tax_type: string;
  product_category: string;
  min_days: number;
  max_days: number | null;
  rate: number;
  calculation_base: string;
  effective_date: string;
  source_url: string | null;
  source_name: string | null;
  last_verified_at: string | null;
  version: string;
  active: boolean;
}

export interface IofRule {
  id: string;
  product_category: string;
  holding_day: number;
  rate: number;
  effective_date: string;
  source_url: string | null;
  source_name: string | null;
  last_verified_at: string | null;
  version: string;
  active: boolean;
}

export interface CdiRateMetadata {
  annualRate: number;
  source: string;
  fetchedAt: string | null;
  isUserProvided: boolean;
  stale?: boolean;
}

export interface ValidationIssue {
  field: string;
  message: string;
}