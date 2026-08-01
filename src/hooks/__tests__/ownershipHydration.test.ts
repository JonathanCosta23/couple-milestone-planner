import { describe, expect, it } from "vitest";
import { assetRowToInvestment, type AssetRow } from "@/hooks/useAssetWriter";
import { incomeRowToModel, type IncomeRow } from "@/hooks/useIncomeWriter";
import { expenseRowToModel, type ExpenseRow } from "@/hooks/useExpenseWriter";
import { debtRowToModel, type DebtRow } from "@/hooks/useDebtWriter";

const timestamps = {
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

describe("hidratação de ownership", () => {
  it("asset needs_review não é atribuído ao titular", () => {
    const model = assetRowToInvestment({
      id: "a1", plan_id: "p1", user_id: "u1", member_id: null,
      ownership_scope: "needs_review", asset_type: "cdb", asset_subtype: null,
      institution: "Banco", conglomerate: null, ticker_or_name: "CDB",
      invested_amount: 100, current_amount: 100, net_estimated: 100,
      mark_to_market: false, maturity_date: null, liquidity_type: null,
      has_sovereign_guarantee: false, has_fgc: true, bucket: "protection",
      is_active: true, reference_date: null, ...timestamps,
    } as AssetRow);
    expect(model.ownershipScope).toBe("needs_review");
    expect(model.profileId).toBeUndefined();
  });

  it("income needs_review preserva scope e não recebe profile", () => {
    const model = incomeRowToModel({
      id: "i1", plan_id: "p1", user_id: "u1", member_id: null,
      ownership_scope: "needs_review", source: "Renda", income_type: "salary",
      amount: 100, is_recurring: true, income_date: null, month_key: null,
      notes: null, ...timestamps,
    } as IncomeRow);
    expect(model.ownershipScope).toBe("needs_review");
    expect(model.profileId).toBe("");
  });

  it("expense needs_review não é convertido em shared implícito", () => {
    const model = expenseRowToModel({
      id: "e1", plan_id: "p1", user_id: "u1", member_id: null,
      ownership_scope: "needs_review", category: "moradia", subcategory: null,
      amount: 100, is_essential: true, expense_type: "fixed",
      is_recurring: true, expense_date: null, month_key: null, notes: null,
      ...timestamps,
    } as ExpenseRow);
    expect(model.ownership).toBe("needs_review");
    expect(model.ownershipScope).toBe("needs_review");
    expect(model.responsibleProfileId).toBeUndefined();
  });

  it("debt individual mantém o membro explícito", () => {
    const model = debtRowToModel({
      id: "d1", plan_id: "p1", user_id: "u1", member_id: "m1",
      ownership_scope: "individual", debt_type: "loan", institution: "Banco",
      total_balance: 1000, monthly_payment: 100, interest_rate: 0.01,
      effective_cost: 0.01, priority: "high", start_date: null, end_date: null,
      is_active: true, ...timestamps,
    } as DebtRow);
    expect(model.ownershipScope).toBe("individual");
    expect(model.profileId).toBe("m1");
  });
});
