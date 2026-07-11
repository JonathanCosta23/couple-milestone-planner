import { describe, it, expect } from "vitest";
import {
  calculateIncomeTax,
  calculateIncomeTaxRate,
  calculateIof,
  calculateIofRate,
  __TEST__,
} from "../services/cdiTaxService";

describe("calculateIncomeTaxRate", () => {
  it("faixa 1 (até 180 dias) => 22,5%", () => {
    expect(calculateIncomeTaxRate(30, "fixed_income_taxable", __TEST__.FALLBACK_IR).rate).toBeCloseTo(0.225);
  });
  it("faixa 2 (181-360 dias) => 20%", () => {
    expect(calculateIncomeTaxRate(200, "fixed_income_taxable", __TEST__.FALLBACK_IR).rate).toBeCloseTo(0.20);
  });
  it("faixa 3 (361-720 dias) => 17,5%", () => {
    expect(calculateIncomeTaxRate(500, "fixed_income_taxable", __TEST__.FALLBACK_IR).rate).toBeCloseTo(0.175);
  });
  it("faixa 4 (>720 dias) => 15%", () => {
    expect(calculateIncomeTaxRate(800, "fixed_income_taxable", __TEST__.FALLBACK_IR).rate).toBeCloseTo(0.15);
  });
  it("produto isento => 0%", () => {
    expect(calculateIncomeTaxRate(500, "fixed_income_exempt", __TEST__.FALLBACK_IR).rate).toBe(0);
  });
  it("regra inativa não é usada", () => {
    const inactive = __TEST__.FALLBACK_IR.map(r => ({ ...r, active: false }));
    expect(calculateIncomeTaxRate(100, "fixed_income_taxable", inactive).rate).toBe(0);
  });
  it("versão é preservada", () => {
    expect(calculateIncomeTaxRate(100, "fixed_income_taxable", __TEST__.FALLBACK_IR).version).toBeTruthy();
  });
});

describe("calculateIncomeTax", () => {
  it("incide sobre rendimento, não sobre principal", () => {
    expect(calculateIncomeTax(1000, 0.15)).toBeCloseTo(150);
  });
  it("rendimento zero => imposto zero", () => expect(calculateIncomeTax(0, 0.15)).toBe(0));
  it("rendimento negativo => imposto zero", () => expect(calculateIncomeTax(-10, 0.15)).toBe(0));
});

describe("calculateIofRate", () => {
  it("dia 1 tem alíquota alta", () => {
    expect(calculateIofRate(1, "fixed_income_taxable", __TEST__.FALLBACK_IOF).rate).toBeGreaterThan(0.9);
  });
  it("dia 15 tem alíquota intermediária", () => {
    const rate = calculateIofRate(15, "fixed_income_taxable", __TEST__.FALLBACK_IOF).rate;
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(0.9);
  });
  it("dia 30 => 0", () => expect(calculateIofRate(30, "fixed_income_taxable", __TEST__.FALLBACK_IOF).rate).toBe(0));
  it("produto isento => 0", () => expect(calculateIofRate(5, "fixed_income_exempt", __TEST__.FALLBACK_IOF).rate).toBe(0));
  it("dia inválido => 0", () => expect(calculateIofRate(NaN, "fixed_income_taxable", __TEST__.FALLBACK_IOF).rate).toBe(0));
});

describe("calculateIof", () => {
  it("incide sobre rendimento, não principal", () => {
    expect(calculateIof(100, 0.5)).toBeCloseTo(50);
  });
  it("rendimento zero => IOF zero", () => expect(calculateIof(0, 0.5)).toBe(0));
});