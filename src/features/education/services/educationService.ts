/**
 * educationService — leitura, validação e regras da camada educacional
 * de investimentos (escolas, investidores de referência, fichas de ativos).
 *
 * Não executa recomendação. Não altera dados. Não busca cotação em tempo
 * real. Toda saída deve carregar disclaimer, versão e datas.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  AssetEducationCase,
  FreshnessState,
  InvestmentSchool,
  InvestorReference,
  EducationSource,
} from "@/features/education/types";

// ---------------------------------------------------------------------------
// Language guard: extra layer sobre knowledgeService.detectForbiddenTerms
// ---------------------------------------------------------------------------

/** Termos proibidos em conteúdo educacional (investimentos). */
export const RECOMMENDATION_TERMS: readonly string[] = [
  "compre",
  "venda",
  "mantenha",
  "preço-alvo",
  "preco-alvo",
  "upside",
  "ação barata",
  "acao barata",
  "ação cara",
  "acao cara",
  "retorno garantido",
  "dividendos garantidos",
  "dividendo garantido",
  "carteira ideal",
  "ativo perfeito",
  "melhor ação para você",
  "melhor acao para voce",
  "oportunidade imperdível",
  "oportunidade imperdivel",
];

/** Frases críticas/negadoras que devem ser toleradas mesmo contendo um termo proibido. */
const CRITICAL_EXCEPTIONS: readonly string[] = [
  "não existe dividendo garantido",
  "nao existe dividendo garantido",
  "não existe retorno garantido",
  "nao existe retorno garantido",
  "não constitui recomendação",
  "nao constitui recomendacao",
  "não é recomendação",
  "nao e recomendacao",
];

export interface RecommendationMatch {
  term: string;
  index: number;
}

/**
 * Detecta linguagem de recomendação. Frases críticas que negam a promessa
 * (por exemplo "não existe dividendo garantido") não disparam alerta.
 */
export function detectRecommendationLanguage(text: string | null | undefined): RecommendationMatch[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  if (CRITICAL_EXCEPTIONS.some((c) => lower.includes(c))) {
    // Somente frases explicitamente negadoras entram na exceção; se houver
    // outras ocorrências fora do contexto, elas serão pegas em novo texto.
    // Para simplicidade, se a exceção crítica está presente, ignoramos os
    // termos que ela normalmente dispararia (retorno/dividendo garantido).
    return RECOMMENDATION_TERMS.filter((t) => !["retorno garantido", "dividendos garantidos", "dividendo garantido"].includes(t))
      .map((term) => ({ term, index: lower.indexOf(term) }))
      .filter((m) => m.index >= 0);
  }
  return RECOMMENDATION_TERMS.map((term) => ({ term, index: lower.indexOf(term) }))
    .filter((m) => m.index >= 0);
}

// ---------------------------------------------------------------------------
// Freshness / validação de conteúdo
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

export interface FreshnessOptions {
  /** Após quantos dias sem verificação o conteúdo precisa de revisão. */
  reviewDueAfterDays?: number;
  /** Após quantos dias sem verificação o conteúdo fica stale. */
  staleAfterDays?: number;
  now?: Date;
}

export function classifyContentFreshness(
  content: { review_status: string; last_verified_at: string | null | undefined },
  opts: FreshnessOptions = {},
): FreshnessState {
  if (content.review_status === "archived") return "archived";
  if (content.review_status === "unverified") return "unverified";
  const reviewDue = opts.reviewDueAfterDays ?? 120;
  const stale = opts.staleAfterDays ?? 240;
  const now = (opts.now ?? new Date()).getTime();
  const ts = content.last_verified_at ? new Date(content.last_verified_at).getTime() : NaN;
  if (!Number.isFinite(ts)) return "unverified";
  const diffDays = Math.max(0, (now - ts) / DAY_MS);
  if (diffDays >= stale) return "stale";
  if (diffDays >= reviewDue) return "review_due";
  if (content.review_status === "outdated") return "stale";
  return "current";
}

/** Confere se uma fonte é utilizável (tem nome e alguma referência). */
export function validateSourceFreshness(source: EducationSource | undefined | null): boolean {
  if (!source) return false;
  if (!source.source_name || source.source_name.trim().length === 0) return false;
  return Boolean(source.source_url || source.publication_date || source.reporting_period);
}

