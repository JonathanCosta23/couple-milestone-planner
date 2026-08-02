import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeEmail, safeDeleteError } from "./index.ts";

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
