import { useState, useMemo, useRef } from "react";
import { usePlanData } from "@/hooks/usePlanData";
import { useAppData } from "@/hooks/useAppData";
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
import { generateProjection, getReachedMilestones } from "@/lib/calculator";
import { MILESTONES, EMOTIONAL_GOAL_LABELS } from "@/lib/types";
import { parseImportJSON, saveBackup, ImportPreview } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Download, Upload, RotateCcw, Settings, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

// Sub-nav definitions — shorter labels, better mobile fit
const PLANO_SUBS = [
  { id: "aportes", label: "Aportes", icon: "💰" },
  { id: "simulador", label: "Simular", icon: "📊" },
  { id: "diagnostico", label: "Saúde", icon: "🏥" },
  { id: "jornada", label: "Jornada", icon: "🗺️" },
  { id: "comportamento", label: "Hábitos", icon: "🧠" },
  { id: "patrimonio", label: "Patrimônio", icon: "💎" },
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
    appData, addIncome, updateIncome, deleteIncome,
    addExpense, updateExpense, deleteExpense, duplicateExpense, markExpensePaid, convertToRecurring,
    addDebt, updateDebt, deleteDebt,
  } = useAppData();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dismissedMilestones, setDismissedMilestones] = useState<number[]>([]);
  const [showQuickDeposit, setShowQuickDeposit] = useState(false);
  const [showFinancialSetup, setShowFinancialSetup] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Navigation state — 4 tabs
  const [navSection, setNavSection] = useState<NavSection>("home");
  const [planoSub, setPlanoSub] = useState("aportes");
  const [historicoSub, setHistoricoSub] = useState("tracker");
  const [perfilSub, setPerfilSub] = useState("aprender");

  const planned = useMemo(
    () => data.wizardComplete ? generateProjection(data.config, "planned", data.monthRecords, data.startDate) : [],
    [data]
  );
  const reached = useMemo(() => getReachedMilestones(planned, MILESTONES), [planned]);
  // Show only the highest reached milestone, auto-dismiss all lower ones
  const highestReached = reached.length > 0 ? Math.max(...reached) : null;
  const newMilestone = highestReached && !dismissedMilestones.includes(highestReached) ? highestReached : null;

  const goalLabel = data.emotionalGoal
    ? data.emotionalGoal === "outro" ? (data.emotionalGoalCustom || null) : EMOTIONAL_GOAL_LABELS[data.emotionalGoal]
    : null;

  // Navigate to specific sub-tab (used from home shortcuts)
  const handleNavigateToTab = (tab: string) => {
    const planoTabs = ["aportes", "simulador", "diagnostico", "jornada", "comportamento", "patrimonio"];
    const historicoTabs = ["tracker", "gastos", "renda", "dividas"];
    const perfilTabs = ["aprender", "glossario", "armadilhas", "investir", "compartilhar", "ajuda", "dados"];

    if (planoTabs.includes(tab)) {
      setNavSection("plano");
      setPlanoSub(tab);
    } else if (historicoTabs.includes(tab)) {
      setNavSection("historico");
      setHistoricoSub(tab);
    } else if (perfilTabs.includes(tab)) {
      setNavSection("perfil");
      setPerfilSub(tab);
    } else {
      setNavSection("home");
    }
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
          if (!data.financialProfile) {
            setShowFinancialSetup(true);
          }
        }} />
      );
    }

    switch (navSection) {
      case "home":
        return (
          <UnifiedHome
            appData={appData}
            config={data.config}
            monthRecords={data.monthRecords}
            startDate={data.startDate}
            onNavigateToTab={handleNavigateToTab}
            onOpenQuickDeposit={() => setShowQuickDeposit(true)}
          />
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
              <AdvancedSimulator appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
            )}
            {planoSub === "diagnostico" && (
              <FinancialDiagnostic appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
            )}
            {planoSub === "jornada" && (
              <JourneyPhases appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
            )}
            {planoSub === "comportamento" && (
              <BehavioralPanel appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
            )}
            {planoSub === "patrimonio" && (
              <WealthDistribution appData={appData} config={data.config} />
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
                <Button variant="outline" className="w-full justify-start h-12 rounded-xl text-destructive hover:text-destructive"
                  onClick={() => { if (confirm("Tem certeza? Essa ação não pode ser desfeita.")) resetPlan(); }}>
                  <RotateCcw className="w-4 h-4 mr-2.5" /> Resetar plano
                </Button>
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
        onDismiss={() => { if (newMilestone) setDismissedMilestones((prev) => [...prev, newMilestone]); }}
      />
    </div>
  );
};

export default Index;
