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

  // 4. Inserir plano canônico.
  const planRow = {
    user_id: userId,
    mode,
    goal_amount: localPlan?.config.targetAmount ?? 1_000_000,
    initial_amount: localPlan?.config.initialAmount ?? 0,
    monthly_contribution:
      (localPlan?.config.contributors ?? []).reduce(
        (sum, c) => sum + (c.plannedSelic || 0) + (c.plannedCDB || 0),
        0,
      ) || 0,
    goal_years: localPlan?.config.years ?? 21,
    goal_months: (localPlan?.config.years ?? 21) * 12,
    assumption_selic: localPlan?.config.selicRate ?? 0.1315,
    assumption_cdb_pct: localPlan?.config.cdbRate ?? 1.0,
    assumption_inflation: 0.045,
    assumption_ir: 0.15,
    assumption_iof: 0,
    start_date: localPlan?.startDate ?? new Date().toISOString().slice(0, 7),
    wizard_complete: localPlan?.wizardComplete ?? false,
    onboarding_complete: localPlan?.onboardingComplete ?? false,
    goal_purpose: localPlan?.emotionalGoal ?? null,
    goal_purpose_custom: localPlan?.emotionalGoalCustom ?? null,
    status: "active",
    engine_version: "1.0",
  };

  const { data: createdPlan, error: insertPlanErr } = await supabase
    .from("plans")
    .insert(planRow)
    .select("id")
    .single();

  if (insertPlanErr || !createdPlan) {
    return {
      migrated: false,
      reason: `erro ao criar plano: ${insertPlanErr?.message ?? "sem dados"}`,
    };
  }

  const planId = createdPlan.id;

  // 5. Criar plan_members a partir do app/plan local.
  const members: Array<{
    user_id: string;
    plan_id: string;
    name: string;
    role: string;
    is_primary: boolean;
    is_active: boolean;
    age: number | null;
    avatar_color: string | null;
  }> = [];

  if (localApp?.primaryProfile) {
    members.push({
      user_id: userId,
      plan_id: planId,
      name: localApp.primaryProfile.name || "Você",
      role: "titular",
      is_primary: true,
      is_active: true,
      age: localApp.primaryProfile.age ?? null,
      avatar_color: localApp.primaryProfile.avatarColor ?? "hsl(262, 83%, 58%)",
    });
    if (mode === "casal" && localApp.partner) {
      members.push({
        user_id: userId,
        plan_id: planId,
        name: localApp.partner.profile.name || "Parceiro(a)",
        role: "parceiro",
        is_primary: false,
        is_active: true,
        age: localApp.partner.profile.age ?? null,
        avatar_color: localApp.partner.profile.avatarColor ?? "hsl(190, 80%, 50%)",
      });
    }
  } else if (localPlan) {
    const contribs = localPlan.config.contributors;
    contribs.forEach((c, idx) => {
      const hasPlans = c.plannedSelic > 0 || c.plannedCDB > 0;
      if (idx > 0 && !hasPlans && !c.name?.trim()) return;
      members.push({
        user_id: userId,
        plan_id: planId,
        name: c.name?.trim() || (idx === 0 ? "Você" : "Parceiro(a)"),
        role: idx === 0 ? "titular" : "parceiro",
        is_primary: idx === 0,
        is_active: true,
        age: c.age ?? null,
        avatar_color: idx === 0 ? "hsl(262, 83%, 58%)" : "hsl(190, 80%, 50%)",
      });
    });
  } else {
    // Fallback mínimo: pelo menos um titular.
    members.push({
      user_id: userId,
      plan_id: planId,
      name: "Você",
      role: "titular",
      is_primary: true,
      is_active: true,
      age: null,
      avatar_color: "hsl(262, 83%, 58%)",
    });
  }

  if (members.length > 0) {
    const { error: memErr } = await supabase.from("plan_members").insert(members);
    if (memErr) {
      return {
        migrated: false,
        reason: `plano criado mas erro ao criar membros: ${memErr.message}`,
        planId,
      };
    }
  }

  return { migrated: true, planId, membersCreated: members.length };
}

/**
 * Helper público: snapshot manual antes de operações destrutivas externas.
 */
export function backupBeforeDestructiveOp(): void {
  backupLocalStorage();
}
