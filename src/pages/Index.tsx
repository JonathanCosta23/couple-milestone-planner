import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { usePlanData } from "@/hooks/usePlanData";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import { useCloudSync } from "@/hooks/useCloudSync";
import { Hero } from "@/components/plan/Hero";
import { Onboarding } from "@/components/plan/Onboarding";
import { FinancialProfileSetup } from "@/components/plan/FinancialProfileSetup";
import { Wizard } from "@/components/plan/Wizard";
import { UnifiedHome } from "@/components/plan/UnifiedHome";
import { FinancialDiagnostic } from "@/components/plan/FinancialDiagnostic";
import { JourneyPhases } from "@/components/plan/JourneyPhases";
import { InvestmentGuide } from "@/components/plan/InvestmentGuide";
import { AdvancedSimulator } from "@/components/plan/AdvancedSimulator";
import { IncomePanel } from "@/components/plan/IncomePanel";
import { WealthDistribution } from "@/components/plan/WealthDistribution";
import { PatrimonialArchitecture } from "@/components/plan/PatrimonialArchitecture";
import { ProjectionRealistic } from "@/components/plan/ProjectionRealistic";
import { ConcentrationMap } from "@/components/plan/ConcentrationMap";
import { CoupleGovernance } from "@/components/plan/CoupleGovernance";
import { ExpensePanel } from "@/components/plan/ExpensePanel";
import { DebtModule } from "@/components/plan/DebtModule";
import { Dashboard } from "@/components/plan/Dashboard";
import { MonthlyTracker } from "@/components/plan/MonthlyTracker";
import { MilestoneAlert } from "@/components/plan/MilestoneAlert";
import { HowToUse } from "@/components/plan/HowToUse";
import { NotificationSettings } from "@/components/plan/NotificationSettings";
import { SharePlan } from "@/components/plan/SharePlan";
import { QuickDeposit } from "@/components/plan/QuickDeposit";
import { ImportDialog } from "@/components/plan/ImportDialog";
import { BehavioralPanel } from "@/components/plan/BehavioralPanel";
import { TrapDetector } from "@/components/plan/TrapDetector";
import { FinancialGlossary } from "@/components/plan/FinancialGlossary";
import { MiniLessons } from "@/components/plan/MiniLessons";
import { BottomNav, NavSection } from "@/components/plan/BottomNav";
import { SubNav } from "@/components/plan/SubNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthPage } from "@/components/auth/AuthPage";
import { DataMigrationDialog } from "@/components/auth/DataMigrationDialog";
import { PlanModeSelector } from "@/components/plan/PlanModeSelector";

