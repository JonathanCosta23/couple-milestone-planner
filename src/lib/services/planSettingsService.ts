/**
 * planSettingsService — orquestração testável do salvamento de "Plano e meta"
 * (Configurações). Regra crítica:
 *
 *  1. Se o plano cloud ainda não existe, aborta com erro claro. Nada muda.
 *  2. Persiste primeiro na nuvem via writer canônico. Se falhar, nenhum
 *     estado local é alterado (updateConfig / updateFinancialProfile não
 *     são chamados).
 *  3. Após sucesso: reidrata o plano cloud, depois aplica o estado local
 *     (config + emotionalGoal), garantindo que Home, Projeção e Simulador
 *     vejam os valores confirmados pelo servidor.
 *
 * Não exibe toast — cabe ao chamador decidir a notificação após confirmação.
 */
import type { PlanConfig, FinancialProfile, EmotionalGoal } from "@/lib/types";
import { distributeMonthlyContribution } from "@/lib/utils/contributionDistribution";
import { logger } from "@/lib/logger";

export interface PlanSettingsPatch {
  goalAmount: number;
  initialAmount: number;
  monthlyContribution: number;
  goalYears: number;
  goalPurpose: EmotionalGoal;
  goalPurposeCustom?: string;
}

export interface UpdatePlanWriterResult {
  error?: string | null;
}

export interface PlanWriterLike {
  updatePlan: (
    planId: string,
    patch: {
      goalAmount: number;
      initialAmount: number;
      monthlyContribution: number;
      goalYears: number;
      goalPurpose: EmotionalGoal;
      goalPurposeCustom: string | null;
    },
  ) => Promise<UpdatePlanWriterResult>;
}

export interface SavePlanSettingsDeps {
  cloudPlanId: string | null;
  currentConfig: PlanConfig;
  currentProfile: FinancialProfile | undefined;
  patch: PlanSettingsPatch;
  writer: PlanWriterLike;
  updateConfig: (next: PlanConfig) => void;
  updateFinancialProfile: (
    profile: FinancialProfile,
    goal: EmotionalGoal,
    custom?: string,
  ) => void;
  refreshCloudPlan: () => Promise<void> | void;
}

export const CLOUD_PLAN_NOT_READY_MESSAGE =
  "Seu plano ainda está sendo carregado. Aguarde e tente novamente.";

export async function savePlanSettings(deps: SavePlanSettingsDeps): Promise<void> {
  const {
    cloudPlanId,
    currentConfig,
    currentProfile,
    patch,
    writer,
    updateConfig,
    updateFinancialProfile,
    refreshCloudPlan,
  } = deps;

  if (!cloudPlanId) {
    throw new Error(CLOUD_PLAN_NOT_READY_MESSAGE);
  }

  // 1) Persistência cloud primeiro.
  const result = await writer.updatePlan(cloudPlanId, {
    goalAmount: patch.goalAmount,
    initialAmount: patch.initialAmount,
    monthlyContribution: patch.monthlyContribution,
    goalYears: patch.goalYears,
    goalPurpose: patch.goalPurpose,
    goalPurposeCustom: patch.goalPurposeCustom ?? null,
  });
  if (result.error) {
    throw new Error(result.error);
  }

  // 2) Reidratação da fonte de verdade cloud. A gravação já foi confirmada
  //    pelo writer, então uma falha aqui é apenas latência/rede: registramos
  //    como warning e seguimos aplicando o estado local para não desfazer
  //    o que já está persistido.
  try {
    await refreshCloudPlan();
  } catch (err) {
    logger.warn(
      "planSettings.refresh_after_save_failed",
      { cloudPlanId },
      err,
    );
  }

  // 3) Estado local — só após confirmação cloud.
  const { contributors } = distributeMonthlyContribution(
    currentConfig.contributors,
    patch.monthlyContribution,
  );
  updateConfig({
    ...currentConfig,
    initialAmount: patch.initialAmount,
    targetAmount: patch.goalAmount,
    years: patch.goalYears,
    contributors,
  });
  updateFinancialProfile(
    currentProfile ?? {},
    patch.goalPurpose,
    patch.goalPurposeCustom,
  );
}