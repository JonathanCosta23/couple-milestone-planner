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
import { Download, Upload, RotateCcw, Settings } from "lucide-react";
import { toast } from "sonner";

// Sub-nav definitions per section
const FINANCAS_SUBS = [
  { id: "gastos", label: "Gastos", icon: "💰" },
  { id: "renda", label: "Renda", icon: "💵" },
  { id: "dividas", label: "Dívidas", icon: "📋" },
  { id: "plano", label: "Aportes", icon: "📅" },
];

const INTELIGENCIA_SUBS = [
  { id: "diagnostico", label: "Diagnóstico", icon: "📊" },
  { id: "jornada", label: "Jornada", icon: "🗺️" },
  { id: "comportamento", label: "Hábitos", icon: "🧠" },
  { id: "simulador", label: "Simulador", icon: "🔬" },
  { id: "patrimonio", label: "Patrimônio", icon: "💎" },
];

const APRENDER_SUBS = [
  { id: "aulas", label: "Aulas", icon: "📚" },
  { id: "glossario", label: "Glossário", icon: "📖" },
  { id: "investir", label: "Investir", icon: "📈" },
  { id: "armadilhas", label: "Armadilhas", icon: "🛡️" },
];

const CONFIG_SUBS = [
  { id: "compartilhar", label: "Compartilhar", icon: "📤" },
  { id: "notificacoes", label: "Alertas", icon: "🔔" },
  { id: "ajuda", label: "Como usar", icon: "❓" },
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

  // Navigation state
  const [navSection, setNavSection] = useState<NavSection>("home");
  const [financasSub, setFinancasSub] = useState("gastos");
  const [inteligenciaSub, setInteligenciaSub] = useState("diagnostico");
  const [aprenderSub, setAprenderSub] = useState("aulas");
  const [configSub, setConfigSub] = useState("compartilhar");

  const planned = useMemo(
    () => data.wizardComplete ? generateProjection(data.config, "planned", data.monthRecords, data.startDate) : [],
    [data]
  );
  const reached = useMemo(() => getReachedMilestones(planned, MILESTONES), [planned]);
  const newMilestone = reached.find((m) => !dismissedMilestones.includes(m)) || null;

  const goalLabel = data.emotionalGoal
    ? data.emotionalGoal === "outro" ? (data.emotionalGoalCustom || null) : EMOTIONAL_GOAL_LABELS[data.emotionalGoal]
    : null;

  // Navigate to specific tab (used from home shortcuts)
  const handleNavigateToTab = (tab: string) => {
    // Map old tab names to new section+sub
    const financasTabs = ["gastos", "renda", "dividas", "plano"];
    const inteligenciaTabs = ["diagnostico", "jornada", "comportamento", "simulador", "patrimonio"];
    const aprenderTabs = ["aulas", "glossario", "investir", "armadilhas"];

    if (financasTabs.includes(tab)) {
      setNavSection("financas");
      setFinancasSub(tab);
    } else if (inteligenciaTabs.includes(tab)) {
      setNavSection("inteligencia");
      setInteligenciaSub(tab);
    } else if (aprenderTabs.includes(tab)) {
      setNavSection("aprender");
      setAprenderSub(tab);
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
    toast.success("Plano exportado com sucesso!");
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
      toast.success("Plano importado com sucesso!");
    }
    setShowImportDialog(false);
    setImportPreview(null);
  };

  if (!data.onboardingComplete) {
    return <Onboarding onComplete={completeOnboarding} />;
  }

  if (showFinancialSetup) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
          <div className="container flex items-center justify-between h-14 px-4">
            <h1 className="text-sm font-bold text-gradient">Plano do Milhão</h1>
            <ThemeToggle />
          </div>
        </header>
        <main className="container px-4 py-8 max-w-3xl mx-auto">
          <FinancialProfileSetup
            config={data.config}
            profile={data.financialProfile}
            emotionalGoal={data.emotionalGoal}
            emotionalGoalCustom={data.emotionalGoalCustom}
            onSave={(profile, goal, custom) => {
              updateFinancialProfile(profile, goal, custom);
              setShowFinancialSetup(false);
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

      case "financas":
        return (
          <div className="space-y-4">
            <SubNav items={FINANCAS_SUBS} active={financasSub} onChange={setFinancasSub} />
            {financasSub === "gastos" && (
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
            {financasSub === "renda" && (
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
            {financasSub === "dividas" && (
              <DebtModule
                appData={appData}
                config={data.config}
                onAddDebt={addDebt}
                onUpdateDebt={updateDebt}
                onDeleteDebt={deleteDebt}
              />
            )}
            {financasSub === "plano" && (
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
          </div>
        );

      case "inteligencia":
        return (
          <div className="space-y-4">
            <SubNav items={INTELIGENCIA_SUBS} active={inteligenciaSub} onChange={setInteligenciaSub} />
            {inteligenciaSub === "diagnostico" && (
              <FinancialDiagnostic
                appData={appData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
              />
            )}
            {inteligenciaSub === "jornada" && (
              <JourneyPhases
                appData={appData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
              />
            )}
            {inteligenciaSub === "comportamento" && (
              <BehavioralPanel
                appData={appData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
              />
            )}
            {inteligenciaSub === "simulador" && (
              <div className="space-y-6">
                <AdvancedSimulator
                  config={data.config}
                  monthRecords={data.monthRecords}
                  startDate={data.startDate}
                />
                <Dashboard config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
              </div>
            )}
            {inteligenciaSub === "patrimonio" && (
              <WealthDistribution appData={appData} config={data.config} />
            )}
          </div>
        );

      case "aprender":
        return (
          <div className="space-y-4">
            <SubNav items={APRENDER_SUBS} active={aprenderSub} onChange={setAprenderSub} />
            {aprenderSub === "aulas" && <MiniLessons />}
            {aprenderSub === "glossario" && <FinancialGlossary />}
            {aprenderSub === "investir" && <InvestmentGuide />}
            {aprenderSub === "armadilhas" && <TrapDetector />}
          </div>
        );

      case "config":
        return (
          <div className="space-y-4">
            <SubNav items={CONFIG_SUBS} active={configSub} onChange={setConfigSub} />
            {configSub === "compartilhar" && (
              <SharePlan
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
                profile={data.financialProfile}
                onExportJSON={handleExportJSON}
                onImportClick={() => fileInputRef.current?.click()}
              />
            )}
            {configSub === "notificacoes" && (
              <NotificationSettings
                settings={data.notificationSettings}
                onUpdate={updateNotificationSettings}
              />
            )}
            {configSub === "ajuda" && <HowToUse />}
            {configSub === "dados" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  <Button variant="outline" className="justify-start h-11" onClick={() => setShowFinancialSetup(true)}>
                    <Settings className="w-4 h-4 mr-2" /> Perfil financeiro
                  </Button>
                  <Button variant="outline" className="justify-start h-11" onClick={handleExportJSON}>
                    <Download className="w-4 h-4 mr-2" /> Exportar dados (JSON)
                  </Button>
                  <Button variant="outline" className="justify-start h-11" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> Importar dados
                  </Button>
                  <Button variant="outline" className="justify-start h-11 text-destructive hover:text-destructive" onClick={() => { if (confirm("Tem certeza que deseja resetar todo o plano? Essa ação não pode ser desfeita.")) resetPlan(); }}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Resetar plano
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
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container flex items-center justify-between h-12 px-4">
          <h1 className="text-sm font-bold text-gradient">Plano do Milhão</h1>
          <ThemeToggle />
        </div>
      </header>

      {data.wizardComplete && navSection === "home" && (
        <Hero goalLabel={goalLabel} config={data.config} contributorCount={data.config.contributors.length} />
      )}

      <main className="container px-4 py-6 max-w-3xl mx-auto">
        {renderContent()}
      </main>

      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />

      {data.wizardComplete && (
        <BottomNav active={navSection} onChange={(s) => { setNavSection(s); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
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
        onDismiss={(m) => setDismissedMilestones((prev) => [...prev, m])}
      />
    </div>
  );
};

export default Index;
