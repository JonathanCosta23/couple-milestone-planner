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
import { trackWriterChange } from "@/lib/services/auditService";
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

type PlanUpdatePayload = {
  mode?: CanonicalPlanMode;
  goal_amount?: number;
  initial_amount?: number;
  monthly_contribution?: number;
  goal_years?: number;
  goal_months?: number;
  goal_purpose?: string | null;
  goal_purpose_custom?: string | null;
  wizard_complete?: boolean;
  onboarding_complete?: boolean;
};

type MemberUpdatePayload = {
  name?: string;
  age?: number | null;
  avatar_color?: string | null;
};

const ensureUser = (userId: string | undefined): string | null => userId ?? null;

export function usePlanWriter() {
  const { user } = useAuth();

  /** Cria plano + primary member (e parceiro se modo casal). Idempotente: reusa se já existir. */
  const createPlanFromWizard = useCallback(
    async (input: CreatePlanInput): Promise<WriterResult<{ plan: PlanRow; members: PlanMemberRow[] }>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      // Caminho preferencial: RPC v2 transacional (plano + membros em uma tx,
      // com validação estrita de plan_id e exigência de parceiro em modo casal).
      const rpcArgs = {
        p_mode: input.mode,
        p_primary_name: input.primaryName,
        p_primary_age: input.primaryAge ?? null,
        p_partner_name: input.partnerName ?? null,
        p_partner_age: input.partnerAge ?? null,
        p_goal_amount: input.goalAmount ?? null,
        p_initial_amount: input.initialAmount ?? null,
        p_monthly_contribution: input.monthlyContribution ?? null,
        p_goal_years: input.goalYears ?? null,
        p_goal_purpose: input.goalPurpose ?? null,
        p_goal_purpose_custom: input.goalPurposeCustom ?? null,
        p_wizard_complete: input.wizardComplete ?? true,
        p_onboarding_complete: null,
      };
      let rpcRes = await supabase.rpc("upsert_plan_with_members_v2", {
        ...rpcArgs,
        p_plan_id: null,
      });
      if (rpcRes.error && /function .* does not exist|PGRST202/i.test(rpcRes.error.message)) {
        // Fallback: ambiente ainda sem a v2 deployada.
        rpcRes = await supabase.rpc("upsert_plan_with_members", rpcArgs);
      }

      if (!rpcRes.error && rpcRes.data) {
        const payload = rpcRes.data as unknown as { plan: PlanRow; members: PlanMemberRow[] };
        void trackWriterChange({
          userId: uid,
          planId: payload.plan.id,
          entity: "plan",
          entityId: payload.plan.id,
          action: "create",
          newValue: payload.plan as unknown as Record<string, unknown>,
          event: "plan_created",
          eventProperties: { mode: input.mode, members: payload.members?.length ?? 0 },
        });
        return { data: { plan: payload.plan, members: payload.members ?? [] }, error: null };
      }

      // Fallback (apenas se a RPC ainda não estiver disponível neste ambiente).
      if (rpcRes.error && !/function .* does not exist|PGRST202/i.test(rpcRes.error.message)) {
        return { data: null, error: rpcRes.error.message };
      }

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
      const { data: existingMembers, error: membersFetchErr } = await supabase
        .from("plan_members")
        .select("*")
        .eq("plan_id", plan.id);
      if (membersFetchErr) return { data: null, error: membersFetchErr.message };

      const existingPrimary = existingMembers?.find((m) => m.is_primary);
      const existingPartner = existingMembers?.find((m) => !m.is_primary);

      if (existingPrimary) {
        const { error: primUpdErr } = await supabase
          .from("plan_members")
          .update({ name: input.primaryName, age: input.primaryAge ?? null, is_active: true })
          .eq("id", existingPrimary.id);
        if (primUpdErr) return { data: null, error: `Falha ao atualizar titular: ${primUpdErr.message}` };
      } else {
        const { error: primInsErr } = await supabase.from("plan_members").insert({
          plan_id: plan.id,
          user_id: uid,
          name: input.primaryName,
          age: input.primaryAge ?? null,
          is_primary: true,
          role: "titular",
          is_active: true,
        });
        if (primInsErr) return { data: null, error: `Falha ao criar titular: ${primInsErr.message}` };
      }

      // Parceiro: criar/ativar se casal, desativar se individual
      if (input.mode === "casal" && input.partnerName) {
        if (existingPartner) {
          const { error: partUpdErr } = await supabase
            .from("plan_members")
            .update({ name: input.partnerName, age: input.partnerAge ?? null, is_active: true })
            .eq("id", existingPartner.id);
          if (partUpdErr) return { data: null, error: `Falha ao atualizar parceiro: ${partUpdErr.message}` };
        } else {
          const { error: partInsErr } = await supabase.from("plan_members").insert({
            plan_id: plan.id,
            user_id: uid,
            name: input.partnerName,
            age: input.partnerAge ?? null,
            is_primary: false,
            role: "parceiro",
            is_active: true,
          });
          if (partInsErr) return { data: null, error: `Falha ao criar parceiro: ${partInsErr.message}` };
        }
      } else if (input.mode === "individual" && existingPartner) {
        const { error: partDeactErr } = await supabase
          .from("plan_members").update({ is_active: false }).eq("id", existingPartner.id);
        if (partDeactErr) return { data: null, error: `Falha ao desativar parceiro: ${partDeactErr.message}` };
      }

      const { data: finalMembers, error: finalErr } = await supabase
        .from("plan_members")
        .select("*")
        .eq("plan_id", plan.id)
        .eq("is_active", true)
        .order("is_primary", { ascending: false });
      if (finalErr) return { data: null, error: finalErr.message };

      return { data: { plan, members: (finalMembers ?? []) as PlanMemberRow[] }, error: null };
    },
    [user]
  );

  /** Atualiza campos do plano. Não toca em membros. */
  const updatePlan = useCallback(
    async (planId: string, patch: UpdatePlanInput): Promise<WriterResult<PlanRow>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      const payload: PlanUpdatePayload = {};
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

      // Caminho preferencial: RPC transacional. Precisa do nome do primary
      // atual para não mexer no titular.
      const { data: primary } = await supabase
        .from("plan_members")
        .select("name, age")
        .eq("plan_id", planId)
        .eq("user_id", uid)
        .eq("is_primary", true)
        .maybeSingle();

      if (primary?.name) {
        const rpcArgs = {
          p_mode: mode,
          p_primary_name: primary.name,
          p_primary_age: primary.age ?? null,
          p_partner_name: partner?.name ?? null,
          p_partner_age: partner?.age ?? null,
        };
        let rpcRes = await supabase.rpc("upsert_plan_with_members_v2", {
          ...rpcArgs,
          p_plan_id: planId,
        });
        if (rpcRes.error && /function .* does not exist|PGRST202/i.test(rpcRes.error.message)) {
          rpcRes = await supabase.rpc("upsert_plan_with_members", rpcArgs);
        }
        if (!rpcRes.error && rpcRes.data) {
          const payload = rpcRes.data as unknown as { plan: PlanRow; members: PlanMemberRow[] };
          void trackWriterChange({
            userId: uid,
            planId,
            entity: "plan",
            entityId: planId,
            action: "update",
            newValue: { mode } as Record<string, unknown>,
            event: "plan_updated",
            eventProperties: { mode },
          });
          return { data: { plan: payload.plan, members: payload.members ?? [] }, error: null };
        }
        if (rpcRes.error && !/function .* does not exist|PGRST202/i.test(rpcRes.error.message)) {
          return { data: null, error: rpcRes.error.message };
        }
      }

      const { data: planData, error: planErr } = await supabase
        .from("plans")
        .update({ mode })
        .eq("id", planId)
        .eq("user_id", uid)
        .select()
        .single();
      if (planErr || !planData) return { data: null, error: planErr?.message ?? "Falha ao trocar modo." };

      const { data: members, error: membersErr } = await supabase
        .from("plan_members")
        .select("*")
        .eq("plan_id", planId);
      if (membersErr) return { data: null, error: membersErr.message };

      const partnerRow = members?.find((m) => !m.is_primary);

      if (mode === "casal") {
        if (partnerRow) {
          const { error: upErr } = await supabase
            .from("plan_members")
            .update({
              is_active: true,
              ...(partner?.name ? { name: partner.name } : {}),
              ...(partner?.age !== undefined ? { age: partner.age } : {}),
            })
            .eq("id", partnerRow.id);
          if (upErr) return { data: null, error: `Falha ao reativar parceiro: ${upErr.message}` };
        } else if (partner?.name) {
          const { error: insErr } = await supabase.from("plan_members").insert({
            plan_id: planId,
            user_id: uid,
            name: partner.name,
            age: partner.age ?? null,
            is_primary: false,
            role: "parceiro",
            is_active: true,
          });
          if (insErr) return { data: null, error: `Falha ao criar parceiro: ${insErr.message}` };
        }
      } else if (mode === "individual" && partnerRow?.is_active) {
        const { error: deactErr } = await supabase
          .from("plan_members").update({ is_active: false }).eq("id", partnerRow.id);
        if (deactErr) return { data: null, error: `Falha ao desativar parceiro: ${deactErr.message}` };
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

      const payload: MemberUpdatePayload = {};
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

      // RPC transacional: cria novo membro parceiro + muda mode=casal
      // numa única transação. NUNCA reativa parceiro removido — a
      // reintegração fica para RPC específica futura.
      const rpc = await supabase.rpc("add_plan_partner_v1", {
        p_plan_id: planId,
        p_name: partner.name,
        p_age: partner.age ?? null,
      });
      if (rpc.error) return { data: null, error: rpc.error.message };
      const payload = rpc.data as { partner_id?: string } | null;
      if (!payload?.partner_id) {
        return { data: null, error: "Falha ao adicionar parceiro." };
      }
      const { data, error } = await supabase
        .from("plan_members")
        .select("*")
        .eq("id", payload.partner_id)
        .eq("user_id", uid)
        .single();
      if (error || !data) return { data: null, error: error?.message ?? "Falha ao ler parceiro." };
      // Opcional: avatar color permanece patch de UI, aplicado depois.
      if (partner.avatarColor) {
        await supabase.from("plan_members")
          .update({ avatar_color: partner.avatarColor })
          .eq("id", payload.partner_id).eq("user_id", uid);
      }
      return { data: data as PlanMemberRow, error: null };
    },
    [user]
  );

  /** Desativa parceiro (soft remove). Não apaga histórico de tracking. */
  const removePartner = useCallback(
    async (planId: string): Promise<WriterResult<true>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      // RPC transacional: desativa parceiro ativo e troca mode=individual
      // atomicamente. Rollback em caso de erro impede estados parciais.
      const rpc = await supabase.rpc("remove_plan_partner_v1", { p_plan_id: planId });
      if (rpc.error) return { data: null, error: rpc.error.message };
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
