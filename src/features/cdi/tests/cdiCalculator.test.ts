import { describe, it, expect } from "vitest";
import {
  annualRateToDailyRate,
  calculateCdiGrossReturn,
  calculateCdiInvestment,
  compareCdiScenarios,
  validateCdiSimulationInput,
} from "../services/cdiCalculator";
import { __TEST__ } from "../services/cdiTaxService";
import type { CdiSimulationInput } from "../types/cdi";

const deps = { taxRules: __TEST__.FALLBACK_IR, iofRules: __TEST__.FALLBACK_IOF };

const baseInput: CdiSimulationInput = {
  principal: 10000,
  cdiPercent: 1.0,
  cdiAnnualRate: 0.10,
  businessDays: 252,
  taxRegime: "taxable",
};

describe("annualRateToDailyRate", () => {
  it("converte 10% a.a. em taxa diária estável", () => {
    const d = annualRateToDailyRate(0.10);
    expect(d).toBeGreaterThan(0);
    expect(Math.pow(1 + d, 252)).toBeCloseTo(1.10, 6);
  });
  it("retorna 0 quando taxa é zero", () => expect(annualRateToDailyRate(0)).toBe(0));
  it("retorna 0 para taxa inválida (<= -100%)", () => expect(annualRateToDailyRate(-1)).toBe(0));
  it("aceita percentual customizado (110%)", () => {
    const d = annualRateToDailyRate(0.10);
    expect(d * 1.10).toBeGreaterThan(d);
  });
});

describe("calculateCdiGrossReturn", () => {
  it("um ano a 100% do CDI (10% a.a.) rende ~10%", () => {
    const d = annualRateToDailyRate(0.10);
    const v = calculateCdiGrossReturn(10000, d, 252);
    expect(v).toBeCloseTo(11000, 0);
  });
  it("prazo zero devolve o principal", () => {
    expect(calculateCdiGrossReturn(10000, 0.001, 0)).toBe(10000);
  });
  it("valor inicial zero retorna 0", () => expect(calculateCdiGrossReturn(0, 0.001, 100)).toBe(0));
  it("valor inicial inválido retorna 0", () => expect(calculateCdiGrossReturn(NaN, 0.001, 100)).toBe(0));
  it("é determinístico", () => {
    const a = calculateCdiGrossReturn(10000, 0.0003, 252);
    const b = calculateCdiGrossReturn(10000, 0.0003, 252);
    expect(a).toBe(b);
  });
});

describe("calculateCdiInvestment — capitalização e IR", () => {
  it("resultado líquido menor que bruto quando tributável", () => {
    const r = calculateCdiInvestment(baseInput, deps, "simple");
    expect(r.netValue).toBeLessThan(r.grossValue);
    expect(r.incomeTax).toBeGreaterThan(0);
  });
  it("produto isento não sofre IR nem IOF", () => {
    const r = calculateCdiInvestment({ ...baseInput, taxRegime: "exempt" }, deps, "simple");
    expect(r.incomeTax).toBe(0);
    expect(r.iof).toBe(0);
  });
  it("IR alíquota selecionada por prazo (>720 dias => 15%)", () => {
    const r = calculateCdiInvestment({ ...baseInput, businessDays: 252 * 3 }, deps, "detailed");
    expect(r.incomeTaxRate).toBeCloseTo(0.15, 5);
  });
  it("IR alíquota <= 180 dias corridos => 22,5%", () => {
    const r = calculateCdiInvestment({ ...baseInput, businessDays: 100 }, deps, "detailed");
    expect(r.incomeTaxRate).toBeCloseTo(0.225, 5);
  });
  it("IR alíquota 181-360 dias => 20%", () => {
    const r = calculateCdiInvestment({ ...baseInput, businessDays: 200 }, deps, "detailed");
    expect(r.incomeTaxRate).toBeCloseTo(0.20, 5);
  });
  it("IR alíquota 361-720 dias => 17,5%", () => {
    const r = calculateCdiInvestment({ ...baseInput, businessDays: 400 }, deps, "detailed");
    expect(r.incomeTaxRate).toBeCloseTo(0.175, 5);
  });
  it("modo simples adiciona aviso de estimativa", () => {
    const r = calculateCdiInvestment(baseInput, deps, "simple");
    expect(r.warnings.join(" ")).toMatch(/estimativa|CDI real/i);
  });
  it("110% do CDI rende mais que 100% mantendo demais premissas", () => {
    const a = calculateCdiInvestment(baseInput, deps, "detailed");
    const b = calculateCdiInvestment({ ...baseInput, cdiPercent: 1.1 }, deps, "detailed");
    expect(b.netValue).toBeGreaterThan(a.netValue);
  });
});

