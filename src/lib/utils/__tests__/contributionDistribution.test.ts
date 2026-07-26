import { describe, it, expect } from "vitest";
import { distributeMonthlyContribution } from "@/lib/utils/contributionDistribution";
import type { Contributor } from "@/lib/types";

const mk = (name: string, s: number, c: number): Contributor => ({
  name,
  plannedSelic: s,
  plannedCDB: c,
});

describe("distributeMonthlyContribution", () => {
  it("preserva proporção quando total anterior > 0", () => {
    const list = [mk("A", 600, 400), mk("B", 200, 800)]; // total 2000
    const { contributors, total } = distributeMonthlyContribution(list, 3000);
    expect(total).toBe(3000);
    expect(contributors[0].plannedSelic).toBeCloseTo(900, 2);
    expect(contributors[0].plannedCDB).toBeCloseTo(600, 2);
    expect(contributors[1].plannedSelic).toBeCloseTo(300, 2);
    expect(contributors[1].plannedCDB).toBeCloseTo(1200, 2);
  });

  it("soma final é exatamente igual ao aporte informado", () => {
    const list = [mk("A", 333.33, 333.33), mk("B", 333.34, 0)]; // ~1000
    const target = 1234.57;
    const { contributors, total } = distributeMonthlyContribution(list, target);
    const sum = contributors.reduce(
      (s, c) => s + c.plannedSelic + c.plannedCDB,
      0,
    );
    expect(Math.round(sum * 100)).toBe(Math.round(target * 100));
    expect(Math.round(total * 100)).toBe(Math.round(target * 100));
  });

  it("total anterior zero: aloca tudo no plannedSelic do principal", () => {
    const list = [mk("A", 0, 0), mk("B", 0, 0)];
    const { contributors, total } = distributeMonthlyContribution(list, 500);
    expect(total).toBe(500);
    expect(contributors[0].plannedSelic).toBe(500);
    expect(contributors[0].plannedCDB).toBe(0);
    expect(contributors[1].plannedSelic).toBe(0);
    expect(contributors[1].plannedCDB).toBe(0);
  });

  it("aporte zero zera buckets mantendo os contribuidores", () => {
    const list = [mk("A", 100, 200), mk("B", 300, 400)];
    const { contributors, total } = distributeMonthlyContribution(list, 0);
    expect(total).toBe(0);
    expect(contributors).toHaveLength(2);
    expect(contributors.every((c) => c.plannedSelic === 0 && c.plannedCDB === 0)).toBe(true);
  });

  it("é determinística: mesmas entradas produzem mesma saída", () => {
    const list = [mk("A", 111, 222), mk("B", 333, 444)];
    const a = distributeMonthlyContribution(list, 1234.57);
    const b = distributeMonthlyContribution(list, 1234.57);
    expect(a).toEqual(b);
  });

  it("rejeita aporte inválido", () => {
    const list = [mk("A", 100, 0)];
    expect(() => distributeMonthlyContribution(list, Number.NaN)).toThrow();
    expect(() => distributeMonthlyContribution(list, -1)).toThrow();
  });
});