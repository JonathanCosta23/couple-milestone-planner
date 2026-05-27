/**
 * Garante que os helpers `*toPayload` respeitam a regra crítica:
 *   - `memberId === undefined`  → NÃO incluir `member_id` no payload.
 *     (update parcial preserva o vínculo existente no banco.)
 *   - `memberId === null`       → incluir `member_id: null` explicitamente.
 *     (intenção explícita de limpar o vínculo.)
 *   - `memberId === "uuid"`     → incluir `member_id: "uuid"`.
 *
 * Regressão evita o bug em que atualizar valor/categoria/etc. apagava o
 * `member_id` por acidente, deixando dado financeiro órfão.
 */
import { describe, it, expect } from "vitest";
import { investmentToAssetPayload } from "@/hooks/useAssetWriter";
import { incomeToPayload } from "@/hooks/useIncomeWriter";
import { expenseToPayload } from "@/hooks/useExpenseWriter";
import { debtToPayload } from "@/hooks/useDebtWriter";

const ctx = (memberId?: string | null) => ({
  userId: "user-1",
  planId: "plan-1",
  ...(memberId !== undefined ? { memberId } : {}),
});

describe("writers: member_id em payload", () => {
  it("investmentToAssetPayload omite member_id quando não fornecido", () => {
    const payload = investmentToAssetPayload({ currentBalance: 100 }, ctx());
    expect("member_id" in payload).toBe(false);
  });

  it("investmentToAssetPayload define member_id quando passado", () => {
    const payload = investmentToAssetPayload({ currentBalance: 100 }, ctx("m1"));
    expect(payload.member_id).toBe("m1");
  });

  it("investmentToAssetPayload aceita null como limpeza explícita", () => {
    const payload = investmentToAssetPayload({ currentBalance: 100 }, ctx(null));
    expect(payload.member_id).toBeNull();
  });

  it("incomeToPayload omite member_id quando não fornecido", () => {
    const payload = incomeToPayload({ amount: 5000 }, ctx());
    expect("member_id" in payload).toBe(false);
    expect(payload.amount).toBe(5000);
  });

  it("incomeToPayload mantém member_id quando passado", () => {
    const payload = incomeToPayload({ amount: 5000 }, ctx("m1"));
    expect(payload.member_id).toBe("m1");
  });

  it("expenseToPayload omite member_id em update parcial", () => {
    const payload = expenseToPayload({ amount: 200 }, ctx());
    expect("member_id" in payload).toBe(false);
  });

  it("debtToPayload omite member_id em update parcial", () => {
    const payload = debtToPayload({ totalAmount: 1000 }, ctx());
    expect("member_id" in payload).toBe(false);
  });

  it("debtToPayload preserva member_id quando fornecido", () => {
    const payload = debtToPayload({ totalAmount: 1000 }, ctx("m2"));
    expect(payload.member_id).toBe("m2");
  });
});