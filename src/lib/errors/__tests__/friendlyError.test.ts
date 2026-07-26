/**
 * friendlyError — códigos fechados vindos das triggers/RPCs do Passo 4.a.2
 * devem virar mensagens seguras em pt-BR sem vazar SQL/constraint/PG code.
 */
import { describe, it, expect } from "vitest";
import { toFriendlyError } from "@/lib/errors/friendlyError";

describe("toFriendlyError — códigos fechados de identidade", () => {
  const cases: Array<[string, RegExp]> = [
    ["explicit_reintegration_required", /reintegrado por um fluxo específico/i],
    ["member_not_active", /não está ativo/i],
    ["member_scope_mismatch", /não foi possível associar/i],
    ["partner_already_active", /parceiro ativo/i],
    ["partner_not_active", /parceiro ativo para remover/i],
    ["plan_not_found", /plano não encontrado/i],
    ["invalid_payload", /dados inválidos/i],
  ];
  for (const [code, expected] of cases) {
    it(`mapeia ${code} sem vazar detalhes`, () => {
      const msg = toFriendlyError(code);
      expect(msg).toMatch(expected);
      expect(msg).not.toMatch(/23505|check_violation|permission|trigger|constraint/i);
    });
  }
});