/** Ficha só é publicável quando tem modelo, riscos, tese, antítese, fontes e período/data. */
export function validateAssetEducationContent(a: Partial<AssetEducationCase>): {
  publishable: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!a.company_name) missing.push("company_name");
  if (!a.business_model) missing.push("business_model");
  if (!a.key_risks || a.key_risks.length === 0) missing.push("key_risks");
  if (!a.positive_thesis || a.positive_thesis.length === 0) missing.push("positive_thesis");
  if (!a.negative_thesis || a.negative_thesis.length === 0) missing.push("negative_thesis");
  if (!a.sources || a.sources.length === 0) missing.push("sources");
  if (!a.reporting_period && !a.source_date && !a.last_verified_at) missing.push("period_or_date");
  if (!a.ticker_validated) missing.push("ticker_validated");
  return { publishable: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Comparação educacional entre ativos (sem ranking)
// ---------------------------------------------------------------------------

export type ComparisonDimension =
  | "capital_intensity"
  | "cyclicality"
  | "government_exposure"
  | "currency_exposure"
  | "commodity_exposure"
  | "regulatory_exposure"
  | "dividend_summary"
  | "debt_summary";

export interface AssetComparisonRow {
  dimension: ComparisonDimension;
  values: Array<{ ticker: string | null; company_name: string; value: string | null; period: string | null }>;
  comparable: boolean;
  note?: string;
}

export function compareAssetDimensions(
  assets: AssetEducationCase[],
  dimensions: ComparisonDimension[],
): AssetComparisonRow[] {
  if (assets.length > 3) {
    throw new Error("Comparação educacional é limitada a três empresas.");
  }
  return dimensions.map((dimension) => {
    const values = assets.map((a) => ({
      ticker: a.ticker,
      company_name: a.company_name,
      value: (a[dimension] as string | null) ?? null,
      period: a.reporting_period ?? null,
    }));
    const periods = new Set(values.map((v) => v.period ?? ""));
    const anyMissing = values.some((v) => !v.value);
    return {
      dimension,
      values,
      comparable: !anyMissing && periods.size === 1,
      note: anyMissing
        ? "Dados não comparáveis: informação ausente em pelo menos uma empresa."
        : periods.size > 1
          ? "Períodos de referência diferentes. Não use como ranking."
          : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Próxima ação educacional
// ---------------------------------------------------------------------------

export interface EducationalContext {
  hasEmergencyReserve: boolean;
  hasVariableIncomeExposure: boolean;
  concentrationRatio: number; // 0..1 — maior participação de um único ativo
  hasAssetsWithoutStudy: boolean;
  hasStaleContent: boolean;
  isBeginner: boolean;
}

export interface EducationalNextAction {
  headline: string;
  detail: string;
  ctaLabel: string;
  priority: number;
}

export function computeEducationalNextAction(ctx: EducationalContext): EducationalNextAction {
  if (ctx.hasVariableIncomeExposure && !ctx.hasEmergencyReserve) {
    return {
      headline: "Reforce reserva antes de aprofundar renda variável",
      detail: "Antes de aprofundar renda variável, revise sua reserva e liquidez.",
      ctaLabel: "Revisar reserva",
      priority: 1,
    };
  }
  if (ctx.concentrationRatio >= 0.4) {
    return {
      headline: "Concentração relevante em uma única empresa",
      detail: "Uma parcela relevante do patrimônio está exposta a uma única empresa.",
      ctaLabel: "Entender concentração",
      priority: 2,
    };
  }
  if (ctx.hasAssetsWithoutStudy) {
    return {
      headline: "Complete a análise de um ativo em carteira",
      detail: "Complete a análise do modelo de negócio e dos riscos deste ativo.",
      ctaLabel: "Estudar ativo",
      priority: 3,
    };
  }
  if (ctx.hasStaleContent) {
    return {
      headline: "Conteúdo com dados de período anterior",
      detail: "Esta ficha utiliza informações de um período anterior.",
      ctaLabel: "Ver fontes e data",
      priority: 4,
    };
  }
  if (ctx.isBeginner) {
    return {
      headline: "Comece pelas bases",
      detail: "Comece por modelo de negócio, risco e diversificação.",
      ctaLabel: "Iniciar trilha básica",
      priority: 5,
    };
  }
  return {
    headline: "Continue aprendendo",
    detail: "Explore uma escola de pensamento ou uma ficha de ativo.",
    ctaLabel: "Ver escolas",
    priority: 6,
  };
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function coerceSources(value: unknown): EducationSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      source_name: String(v.source_name ?? ""),
      source_url: typeof v.source_url === "string" ? v.source_url : null,
      source_type: typeof v.source_type === "string" ? v.source_type : null,
      publication_date: typeof v.publication_date === "string" ? v.publication_date : null,
      reporting_period: typeof v.reporting_period === "string" ? v.reporting_period : null,
      accessed_at: typeof v.accessed_at === "string" ? v.accessed_at : null,
      last_verified_at: typeof v.last_verified_at === "string" ? v.last_verified_at : null,
      is_primary_source: Boolean(v.is_primary_source),
    }))
    .filter((s) => s.source_name.length > 0);
}

function coerceHistoricalPositions(value: unknown): InvestorReference["historical_positions"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      entity: String(v.entity ?? ""),
      description: String(v.description ?? ""),
      reference_date: String(v.reference_date ?? ""),
      source: coerceSources([v.source])[0] ?? { source_name: "" },
    }))
    .filter((p) => p.entity.length > 0);
}

