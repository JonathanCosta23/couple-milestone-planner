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

  const completeWizard = useCallback<PlanActions["completeWizard"]>(async (config) => {
    completeWizardLocal(config);
    const primary = config.contributors[0];
    const partner = config.contributors[1];

    if (primary?.name) updatePrimaryProfileLocal({ name: primary.name });
    if (partner?.name) {
      if (!appData.partner || appData.partner.removedAt) addPartnerLocal(partner.name);
      else { updatePartnerProfileLocal({ name: partner.name }); setModeLocal("casal"); }
    } else if (appData.partner && !appData.partner.removedAt) {
      setModeLocal("individual");
    }

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
      if (result.error) toast.error(`Falha ao salvar plano na nuvem: ${toFriendlyError(result.error)}`);
      else await refreshCloudPlan();
    }

    return { needsFinancialSetup: !appData };
    // o componente decide se mostra setup com base em planData.financialProfile
  }, [appData, completeWizardLocal, updatePrimaryProfileLocal, addPartnerLocal, updatePartnerProfileLocal, setModeLocal, user, writer, refreshCloudPlan]);

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
    await refreshCloudPlan();
  }, [setModeLocal, user, cloudPlan, appData.partner, writer, refreshCloudPlan]);

  const addPartner = useCallback<PlanActions["addPartner"]>(async (name, age) => {
    if (!user || !cloudPlan) { addPartnerLocal(name, age); return; }
    const result = await writer.addPartner(cloudPlan.id, { name, age: age ?? null });
    if (result.error) {
      toast.error(`Falha ao adicionar parceiro: ${toFriendlyError(result.error)}`);
      return;
    }
    addPartnerLocal(name, age);
    await refreshCloudPlan();
  }, [addPartnerLocal, user, cloudPlan, writer, refreshCloudPlan]);

  const removePartner = useCallback<PlanActions["removePartner"]>(async () => {
    if (!user || !cloudPlan) { removePartnerLocal(); return; }
    const result = await writer.removePartner(cloudPlan.id);
    if (result.error) {
      toast.error(`Falha ao remover parceiro: ${toFriendlyError(result.error)}`);
      return;
    }
    removePartnerLocal();
    await refreshCloudPlan();
  }, [removePartnerLocal, user, cloudPlan, writer, refreshCloudPlan]);

  const updatePrimaryProfile = useCallback<PlanActions["updatePrimaryProfile"]>(async (profile) => {
    updatePrimaryProfileLocal(profile);
    if (!user || !primaryMember) return;
    const result = await writer.updateMember(primaryMember.id, {
      name: profile.name ?? primaryMember.name,
      age: profile.age ?? primaryMember.age,
    });
    if (result.error) toast.error(`Falha ao atualizar titular: ${toFriendlyError(result.error)}`);
    else await refreshCloudPlan();
  }, [updatePrimaryProfileLocal, user, primaryMember, writer, refreshCloudPlan]);

  const updatePartnerProfile = useCallback<PlanActions["updatePartnerProfile"]>(async (profile) => {
    updatePartnerProfileLocal(profile);
    if (!user || !partnerMember) return;
    const result = await writer.updateMember(partnerMember.id, {
      name: profile.name ?? partnerMember.name,
      age: profile.age ?? partnerMember.age,
    });
    if (result.error) toast.error(`Falha ao atualizar parceiro: ${toFriendlyError(result.error)}`);
    else await refreshCloudPlan();
  }, [updatePartnerProfileLocal, user, partnerMember, writer, refreshCloudPlan]);

  return { completeWizard, setMode, addPartner, removePartner, updatePrimaryProfile, updatePartnerProfile };
}
