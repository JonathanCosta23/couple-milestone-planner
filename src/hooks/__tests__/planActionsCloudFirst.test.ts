/**
 * usePlanActions.completeWizard — Cloud-first: falha na nuvem NÃO pode
 * disparar completeWizardLocal, updatePrimaryProfileLocal, addPartnerLocal
 * ou setModeLocal. Só sucesso permite espelho local.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const writerCreate = vi.fn();
vi.mock("@/hooks/usePlanWriter", () => ({
  usePlanWriter: () => ({
    createPlanFromWizard: (...a: unknown[]) => writerCreate(...a),
    setPlanMode: vi.fn(),
    addPartner: vi.fn(),
    removePartner: vi.fn(),
    updateMember: vi.fn(),
    updatePlan: vi.fn(),
  }),
}));
// evita toast real
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { renderHook, act } from "@testing-library/react";
import { usePlanActions } from "@/hooks/domain/usePlanActions";
import type { PlanConfig } from "@/lib/types";

function baseDeps(overrides: Partial<Parameters<typeof usePlanActions>[0]> = {}) {
  return {
    user: { id: "user-1" },
    cloudPlan: { id: "plan-1" } as never,
    primaryMember: null,
    partnerMember: null,
    appData: { partner: null } as never,
    refreshCloudPlan: vi.fn().mockResolvedValue(undefined),
    completeWizardLocal: vi.fn(),
    setModeLocal: vi.fn(),
    addPartnerLocal: vi.fn(),
    removePartnerLocal: vi.fn(),
    updatePrimaryProfileLocal: vi.fn(),
    updatePartnerProfileLocal: vi.fn(),
    ...overrides,
  } as Parameters<typeof usePlanActions>[0];
}

const CONFIG: PlanConfig = {
  targetAmount: 1_000_000,
  initialAmount: 0,
  monthlyContribution: 500,
  years: 20,
  months: 240,
  contributors: [{ name: "Ana", age: 30, plannedSelic: 250, plannedCDB: 250, actualSelic: 0, actualCDB: 0 }],
} as unknown as PlanConfig;

beforeEach(() => {
  writerCreate.mockReset();
});

describe("usePlanActions.completeWizard cloud-first", () => {
  it("falha na nuvem NÃO altera estado local", async () => {
    writerCreate.mockResolvedValueOnce({ data: null, error: "permission denied" });
    const deps = baseDeps();
    const { result } = renderHook(() => usePlanActions(deps));
    await act(async () => { await result.current.completeWizard(CONFIG); });
    expect(deps.completeWizardLocal).not.toHaveBeenCalled();
    expect(deps.updatePrimaryProfileLocal).not.toHaveBeenCalled();
    expect(deps.addPartnerLocal).not.toHaveBeenCalled();
    expect(deps.setModeLocal).not.toHaveBeenCalled();
    expect(deps.refreshCloudPlan).not.toHaveBeenCalled();
  });

  it("sucesso aplica local depois da nuvem", async () => {
    writerCreate.mockResolvedValueOnce({
      data: { plan: { id: "p1", mode: "individual" }, members: [] }, error: null,
    });
    const deps = baseDeps();
    const { result } = renderHook(() => usePlanActions(deps));
    await act(async () => { await result.current.completeWizard(CONFIG); });
    expect(deps.completeWizardLocal).toHaveBeenCalledTimes(1);
    expect(deps.updatePrimaryProfileLocal).toHaveBeenCalledWith({ name: "Ana" });
    expect(deps.refreshCloudPlan).toHaveBeenCalledTimes(1);
  });

  it("sem usuário aplica local direto (fluxo pré-login)", async () => {
    const deps = baseDeps({ user: null, cloudPlan: null });
    const { result } = renderHook(() => usePlanActions(deps));
    await act(async () => { await result.current.completeWizard(CONFIG); });
    expect(writerCreate).not.toHaveBeenCalled();
    expect(deps.completeWizardLocal).toHaveBeenCalledTimes(1);
  });

  it("refresh falhando após write confirmado NÃO gera falso erro", async () => {
    writerCreate.mockResolvedValueOnce({
      data: { plan: { id: "p1", mode: "individual" }, members: [] }, error: null,
    });
    const deps = baseDeps({
      refreshCloudPlan: vi.fn().mockRejectedValue(new Error("network fail")),
    });
    const { result } = renderHook(() => usePlanActions(deps));
    let out: unknown = "unset";
    await act(async () => { out = await result.current.completeWizard(CONFIG); });
    // Não lança, e o local FOI aplicado (write já confirmado).
    expect(out).toEqual({ needsFinancialSetup: expect.any(Boolean) });
    expect(deps.completeWizardLocal).toHaveBeenCalledTimes(1);
  });
});