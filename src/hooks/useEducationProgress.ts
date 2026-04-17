/**
 * useEducationProgress — Round-trip real para `education_progress`.
 *
 * Por que existe:
 *  - Antes, progresso educacional vivia apenas em `appData.educationalProgress`
 *    (JSONB no blob legado). Não persistia entre sessões/dispositivos.
 *
 * O que faz:
 *  - Hidrata na primeira vez por usuário (lista lições marcadas como
 *    opened/completed no banco).
 *  - Expõe `markOpened(lessonId, trigger?)` e `markCompleted(lessonId)` que
 *    fazem upsert lógico na tabela.
 *  - Mantém estado local otimista para UI responsiva.
 *
 * Notas de modelagem:
 *  - Tabela não tem unique(user_id, lesson_id) hoje, então fazemos
 *    "select-then-insert/update" para evitar duplicação.
 *  - `status` segue contrato: 'not_started' | 'opened' | 'completed'.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toFriendlyError } from "@/lib/errors/friendlyError";

export type LessonStatus = "not_started" | "opened" | "completed";

export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  openedAt: string | null;
  completedAt: string | null;
}

interface State {
  byLesson: Record<string, LessonProgress>;
  loaded: boolean;
}

export function useEducationProgress(userId: string | undefined) {
  const [state, setState] = useState<State>({ byLesson: {}, loaded: !userId });
  const lastUserRef = useRef<string | null>(null);

  // Hidratação por usuário.
  useEffect(() => {
    if (!userId) {
      setState({ byLesson: {}, loaded: true });
      lastUserRef.current = null;
      return;
    }
    if (lastUserRef.current === userId) return;
    lastUserRef.current = userId;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("education_progress")
        .select("lesson_id, status, opened_at, completed_at")
        .eq("user_id", userId);

      if (cancelled) return;
      if (error) {
        console.warn("[education] hidratação falhou:", error.message);
        setState({ byLesson: {}, loaded: true });
        return;
      }

      const byLesson: Record<string, LessonProgress> = {};
      for (const row of data ?? []) {
        byLesson[row.lesson_id] = {
          lessonId: row.lesson_id,
          status: (row.status as LessonStatus) ?? "not_started",
          openedAt: row.opened_at,
          completedAt: row.completed_at,
        };
      }
      setState({ byLesson, loaded: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Garante que existe uma linha; retorna o id (ou null em erro).
  const ensureRow = useCallback(
    async (lessonId: string): Promise<string | null> => {
      if (!userId) return null;
      const { data: existing } = await supabase
        .from("education_progress")
        .select("id")
        .eq("user_id", userId)
        .eq("lesson_id", lessonId)
        .maybeSingle();
      if (existing?.id) return existing.id;

      const { data: created, error } = await supabase
        .from("education_progress")
        .insert({ user_id: userId, lesson_id: lessonId, status: "not_started" })
        .select("id")
        .single();
      if (error) {
        console.warn("[education] insert falhou:", toFriendlyError(error));
        return null;
      }
      return created.id;
    },
    [userId],
  );

  const markOpened = useCallback(
    async (lessonId: string, contextTrigger?: string) => {
      // Otimismo local — não regride status se já completed.
      setState((prev) => {
        const current = prev.byLesson[lessonId];
        if (current?.status === "completed") return prev;
        const next: LessonProgress = {
          lessonId,
          status: "opened",
          openedAt: current?.openedAt ?? new Date().toISOString(),
          completedAt: current?.completedAt ?? null,
        };
        return { ...prev, byLesson: { ...prev.byLesson, [lessonId]: next } };
      });

      if (!userId) return;
      const id = await ensureRow(lessonId);
      if (!id) return;

      // Não rebaixa completed → opened.
      const { data: row } = await supabase
        .from("education_progress")
        .select("status, opened_at")
        .eq("id", id)
        .maybeSingle();
      if (row?.status === "completed") return;

      const patch: {
        status: LessonStatus;
        opened_at: string;
        context_trigger?: string;
      } = {
        status: "opened",
        opened_at: row?.opened_at ?? new Date().toISOString(),
      };
      if (contextTrigger) patch.context_trigger = contextTrigger;

      const { error } = await supabase
        .from("education_progress")
        .update(patch)
        .eq("id", id);
      if (error) console.warn("[education] update opened falhou:", error.message);
    },
    [userId, ensureRow],
  );

  const markCompleted = useCallback(
    async (lessonId: string) => {
      setState((prev) => {
        const current = prev.byLesson[lessonId];
        const next: LessonProgress = {
          lessonId,
          status: "completed",
          openedAt: current?.openedAt ?? new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        return { ...prev, byLesson: { ...prev.byLesson, [lessonId]: next } };
      });

      if (!userId) return;
      const id = await ensureRow(lessonId);
      if (!id) return;

      const { error } = await supabase
        .from("education_progress")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) console.warn("[education] update completed falhou:", error.message);
    },
    [userId, ensureRow],
  );

  const isCompleted = useCallback(
    (lessonId: string) => state.byLesson[lessonId]?.status === "completed",
    [state.byLesson],
  );

  const isOpened = useCallback(
    (lessonId: string) =>
      state.byLesson[lessonId]?.status === "opened" ||
      state.byLesson[lessonId]?.status === "completed",
    [state.byLesson],
  );

  const completedCount = Object.values(state.byLesson).filter(
    (p) => p.status === "completed",
  ).length;

  return {
    loaded: state.loaded,
    byLesson: state.byLesson,
    completedCount,
    markOpened,
    markCompleted,
    isCompleted,
    isOpened,
  };
}
