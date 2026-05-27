/**
 * projectionService — Single source of truth for all projections.
 * Nominal, Net (after taxes), Real (inflation-adjusted).
 */

import type { PlanConfig, MonthRecord } from "@/lib/types";
import { generateProjection } from "@/lib/calculator";
import {
  DEFAULT_ASSUMPTIONS,
  type FinancialAssumptions,
} from "@/lib/financialAssumptions";

export interface ProjectionResult {
  nominal: ProjectionPoint[];
  net: ProjectionPoint[];
  real: ProjectionPoint[];
  monthsToTargetNominal: number | null;
  monthsToTargetNet: number | null;
  monthsToTargetReal: number | null;
  finalNominal: number;
  finalNet: number;
  finalReal: number;
  estimatedPassiveIncome: number; // monthly from 4% rule on net
  /** Premissas efetivamente aplicadas — auditáveis pela UI. */
  assumptionsUsed: FinancialAssumptions;
}

export interface ProjectionPoint {
  monthIndex: number;
  date: string;
  balance: number;
  deposited: number;
  interest: number;
}

/**
 * Compat: hooks antigos passavam `{ inflationRate, irRate }`. Mantido para
 * não quebrar chamadores externos; novos consumidores devem passar
 * `FinancialAssumptions` completo.
 */
export type ProjectionAssumptionsInput = Partial<FinancialAssumptions> & {
  inflationRate?: number;
  irRate?: number;
};

function normalizeAssumptions(input?: ProjectionAssumptionsInput): FinancialAssumptions {
  if (!input) return DEFAULT_ASSUMPTIONS;
  return {
    expectedReturnRate: input.expectedReturnRate ?? DEFAULT_ASSUMPTIONS.expectedReturnRate,
    cdbPctOfCdi: input.cdbPctOfCdi ?? DEFAULT_ASSUMPTIONS.cdbPctOfCdi,
    inflationRate: input.inflationRate ?? DEFAULT_ASSUMPTIONS.inflationRate,
    taxRate: input.taxRate ?? input.irRate ?? DEFAULT_ASSUMPTIONS.taxRate,
    iofRate: input.iofRate ?? DEFAULT_ASSUMPTIONS.iofRate,
    withdrawalRate: input.withdrawalRate ?? DEFAULT_ASSUMPTIONS.withdrawalRate,
  };
}

export function calculateProjection(
  config: PlanConfig,
  mode: "planned" | "actual",
  monthRecords: MonthRecord[],
  startDate: string,
  assumptions?: ProjectionAssumptionsInput
): ProjectionResult {
  const used = normalizeAssumptions(assumptions);
  const inflation = used.inflationRate;
  const irRate = used.taxRate;

  const rawProjection = generateProjection(config, mode, monthRecords, startDate);
  
  const nominal: ProjectionPoint[] = rawProjection.map(r => ({
    monthIndex: r.monthIndex,
    date: r.date,
    balance: r.totalBalance,
    deposited: r.totalDeposited,
    interest: r.totalInterest,
  }));

  // Net: subtract estimated IR on gains
  const net: ProjectionPoint[] = rawProjection.map(r => {
    const gains = Math.max(0, r.totalBalance - r.totalDeposited);
    const taxOnGains = gains * irRate;
    return {
      monthIndex: r.monthIndex,
      date: r.date,
      balance: r.totalBalance - taxOnGains,
      deposited: r.totalDeposited,
      interest: r.totalInterest - taxOnGains,
    };
  });

  // Real: discount by accumulated inflation
  const monthlyInflation = Math.pow(1 + inflation, 1 / 12) - 1;
  const real: ProjectionPoint[] = net.map((p, i) => {
    const deflator = Math.pow(1 + monthlyInflation, i + 1);
    return {
      ...p,
      balance: p.balance / deflator,
      deposited: p.deposited / deflator,
      interest: p.interest / deflator,
    };
  });

  const targetAmount = config.targetAmount;
  const monthsToTargetNominal = findCrossing(nominal, targetAmount);
  const monthsToTargetNet = findCrossing(net, targetAmount);
  const monthsToTargetReal = findCrossing(real, targetAmount);

  const lastNominal = nominal[nominal.length - 1]?.balance ?? 0;
  const lastNet = net[net.length - 1]?.balance ?? 0;
  const lastReal = real[real.length - 1]?.balance ?? 0;

  // Renda passiva estimada: regra de retirada anual sobre patrimônio líquido.
  const estimatedPassiveIncome = (lastNet * used.withdrawalRate) / 12;

  return {
    nominal,
    net,
    real,
    monthsToTargetNominal,
    monthsToTargetNet,
    monthsToTargetReal,
    finalNominal: lastNominal,
    finalNet: lastNet,
    finalReal: lastReal,
    estimatedPassiveIncome,
    assumptionsUsed: used,
  };
}

function findCrossing(points: ProjectionPoint[], target: number): number | null {
  const idx = points.findIndex(p => p.balance >= target);
  return idx >= 0 ? idx + 1 : null;
}
