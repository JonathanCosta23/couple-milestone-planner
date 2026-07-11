/**
 * fgcInstitutionProvider — acesso a instituições, conglomerados, regras e
 * catálogo de produtos. Interface desacoplada para permitir cache, fallback
 * e futura revisão administrativa.
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type {
  FgcProductCatalogEntry,
  FgcRegulatoryRule,
  FinancialConglomerateRef,
  FinancialInstitutionRef,
} from "../types/fgc";

const FALLBACK_ORDINARY_LIMIT: FgcRegulatoryRule = {
  ruleKey: "ordinary_limit_per_cpf_per_conglomerate",
  numericValue: 250_000,
  currency: "BRL",
  description:
    "Limite ordinário de garantia por CPF/CNPJ, por instituição associada ou conjunto de instituições do mesmo conglomerado financeiro.",
  sourceName: "Fundo Garantidor de Créditos",
  sourceUrl: "https://www.fgc.org.br/",
  effectiveDate: "2013-05-22",
  lastVerifiedAt: new Date().toISOString(),
  version: "1.0.0",
  reviewStatus: "verified",
};

const FALLBACK_AGGREGATE_LIMIT: FgcRegulatoryRule = {
  ruleKey: "aggregate_limit_four_year_window",
  numericValue: 1_000_000,
  currency: "BRL",
  windowYears: 4,
  description: "Teto agregado de pagamentos de garantia ordinária por CPF/CNPJ em janela de 4 anos.",
  sourceName: "Fundo Garantidor de Créditos",
  sourceUrl: "https://www.fgc.org.br/",
  effectiveDate: "2017-12-21",
  lastVerifiedAt: new Date().toISOString(),
  version: "1.0.0",
  reviewStatus: "verified",
};

export interface FgcSourceMetadata {
  rulesLoadedAt: string;
  fallbackInUse: boolean;
  ruleVersion: string;
  ruleSource: string;
  ruleEffectiveDate: string;
  ruleLastVerifiedAt: string;
}

export interface FgcInstitutionProvider {
  getAssociatedInstitutions(): Promise<FinancialInstitutionRef[]>;
  getConglomerates(): Promise<FinancialConglomerateRef[]>;
  getInstitutionByReference(ref: string): Promise<FinancialInstitutionRef | null>;
  getSourceMetadata(): Promise<FgcSourceMetadata>;
  getOrdinaryLimitRule(): Promise<FgcRegulatoryRule>;
  getAggregateLimitRule(): Promise<FgcRegulatoryRule>;
  getProductCatalog(): Promise<FgcProductCatalogEntry[]>;
}

function mapRuleRow(row: Record<string, unknown>): FgcRegulatoryRule {
  return {
    ruleKey: String(row.rule_key ?? ""),
    numericValue: Number(row.numeric_value ?? 0),
    currency: (row.currency as string) ?? "BRL",
    windowYears: row.window_years == null ? undefined : Number(row.window_years),
    description: String(row.description ?? ""),
    sourceName: String(row.source_name ?? "FGC"),
    sourceUrl: (row.source_url as string) ?? undefined,
    effectiveDate: String(row.effective_date ?? ""),
    lastVerifiedAt: String(row.last_verified_at ?? new Date().toISOString()),
    version: String(row.version ?? "1.0.0"),
    reviewStatus: (row.review_status as FgcRegulatoryRule["reviewStatus"]) ?? "verified",
  };
}

export function createDefaultFgcProvider(): FgcInstitutionProvider {
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: unknown) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>;
      };
    };
  };

  async function fetchRule(key: string, fallback: FgcRegulatoryRule): Promise<FgcRegulatoryRule> {
    try {
      const { data, error } = await client
        .from("fgc_regulatory_rules")
        .select("*")
        .eq("rule_key", key);
      if (error || !data || data.length === 0) return fallback;
      const active = data.find(r => r.active !== false) ?? data[0];
      return mapRuleRow(active);
    } catch (e) {
      logger.warn("fgc.rule.fetch.fail", { key }, (e as Error)?.message);
      return fallback;
    }
  }

  return {
    async getAssociatedInstitutions() {
      try {
        const { data, error } = await client.from("financial_institutions").select("*").eq("active", true);
        if (error || !data) return [];
        return data.map(r => ({
          id: String(r.id),
          legalName: String(r.legal_name ?? ""),
          tradeName: (r.trade_name as string) ?? undefined,
          conglomerateId: (r.conglomerate_id as string) ?? null,
          fgcAssociationStatus: (r.fgc_association_status as "associated" | "not_associated" | "unknown") ?? "unknown",
          active: r.active !== false,
          version: String(r.version ?? "1.0.0"),
        }));
      } catch (e) {
        logger.warn("fgc.inst.fetch.fail", {}, (e as Error)?.message);
        return [];
      }
    },
    async getConglomerates() {
      try {
        const { data, error } = await client.from("financial_conglomerates").select("*").eq("active", true);
        if (error || !data) return [];
        return data.map(r => ({
          id: String(r.id),
          officialName: String(r.official_name ?? ""),
          active: r.active !== false,
          sourceName: (r.source_name as string) ?? undefined,
          version: String(r.version ?? "1.0.0"),
        }));
      } catch {
        return [];
      }
    },
    async getInstitutionByReference(ref: string) {
      const list = await this.getAssociatedInstitutions();
      const target = ref.trim().toLowerCase();
      return list.find(i =>
        i.legalName.trim().toLowerCase() === target ||
        (i.tradeName ?? "").trim().toLowerCase() === target ||
        i.id === ref,
      ) ?? null;
    },
    async getSourceMetadata() {
      const rule = await this.getOrdinaryLimitRule();
      const fallback = rule.version === FALLBACK_ORDINARY_LIMIT.version && rule.lastVerifiedAt === FALLBACK_ORDINARY_LIMIT.lastVerifiedAt;
      return {
        rulesLoadedAt: new Date().toISOString(),
        fallbackInUse: fallback,
        ruleVersion: rule.version,
        ruleSource: rule.sourceName,
        ruleEffectiveDate: rule.effectiveDate,
        ruleLastVerifiedAt: rule.lastVerifiedAt,
      };
    },
    async getOrdinaryLimitRule() {
      return fetchRule("ordinary_limit_per_cpf_per_conglomerate", FALLBACK_ORDINARY_LIMIT);
    },
    async getAggregateLimitRule() {
      return fetchRule("aggregate_limit_four_year_window", FALLBACK_AGGREGATE_LIMIT);
    },
    async getProductCatalog() {
      try {
        const { data, error } = await client.from("fgc_product_catalog").select("*").eq("active", true);
        if (error || !data) return [];
        return data.map(r => ({
          productCode: String(r.product_code ?? ""),
          productName: String(r.product_name ?? ""),
          coverageStatus: r.coverage_status as FgcProductCatalogEntry["coverageStatus"],
          conditions: (r.conditions as string) ?? undefined,
          sourceName: String(r.source_name ?? "FGC"),
          sourceUrl: (r.source_url as string) ?? undefined,
          effectiveDate: String(r.effective_date ?? ""),
          version: String(r.version ?? "1.0.0"),
        }));
      } catch {
        return [];
      }
    },
  };
}

export const FGC_FALLBACK_RULES = {
  ordinary: FALLBACK_ORDINARY_LIMIT,
  aggregate: FALLBACK_AGGREGATE_LIMIT,
};
