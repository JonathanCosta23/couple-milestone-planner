/**
 * blobMigrationService — A regra de ouro: blob legado SÓ migra para as tabelas
 * normalizadas quando estas estão vazias para o plano. Tabelas com dados
 * vencem sobre o blob, evitando duplicação na fonte de verdade.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/** Chain só para o count (.select(...,{count,head}).eq().eq()). */
function countChain(count: number) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ count, error: null })),
      })),
    })),
  };
}
/** Chain para o insert (.insert(rows).select("id")). */
function insertChain(result: { data: unknown[] | null; error: unknown | null }) {
  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve(result)),
    })),
  };
}

const fromMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { migrateBlobToTables, previewBlobMigration } from "@/lib/services/blobMigrationService";
import type { AppData } from "@/lib/models";
import type { PlanMemberRow } from "@/hooks/usePlan";

const baseAppData = {
  incomes: [
    { id: "i1", label: "Salário", amount: 5000, recurrence: "monthly", type: "salary", startDate: "2026-01" },
  ],
  expenses: [
    { id: "e1", name: "Aluguel", category: "moradia", amount: 1800, priority: "essential", type: "fixed", recurrence: "monthly" },
  ],
  debts: [
    { id: "d1", name: "Cartão", type: "credit_card", totalAmount: 3000, monthlyPayment: 500, interestRate: 0.12, payoffPriority: 1, active: true },
  ],
} as unknown as AppData;

const members: PlanMemberRow[] = [
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { id: "m-primary", is_primary: true, is_active: true } as any,
];

beforeEach(() => fromMock.mockReset());

describe("blobMigrationService", () => {
  it("previewBlobMigration conta itens do blob sem persistir", () => {
    const preview = previewBlobMigration(baseAppData);
    expect(preview).toEqual({ incomes: 1, expenses: 1, debts: 1, hasAnything: true });
    expect(previewBlobMigration(null)).toEqual({ incomes: 0, expenses: 0, debts: 0, hasAnything: false });
  });

  it("NÃO migra quando tabelas normalizadas já têm dados (dados normalizados vencem)", async () => {
    fromMock
      .mockImplementationOnce(() => countChain(1)) // income
      .mockImplementationOnce(() => countChain(1)) // expenses
      .mockImplementationOnce(() => countChain(1)); // debts

    const res = await migrateBlobToTables("user-1", "plan-1", baseAppData, members);

    expect(res).toEqual({ incomes: 0, expenses: 0, debts: 0, errors: [] });
    expect(fromMock).toHaveBeenCalledTimes(3);
  });

  it("migra blob para tabelas vazias e propaga erros por categoria", async () => {
    fromMock
      .mockImplementationOnce(() => countChain(0))                                       // income count
      .mockImplementationOnce(() => insertChain({ data: [{ id: "i-new" }], error: null })) // income insert
      .mockImplementationOnce(() => countChain(0))                                       // expenses count
      .mockImplementationOnce(() => insertChain({ data: null, error: { message: "violou rls" } })) // expenses insert
      .mockImplementationOnce(() => countChain(0))                                       // debts count
      .mockImplementationOnce(() => insertChain({ data: [{ id: "d-new" }], error: null })); // debts insert

    const res = await migrateBlobToTables("user-1", "plan-1", baseAppData, members);

    expect(res.incomes).toBe(1);
    expect(res.debts).toBe(1);
    expect(res.expenses).toBe(0);
    expect(res.errors).toEqual([expect.stringContaining("Gastos")]);
  });
});