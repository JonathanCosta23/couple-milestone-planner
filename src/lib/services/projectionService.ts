/**
 * projectionService — Single source of truth for all projections.
 * Nominal, Net (after taxes), Real (inflation-adjusted).
 */

import type { PlanConfig, MonthRecord } from "@/lib/types";
import { generateProjection } from "@/lib/calculator";

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
}

export interface ProjectionPoint {
  monthIndex: number;
  date: string;
  balance: number;
  deposited: number;
  interest: number;
}

export interface ProjectionAssumptions {
  selicRate: number;
  cdbPct: number;
  inflationRate: number;
  irRate: number;
  iofRate: number;
}

export function calculateProjection(
  config: PlanConfig,
  mode: "planned" | "actual",
  monthRecords: MonthRecord[],
  startDate: string,
  assumptions?: Partial<ProjectionAssumptions>
): ProjectionResult {
  const inflation = assumptions?.inflationRate ?? 0.045;
  const irRate = assumptions?.irRate ?? 0.15;
  
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

  // Estimated passive income: 4% rule on net wealth, monthly
  const estimatedPassiveIncome = lastNet * 0.04 / 12;

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
  };
}

function findCrossing(points: ProjectionPoint[], target: number): number | null {
  const idx = points.findIndex(p => p.balance >= target);
  return idx >= 0 ? idx + 1 : null;
}
