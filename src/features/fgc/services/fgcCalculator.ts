/**
 * fgcCalculator — funções puras de exposição FGC.
 * Nenhuma promessa de "risco zero". Nada aqui recomenda banco.
 */

import type {
  FgcAssetInput,
  FgcDiagnosis,
  FgcExposureRow,
  FgcFourYearUsage,
  FgcGuaranteeEventInput,
  FgcRegulatoryRule,
} from "../types/fgc";

export function eligibleAssetBalance(a: FgcAssetInput): number {
  if (typeof a.principalAmount === "number" && typeof a.accruedIncome === "number") {
    return Math.max(0, a.principalAmount + a.accruedIncome);
  }
  return Math.max(0, a.currentBalance || 0);
}

/**
 * Aloca a parcela do saldo elegível para o titular, considerando titularidade conjunta.
 * Divisão igual entre os titulares informados. Um único titular do plano é considerado.
 */
export function allocateJointOwnership(a: FgcAssetInput, titularId: string): number {
  const balance = eligibleAssetBalance(a);
  if (a.titularId !== titularId && a.ownership !== "joint") return 0;
  if (a.ownership === "joint") {
    const holders = Math.max(1, a.ownershipHolderCount ?? 2);
    return balance / holders;
  }
  return balance;
}

export function calculateOfficialCoverage(exposure: number, limit: number): number {
  return Math.max(0, Math.min(exposure, limit));
}

export function calculateOfficialExcess(exposure: number, limit: number): number {
  return Math.max(0, exposure - limit);
}

export function calculateRemainingCapacity(exposure: number, limit: number): number {
  return Math.max(0, limit - exposure);
}

export function calculatePrudentialLimit(limit: number, margin: number): number {
  const m = Math.max(0, Math.min(1, margin));
  return limit * (1 - m);
}

export function calculatePrudentialExcess(exposure: number, prudentialLimit: number): number {
  return Math.max(0, exposure - prudentialLimit);
}

export interface DiagnosisContext {
  assets: FgcAssetInput[];
  ordinaryLimitRule: FgcRegulatoryRule;
  prudentialMargin: number;
  titularNames: Record<string, string>;
  conglomerateNames?: Record<string, string>;
}

