/**
 * useCalculatorPreferences — Preferências locais das calculadoras.
 * Persistência intencional em localStorage para evitar alteração de schema
 * nesta sprint. Preferências são leves e não críticas.
 */
import { useCallback, useEffect, useState } from "react";

export type CalculatorMode = "simple" | "detailed";

export interface CalculatorPreferences {
  mode: CalculatorMode;
  budgetPercents: { needs: number; wants: number; wealth: number };
  emergencyMonths: number;
  desiredMonthlyIncome: number;
  preferredScenario: "cons_333" | "int_250" | "simple_200" | "custom";
}

const DEFAULTS: CalculatorPreferences = {
  mode: "simple",
  budgetPercents: { needs: 0.5, wants: 0.3, wealth: 0.2 },
  emergencyMonths: 6,
  desiredMonthlyIncome: 0,
  preferredScenario: "int_250",
};

const STORAGE_KEY = "calc-prefs.v1";

function read(): CalculatorPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed, budgetPercents: { ...DEFAULTS.budgetPercents, ...(parsed.budgetPercents ?? {}) } };
  } catch {
    return DEFAULTS;
  }
}

export function useCalculatorPreferences() {
  const [prefs, setPrefs] = useState<CalculatorPreferences>(() => read());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // storage cheio ou desabilitado — silencioso.
    }
  }, [prefs]);

  const update = useCallback(<K extends keyof CalculatorPreferences>(key: K, value: CalculatorPreferences[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  }, []);

  return { prefs, update, setPrefs };
}