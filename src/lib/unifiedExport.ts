/**
 * Unified Export/Import — combines PlanData + AppData into a single file.
 */

import { PlanData, CURRENT_SCHEMA_VERSION } from "./types";
import { AppData } from "./models";
import { normalizePlanData } from "./storage";
import { normalizeAppData } from "./appStorage";

interface UnifiedExport {
  _format: "plano-do-milhao-unified";
  _version: "1.0";
  _exportedAt: string;
  planData: PlanData;
  appData: AppData;
}

export function exportUnifiedData(planData: PlanData, appData: AppData): string {
  const unified: UnifiedExport = {
    _format: "plano-do-milhao-unified",
    _version: "1.0",
    _exportedAt: new Date().toISOString(),
    planData: { ...planData, schemaVersion: CURRENT_SCHEMA_VERSION },
    appData: { ...appData, schemaVersion: "7.0.0" },
  };
  return JSON.stringify(unified, null, 2);
}

export function importUnifiedData(json: string): { planData: PlanData; appData: AppData } | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed?._format !== "plano-do-milhao-unified") return null;
    
    const planData = normalizePlanData(parsed.planData || {});
    const appData = normalizeAppData(parsed.appData || {});
    
    return { planData, appData };
  } catch {
    return null;
  }
}
