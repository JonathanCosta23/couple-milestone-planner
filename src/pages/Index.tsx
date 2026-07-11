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
import { Dashboard } from "@/components/plan/Dashboard";
import { MilestoneAlert } from "@/components/plan/MilestoneAlert";
import { PanelSkeleton } from "@/components/plan/PanelSkeleton";


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
// NotificationSettings, SharePlan e PlanModeSelector são consumidos por
// SettingsHub (eager) — não precisam de import lazy aqui.
const InvestmentGuide = lazy(() => import("@/components/plan/InvestmentGuide").then(m => ({ default: m.InvestmentGuide })));
const HowToUse = lazy(() => import("@/components/plan/HowToUse").then(m => ({ default: m.HowToUse })));
const TrapDetector = lazy(() => import("@/components/plan/TrapDetector").then(m => ({ default: m.TrapDetector })));
const FinancialGlossary = lazy(() => import("@/components/plan/FinancialGlossary").then(m => ({ default: m.FinancialGlossary })));
const MiniLessons = lazy(() => import("@/components/plan/MiniLessons").then(m => ({ default: m.MiniLessons })));
const KnowledgeLibrary = lazy(() => import("@/components/plan/KnowledgeLibrary").then(m => ({ default: m.KnowledgeLibrary })));

// ── Lazy: modais e dialogs (só montam quando abertos) ──
const QuickDeposit = lazy(() => import("@/components/plan/QuickDeposit").then(m => ({ default: m.QuickDeposit })));
const ImportDialog = lazy(() => import("@/components/plan/ImportDialog").then(m => ({ default: m.ImportDialog })));
const DataMigrationDialog = lazy(() => import("@/components/auth/DataMigrationDialog").then(m => ({ default: m.DataMigrationDialog })));
const BlobMigrationDialog = lazy(() => import("@/components/auth/BlobMigrationDialog").then(m => ({ default: m.BlobMigrationDialog })));
import { PlanModeChip } from "@/components/plan/PlanModeChip";
import { ResetPlanDialog } from "@/components/plan/ResetPlanDialog";
import { LegalFooter } from "@/components/plan/LegalDialogs";
import { ConsentGate } from "@/components/auth/ConsentGate";
import { SettingsHub } from "@/pages/index/SettingsHub";

import { EMOTIONAL_GOAL_LABELS, PlanConfig } from "@/lib/types";
import { useFinancialCore } from "@/hooks/useFinancialCore";
import { usePlan } from "@/hooks/usePlan";
import {
  useMemberResolver,
  useIncomeActions,
  useExpenseActions,
  useDebtActions,
  useAssetActions,
  useTrackingActions,
  usePlanActions,
} from "@/hooks/domain";

import { useCelebratedMilestones } from "@/hooks/useCelebratedMilestones";
import { useInsightsLog } from "@/hooks/useInsightsLog";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import { useExportImport } from "@/hooks/useExportImport";
import { AppHeader } from "@/components/plan/AppHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";
import { OfflineBanner } from "@/components/system/OfflineBanner";

// Sub-nav definitions — agrupadas pela jornada de execução patrimonial.
// Ordem reflete a hierarquia de uso (mais frequente → menos frequente).
const EXECUCAO_SUBS_BASE = [
  { id: "mensal", label: "Acompanhamento mensal", icon: "📅" },
  { id: "renda", label: "Renda", icon: "💵" },
  { id: "gastos", label: "Gastos", icon: "🛒" },
  { id: "dividas", label: "Dívidas", icon: "📋" },
  { id: "disciplina", label: "Disciplina", icon: "🧠" },
];

const PATRIMONIO_SUBS_BASE = [
  { id: "ativos", label: "Ativos", icon: "💎" },
  { id: "concentracao", label: "Concentração", icon: "🎯" },
  { id: "estrutura", label: "Arquitetura", icon: "🏛️" },
];

