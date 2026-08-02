/**
 * usePlan — Hook canônico (Fase 1.B)
 *
 * Lê plans + plan_members do Supabase. É a fonte única de verdade para:
 * - modo do plano (individual / casal)
 * - lista de membros com nomes dinâmicos
 * - configurações principais (meta, premissas, datas)
 *
 * Roda a migração automática do localStorage → banco normalizado na primeira
 * carga após login (idempotente, com backup local prévio).
 *
 * Componentes devem consumir este hook ao invés de `useAppData`/`usePlanData`
 * para qualquer leitura de modo, nomes ou configuração.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { migrateLocalToCloud, type CanonicalPlanMode } from "@/lib/services/dataMigrationService";

export interface PlanRow {
  id: string;
  user_id: string;
  mode: CanonicalPlanMode;
  goal_amount: number;
  initial_amount: number;
  monthly_contribution: number;
  goal_years: number;
  goal_months: number;
  assumption_selic: number;
  assumption_cdb_pct: number;
  assumption_inflation: number;
  assumption_ir: number;
  assumption_iof: number;
  start_date: string;
  wizard_complete: boolean;
  onboarding_complete: boolean;
  goal_purpose: string | null;
  goal_purpose_custom: string | null;
  status: string;
  engine_version: string;
}

export interface PlanMemberRow {
  id: string;
  plan_id: string;
  user_id: string;
  name: string;
  role: string;
  is_primary: boolean;
  is_active: boolean;
  age: number | null;
  avatar_color: string | null;
}

interface UsePlanState {
  plan: PlanRow | null;
  members: PlanMemberRow[];
  loading: boolean;
  error: string | null;
  migrating: boolean;
}

interface UsePlanReturn extends UsePlanState {
  refresh: () => Promise<void>;
  primaryMember: PlanMemberRow | null;
  partnerMember: PlanMemberRow | null;
  isCouple: boolean;
  /** Nome dinâmico do titular para exibição; nunca hardcoded. */
  primaryName: string;
  /** Nome dinâmico do parceiro; null em individual. */
  partnerName: string | null;
}

export function usePlan(): UsePlanReturn {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<UsePlanState>({
    plan: null,
    members: [],
    loading: true,
    error: null,
    migrating: false,
  });

  const fetchPlan = useCallback(async (userId: string) => {
    const { data: plans, error: planErr } = await supabase
      .from("plans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (planErr) {
      setState((s) => ({ ...s, loading: false, error: planErr.message }));
      return null;
    }

    const plan = (plans?.[0] ?? null) as PlanRow | null;
    if (!plan) {
      setState((s) => ({ ...s, plan: null, members: [], loading: false, error: null }));
      return null;
    }

    const { data: members, error: memErr } = await supabase
      .from("plan_members")
      .select("*")
      .eq("plan_id", plan.id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false });

    if (memErr) {
      setState((s) => ({ ...s, plan, members: [], loading: false, error: memErr.message }));
      return plan;
    }

    setState({
      plan,
      members: (members ?? []) as PlanMemberRow[],
      loading: false,
      error: null,
      migrating: false,
    });
    return plan;
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setState((s) => ({ ...s, loading: true }));
    await fetchPlan(user.id);
  }, [user, fetchPlan]);

  // Boot: roda migração automática se necessário e depois carrega o plano.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ plan: null, members: [], loading: false, error: null, migrating: false });
      return;
    }

    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, migrating: true }));
      try {
        await migrateLocalToCloud(user.id);
      } catch {
        // Migração nunca deve bloquear o app; segue para fetch.
      }
      if (cancelled) return;
      setState((s) => ({ ...s, migrating: false }));
      await fetchPlan(user.id);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, fetchPlan]);

  const primaryMember = state.members.find((m) => m.is_primary) ?? state.members[0] ?? null;
  const partnerMember = state.members.find((m) => !m.is_primary && m.is_active) ?? null;
  const isCouple = state.plan?.mode === "casal";

  return {
    ...state,
    refresh,
    primaryMember,
    partnerMember,
    isCouple,
    primaryName: primaryMember?.name?.trim() || "Você",
    partnerName: isCouple ? partnerMember?.name?.trim() || "Parceiro(a)" : null,
  };
}
