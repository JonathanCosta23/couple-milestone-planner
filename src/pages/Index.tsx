import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { usePlanData } from "@/hooks/usePlanData";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import { useDataLifecycle } from "@/hooks/useDataLifecycle";

// ── Eager: caminho crítico (LCP) ──
import { Hero } from "@/components/plan/Hero";
import { UnifiedHome } from "@/components/plan/UnifiedHome";
import { BottomNav, NavSection } from "@/components/plan/BottomNav";
import { SubNav } from "@/components/plan/SubNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthPage } from "@/components/auth/AuthPage";
import { Dashboard } from "@/components/plan/Dashboard";
import { MilestoneAlert } from "@/components/plan/MilestoneAlert";
import { PanelSkeleton } from "@/components/plan/PanelSkeleton";
import { type ConflictSnapshot } from "@/components/auth/DataMigrationDialog";

// ── Lazy: fluxos de entrada (carregados sob demanda) ──
const Onboarding = lazy(() => import("@/components/plan/Onboarding").then(m => ({ default: m.Onboarding })));
const Wizard = lazy(() => import("@/components/plan/Wizard").then(m => ({ default: m.Wizard })));
const FinancialProfileSetup = lazy(() => import("@/components/plan/FinancialProfileSetup").then(m => ({ default: m.FinancialProfileSetup })));

// ── Lazy: painéis "Plano" (densos, raramente todos abertos) ──
const FinancialDiagnostic = lazy(() => import("@/components/plan/FinancialDiagnostic").then(m => ({ default: m.FinancialDiagnostic })));
const JourneyPhases = lazy(() => import("@/components/plan/JourneyPhases").then(m => ({ default: m.JourneyPhases })));
const AdvancedSimulator = lazy(() => import("@/components/plan/AdvancedSimulator").then(m => ({ default: m.AdvancedSimulator })));
const WealthDistribution = lazy(() => import("@/components/plan/WealthDistribution").then(m => ({ default: m.WealthDistribution })));
const PatrimonialArchitecture = lazy(() => import("@/components/plan/PatrimonialArchitecture").then(m => ({ default: m.PatrimonialArchitecture })));
const ProjectionRealistic = lazy(() => import("@/components/plan/ProjectionRealistic").then(m => ({ default: m.ProjectionRealistic })));
const ConcentrationMap = lazy(() => import("@/components/plan/ConcentrationMap").then(m => ({ default: m.ConcentrationMap })));
const CoupleGovernance = lazy(() => import("@/components/plan/CoupleGovernance").then(m => ({ default: m.CoupleGovernance })));
const BehavioralPanel = lazy(() => import("@/components/plan/BehavioralPanel").then(m => ({ default: m.BehavioralPanel })));

// ── Lazy: painéis "Histórico" ──
const IncomePanel = lazy(() => import("@/components/plan/IncomePanel").then(m => ({ default: m.IncomePanel })));
const ExpensePanel = lazy(() => import("@/components/plan/ExpensePanel").then(m => ({ default: m.ExpensePanel })));
const DebtModule = lazy(() => import("@/components/plan/DebtModule").then(m => ({ default: m.DebtModule })));
const MonthlyTracker = lazy(() => import("@/components/plan/MonthlyTracker").then(m => ({ default: m.MonthlyTracker })));

// ── Lazy: painéis "Perfil" e educação ──
const InvestmentGuide = lazy(() => import("@/components/plan/InvestmentGuide").then(m => ({ default: m.InvestmentGuide })));
const HowToUse = lazy(() => import("@/components/plan/HowToUse").then(m => ({ default: m.HowToUse })));
const NotificationSettings = lazy(() => import("@/components/plan/NotificationSettings").then(m => ({ default: m.NotificationSettings })));
const SharePlan = lazy(() => import("@/components/plan/SharePlan").then(m => ({ default: m.SharePlan })));
const TrapDetector = lazy(() => import("@/components/plan/TrapDetector").then(m => ({ default: m.TrapDetector })));
const FinancialGlossary = lazy(() => import("@/components/plan/FinancialGlossary").then(m => ({ default: m.FinancialGlossary })));
const MiniLessons = lazy(() => import("@/components/plan/MiniLessons").then(m => ({ default: m.MiniLessons })));

