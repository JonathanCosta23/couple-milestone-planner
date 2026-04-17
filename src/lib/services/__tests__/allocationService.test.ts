/**
 * Cobertura adicional de concentração e proteção patrimonial via allocationService.
 */
import { describe, it, expect } from "vitest";
import { analyzeAllocation } from "@/lib/services/allocationService";
import { makeAppData, makeInvestment } from "@/test/helpers/factories";

describe("allocationService", () => {
  it("classifica risco de concentração como 'critical' quando uma instituição passa de 80%", () => {
    const appData = makeAppData({
      investments: [
        makeInvestment({ institution: "Nubank", conglomerate: "Nu", type: "cdb", currentBalance: 90_000 }),
        makeInvestment({ institution: "Itaú", conglomerate: "Itaú", type: "cdb", currentBalance: 10_000 }),
      ],
    });
    const r = analyzeAllocation(appData);
    expect(r.concentrationRisk).toBe("critical");
  });

  it("classifica risco como 'low' em carteira distribuída (<40% por instituição)", () => {
    const appData = makeAppData({
      investments: [
        makeInvestment({ institution: "A", conglomerate: "A", type: "cdb", currentBalance: 30_000 }),
        makeInvestment({ institution: "B", conglomerate: "B", type: "cdb", currentBalance: 30_000 }),
        makeInvestment({ institution: "C", conglomerate: "C", type: "cdb", currentBalance: 40_000 }),
      ],
    });
    const r = analyzeAllocation(appData);
    expect(r.concentrationRisk).toBe("low");
  });

  it("calcula protectionRatio considerando FGC + soberano", () => {
    const appData = makeAppData({
      investments: [
        makeInvestment({ type: "cdb", currentBalance: 50_000 }),
        makeInvestment({ type: "tesouro-selic", currentBalance: 50_000 }),
      ],
    });
    const r = analyzeAllocation(appData);
    expect(r.protectionRatio).toBeCloseTo(1, 5);
    expect(r.unprotectedTotal).toBe(0);
  });
});
