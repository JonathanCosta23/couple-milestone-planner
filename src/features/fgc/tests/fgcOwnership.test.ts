import { describe, it, expect } from "vitest";
import { allocateJointOwnership, calculateFgcDiagnosis } from "../services/fgcCalculator";
import { FGC_FALLBACK_RULES } from "../services/fgcInstitutionProvider";
import type { FgcAssetInput } from "../types/fgc";

function asset(o: Partial<FgcAssetInput> = {}): FgcAssetInput {
  return {
    id: o.id ?? "x", titularId: "t1", productCode: "cdb",
    institutionKey: "i", conglomerateKey: "c",
    institutionVerified: true, conglomerateVerified: true,
    currentBalance: 300_000, ownership: "individual",
    coverageStatus: "potentially_covered", ...o,
  };
}

describe("titularidade", () => {
  it("individual retorna 100% ao titular", () =>
    expect(allocateJointOwnership(asset({ currentBalance: 200_000 }), "t1")).toBe(200_000));
  it("conta conjunta 2 titulares divide em metade", () =>
    expect(allocateJointOwnership(asset({ ownership: "joint", ownershipHolderCount: 2 }), "t1")).toBe(150_000));
  it("plano casal nao soma limites como conjuntos", () => {
    const d = calculateFgcDiagnosis({
      assets: [
        asset({ id: "a1", titularId: "t1", currentBalance: 240_000 }),
        asset({ id: "a2", titularId: "t2", currentBalance: 240_000 }),
      ],
      ordinaryLimitRule: FGC_FALLBACK_RULES.ordinary, prudentialMargin: 0,
      titularNames: { t1: "A", t2: "B" },
    });
    expect(d.rows.length).toBe(2);
    expect(d.totalOfficialExcess).toBe(0);
  });
});