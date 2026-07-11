/**
 * computeFgcNextAction — sugere próxima ação FGC prioritária.
 */

import type { FgcDiagnosis, FgcFourYearUsage, FgcNextActionSuggestion } from "../types/fgc";

export interface FgcNextActionContext {
  diagnosis: FgcDiagnosis;
  fourYearUsage?: FgcFourYearUsage;
  yieldMayCrossPrudential?: boolean;
}

export function computeFgcNextAction(ctx: FgcNextActionContext): FgcNextActionSuggestion {
  const d = ctx.diagnosis;
  if (d.assetsPendingClassification.length > 0) {
    return { kind: "classify_asset", headline: "Ativo sem classificação",
      detail: "Classifique este ativo para verificar se ele pode fazer parte da garantia ordinária.",
      ctaLabel: "Revisar ativo", ctaTarget: { tab: "patrimonio", sub: "arquitetura" } };
  }
  if (d.assetsPendingInstitution.length > 0) {
    return { kind: "verify_institution", headline: "Instituição não verificada",
      detail: "Confirme a instituição emissora para identificar o conglomerado.",
      ctaLabel: "Confirmar instituição", ctaTarget: { tab: "patrimonio", sub: "arquitetura" } };
  }
  if (d.totalOfficialExcess > 0) {
    return { kind: "above_official_limit", headline: "Acima do limite oficial",
      detail: "Há valor acima do limite oficial informado por titular e conglomerado.",
      ctaLabel: "Analisar concentração", ctaTarget: { tab: "patrimonio", sub: "arquitetura" } };
  }
  if (d.totalPrudentialExcess > 0) {
    return { kind: "above_prudential_margin", headline: "Dentro do limite oficial, acima da margem operacional",
      detail: "O saldo está dentro do limite oficial, mas supera sua margem operacional.",
      ctaLabel: "Revisar margem", ctaTarget: { tab: "patrimonio", sub: "arquitetura" } };
  }
  if (ctx.yieldMayCrossPrudential) {
    return { kind: "yield_may_exceed_limit", headline: "Rendimento pode ultrapassar o limite",
      detail: "Com as premissas atuais, o saldo pode superar o limite operacional antes do vencimento.",
      ctaLabel: "Ver projeção", ctaTarget: { tab: "projecao", sub: "cdi" } };
  }
  if (ctx.fourYearUsage?.status === "unknown_history") {
    return { kind: "four_year_history_unknown", headline: "Histórico de 4 anos não informado",
      detail: "Informe se você já recebeu pagamentos do FGC nos últimos quatro anos.",
      ctaLabel: "Completar histórico", ctaTarget: { tab: "patrimonio", sub: "arquitetura" } };
  }
  return { kind: "ok", headline: "Exposição FGC coerente",
    detail: "Nenhuma ação FGC prioritária identificada com as informações atuais.",
    ctaLabel: "Ver detalhes", ctaTarget: { tab: "patrimonio", sub: "arquitetura" } };
}