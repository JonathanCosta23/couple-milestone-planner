import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildMonthlySummary,
  computeNextBestAction,
  buildMilestoneProgress,
} from "@/lib/services/monthlySummary";
import type { PlanConfig, MonthRecord } from "@/lib/types";

const solo: PlanConfig = {
  initialAmount: 0,
  targetAmount: 1_000_000,
  years: 20,
  selicRate: 0.13,
  cdbRate: 0.13,
  contributors: [{ name: "Você", plannedSelic: 600, plannedCDB: 400 }],
};

function record(monthKey: string, actualSelic: number, actualCDB: number): MonthRecord {
  return { monthKey, deposits: [{ actualSelic, actualCDB }], notes: "" };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("buildMonthlySummary", () => {
  it("status no_plan quando planejado é zero", () => {
    const cfg: PlanConfig = { ...solo, contributors: [{ name: "Você", plannedSelic: 0, plannedCDB: 0 }] };
    const s = buildMonthlySummary(cfg, [], "2026-06");
    expect(s.status).toBe("no_plan");
    expect(s.planned).toBe(0);
  });

  it("status pending quando há plano mas nenhum aporte", () => {
    const s = buildMonthlySummary(solo, [], "2026-06");
    expect(s.status).toBe("pending");
    expect(s.remaining).toBe(1000);
    expect(s.executionPct).toBe(0);
  });

  it("status partial quando há aporte parcial", () => {
    const s = buildMonthlySummary(solo, [record("2026-06", 300, 0)], "2026-06");
    expect(s.status).toBe("partial");
    expect(s.remaining).toBe(700);
  });

  it("status completed quando bate o planejado", () => {
    const s = buildMonthlySummary(solo, [record("2026-06", 600, 400)], "2026-06");
    expect(s.status).toBe("completed");
    expect(s.remaining).toBe(0);
    expect(s.executionPct).toBe(1);
  });
});

describe("computeNextBestAction", () => {
  it("sugere configurar quando não há plano", () => {
    const cfg: PlanConfig = { ...solo, contributors: [{ name: "Você", plannedSelic: 0, plannedCDB: 0 }] };
    const s = buildMonthlySummary(cfg, [], "2026-06");
    expect(computeNextBestAction(s).id).toBe("configure_plan");
  });

  it("sugere completar o mês quando há pendência", () => {
    const s = buildMonthlySummary(solo, [record("2026-06", 300, 0)], "2026-06");
    expect(computeNextBestAction(s).id).toBe("complete_month");
  });

  it("sugere revisar premissas se incompletas", () => {
    const s = buildMonthlySummary(solo, [record("2026-06", 600, 400)], "2026-06");
    expect(computeNextBestAction(s, { assumptionsIncomplete: true }).id).toBe("review_assumptions");
  });

  it("sugere atualizar patrimônio quando dado está antigo", () => {
    const s = buildMonthlySummary(solo, [record("2026-06", 600, 400)], "2026-06");
    const oldDate = Date.now() - 60 * 24 * 60 * 60 * 1000;
    expect(computeNextBestAction(s, { lastWealthUpdateAt: oldDate }).id).toBe("update_wealth");
  });

  it("sugere acompanhar marco quando está próximo", () => {
    const s = buildMonthlySummary(solo, [record("2026-06", 600, 400)], "2026-06");
    const action = computeNextBestAction(s, {
      nextMilestoneValue: 100_000,
      nextMilestoneMonths: 8,
    });
    expect(action.id).toBe("track_milestone");
  });

  it("sugere revisar próximo mês como fallback de mês fechado", () => {
    const s = buildMonthlySummary(solo, [record("2026-06", 600, 400)], "2026-06");
    expect(computeNextBestAction(s).id).toBe("review_next_month");
  });
});

describe("buildMilestoneProgress", () => {
  it("calcula progresso entre marcos", () => {
    const r = buildMilestoneProgress(75_000, [50_000, 100_000, 250_000]);
    expect(r.previous).toBe(50_000);
    expect(r.next).toBe(100_000);
    expect(r.pct).toBeCloseTo(0.5, 2);
  });

  it("trata caso antes do primeiro marco", () => {
    const r = buildMilestoneProgress(10_000, [50_000, 100_000]);
    expect(r.previous).toBe(0);
    expect(r.next).toBe(50_000);
    expect(r.pct).toBeCloseTo(0.2, 2);
  });
});