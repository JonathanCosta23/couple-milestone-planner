import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function safeDeleteError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("User not found")) return "auth_required";
  return "delete_failed";
}

Deno.test("normalizeEmail trims and lowercases", () => {
  assertEquals(normalizeEmail("  USER@Example.COM "), "user@example.com");
});

Deno.test("normalizeEmail rejects non-string payloads", () => {
  assertEquals(normalizeEmail(null), "");
  assertEquals(normalizeEmail(123), "");
});

Deno.test("unknown deletion errors never leak provider details", () => {
  assertEquals(safeDeleteError(new Error("database detail with secret")), "delete_failed");
});
