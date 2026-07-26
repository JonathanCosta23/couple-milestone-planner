import { describe, it, expect, vi } from "vitest";
import {
  savePlanSettings,
  CLOUD_PLAN_NOT_READY_MESSAGE,
  type PlanSettingsPatch,
} from "@/lib/services/planSettingsService";
import type { PlanConfig } from "@/lib/types";

function makeDeps(overrides: Partial<Parameters<typeof savePlanSettings>[0]> = {}) {
  const currentConfig: PlanConfig = {
    initialAmount: 5_000,
    targetAmount: 1_000_000,
    years: 20,
    selicRate: 0.1,
    cdbRate: 1,
    contributors: [
      { name: "A", plannedSelic: 600, plannedCDB: 400 },
      { name: "B", plannedSelic: 200, plannedCDB: 800 },
    ],
  };
  const patch: PlanSettingsPatch = {
    goalAmount: 2_500_000,
    initialAmount: 10_000,
    monthlyContribution: 3_000,
    goalYears: 25,
    goalPurpose: "liberdade-financeira",
  };
  const updateConfig = vi.fn();
  const updateFinancialProfile = vi.fn();
  const refreshCloudPlan = vi.fn().mockResolvedValue(undefined);
  const writer = {
    updatePlan: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    deps: {
      cloudPlanId: "plan-1",
      currentConfig,
      currentProfile: undefined,
      patch,
      writer,
      updateConfig,
      updateFinancialProfile,
      refreshCloudPlan,
      ...overrides,
    },
    writer,
    updateConfig,
    updateFinancialProfile,
    refreshCloudPlan,
    currentConfig,
  };
}

describe("savePlanSettings", () => {
  it("sem cloudPlanId, lança erro amigável e não altera estado local", async () => {
    const { deps, writer, updateConfig, updateFinancialProfile } = makeDeps({
      cloudPlanId: null,
    });
    await expect(savePlanSettings(deps)).rejects.toThrow(
      CLOUD_PLAN_NOT_READY_MESSAGE,
    );
    expect(writer.updatePlan).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
    expect(updateFinancialProfile).not.toHaveBeenCalled();
  });

  it("falha do writer não chama updateConfig nem updateFinancialProfile", async () => {
    const { deps, updateConfig, updateFinancialProfile, refreshCloudPlan } =
      makeDeps();
    deps.writer.updatePlan = vi
      .fn()
      .mockResolvedValue({ error: "boom" });
    await expect(savePlanSettings(deps)).rejects.toThrow("boom");
    expect(refreshCloudPlan).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
    expect(updateFinancialProfile).not.toHaveBeenCalled();
  });

  it("sucesso: chama writer, refresh e depois estado local (nesta ordem)", async () => {
    const calls: string[] = [];
    const { deps, updateConfig, updateFinancialProfile } = makeDeps();
    deps.writer.updatePlan = vi.fn().mockImplementation(async () => {
      calls.push("writer");
      return { error: null };
    });
    deps.refreshCloudPlan = vi.fn().mockImplementation(async () => {
      calls.push("refresh");
    });
    updateConfig.mockImplementation(() => calls.push("updateConfig"));
    updateFinancialProfile.mockImplementation(() =>
      calls.push("updateFinancialProfile"),
    );
    await savePlanSettings(deps);
    expect(calls).toEqual([
      "writer",
      "refresh",
      "updateConfig",
      "updateFinancialProfile",
    ]);
  });

  it("sucesso: soma final dos contributors é exatamente o aporte", async () => {
    const { deps, updateConfig } = makeDeps();
    deps.patch = { ...deps.patch, monthlyContribution: 1234.57 };
    await savePlanSettings(deps);
    const nextConfig = updateConfig.mock.calls[0][0] as PlanConfig;
    const sum = nextConfig.contributors.reduce(
      (s, c) => s + c.plannedSelic + c.plannedCDB,
      0,
    );
    expect(Math.round(sum * 100)).toBe(Math.round(1234.57 * 100));
    expect(nextConfig.initialAmount).toBe(10_000);
    expect(nextConfig.targetAmount).toBe(2_500_000);
    expect(nextConfig.years).toBe(25);
  });

  it("sucesso propaga goalPurposeCustom para updateFinancialProfile", async () => {
    const { deps, updateFinancialProfile } = makeDeps();
    deps.patch = {
      ...deps.patch,
      goalPurpose: "outro",
      goalPurposeCustom: "Comprar casa",
    };
    await savePlanSettings(deps);
    expect(updateFinancialProfile).toHaveBeenCalledWith(
      {},
      "outro",
      "Comprar casa",
    );
  });
});