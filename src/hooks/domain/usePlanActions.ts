/**
 * usePlanActions — handler de domínio para Plano + Membros (modo, parceiro, perfis).
 * Inclui o fluxo completo do Wizard (cria plano + membros na nuvem).
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { PlanMode, AppData } from "@/lib/models";
import type { PlanConfig } from "@/lib/types";
import type { PlanRow, PlanMemberRow } from "@/hooks/usePlan";
import { usePlanWriter } from "@/hooks/usePlanWriter";
import { toFriendlyError } from "@/lib/errors/friendlyError";
import { logger } from "@/lib/logger";

interface Deps {
  user: { id: string } | null;
  cloudPlan: PlanRow | null;
  primaryMember: PlanMemberRow | null;
  partnerMember: PlanMemberRow | null;
  appData: AppData;
  refreshCloudPlan: () => Promise<void>;
  // local writers
  completeWizardLocal: (config: PlanConfig) => void;
  setModeLocal: (mode: PlanMode) => void;
  addPartnerLocal: (name: string, age?: number) => void;
  removePartnerLocal: () => void;
  updatePrimaryProfileLocal: (profile: { name?: string; age?: number }) => void;
  updatePartnerProfileLocal: (profile: { name?: string; age?: number }) => void;
}

export interface PlanActions {
  completeWizard: (config: PlanConfig) => Promise<{ needsFinancialSetup: boolean }>;
  setMode: (mode: PlanMode) => Promise<void>;
  addPartner: (name: string, age?: number) => Promise<void>;
  removePartner: () => Promise<void>;
  updatePrimaryProfile: (profile: { name?: string; age?: number }) => Promise<void>;
  updatePartnerProfile: (profile: { name?: string; age?: number }) => Promise<void>;
}

export function usePlanActions(deps: Deps): PlanActions {
  const {
    user, cloudPlan, primaryMember, partnerMember, appData, refreshCloudPlan,
    completeWizardLocal, setModeLocal, addPartnerLocal, removePartnerLocal,
    updatePrimaryProfileLocal, updatePartnerProfileLocal,
  } = deps;
  const writer = usePlanWriter();

  // Reidrata a fonte de verdade cloud depois de um write já confirmado.
  // Falha aqui é apenas latência/rede — não pode virar erro para o usuário
  // nem desfazer o que já persistiu. Registra warning técnico apenas.
  const refreshAfterConfirmedWrite = useCallback(
    async (context: string) => {
      try {
        await refreshCloudPlan();
      } catch (err) {
        logger.warn("planActions.refresh_after_write_failed", { context }, err);
      }
    },
    [refreshCloudPlan]
  );

  const completeWizard = useCallback<PlanActions["completeWizard"]>(async (config) => {
    const primary = config.contributors[0];
    const partner = config.contributors[1];

    // Cloud-first: com usuário logado, PRIMEIRO grava plano+membros na
    // nuvem via RPC transacional. Só depois aplica estado local. Falha
    // cloud não pode mexer em primaryProfile, mode ou partner locais.
    if (user) {
      const mode: PlanMode = partner?.name ? "casal" : "individual";
      const totalMonthly = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
      const result = await writer.createPlanFromWizard({
        mode,
        goalAmount: config.targetAmount,
        initialAmount: config.initialAmount,
        monthlyContribution: totalMonthly,
        goalYears: config.years,
        primaryName: primary?.name || "Você",
        primaryAge: primary?.age ?? null,
        partnerName: partner?.name || null,
        partnerAge: partner?.age ?? null,
        wizardComplete: true,
      });
      if (result.error) {
        toast.error(`Falha ao salvar plano na nuvem: ${toFriendlyError(result.error)}`);
        return { needsFinancialSetup: false };
      }
      // Sucesso na nuvem — aplica estado local para espelhar.
      completeWizardLocal(config);
      if (primary?.name) updatePrimaryProfileLocal({ name: primary.name });
      if (partner?.name) {
        if (!appData.partner || appData.partner.removedAt) addPartnerLocal(partner.name);
        else { updatePartnerProfileLocal({ name: partner.name }); setModeLocal("casal"); }
      } else if (appData.partner && !appData.partner.removedAt) {
        setModeLocal("individual");
      }
      await refreshAfterConfirmedWrite("completeWizard");
    } else {
      // Fluxo pré-login preservado: aplica local (rota de demonstração).
      completeWizardLocal(config);
      if (primary?.name) updatePrimaryProfileLocal({ name: primary.name });
      if (partner?.name) {
        if (!appData.partner || appData.partner.removedAt) addPartnerLocal(partner.name);
        else { updatePartnerProfileLocal({ name: partner.name }); setModeLocal("casal"); }
      } else if (appData.partner && !appData.partner.removedAt) {
        setModeLocal("individual");
      }
    }

    return { needsFinancialSetup: !appData };
    // o componente decide se mostra setup com base em planData.financialProfile
  }, [appData, completeWizardLocal, updatePrimaryProfileLocal, addPartnerLocal, updatePartnerProfileLocal, setModeLocal, user, writer, refreshAfterConfirmedWrite]);

  const setMode = useCallback<PlanActions["setMode"]>(async (mode) => {
    // Cloud-first: sem usuário/plano na nuvem, mantém compat local (rota
    // pré-login). Com nuvem, só atualiza estado local após sucesso — se o
    // banco rejeitar (ex.: reativação bloqueada de parceiro removido), a
    // UI não pode dizer "casal" enquanto o banco continua "individual".
    if (!user || !cloudPlan) { setModeLocal(mode); return; }
    const partnerProfile = appData.partner?.profile;
    const result = await writer.setPlanMode(
      cloudPlan.id,
      mode,
      mode === "casal" && partnerProfile?.name
        ? { name: partnerProfile.name, age: partnerProfile.age ?? null }
        : undefined,
    );
    if (result.error) {
      toast.error(`Falha ao trocar modo: ${toFriendlyError(result.error)}`);
      return;
    }
    setModeLocal(mode);
    await refreshAfterConfirmedWrite("setMode");
  }, [setModeLocal, user, cloudPlan, appData.partner, writer, refreshAfterConfirmedWrite]);

  const addPartner = useCallback<PlanActions["addPartner"]>(async (name, age) => {
    if (!user || !cloudPlan) { addPartnerLocal(name, age); return; }
    const result = await writer.addPartner(cloudPlan.id, { name, age: age ?? null });
    if (result.error) {
      toast.error(`Falha ao adicionar parceiro: ${toFriendlyError(result.error)}`);
      return;
    }
    addPartnerLocal(name, age);
    await refreshAfterConfirmedWrite("addPartner");
  }, [addPartnerLocal, user, cloudPlan, writer, refreshAfterConfirmedWrite]);

  const removePartner = useCallback<PlanActions["removePartner"]>(async () => {
    if (!user || !cloudPlan) { removePartnerLocal(); return; }
    const result = await writer.removePartner(cloudPlan.id);
    if (result.error) {
      toast.error(`Falha ao remover parceiro: ${toFriendlyError(result.error)}`);
      return;
    }
    removePartnerLocal();
    await refreshAfterConfirmedWrite("removePartner");
  }, [removePartnerLocal, user, cloudPlan, writer, refreshAfterConfirmedWrite]);

  const updatePrimaryProfile = useCallback<PlanActions["updatePrimaryProfile"]>(async (profile) => {
    // Cloud-first quando houver membro na nuvem — evita nome/idade local
    // "confirmado" enquanto o banco continua com o valor anterior.
    if (!user || !primaryMember) { updatePrimaryProfileLocal(profile); return; }
    const result = await writer.updateMember(primaryMember.id, {
      name: profile.name ?? primaryMember.name,
      age: profile.age ?? primaryMember.age,
    });
    if (result.error) {
      toast.error(`Falha ao atualizar titular: ${toFriendlyError(result.error)}`);
      return;
    }
    updatePrimaryProfileLocal(profile);
    await refreshAfterConfirmedWrite("updatePrimaryProfile");
  }, [updatePrimaryProfileLocal, user, primaryMember, writer, refreshAfterConfirmedWrite]);

  const updatePartnerProfile = useCallback<PlanActions["updatePartnerProfile"]>(async (profile) => {
    if (!user || !partnerMember) { updatePartnerProfileLocal(profile); return; }
    const result = await writer.updateMember(partnerMember.id, {
      name: profile.name ?? partnerMember.name,
      age: profile.age ?? partnerMember.age,
    });
    if (result.error) {
      toast.error(`Falha ao atualizar parceiro: ${toFriendlyError(result.error)}`);
      return;
    }
    updatePartnerProfileLocal(profile);
    await refreshAfterConfirmedWrite("updatePartnerProfile");
  }, [updatePartnerProfileLocal, user, partnerMember, writer, refreshAfterConfirmedWrite]);

  return { completeWizard, setMode, addPartner, removePartner, updatePrimaryProfile, updatePartnerProfile };
}
