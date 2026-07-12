import { describe, it, expect } from "vitest";
import {
  RECOMMENDATION_TERMS,
  classifyContentFreshness,
  compareAssetDimensions,
  computeEducationalNextAction,
  detectRecommendationLanguage,
  validateAssetEducationContent,
  validateSourceFreshness,
} from "@/features/education/services/educationService";
import type { AssetEducationCase } from "@/features/education/types";

const baseAsset = (over: Partial<AssetEducationCase> = {}): AssetEducationCase => ({
  id: "a", ticker: "TEST3", company_name: "Empresa X", share_class: "ON",
  sector: "Setor", subsector: null,
  business_model: "Modelo",
  revenue_drivers: [], cost_drivers: [], competitive_advantages: [],
  capital_intensity: "Média", cyclicality: "Média",
  government_exposure: null, currency_exposure: null, commodity_exposure: null, regulatory_exposure: null,
  governance_summary: null, debt_summary: null, cash_flow_summary: null, dividend_summary: null,
  positive_thesis: ["p"], negative_thesis: ["n"], key_risks: ["r"],
  indicators_to_watch: [], events_to_watch: [],
  reporting_period: "2024-Q4",
  associated_school_slugs: [],
  sources: [{ source_name: "RI oficial", source_url: "https://x", is_primary_source: true }],
  source_date: null,
  last_verified_at: new Date().toISOString(),
  review_status: "in_review",
  educational_only: true,
  educational_disclaimer: "Conteúdo educacional.",
  ticker_validated: true,
  version: "1.0.0",
  ...over,
});

describe("educationService · linguagem de recomendação", () => {
  it("detecta compre, venda, preço-alvo, retorno garantido, carteira ideal", () => {
    for (const t of ["compre", "venda", "preço-alvo", "retorno garantido", "carteira ideal"]) {
      const found = detectRecommendationLanguage(`Texto: ${t} agora.`).map(f => f.term);
      expect(found).toContain(t);
    }
  });
  it("permite frase crítica 'Não existe dividendo garantido'", () => {
    expect(detectRecommendationLanguage("Não existe dividendo garantido nesta ficha.")).toEqual([]);
  });
  it("lista de termos cobre proibições exigidas", () => {
    for (const t of ["compre", "venda", "mantenha", "preço-alvo", "carteira ideal", "ativo perfeito"]) {
      expect(RECOMMENDATION_TERMS).toContain(t);
    }
  });
});

describe("educationService · classificação de frescor", () => {
  it("archived e unverified são preservados", () => {
    expect(classifyContentFreshness({ review_status: "archived", last_verified_at: null })).toBe("archived");
    expect(classifyContentFreshness({ review_status: "unverified", last_verified_at: null })).toBe("unverified");
  });
  it("sem data de verificação vira unverified", () => {
    expect(classifyContentFreshness({ review_status: "verified", last_verified_at: null })).toBe("unverified");
  });
  it("estados progridem por dias sem revisão", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const mkDate = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400_000).toISOString();
    expect(classifyContentFreshness({ review_status: "verified", last_verified_at: mkDate(1) }, { now })).toBe("current");
    expect(classifyContentFreshness({ review_status: "verified", last_verified_at: mkDate(150) }, { now })).toBe("review_due");
    expect(classifyContentFreshness({ review_status: "verified", last_verified_at: mkDate(300) }, { now })).toBe("stale");
  });
  it("outdated vira stale independente do tempo", () => {
    expect(classifyContentFreshness({ review_status: "outdated", last_verified_at: new Date().toISOString() })).toBe("stale");
  });
});

describe("educationService · fontes", () => {
  it("fonte sem nome não é utilizável", () => {
    expect(validateSourceFreshness({ source_name: "" })).toBe(false);
  });
  it("fonte com nome e URL é utilizável", () => {
    expect(validateSourceFreshness({ source_name: "RI", source_url: "https://x" })).toBe(true);
  });
});

describe("educationService · validação de ficha", () => {
  it("ficha completa é publicável", () => {
    expect(validateAssetEducationContent(baseAsset()).publishable).toBe(true);
  });
  it("ficha sem tese/antítese/riscos não é publicável", () => {
    expect(validateAssetEducationContent(baseAsset({ positive_thesis: [], negative_thesis: [], key_risks: [] })).publishable).toBe(false);
  });
  it("ficha sem ticker validado exige revisão", () => {
    const res = validateAssetEducationContent(baseAsset({ ticker_validated: false }));
    expect(res.publishable).toBe(false);
    expect(res.missing).toContain("ticker_validated");
  });
});

describe("educationService · comparação educacional", () => {
  it("recusa mais de três empresas", () => {
    const four = [baseAsset({ id: "1" }), baseAsset({ id: "2" }), baseAsset({ id: "3" }), baseAsset({ id: "4" })];
    expect(() => compareAssetDimensions(four, ["capital_intensity"])).toThrow();
  });
  it("sinaliza períodos diferentes como não comparáveis", () => {
    const rows = compareAssetDimensions(
      [baseAsset({ reporting_period: "2024-Q4" }), baseAsset({ id: "b", reporting_period: "2023-Q4" })],
      ["capital_intensity"],
    );
    expect(rows[0].comparable).toBe(false);
    expect(rows[0].note).toContain("Períodos");
  });
  it("sinaliza ausência de dado como não comparável", () => {
    const rows = compareAssetDimensions(
      [baseAsset(), baseAsset({ id: "b", capital_intensity: null })],
      ["capital_intensity"],
    );
    expect(rows[0].comparable).toBe(false);
  });
  it("não gera ranking nem escolhe vencedor", () => {
    const rows = compareAssetDimensions(
      [baseAsset(), baseAsset({ id: "b" })],
      ["capital_intensity", "cyclicality"],
    );
    for (const r of rows) {
      expect(r).not.toHaveProperty("winner");
      expect(r).not.toHaveProperty("score");
    }
  });
});

describe("educationService · próxima ação educacional", () => {
  it("prioriza reserva sobre renda variável", () => {
    const a = computeEducationalNextAction({
      hasEmergencyReserve: false, hasVariableIncomeExposure: true,
      concentrationRatio: 0.6, hasAssetsWithoutStudy: true, hasStaleContent: true, isBeginner: true,
    });
    expect(a.ctaLabel).toBe("Revisar reserva");
  });
  it("depois, concentração", () => {
    const a = computeEducationalNextAction({
      hasEmergencyReserve: true, hasVariableIncomeExposure: true,
      concentrationRatio: 0.6, hasAssetsWithoutStudy: true, hasStaleContent: true, isBeginner: true,
    });
    expect(a.ctaLabel).toBe("Entender concentração");
  });
  it("iniciante recebe trilha básica quando o resto está resolvido", () => {
    const a = computeEducationalNextAction({
      hasEmergencyReserve: true, hasVariableIncomeExposure: false,
      concentrationRatio: 0, hasAssetsWithoutStudy: false, hasStaleContent: false, isBeginner: true,
    });
    expect(a.ctaLabel).toBe("Iniciar trilha básica");
  });
  it("nunca gera ordem de compra ou venda", () => {
    const a = computeEducationalNextAction({
      hasEmergencyReserve: true, hasVariableIncomeExposure: false,
      concentrationRatio: 0, hasAssetsWithoutStudy: false, hasStaleContent: false, isBeginner: false,
    });
    expect(detectRecommendationLanguage(a.headline + " " + a.detail + " " + a.ctaLabel)).toEqual([]);
  });
});