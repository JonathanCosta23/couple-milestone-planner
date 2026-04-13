import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { AppData } from "@/lib/models";
import type { PlanData } from "@/lib/types";

interface CloudData {
  planData: PlanData | null;
  appData: AppData | null;
}

export function useCloudSync() {
  const savingRef = useRef(false);

  const loadFromCloud = useCallback(async (userId: string): Promise<CloudData | null> => {
    const { data, error } = await supabase
      .from("user_financial_data")
      .select("plan_data, app_data")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      planData: data.plan_data as unknown as PlanData | null,
      appData: data.app_data as unknown as AppData | null,
    };
  }, []);

  const saveToCloud = useCallback(async (userId: string, planData: PlanData, appData: AppData) => {
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      const { data: existing } = await supabase
        .from("user_financial_data")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("user_financial_data")
          .update({
            plan_data: planData as any,
            app_data: appData as any,
            schema_version: "7.0.0",
          })
          .eq("user_id", userId);
      } else {
        await supabase
          .from("user_financial_data")
          .insert({
            user_id: userId,
            plan_data: planData as any,
            app_data: appData as any,
            schema_version: "7.0.0",
          });
      }
    } finally {
      savingRef.current = false;
    }
  }, []);

  const hasLocalData = useCallback((): boolean => {
    const planRaw = localStorage.getItem("plano-do-milhao");
    const appRaw = localStorage.getItem("plano-do-milhao-app-v7");
    if (!planRaw && !appRaw) return false;

    try {
      if (planRaw) {
        const plan = JSON.parse(planRaw);
        if (plan.wizardComplete) return true;
      }
      if (appRaw) {
        const app = JSON.parse(appRaw);
        if (app.incomes?.length > 0 || app.expenses?.length > 0 || app.investments?.length > 0) return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, []);

  const hasCloudData = useCallback(async (userId: string): Promise<boolean> => {
    const cloud = await loadFromCloud(userId);
    if (!cloud) return false;
    const pd = cloud.planData as any;
    const ad = cloud.appData as any;
    return !!(pd?.wizardComplete || ad?.incomes?.length > 0 || ad?.expenses?.length > 0);
  }, [loadFromCloud]);

  return {
    loadFromCloud,
    saveToCloud,
    hasLocalData,
    hasCloudData,
  };
}
