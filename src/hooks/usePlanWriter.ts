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
import {
  parseAddPartnerPayload,
  parseRemovePartnerPayload,
  parseNormalizePayload,
  type ModeChangeResult,
  type NormalizedModeState,
} from "@/hooks/planWriter/modeChange";

export type { ModeChangeResult, ModeChangeOutcome } from "@/hooks/planWriter/modeChange";

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

      // v3: transacional, nunca reativa parceiro removed, vincula o titular
      // ao auth.uid() via trigger. Não há fallback para escritas em várias
      // etapas — se a RPC não existir, o erro é retornado como recurso
      // indisponível para evitar estados parciais.
      const rpcArgs = {
        p_mode: input.mode,
        p_primary_name: input.primaryName,
        p_plan_id: null,
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
      const rpcRes = await supabase.rpc("upsert_plan_with_members_v3", rpcArgs);
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
      return { data: null, error: rpcRes.error?.message ?? "Falha ao criar plano." };
    },
    [user]
  );

  /** Atualiza campos do plano. Não toca em membros. */
  const updatePlan = useCallback(
    async (planId: string, patch: UpdatePlanInput): Promise<WriterResult<PlanRow>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      const payload: PlanUpdatePayload = {};
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
   * - 'casal': se não há parceiro ativo, exige `partner.name` e chama
   *   `add_plan_partner_v1`. Se já há parceiro ativo, é no-op (mode
   *   já será casal via trigger da RPC de criação).
   * - 'individual': chama `remove_plan_partner_v1` (soft-remove).
   * NUNCA reativa parceiro `removed`; nunca faz UPDATE direto em
   * `plans.mode` seguido de UPDATE em membro.
   */
  const setPlanMode = useCallback(
    async (
      planId: string,
      mode: CanonicalPlanMode,
      partner?: { name: string; age?: number | null }
    ): Promise<WriterResult<ModeChangeResult>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      // Normaliza modo a partir dos membros reais quando a RPC principal
      // indicar estado idempotente ou divergente. Só declaramos sucesso
      // se o modo confirmado bater com o solicitado.
      const normalize = async (): Promise<WriterResult<NormalizedModeState>> => {
        const rpc = await supabase.rpc("normalize_plan_mode_v1", { p_plan_id: planId });
        if (rpc.error) return { data: null, error: rpc.error.message };
        const parsed = parseNormalizePayload(rpc.data);
        if (parsed.ok && parsed.value) return { data: parsed.value, error: null };
        return { data: null, error: parsed.error };
      };

      // Emite um resultado no-op só se o estado normalizado bate com o
      // modo solicitado. Caso contrário devolve `plan_members_inconsistent`
      // (nunca falso sucesso).
      const buildNoopFor = async (
        expected: CanonicalPlanMode
      ): Promise<WriterResult<ModeChangeResult>> => {
        const norm = await normalize();
        if (norm.error || !norm.data) {
          return { data: null, error: norm.error ?? "plan_members_inconsistent" };
        }
        if (norm.data.mode !== expected) {
          return { data: null, error: "plan_members_inconsistent" };
        }
        return {
          data: {
            outcome: "noop",
            planId,
            mode: norm.data.mode,
            partnerId: null,
            removedPartnerId: null,
          },
          error: null,
        };
      };

      // Auditoria usa exatamente o resultado devolvido ao caller — jamais
      // o modo cru pedido pela UI se a RPC/normalize confirmarem outro.
      const audit = (result: ModeChangeResult) => {
        void trackWriterChange({
          userId: uid,
          planId,
          entity: "plan",
          entityId: planId,
          action: "update",
          newValue: { mode: result.mode } as Record<string, unknown>,
          event: "plan_updated",
          eventProperties: { mode: result.mode, outcome: result.outcome },
        });
      };

      if (mode === "individual") {
        const rpc = await supabase.rpc("remove_plan_partner_v1", { p_plan_id: planId });
        if (rpc.error) {
          if (!/partner_not_active/i.test(rpc.error.message)) {
            return { data: null, error: rpc.error.message };
          }
          // Estado já era individual — confirma com normalize.
          const noop = await buildNoopFor("individual");
          if (noop.error || !noop.data) return noop;
          audit(noop.data);
          return noop;
        }
        const parsed = parseRemovePartnerPayload(rpc.data);
        if (!parsed.ok || !parsed.value) {
          return { data: null, error: parsed.error };
        }
        // plan_id retornado precisa bater com o solicitado.
        if (parsed.value.planId !== planId) {
          return { data: null, error: "invalid_rpc_payload" };
        }
        // Se o modo confirmado pela RPC principal diverge, valida via
        // normalize; se normalize confirmar `individual`, mantemos
        // outcome=changed (a RPC principal executou), mas devolvemos o
        // modo realmente confirmado.
        let confirmedMode: CanonicalPlanMode = parsed.value.mode;
        if (confirmedMode !== "individual") {
          const norm = await normalize();
          if (norm.error || !norm.data) {
            return { data: null, error: norm.error ?? "plan_members_inconsistent" };
          }
          if (norm.data.mode !== "individual") {
            return { data: null, error: "plan_members_inconsistent" };
          }
          confirmedMode = norm.data.mode;
        }
        const result: ModeChangeResult = {
          outcome: "changed",
          planId: parsed.value.planId,
          mode: confirmedMode,
          partnerId: null,
          removedPartnerId: parsed.value.removedPartnerId,
        };
        audit(result);
        return { data: result, error: null };
      } else {
        // Casal sem nome: não criamos parceiro. Confirmamos o estado
        // atual via normalize:
        //   - já casal ⇒ no-op silencioso
        //   - individual ⇒ partner_name_required
        //   - qualquer outro ⇒ propaga erro do parser (invalid_rpc_payload)
        if (!partner?.name) {
          const norm = await normalize();
          if (norm.error || !norm.data) {
            return { data: null, error: norm.error ?? "invalid_rpc_payload" };
          }
          if (norm.data.mode === "casal") {
            const result: ModeChangeResult = {
              outcome: "noop",
              planId,
              mode: "casal",
              partnerId: null,
              removedPartnerId: null,
            };
            audit(result);
            return { data: result, error: null };
          }
          return { data: null, error: "partner_name_required" };
        }
        const rpc = await supabase.rpc("add_plan_partner_v1", {
          p_plan_id: planId,
          p_name: partner.name,
          p_age: partner.age ?? null,
        });
        if (rpc.error) {
          if (!/partner_already_active/i.test(rpc.error.message)) {
            return { data: null, error: rpc.error.message };
          }
          const noop = await buildNoopFor("casal");
          if (noop.error || !noop.data) return noop;
          audit(noop.data);
          return noop;
        }
        const parsed = parseAddPartnerPayload(rpc.data);
        if (!parsed.ok || !parsed.value) {
          return { data: null, error: parsed.error };
        }
        if (parsed.value.planId !== planId) {
          return { data: null, error: "invalid_rpc_payload" };
        }
        let confirmedMode: CanonicalPlanMode = parsed.value.mode;
        if (confirmedMode !== "casal") {
          const norm = await normalize();
          if (norm.error || !norm.data) {
            return { data: null, error: norm.error ?? "plan_members_inconsistent" };
          }
          if (norm.data.mode !== "casal") {
            return { data: null, error: "plan_members_inconsistent" };
          }
          confirmedMode = norm.data.mode;
        }
        const result: ModeChangeResult = {
          outcome: "changed",
          planId: parsed.value.planId,
          mode: confirmedMode,
          partnerId: parsed.value.partnerId,
          removedPartnerId: null,
        };
        audit(result);
        return { data: result, error: null };
      }
    },
    [user]
  );

  /**
   * Atualiza SOMENTE nome/idade/cor de um membro existente. Passa por
   * `update_plan_member_profile_v1` — nenhuma escrita direta em
   * `plan_members` (a tabela é read-only para authenticated).
   */
  const updateMember = useCallback(
    async (memberId: string, patch: UpsertMemberInput): Promise<WriterResult<PlanMemberRow>> => {
      const uid = ensureUser(user?.id);
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      const rpc = await supabase.rpc("update_plan_member_profile_v1", {
        p_member_id: memberId,
        p_name: patch.name ?? null,
        p_age: patch.age ?? null,
        p_avatar_color: patch.avatarColor ?? null,
      });
      if (rpc.error || !rpc.data) {
        return { data: null, error: rpc.error?.message ?? "Falha ao atualizar membro." };
      }
      return { data: rpc.data as unknown as PlanMemberRow, error: null };
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
      // numa única transação. Nunca reativa parceiro removido — a
      // reintegração fica para RPC específica futura. O retorno inclui
      // o objeto `partner` completo, então NÃO fazemos SELECT posterior
      // como pré-requisito de sucesso (evita falso erro em delays de
      // replicação/refresh).
      const rpc = await supabase.rpc("add_plan_partner_v1", {
        p_plan_id: planId,
        p_name: partner.name,
        p_age: partner.age ?? null,
      });
      if (rpc.error) return { data: null, error: rpc.error.message };
      const payload = rpc.data as {
        partner_id?: string;
        partner?: PlanMemberRow;
      } | null;
      if (!payload?.partner_id || !payload.partner) {
        return { data: null, error: "Falha ao adicionar parceiro." };
      }
      // Cor de avatar é aplicada por RPC de perfil (best-effort, não
      // bloqueia o retorno de sucesso).
      if (partner.avatarColor) {
        void supabase.rpc("update_plan_member_profile_v1", {
          p_member_id: payload.partner_id,
          p_name: null,
          p_age: null,
          p_avatar_color: partner.avatarColor,
        });
      }
      return { data: payload.partner as PlanMemberRow, error: null };
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
