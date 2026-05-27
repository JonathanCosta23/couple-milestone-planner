import { describe, it, expect } from "vitest";
import { calculateDisciplineScore } from "@/lib/services/disciplineScore";
import type { PlanConfig, MonthRecord } from "@/lib/types";

const baseConfig: PlanConfig = {
  initialAmount: 0,
  targetAmount: 1_000_000,
  years: 20,
  selicRate: 0.13,
  cdbRate: 0.13,
  contributors: [{ name: "Você", plannedSelic: 600, plannedCDB: 400 }],
};

function record(monthKey: string, actualSelic: number, actualCDB: number, completed = false): MonthRecord {
  return { monthKey, deposits: [{ actualSelic, actualCDB }], notes: "", completed };
}

describe("calculateDisciplineScore", () => {
  it("retorna 0 quando não há nada planejado nem realizado", () => {
    const cfg: PlanConfig = { ...baseConfig, contributors: [{ name: "Você", plannedSelic: 0, plannedCDB: 0 }] };
    const score = calculateDisciplineScore(cfg, [], "2026-06");
    expect(score.total).toBe(0);
    expect(score.label).toBe("Em construção");
  });

  it("dá score alto quando mês corrente está completo e histórico é consistente", () => {
    const records: MonthRecord[] = [
      record("2026-01", 600, 400),
      record("2026-02", 600, 400),
      record("2026-03", 600, 400),
      record("2026-04", 600, 400),
      record("2026-05", 600, 400),
      record("2026-06", 600, 400),
    ];
    const score = calculateDisciplineScore(baseConfig, records, "2026-06");
    expect(score.total).toBeGreaterThanOrEqual(85);
    expect(score.label).toBe("Exemplar");
    expect(score.monthsAnalyzed).toBe(5);
  });

  it("penaliza quando o mês corrente está vazio", () => {
    const records: MonthRecord[] = [
      record("2026-01", 600, 400),
      record("2026-02", 600, 400),
    ];
    const score = calculateDisciplineScore(baseConfig, records, "2026-06");
    expect(score.components.currentMonth).toBe(0);
    expect(score.total).toBeLessThan(85);
  });

  it("é determinístico e não inclui o mês de referência na janela histórica", () => {
    const records: MonthRecord[] = [
      record("2026-05", 600, 400),
      record("2026-06", 0, 0),
    ];
    const score = calculateDisciplineScore(baseConfig, records, "2026-06");
    expect(score.monthsAnalyzed).toBe(1);
  });
});