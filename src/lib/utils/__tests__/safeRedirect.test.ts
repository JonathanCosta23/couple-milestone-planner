import { describe, it, expect } from "vitest";
import { sanitizeReturnTo } from "@/lib/utils/safeRedirect";

describe("sanitizeReturnTo", () => {
  const allow = ["/", "/connect"] as const;

  it("aceita destinos internos permitidos", () => {
    expect(sanitizeReturnTo("/connect", "/", allow)).toBe("/connect");
    expect(sanitizeReturnTo("/", "/", allow)).toBe("/");
  });

  it("preserva querystring/hash quando pathname está na allowlist", () => {
    expect(sanitizeReturnTo("/connect?ref=x#y", "/", allow)).toBe("/connect?ref=x#y");
  });

  it("rejeita destinos fora da allowlist", () => {
    expect(sanitizeReturnTo("/admin", "/", allow)).toBe("/");
  });

  it("rejeita URLs absolutas e protocol-relative", () => {
    expect(sanitizeReturnTo("https://evil.com/x", "/", allow)).toBe("/");
    expect(sanitizeReturnTo("//evil.com/x", "/", allow)).toBe("/");
    expect(sanitizeReturnTo("/\\evil.com", "/", allow)).toBe("/");
  });

  it("rejeita esquemas embutidos (javascript:, data:)", () => {
    expect(sanitizeReturnTo("javascript:alert(1)", "/", allow)).toBe("/");
    expect(sanitizeReturnTo("data:text/html,evil", "/", allow)).toBe("/");
  });

  it("retorna fallback para valores vazios ou não-string", () => {
    expect(sanitizeReturnTo(null, "/", allow)).toBe("/");
    expect(sanitizeReturnTo(undefined, "/", allow)).toBe("/");
    expect(sanitizeReturnTo("", "/", allow)).toBe("/");
    expect(sanitizeReturnTo("   ", "/", allow)).toBe("/");
  });

  it("permite qualquer path começando com / quando não há allowlist", () => {
    expect(sanitizeReturnTo("/qualquer/coisa", "/")).toBe("/qualquer/coisa");
  });
});