const PROJECAO_SUBS = [
  { id: "projecao", label: "Projeção", icon: "📈" },
  { id: "simulador", label: "Simular", icon: "📊" },
  { id: "jornada", label: "Jornada", icon: "🗺️" },
];

const MAIS_SUBS_BASE = [
  { id: "aprender", label: "Educação", icon: "📚" },
  { id: "glossario", label: "Glossário", icon: "📖" },
  { id: "armadilhas", label: "Radar", icon: "🛡️" },
  { id: "investir", label: "Investir", icon: "📈" },
  { id: "saude", label: "Saúde", icon: "🏥" },
  { id: "governanca", label: "Governança", icon: "👥" },
  { id: "ajuda", label: "Ajuda", icon: "❓" },
  { id: "configuracoes", label: "Configurações", icon: "⚙️" },
];

const Index = () => {
  const {
    data, completeWizard, updateConfig, updateMonthRecord, updateMonthNotes,
    toggleMonthCompleted, generateAutoPlan, generateNextYear,
    setData: setPlanRawData, exportJSON,
    importJSON, updateNotificationSettings, updateFinancialProfile, completeOnboarding,
  } = usePlanData();

  const {
    appData, setAppData, setMode, addPartner, removePartner,
    updatePrimaryProfile, updatePartnerProfile,
    addIncome, updateIncome, deleteIncome,
    addExpense, updateExpense, deleteExpense, addRecurringExpense,
    addDebt, updateDebt, deleteDebt,
    addInvestment, updateInvestment, deleteInvestment,
  } = useAppData();

  const { user, loading: authLoading, signOut } = useAuth();
  // Fonte canônica do modo do plano + nomes dos membros (Fase 1.D).
  const {
    plan: cloudPlanRow,
    members: cloudMembers,
    primaryMember: cloudPrimaryMember,
    partnerMember: cloudPartnerMember,
    refresh: refreshCloudPlan,
    isCouple: cloudIsCouple,
    primaryName: cloudPrimaryName,
    partnerName: cloudPartnerName,
  } = usePlan();

  const { celebrated: dismissedMilestones, celebrate: celebrateMilestone } =
    useCelebratedMilestones(user?.id, cloudPlanRow?.id ?? null);
  const [showQuickDeposit, setShowQuickDeposit] = useState(false);
  const [showFinancialSetup, setShowFinancialSetup] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // ── Bloco 1 da Fase 4: ciclo de vida unificado ──
  const lifecycle = useDataLifecycle({
    user, data, appData,
    cloudPlanRow, cloudMembers,
    setAppData, setPlanData: setPlanRawData,
    importJSON,
  });
  const syncing = lifecycle.syncing;

  // Navigation + Export/Import
  const {
    navSection, execucaoSub, patrimonioSub, projecaoSub, maisSub,
    setNavSection, setExecucaoSub, setPatrimonioSub, setProjecaoSub, setMaisSub,
    goToSection, navigateToTab: handleNavigateToTab,
  } = useAppNavigation();
  const exportImport = useExportImport({ data, exportJSON, importJSON });
  const fileInputRef = exportImport.fileInputRef;

  const core = useFinancialCore({
    appData, config: data.config, monthRecords: data.monthRecords, startDate: data.startDate,
    profile: data.financialProfile,
    celebratedMilestones: dismissedMilestones,
    cloudPlan: { plan: cloudPlanRow, members: cloudMembers },
  });
  const effectiveAppData = core.effectiveAppData;

  // Persistência de insights gerados (Bloco 3 da Fase 4).
  useInsightsLog(user?.id, cloudPlanRow?.id ?? null, core.insights.allInsights);

  // ── Bloco 2 da Fase 4: handlers de domínio extraídos ──
  // Resolver compartilhado por income/expense/debt.
  const resolveMemberId = useMemberResolver(appData, cloudPrimaryMember, cloudPartnerMember);
  // Asset: o `profileId` salvo pelo InvestmentForm já é o member.id real do plano.
  // Validamos contra a lista de membros ativos; se não bater (dado legado), cai no primary.
  const resolveAssetMemberId = useCallback((profileId?: string) => {
    if (!profileId) return cloudPrimaryMember?.id ?? null;
    const valid = cloudMembers.find(m => m.id === profileId && m.is_active);
    if (valid) return valid.id;
    // Fallback: tentar mapear via AppData (caso ainda use o profileId antigo).
    const viaAppData = resolveMemberId(profileId);
    return viaAppData ?? cloudPrimaryMember?.id ?? null;
  }, [cloudMembers, cloudPrimaryMember?.id, resolveMemberId]);
  const planId = cloudPlanRow?.id ?? null;

  const planActions = usePlanActions({
    user, cloudPlan: cloudPlanRow, primaryMember: cloudPrimaryMember, partnerMember: cloudPartnerMember,
    appData, refreshCloudPlan,
    completeWizardLocal: completeWizard,
    setModeLocal: setMode,
    addPartnerLocal: addPartner,
    removePartnerLocal: removePartner,
    updatePrimaryProfileLocal: updatePrimaryProfile,
    updatePartnerProfileLocal: updatePartnerProfile,
  });

  const incomeActions = useIncomeActions({
    user, planId, resolveMemberId,
    addIncomeLocal: addIncome, updateIncomeLocal: updateIncome, deleteIncomeLocal: deleteIncome,
    getIncomeById: (id) => appData.incomes.find((i) => i.id === id),
  });

  const expenseActions = useExpenseActions({
    user, planId, resolveMemberId,
    addExpenseLocal: addExpense, updateExpenseLocal: updateExpense, deleteExpenseLocal: deleteExpense,
    addRecurringExpenseLocal: addRecurringExpense,
    getExpenseById: (id) => appData.expenses.find((e) => e.id === id),
  });

  const debtActions = useDebtActions({
    user, planId, resolveMemberId,
    addDebtLocal: addDebt, updateDebtLocal: updateDebt, deleteDebtLocal: deleteDebt,
    getDebtById: (id) => appData.debts.find((d) => d.id === id),
  });

  const assetActions = useAssetActions({
    user, planId, resolveMemberId: resolveAssetMemberId,
    addInvestmentLocal: addInvestment, updateInvestmentLocal: updateInvestment, deleteInvestmentLocal: deleteInvestment,
    getInvestmentById: (id) => appData.investments.find((i) => i.id === id),
  });

  const trackingActions = useTrackingActions({
    user, planId, members: cloudMembers,
    config: data.config, monthRecords: data.monthRecords,
    updateMonthRecordLocal: updateMonthRecord,
    updateMonthNotesLocal: updateMonthNotes,
    toggleMonthCompletedLocal: toggleMonthCompleted,
  });

  // Wizard precisa decidir mostrar setup financeiro depois de criar plano.
  const handleWizardComplete = useCallback(async (config: PlanConfig) => {
    await planActions.completeWizard(config);
    if (!data.financialProfile) setShowFinancialSetup(true);
  }, [planActions, data.financialProfile]);




  const handleSignOut = async () => {
    // Sprint 1, Item 1: limpa fila offline ANTES do signOut.
    // Evita que writes pendentes do user A sejam processados pelo user B no mesmo navegador.
    if (user?.id) {
      try {
        const { clearAll } = await import("@/lib/offlineQueue");
        await clearAll(user.id);
      } catch (err) {
        // Não bloqueia o logout se o cleanup falhar — apenas registra.
        const { logger } = await import("@/lib/logger");
        logger.warn("auth.signOut.offlineQueue.clear.fail", { userId: user.id }, err);
      }
    }
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
    // Sem sessão: envia à Landing pública. A Landing dispara login/signup em
    // páginas completas; nunca renderizamos AuthPage como modal.
    return <Navigate to="/" replace />;
  }

  // ── Onboarding ──
  if (!data.onboardingComplete) {
    return (
      <ConsentGate userId={user.id} onSignOut={handleSignOut}>
        <Onboarding onComplete={completeOnboarding} />
      </ConsentGate>
    );
  }

  // ── Financial Profile Setup ──
  if (showFinancialSetup) {
    return (
      <ConsentGate userId={user.id} onSignOut={handleSignOut}>
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
      </ConsentGate>
    );
  }

  const renderContent = () => {
    if (!data.wizardComplete) {
      return <Wizard onComplete={handleWizardComplete} />;
    }

    // ── Filtros condicionais por seção ──
    const hasInvestments = (effectiveAppData.investments?.length ?? 0) > 0;
    const isCouple = cloudIsCouple || effectiveAppData.mode === "casal";
    const execucaoSubs = EXECUCAO_SUBS_BASE;
    const patrimonioSubs = PATRIMONIO_SUBS_BASE.filter((s) =>
      s.id === "concentracao" ? hasInvestments : true,
    );
    const maisSubs = MAIS_SUBS_BASE.filter((s) => (s.id === "governanca" ? isCouple : true));

    // Se a sub-aba atual ficou escondida por filtro, fallback para a primeira disponível.
    const safe = (subs: { id: string }[], current: string) =>
      subs.find((s) => s.id === current) ? current : subs[0]?.id ?? current;

    switch (navSection) {
      case "inicio":
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
              topSlot={
                <PlanModeChip
                  appData={effectiveAppData}
                  isCouple={cloudIsCouple}
                  primaryName={cloudPrimaryName}
                  partnerName={cloudPartnerName}
                  onSetMode={planActions.setMode}
                  onAddPartner={planActions.addPartner}
                  onRemovePartner={planActions.removePartner}
                  onUpdatePrimaryProfile={planActions.updatePrimaryProfile}
                  onUpdatePartnerProfile={planActions.updatePartnerProfile}
                />
              }
            />
          </div>
        );

      case "execucao": {
        const sub = safe(execucaoSubs, execucaoSub);
        return (
          <ErrorBoundary area="execucao" title="Não foi possível carregar a Execução">
          <div className="space-y-4">
            <SubNav items={execucaoSubs} active={sub} onChange={setExecucaoSub} />
            {sub === "mensal" && (
              <div className="space-y-6">
                <Dashboard config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
                <MonthlyTracker
                  config={data.config}
                  monthRecords={data.monthRecords}
                  startDate={data.startDate}
                  onUpdateMonth={trackingActions.updateMonth}
                  onUpdateNotes={trackingActions.updateNotes}
                  onToggleCompleted={trackingActions.toggleCompleted}
                  onGenerateAutoPlan={generateAutoPlan}
                />
              </div>
            )}
            {sub === "renda" && (
              <IncomePanel
                appData={effectiveAppData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
                onAddIncome={incomeActions.add}
                onUpdateIncome={incomeActions.update}
                onDeleteIncome={incomeActions.remove}
              />
            )}
            {sub === "gastos" && (
              <ExpensePanel
                appData={effectiveAppData}
                config={data.config}
                onAddExpense={expenseActions.add}
                onUpdateExpense={expenseActions.update}
                onDeleteExpense={expenseActions.remove}
                onDuplicateExpense={expenseActions.duplicate}
                onMarkExpensePaid={expenseActions.markPaid}
                onConvertToRecurring={expenseActions.convertToRecurring}
              />
            )}
            {sub === "dividas" && (
              <DebtModule
                appData={effectiveAppData}
                config={data.config}
                onAddDebt={debtActions.add}
                onUpdateDebt={debtActions.update}
                onDeleteDebt={debtActions.remove}
              />
            )}
            {sub === "disciplina" && (
              <BehavioralPanel appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
          </div>
          </ErrorBoundary>
        );
      }

      case "patrimonio": {
        const sub = safe(patrimonioSubs, patrimonioSub);
        return (
          <ErrorBoundary area="patrimonio" title="Não foi possível carregar o Patrimônio">
          <div className="space-y-4">
            <SubNav items={patrimonioSubs} active={sub} onChange={setPatrimonioSub} />
            {sub === "ativos" && (
              <WealthDistribution appData={effectiveAppData} config={data.config} core={core} onAddInvestment={assetActions.add} onUpdateInvestment={assetActions.update} onDeleteInvestment={assetActions.remove} planMembers={cloudMembers} />
            )}
            {sub === "concentracao" && hasInvestments && (
              <ConcentrationMap appData={effectiveAppData} config={data.config} core={core} onNavigateToTab={handleNavigateToTab} />
            )}
            {sub === "estrutura" && (
              <PatrimonialArchitecture appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
          </div>
          </ErrorBoundary>
        );
      }

      case "projecao": {
        const sub = safe(PROJECAO_SUBS, projecaoSub);
        return (
          <ErrorBoundary area="projecao" title="Não foi possível carregar a Projeção">
          <div className="space-y-4">
            <SubNav items={PROJECAO_SUBS} active={sub} onChange={setProjecaoSub} />
            {sub === "projecao" && (
              <ProjectionRealistic appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {sub === "simulador" && (
              <AdvancedSimulator appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {sub === "jornada" && (
              <JourneyPhases appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
          </div>
          </ErrorBoundary>
        );
      }

      case "mais": {
        const sub = safe(maisSubs, maisSub);
        return (
          <ErrorBoundary area="mais" title="Não foi possível carregar esta área">
          <div className="space-y-4">
            <SubNav items={maisSubs} active={sub} onChange={setMaisSub} />
            {sub === "aprender" && (
              <div className="space-y-6">
                <KnowledgeLibrary />
                <MiniLessons />
              </div>
            )}
            {sub === "glossario" && <FinancialGlossary />}
            {sub === "armadilhas" && <TrapDetector />}
            {sub === "investir" && <InvestmentGuide />}
            {sub === "saude" && (
              <FinancialDiagnostic appData={effectiveAppData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {sub === "governanca" && isCouple && (
              <CoupleGovernance appData={effectiveAppData} config={data.config} core={core} onNavigateToTab={handleNavigateToTab} />
            )}
            {sub === "ajuda" && <HowToUse />}
            {sub === "configuracoes" && (
              <SettingsHub
                appData={effectiveAppData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
                financialProfile={data.financialProfile}
                notificationSettings={data.notificationSettings}
                onUpdateNotificationSettings={updateNotificationSettings}
                planActions={{
                  setMode: planActions.setMode,
                  addPartner: planActions.addPartner,
                  removePartner: planActions.removePartner,
                  updatePrimaryProfile: planActions.updatePrimaryProfile,
                  updatePartnerProfile: planActions.updatePartnerProfile,
                }}
                onOpenFinancialSetup={() => setShowFinancialSetup(true)}
                onExport={exportImport.handleExport}
                onTriggerImport={exportImport.triggerFilePicker}
                onSignOut={handleSignOut}
                onOpenReset={() => setShowResetDialog(true)}
              />
            )}
          </div>
          </ErrorBoundary>
        );
      }

      default:
        return null;
    }
  };

  return (
    <ConsentGate userId={user.id} onSignOut={handleSignOut}>
    <div className="min-h-screen bg-background pb-20 lg:pb-4">
      <OfflineBanner />
      <AppHeader
        user={user}
        syncing={syncing}
        navSection={navSection}
        showDesktopNav={data.wizardComplete}
        onChangeSection={goToSection}
        onOpenSettings={() => { setNavSection("mais"); setMaisSub("configuracoes"); }}
        onSignOut={handleSignOut}
      />

      {/* Hero institucional aparece apenas fora da Home logada (ex.: durante wizard). */}
      {!data.wizardComplete && (
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
            onSaveBatch={trackingActions.saveMonthDepositsBatch}
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

      <ResetPlanDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        userId={user?.id}
      />

      <LegalFooter onRequestReset={() => setShowResetDialog(true)} />
    </div>
    </ConsentGate>
  );
};

export default Index;
