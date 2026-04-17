/**
 * Cobre regras centrais de métricas: reserva em meses, taxa de poupança, concentração.
 */
import { describe, it, expect } from "vitest";
import { calculateCoreMetrics } from "@/lib/services/metricsService";
import { getCurrentMonthKey } from "@/lib/types";
import {
  makeAppData,
  makeConfig,
  makeIncome,
  makeExpense,
  makeInvestment,
  NO_MONTH_RECORDS,
} from "@/test/helpers/factories";

describe("metricsService", () => {
  const startDate = "2026-01";

  describe("reserva em meses", () => {
    it("classifica como 'complete' quando reserva cobre 6+ meses de despesas", () => {
      const monthKey = getCurrentMonthKey();
      const appData = makeAppData({
        incomes: [makeIncome({ amount: 5_000 })],
        expenses: [makeExpense(monthKey, { amount: 2_000, type: "fixed", priority: "essential" })],
        investments: [
          makeInvestment({ type: "tesouro-selic", currentBalance: 15_000, bucket: "reserva" }),
        ],
      });
      const m = calculateCoreMetrics(appData, makeConfig(), NO_MONTH_RECORDS, startDate);
      expect(m.reserveMonths).toBeGreaterThanOrEqual(6);
      expect(m.reserveStatus).toBe("complete");
    });

    it("classifica como 'empty' quando não há ativo líquido", () => {
      const appData = makeAppData({
        incomes: [makeIncome({ amount: 5_000 })],
      });
      const m = calculateCoreMetrics(appData, makeConfig(), NO_MONTH_RECORDS, startDate);
      expect(m.reserveLiquid).toBe(0);
      expect(m.reserveStatus).toBe("empty");
    });
  });

  describe("taxa de poupança", () => {
    it("calcula (renda - gastos - dívidas) / renda", () => {
      const monthKey = getCurrentMonthKey();
      const appData = makeAppData({
        incomes: [makeIncome({ amount: 10_000 })],
        expenses: [makeExpense(monthKey, { amount: 4_000 })],
      });
      const m = calculateCoreMetrics(appData, makeConfig(), NO_MONTH_RECORDS, startDate);
      // (10000 - 4000 - 0) / 10000 = 0.6
      expect(m.savingsRate).toBeCloseTo(0.6, 5);
    });

    it("retorna 0 quando não há renda (evita divisão por zero)", () => {
      const appData = makeAppData();
      const m = calculateCoreMetrics(appData, makeConfig(), NO_MONTH_RECORDS, startDate);
      expect(m.savingsRate).toBe(0);
    });
  });

  describe("concentração", () => {
    it("100% concentrado quando há um único ativo", () => {
      const appData = makeAppData({
        investments: [
          makeInvestment({ institution: "Nubank", type: "cdb", currentBalance: 50_000 }),
        ],
      });
      const m = calculateCoreMetrics(appData, makeConfig(), NO_MONTH_RECORDS, startDate);
      expect(m.maxConcentrationByInstitution).toBeCloseTo(1, 5);
      expect(m.concentrationInstitution).toBe("Nubank");
    });

    it("identifica corretamente a maior instituição em carteira diversificada", () => {
      const appData = makeAppData({
        investments: [
          makeInvestment({ institution: "Nubank", type: "cdb", currentBalance: 80_000 }),
          makeInvestment({ institution: "Itaú", type: "cdb", currentBalance: 20_000 }),
        ],
      });
      const m = calculateCoreMetrics(appData, makeConfig(), NO_MONTH_RECORDS, startDate);
      expect(m.concentrationInstitution).toBe("Nubank");
      expect(m.maxConcentrationByInstitution).toBeCloseTo(0.8, 5);
    });
  });
});
