/**
 * dataMigrationService — cobertura do microfechamento 4.b.1.1-B.1:
 * falha parcial no UPDATE de premissas não pode virar sucesso silencioso
 * nem expor erro SQL bruto na UI.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { migrateLocalToCloud } from "@/lib/services/dataMigrationService";

const LEGACY_PLAN_KEY = "plano-do-milhao-v6";
const BACKUP_KEY = "plano-do-milhao-pre-migration-backup";

/** `plans` é usado para o SELECT inicial e depois para o UPDATE das premissas. */
function makePlansTable(updateError: unknown | null) {
  const updateSpy = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: updateError })),
    })),
  }));
  lastUpdateSpy = updateSpy;
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    update: updateSpy,
  };
}

let lastUpdateSpy: ReturnType<typeof vi.fn> | null = null;

const localPlan = {
  config: {
    contributors: [{ name: "Ana", age: 30, plannedSelic: 500, plannedCDB: 500 }],
    targetAmount: 1_000_000,
    initialAmount: 1000,
    years: 20,
    selicRate: 0.1,
    cdbRate: 1.05,
  },
  wizardComplete: true,
  onboardingComplete: true,
};

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
  localStorage.clear();
  localStorage.setItem(LEGACY_PLAN_KEY, JSON.stringify(localPlan));
  rpcMock.mockResolvedValue({
    data: { plan: { id: "plan-1" }, members: [{ id: "m1" }] },
    error: null,
  });
});

describe("migrateLocalToCloud", () => {
  it("migra plano e premissas com sucesso", async () => {
    fromMock.mockImplementation(() => makePlansTable(null));
    const result = await migrateLocalToCloud("user-1");
    expect(result.migrated).toBe(true);
    expect(result.partial).toBeUndefined();
    expect(result.planId).toBe("plan-1");
    expect(result.membersCreated).toBe(1);
  });

  it("retorna partial=true quando o update de premissas falha", async () => {
    fromMock.mockImplementation(() =>
      makePlansTable({ message: 'permission denied for column "updated_at"', code: "42501" }),
    );
    const result = await migrateLocalToCloud("user-1");
    expect(result.migrated).toBe(true);
    expect(result.partial).toBe(true);
    expect(result.planId).toBe("plan-1");
    expect(result.warning).toBeTruthy();
  });

  it("não expõe erro SQL bruto no warning", async () => {
    fromMock.mockImplementation(() =>
      makePlansTable({ message: 'permission denied for column "updated_at"', code: "42501" }),
    );
    const result = await migrateLocalToCloud("user-1");
    expect(result.warning).not.toMatch(/permission denied|42501|SQL|column/i);
  });

  it("mantém o backup local disponível após falha parcial", async () => {
    fromMock.mockImplementation(() => makePlansTable({ message: "boom", code: "42501" }));
    await migrateLocalToCloud("user-1");
    const backup = localStorage.getItem(BACKUP_KEY);
    expect(backup).toBeTruthy();
    expect(JSON.parse(backup as string)[LEGACY_PLAN_KEY]).toBeTruthy();
  });

  it("não recria plano quando já existe no banco", async () => {
    fromMock.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [{ id: "plan-x" }], error: null })),
        })),
      })),
    }));
    const result = await migrateLocalToCloud("user-1");
    expect(result.migrated).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("envia apenas premissas financeiras no update do plano", async () => {
    fromMock.mockImplementation(() => makePlansTable(null));
    await migrateLocalToCloud("user-1");
    const payload = (lastUpdateSpy as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(Object.keys(payload).sort()).toEqual(["assumption_cdb_pct", "assumption_selic"]);
    for (const forbidden of ["mode", "updated_at", "user_id", "status", "start_date"]) {
      expect(payload).not.toHaveProperty(forbidden);
    }
  });
});