// ── Lazy: modais e dialogs (só montam quando abertos) ──
const QuickDeposit = lazy(() => import("@/components/plan/QuickDeposit").then(m => ({ default: m.QuickDeposit })));
const ImportDialog = lazy(() => import("@/components/plan/ImportDialog").then(m => ({ default: m.ImportDialog })));
const DataMigrationDialog = lazy(() => import("@/components/auth/DataMigrationDialog").then(m => ({ default: m.DataMigrationDialog })));
const BlobMigrationDialog = lazy(() => import("@/components/auth/BlobMigrationDialog").then(m => ({ default: m.BlobMigrationDialog })));
import { backupBeforeDestructiveOp } from "@/lib/services/dataMigrationService";
import { migrateBlobToTables, previewBlobMigration, loadAppDataFromBlob } from "@/lib/services/blobMigrationService";
import { PlanModeSelector } from "@/components/plan/PlanModeSelector";
import { RestoreBackupButton } from "@/components/plan/RestoreBackupButton";

import { MILESTONES, EMOTIONAL_GOAL_LABELS, PlanConfig, type PlanData } from "@/lib/types";
import type { PlanMode, Investment, Income, Expense, Debt, AppData } from "@/lib/models";
import { parseImportJSON, saveBackup, ImportPreview } from "@/lib/storage";
import { loadAppData, saveAppData } from "@/lib/appStorage";
import { loadPlanData, savePlanData } from "@/lib/storage";
import { useFinancialCore } from "@/hooks/useFinancialCore";
import { usePlan } from "@/hooks/usePlan";
import { usePlanWriter } from "@/hooks/usePlanWriter";
import { useAssetWriter, assetRowToInvestment } from "@/hooks/useAssetWriter";
import { useIncomeWriter } from "@/hooks/useIncomeWriter";
import { useExpenseWriter } from "@/hooks/useExpenseWriter";
import { useDebtWriter } from "@/hooks/useDebtWriter";
import { useMonthlyTrackingWriter } from "@/hooks/useMonthlyTrackingWriter";
import { useDataHydration } from "@/hooks/useDataHydration";
import { useCelebratedMilestones } from "@/hooks/useCelebratedMilestones";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import { useExportImport } from "@/hooks/useExportImport";
import { AppHeader } from "@/components/plan/AppHeader";
import { Button } from "@/components/ui/button";
import { Download, Upload, RotateCcw, Settings, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Sub-nav definitions — shorter labels, better mobile fit
const PLANO_SUBS = [
  { id: "aportes", label: "Aportes", icon: "💰" },
  { id: "estrutura", label: "Estrutura", icon: "🏛️" },
  { id: "simulador", label: "Simular", icon: "📊" },
  { id: "projecao", label: "Projeção", icon: "📈" },
  { id: "diagnostico", label: "Saúde", icon: "🏥" },
  { id: "jornada", label: "Jornada", icon: "🗺️" },
  { id: "comportamento", label: "Hábitos", icon: "🧠" },
  { id: "patrimonio", label: "Patrimônio", icon: "💎" },
  { id: "concentracao", label: "Concentração", icon: "🎯" },
  { id: "governanca", label: "Governança", icon: "👥" },
];

const HISTORICO_SUBS = [
  { id: "tracker", label: "Meses", icon: "📅" },
  { id: "gastos", label: "Gastos", icon: "🛒" },
  { id: "renda", label: "Renda", icon: "💵" },
  { id: "dividas", label: "Dívidas", icon: "📋" },
];

const PERFIL_SUBS = [
  { id: "aprender", label: "Aprender", icon: "📚" },
  { id: "glossario", label: "Glossário", icon: "📖" },
  { id: "armadilhas", label: "Radar", icon: "🛡️" },
  { id: "investir", label: "Investir", icon: "📈" },
  { id: "compartilhar", label: "Exportar", icon: "📤" },
  { id: "ajuda", label: "Ajuda", icon: "❓" },
  { id: "dados", label: "Dados", icon: "💾" },
];

const Index = () => {
  const {
    data, setData: setPlanRawData,
    completeWizard, updateConfig, updateMonthRecord, updateMonthNotes,
    toggleMonthCompleted, generateAutoPlan, generateNextYear, resetPlan, exportJSON, importJSON,
    updateNotificationSettings, updateFinancialProfile, completeOnboarding,
  } = usePlanData();

  const {
    appData, setAppData, setMode, addPartner, removePartner,
    updatePrimaryProfile, updatePartnerProfile,
    addIncome, updateIncome, deleteIncome,
    addExpense, updateExpense, deleteExpense, duplicateExpense, markExpensePaid, convertToRecurring,
    addDebt, updateDebt, deleteDebt,
    addInvestment, updateInvestment, deleteInvestment,
  } = useAppData();

  const { user, loading: authLoading, signOut } = useAuth();
  // Fonte canônica do modo do plano + nomes dos membros (Fase 1.D).
  const { plan: cloudPlanRow, members: cloudMembers, primaryMember: cloudPrimaryMember, partnerMember: cloudPartnerMember, refresh: refreshCloudPlan } = usePlan();
  const planWriter = usePlanWriter();
  const assetWriter = useAssetWriter();
  const incomeWriter = useIncomeWriter();
  const expenseWriter = useExpenseWriter();
  const debtWriter = useDebtWriter();
  const trackingWriter = useMonthlyTrackingWriter();

  const { celebrated: dismissedMilestones, celebrate: celebrateMilestone } = useCelebratedMilestones(user?.id);
  const [showQuickDeposit, setShowQuickDeposit] = useState(false);
  const [showFinancialSetup, setShowFinancialSetup] = useState(false);

  // ── Bloco 1 da Fase 4: ciclo de vida unificado ──
  // Consolida sync inicial, auto-save, hidratação de assets e migração de blob legado.
  // Garante ordem determinística (hidratação antes de auto-save) via refs internos.
  const lifecycle = useDataLifecycle({
    user,
    data,
    appData,
    cloudPlanRow,
    cloudMembers,
    setAppData,
    setPlanData: setPlanRawData,
    importJSON,
  });
  const syncing = lifecycle.syncing;
  const hydration = lifecycle.hydration;

  // Navigation: extraído para hook dedicado (useAppNavigation)
  const {
    navSection, planoSub, historicoSub, perfilSub,
    setNavSection, setPlanoSub, setHistoricoSub, setPerfilSub,
    goToSection, navigateToTab: handleNavigateToTab,
  } = useAppNavigation();

  // Export/Import JSON: extraído para hook dedicado (useExportImport)
  const exportImport = useExportImport({
    data,
    exportJSON,
    importJSON,
  });
  const fileInputRef = exportImport.fileInputRef;

  const core = useFinancialCore({
    appData,
    config: data.config,
    monthRecords: data.monthRecords,
    startDate: data.startDate,
    profile: data.financialProfile,
    celebratedMilestones: dismissedMilestones,
    cloudPlan: { plan: cloudPlanRow, members: cloudMembers },
  });

  // AppData efetivo: leitura canônica de modo + nomes vinda da nuvem quando disponível.
  const effectiveAppData = core.effectiveAppData;

  // ── Handlers que escrevem na nuvem (plans + plan_members) e mantêm cache local ──
  const handleWizardComplete = useCallback(async (config: PlanConfig) => {
    completeWizard(config);
    const primary = config.contributors[0];
    const partner = config.contributors[1];

    if (primary?.name) updatePrimaryProfile({ name: primary.name });
    if (partner?.name) {
      if (!appData.partner || appData.partner.removedAt) addPartner(partner.name);
      else { updatePartnerProfile({ name: partner.name }); setMode("casal"); }
    } else if (appData.partner && !appData.partner.removedAt) {
      setMode("individual");
    }

    if (user) {
      const mode: PlanMode = partner?.name ? "casal" : "individual";
      const totalMonthly = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
      const result = await planWriter.createPlanFromWizard({
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
      if (result.error) toast.error(`Falha ao salvar plano na nuvem: ${result.error}`);
      else await refreshCloudPlan();
    }

    if (!data.financialProfile) setShowFinancialSetup(true);
  }, [appData.partner, completeWizard, updatePrimaryProfile, addPartner, updatePartnerProfile, setMode, user, planWriter, refreshCloudPlan, data.financialProfile]);

  const handleSetMode = useCallback(async (mode: PlanMode) => {
    setMode(mode);
    if (user && cloudPlanRow) {
      const partnerProfile = appData.partner?.profile;
      const result = await planWriter.setPlanMode(
        cloudPlanRow.id,
        mode,
        mode === "casal" && partnerProfile?.name
          ? { name: partnerProfile.name, age: partnerProfile.age ?? null }
          : undefined
      );
      if (result.error) toast.error(`Falha ao trocar modo: ${result.error}`);
      else await refreshCloudPlan();
    }
  }, [setMode, user, cloudPlanRow, appData.partner, planWriter, refreshCloudPlan]);

  const handleAddPartner = useCallback(async (name: string, age?: number) => {
    addPartner(name, age);
    if (user && cloudPlanRow) {
      const result = await planWriter.addPartner(cloudPlanRow.id, { name, age: age ?? null });
      if (result.error) toast.error(`Falha ao adicionar parceiro: ${result.error}`);
      else await refreshCloudPlan();
    }
  }, [addPartner, user, cloudPlanRow, planWriter, refreshCloudPlan]);

  const handleRemovePartner = useCallback(async () => {
    removePartner();
    if (user && cloudPlanRow) {
      const result = await planWriter.removePartner(cloudPlanRow.id);
      if (result.error) toast.error(`Falha ao remover parceiro: ${result.error}`);
      else await refreshCloudPlan();
    }
  }, [removePartner, user, cloudPlanRow, planWriter, refreshCloudPlan]);

  const handleUpdatePrimaryProfile = useCallback(async (profile: { name?: string; age?: number }) => {
    updatePrimaryProfile(profile);
    if (user && cloudPrimaryMember) {
      const result = await planWriter.updateMember(cloudPrimaryMember.id, {
        name: profile.name ?? cloudPrimaryMember.name,
        age: profile.age ?? cloudPrimaryMember.age,
      });
      if (result.error) toast.error(`Falha ao atualizar titular: ${result.error}`);
      else await refreshCloudPlan();
    }
  }, [updatePrimaryProfile, user, cloudPrimaryMember, planWriter, refreshCloudPlan]);

  const handleUpdatePartnerProfile = useCallback(async (profile: { name?: string; age?: number }) => {
    updatePartnerProfile(profile);
    if (user && cloudPartnerMember) {
      const result = await planWriter.updateMember(cloudPartnerMember.id, {
        name: profile.name ?? cloudPartnerMember.name,
        age: profile.age ?? cloudPartnerMember.age,
      });
      if (result.error) toast.error(`Falha ao atualizar parceiro: ${result.error}`);
      else await refreshCloudPlan();
    }
  }, [updatePartnerProfile, user, cloudPartnerMember, planWriter, refreshCloudPlan]);

  // ── Investimentos: escrita real em assets + cache local ──
  const resolveMemberIdForInvestment = useCallback((_profileId?: string): string | null => {
    return null;
  }, []);

  const handleAddInvestment = useCallback(async (inv: Investment) => {
    addInvestment(inv);
    if (user && cloudPlanRow) {
      const memberId = resolveMemberIdForInvestment(inv.profileId);
      const result = await assetWriter.createAsset(cloudPlanRow.id, inv, memberId);
      if (result.error) toast.error(`Falha ao salvar investimento: ${result.error}`);
      else if (result.data) {
        updateInvestment(inv.id, { id: result.data.id } as Partial<Investment>);
      }
    }
  }, [addInvestment, updateInvestment, user, cloudPlanRow, assetWriter, resolveMemberIdForInvestment]);

  const handleUpdateInvestment = useCallback(async (id: string, updates: Partial<Investment>) => {
    updateInvestment(id, updates);
    if (user && cloudPlanRow) {
      const memberId = resolveMemberIdForInvestment(updates.profileId);
      const result = await assetWriter.updateAsset(cloudPlanRow.id, id, updates, memberId);
      if (result.error) toast.error(`Falha ao atualizar investimento: ${result.error}`);
    }
  }, [updateInvestment, user, cloudPlanRow, assetWriter, resolveMemberIdForInvestment]);

  const handleDeleteInvestment = useCallback(async (id: string) => {
    deleteInvestment(id);
    if (user) {
      const result = await assetWriter.deleteAsset(id);
      if (result.error) {
        await assetWriter.deactivateAsset(id);
      }
    }
  }, [deleteInvestment, user, assetWriter]);

  // ── Resolve plan_member_id a partir do profileId do appData ──
  const resolveMemberId = useCallback((profileId?: string): string | null => {
    if (!profileId) return null;
    if (appData.primaryProfile?.id === profileId) return cloudPrimaryMember?.id ?? null;
    if (appData.partner?.profile?.id === profileId) return cloudPartnerMember?.id ?? null;
    return null;
  }, [appData.primaryProfile?.id, appData.partner?.profile?.id, cloudPrimaryMember?.id, cloudPartnerMember?.id]);

  // ── Income handlers (cache local + persistência real) ──
  const handleAddIncome = useCallback(async (income: Income) => {
    addIncome(income);
    if (user && cloudPlanRow) {
      const r = await incomeWriter.createIncome(cloudPlanRow.id, income, resolveMemberId(income.profileId));
      if (r.error) toast.error(`Falha ao salvar renda: ${r.error}`);
      else if (r.data) updateIncome(income.id, { id: r.data.id } as Partial<Income>);
    }
  }, [addIncome, updateIncome, user, cloudPlanRow, incomeWriter, resolveMemberId]);

  const handleUpdateIncome = useCallback(async (id: string, updates: Partial<Income>) => {
    updateIncome(id, updates);
    if (user && cloudPlanRow) {
      const memberId = updates.profileId !== undefined ? resolveMemberId(updates.profileId) : undefined;
      const r = await incomeWriter.updateIncome(cloudPlanRow.id, id, updates, memberId);
      if (r.error) toast.error(`Falha ao atualizar renda: ${r.error}`);
    }
  }, [updateIncome, user, cloudPlanRow, incomeWriter, resolveMemberId]);

  const handleDeleteIncome = useCallback(async (id: string) => {
    deleteIncome(id);
    if (user) { const r = await incomeWriter.deleteIncome(id); if (r.error) toast.error(`Falha ao remover renda: ${r.error}`); }
  }, [deleteIncome, user, incomeWriter]);

  // ── Expense handlers ──
  const handleAddExpense = useCallback(async (expense: Expense) => {
    addExpense(expense);
    if (user && cloudPlanRow) {
      const r = await expenseWriter.createExpense(cloudPlanRow.id, expense, resolveMemberId(expense.responsibleProfileId));
      if (r.error) toast.error(`Falha ao salvar gasto: ${r.error}`);
      else if (r.data) updateExpense(expense.id, { id: r.data.id } as Partial<Expense>);
    }
  }, [addExpense, updateExpense, user, cloudPlanRow, expenseWriter, resolveMemberId]);

  const handleUpdateExpense = useCallback(async (id: string, updates: Partial<Expense>) => {
    updateExpense(id, updates);
    if (user && cloudPlanRow) {
      const memberId = updates.responsibleProfileId !== undefined ? resolveMemberId(updates.responsibleProfileId) : undefined;
      const r = await expenseWriter.updateExpense(cloudPlanRow.id, id, updates, memberId);
      if (r.error) toast.error(`Falha ao atualizar gasto: ${r.error}`);
    }
  }, [updateExpense, user, cloudPlanRow, expenseWriter, resolveMemberId]);

  const handleDeleteExpense = useCallback(async (id: string) => {
    deleteExpense(id);
    if (user) { const r = await expenseWriter.deleteExpense(id); if (r.error) toast.error(`Falha ao remover gasto: ${r.error}`); }
  }, [deleteExpense, user, expenseWriter]);

  // ── Debt handlers ──
  const handleAddDebt = useCallback(async (debt: Debt) => {
    addDebt(debt);
    if (user && cloudPlanRow) {
      const r = await debtWriter.createDebt(cloudPlanRow.id, debt, resolveMemberId(debt.profileId));
      if (r.error) toast.error(`Falha ao salvar dívida: ${r.error}`);
      else if (r.data) updateDebt(debt.id, { id: r.data.id } as Partial<Debt>);
    }
  }, [addDebt, updateDebt, user, cloudPlanRow, debtWriter, resolveMemberId]);

  const handleUpdateDebt = useCallback(async (id: string, updates: Partial<Debt>) => {
    updateDebt(id, updates);
    if (user && cloudPlanRow) {
      const memberId = updates.profileId !== undefined ? resolveMemberId(updates.profileId) : undefined;
      const r = await debtWriter.updateDebt(cloudPlanRow.id, id, updates, memberId);
      if (r.error) toast.error(`Falha ao atualizar dívida: ${r.error}`);
    }
  }, [updateDebt, user, cloudPlanRow, debtWriter, resolveMemberId]);

  const handleDeleteDebt = useCallback(async (id: string) => {
    deleteDebt(id);
    if (user) { const r = await debtWriter.deleteDebt(id); if (r.error) toast.error(`Falha ao remover dívida: ${r.error}`); }
  }, [deleteDebt, user, debtWriter]);

  // ── MonthlyTracker: persiste o mês inteiro a cada edição (idempotente) ──
  const persistMonth = useCallback(async (monthKey: string) => {
    if (!user || !cloudPlanRow || cloudMembers.length === 0) return;
    const record = data.monthRecords.find((r) => r.monthKey === monthKey);
    const ordered = [...cloudMembers].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    const memberInputs = ordered.map((m, idx) => {
      const contrib = data.config.contributors[idx];
      const dep = record?.deposits[idx];
      return {
        planMemberId: m.id,
        plannedSelic: contrib?.plannedSelic ?? 0,
        plannedCDB: contrib?.plannedCDB ?? 0,
        actualSelic: dep?.actualSelic ?? 0,
        actualCDB: dep?.actualCDB ?? 0,
      };
    });
    await trackingWriter.upsertMonth(cloudPlanRow.id, monthKey, memberInputs, record?.notes ?? "", record?.completed);
  }, [user, cloudPlanRow, cloudMembers, data.monthRecords, data.config.contributors, trackingWriter]);

  const handleUpdateMonth = useCallback((monthKey: string, contributorIndex: number, deposit: { actualSelic: number; actualCDB: number }, notes?: string) => {
    updateMonthRecord(monthKey, contributorIndex, deposit, notes);
    setTimeout(() => { void persistMonth(monthKey); }, 0);
  }, [updateMonthRecord, persistMonth]);

  const handleUpdateMonthNotes = useCallback((monthKey: string, notes: string) => {
    updateMonthNotes(monthKey, notes);
    if (user && cloudPlanRow) void trackingWriter.updateMonthNotes(cloudPlanRow.id, monthKey, notes);
  }, [updateMonthNotes, user, cloudPlanRow, trackingWriter]);

  const handleToggleMonthCompleted = useCallback((monthKey: string) => {
    toggleMonthCompleted(monthKey);
    setTimeout(() => { void persistMonth(monthKey); }, 0);
  }, [toggleMonthCompleted, persistMonth]);




  const handleSignOut = async () => {
    await signOut();
    toast.success("Até logo! 👋");
  };

  // Milestone popup: only fires for REALIZED wealth, never projected
  const newMilestone = useMemo(() => {
    const queue = core.milestones.celebrationQueue;
    return queue.length > 0 ? queue[queue.length - 1].value : null;
  }, [core.milestones.celebrationQueue]);

  const goalLabel = data.emotionalGoal
    ? data.emotionalGoal === "outro" ? (data.emotionalGoalCustom || null) : EMOTIONAL_GOAL_LABELS[data.emotionalGoal]
    : null;

  // (handleNavigateToTab, handleExportJSON, handleImportJSON, handleConfirmImport
  //  foram extraídos para useAppNavigation e useExportImport)

  // ── Login obrigatório: porta de entrada do app ──
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) {
    return <AuthPage />;
  }

  // ── Onboarding ──
  if (!data.onboardingComplete) {
    return <Onboarding onComplete={completeOnboarding} />;
  }

  // ── Financial Profile Setup ──
  if (showFinancialSetup) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/50">
          <div className="flex items-center justify-between h-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <button onClick={() => setShowFinancialSetup(false)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <ThemeToggle />
          </div>
        </header>
        <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-lg sm:max-w-xl mx-auto">
          <FinancialProfileSetup
            config={data.config}
            profile={data.financialProfile}
            emotionalGoal={data.emotionalGoal}
            emotionalGoalCustom={data.emotionalGoalCustom}
            onSave={(profile, goal, custom) => {
              updateFinancialProfile(profile, goal, custom);
              setShowFinancialSetup(false);
              toast.success("Perfil salvo!");
            }}
            onSkip={() => setShowFinancialSetup(false)}
          />
        </main>
      </div>
    );
  }

  const renderContent = () => {
    if (!data.wizardComplete) {
      return <Wizard onComplete={handleWizardComplete} />;
    }

    switch (navSection) {
      case "home":
        return (
          <div className="space-y-4">
            <UnifiedHome
              appData={effectiveAppData}
              config={data.config}
              monthRecords={data.monthRecords}
              startDate={data.startDate}
              onNavigateToTab={handleNavigateToTab}
              onOpenQuickDeposit={() => setShowQuickDeposit(true)}
              core={core}
            />
          </div>
        );

      case "plano":
        return (
          <div className="space-y-4">
            <SubNav items={PLANO_SUBS} active={planoSub} onChange={setPlanoSub} />
            {planoSub === "aportes" && (
              <div className="space-y-6">
                <Dashboard config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
              </div>
            )}
            {planoSub === "simulador" && (
              <AdvancedSimulator appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "estrutura" && (
              <PatrimonialArchitecture appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "projecao" && (
              <ProjectionRealistic appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "diagnostico" && (
              <FinancialDiagnostic appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "jornada" && (
              <JourneyPhases appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "comportamento" && (
              <BehavioralPanel appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "patrimonio" && (
              <WealthDistribution appData={effectiveAppData} config={data.config} core={core} onAddInvestment={handleAddInvestment} onUpdateInvestment={handleUpdateInvestment} onDeleteInvestment={handleDeleteInvestment} />
            )}
            {planoSub === "concentracao" && (
              <ConcentrationMap appData={effectiveAppData} config={data.config} core={core} onNavigateToTab={handleNavigateToTab} />
            )}
            {planoSub === "governanca" && (
              <CoupleGovernance appData={effectiveAppData} config={data.config} core={core} onNavigateToTab={handleNavigateToTab} />
            )}
          </div>
        );

      case "historico":
        return (
          <div className="space-y-4">
            <SubNav items={HISTORICO_SUBS} active={historicoSub} onChange={setHistoricoSub} />
            {historicoSub === "tracker" && (
              <MonthlyTracker
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
                onUpdateMonth={handleUpdateMonth}
                onUpdateNotes={handleUpdateMonthNotes}
                onToggleCompleted={handleToggleMonthCompleted}
                onGenerateAutoPlan={generateAutoPlan}
              />
            )}
            {historicoSub === "gastos" && (
              <ExpensePanel
                appData={effectiveAppData}
                config={data.config}
                onAddExpense={handleAddExpense}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
                onDuplicateExpense={duplicateExpense}
                onMarkExpensePaid={markExpensePaid}
                onConvertToRecurring={convertToRecurring}
              />
            )}
            {historicoSub === "renda" && (
              <IncomePanel
                appData={effectiveAppData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
                onAddIncome={handleAddIncome}
                onUpdateIncome={handleUpdateIncome}
                onDeleteIncome={handleDeleteIncome}
              />
            )}
            {historicoSub === "dividas" && (
              <DebtModule
                appData={effectiveAppData}
                config={data.config}
                onAddDebt={handleAddDebt}
                onUpdateDebt={handleUpdateDebt}
                onDeleteDebt={handleDeleteDebt}
              />
            )}
          </div>
        );

      case "perfil":
        return (
          <div className="space-y-4">
            <SubNav items={PERFIL_SUBS} active={perfilSub} onChange={setPerfilSub} />
            {perfilSub === "aprender" && <MiniLessons />}
            {perfilSub === "glossario" && <FinancialGlossary />}
            {perfilSub === "armadilhas" && <TrapDetector />}
            {perfilSub === "investir" && <InvestmentGuide />}
            {perfilSub === "compartilhar" && (
              <SharePlan
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
                profile={data.financialProfile}
                onExportJSON={exportImport.handleExport}
                onImportClick={exportImport.triggerFilePicker}
              />
            )}
            {perfilSub === "ajuda" && <HowToUse />}
            {perfilSub === "dados" && (
              <div className="space-y-4">
                <PlanModeSelector
                  appData={effectiveAppData}
                  onSetMode={handleSetMode}
                  onAddPartner={handleAddPartner}
                  onRemovePartner={handleRemovePartner}
                  onUpdatePrimaryProfile={handleUpdatePrimaryProfile}
                  onUpdatePartnerProfile={handleUpdatePartnerProfile}
                />
                <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start h-12 rounded-xl" onClick={() => setShowFinancialSetup(true)}>
                  <Settings className="w-4 h-4 mr-2.5" /> Perfil financeiro
                </Button>
                <Button variant="outline" className="w-full justify-start h-12 rounded-xl" onClick={exportImport.handleExport}>
                  <Download className="w-4 h-4 mr-2.5" /> Exportar dados
                </Button>
                <Button variant="outline" className="w-full justify-start h-12 rounded-xl" onClick={exportImport.triggerFilePicker}>
                  <Upload className="w-4 h-4 mr-2.5" /> Importar dados
                </Button>
                <RestoreBackupButton />
                <NotificationSettings settings={data.notificationSettings} onUpdate={updateNotificationSettings} />
                <Button variant="outline" className="w-full justify-start h-12 rounded-xl text-muted-foreground" onClick={handleSignOut}>
                  <ArrowLeft className="w-4 h-4 mr-2.5" /> Sair da conta
                </Button>
                <Button variant="outline" className="w-full justify-start h-12 rounded-xl text-destructive hover:text-destructive"
                  onClick={() => { if (confirm("Tem certeza? Essa ação não pode ser desfeita.")) resetPlan(); }}>
                  <RotateCcw className="w-4 h-4 mr-2.5" /> Resetar plano
                </Button>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-4">
      <AppHeader
        user={user}
        syncing={syncing}
        navSection={navSection}
        showDesktopNav={data.wizardComplete}
        onChangeSection={goToSection}
        onOpenSettings={() => { setNavSection("perfil"); setPerfilSub("dados"); }}
        onSignOut={handleSignOut}
      />

      {data.wizardComplete && navSection === "home" && (
        <Hero goalLabel={goalLabel} config={data.config} contributorCount={data.config.contributors.length} />
      )}

      <main className="px-4 sm:px-6 lg:px-8 py-5 max-w-lg sm:max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto">
        <Suspense fallback={<PanelSkeleton />}>
          {renderContent()}
        </Suspense>
      </main>

      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={exportImport.handleFileChange} />

      {data.wizardComplete && (
        <div className="lg:hidden">
          <BottomNav active={navSection} onChange={(s) => { setNavSection(s); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </div>
      )}

      {/* Modais lazy: chunk só carrega quando o modal abre */}
      <Suspense fallback={null}>
        {showQuickDeposit && (
          <QuickDeposit
            open={showQuickDeposit}
            onOpenChange={setShowQuickDeposit}
            config={data.config}
            monthRecords={data.monthRecords}
            onUpdateMonth={updateMonthRecord}
            onToggleCompleted={toggleMonthCompleted}
          />
        )}
        {exportImport.showImportDialog && (
          <ImportDialog
            open={exportImport.showImportDialog}
            onOpenChange={exportImport.closeDialog}
            preview={exportImport.importPreview}
            onConfirm={exportImport.handleConfirm}
          />
        )}
        {lifecycle.migrationDialog.open && (
          <DataMigrationDialog
            open={lifecycle.migrationDialog.open}
            loading={lifecycle.migrationDialog.loading}
            localSnapshot={lifecycle.migrationDialog.localSnapshot}
            cloudSnapshot={lifecycle.migrationDialog.cloudSnapshot}
            onUseCloud={lifecycle.migrationDialog.useCloud}
            onUseLocal={lifecycle.migrationDialog.useLocal}
            onDecideLater={lifecycle.migrationDialog.decideLater}
            onClose={lifecycle.migrationDialog.decideLater}
          />
        )}
        {lifecycle.blobMigration.open && (
          <BlobMigrationDialog
            open={lifecycle.blobMigration.open}
            onOpenChange={(open) => { if (!open) lifecycle.blobMigration.later(); }}
            counts={lifecycle.blobMigration.counts}
            loading={lifecycle.migrationDialog.loading}
            onMigrate={lifecycle.blobMigration.migrate}
            onLater={lifecycle.blobMigration.later}
          />
        )}
      </Suspense>

      <MilestoneAlert
        milestone={newMilestone}
        onDismiss={() => { if (newMilestone) celebrateMilestone(newMilestone); }}
        config={data.config}
      />
    </div>
  );
};

export default Index;
