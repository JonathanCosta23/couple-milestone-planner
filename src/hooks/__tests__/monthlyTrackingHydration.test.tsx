/**
 * Fase 2.D — Garantias de hidratação de monthly_tracking +
 * monthly_member_tracking a partir do Supabase normalizado.
 *
 * Cobre:
 *   1. Hidratação carrega monthRecords das tabelas normalizadas e respeita a
 *      ordem (titular primeiro, parceiro depois).
 *   2. Quando a tabela tem registros, eles vencem sobre o cache local
 *      (substituem monthRecords prévios em planData).
 *   3. Quando a tabela está vazia, NÃO sobrescreve monthRecords do cache.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const listIncome = vi.fn(async () => ({ data: [], error: null }));
const listExpenses = vi.fn(async () => ({ data: [], error: null }));
const listDebts = vi.fn(async () => ({ data: [], error: null }));
const listMonthlyTracking = vi.fn(async () => ({ data: [], error: null }));
const listMemberTracking = vi.fn(async () => ({ data: [], error: null }));

vi.mock("@/hooks/useIncomeWriter", () => ({
  useIncomeWriter: () => ({ listIncome }),
  incomeRowToModel: (r: unknown) => r,
}));
vi.mock("@/hooks/useExpenseWriter", () => ({
  useExpenseWriter: () => ({ listExpenses }),
  expenseRowToModel: (r: unknown) => r,
}));
vi.mock("@/hooks/useDebtWriter", () => ({
  useDebtWriter: () => ({ listDebts }),
  debtRowToModel: (r: unknown) => r,
}));
vi.mock("@/hooks/useMonthlyTrackingWriter", () => ({
  useMonthlyTrackingWriter: () => ({ listMonthlyTracking, listMemberTracking }),
}));

import { useDataHydration } from "@/hooks/useDataHydration";
import type { PlanMemberRow } from "@/hooks/usePlan";

const members: PlanMemberRow[] = [
  { id: "m-primary", plan_id: "p1", user_id: "u1", name: "Ana", role: "titular", is_primary: true, is_active: true, age: 30, avatar_color: null, created_at: "", updated_at: "" } as unknown as PlanMemberRow,
  { id: "m-partner", plan_id: "p1", user_id: "u1", name: "Bia", role: "parceiro", is_primary: false, is_active: true, age: 31, avatar_color: null, created_at: "", updated_at: "" } as unknown as PlanMemberRow,
];

beforeEach(() => {
  listMonthlyTracking.mockClear();
  listMemberTracking.mockClear();
  listIncome.mockClear();
  listExpenses.mockClear();
  listDebts.mockClear();
});

describe("useDataHydration — monthly_tracking + monthly_member_tracking", () => {
  it("hidrata monthRecords e mantém ordem titular → parceiro", async () => {
    listMonthlyTracking.mockImplementationOnce(async () => ({
      data: [
        { id: "t1", month_key: "2026-01", status: "partial", notes: "" },
        { id: "t2", month_key: "2026-02", status: "completed", notes: "ok" },
      ],
      error: null,
    }));
    listMemberTracking.mockImplementationOnce(async () => ({
      data: [
        { monthly_tracking_id: "t1", plan_member_id: "m-primary", actual_selic: 100, actual_cdb: 50 },
        { monthly_tracking_id: "t1", plan_member_id: "m-partner", actual_selic: 70, actual_cdb: 30 },
        { monthly_tracking_id: "t2", plan_member_id: "m-primary", actual_selic: 200, actual_cdb: 0 },
      ],
      error: null,
    }));

    const setAppData = vi.fn();
    const setPlanData = vi.fn();
    renderHook(() =>
      useDataHydration({
        userId: "u1", planId: "p1", members,
        setAppData, setPlanData,
      }),
    );

    await waitFor(() => expect(setPlanData).toHaveBeenCalled());
    const mutator = setPlanData.mock.calls[0][0] as (p: { monthRecords: unknown[] }) => { monthRecords: { monthKey: string; deposits: { actualSelic: number; actualCDB: number }[]; completed: boolean }[] };
    const next = mutator({ monthRecords: [] });
    expect(next.monthRecords).toHaveLength(2);
    expect(next.monthRecords[0].monthKey).toBe("2026-01");
    expect(next.monthRecords[0].deposits[0]).toEqual({ actualSelic: 100, actualCDB: 50 }); // titular
    expect(next.monthRecords[0].deposits[1]).toEqual({ actualSelic: 70, actualCDB: 30 }); // parceiro
    expect(next.monthRecords[1].completed).toBe(true);
  });

  it("NÃO sobrescreve monthRecords locais quando a tabela está vazia", async () => {
    const setAppData = vi.fn();
    const setPlanData = vi.fn();
    renderHook(() =>
      useDataHydration({
        userId: "u1", planId: "p2-empty", members,
        setAppData, setPlanData,
      }),
    );

    await waitFor(() => expect(listMonthlyTracking).toHaveBeenCalled());
    // Como meses estão vazios, setPlanData NÃO deve ter sido chamado.
    expect(setPlanData).not.toHaveBeenCalled();
  });

  it("modo individual gera apenas o slot do titular (parceiro ignorado)", async () => {
    listMonthlyTracking.mockImplementationOnce(async () => ({
      data: [{ id: "t1", month_key: "2026-03", status: "pending", notes: "" }],
      error: null,
    }));
    listMemberTracking.mockImplementationOnce(async () => ({
      data: [
        { monthly_tracking_id: "t1", plan_member_id: "m-primary", actual_selic: 500, actual_cdb: 0 },
        // Depósito órfão de um parceiro que não está mais ativo: deve ser ignorado.
        { monthly_tracking_id: "t1", plan_member_id: "m-removed", actual_selic: 999, actual_cdb: 0 },
      ],
      error: null,
    }));

    const setAppData = vi.fn();
    const setPlanData = vi.fn();
    renderHook(() =>
      useDataHydration({
        userId: "u1", planId: "p3-individual", members: [members[0]],
        setAppData, setPlanData,
      }),
    );

    await waitFor(() => expect(setPlanData).toHaveBeenCalled());
    const mutator = setPlanData.mock.calls[0][0] as (p: { monthRecords: unknown[] }) => { monthRecords: { deposits: { actualSelic: number }[] }[] };
    const next = mutator({ monthRecords: [] });
    expect(next.monthRecords[0].deposits).toHaveLength(1);
    expect(next.monthRecords[0].deposits[0].actualSelic).toBe(500);
  });
});