/**
 * blobMigrationService — dados normalizados vencem; ownership ambíguo em
 * casal nunca é atribuído silenciosamente ao titular.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import {
  buildBlobOwnershipResolver,
  migrateBlobToTables,
  previewBlobMigration,
} from "@/lib/services/blobMigrationService";
import type { AppData } from "@/lib/models";
import type { PlanMemberRow } from "@/hooks/usePlan";

const baseAppData = {
  mode: "individual",
  primaryProfile: { id: "profile-primary", name: "Ana" },
  investments: [
    {
      id: "a1", name: "Tesouro", type: "tesouro-selic", institution: "Tesouro",
      currentBalance: 1000, monthlyContribution: 0, annualRate: 0,
      startDate: "2026-01-01", profileId: "profile-primary", active: true,
      createdAt: "2026-01-01", updatedAt: "2026-01-01",
    },
  ],
  incomes: [
    {
      id: "i1", profileId: "profile-primary", label: "Salário", amount: 5000,
      recurrence: "monthly", type: "salary", active: true, startDate: "2026-01",
    },
  ],
  expenses: [
    {
      id: "e1", name: "Aluguel", category: "moradia", amount: 1800,
      priority: "essential", type: "fixed", recurrence: "monthly",
      responsibleProfileId: "profile-primary", ownership: "individual",
      status: "pending", monthKey: "2026-01", createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
  ],
  debts: [
    {
      id: "d1", name: "Cartão", type: "credit-card", totalAmount: 3000,
      monthlyPayment: 500, interestRate: 0.12, payoffPriority: 1, active: true,
      profileId: "profile-primary", currentInstallment: 1, totalInstallments: 6,
      dueDay: 10, risk: "high", startDate: "2026-01-01",
      createdAt: "2026-01-01", updatedAt: "2026-01-01",
    },
  ],
} as unknown as AppData;

const individualMembers: PlanMemberRow[] = [
  {
    id: "m-primary", is_primary: true, is_active: true, status: "active",
  } as PlanMemberRow,
];

const coupleMembers: PlanMemberRow[] = [
  {
    id: "m-primary", is_primary: true, is_active: true, status: "active",
  } as PlanMemberRow,
  {
    id: "m-partner", is_primary: false, is_active: true, status: "active",
  } as PlanMemberRow,
];

function tableMock(args: {
  existing?: Partial<Record<string, number>>;
  errors?: Partial<Record<string, { message: string; code?: string }>>;
  inserted?: Record<string, Array<Record<string, unknown>>>;
}) {
  return (table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({
        count: args.existing?.[table] ?? 0,
        error: null,
      })),
    })),
    insert: vi.fn((rows: Array<Record<string, unknown>>) => {
      if (args.inserted) args.inserted[table] = rows;
      const error = args.errors?.[table] ?? null;
      return {
        select: vi.fn(() => Promise.resolve({
          data: error ? null : rows.map((_, index) => ({ id: `${table}-${index}` })),
          error,
        })),
      };
    }),
  });
}

beforeEach(() => fromMock.mockReset());

describe("previewBlobMigration", () => {
  it("conta todas as categorias sem persistir", () => {
    expect(previewBlobMigration(baseAppData)).toEqual({
      assets: 1, incomes: 1, expenses: 1, debts: 1, hasAnything: true,
    });
    expect(previewBlobMigration(null)).toEqual({
      assets: 0, incomes: 0, expenses: 0, debts: 0, hasAnything: false,
    });
  });
});

describe("buildBlobOwnershipResolver", () => {
  it("identifica titular inequivocamente", () => {
    const resolve = buildBlobOwnershipResolver(baseAppData, individualMembers);
    expect(resolve("profile-primary")).toEqual({
      memberId: "m-primary", ownershipScope: "individual",
    });
  });

  it("em casal, profile desconhecido vira needs_review", () => {
    const coupleData = { ...baseAppData, mode: "casal" } as AppData;
    const resolve = buildBlobOwnershipResolver(coupleData, coupleMembers);
    expect(resolve(undefined)).toEqual({
      memberId: null, ownershipScope: "needs_review",
    });
    expect(resolve("profile-desconhecido")).toEqual({
      memberId: null, ownershipScope: "needs_review",
    });
  });
});

describe("migrateBlobToTables", () => {
  it("não duplica categorias já normalizadas e contabiliza ignored", async () => {
    fromMock.mockImplementation(tableMock({
      existing: { assets: 1, income: 1, expenses: 1, debts: 1 },
    }));

    const result = await migrateBlobToTables(
      "user-1", "plan-1", baseAppData, individualMembers,
    );

    expect(result).toEqual({
      assets: 0,
      incomes: 0,
      expenses: 0,
      debts: 0,
      individualCreated: 0,
      needsReviewCreated: 0,
      ignored: 4,
      errors: [],
    });
  });

  it("migra ownership individual sem enviar user_id", async () => {
    const inserted: Record<string, Array<Record<string, unknown>>> = {};
    fromMock.mockImplementation(tableMock({ inserted }));

    const result = await migrateBlobToTables(
      "user-1", "plan-1", baseAppData, individualMembers,
    );

    expect(result.assets).toBe(1);
    expect(result.incomes).toBe(1);
    expect(result.expenses).toBe(1);
    expect(result.debts).toBe(1);
    expect(result.individualCreated).toBe(4);
    expect(result.needsReviewCreated).toBe(0);

    for (const rows of Object.values(inserted)) {
      expect(rows[0].member_id).toBe("m-primary");
      expect(rows[0].ownership_scope).toBe("individual");
      expect(rows[0]).not.toHaveProperty("user_id");
    }
  });

  it("migração ambígua em casal produz needs_review", async () => {
    const inserted: Record<string, Array<Record<string, unknown>>> = {};
    const ambiguous = {
      ...baseAppData,
      mode: "casal",
      primaryProfile: { id: "p1", name: "Ana" },
      partner: { profile: { id: "p2", name: "Bia" } },
      incomes: [{ ...baseAppData.incomes[0], profileId: "desconhecido" }],
      expenses: [{
        ...baseAppData.expenses[0],
        responsibleProfileId: undefined,
        ownership: "shared",
      }],
      debts: [{ ...baseAppData.debts[0], profileId: undefined }],
      investments: [{ ...baseAppData.investments[0], profileId: undefined }],
    } as unknown as AppData;
    fromMock.mockImplementation(tableMock({ inserted }));

    const result = await migrateBlobToTables(
      "user-1", "plan-1", ambiguous, coupleMembers,
    );

    expect(result.needsReviewCreated).toBe(4);
    expect(result.individualCreated).toBe(0);
    for (const rows of Object.values(inserted)) {
      expect(rows[0].member_id).toBeNull();
      expect(rows[0].ownership_scope).toBe("needs_review");
    }
  });

  it("propaga erro seguro por categoria sem contar criação", async () => {
    fromMock.mockImplementation(tableMock({
      errors: { expenses: { message: "violou rls", code: "42501" } },
    }));

    const result = await migrateBlobToTables(
      "user-1", "plan-1", baseAppData, individualMembers,
    );

    expect(result.assets).toBe(1);
    expect(result.incomes).toBe(1);
    expect(result.expenses).toBe(0);
    expect(result.debts).toBe(1);
    expect(result.errors).toEqual([expect.stringContaining("Gastos")]);
  });
});
