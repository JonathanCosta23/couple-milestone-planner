/**
 * Data Migration Service — Fase 1.B
 *
 * Detecta dados antigos no localStorage (v6 PlanData / v7 AppData) ao logar
 * e migra para o modelo normalizado (plans + plan_members + ...) no Supabase,
 * fazendo backup local prévio.
 *
 * Princípios:
 * - Não-destrutivo: nunca sobrescreve sem backup.
 * - Idempotente: rodar de novo não duplica plano nem membros.
 * - Silencioso por padrão: se já existe plano no banco, não migra.
 * - Conversão de modo: solo→individual, couple→casal.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppData, PlanMode as LegacyPlanMode } from "@/lib/models";
import type { PlanData } from "@/lib/types";

const LEGACY_PLAN_KEY = "plano-do-milhao-v6";
const LEGACY_APP_KEY = "plano-do-milhao-app-v7";
const PRE_MIGRATION_BACKUP_KEY = "plano-do-milhao-pre-migration-backup";

export type CanonicalPlanMode = "individual" | "casal";

/**
 * Aceita modo canônico atual ("individual"/"casal") ou strings legadas
 * ("solo"/"couple") vindas de JSONs/exports antigos e devolve o canônico.
 */
export function toCanonicalMode(mode: LegacyPlanMode | string | null | undefined): CanonicalPlanMode {
  if (mode === "casal" || mode === "couple") return "casal";
  return "individual";
}

interface MigrationResult {
  migrated: boolean;
  reason?: string;
  planId?: string;
  membersCreated?: number;
}

/**
 * Backup tudo que estiver no localStorage relacionado ao app, antes de qualquer migração.
 * Backup é feito sempre, mesmo que a migração não rode.
 */
function backupLocalStorage(): void {
  try {
    const snapshot: Record<string, string | null> = {
      [LEGACY_PLAN_KEY]: localStorage.getItem(LEGACY_PLAN_KEY),
      [LEGACY_APP_KEY]: localStorage.getItem(LEGACY_APP_KEY),
      _backupAt: new Date().toISOString(),
    };
    localStorage.setItem(PRE_MIGRATION_BACKUP_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage cheio: prossegue sem backup
  }
}

function readLocalPlanData(): PlanData | null {
  try {
    const raw = localStorage.getItem(LEGACY_PLAN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlanData;
  } catch {
    return null;
  }
}

function readLocalAppData(): AppData | null {
  try {
    const raw = localStorage.getItem(LEGACY_APP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppData;
  } catch {
    return null;
  }
}

/**
 * Migra dados locais para o modelo normalizado no Supabase.
 * Retorna detalhes do que foi feito. Seguro chamar várias vezes.
 */
export async function migrateLocalToCloud(userId: string): Promise<MigrationResult> {
  // 1. Verificar se já existe plano no banco — se sim, não migrar.
  const { data: existingPlans, error: planErr } = await supabase
    .from("plans")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (planErr) {
    return { migrated: false, reason: `erro ao consultar plans: ${planErr.message}` };
  }
  if (existingPlans && existingPlans.length > 0) {
    return { migrated: false, reason: "plano já existe no banco" };
  }

  const localPlan = readLocalPlanData();
  const localApp = readLocalAppData();

  if (!localPlan && !localApp) {
    return { migrated: false, reason: "nenhum dado local para migrar" };
  }

  // 2. Backup obrigatório antes de qualquer escrita.
  backupLocalStorage();

  // 3. Determinar modo canônico.
  const mode: CanonicalPlanMode = (() => {
    if (localApp?.mode) return toCanonicalMode(localApp.mode);
    const contribsWithPlans = localPlan?.config.contributors.filter(
      (c) => c.plannedSelic > 0 || c.plannedCDB > 0,
    );
    return (contribsWithPlans?.length ?? 0) > 1 ? "casal" : "individual";
  })();

  // 4. Criar plano + membros via RPC transacional (INSERT direto em
  //    `plans`/`plan_members` é revogado: só as RPCs oficiais escrevem).
  const primaryName =
    localApp?.primaryProfile?.name?.trim() ||
    localPlan?.config.contributors?.[0]?.name?.trim() ||
    "Você";
  const primaryAge =
    localApp?.primaryProfile?.age ?? localPlan?.config.contributors?.[0]?.age ?? null;

  const partnerName =
    mode === "casal"
      ? localApp?.partner?.profile.name?.trim() ||
        localPlan?.config.contributors?.[1]?.name?.trim() ||
        "Parceiro(a)"
      : null;
  const partnerAge =
    mode === "casal"
      ? localApp?.partner?.profile.age ?? localPlan?.config.contributors?.[1]?.age ?? null
      : null;

  const monthlyContribution =
    (localPlan?.config.contributors ?? []).reduce(
      (sum, c) => sum + (c.plannedSelic || 0) + (c.plannedCDB || 0),
      0,
    ) || 0;

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "upsert_plan_with_members_v3",
    {
      p_mode: mode,
      p_primary_name: primaryName,
      p_primary_age: primaryAge,
      p_partner_name: partnerName,
      p_partner_age: partnerAge,
      p_goal_amount: localPlan?.config.targetAmount ?? 1_000_000,
      p_initial_amount: localPlan?.config.initialAmount ?? 0,
      p_monthly_contribution: monthlyContribution,
      p_goal_years: localPlan?.config.years ?? 21,
      p_goal_purpose: localPlan?.emotionalGoal ?? null,
      p_goal_purpose_custom: localPlan?.emotionalGoalCustom ?? null,
      p_wizard_complete: localPlan?.wizardComplete ?? false,
      p_onboarding_complete: localPlan?.onboardingComplete ?? false,
    },
  );

  if (rpcErr || !rpcData) {
    return {
      migrated: false,
      reason: `erro ao criar plano: ${rpcErr?.message ?? "sem dados"}`,
    };
  }

  const payload = rpcData as unknown as {
    plan?: { id?: string };
    members?: unknown[];
  };
  const planId = payload.plan?.id;
  if (!planId) {
    return { migrated: false, reason: "erro ao criar plano: resposta inválida" };
  }

  const membersCreated = Array.isArray(payload.members) ? payload.members.length : 0;

  // 5. Premissas financeiras legadas (colunas com UPDATE liberado).
  const assumptionSelic = localPlan?.config.selicRate;
  const assumptionCdb = localPlan?.config.cdbRate;
  if (assumptionSelic !== undefined || assumptionCdb !== undefined) {
    await supabase
      .from("plans")
      .update({
        ...(assumptionSelic !== undefined ? { assumption_selic: assumptionSelic } : {}),
        ...(assumptionCdb !== undefined ? { assumption_cdb_pct: assumptionCdb } : {}),
      })
      .eq("id", planId)
      .eq("user_id", userId);
  }

  return { migrated: true, planId, membersCreated };
}

/**
 * Helper público: snapshot manual antes de operações destrutivas externas.
 */
export function backupBeforeDestructiveOp(): void {
  backupLocalStorage();
}
