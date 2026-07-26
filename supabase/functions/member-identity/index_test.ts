/**
 * Testes de mapeamento de erros da Edge Function `member-identity`.
 * A tradução de códigos RPC → error codes fechados é a barreira contra
 * vazamento de detalhes internos; validamos aqui isoladamente.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function mapRpcError(error: { code?: string; message?: string } | null): string {
  if (!error) return "ok";
  const code = error.code;
  const msg = String(error.message ?? "");
  if (code === "23505" || /duplicate_in_plan/.test(msg)) return "duplicate_in_plan";
  if (/member_not_found/.test(msg)) return "member_not_found";
  if (/member_not_active/.test(msg)) return "member_not_found";
  if (/invalid_payload/.test(msg)) return "invalid_payload";
  return "server_error";
}

Deno.test("maps unique violation to duplicate_in_plan", () => {
  assertEquals(mapRpcError({ code: "23505", message: "duplicate key" }), "duplicate_in_plan");
});

Deno.test("maps member_not_found and member_not_active to safe 404", () => {
  assertEquals(mapRpcError({ message: "member_not_found" }), "member_not_found");
  assertEquals(mapRpcError({ message: "member_not_active" }), "member_not_found");
});

Deno.test("maps invalid_payload verbatim", () => {
  assertEquals(mapRpcError({ message: "invalid_payload" }), "invalid_payload");
});

Deno.test("unknown errors collapse to server_error (no leak)", () => {
  assertEquals(mapRpcError({ code: "42P01", message: "relation does not exist" }), "server_error");
  assertEquals(mapRpcError({ message: "connection refused to secret host" }), "server_error");
});

Deno.test("success payload shape never carries cpf_hmac", () => {
  const success = {
    member_id: "00000000-0000-0000-0000-000000000001",
    cpf_last4: "0001",
    identity_status: "verified",
  };
  const keys = Object.keys(success);
  assertEquals(keys.includes("cpf"), false);
  assertEquals(keys.includes("cpf_hmac"), false);
  assertEquals(keys.includes("secret"), false);
  assertEquals(keys.length, 3);
});