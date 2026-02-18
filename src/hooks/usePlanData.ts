import { useState, useCallback, useEffect } from "react";
import { PlanData, PlanConfig, MonthDeposit, MonthRecord, EMPTY_DEPOSIT } from "@/lib/types";
import { loadPlanData, savePlanData, exportPlanJSON, importPlanJSON } from "@/lib/storage";

export function usePlanData() {
  const [data, setData] = useState<PlanData>(loadPlanData);

  useEffect(() => {
    savePlanData(data);
  }, [data]);

  const updateConfig = useCallback((config: PlanConfig) => {
    setData((prev) => ({ ...prev, config }));
  }, []);

  const completeWizard = useCallback((config: PlanConfig) => {
    const startDate = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    setData({ config, monthRecords: [], wizardComplete: true, startDate });
  }, []);

  const updateMonthRecord = useCallback(
    (monthKey: string, contributorIndex: 0 | 1, deposit: MonthDeposit, notes?: string) => {
      setData((prev) => {
        const existing = prev.monthRecords.find((r) => r.monthKey === monthKey);
        if (existing) {
          const updated: MonthRecord = {
            ...existing,
            deposits: contributorIndex === 0
              ? [deposit, existing.deposits[1]]
              : [existing.deposits[0], deposit],
            notes: notes !== undefined ? notes : existing.notes,
          };
          return { ...prev, monthRecords: prev.monthRecords.map((r) => (r.monthKey === monthKey ? updated : r)) };
        }
        const deposits: [MonthDeposit, MonthDeposit] = contributorIndex === 0
          ? [deposit, { ...EMPTY_DEPOSIT }]
          : [{ ...EMPTY_DEPOSIT }, deposit];
        return {
          ...prev,
          monthRecords: [...prev.monthRecords, { monthKey, deposits, notes: notes || "" }],
        };
      });
    },
    []
  );

  const updateMonthNotes = useCallback((monthKey: string, notes: string) => {
    setData((prev) => {
      const existing = prev.monthRecords.find((r) => r.monthKey === monthKey);
      if (existing) {
        return { ...prev, monthRecords: prev.monthRecords.map((r) => (r.monthKey === monthKey ? { ...r, notes } : r)) };
      }
      return {
        ...prev,
        monthRecords: [...prev.monthRecords, { monthKey, deposits: [{ ...EMPTY_DEPOSIT }, { ...EMPTY_DEPOSIT }], notes }],
      };
    });
  }, []);

  const resetPlan = useCallback(() => {
    const fresh = loadPlanData();
    fresh.wizardComplete = false;
    fresh.monthRecords = [];
    setData(fresh);
  }, []);

  const exportJSON = useCallback(() => exportPlanJSON(data), [data]);

  const importJSON = useCallback((json: string): boolean => {
    const parsed = importPlanJSON(json);
    if (parsed) {
      setData(parsed);
      return true;
    }
    return false;
  }, []);

  return {
    data,
    updateConfig,
    completeWizard,
    updateMonthRecord,
    updateMonthNotes,
    resetPlan,
    exportJSON,
    importJSON,
  };
}
