import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type LearningStatus = "not_started" | "in_progress" | "completed";

export interface LearningProgressRow {
  topicId: string;
  status: LearningStatus;
  progress: number;
  completedAt: string | null;
  lastViewedAt: string;
}

export function useLearningProgress(userId: string | undefined) {
  const [byTopic, setByTopic] = useState<Record<string, LearningProgressRow>>({});
  const [loaded, setLoaded] = useState(!userId);
  const lastUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) { setByTopic({}); setLoaded(true); lastUserRef.current = null; return; }
    if (lastUserRef.current === userId) return;
    lastUserRef.current = userId;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_learning_progress")
        .select("topic_id, status, progress_percentage, completed_at, last_viewed_at")
        .eq("user_id", userId);
      if (cancelled) return;
      if (error) {
        logger.warn("learning.hydrate.fail", { userId }, error.message);
        setLoaded(true);
        return;
      }
      const next: Record<string, LearningProgressRow> = {};
      for (const r of data ?? []) {
        next[r.topic_id] = {
          topicId: r.topic_id,
          status: (r.status as LearningStatus) ?? "not_started",
          progress: r.progress_percentage ?? 0,
          completedAt: r.completed_at,
          lastViewedAt: r.last_viewed_at,
        };
      }
      setByTopic(next);
      setLoaded(true);
    })();
  }, [userId]);

  const upsert = useCallback(
    async (topicId: string, patch: Partial<Pick<LearningProgressRow, "status" | "progress">>) => {
      const current = byTopic[topicId];
      const nextStatus = patch.status ?? current?.status ?? "in_progress";
      const nextProgress = patch.progress ?? current?.progress ?? (nextStatus === "completed" ? 100 : 25);
      const nowIso = new Date().toISOString();
      const optimistic: LearningProgressRow = {
        topicId,
        status: nextStatus,
        progress: nextProgress,
        completedAt: nextStatus === "completed" ? nowIso : current?.completedAt ?? null,
        lastViewedAt: nowIso,
      };
      setByTopic((prev) => ({ ...prev, [topicId]: optimistic }));

      if (!userId) return;
      const { error } = await supabase.from("user_learning_progress").upsert(
        {
          user_id: userId,
          topic_id: topicId,
          status: nextStatus,
          progress_percentage: nextProgress,
          completed_at: optimistic.completedAt,
          last_viewed_at: nowIso,
        },
        { onConflict: "user_id,topic_id" },
      );
      if (error) logger.warn("learning.upsert.fail", { userId, topicId }, error.message);
    },
    [userId, byTopic],
  );

  return { byTopic, loaded, upsert };
}