export function calculateFgcDiagnosis(ctx: DiagnosisContext): FgcDiagnosis {
  const officialLimit = ctx.ordinaryLimitRule.numericValue;
  const prudentialLimit = calculatePrudentialLimit(officialLimit, ctx.prudentialMargin);

  let totalPotentiallyCovered = 0;
  let totalNotCovered = 0;
  let totalUnverified = 0;
  let totalSpecialReview = 0;
  let totalNeedsReview = 0;
  const assetsPendingClassification: string[] = [];
  const assetsPendingInstitution: string[] = [];

  // agrega exposição por (titular|conglomerado) somente para itens potencialmente cobertos
  // com instituição e conglomerado verificados.
  const key = (t: string, c: string) => `${t}::${c}`;
  const bucket = new Map<string, { titularId: string; conglomerateKey: string; eligible: number; assetIds: string[] }>();

  for (const a of ctx.assets) {
    const balance = eligibleAssetBalance(a);

    if (a.coverageStatus === "not_covered") {
      totalNotCovered += balance;
      continue;
    }
    if (a.coverageStatus === "special_guarantee_review") {
      totalSpecialReview += balance;
      continue;
    }
    if (a.coverageStatus === "needs_review" || a.coverageStatus === "insufficient_info") {
      totalNeedsReview += balance;
      assetsPendingClassification.push(a.id);
      continue;
    }
    // potentially_covered
    if (!a.institutionVerified || !a.conglomerateVerified) {
      totalUnverified += balance;
      assetsPendingInstitution.push(a.id);
      continue;
    }

    // Distribui saldo por titular via allocateJointOwnership
    const holders = a.ownership === "joint" ? Math.max(1, a.ownershipHolderCount ?? 2) : 1;
    if (a.ownership === "joint") {
      // Neste MVP consideramos titularId como um dos titulares; a parcela do outro
      // fica agrupada no mesmo titularId conjunto — implementação incremental.
      const share = balance / holders;
      const k = key(a.titularId, a.conglomerateKey!);
      const entry = bucket.get(k) ?? { titularId: a.titularId, conglomerateKey: a.conglomerateKey!, eligible: 0, assetIds: [] };
      entry.eligible += share;
      entry.assetIds.push(a.id);
      bucket.set(k, entry);
      totalPotentiallyCovered += share;
    } else {
      const k = key(a.titularId, a.conglomerateKey!);
      const entry = bucket.get(k) ?? { titularId: a.titularId, conglomerateKey: a.conglomerateKey!, eligible: 0, assetIds: [] };
      entry.eligible += balance;
      entry.assetIds.push(a.id);
      bucket.set(k, entry);
      totalPotentiallyCovered += balance;
    }
  }

  const rows: FgcExposureRow[] = Array.from(bucket.values()).map(entry => {
    const eligible = entry.eligible;
    const covered = calculateOfficialCoverage(eligible, officialLimit);
    const excess = calculateOfficialExcess(eligible, officialLimit);
    const remaining = calculateRemainingCapacity(eligible, officialLimit);
    const usage = officialLimit > 0 ? eligible / officialLimit : 0;
    return {
      titularId: entry.titularId,
      titularName: ctx.titularNames[entry.titularId] ?? "Titular",
      conglomerateKey: entry.conglomerateKey,
      conglomerateName: ctx.conglomerateNames?.[entry.conglomerateKey] ?? entry.conglomerateKey,
      conglomerateVerified: true,
      eligibleBalance: eligible,
      officialLimit,
      officialCovered: covered,
      officialExcess: excess,
      officialRemaining: remaining,
      officialUsage: usage,
      prudentialLimit,
      prudentialExcess: calculatePrudentialExcess(eligible, prudentialLimit),
      assetIds: entry.assetIds,
    };
  }).sort((a, b) => b.eligibleBalance - a.eligibleBalance);

  const totalOfficialExcess = rows.reduce((s, r) => s + r.officialExcess, 0);
  const totalPrudentialExcess = rows.reduce((s, r) => s + r.prudentialExcess, 0);

  // Top conglomerado por exposição
  const byConglom = new Map<string, number>();
  rows.forEach(r => byConglom.set(r.conglomerateName, (byConglom.get(r.conglomerateName) ?? 0) + r.eligibleBalance));
  let topConglomerate: { name: string; amount: number } | undefined;
  for (const [name, amount] of byConglom.entries()) {
    if (!topConglomerate || amount > topConglomerate.amount) topConglomerate = { name, amount };
  }

  return {
    totalPotentiallyCovered,
    totalNotCovered,
    totalOfficialExcess,
    totalPrudentialExcess,
    totalUnverified,
    totalSpecialReview,
    totalNeedsReview,
    officialLimit,
    prudentialMargin: ctx.prudentialMargin,
    prudentialLimit,
    rows,
    topConglomerate,
    assetsPendingClassification,
    assetsPendingInstitution,
    ruleVersion: ctx.ordinaryLimitRule.version,
    ruleEffectiveDate: ctx.ordinaryLimitRule.effectiveDate,
    ruleSourceName: ctx.ordinaryLimitRule.sourceName,
    ruleLastVerifiedAt: ctx.ordinaryLimitRule.lastVerifiedAt,
  };
}

export function groupExposureByInstitution(assets: FgcAssetInput[]): Record<string, number> {
  const map: Record<string, number> = {};
  assets.forEach(a => {
    if (a.coverageStatus !== "potentially_covered") return;
    const k = a.institutionKey ?? "unknown";
    map[k] = (map[k] ?? 0) + eligibleAssetBalance(a);
  });
  return map;
}

