/**
 * knowledgeService — fonte única para a base de conhecimento educacional.
 *
 * Responsabilidades:
 *  - Ler tópicos, artigos, fontes, fórmulas, estratégias e regras regulatórias
 *    da camada `knowledge_*` (RLS pública para conteúdo ativo).
 *  - Validar contratos essenciais antes de expor conteúdo à UI (evita mostrar
 *    material sem fonte como "verificado" ou regra regulatória sem datas).
 *  - Detectar linguagem proibida (recomendações, promessas de retorno) em
 *    conteúdo educacional.
 *
 * Não faz cálculos financeiros — apenas conhecimento estruturado.
 */

import { supabase } from "@/integrations/supabase/client";

export type Difficulty = "basic" | "intermediate" | "advanced";
export type ReviewStatus = "unverified" | "in_review" | "verified" | "outdated";

export interface KnowledgeTopic {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: Difficulty;
  sort_order: number;
}

export interface KnowledgeArticleContent {
  simple?: {
    what?: string;
    why?: string;
    example?: string;
    nextAction?: string;
  };
  detailed?: {
    concept?: string;
    howToCalculate?: string | null;
    assumptions?: string;
    limitations?: string;
    commonMistake?: string;
    whenNotToUse?: string;
  };
}

export interface KnowledgeArticle {
  id: string;
  topic_id: string;
  title: string;
  summary: string;
  content: KnowledgeArticleContent;
  difficulty: Difficulty;
  estimated_minutes: number;
  jurisdiction: string;
  version: string;
  effective_date: string | null;
  last_verified_at: string | null;
  review_status: ReviewStatus;
  educational_disclaimer: string;
}

export interface KnowledgeSource {
  id: string;
  article_id: string;
  source_name: string;
  source_url: string | null;
  source_type: string;
  publication_date: string | null;
  accessed_at: string;
  is_primary_source: boolean;
}

export interface KnowledgeFormula {
  id: string;
  slug: string;
  title: string;
  purpose: string;
  expression: string;
  input_definition: unknown;
  assumptions: string;
  limitations: string;
  example: string | null;
  version: string;
  publication_status: string;
  review_status: ReviewStatus;
  last_verified_at: string | null;
}

export interface KnowledgeRegulatoryRule {
  id: string;
  jurisdiction: string;
  category: string;
  rule_name: string;
  rule_content: string;
  effective_date: string;
  last_verified_at: string;
  source_url: string;
  version: string;
  publication_status: string;
  review_status: ReviewStatus;
}

/** Termos proibidos em conteúdo educacional (case-insensitive, word-boundary). */
export const FORBIDDEN_TERMS: readonly string[] = [
  "compre",
  "venda",
  "oportunidade garantida",
  "investimento seguro",
  "retorno garantido",
  "melhor ação para você",
  "carteira ideal",
];

export interface ForbiddenMatch {
  term: string;
  index: number;
}

/** Retorna termos proibidos encontrados no texto (educacional deve estar limpo). */
export function detectForbiddenTerms(text: string | null | undefined): ForbiddenMatch[] {
  if (!text) return [];
  const normalized = text.toLowerCase();
  const matches: ForbiddenMatch[] = [];
  for (const term of FORBIDDEN_TERMS) {
    const idx = normalized.indexOf(term);
    if (idx >= 0) matches.push({ term, index: idx });
  }
  return matches;
}

/** Regra regulatória só pode ser exibida como ativa com datas e fonte. */
export function isRegulatoryRulePublishable(rule: Partial<KnowledgeRegulatoryRule>): boolean {
  return Boolean(
    rule.effective_date &&
      rule.last_verified_at &&
      rule.source_url &&
      rule.source_url.trim().length > 0,
  );
}

/** Artigo sem nenhuma fonte deve ser tratado como não verificado, independente do status salvo. */
export function effectiveReviewStatus(
  article: Pick<KnowledgeArticle, "review_status">,
  sources: KnowledgeSource[],
): ReviewStatus {
  if (sources.length === 0) return "unverified";
  return article.review_status;
}

/** Todo artigo educacional deve carregar disclaimer não vazio. */
export function hasEducationalDisclaimer(article: Pick<KnowledgeArticle, "educational_disclaimer">): boolean {
  return Boolean(article.educational_disclaimer && article.educational_disclaimer.trim().length > 0);
}

/**
 * Garante que o modo simples e o modo detalhado partem da mesma informação base.
 * Regra: se ambos existirem, ambos precisam de conteúdo mínimo alinhado.
 */
export function simpleAndDetailedConsistent(content: KnowledgeArticleContent): boolean {
  const s = content.simple;
  const d = content.detailed;
  if (!s && !d) return false;
  if (s && !s.what) return false;
  if (d && !d.concept) return false;
  return true;
}

// ---- Data access ---------------------------------------------------------

export async function listActiveTopics(): Promise<KnowledgeTopic[]> {
  const { data, error } = await supabase
    .from("knowledge_topics")
    .select("id, slug, title, description, category, difficulty, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as KnowledgeTopic[];
}

export async function listArticlesByTopic(topicId: string): Promise<KnowledgeArticle[]> {
  const { data, error } = await supabase
    .from("knowledge_articles")
    .select(
      "id, topic_id, title, summary, content, difficulty, estimated_minutes, jurisdiction, version, effective_date, last_verified_at, review_status, educational_disclaimer",
    )
    .eq("topic_id", topicId)
    .eq("active", true)
    .eq("publication_status", "published")
    .eq("review_status", "verified")
    .order("difficulty", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as KnowledgeArticle[];
}

export async function listSourcesByArticle(articleId: string): Promise<KnowledgeSource[]> {
  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("id, article_id, source_name, source_url, source_type, publication_date, accessed_at, is_primary_source")
    .eq("article_id", articleId)
    .order("is_primary_source", { ascending: false });
  if (error) throw error;
  return (data ?? []) as KnowledgeSource[];
}

export async function getFormulaBySlug(slug: string): Promise<KnowledgeFormula | null> {
  const { data, error } = await supabase
    .from("knowledge_formulas")
    .select(
      "id, slug, title, purpose, expression, input_definition, assumptions, limitations, example, version, publication_status, review_status, last_verified_at",
    )
    .eq("slug", slug)
    .eq("active", true)
    .eq("publication_status", "published")
    .eq("review_status", "verified")
    .maybeSingle();
  if (error) throw error;
  return (data as KnowledgeFormula | null) ?? null;
}

export async function listPublishedRegulatoryRules(
  category?: string,
): Promise<KnowledgeRegulatoryRule[]> {
  let query = supabase
    .from("knowledge_regulatory_rules")
    .select(
      "id, jurisdiction, category, rule_name, rule_content, effective_date, last_verified_at, source_url, version, publication_status, review_status",
    )
    .eq("active", true)
    .eq("publication_status", "published")
    .eq("review_status", "verified");
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as KnowledgeRegulatoryRule[];
}