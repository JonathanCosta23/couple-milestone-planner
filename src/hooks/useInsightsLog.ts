/**
 * useInsightsLog — Sincroniza insights gerados em memória com `insights_log`.
 *
 * Filosofia:
 *  - A UI continua lendo `core.insights` (computado em `useFinancialCore`)
 *    porque os insights são derivados de métricas vivas e precisam
 *    refletir o estado atual sem latência.
 *  - O banco serve para auditoria histórica e estado de leitura
 *    (`is_read`), preservando contexto entre sessões/dispositivos.
 *
 * Estratégia de persistência:
 *  - Após cada mudança no conjunto de insights, agenda upsert debounced (~5s).
 *  - Dedup por (user_id, plan_id, insight_type) — atualiza título/mensagem
 *    se o insight ainda está ativo; insere se for novo.
 *  - Não apaga insights antigos (auditoria temporal).
 *
 * Hidratação:
 *  - Carrega histórico recente (limit 100) por (user, plan) para que outras
 *    telas (ex.: futuro feed de notificações) possam consumir sem refetch.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Insight } from "@/lib/services/insightsService";

const DEBOUNCE_MS = 5000;

export interface PersistedInsight {
  id: string;
  insightType: string;
  title: string;
  message: string;
  cause: string | null;
  recommendedAction: string | null;
  severity: string;
  isRead: boolean;
  createdAt: string;
}

export function useInsightsLog(
  userId: string | undefined,
  planId: string | null | undefined,
  insights: Insight[],
) {
  const [history, setHistory] = useState<PersistedInsight[]>([]);
  const [loaded, setLoaded] = useState(false);
  const lastKeyRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedSignatureRef = useRef<string | null>(null);

  // Hidratação por (user, plan).
  useEffect(() => {
    if (!userId || !planId) {
      setLoaded(!userId); // sem usuário: marca como loaded; sem plano: aguarda.
      return;
    }
    const key = `${userId}::${planId}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("insights_log")
        .select("*")
        .eq("user_id", userId)
        .eq("plan_id", planId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (cancelled) return;
      if (error) {
        console.warn("[insights] hidratação falhou:", error.message);
        setLoaded(true);
        return;
      }

      setHistory(
        (data ?? []).map((r) => ({
          id: r.id,
          insightType: r.insight_type,
          title: r.title,
          message: r.message,
          cause: r.cause,
          recommendedAction: r.recommended_action,
          severity: r.severity,
          isRead: r.is_read,
          createdAt: r.created_at,
        })),
      );
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, planId]);

  // Sync debounced — dedup por insight_type ativo.
  useEffect(() => {
    if (!userId || !planId || !loaded) return;

    // Assinatura para evitar reescrita quando nada mudou.
    const signature = insights
      .map((i) => `${i.id}:${i.title}:${i.message}:${i.severity}`)
      .join("|");
    if (signature === lastSyncedSignatureRef.current) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      lastSyncedSignatureRef.current = signature;

      // Busca tipos já existentes (para decidir insert vs update).
      const types = insights.map((i) => i.id);
      if (types.length === 0) return;

      const { data: existing, error: fetchErr } = await supabase
        .from("insights_log")
        .select("id, insight_type, title, message, severity")
        .eq("user_id", userId)
        .eq("plan_id", planId)
        .in("insight_type", types);

      if (fetchErr) {
        console.warn("[insights] sync fetch falhou:", fetchErr.message);
        return;
      }

      const existingByType = new Map(
        (existing ?? []).map((r) => [r.insight_type, r]),
      );

      type InsertRow = {
        user_id: string;
        plan_id: string;
        insight_type: string;
        title: string;
        message: string;
        cause: string | null;
        recommended_action: string | null;
        severity: string;
      };
      type UpdatePatch = {
        title: string;
        message: string;
        cause: string | null;
        recommended_action: string | null;
        severity: string;
      };
      const inserts: InsertRow[] = [];
      const updates: Array<{ id: string; patch: UpdatePatch }> = [];

      for (const ins of insights) {
        const prev = existingByType.get(ins.id);
        if (!prev) {
          inserts.push({
            user_id: userId,
            plan_id: planId,
            insight_type: ins.id,
            title: ins.title,
            message: ins.message,
            cause: ins.cause ?? null,
            recommended_action: ins.recommendedAction ?? null,
            severity: ins.severity,
          });
        } else if (
          prev.title !== ins.title ||
          prev.message !== ins.message ||
          prev.severity !== ins.severity
        ) {
          updates.push({
            id: prev.id,
            patch: {
              title: ins.title,
              message: ins.message,
              cause: ins.cause ?? null,
              recommended_action: ins.recommendedAction ?? null,
              severity: ins.severity,
            },
          });
        }
      }

      if (inserts.length > 0) {
        const { data: inserted, error } = await supabase
          .from("insights_log")
          .insert(inserts)
          .select("*");
        if (error) console.warn("[insights] insert falhou:", error.message);
        else if (inserted) {
          setHistory((prev) => [
            ...inserted.map((r) => ({
              id: r.id,
              insightType: r.insight_type,
              title: r.title,
              message: r.message,
              cause: r.cause,
              recommendedAction: r.recommended_action,
              severity: r.severity,
              isRead: r.is_read,
              createdAt: r.created_at,
            })),
            ...prev,
          ]);
        }
      }

      for (const u of updates) {
        const { error } = await supabase
          .from("insights_log")
          .update(u.patch)
          .eq("id", u.id);
        if (error) console.warn("[insights] update falhou:", error.message);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [userId, planId, insights, loaded]);

  const markRead = useCallback(
    async (id: string) => {
      setHistory((prev) =>
        prev.map((h) => (h.id === id ? { ...h, isRead: true } : h)),
      );
      if (!userId) return;
      const { error } = await supabase
        .from("insights_log")
        .update({ is_read: true })
        .eq("id", id);
      if (error) console.warn("[insights] markRead falhou:", error.message);
    },
    [userId],
  );

  return { history, loaded, markRead };
}
