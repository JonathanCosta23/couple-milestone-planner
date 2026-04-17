import { useState, useCallback, useEffect } from "react";
import { PlanData, PlanConfig, MonthDeposit, MonthRecord, EMPTY_DEPOSIT, generateMonthKeys, PLAN_START, FinancialProfile, EmotionalGoal } from "@/lib/types";
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
    setData((prev) => ({ ...prev, config, monthRecords: prev.monthRecords.length > 0 ? prev.monthRecords : [], wizardComplete: true, startDate: PLAN_START }));
  }, []);

  const updateMonthRecord = useCallback(
    (monthKey: string, contributorIndex: number, deposit: MonthDeposit, notes?: string) => {
      setData((prev) => {
        const numContributors = prev.config.contributors.length;
        const existing = prev.monthRecords.find((r) => r.monthKey === monthKey);
        if (existing) {
          const newDeposits = [...existing.deposits];
          // Ensure array is large enough
          while (newDeposits.length < numContributors) newDeposits.push({ ...EMPTY_DEPOSIT });
          newDeposits[contributorIndex] = deposit;
          const updated: MonthRecord = {
            ...existing,
            deposits: newDeposits,
            notes: notes !== undefined ? notes : existing.notes,
          };
          return { ...prev, monthRecords: prev.monthRecords.map((r) => (r.monthKey === monthKey ? updated : r)) };
        }
        const deposits: MonthDeposit[] = Array.from({ length: numContributors }, () => ({ ...EMPTY_DEPOSIT }));
        deposits[contributorIndex] = deposit;
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
      const numContributors = prev.config.contributors.length;
      const existing = prev.monthRecords.find((r) => r.monthKey === monthKey);
      if (existing) {
        return { ...prev, monthRecords: prev.monthRecords.map((r) => (r.monthKey === monthKey ? { ...r, notes } : r)) };
      }
      return {
        ...prev,
        monthRecords: [...prev.monthRecords, { monthKey, deposits: Array.from({ length: numContributors }, () => ({ ...EMPTY_DEPOSIT })), notes }],
      };
    });
  }, []);

  const toggleMonthCompleted = useCallback((monthKey: string) => {
    setData((prev) => {
      const numContributors = prev.config.contributors.length;
      const existing = prev.monthRecords.find((r) => r.monthKey === monthKey);
      if (existing) {
        return {
          ...prev,
          monthRecords: prev.monthRecords.map((r) =>
            r.monthKey === monthKey ? { ...r, completed: !r.completed } : r
          ),
        };
      }
      return {
        ...prev,
        monthRecords: [
          ...prev.monthRecords,
          { monthKey, deposits: Array.from({ length: numContributors }, () => ({ ...EMPTY_DEPOSIT })), notes: "", completed: true },
        ],
      };
    });
  }, []);

  const generateAutoPlan = useCallback(() => {
    setData((prev) => {
      const allKeys = generateMonthKeys(prev.startDate, prev.config.years * 12);
      const existingKeys = new Set(prev.monthRecords.map((r) => r.monthKey));
      const newRecords: MonthRecord[] = [];

      for (const key of allKeys) {
        if (!existingKeys.has(key)) {
          newRecords.push({
            monthKey: key,
            deposits: prev.config.contributors.map(c => ({
              actualSelic: c.plannedSelic,
              actualCDB: c.plannedCDB,
            })),
            notes: "",
          });
        }
      }

      return { ...prev, monthRecords: [...prev.monthRecords, ...newRecords] };
    });
  }, []);

  const generateNextYear = useCallback(() => {
    setData((prev) => {
      const allKeys = generateMonthKeys(prev.startDate, prev.config.years * 12);
      const existingKeys = new Set(prev.monthRecords.map((r) => r.monthKey));

      const existingMonths = prev.monthRecords.map((r) => r.monthKey).sort();
      const lastMonth = existingMonths[existingMonths.length - 1] || prev.startDate;

      const [ly, lm] = lastMonth.split("-").map(Number);
      const newRecords: MonthRecord[] = [];

      for (let i = 1; i <= 12; i++) {
        const m = ((lm - 1 + i) % 12) + 1;
        const y = ly + Math.floor((lm - 1 + i) / 12);
        const key = `${y}-${String(m).padStart(2, "0")}`;
        if (!existingKeys.has(key) && allKeys.includes(key)) {
          newRecords.push({
            monthKey: key,
            deposits: prev.config.contributors.map(c => ({
              actualSelic: c.plannedSelic,
              actualCDB: c.plannedCDB,
            })),
            notes: "",
          });
        }
      }

      return { ...prev, monthRecords: [...prev.monthRecords, ...newRecords] };
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

  const updateNotificationSettings = useCallback((settings: PlanData["notificationSettings"]) => {
    setData((prev) => ({ ...prev, notificationSettings: settings }));
  }, []);

  const updateFinancialProfile = useCallback((profile: FinancialProfile, goal: EmotionalGoal, customGoal?: string) => {
    setData((prev) => ({ ...prev, financialProfile: profile, emotionalGoal: goal, emotionalGoalCustom: customGoal }));
  }, []);

  const completeOnboarding = useCallback(() => {
    setData((prev) => ({ ...prev, onboardingComplete: true }));
  }, []);

  return {
    data,
    setData,
    updateConfig,
    completeWizard,
    updateMonthRecord,
    updateMonthNotes,
    toggleMonthCompleted,
    generateAutoPlan,
    generateNextYear,
    resetPlan,
    exportJSON,
    importJSON,
    updateNotificationSettings,
    updateFinancialProfile,
    completeOnboarding,
  };
}
