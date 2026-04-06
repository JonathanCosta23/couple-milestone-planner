/**
 * App-level storage for the new V7 entity model.
 * Coexists with the legacy PlanData storage.
 * Migration from legacy is automatic and non-destructive.
 */

import { AppData, createDefaultAppData, generateId, PlanMode } from "./models";
import { PlanData } from "./types";
import { loadPlanData } from "./storage";

const APP_STORAGE_KEY = "plano-do-milhao-app-v7";
const APP_BACKUP_KEY = "plano-do-milhao-app-backup";

export function normalizeAppData(parsed: Partial<AppData>): AppData {
  const defaults = createDefaultAppData();
  return {
    ...defaults,
    ...parsed,
    schemaVersion: "7.0.0",
    primaryProfile: { ...defaults.primaryProfile, ...(parsed.primaryProfile || {}) },
    partner: parsed.partner !== undefined ? parsed.partner : defaults.partner,
    incomes: Array.isArray(parsed.incomes) ? parsed.incomes : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    recurringExpenses: Array.isArray(parsed.recurringExpenses) ? parsed.recurringExpenses : [],
    debts: Array.isArray(parsed.debts) ? parsed.debts : [],
    installments: Array.isArray(parsed.installments) ? parsed.installments : [],
    investments: Array.isArray(parsed.investments) ? parsed.investments : [],
    goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
    financialSnapshots: Array.isArray(parsed.financialSnapshots) ? parsed.financialSnapshots : [],
    monthlySummaries: Array.isArray(parsed.monthlySummaries) ? parsed.monthlySummaries : [],
    behavioralSignals: Array.isArray(parsed.behavioralSignals) ? parsed.behavioralSignals : [],
    simulationScenarios: Array.isArray(parsed.simulationScenarios) ? parsed.simulationScenarios : [],
    educationalProgress: {
      ...defaults.educationalProgress,
      ...(parsed.educationalProgress || {}),
    },
    createdAt: parsed.createdAt || defaults.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Migrate from legacy PlanData to AppData.
 * Extracts profile info, financial profile data, and goals from the old format.
 */
export function migrateFromLegacy(planData: PlanData): AppData {
  const appData = createDefaultAppData();

  // Map first contributor as primary profile
  const c0 = planData.config.contributors[0];
  appData.primaryProfile = {
    id: generateId(),
    name: c0?.name || "Pessoa 1",
    age: c0?.age || 25,
    avatarColor: "hsl(var(--primary))",
  };

  // Check if there are additional contributors with actual plans
  const additionalContributors = planData.config.contributors.slice(1).filter(
    c => c.plannedSelic > 0 || c.plannedCDB > 0
  );

  appData.mode = additionalContributors.length > 0 ? "couple" : "solo";

  if (additionalContributors.length > 0) {
    const c1 = additionalContributors[0];
    appData.partner = {
      profile: {
        id: generateId(),
        name: c1.name || "Pessoa 2",
        age: c1.age || 25,
        avatarColor: "hsl(var(--accent))",
      },
      addedAt: new Date().toISOString(),
    };
  } else {
    appData.partner = undefined;
  }

  // Migrate financial profile to incomes
  if (planData.financialProfile) {
    const fp = planData.financialProfile;
    if (fp.incomeJonathan && fp.incomeJonathan > 0) {
      appData.incomes.push({
        id: generateId(),
        profileId: appData.primaryProfile.id,
        label: "Salário",
        amount: fp.incomeJonathan,
        type: "salary",
        recurrence: "monthly",
        active: true,
      });
    }
    if (fp.incomeIsabella && fp.incomeIsabella > 0 && appData.partner) {
      appData.incomes.push({
        id: generateId(),
        profileId: appData.partner.profile.id,
        label: "Salário",
        amount: fp.incomeIsabella,
        type: "salary",
        recurrence: "monthly",
        active: true,
      });
    }
  }

  // Migrate emotional goal
  if (planData.emotionalGoal) {
    const goalCategoryMap: Record<string, string> = {
      "liberdade-financeira": "freedom",
      "casa-propria": "house",
      "aposentadoria": "retirement",
      "viagens": "travel",
      "familia": "family",
      "outro": "other",
    };
    appData.goals.push({
      id: generateId(),
      name: planData.emotionalGoal === "outro"
        ? (planData.emotionalGoalCustom || "Meta do Milhão")
        : planData.emotionalGoal,
      targetAmount: planData.config.targetAmount,
      currentAmount: planData.config.initialAmount,
      category: (goalCategoryMap[planData.emotionalGoal] || "other") as any,
      status: "active",
      priority: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return appData;
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (raw) {
      return normalizeAppData(JSON.parse(raw));
    }

    // Auto-migrate from legacy PlanData if exists
    const legacyData = loadPlanData();
    if (legacyData.wizardComplete) {
      const migrated = migrateFromLegacy(legacyData);
      saveAppData(migrated);
      return migrated;
    }

    return createDefaultAppData();
  } catch {
    return createDefaultAppData();
  }
}

export function saveAppData(data: AppData): void {
  data.updatedAt = new Date().toISOString();
  data.schemaVersion = "7.0.0";
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));
}

export function saveAppBackup(data: AppData): void {
  try {
    localStorage.setItem(APP_BACKUP_KEY, JSON.stringify({
      ...data,
      _backupAt: new Date().toISOString(),
    }));
  } catch {
    // silently fail
  }
}

export function loadAppBackup(): AppData | null {
  try {
    const raw = localStorage.getItem(APP_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    delete parsed._backupAt;
    return normalizeAppData(parsed);
  } catch {
    return null;
  }
}