import { MILESTONES, EMOTIONAL_GOAL_LABELS, PlanConfig } from "@/lib/types";
import type { PlanMode } from "@/lib/models";
import { parseImportJSON, saveBackup, ImportPreview } from "@/lib/storage";
import { loadAppData, saveAppData } from "@/lib/appStorage";
import { loadPlanData, savePlanData } from "@/lib/storage";
import { useFinancialCore } from "@/hooks/useFinancialCore";
import { usePlan } from "@/hooks/usePlan";
import { usePlanWriter } from "@/hooks/usePlanWriter";
import { useCelebratedMilestones } from "@/hooks/useCelebratedMilestones";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, Upload, RotateCcw, Settings, ArrowLeft, User, LogOut, Cloud, Loader2 } from "lucide-react";
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
  const { loadFromCloud, saveToCloud, hasLocalData, hasCloudData } = useCloudSync();
  // Fonte canônica do modo do plano + nomes dos membros (Fase 1.D).
  // Quando há plano no Supabase, sobrescreve appData.mode/primaryProfile/partner via cloudPlan overlay.
  const { plan: cloudPlanRow, members: cloudMembers, primaryMember: cloudPrimaryMember, partnerMember: cloudPartnerMember, refresh: refreshCloudPlan } = usePlan();
  const planWriter = usePlanWriter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { celebrated: dismissedMilestones, celebrate: celebrateMilestone } = useCelebratedMilestones(user?.id);
  const [showQuickDeposit, setShowQuickDeposit] = useState(false);
  const [showFinancialSetup, setShowFinancialSetup] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [cloudHasData, setCloudHasData] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigation state — 4 tabs
  const [navSection, setNavSection] = useState<NavSection>("home");
  const [planoSub, setPlanoSub] = useState("aportes");
  const [historicoSub, setHistoricoSub] = useState("tracker");
  const [perfilSub, setPerfilSub] = useState("aprender");

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
  // Componentes filhos devem consumir este valor no lugar de appData diretamente.
  const effectiveAppData = core.effectiveAppData;

  // ── Handlers que escrevem na nuvem (plans + plan_members) e mantêm cache local ──
  // Mantém useCloudSync rodando em paralelo (rede de segurança até a Fase 2.D).
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

  // ── Cloud sync: load data when user logs in ──
  useEffect(() => {
    if (!user) return;

    const syncFromCloud = async () => {
      const localHasData = hasLocalData();
      const cloudData = await loadFromCloud(user.id);
      const cloudExists = !!(cloudData?.planData && (cloudData.planData as any).wizardComplete);

      if (localHasData && cloudExists) {
        // Both have data — ask user
        setCloudHasData(true);
        setShowMigrationDialog(true);
      } else if (localHasData && !cloudExists) {
        // Only local — migrate to cloud silently
        await saveToCloud(user.id, data, appData);
        toast.success("Seus dados foram salvos na nuvem! ☁️");
      } else if (!localHasData && cloudExists && cloudData) {
        // Only cloud — load from cloud
        if (cloudData.planData) {
          importJSON(JSON.stringify(cloudData.planData));
        }
        if (cloudData.appData) {
          setAppData(cloudData.appData as any);
        }
        toast.success("Dados carregados da nuvem! ☁️");
      }
      // Neither has data — do nothing
    };

    syncFromCloud();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save to cloud on data changes (debounced) ──
  useEffect(() => {
    if (!user || !data.wizardComplete) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      setSyncing(true);
      await saveToCloud(user.id, data, appData);
      setSyncing(false);
    }, 3000);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [user, data, appData, saveToCloud]);

  // ── Backfill: sync wizard contributors → appData mode/partner ──
  useEffect(() => {
    if (!data.wizardComplete) return;
    const primary = data.config.contributors[0];
    const partner = data.config.contributors[1];
    if (primary?.name && !appData.primaryProfile.name) {
      updatePrimaryProfile({ name: primary.name });
    }
    if (partner?.name && (!appData.partner || appData.partner.removedAt)) {
      addPartner(partner.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.wizardComplete, data.config.contributors.length]);

  // ── Migration handlers ──
  const handleMigrateLocal = async () => {
    if (!user) return;
    setMigrationLoading(true);
    await saveToCloud(user.id, data, appData);
    setMigrationLoading(false);
    setShowMigrationDialog(false);
    toast.success("Dados locais salvos na sua conta! ☁️");
  };

  const handleKeepCloud = async () => {
    if (!user) return;
    setMigrationLoading(true);
    const cloudData = await loadFromCloud(user.id);
    if (cloudData?.planData) {
      importJSON(JSON.stringify(cloudData.planData));
    }
    if (cloudData?.appData) {
      setAppData(cloudData.appData as any);
    }
    setMigrationLoading(false);
    setShowMigrationDialog(false);
    toast.success("Dados da conta carregados! ☁️");
  };

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

  const handleNavigateToTab = (tab: string) => {
    const planoTabs = ["aportes", "estrutura", "simulador", "projecao", "diagnostico", "jornada", "comportamento", "patrimonio", "concentracao", "governanca"];
    const historicoTabs = ["tracker", "gastos", "renda", "dividas"];
    const perfilTabs = ["aprender", "glossario", "armadilhas", "investir", "compartilhar", "ajuda", "dados"];

    if (planoTabs.includes(tab)) { setNavSection("plano"); setPlanoSub(tab); }
    else if (historicoTabs.includes(tab)) { setNavSection("historico"); setHistoricoSub(tab); }
    else if (perfilTabs.includes(tab)) { setNavSection("perfil"); setPerfilSub(tab); }
    else { setNavSection("home"); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExportJSON = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plano-do-milhao.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Dados exportados com sucesso!");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const preview = parseImportJSON(result);
      setImportPreview(preview);
      setShowImportDialog(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmImport = () => {
    if (importPreview?.valid && importPreview.data) {
      saveBackup(data);
      importJSON(JSON.stringify(importPreview.data));
      toast.success("Dados importados com sucesso!");
    }
    setShowImportDialog(false);
    setImportPreview(null);
  };

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
              <WealthDistribution appData={effectiveAppData} config={data.config} core={core} onAddInvestment={addInvestment} onUpdateInvestment={updateInvestment} onDeleteInvestment={deleteInvestment} />
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
                onUpdateMonth={updateMonthRecord}
                onUpdateNotes={updateMonthNotes}
                onToggleCompleted={toggleMonthCompleted}
                onGenerateAutoPlan={generateAutoPlan}
              />
            )}
            {historicoSub === "gastos" && (
              <ExpensePanel
                appData={effectiveAppData}
                config={data.config}
                onAddExpense={addExpense}
                onUpdateExpense={updateExpense}
                onDeleteExpense={deleteExpense}
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
                onAddIncome={addIncome}
                onUpdateIncome={updateIncome}
                onDeleteIncome={deleteIncome}
              />
            )}
            {historicoSub === "dividas" && (
              <DebtModule
                appData={effectiveAppData}
                config={data.config}
                onAddDebt={addDebt}
                onUpdateDebt={updateDebt}
                onDeleteDebt={deleteDebt}
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
                onExportJSON={handleExportJSON}
                onImportClick={() => fileInputRef.current?.click()}
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
                <Button variant="outline" className="w-full justify-start h-12 rounded-xl" onClick={handleExportJSON}>
                  <Download className="w-4 h-4 mr-2.5" /> Exportar dados
                </Button>
                <Button variant="outline" className="w-full justify-start h-12 rounded-xl" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2.5" /> Importar dados
                </Button>
                <NotificationSettings settings={data.notificationSettings} onUpdate={updateNotificationSettings} />
                <Button variant="outline" className="w-full justify-start h-12 rounded-xl text-muted-foreground" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4 mr-2.5" /> Sair da conta
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
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border/40">
        <div className="flex items-center justify-between h-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <h1 className="text-sm font-bold text-gradient lg:text-base">Plano do Milhão</h1>
          <div className="flex items-center gap-3">
            {/* Cloud sync indicator */}
            {user && syncing && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">Salvando...</span>
              </div>
            )}
            {user && !syncing && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-500">
                <Cloud className="w-3 h-3" />
                <span className="hidden sm:inline">Salvo</span>
              </div>
            )}

            {/* Desktop inline nav */}
            {data.wizardComplete && (
              <nav className="hidden lg:flex items-center gap-1">
                {(["home", "plano", "historico", "perfil"] as NavSection[]).map(s => (
                  <button
                    key={s}
                    onClick={() => { setNavSection(s); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      navSection === s ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {s === "home" ? "Início" : s === "plano" ? "Plano" : s === "historico" ? "Histórico" : "Perfil"}
                  </button>
                ))}
              </nav>
            )}

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium truncate">{user.user_metadata?.full_name || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setNavSection("perfil"); setPerfilSub("dados"); }}>
                  <Settings className="w-4 h-4 mr-2" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {data.wizardComplete && navSection === "home" && (
        <Hero goalLabel={goalLabel} config={data.config} contributorCount={data.config.contributors.length} />
      )}

      <main className="px-4 sm:px-6 lg:px-8 py-5 max-w-lg sm:max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto">
        {renderContent()}
      </main>

      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />

      {data.wizardComplete && (
        <div className="lg:hidden">
          <BottomNav active={navSection} onChange={(s) => { setNavSection(s); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </div>
      )}

      <QuickDeposit
        open={showQuickDeposit}
        onOpenChange={setShowQuickDeposit}
        config={data.config}
        monthRecords={data.monthRecords}
        onUpdateMonth={updateMonthRecord}
        onToggleCompleted={toggleMonthCompleted}
      />

      <ImportDialog
        open={showImportDialog}
        onOpenChange={(open) => { setShowImportDialog(open); if (!open) setImportPreview(null); }}
        preview={importPreview}
        onConfirm={handleConfirmImport}
      />

      <MilestoneAlert
        milestone={newMilestone}
        onDismiss={() => { if (newMilestone) celebrateMilestone(newMilestone); }}
        config={data.config}
      />

      <DataMigrationDialog
        open={showMigrationDialog}
        hasCloudData={cloudHasData}
        onMigrateLocal={handleMigrateLocal}
        onKeepCloud={handleKeepCloud}
        onClose={() => setShowMigrationDialog(false)}
        loading={migrationLoading}
      />
    </div>
  );
};

export default Index;
