import { describe, it, expect } from "vitest";
import { formatGrantDate, translateScope, translateScopes } from "@/lib/mcp/friendlyScopes";

describe("translateScope", () => {
  it("traduz escopos conhecidos", () => {
    expect(translateScope("openid")).toMatch(/Identidade/);
    expect(translateScope("authenticated")).toMatch(/RLS/);
    expect(translateScope("EMAIL")).toMatch(/E-mail/);
  });

  it("usa rótulo neutro para escopos desconhecidos", () => {
    expect(translateScope("secret_admin_scope")).toBe("Permissão adicional");
    expect(translateScope("")).toBe("Permissão adicional");
  });
});

describe("translateScopes", () => {
  it("remove duplicados após tradução", () => {
    expect(translateScopes(["openid", "openid", "email"])).toEqual([
      "Identidade da conta",
      "E-mail da conta",
    ]);
  });

  it("ignora entradas inválidas", () => {
    // @ts-expect-error runtime guard
    expect(translateScopes([1, null, undefined, "openid"])).toEqual([
      "Identidade da conta",
    ]);
    expect(translateScopes(null)).toEqual([]);
  });
});

describe("formatGrantDate", () => {
  it("formata datas válidas em pt-BR", () => {
    expect(formatGrantDate("2025-01-15T00:00:00.000Z")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("nunca retorna 'Invalid Date'", () => {
    expect(formatGrantDate("not-a-date")).toBe("Data não disponível");
    expect(formatGrantDate(null)).toBe("Data não disponível");
    expect(formatGrantDate(undefined)).toBe("Data não disponível");
    expect(formatGrantDate("")).toBe("Data não disponível");
  });
});