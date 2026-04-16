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
import { AccountPrompt } from "@/components/auth/AccountPrompt";
import { PlanModeSelector } from "@/components/plan/PlanModeSelector";

import { MILESTONES, EMOTIONAL_GOAL_LABELS } from "@/lib/types";
import { parseImportJSON, saveBackup, ImportPreview } from "@/lib/storage";
import { loadAppData, saveAppData } from "@/lib/appStorage";
import { loadPlanData, savePlanData } from "@/lib/storage";
import { useFinancialCore } from "@/hooks/useFinancialCore";
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { celebrated: dismissedMilestones, celebrate: celebrateMilestone } = useCelebratedMilestones(user?.id);
  const [showQuickDeposit, setShowQuickDeposit] = useState(false);
  const [showFinancialSetup, setShowFinancialSetup] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [cloudHasData, setCloudHasData] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [accountPromptDismissed, setAccountPromptDismissed] = useState(() => {
    return localStorage.getItem("plano-account-prompt-dismissed") === "true";
  });
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
  });

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

  const handleDismissPrompt = () => {
    setAccountPromptDismissed(true);
    localStorage.setItem("plano-account-prompt-dismissed", "true");
  };

  // Show account prompt when user has meaningful data but no account
  const shouldShowAccountPrompt = !user && !authLoading && !accountPromptDismissed && data.wizardComplete &&
    (data.monthRecords.length > 0 || appData.incomes.length > 0 || appData.expenses.length > 0);

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

  // ── Auth page ──
  if (showAuth) {
    return <AuthPage onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} showBackButton />;
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
      return (
        <Wizard onComplete={(config) => {
          completeWizard(config);
          // Sync primary profile name from wizard
          const primary = config.contributors[0];
          if (primary?.name) {
            updatePrimaryProfile({ name: primary.name });
          }
          // Sync couple mode + partner from wizard
          const partner = config.contributors[1];
          if (partner?.name) {
            if (!appData.partner || appData.partner.removedAt) {
              addPartner(partner.name);
            } else {
              updatePartnerProfile({ name: partner.name });
              setMode("couple");
            }
          } else if (appData.partner && !appData.partner.removedAt) {
            // Wizard says solo — soft-remove partner
            setMode("solo");
          }
          if (!data.financialProfile) {
            setShowFinancialSetup(true);
          }
        }} />
      );
    }

    switch (navSection) {
      case "home":
        return (
          <div className="space-y-4">
            {shouldShowAccountPrompt && (
              <AccountPrompt onCreateAccount={() => setShowAuth(true)} onDismiss={handleDismissPrompt} />
            )}
            <UnifiedHome
              appData={appData}
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
              <AdvancedSimulator appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "estrutura" && (
              <PatrimonialArchitecture appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "projecao" && (
              <ProjectionRealistic appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "diagnostico" && (
              <FinancialDiagnostic appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "jornada" && (
              <JourneyPhases appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "comportamento" && (
              <BehavioralPanel appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} core={core} />
            )}
            {planoSub === "patrimonio" && (
              <WealthDistribution appData={appData} config={data.config} core={core} onAddInvestment={addInvestment} onUpdateInvestment={updateInvestment} onDeleteInvestment={deleteInvestment} />
            )}
            {planoSub === "concentracao" && (
              <ConcentrationMap appData={appData} config={data.config} core={core} onNavigateToTab={handleNavigateToTab} />
            )}
            {planoSub === "governanca" && (
              <CoupleGovernance appData={appData} config={data.config} core={core} onNavigateToTab={handleNavigateToTab} />
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
                appData={appData}
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
                appData={appData}
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
                appData={appData}
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
                  appData={appData}
                  onSetMode={setMode}
                  onAddPartner={addPartner}
                  onRemovePartner={removePartner}
                  onUpdatePrimaryProfile={updatePrimaryProfile}
                  onUpdatePartnerProfile={updatePartnerProfile}
                />
                <div className="space-y-2">
                {!user && (
                  <Button variant="default" className="w-full justify-start h-12 rounded-xl" onClick={() => setShowAuth(true)}>
                    <User className="w-4 h-4 mr-2.5" /> Criar conta / Entrar
                  </Button>
                )}
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
                {user && (
                  <Button variant="outline" className="w-full justify-start h-12 rounded-xl text-muted-foreground" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2.5" /> Sair da conta
                  </Button>
                )}
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
            {user ? (
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
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="text-xs text-primary font-medium hover:underline hidden sm:block"
              >
                Entrar
              </button>
            )}

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