export async function listInvestmentSchools(): Promise<InvestmentSchool[]> {
  const { data, error } = await supabase
    .from("knowledge_investment_schools")
    .select("*")
    .eq("active", true)
    .eq("publication_status", "published")
    .eq("review_status", "verified")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    core_concepts: coerceStringArray(row.core_concepts),
    key_risks: coerceStringArray(row.key_risks),
    limitations: coerceStringArray(row.limitations),
  })) as InvestmentSchool[];
}

export async function getInvestmentSchoolBySlug(slug: string): Promise<InvestmentSchool | null> {
  const { data, error } = await supabase
    .from("knowledge_investment_schools")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .eq("publication_status", "published")
    .eq("review_status", "verified")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    core_concepts: coerceStringArray(data.core_concepts),
    key_risks: coerceStringArray(data.key_risks),
    limitations: coerceStringArray(data.limitations),
  } as InvestmentSchool;
}

export async function listInvestorReferences(): Promise<InvestorReference[]> {
  const { data, error } = await supabase
    .from("knowledge_investor_references")
    .select("*")
    .eq("active", true)
    .eq("publication_status", "published")
    .eq("review_status", "verified")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    documented_principles: coerceStringArray(row.documented_principles),
    associated_school_slugs: coerceStringArray(row.associated_school_slugs),
    lessons: coerceStringArray(row.lessons),
    limitations: coerceStringArray(row.limitations),
    controversies_or_risks: coerceStringArray(row.controversies_or_risks),
    historical_positions: coerceHistoricalPositions(row.historical_positions),
    sources: coerceSources(row.sources),
  })) as InvestorReference[];
}

export async function getInvestorReferenceBySlug(slug: string): Promise<InvestorReference | null> {
  const { data, error } = await supabase
    .from("knowledge_investor_references")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .eq("publication_status", "published")
    .eq("review_status", "verified")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    documented_principles: coerceStringArray(data.documented_principles),
    associated_school_slugs: coerceStringArray(data.associated_school_slugs),
    lessons: coerceStringArray(data.lessons),
    limitations: coerceStringArray(data.limitations),
    controversies_or_risks: coerceStringArray(data.controversies_or_risks),
    historical_positions: coerceHistoricalPositions(data.historical_positions),
    sources: coerceSources(data.sources),
  } as InvestorReference;
}

export async function listAssetEducationCases(): Promise<AssetEducationCase[]> {
  const { data, error } = await supabase
    .from("knowledge_asset_cases")
    .select("*")
    .eq("active", true)
    .eq("publication_status", "published")
    .eq("review_status", "verified")
    .order("company_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapAssetCase);
}

export async function getAssetEducationCaseByTicker(ticker: string): Promise<AssetEducationCase | null> {
  const { data, error } = await supabase
    .from("knowledge_asset_cases")
    .select("*")
    .eq("ticker", ticker)
    .eq("active", true)
    .eq("publication_status", "published")
    .eq("review_status", "verified")
    .maybeSingle();
  if (error) throw error;
  return data ? mapAssetCase(data) : null;
}

function mapAssetCase(row: Record<string, unknown>): AssetEducationCase {
  return {
    ...(row as unknown as AssetEducationCase),
    revenue_drivers: coerceStringArray(row.revenue_drivers),
    cost_drivers: coerceStringArray(row.cost_drivers),
    competitive_advantages: coerceStringArray(row.competitive_advantages),
    positive_thesis: coerceStringArray(row.positive_thesis),
    negative_thesis: coerceStringArray(row.negative_thesis),
    key_risks: coerceStringArray(row.key_risks),
    indicators_to_watch: coerceStringArray(row.indicators_to_watch),
    events_to_watch: coerceStringArray(row.events_to_watch),
    associated_school_slugs: coerceStringArray(row.associated_school_slugs),
    sources: coerceSources(row.sources),
  };
}