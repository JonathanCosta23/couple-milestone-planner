import { PlanData, DEFAULT_CONFIG } from "./types";

const STORAGE_KEY = "plano-do-milhao-v3";

export function getDefaultPlanData(): PlanData {
  return {
    config: { ...DEFAULT_CONFIG, contributors: [{ ...DEFAULT_CONFIG.contributors[0] }, { ...DEFAULT_CONFIG.contributors[1] }] },
    monthRecords: [],
    wizardComplete: false,
    startDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
  };
}

export function loadPlanData(): PlanData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPlanData();
    return JSON.parse(raw) as PlanData;
  } catch {
    return getDefaultPlanData();
  }
}

export function savePlanData(data: PlanData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportPlanJSON(data: PlanData): string {
  return JSON.stringify(data, null, 2);
}

export function importPlanJSON(json: string): PlanData | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && parsed.config && typeof parsed.wizardComplete === "boolean") {
      return parsed as PlanData;
    }
    return null;
  } catch {
    return null;
  }
}
