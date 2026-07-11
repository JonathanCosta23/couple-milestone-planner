/**
 * fgcClassification — mapeia Investment.type → productCode do catálogo FGC
 * e retorna o coverageStatus aplicável.
 *
 * A classificação nunca infere cobertura a partir apenas do tipo:
 * também depende da associação da instituição emissora ao FGC.
 */

import type { Investment, InvestmentType } from "@/lib/models";
import type {
  FgcAssetInput,
  FgcCoverageStatus,
  FinancialInstitutionRef,
  OwnershipType,
} from "../types/fgc";

/** Mapa Investment.type → product_code no catálogo. */
export function mapInvestmentTypeToProductCode(type: InvestmentType): string {
  switch (type) {
    case "tesouro-selic":
      return "tesouro";
    case "cdb":
      return "cdb";
    case "lci-lca":
      return "lci";
    case "poupanca":
      return "savings";
    case "fundo":
      return "fund";
    case "acao":
      return "acao";
    case "fii":
      return "fii";
    case "crypto":
      return "crypto";
    case "other":
    default:
      return "other";
  }
}

/** Cobertura padrão *potencial* (não considera vínculo institucional). */
export function defaultCoverageForProduct(productCode: string): FgcCoverageStatus {
  switch (productCode) {
    case "cdb":
    case "rdb":
    case "lci":
    case "lca":
    case "lcd":
    case "lc":
    case "lh":
    case "savings":
    case "salary_account":
    case "demand_deposit":
    case "compromissada":
      return "potentially_covered";
    case "tesouro":
    case "fund":
    case "debenture":
    case "cri":
    case "cra":
    case "lf":
    case "lig":
    case "acao":
    case "etf":
    case "fii":
    case "crypto":
    case "previdencia":
      return "not_covered";
    case "dpge":
      return "special_guarantee_review";
    case "other":
      return "needs_review";
    default:
      return "insufficient_info";
  }
}

export function classifyInvestmentForFgc(
  inv: Investment,
  institutions: FinancialInstitutionRef[],
  primaryTitularId: string,
  ownership: OwnershipType = "individual",
): FgcAssetInput {
  const productCode = mapInvestmentTypeToProductCode(inv.type);
  const baseStatus = defaultCoverageForProduct(productCode);

  const normalizedInstitution = institutions.find(i => {
    const target = (inv.institution || "").trim().toLowerCase();
    if (!target) return false;
    return (
      (i.tradeName && i.tradeName.trim().toLowerCase() === target) ||
      i.legalName.trim().toLowerCase() === target
    );
  });

  const institutionVerified = Boolean(normalizedInstitution && normalizedInstitution.active);
  const conglomerateId = normalizedInstitution?.conglomerateId ?? undefined;
  const conglomerateVerified = Boolean(conglomerateId);

  // Se o produto seria potencialmente coberto mas a instituição não está verificada
  // como associada ao FGC, degradamos para "needs_review".
  let coverageStatus: FgcCoverageStatus = baseStatus;
  if (baseStatus === "potentially_covered") {
    if (!institutionVerified) coverageStatus = "needs_review";
    else if (normalizedInstitution?.fgcAssociationStatus === "not_associated") coverageStatus = "not_covered";
    else if (normalizedInstitution?.fgcAssociationStatus === "unknown") coverageStatus = "needs_review";
  }

  const titularId = inv.titular || inv.profileId || primaryTitularId;

  return {
    id: inv.id,
    titularId,
    productCode,
    institutionKey: normalizedInstitution?.id ?? inv.institution ?? undefined,
    conglomerateKey: conglomerateId ?? inv.conglomerate ?? inv.institution ?? undefined,
    institutionVerified,
    conglomerateVerified,
    currentBalance: Number.isFinite(inv.currentBalance) ? Math.max(0, inv.currentBalance) : 0,
    principalAmount: undefined,
    accruedIncome: undefined,
    ownership,
    ownershipHolderCount: ownership === "joint" ? 2 : 1,
    coverageStatus,
  };
}

export function validateFgcClassification(input: FgcAssetInput): string[] {
  const errors: string[] = [];
  if (!input.id) errors.push("id ausente");
  if (!input.titularId) errors.push("titular ausente");
  if (input.currentBalance < 0) errors.push("saldo negativo inválido");
  if (!Number.isFinite(input.currentBalance)) errors.push("saldo inválido");
  if (!input.productCode) errors.push("productCode ausente");
  return errors;
}
