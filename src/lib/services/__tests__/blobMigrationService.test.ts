/**
 * blobMigrationService — A regra de ouro: blob legado SÓ migra para as tabelas
 * normalizadas quando estas estão vazias para o plano. Tabelas com dados
 * vencem sobre o blob, evitando duplicação na fonte de verdade.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/** Pequeno builder de chain Supabase para os queries deste serviço. */
function chain(steps: { count?: number; insertResult?: { error: unknown; data: unknown[] } }) {
  const api: Record<string, unknown> = {};
  api.select = vi.fn((_cols: unknown, opts?: { count?: string; head?: boolean }) => {
    if (opts?.count === "exact" && opts.head) {
      const eq1 = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ count: steps.count ?? 0, error: null })),
      }));
      return { eq: eq1 };
    }
    // Pós-insert .select("id") devolve direto.
    return Promise.resolve(steps.insertResult ?? { data: [], error: null });
  });
  api.insert = vi.fn(() => ({
    select: vi.fn(() => Promise.resolve(steps.insertResult ?? { data: [], error: null })),
  }));
  return api;
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
    // count = 1 para income/expenses/debts → nada a migrar.
    fromMock
      .mockImplementationOnce(() => chain({ count: 1 })) // income
      .mockImplementationOnce(() => chain({ count: 1 })) // expenses
      .mockImplementationOnce(() => chain({ count: 1 })); // debts

    const res = await migrateBlobToTables("user-1", "plan-1", baseAppData, members);

    expect(res).toEqual({ incomes: 0, expenses: 0, debts: 0, errors: [] });
    // Apenas as 3 verificações de count — nenhum insert.
    expect(fromMock).toHaveBeenCalledTimes(3);
  });

  it("migra blob para tabelas vazias e propaga erros por categoria", async () => {
    fromMock
      .mockImplementationOnce(() => chain({ count: 0, insertResult: { data: [{ id: "i-new" }], error: null } }))
      .mockImplementationOnce(() => chain({ count: 0, insertResult: { data: [], error: { message: "violou rls" } } }))
      .mockImplementationOnce(() => chain({ count: 0, insertResult: { data: [{ id: "d-new" }], error: null } }));

    const res = await migrateBlobToTables("user-1", "plan-1", baseAppData, members);

    expect(res.incomes).toBe(1);
    expect(res.debts).toBe(1);
    expect(res.expenses).toBe(0);
    expect(res.errors).toEqual([expect.stringContaining("Gastos")]);
  });
});