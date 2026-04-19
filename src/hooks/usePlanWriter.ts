/**
 * usePlanWriter — Camada de escrita real (Lote 2 da Fase 2.A)
 *
 * Escreve direto nas tabelas normalizadas `plans` e `plan_members`.
 * Não substitui useCloudSync ainda (roda em paralelo como rede de
 * segurança no blob `user_financial_data` até a Fase 2.D).
 *
 * Garantias:
 * - Toda operação valida `auth.uid()` (RLS-friendly).
 * - Modo canônico: 'individual' | 'casal' (sem solo/couple).
 * - Trocar para individual desativa parceiro(s) — não apaga histórico.
 * - Idempotente: createPlanFromWizard reutiliza plano existente.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { CanonicalPlanMode } from "@/lib/services/dataMigrationService";
import type { PlanRow, PlanMemberRow } from "@/hooks/usePlan";

export interface CreatePlanInput {
  mode: CanonicalPlanMode;
  goalAmount?: number;
  initialAmount?: number;
  monthlyContribution?: number;
  goalYears?: number;
  goalPurpose?: string | null;
  goalPurposeCustom?: string | null;
  primaryName: string;
  primaryAge?: number | null;
  partnerName?: string | null;
  partnerAge?: number | null;
  wizardComplete?: boolean;
}

export interface UpdatePlanInput {
  mode?: CanonicalPlanMode;
  goalAmount?: number;
  initialAmount?: number;
  monthlyContribution?: number;
  goalYears?: number;
  goalPurpose?: string | null;
  goalPurposeCustom?: string | null;
  wizardComplete?: boolean;
  onboardingComplete?: boolean;
}

export interface UpsertMemberInput {
  name: string;
  age?: number | null;
  isPrimary?: boolean;
  avatarColor?: string | null;
}

interface WriterResult<T> {
  data: T | null;
  error: string | null;
}

const ensureUser = (userId: string | undefined): string | null => userId ?? null;

export function usePlanWriter() {
  const { user } = useAuth();

  /** Cria plano + primary member (e parceiro se modo casal). Idempotente: reusa se já existir. */
  const createPlanFromWizard = useCallback(
    async (input: CreatePlanInput): Promise<WriterResult<{ plan: PlanRow; members: PlanMemberRow[] }>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      // Reutiliza plano existente se houver (1 plano por usuário no MVP)
      const { data: existingPlans, error: fetchErr } = await supabase
        .from("plans")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: true })
        .limit(1);

      if (fetchErr) return { data: null, error: fetchErr.message };

      let plan = existingPlans?.[0] as PlanRow | undefined;

      const planPayload = {
        user_id: uid,
        mode: input.mode,
        goal_amount: input.goalAmount ?? 1_000_000,
        initial_amount: input.initialAmount ?? 0,
        monthly_contribution: input.monthlyContribution ?? 0,
        goal_years: input.goalYears ?? 21,
        goal_months: (input.goalYears ?? 21) * 12,
        goal_purpose: input.goalPurpose ?? null,
        goal_purpose_custom: input.goalPurposeCustom ?? null,
        wizard_complete: input.wizardComplete ?? true,
      };

      if (!plan) {
        const { data: created, error: createErr } = await supabase
          .from("plans")
          .insert(planPayload)
          .select()
          .single();
        if (createErr || !created) return { data: null, error: createErr?.message ?? "Falha ao criar plano." };
        plan = created as PlanRow;
      } else {
        const { data: updated, error: updateErr } = await supabase
          .from("plans")
          .update(planPayload)
          .eq("id", plan.id)
          .select()
          .single();
        if (updateErr || !updated) return { data: null, error: updateErr?.message ?? "Falha ao atualizar plano." };
        plan = updated as PlanRow;
      }

      // Upsert primary member
      const { data: existingMembers } = await supabase
        .from("plan_members")
        .select("*")
        .eq("plan_id", plan.id);

      const existingPrimary = existingMembers?.find((m) => m.is_primary);
      const existingPartner = existingMembers?.find((m) => !m.is_primary);

      if (existingPrimary) {
        await supabase
          .from("plan_members")
          .update({ name: input.primaryName, age: input.primaryAge ?? null, is_active: true })
          .eq("id", existingPrimary.id);
      } else {
        await supabase.from("plan_members").insert({
          plan_id: plan.id,
          user_id: uid,
          name: input.primaryName,
          age: input.primaryAge ?? null,
          is_primary: true,
          role: "titular",
          is_active: true,
        });
      }

      // Parceiro: criar/ativar se casal, desativar se individual
      if (input.mode === "casal" && input.partnerName) {
        if (existingPartner) {
          await supabase
            .from("plan_members")
            .update({ name: input.partnerName, age: input.partnerAge ?? null, is_active: true })
            .eq("id", existingPartner.id);
        } else {
          await supabase.from("plan_members").insert({
            plan_id: plan.id,
            user_id: uid,
            name: input.partnerName,
            age: input.partnerAge ?? null,
            is_primary: false,
            role: "parceiro",
            is_active: true,
          });
        }
      } else if (input.mode === "individual" && existingPartner) {
        await supabase.from("plan_members").update({ is_active: false }).eq("id", existingPartner.id);
      }

      const { data: finalMembers } = await supabase
        .from("plan_members")
        .select("*")
        .eq("plan_id", plan.id)
        .eq("is_active", true)
        .order("is_primary", { ascending: false });

      return { data: { plan, members: (finalMembers ?? []) as PlanMemberRow[] }, error: null };
    },
    [user]
  );

  /** Atualiza campos do plano. Não toca em membros. */
  const updatePlan = useCallback(
    async (planId: string, patch: UpdatePlanInput): Promise<WriterResult<PlanRow>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      const payload: Record<string, unknown> = {};
      if (patch.mode !== undefined) payload.mode = patch.mode;
      if (patch.goalAmount !== undefined) payload.goal_amount = patch.goalAmount;
      if (patch.initialAmount !== undefined) payload.initial_amount = patch.initialAmount;
      if (patch.monthlyContribution !== undefined) payload.monthly_contribution = patch.monthlyContribution;
      if (patch.goalYears !== undefined) {
        payload.goal_years = patch.goalYears;
        payload.goal_months = patch.goalYears * 12;
      }
      if (patch.goalPurpose !== undefined) payload.goal_purpose = patch.goalPurpose;
      if (patch.goalPurposeCustom !== undefined) payload.goal_purpose_custom = patch.goalPurposeCustom;
      if (patch.wizardComplete !== undefined) payload.wizard_complete = patch.wizardComplete;
      if (patch.onboardingComplete !== undefined) payload.onboarding_complete = patch.onboardingComplete;

      const { data, error } = await supabase
        .from("plans")
        .update(payload)
        .eq("id", planId)
        .eq("user_id", uid)
        .select()
        .single();

      if (error || !data) return { data: null, error: error?.message ?? "Falha ao atualizar plano." };
      return { data: data as PlanRow, error: null };
    },
    [user]
  );

  /**
   * Troca o modo do plano com efeito colateral correto:
   * - 'casal' + partnerName: cria/ativa parceiro
   * - 'individual': desativa parceiro existente (não apaga)
   */
  const setPlanMode = useCallback(
    async (
      planId: string,
      mode: CanonicalPlanMode,
      partner?: { name: string; age?: number | null }
    ): Promise<WriterResult<{ plan: PlanRow; members: PlanMemberRow[] }>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      const { data: planData, error: planErr } = await supabase
        .from("plans")
        .update({ mode })
        .eq("id", planId)
        .eq("user_id", uid)
        .select()
        .single();
      if (planErr || !planData) return { data: null, error: planErr?.message ?? "Falha ao trocar modo." };

      const { data: members } = await supabase
        .from("plan_members")
        .select("*")
        .eq("plan_id", planId);

      const partnerRow = members?.find((m) => !m.is_primary);

      if (mode === "casal") {
        if (partnerRow) {
          await supabase
            .from("plan_members")
            .update({
              is_active: true,
              ...(partner?.name ? { name: partner.name } : {}),
              ...(partner?.age !== undefined ? { age: partner.age } : {}),
            })
            .eq("id", partnerRow.id);
        } else if (partner?.name) {
          await supabase.from("plan_members").insert({
            plan_id: planId,
            user_id: uid,
            name: partner.name,
            age: partner.age ?? null,
            is_primary: false,
            role: "parceiro",
            is_active: true,
          });
        }
      } else if (mode === "individual" && partnerRow?.is_active) {
        await supabase.from("plan_members").update({ is_active: false }).eq("id", partnerRow.id);
      }

      const { data: finalMembers } = await supabase
        .from("plan_members")
        .select("*")
        .eq("plan_id", planId)
        .eq("is_active", true)
        .order("is_primary", { ascending: false });

      return {
        data: { plan: planData as PlanRow, members: (finalMembers ?? []) as PlanMemberRow[] },
        error: null,
      };
    },
    [user]
  );

  /** Atualiza nome/idade/cor de um membro existente. */
  const updateMember = useCallback(
    async (memberId: string, patch: UpsertMemberInput): Promise<WriterResult<PlanMemberRow>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      const payload: Record<string, unknown> = {};
      if (patch.name !== undefined) payload.name = patch.name;
      if (patch.age !== undefined) payload.age = patch.age;
      if (patch.avatarColor !== undefined) payload.avatar_color = patch.avatarColor;

      const { data, error } = await supabase
        .from("plan_members")
        .update(payload)
        .eq("id", memberId)
        .eq("user_id", uid)
        .select()
        .single();

      if (error || !data) return { data: null, error: error?.message ?? "Falha ao atualizar membro." };
      return { data: data as PlanMemberRow, error: null };
    },
    [user]
  );

  /** Adiciona parceiro num plano que já é casal (ou converte para casal). */
  const addPartner = useCallback(
    async (
      planId: string,
      partner: { name: string; age?: number | null; avatarColor?: string | null }
    ): Promise<WriterResult<PlanMemberRow>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      // Garante que o plano está em modo casal
      await supabase.from("plans").update({ mode: "casal" }).eq("id", planId).eq("user_id", uid);

      const { data: existing } = await supabase
        .from("plan_members")
        .select("*")
        .eq("plan_id", planId)
        .eq("is_primary", false)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("plan_members")
          .update({
            name: partner.name,
            age: partner.age ?? null,
            avatar_color: partner.avatarColor ?? existing.avatar_color,
            is_active: true,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error || !data) return { data: null, error: error?.message ?? "Falha ao reativar parceiro." };
        return { data: data as PlanMemberRow, error: null };
      }

      const { data, error } = await supabase
        .from("plan_members")
        .insert({
          plan_id: planId,
          user_id: uid,
          name: partner.name,
          age: partner.age ?? null,
          avatar_color: partner.avatarColor ?? null,
          is_primary: false,
          role: "parceiro",
          is_active: true,
        })
        .select()
        .single();

      if (error || !data) return { data: null, error: error?.message ?? "Falha ao adicionar parceiro." };
      return { data: data as PlanMemberRow, error: null };
    },
    [user]
  );

  /** Desativa parceiro (soft remove). Não apaga histórico de tracking. */
  const removePartner = useCallback(
    async (planId: string): Promise<WriterResult<true>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      await supabase
        .from("plan_members")
        .update({ is_active: false })
        .eq("plan_id", planId)
        .eq("user_id", uid)
        .eq("is_primary", false);

      await supabase.from("plans").update({ mode: "individual" }).eq("id", planId).eq("user_id", uid);

      return { data: true, error: null };
    },
    [user]
  );

  return {
    createPlanFromWizard,
    updatePlan,
    setPlanMode,
    updateMember,
    addPartner,
    removePartner,
  };
}
