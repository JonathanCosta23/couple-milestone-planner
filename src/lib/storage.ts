import { PlanData, DEFAULT_CONFIG, PLAN_START } from "./types";

const STORAGE_KEY = "plano-do-milhao-v6";

export function getDefaultPlanData(): PlanData {
  return {
    config: { ...DEFAULT_CONFIG, contributors: [{ ...DEFAULT_CONFIG.contributors[0] }, { ...DEFAULT_CONFIG.contributors[1] }] },
    monthRecords: [],
    wizardComplete: false,
    startDate: PLAN_START,
    notificationSettings: { monthlyReminder: true, annualReview: false },
    onboardingComplete: false,
  };
}

export function loadPlanData(): PlanData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Try migrating from v5
      const v5 = localStorage.getItem("plano-do-milhao-v5");
      if (v5) {
        const parsed = JSON.parse(v5) as PlanData;
        parsed.notificationSettings = parsed.notificationSettings || { monthlyReminder: true, annualReview: false };
        parsed.config.contributors.forEach((c) => { if (!c.age) c.age = 25; });
        parsed.onboardingComplete = true; // existing users skip onboarding
        savePlanData(parsed);
        return parsed;
      }
      return getDefaultPlanData();
    }
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
