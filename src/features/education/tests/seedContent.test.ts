import { describe, expect, it } from "vitest";
import { detectRecommendationLanguage } from "@/features/education/services/educationService";

/**
 * Espelho dos textos-chave semeados no banco (knowledge_investment_schools).
 * Serve para validar linguagem e cobertura das seis escolas mesmo em CI
 * sem acesso ao Supabase.
 */
const SCHOOL_TEXTS: Record<string, string> = {
  dividendos: "Foco em empresas que geram caixa recorrente e distribuem parte relevante do lucro. Dividend trap: yield alto reflete queda de preço.",
  "value-investing": "Compara preço de mercado com uma estimativa de valor intrínseco, exigindo margem de segurança. Value trap: preço barato porque a empresa está deteriorando.",
  qualidade: "Busca empresas com vantagens competitivas duradouras e alto retorno sobre capital. Pagar preço excessivo por qualidade compromete o retorno.",
  ciclos: "Estuda setores cujo resultado depende fortemente de preços, câmbio e ciclo. Normalização de margens é essencial.",
  concentradas: "Poucas empresas com convicção elevada e conhecimento profundo. Risco específico elevado.",
  macro: "Combina classes de ativos com base em cenários econômicos. Preparação em vez de previsão.",
};

describe("seed · escolas", () => {
  it("cobre as seis escolas exigidas", () => {
    for (const slug of ["dividendos","value-investing","qualidade","ciclos","concentradas","macro"]) {
      expect(SCHOOL_TEXTS).toHaveProperty(slug);
    }
  });
  it("nenhuma escola contém termo de recomendação", () => {
    for (const text of Object.values(SCHOOL_TEXTS)) {
      expect(detectRecommendationLanguage(text)).toEqual([]);
    }
  });
  it("dividendos menciona dividend trap", () => {
    expect(SCHOOL_TEXTS.dividendos.toLowerCase()).toContain("dividend trap");
  });
  it("value menciona value trap", () => {
    expect(SCHOOL_TEXTS["value-investing"].toLowerCase()).toContain("value trap");
  });
  it("ciclos menciona normalização", () => {
    expect(SCHOOL_TEXTS.ciclos.toLowerCase()).toContain("normalização");
  });
  it("concentradas menciona risco específico", () => {
    expect(SCHOOL_TEXTS.concentradas.toLowerCase()).toContain("risco específico");
  });
  it("macro diferencia previsão de preparação", () => {
    expect(SCHOOL_TEXTS.macro.toLowerCase()).toMatch(/preparação|preparacao/);
  });
});