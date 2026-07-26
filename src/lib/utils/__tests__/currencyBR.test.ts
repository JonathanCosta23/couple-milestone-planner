import { describe, it, expect } from "vitest";
import { parseBRLCurrency, formatBRLCurrencyInput } from "@/lib/utils/currencyBR";

describe("parseBRLCurrency", () => {
  it.each([
    ["1000", 1000],
    ["1.000", 1000],
    ["1.000,50", 1000.5],
    ["2500,75", 2500.75],
    ["0,99", 0.99],
    ["2.500.000", 2_500_000],
    ["R$ 1.234,56", 1234.56],
    [",50", 0.5],
  ])("interpreta '%s' como %s", (raw, expected) => {
    const r = parseBRLCurrency(raw);
    expect(r.error).toBeNull();
    expect(r.value).toBe(expected);
  });

  it("campo vazio retorna value=null sem erro", () => {
    expect(parseBRLCurrency("")).toEqual({ value: null, error: null });
    expect(parseBRLCurrency("   ")).toEqual({ value: null, error: null });
  });

  it.each([
    "abc",
    "1,2,3",
    "1.00", // pontos como decimal são rejeitados
    "1.0000",
    "1,234", // 3 casas decimais
    "1.000,999",
    "-100",
    "10..0",
  ])("rejeita formato inválido: '%s'", (raw) => {
    const r = parseBRLCurrency(raw);
    expect(r.value).toBeNull();
    expect(r.error).toBeTruthy();
  });

  it("rejeita valores acima de MAX_SAFE_INTEGER", () => {
    const huge = "9".repeat(20);
    const r = parseBRLCurrency(huge);
    expect(r.value).toBeNull();
    expect(r.error).toMatch(/limite/i);
  });
});

describe("formatBRLCurrencyInput", () => {
  it("null/undefined viram string vazia", () => {
    expect(formatBRLCurrencyInput(null)).toBe("");
    expect(formatBRLCurrencyInput(undefined)).toBe("");
  });

  it("inteiro sem casas decimais, fração com 2 casas", () => {
    expect(formatBRLCurrencyInput(1000)).toMatch(/^1\.000$/);
    expect(formatBRLCurrencyInput(1000.5)).toMatch(/^1\.000,50$/);
  });
});