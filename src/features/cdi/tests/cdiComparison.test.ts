import { describe, it, expect } from "vitest";
import { compareCdiScenarios } from "../services/cdiCalculator";
import { __TEST__ } from "../services/cdiTaxService";
import type { CdiSimulationInput } from "../types/cdi";

const deps = { taxRules: __TEST__.FALLBACK_IR, iofRules: __TEST__.FALLBACK_IOF };

const base: CdiSimulationInput = {
  principal: 10000,
  cdiPercent: 1.0,
  cdiAnnualRate: 0.10,
  businessDays: 252,
  taxRegime: "taxable",
};

describe("compareCdiScenarios", () => {
  it("todos os cenários usam mesmas premissas", () => {
    const results = compareCdiScenarios([
      { ...base, cdiPercent: 0.9, label: "90%" },
      { ...base, cdiPercent: 1.0, label: "100%" },
      { ...base, cdiPercent: 1.1, label: "110%" },
    ], deps);
    results.forEach(r => {
      expect(r.totalInvested).toBe(10000);
      expect(r.input.businessDays).toBe(252);
      expect(r.input.taxRegime).toBe("taxable");
    });
  });
  it("comparação bruta é monotônica no percentual do CDI", () => {
    const results = compareCdiScenarios([
      { ...base, cdiPercent: 0.9, label: "90%" },
      { ...base, cdiPercent: 1.1, label: "110%" },
    ], deps);
    expect(results[1].grossValue).toBeGreaterThan(results[0].grossValue);
  });
  it("ausência de dados não gera conclusão", () => {
    expect(compareCdiScenarios([], deps)).toEqual([]);
  });
  it("nenhum termo proibido é emitido", () => {
    const results = compareCdiScenarios([{ ...base, cdiPercent: 1.0, label: "100%" }], deps);
    const blob = JSON.stringify(results).toLowerCase();
    ["investimento seguro", "retorno garantido", "melhor ação", "compre"].forEach(t => expect(blob).not.toContain(t));
  });
});