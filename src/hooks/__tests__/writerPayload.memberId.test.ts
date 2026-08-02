/**
 * Contrato de ownership dos helpers `*ToPayload`.
 */
import { describe, it, expect } from "vitest";
import { investmentToAssetPayload } from "@/hooks/useAssetWriter";
import { incomeToPayload } from "@/hooks/useIncomeWriter";
import { expenseToPayload } from "@/hooks/useExpenseWriter";
import { debtToPayload } from "@/hooks/useDebtWriter";

const ctx = (memberId?: string | null, ownershipScope?: "individual" | "shared" | "needs_review") => ({
  userId: "user-1",
  planId: "plan-1",
  ...(memberId !== undefined ? { memberId } : {}),
  ...(ownershipScope !== undefined ? { ownershipScope } : {}),
});

const factories = [
  ["asset", () => investmentToAssetPayload({ currentBalance: 100 }, ctx("m1", "individual"))],
  ["income", () => incomeToPayload({ amount: 5000 }, ctx("m1", "individual"))],
  ["expense", () => expenseToPayload({ amount: 200 }, ctx("m1", "individual"))],
  ["debt", () => debtToPayload({ totalAmount: 1000 }, ctx("m1", "individual"))],
] as const;

describe("writers: ownership em CREATE normal", () => {
  for (const [name, factory] of factories) {
    it(`${name} envia member_id e ownership_scope individual`, () => {
      const payload = factory();
      expect(payload.member_id).toBe("m1");
      expect(payload.ownership_scope).toBe("individual");
      expect(payload.plan_id).toBe("plan-1");
      expect(payload).not.toHaveProperty("user_id");
    });
  }
});

describe("writers: update preserva ownership existente", () => {
  it("asset omite member_id e ownership_scope quando não fornecidos", () => {
    const payload = investmentToAssetPayload({ currentBalance: 100 }, ctx());
    expect(payload).not.toHaveProperty("member_id");
    expect(payload).not.toHaveProperty("ownership_scope");
  });

  it("income omite ownership em update de valor", () => {
    const payload = incomeToPayload({ amount: 5000 }, ctx());
    expect(payload).not.toHaveProperty("member_id");
    expect(payload).not.toHaveProperty("ownership_scope");
  });

  it("expense omite ownership em update de categoria", () => {
    const payload = expenseToPayload({ category: "moradia" }, ctx());
    expect(payload).not.toHaveProperty("member_id");
    expect(payload).not.toHaveProperty("ownership_scope");
  });

  it("debt omite ownership em update de saldo", () => {
    const payload = debtToPayload({ totalAmount: 1000 }, ctx());
    expect(payload).not.toHaveProperty("member_id");
    expect(payload).not.toHaveProperty("ownership_scope");
  });

  it("member_id null sem scope não vira shared nem needs_review", () => {
    const payload = expenseToPayload({ amount: 1 }, ctx(null));
    expect(payload.member_id).toBeNull();
    expect(payload).not.toHaveProperty("ownership_scope");
  });

  it("needs_review exige member_id null explícito", () => {
    const payload = expenseToPayload({ amount: 1 }, ctx(null, "needs_review"));
    expect(payload.member_id).toBeNull();
    expect(payload.ownership_scope).toBe("needs_review");
  });

  it("shared com member_id é rejeitado antes do banco", () => {
    expect(() => expenseToPayload({ amount: 1 }, ctx("m1", "shared"))).toThrow(
      "ownership_member_mismatch",
    );
  });
});
