import { describe, it, expect } from "vitest";
import {
  countBusinessDaysBetween,
  countCalendarDaysBetween,
  estimateBusinessDaysFromMonths,
  estimateBusinessDaysFromYears,
} from "../services/businessDaysService";

describe("estimateBusinessDaysFromMonths", () => {
  it("12 meses ~ 252 dias úteis", () => expect(estimateBusinessDaysFromMonths(12)).toBe(252));
  it("valor negativo retorna 0", () => expect(estimateBusinessDaysFromMonths(-1)).toBe(0));
});

describe("estimateBusinessDaysFromYears", () => {
  it("1 ano => 252 dias úteis", () => expect(estimateBusinessDaysFromYears(1)).toBe(252));
});

describe("countBusinessDaysBetween", () => {
  it("segunda a sexta = 4 dias úteis (exclusive fim)", () => {
    const start = new Date(Date.UTC(2026, 0, 5));
    const end = new Date(Date.UTC(2026, 0, 9));
    expect(countBusinessDaysBetween(start, end)).toBe(4);
  });
  it("fim de semana ignorado", () => {
    const start = new Date(Date.UTC(2026, 0, 10));
    const end = new Date(Date.UTC(2026, 0, 12));
    expect(countBusinessDaysBetween(start, end)).toBe(0);
  });
  it("feriado nacional fixo ignorado (1º Jan)", () => {
    const start = new Date(Date.UTC(2026, 0, 1));
    const end = new Date(Date.UTC(2026, 0, 2));
    expect(countBusinessDaysBetween(start, end)).toBe(0);
  });
  it("data final anterior à inicial retorna null", () => {
    expect(countBusinessDaysBetween(new Date(2026, 5, 10), new Date(2026, 5, 1))).toBeNull();
  });
  it("data inválida retorna null", () => {
    expect(countBusinessDaysBetween(new Date("x"), new Date())).toBeNull();
  });
});

describe("countCalendarDaysBetween", () => {
  it("10 dias corridos", () => {
    expect(countCalendarDaysBetween(new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 0, 11)))).toBe(10);
  });
  it("datas invertidas => null", () => {
    expect(countCalendarDaysBetween(new Date(Date.UTC(2026, 0, 11)), new Date(Date.UTC(2026, 0, 1)))).toBeNull();
  });
});