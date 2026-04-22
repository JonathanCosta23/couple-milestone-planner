/**
 * useDataLifecycle — boot mínimo e ordem hidratação → save.
 *
 * Cobertura focada (smoke + invariante crítica):
 *   1. Boot sem usuário: status idle, nenhum side-effect de cloud é disparado.
 *   2. Boot com usuário + sem dados locais nem na nuvem: sync inicial roda
 *      uma única vez por userId e termina em status "ready".
 *   3. Auto-save NÃO dispara antes da hidratação concluir (anti race-condition).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// ── Mocks dos colaboradores pesados ──
const loadFromCloud = vi.fn();
const saveToCloud = vi.fn();
const hasLocalData = vi.fn();

vi.mock("@/hooks/useCloudSync", () => ({
  useCloudSync: () => ({ loadFromCloud, saveToCloud, hasLocalData }),
}));

const listAssets = vi.fn().mockResolvedValue({ data: [] });
vi.mock("@/hooks/useAssetWriter", () => ({
  useAssetWriter: () => ({ listAssets }),
  assetRowToInvestment: (r: unknown) => r,
}));

// Hidratação controlada: começa não hidratada e expomos um setter.
const hydrationState = {
  hydrated: false,
  counts: { incomes: 0, expenses: 0, debts: 0 },
  forceRefresh: vi.fn(),
};
vi.mock("@/hooks/useDataHydration", () => ({
  useDataHydration: () => hydrationState,
}));

vi.mock("@/lib/services/dataMigrationService", () => ({
  backupBeforeDestructiveOp: vi.fn(),
}));
vi.mock("@/lib/services/blobMigrationService", () => ({
  loadAppDataFromBlob: vi.fn().mockResolvedValue(null),
  previewBlobMigration: () => ({ incomes: 0, expenses: 0, debts: 0 }),
  migrateBlobToTables: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import { useDataLifecycle } from "@/hooks/useDataLifecycle";
import { createDefaultAppData } from "@/lib/models";
import type { PlanData } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

const baseAppData = createDefaultAppData();
const basePlanData: PlanData = {
  config: { initialAmount: 0, targetAmount: 1_000_000, years: 21, selicRate: 0.13, cdbRate: 1, contributors: [] },
  monthRecords: [],
  startDate: "2026-01",
  wizardComplete: false,
  onboardingComplete: false,
  notifications: { enabled: false, time: "09:00" },
} as unknown as PlanData;

function makeUser(id = "user-1"): User {
  return { id, email: "x@x", aud: "authenticated", created_at: "" } as unknown as User;
}

function defaultParams(overrides: Partial<Parameters<typeof useDataLifecycle>[0]> = {}) {
  return {
    user: null,
    data: basePlanData,
    appData: baseAppData,
    cloudPlanRow: null,
    cloudMembers: [],
    setAppData: vi.fn(),
    setPlanData: vi.fn(),
    importJSON: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hydrationState.hydrated = false;
  hasLocalData.mockReturnValue(false);
  loadFromCloud.mockResolvedValue({ planData: null, appData: null });
  saveToCloud.mockResolvedValue(undefined);
});

describe("useDataLifecycle", () => {
  it("boot sem usuário: status idle e nenhum side-effect de cloud", async () => {
    const { result } = renderHook(() => useDataLifecycle(defaultParams()));
    expect(result.current.status).toBe("idle");
    expect(loadFromCloud).not.toHaveBeenCalled();
    expect(saveToCloud).not.toHaveBeenCalled();
  });

  it("boot com usuário sem dados: sync inicial roda 1x e termina em 'ready'", async () => {
    const { result, rerender } = renderHook(
      (p: ReturnType<typeof defaultParams>) => useDataLifecycle(p),
      { initialProps: defaultParams({ user: makeUser() }) },
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(loadFromCloud).toHaveBeenCalledTimes(1);

    // Re-render com mesmo usuário não dispara sync de novo.
    rerender(defaultParams({ user: makeUser() }));
    await waitFor(() => expect(loadFromCloud).toHaveBeenCalledTimes(1));
  });

  it("auto-save NÃO dispara antes da hidratação quando há plano na nuvem (anti race)", async () => {
    vi.useFakeTimers();
    try {
      const cloudPlanRow = { id: "plan-1" };
      const wizardCompleteData = { ...basePlanData, wizardComplete: true } as PlanData;
      hydrationState.hydrated = false; // ainda não hidratou

      renderHook(() =>
        useDataLifecycle(
          defaultParams({
            user: makeUser(),
            data: wizardCompleteData,
            cloudPlanRow,
          }),
        ),
      );

      // Avança o debounce de 3s do auto-save.
      await act(async () => {
        vi.advanceTimersByTime(3500);
      });

      // saveToCloud não pode ter sido chamado pelo auto-save (hydratedRef=false).
      // Pode ter sido chamado pelo sync inicial se houvesse localData, mas
      // hasLocalData=false e cloudExists=false, então nenhum branch chama save.
      expect(saveToCloud).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});