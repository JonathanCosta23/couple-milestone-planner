/**
 * useCelebratedMilestones — Persiste marcos celebrados na tabela `milestones`
 * com escopo por (user_id, plan_id). Mantém cache local apenas como fallback
 * imediato (otimismo + offline), mas a fonte de verdade é o banco.
 *
 * Fluxo:
 *  1. Boot: lê do banco filtrando por plan_id; popula estado e cache local.
 *  2. celebrate(value): grava no banco (upsert lógico via dedup) e atualiza estado.
 *  3. Sem plan_id: opera só com cache local (degrada graciosamente).
 *
 * Round-trip validado: o popup nunca reaparece após login em outra sessão
 * porque o banco é consultado antes de o `core.milestones.celebrationQueue`
 * ser computado (estado vira [] → muitos itens conforme banco responde).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { logProductEvent } from "@/lib/services/auditService";
import { scopedStorageKey } from "@/lib/services/localCacheOwner";

const LOCAL_KEY_PREFIX = "plano-celebrated-milestones";

function localKey(userId?: string, planId?: string | null): string | null {
  if (!userId || !planId) return null;
  return scopedStorageKey(`${LOCAL_KEY_PREFIX}::${planId}`, userId);
}

function loadLocal(key: string | null): number[] {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(key: string | null, values: number[]) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    /* quota exceeded — ignora */
  }
}

export function useCelebratedMilestones(userId: string | undefined, planId?: string | null) {
  const key = localKey(userId, planId);
  const [celebrated, setCelebrated] = useState<number[]>(() => loadLocal(key));
  const [loaded, setLoaded] = useState(false);
  const lastKeyRef = useRef<string | null>(null);

  // Carrega do banco filtrando por plan_id quando login + plano disponíveis.
  useEffect(() => {
    // Sem usuário: somente cache local genérico.
    if (!userId) {
      setCelebrated([]);
      setLoaded(true);
      lastKeyRef.current = null;
      return;
    }
    // Com usuário mas sem plano: aguarda plano para evitar misturar escopos.
    if (!planId) {
      setLoaded(false);
      return;
    }
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("value")
        .eq("user_id", userId)
        .eq("plan_id", planId)
        .eq("status", "celebrated");

      if (cancelled) return;
      if (error) {
        // Falha de leitura: mantém cache local; não quebra o boot.
        logger.warn("milestones.load.fail", { userId, planId }, error.message);
        setLoaded(true);
        return;
      }

      const dbValues = (data ?? []).map((r) => Number(r.value));
      const local = loadLocal(key);
      const merged = Array.from(new Set([...local, ...dbValues])).sort((a, b) => a - b);
      saveLocal(key, merged);
      setCelebrated(merged);
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, planId, key]);

  const celebrate = useCallback(
    async (value: number) => {
      // Otimismo local imediato (evita popup duplicado no mesmo boot).
      setCelebrated((prev) => {
        if (prev.includes(value)) return prev;
        const next = [...prev, value].sort((a, b) => a - b);
        saveLocal(key, next);
        return next;
      });

      if (!userId || !planId) return; // offline / sem plano: só cache local.

      // Dedup explícita por (user, plan, value, status=celebrated).
      const { data: existing } = await supabase
        .from("milestones")
        .select("id")
        .eq("user_id", userId)
        .eq("plan_id", planId)
        .eq("value", value)
        .eq("status", "celebrated")
        .maybeSingle();

      if (existing) return;

      const { error } = await supabase.from("milestones").insert({
        user_id: userId,
        plan_id: planId,
        value,
        status: "celebrated",
        origin: "realized",
        milestone_type: "financial",
      });

      if (error) {
        logger.warn("milestones.save.fail", { userId, planId, value }, error.message);
        // Estado local permanece — usuário não verá popup novamente nesta sessão.
        return;
      }
      void logProductEvent({
        userId,
        planId,
        event: "milestone_reached",
        properties: { value, origin: "realized" },
      });
    },
    [userId, planId, key],
  );

  return { celebrated, celebrate, loaded };
}