describe("aportes adicionais", () => {
  it("cada aporte capitaliza apenas pelo período em que esteve investido", () => {
    const input: CdiSimulationInput = {
      ...baseInput,
      businessDays: 252,
      additionalContribution: { amount: 1000, count: 6, frequencyMonths: 1 },
    };
    const r = calculateCdiInvestment(input, deps, "detailed");
    expect(r.totalInvested).toBeCloseTo(10000 + 6 * 1000, 2);
    const principalSlice = r.contributions[0];
    const lastContrib = r.contributions[r.contributions.length - 1];
    expect(lastContrib.businessDays).toBeLessThan(principalSlice.businessDays);
  });
  it("aportes após o prazo geram aviso e não são capitalizados", () => {
    const input: CdiSimulationInput = {
      ...baseInput,
      businessDays: 60,
      additionalContribution: { amount: 500, count: 12, frequencyMonths: 1 },
    };
    const r = calculateCdiInvestment(input, deps, "detailed");
    expect(r.warnings.some(w => /prazo final/i.test(w))).toBe(true);
  });
});

describe("inflação e ganho real", () => {
  it("inflação zero => ganho real = ganho nominal", () => {
    const r = calculateCdiInvestment({ ...baseInput, inflationAnnualRate: 0 }, deps, "detailed");
    expect(r.realYield).toBeCloseTo(r.netYield, 2);
  });
  it("inflação acima do retorno => ganho real negativo", () => {
    const r = calculateCdiInvestment({ ...baseInput, inflationAnnualRate: 0.50 }, deps, "detailed");
    expect(r.realYield).toBeLessThan(0);
  });
});

describe("comparação de cenários", () => {
  it("ordena resultados por líquido preservando premissas comuns", () => {
    const results = compareCdiScenarios([
      { ...baseInput, cdiPercent: 0.9, label: "90%" },
      { ...baseInput, cdiPercent: 1.0, label: "100%" },
      { ...baseInput, cdiPercent: 1.1, label: "110%" },
    ], deps);
    expect(results).toHaveLength(3);
    expect(results[2].netValue).toBeGreaterThan(results[0].netValue);
  });
  it("nenhum resultado usa linguagem de recomendação", () => {
    const results = compareCdiScenarios([{ ...baseInput, cdiPercent: 1.0, label: "100%" }], deps);
    const blob = JSON.stringify(results).toLowerCase();
    ["compre", "melhor investimento", "recomendado", "retorno garantido"].forEach(term => {
      expect(blob).not.toContain(term);
    });
  });
});

describe("validação de entradas", () => {
  it("rejeita percentual negativo", () => {
    const issues = validateCdiSimulationInput({ ...baseInput, cdiPercent: -0.1 });
    expect(issues.find(i => i.field === "cdiPercent")).toBeTruthy();
  });
  it("rejeita prazo inválido", () => {
    const issues = validateCdiSimulationInput({ ...baseInput, businessDays: NaN });
    expect(issues.find(i => i.field === "businessDays")).toBeTruthy();
  });
  it("rejeita taxa CDI <= -100%", () => {
    const issues = validateCdiSimulationInput({ ...baseInput, cdiAnnualRate: -1 });
    expect(issues.find(i => i.field === "cdiAnnualRate")).toBeTruthy();
  });
  it("rejeita valor inicial negativo", () => {
    const issues = validateCdiSimulationInput({ ...baseInput, principal: -1 });
    expect(issues.find(i => i.field === "principal")).toBeTruthy();
  });
});

describe("IOF", () => {
  it("resgate no dia 1 aplica alíquota de 96% sobre rendimento", () => {
    const r = calculateCdiInvestment({ ...baseInput, businessDays: 1, redeemHoldingDay: 1 }, deps, "detailed");
    expect(r.iofRate).toBeCloseTo(0.96, 2);
  });
  it("após 30 dias corridos IOF é zero", () => {
    const r = calculateCdiInvestment({ ...baseInput, redeemHoldingDay: 30 }, deps, "detailed");
    expect(r.iof).toBe(0);
  });
  it("produto isento não sofre IOF mesmo com resgate curto", () => {
    const r = calculateCdiInvestment({ ...baseInput, taxRegime: "exempt", redeemHoldingDay: 5 }, deps, "detailed");
    expect(r.iof).toBe(0);
  });
});

describe("regras versionadas", () => {
  it("resultado registra a versão da regra IR usada", () => {
    const r = calculateCdiInvestment(baseInput, deps, "detailed");
    expect(r.rulesVersion.incomeTax).toBeTruthy();
  });
});