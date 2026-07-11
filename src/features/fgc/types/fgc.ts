/**
 * Tipos do motor FGC — sem regras dispersas nos componentes.
 * Todas as regras oficiais vêm de fgc_regulatory_rules e fgc_product_catalog.
 */

export type FgcCoverageStatus =
  | "potentially_covered"
  | "not_covered"
  | "special_guarantee_review"
  | "needs_review"
  | "insufficient_info";

export type OwnershipType = "individual" | "joint" | "unknown";

export type PrudentialMarginPreset = "none" | "5" | "10" | "custom";

export interface FgcRegulatoryRule {
  ruleKey: string;
  numericValue: number;
  currency?: string;
  windowYears?: number;
  description: string;
  sourceName: string;
  sourceUrl?: string;
  effectiveDate: string;
  lastVerifiedAt: string;
  version: string;
  reviewStatus: "verified" | "pending_review" | "outdated" | "unavailable";
}

export interface FgcProductCatalogEntry {
  productCode: string;
  productName: string;
  coverageStatus: FgcCoverageStatus;
  conditions?: string;
  sourceName: string;
  sourceUrl?: string;
  effectiveDate: string;
  version: string;
}

export interface FinancialConglomerateRef {
  id: string;
  officialName: string;
  active: boolean;
  sourceName?: string;
  version: string;
}

export interface FinancialInstitutionRef {
  id: string;
  legalName: string;
  tradeName?: string;
  conglomerateId?: string | null;
  fgcAssociationStatus: "associated" | "not_associated" | "unknown";
  active: boolean;
  version: string;
}

export interface FgcAssetInput {
  id: string;
  titularId: string;
  productCode: string; // resolved from Investment.type via classifier
  institutionKey?: string; // free-text or normalized
  conglomerateKey?: string; // free-text or resolved
  institutionVerified: boolean;
  conglomerateVerified: boolean;
  currentBalance: number;
  accruedIncome?: number;
  principalAmount?: number;
  ownership: OwnershipType;
  ownershipHolderCount?: number;
  coverageStatus: FgcCoverageStatus;
  corporateEventReviewRequired?: boolean;
  notes?: string;
}

export interface FgcExposureRow {
  titularId: string;
  titularName: string;
  conglomerateKey: string;
  conglomerateName: string;
  conglomerateVerified: boolean;
  eligibleBalance: number;
  officialLimit: number;
  officialCovered: number;
  officialExcess: number;
  officialRemaining: number;
  officialUsage: number;
  prudentialLimit: number;
  prudentialExcess: number;
  assetIds: string[];
}

export interface FgcDiagnosis {
  totalPotentiallyCovered: number;
  totalNotCovered: number;
  totalOfficialExcess: number;
  totalPrudentialExcess: number;
  totalUnverified: number;
  totalSpecialReview: number;
  totalNeedsReview: number;
  officialLimit: number;
  prudentialMargin: number;
  prudentialLimit: number;
  rows: FgcExposureRow[];
  topConglomerate?: { name: string; amount: number };
  assetsPendingClassification: string[];
  assetsPendingInstitution: string[];
  ruleVersion: string;
  ruleEffectiveDate: string;
  ruleSourceName: string;
  ruleLastVerifiedAt: string;
}

export interface FgcGuaranteeEventInput {
  id: string;
  titularId: string;
  eventDate: string; // ISO date
  guaranteedAmountReceived: number;
}

export interface FgcFourYearUsage {
  windowStart: string | null;
  windowEnd: string;
  paymentsInWindow: number;
  aggregateLimit: number;
  remaining: number;
  status:
    | "unknown_history"
    | "no_events_declared"
    | "partial_history"
    | "within_limit"
    | "near_limit"
    | "possibly_exhausted"
    | "needs_review";
}

export interface FgcDistributionInput {
  totalToDistribute: number;
  prudentialMargin: number; // 0..1
  officialLimit: number;
  existingExposureByConglomerate?: Record<string, number>;
  projectedYieldRate?: number;
  projectedTermMonths?: number;
}

export interface FgcDistributionResult {
  officialLimit: number;
  prudentialLimit: number;
  minimumConglomerates: number;
  availableCapacity: number;
  allocations: Array<{ conglomerateLabel: string; amount: number }>;
  unallocated: number;
  disclaimers: string[];
}

export interface FgcNextActionSuggestion {
  kind:
    | "classify_asset"
    | "verify_institution"
    | "above_official_limit"
    | "above_prudential_margin"
    | "yield_may_exceed_limit"
    | "four_year_history_unknown"
    | "ok";
  headline: string;
  detail: string;
  ctaLabel: string;
  ctaTarget: { tab: string; sub?: string };
}

export const FGC_DISCLAIMER_MARGIN =
  "Esta margem é uma política prudencial do planejamento e não altera o limite oficial do FGC.";

export const FGC_DISCLAIMER_DISTRIBUTION =
  "O FGC é uma camada de proteção para determinados créditos. Diversificar entre conglomerados não substitui a análise de liquidez, prazo, emissor, tributação e necessidade financeira.";

export const FGC_DISCLAIMER_PROJECTION =
  "Projeção baseada nas premissas informadas. O saldo real pode variar.";

export const FGC_DISCLAIMER_NOT_COVERED =
  "Este ativo não faz parte da garantia ordinária do FGC. Isso não determina sozinho sua qualidade, liquidez ou adequação.";

export const FGC_DISCLAIMER_SPECIAL =
  "Este produto pode estar sujeito a uma garantia especial com regras próprias. Consulte as condições de emissão e a regulamentação aplicável.";
