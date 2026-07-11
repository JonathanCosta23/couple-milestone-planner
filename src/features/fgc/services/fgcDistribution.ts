/**
 * fgcDistribution — simulador educacional.
 * NÃO recomenda banco. NÃO executa transação. NÃO promete risco zero.
 */

import {
  FGC_DISCLAIMER_DISTRIBUTION,
  FGC_DISCLAIMER_MARGIN,
  FGC_DISCLAIMER_PROJECTION,
  type FgcDistributionInput,
  type FgcDistributionResult,
} from "../types/fgc";
import { calculatePrudentialLimit } from "./fgcCalculator";

export function calculateMinimumConglomerates(totalValue: number, operationalLimit: number): number {
  if (operationalLimit <= 0) return 0;
  if (totalValue <= 0) return 0;
  return Math.ceil(totalValue / operationalLimit);
}

export function buildGenericDistributionScenario(input: FgcDistributionInput): FgcDistributionResult {
  const officialLimit = Math.max(0, input.officialLimit);
  const prudentialLimit = calculatePrudentialLimit(officialLimit, input.prudentialMargin);
  const existing = input.existingExposureByConglomerate ?? {};

  const disclaimers: string[] = [
    FGC_DISCLAIMER_DISTRIBUTION,
    FGC_DISCLAIMER_MARGIN,
  ];

  if (input.projectedYieldRate && input.projectedTermMonths) {
    disclaimers.push(FGC_DISCLAIMER_PROJECTION);
  }

  if (prudentialLimit <= 0 || input.totalToDistribute <= 0) {
    return {
      officialLimit,
      prudentialLimit,
      minimumConglomerates: 0,
      availableCapacity: 0,
      allocations: [],
      unallocated: Math.max(0, input.totalToDistribute),
      disclaimers,
    };
  }

  // Capacidade restante em conglomerados existentes (verificados pelo usuário).
  const availableCapacity = Object.values(existing).reduce((sum, exp) => {
    return sum + Math.max(0, prudentialLimit - exp);
  }, 0);

  // Alocação genérica: preenche primeiro capacidade dos existentes; depois usa
  // conglomerados genéricos (A, B, C…) até esgotar o valor.
  let remaining = input.totalToDistribute;
  const allocations: Array<{ conglomerateLabel: string; amount: number }> = [];

  for (const [key, currentExposure] of Object.entries(existing)) {
    if (remaining <= 0) break;
    const capacity = Math.max(0, prudentialLimit - currentExposure);
    if (capacity <= 0) continue;
    const alloc = Math.min(capacity, remaining);
    allocations.push({ conglomerateLabel: key, amount: alloc });
    remaining -= alloc;
  }

  let genericIndex = 0;
  while (remaining > 0 && genericIndex < 100) {
    const alloc = Math.min(prudentialLimit, remaining);
    allocations.push({ conglomerateLabel: `Conglomerado ${String.fromCharCode(65 + genericIndex)}`, amount: alloc });
    remaining -= alloc;
    genericIndex += 1;
  }

  const minimumConglomerates = calculateMinimumConglomerates(input.totalToDistribute, prudentialLimit);

  return {
    officialLimit,
    prudentialLimit,
    minimumConglomerates,
    availableCapacity,
    allocations,
    unallocated: Math.max(0, remaining),
    disclaimers,
  };
}
