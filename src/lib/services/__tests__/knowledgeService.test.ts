import { describe, it, expect } from "vitest";
import {
  detectForbiddenTerms,
  effectiveReviewStatus,
  hasEducationalDisclaimer,
  isRegulatoryRulePublishable,
  simpleAndDetailedConsistent,
  FORBIDDEN_TERMS,
  type KnowledgeArticle,
  type KnowledgeSource,
  type KnowledgeRegulatoryRule,
} from "@/lib/services/knowledgeService";

const baseArticle = (over: Partial<KnowledgeArticle> = {}): KnowledgeArticle => ({
  id: "a1",
  topic_id: "t1",
  title: "T",
  summary: "s",
  content: { simple: { what: "x" }, detailed: { concept: "c" } },
  difficulty: "basic",
  estimated_minutes: 3,
  jurisdiction: "BR",
  version: "1.0.0",
  effective_date: null,
  last_verified_at: null,
  review_status: "verified",
  educational_disclaimer: "Conteúdo educacional.",
  ...over,
});

const source = (over: Partial<KnowledgeSource> = {}): KnowledgeSource => ({
  id: "s1",
  article_id: "a1",
  source_name: "Bacen",
  source_url: "https://bcb.gov.br",
  source_type: "primary",
  publication_date: null,
  accessed_at: new Date().toISOString(),
  is_primary_source: true,
  ...over,
});

describe("knowledgeService · integridade editorial", () => {
  it("artigo sem fonte fica como não verificado, mesmo se marcado verified", () => {
    expect(effectiveReviewStatus(baseArticle(), [])).toBe("unverified");
    expect(effectiveReviewStatus(baseArticle(), [source()])).toBe("verified");
  });

  it("todo artigo educacional possui disclaimer", () => {
    expect(hasEducationalDisclaimer(baseArticle())).toBe(true);
    expect(hasEducationalDisclaimer(baseArticle({ educational_disclaimer: "  " }))).toBe(false);
  });

  it("regra regulatória exige datas e fonte para ser publicável", () => {
    const rule: Partial<KnowledgeRegulatoryRule> = {
      effective_date: "2024-01-01",
      last_verified_at: new Date().toISOString(),
      source_url: "https://bcb.gov.br/x",
    };
    expect(isRegulatoryRulePublishable(rule)).toBe(true);
    expect(isRegulatoryRulePublishable({ ...rule, effective_date: undefined })).toBe(false);
    expect(isRegulatoryRulePublishable({ ...rule, source_url: "" })).toBe(false);
  });

  it("modo simples e detalhado usam a mesma informação-base", () => {
    expect(simpleAndDetailedConsistent({ simple: { what: "x" }, detailed: { concept: "y" } })).toBe(true);
    expect(simpleAndDetailedConsistent({ simple: { what: "" }, detailed: { concept: "y" } })).toBe(false);
    expect(simpleAndDetailedConsistent({})).toBe(false);
  });

  it("detecta termos de recomendação proibidos", () => {
    const found = detectForbiddenTerms("Essa é a melhor ação para você agora, compre já!");
    const terms = found.map((f) => f.term);
    expect(terms).toContain("melhor ação para você");
    expect(terms).toContain("compre");
  });

  it("texto neutro não dispara termos proibidos", () => {
    expect(detectForbiddenTerms("Reserva de emergência protege imprevistos.")).toEqual([]);
  });

  it("lista de termos proibidos cobre promessas e recomendações", () => {
    for (const term of ["compre", "venda", "retorno garantido", "carteira ideal"]) {
      expect(FORBIDDEN_TERMS).toContain(term);
    }
  });
});