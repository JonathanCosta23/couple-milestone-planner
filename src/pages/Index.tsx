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
import { PlanModeSelector } from "@/components/plan/PlanModeSelector";
import { RestoreBackupButton } from "@/components/plan/RestoreBackupButton";

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
    data, completeWizard, updateConfig, updateMonthRecord, updateMonthNotes,
    toggleMonthCompleted, generateAutoPlan, generateNextYear, resetPlan,
    setData: setPlanRawData,
    importJSON, updateNotificationSettings, updateFinancialProfile, completeOnboarding,
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
  const {
    plan: cloudPlanRow,
    members: cloudMembers,
    primaryMember: cloudPrimaryMember,
    partnerMember: cloudPartnerMember,
    refresh: refreshCloudPlan,
  } = usePlan();

  const { celebrated: dismissedMilestones, celebrate: celebrateMilestone } = useCelebratedMilestones(user?.id);
  const [showQuickDeposit, setShowQuickDeposit] = useState(false);
  const [showFinancialSetup, setShowFinancialSetup] = useState(false);

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
    navSection, planoSub, historicoSub, perfilSub,
    setNavSection, setPlanoSub, setHistoricoSub, setPerfilSub,
    goToSection, navigateToTab: handleNavigateToTab,
  } = useAppNavigation();
  const exportImport = useExportImport({ data, exportJSON: () => "", importJSON });
  const fileInputRef = exportImport.fileInputRef;

  const core = useFinancialCore({
    appData, config: data.config, monthRecords: data.monthRecords, startDate: data.startDate,
    profile: data.financialProfile,
    celebratedMilestones: dismissedMilestones,
    cloudPlan: { plan: cloudPlanRow, members: cloudMembers },
  });
  const effectiveAppData = core.effectiveAppData;

  // ── Bloco 2 da Fase 4: handlers de domínio extraídos ──
  // Resolver compartilhado por income/expense/debt.
  const resolveMemberId = useMemberResolver(appData, cloudPrimaryMember, cloudPartnerMember);
  // Investimento mantém comportamento legado (member_id resolvido pelo trigger).
  const resolveAssetMemberId = useCallback((_profileId?: string) => null, []);
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
  });

  const expenseActions = useExpenseActions({
    user, planId, resolveMemberId,
    addExpenseLocal: addExpense, updateExpenseLocal: updateExpense, deleteExpenseLocal: deleteExpense,
  });

  const debtActions = useDebtActions({
    user, planId, resolveMemberId,
    addDebtLocal: addDebt, updateDebtLocal: updateDebt, deleteDebtLocal: deleteDebt,
  });

  const assetActions = useAssetActions({
    user, planId, resolveMemberId: resolveAssetMemberId,
    addInvestmentLocal: addInvestment, updateInvestmentLocal: updateInvestment, deleteInvestmentLocal: deleteInvestment,
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
              <WealthDistribution appData={effectiveAppData} config={data.config} core={core} onAddInvestment={assetActions.add} onUpdateInvestment={assetActions.update} onDeleteInvestment={assetActions.remove} />
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
                onUpdateMonth={trackingActions.updateMonth}
                onUpdateNotes={trackingActions.updateNotes}
                onToggleCompleted={trackingActions.toggleCompleted}
                onGenerateAutoPlan={generateAutoPlan}
              />
            )}
            {historicoSub === "gastos" && (
              <ExpensePanel
                appData={effectiveAppData}
                config={data.config}
                onAddExpense={expenseActions.add}
                onUpdateExpense={expenseActions.update}
                onDeleteExpense={expenseActions.remove}
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
                onAddIncome={incomeActions.add}
                onUpdateIncome={incomeActions.update}
                onDeleteIncome={incomeActions.remove}
              />
            )}
            {historicoSub === "dividas" && (
              <DebtModule
                appData={effectiveAppData}
                config={data.config}
                onAddDebt={debtActions.add}
                onUpdateDebt={debtActions.update}
                onDeleteDebt={debtActions.remove}
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
                  onSetMode={planActions.setMode}
                  onAddPartner={planActions.addPartner}
                  onRemovePartner={planActions.removePartner}
                  onUpdatePrimaryProfile={planActions.updatePrimaryProfile}
                  onUpdatePartnerProfile={planActions.updatePartnerProfile}
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
