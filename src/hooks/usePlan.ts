/**
 * usePlan — Hook canônico para plano e participantes.
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

export type PlanMemberStatus = "active" | "removed" | "pending_invitation";

export interface PlanMemberRow {
  id: string;
  plan_id: string;
  user_id: string;
  name: string;
  role: string;
  is_primary: boolean;
  is_active: boolean;
  /** Campo canônico de lifecycle; is_active permanece por compatibilidade. */
  status: PlanMemberStatus;
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
  primaryName: string;
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
      setState((current) => ({ ...current, loading: false, error: planErr.message }));
      return null;
    }

    const plan = (plans?.[0] ?? null) as PlanRow | null;
    if (!plan) {
      setState((current) => ({
        ...current, plan: null, members: [], loading: false, error: null,
      }));
      return null;
    }

    const { data: members, error: memErr } = await supabase
      .from("plan_members")
      .select("*")
      .eq("plan_id", plan.id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false });

    if (memErr) {
      setState((current) => ({
        ...current, plan, members: [], loading: false, error: memErr.message,
      }));
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
    setState((current) => ({ ...current, loading: true }));
    await fetchPlan(user.id);
  }, [user, fetchPlan]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ plan: null, members: [], loading: false, error: null, migrating: false });
      return;
    }

    let cancelled = false;
    (async () => {
      setState((current) => ({ ...current, loading: true, migrating: true }));
      try {
        await migrateLocalToCloud(user.id);
      } catch {
        // Migração nunca bloqueia a leitura canônica do plano.
      }
      if (cancelled) return;
      setState((current) => ({ ...current, migrating: false }));
      await fetchPlan(user.id);
    })();

    return () => { cancelled = true; };
  }, [user, authLoading, fetchPlan]);

  const primaryMember = state.members.find((member) => member.is_primary)
    ?? state.members[0]
    ?? null;
  const partnerMember = state.members.find(
    (member) => !member.is_primary && member.status === "active",
  ) ?? null;
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