export function groupExposureByConglomerate(assets: FgcAssetInput[]): Record<string, number> {
  const map: Record<string, number> = {};
  assets.forEach(a => {
    if (a.coverageStatus !== "potentially_covered") return;
    const k = a.conglomerateKey ?? "unknown";
    map[k] = (map[k] ?? 0) + eligibleAssetBalance(a);
  });
  return map;
}

// ==============================================================
// Janela de 4 anos — teto agregado
// ==============================================================

export interface FourYearUsageInput {
  events: FgcGuaranteeEventInput[];
  aggregateLimit: number;
  windowYears: number;
  historyDeclared: boolean; // usuário declarou explicitamente se recebeu ou não
  referenceDate?: string; // ISO
}

export function calculateFourYearUsage(input: FourYearUsageInput): FgcFourYearUsage {
  const ref = input.referenceDate ? new Date(input.referenceDate) : new Date();
  const windowStartDate = new Date(ref);
  windowStartDate.setFullYear(windowStartDate.getFullYear() - input.windowYears);

  if (!input.historyDeclared) {
    return {
      windowStart: null,
      windowEnd: ref.toISOString().slice(0, 10),
      paymentsInWindow: 0,
      aggregateLimit: input.aggregateLimit,
      remaining: 0,
      status: "unknown_history",
    };
  }

  const inWindow = input.events.filter(e => {
    const d = new Date(e.eventDate);
    return d >= windowStartDate && d <= ref;
  });

  if (inWindow.length === 0) {
    return {
      windowStart: windowStartDate.toISOString().slice(0, 10),
      windowEnd: ref.toISOString().slice(0, 10),
      paymentsInWindow: 0,
      aggregateLimit: input.aggregateLimit,
      remaining: input.aggregateLimit,
      status: "no_events_declared",
    };
  }

  const payments = inWindow.reduce((s, e) => s + Math.max(0, e.guaranteedAmountReceived || 0), 0);
  const remaining = Math.max(0, input.aggregateLimit - payments);
  const ratio = input.aggregateLimit > 0 ? payments / input.aggregateLimit : 0;
  let status: FgcFourYearUsage["status"] = "within_limit";
  if (payments >= input.aggregateLimit) status = "possibly_exhausted";
  else if (ratio >= 0.9) status = "near_limit";

  return {
    windowStart: windowStartDate.toISOString().slice(0, 10),
    windowEnd: ref.toISOString().slice(0, 10),
    paymentsInWindow: payments,
    aggregateLimit: input.aggregateLimit,
    remaining,
    status,
  };
}

// ==============================================================
// Projeção educacional simples (não usa taxa futura como certeza)
// ==============================================================

export interface ProjectedExposureInput {
  currentBalance: number;
  annualRate?: number;
  months?: number;
  prudentialLimit: number;
}

export function calculateProjectedFgcExposure(input: ProjectedExposureInput): {
  projectedBalance: number;
  crossesPrudentialLimit: boolean;
  monthsToCross: number | null;
} {
  if (!input.annualRate || !input.months || input.annualRate <= 0 || input.months <= 0) {
    return { projectedBalance: input.currentBalance, crossesPrudentialLimit: input.currentBalance > input.prudentialLimit, monthsToCross: null };
  }
  const monthlyRate = Math.pow(1 + input.annualRate, 1 / 12) - 1;
  const projected = input.currentBalance * Math.pow(1 + monthlyRate, input.months);
  let monthsToCross: number | null = null;
  if (input.currentBalance < input.prudentialLimit && projected > input.prudentialLimit) {
    // resolve n: bal * (1+r)^n = limit
    const n = Math.log(input.prudentialLimit / input.currentBalance) / Math.log(1 + monthlyRate);
    monthsToCross = Math.ceil(n);
  }
  return {
    projectedBalance: projected,
    crossesPrudentialLimit: projected > input.prudentialLimit,
    monthsToCross,
  };
}
