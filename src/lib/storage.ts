import { PlanData, DEFAULT_CONFIG, PLAN_START, CURRENT_SCHEMA_VERSION, PlanDataExportMeta } from "./types";

const STORAGE_KEY = "plano-do-milhao-v6";
const BACKUP_KEY = "plano-do-milhao-backup";

export function getDefaultPlanData(): PlanData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    config: { ...DEFAULT_CONFIG, contributors: [{ ...DEFAULT_CONFIG.contributors[0] }, { ...DEFAULT_CONFIG.contributors[1] }] },
    monthRecords: [],
    wizardComplete: false,
    startDate: PLAN_START,
    notificationSettings: { monthlyReminder: true, annualReview: false },
    onboardingComplete: false,
  };
}

/** Normalize/migrate any PlanData to current schema, filling missing fields with defaults */
export function normalizePlanData(parsed: Partial<PlanData>): PlanData {
  const defaults = getDefaultPlanData();
  const data: PlanData = {
    ...defaults,
    ...parsed,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    config: {
      ...defaults.config,
      ...(parsed.config || {}),
      contributors: [
        { ...defaults.config.contributors[0], ...(parsed.config?.contributors?.[0] || {}) },
        { ...defaults.config.contributors[1], ...(parsed.config?.contributors?.[1] || {}) },
      ],
    },
    monthRecords: Array.isArray(parsed.monthRecords) ? parsed.monthRecords : [],
    notificationSettings: {
      ...defaults.notificationSettings,
      ...(parsed.notificationSettings || {}),
    },
  };
  // Ensure contributor ages exist
  data.config.contributors.forEach((c) => { if (!c.age) c.age = 25; });
  return data;
}

export function loadPlanData(): PlanData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Try migrating from v5
      const v5 = localStorage.getItem("plano-do-milhao-v5");
      if (v5) {
        const parsed = JSON.parse(v5) as Partial<PlanData>;
        const migrated = normalizePlanData(parsed);
        migrated.onboardingComplete = true;
        savePlanData(migrated);
        return migrated;
      }
      return getDefaultPlanData();
    }
    return normalizePlanData(JSON.parse(raw));
  } catch {
    return getDefaultPlanData();
  }
}

export function savePlanData(data: PlanData): void {
  data.schemaVersion = CURRENT_SCHEMA_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Save a backup snapshot to localStorage before destructive operations */
export function saveBackup(data: PlanData): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({
      ...data,
      _backupAt: new Date().toISOString(),
    }));
  } catch {
    // silently fail if storage is full
  }
}

/** Retrieve the last backup, if any */
export function loadBackup(): PlanData | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    delete parsed._backupAt;
    return normalizePlanData(parsed);
  } catch {
    return null;
  }
}

/** Export PlanData as JSON string with metadata */
export function exportPlanJSON(data: PlanData): string {
  const sortedMonths = [...data.monthRecords].map(r => r.monthKey).sort();
  const meta: PlanDataExportMeta = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    planStart: data.startDate,
    planEnd: sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : undefined,
  };
  return JSON.stringify({ _meta: meta, ...data, schemaVersion: CURRENT_SCHEMA_VERSION }, null, 2);
}

export interface ImportPreview {
  valid: boolean;
  errorMessage?: string;
  version: string;
  filledMonths: number;
  exportedAt: string | null;
  data: PlanData | null;
}

/** Parse and validate an import JSON string, returning a preview */
export function parseImportJSON(json: string): ImportPreview {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { valid: false, errorMessage: "O arquivo não contém JSON válido.", version: "—", filledMonths: 0, exportedAt: null, data: null };
  }

  // Minimal structure check
  if (!parsed || typeof parsed !== "object") {
    return { valid: false, errorMessage: "Formato de arquivo não reconhecido.", version: "—", filledMonths: 0, exportedAt: null, data: null };
  }

  if (!parsed.config || typeof parsed.wizardComplete !== "boolean") {
    return { valid: false, errorMessage: "Arquivo não parece ser um plano válido. Campos obrigatórios ausentes (config, wizardComplete).", version: "—", filledMonths: 0, exportedAt: null, data: null };
  }

  const meta = parsed._meta as PlanDataExportMeta | undefined;
  const version = meta?.schemaVersion || parsed.schemaVersion || "legado";
  const exportedAt = meta?.exportedAt || null;

  // Strip meta before normalizing
  const { _meta, _backupAt, ...rest } = parsed;
  const normalized = normalizePlanData(rest);

  const filledMonths = normalized.monthRecords.filter(r =>
    r.deposits.some(d => d.actualSelic > 0 || d.actualCDB > 0)
  ).length;

  return { valid: true, version, filledMonths, exportedAt, data: normalized };
}

/** Legacy compat wrapper */
export function importPlanJSON(json: string): PlanData | null {
  const preview = parseImportJSON(json);
  return preview.valid ? preview.data : null;
}
