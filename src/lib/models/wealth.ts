/**
 * Patrimônio: investimentos, classificação de segurança e buckets patrimoniais.
 */
import type { OwnershipScope } from "./ownership";

export type InvestmentType =
  | "tesouro-selic"
  | "cdb"
  | "lci-lca"
  | "fundo"
  | "acao"
  | "fii"
  | "crypto"
  | "poupanca"
  | "other";

export type SecurityLevel = "soberano" | "fgc" | "mercado" | "sem-protecao";

export type PatrimonialBucketId =
  | "reserva"
  | "protecao-bancaria"
  | "base-soberana"
  | "crescimento";

export const SECURITY_LEVEL_LABELS: Record<SecurityLevel, string> = {
  soberano: "Garantia Soberana",
  fgc: "Protegido pelo FGC",
  mercado: "Risco de Mercado",
  "sem-protecao": "Sem Proteção Específica",
};

export const BUCKET_LABELS: Record<PatrimonialBucketId, string> = {
  reserva: "Reserva e Liquidez",
  "protecao-bancaria": "Proteção Bancária",
  "base-soberana": "Base Soberana",
  crescimento: "Crescimento e Diversificação",
};

export const BUCKET_DESCRIPTIONS: Record<PatrimonialBucketId, string> = {
  reserva: "Emergência, curto prazo e estabilidade operacional",
  "protecao-bancaria": "Acumulação com controle de concentração por instituição",
  "base-soberana": "Expansão com segurança soberana e proteção contra inflação",
  crescimento: "Diversificação de longo prazo para patrimônios mais maduros",
};

export function getDefaultSecurity(type: InvestmentType): SecurityLevel {
  switch (type) {
    case "tesouro-selic":
      return "soberano";
    case "cdb":
    case "lci-lca":
    case "poupanca":
      return "fgc";
    case "fundo":
    case "acao":
    case "fii":
    case "crypto":
      return "mercado";
    default:
      return "sem-protecao";
  }
}

export function getDefaultBucket(type: InvestmentType): PatrimonialBucketId {
  switch (type) {
    case "tesouro-selic":
    case "poupanca":
      return "reserva";
    case "cdb":
    case "lci-lca":
      return "protecao-bancaria";
    case "fundo":
      return "base-soberana";
    case "acao":
    case "fii":
    case "crypto":
      return "crescimento";
    default:
      return "crescimento";
  }
}

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  institution: string;
  conglomerate?: string;
  titular?: string;
  securityLevel?: SecurityLevel;
  bucket?: PatrimonialBucketId;
  currentBalance: number;
  monthlyContribution: number;
  annualRate: number;
  startDate: string;
  maturityDate?: string;
  profileId?: string;
  ownershipScope?: OwnershipScope;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HoldingByInstitution {
  institution: string;
  conglomerate?: string;
  investments: Investment[];
  totalBalance: number;
}
