/**
 * Regra crítica do produto: popup de celebração SÓ dispara para patrimônio
 * REALIZADO. Projeção/simulação nunca pode disparar shouldCelebrate=true.
 */
import { describe, it, expect } from "vitest";
import { checkMilestones } from "@/lib/services/milestoneService";
import type { CoreMetrics } from "@/lib/services/metricsService";
import type { ProjectionResult } from "@/lib/services/projectionService";

function fakeMetrics(grossWealth: number): CoreMetrics {
  return { grossWealth } as CoreMetrics;
}

function fakeProjection(reachesAt: number | null): ProjectionResult {
  // Cria pontos nominais que cruzam 1M no índice `reachesAt` (ou nunca).
  const nominal = Array.from({ length: 240 }, (_, i) => ({
    monthIndex: i + 1,
    date: "2026-01",
    balance: reachesAt !== null && i >= reachesAt ? 2_000_000 : 1_000,
    deposited: 0,
    interest: 0,
  }));
  return { nominal } as unknown as ProjectionResult;
}

describe("milestoneService", () => {
  it("NÃO celebra marcos apenas projetados (regra de ouro do produto)", () => {
    const metrics = fakeMetrics(10_000); // só tem 10k realizados
    const projection = fakeProjection(50); // projeção atinge tudo no mês 50
    const status = checkMilestones(metrics, projection, []);

    // Nenhum dos marcos foi realizado, então nenhum deve celebrar
    expect(status.celebrationQueue.length).toBe(0);
    status.milestones.forEach((m) => {
      expect(m.shouldCelebrate).toBe(false);
      expect(m.isProjected).toBe(true);
      expect(m.isRealized).toBe(false);
    });
  });

  it("celebra apenas marcos realizados ainda não celebrados", () => {
    const metrics = fakeMetrics(120_000); // realizou 50k e 100k
    const projection = fakeProjection(50);
    const status = checkMilestones(metrics, projection, []);

    const celebratedValues = status.celebrationQueue.map((m) => m.value);
    expect(celebratedValues).toEqual([50_000, 100_000]);
  });

  it("não re-celebra marcos já marcados como celebrados", () => {
    const metrics = fakeMetrics(120_000);
    const projection = fakeProjection(50);
    const status = checkMilestones(metrics, projection, [50_000, 100_000]);
    expect(status.celebrationQueue.length).toBe(0);
  });

  it("celebra o milhão quando realmente alcançado", () => {
    const metrics = fakeMetrics(1_000_000);
    const projection = fakeProjection(null);
    const status = checkMilestones(metrics, projection, [50_000, 100_000, 250_000, 500_000, 750_000]);
    expect(status.celebrationQueue.map((m) => m.value)).toEqual([1_000_000]);
  });
});
