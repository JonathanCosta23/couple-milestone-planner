/**
 * useCelebratedMilestones — Persists celebrated milestone values
 * in localStorage (always) and in the database milestones table (when logged in).
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const LOCAL_KEY = "plano-celebrated-milestones";

function loadLocal(): number[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(values: number[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(values));
}

export function useCelebratedMilestones(userId: string | undefined) {
  const [celebrated, setCelebrated] = useState<number[]>(loadLocal);
  const [loaded, setLoaded] = useState(false);

  // Load from DB when user logs in
  useEffect(() => {
    if (!userId) {
      setLoaded(true);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from("milestones")
        .select("value")
        .eq("user_id", userId)
        .eq("status", "celebrated");

      if (data && data.length > 0) {
        const dbValues = data.map((r) => Number(r.value));
        // Merge local + DB (union)
        setCelebrated((prev) => {
          const merged = Array.from(new Set([...prev, ...dbValues]));
          saveLocal(merged);
          return merged;
        });
      }
      setLoaded(true);
    };

    load();
  }, [userId]);

  const celebrate = useCallback(
    async (value: number) => {
      setCelebrated((prev) => {
        if (prev.includes(value)) return prev;
        const next = [...prev, value];
        saveLocal(next);
        return next;
      });

      if (userId) {
        // Check if already exists in DB
        const { data: existing } = await supabase
          .from("milestones")
          .select("id")
          .eq("user_id", userId)
          .eq("value", value)
          .eq("status", "celebrated")
          .maybeSingle();

        if (!existing) {
          // We need a plan_id — get the user's active plan
          const { data: plan } = await supabase
            .from("plans")
            .select("id")
            .eq("user_id", userId)
            .eq("status", "active")
            .maybeSingle();

          const planId = plan?.id;
          if (planId) {
            await supabase.from("milestones").insert({
              user_id: userId,
              plan_id: planId,
              value,
              status: "celebrated",
              origin: "realized",
              milestone_type: "financial",
            });
          }
        }
      }
    },
    [userId]
  );

  return { celebrated, celebrate, loaded };
}
