import { useState, useMemo, useRef } from "react";
import { usePlanData } from "@/hooks/usePlanData";
import { useAppData } from "@/hooks/useAppData";
import { Hero } from "@/components/plan/Hero";
import { Onboarding } from "@/components/plan/Onboarding";
import { FinancialProfileSetup } from "@/components/plan/FinancialProfileSetup";
import { Wizard } from "@/components/plan/Wizard";
import { StrategicHome } from "@/components/plan/StrategicHome";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { generateProjection, getReachedMilestones } from "@/lib/calculator";
import { MILESTONES, EMOTIONAL_GOAL_LABELS } from "@/lib/types";
import { parseImportJSON, saveBackup, ImportPreview } from "@/lib/storage";
import { exportUnifiedData, importUnifiedData } from "@/lib/unifiedExport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Download, Upload, RotateCcw, Home, Activity,
  Calculator, DollarSign, CalendarCheck, Settings,
  Brain, ShieldAlert, GraduationCap, Wallet, CreditCard,
  BookOpen, Map, PieChart, Compass,
} from "lucide-react";
import { toast } from "sonner";

type SubTab =
  | "overview" | "diagnostico" | "jornada" | "patrimonio" | "estrategia"
  | "gastos" | "dividas" | "renda"
  | "simulador" | "plano" | "dashboard"
  | "comportamento" | "armadilhas" | "aprender" | "glossario" | "investir";

const Index = () => {
  const {
    data, completeWizard, updateConfig, updateMonthRecord, updateMonthNotes,
    toggleMonthCompleted, generateAutoPlan, generateNextYear, resetPlan, exportJSON, importJSON,
    updateNotificationSettings, updateFinancialProfile, completeOnboarding,
  } = usePlanData();

  const {
    appData, addIncome, updateIncome, deleteIncome,
    addExpense, updateExpense, deleteExpense, duplicateExpense, markExpensePaid, convertToRecurring,
    addDebt, updateDebt, deleteDebt, setAppData,
  } = useAppData();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dismissedMilestones, setDismissedMilestones] = useState<number[]>([]);
  const [mainTab, setMainTab] = useState("inicio");
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [showQuickDeposit, setShowQuickDeposit] = useState(false);
  const [showFinancialSetup, setShowFinancialSetup] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const planned = useMemo(
    () => data.wizardComplete ? generateProjection(data.config, "planned", data.monthRecords, data.startDate) : [],
    [data]
  );
  const reached = useMemo(() => getReachedMilestones(planned, MILESTONES), [planned]);
  const newMilestone = reached.find((m) => !dismissedMilestones.includes(m)) || null;

  const goalLabel = data.emotionalGoal
    ? data.emotionalGoal === "outro" ? (data.emotionalGoalCustom || null) : EMOTIONAL_GOAL_LABELS[data.emotionalGoal]
    : null;

  const handleExportJSON = () => {
    const json = exportUnifiedData(data, appData);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plano-do-milhao-completo.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Plano completo exportado com sucesso!");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      // Try unified import first
      const unified = importUnifiedData(result);
      if (unified) {
        saveBackup(data);
        importJSON(JSON.stringify(unified.planData));
        setAppData(unified.appData);
        toast.success("Plano completo importado! Backup salvo.");
        return;
      }
      // Fallback to legacy import
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
      toast.success("Plano importado com sucesso! Backup salvo automaticamente.");
    }
    setShowImportDialog(false);
    setImportPreview(null);
  };

  // Navigate to a specific section
  const navigateToTab = (tab: string) => {
    const sectionMap: Record<string, { main: string; sub: SubTab }> = {
      home: { main: "inicio", sub: "overview" },
      diagnostico: { main: "inicio", sub: "diagnostico" },
      jornada: { main: "inicio", sub: "jornada" },
      patrimonio: { main: "inicio", sub: "patrimonio" },
      estrategia: { main: "inicio", sub: "estrategia" },
      gastos: { main: "financas", sub: "gastos" },
      dividas: { main: "financas", sub: "dividas" },
      renda: { main: "financas", sub: "renda" },
      simulador: { main: "plano", sub: "simulador" },
      plano: { main: "plano", sub: "plano" },
      dashboard: { main: "plano", sub: "dashboard" },
      comportamento: { main: "educacao", sub: "comportamento" },
      armadilhas: { main: "educacao", sub: "armadilhas" },
      aprender: { main: "educacao", sub: "aprender" },
      glossario: { main: "educacao", sub: "glossario" },
      investir: { main: "educacao", sub: "investir" },
    };
    const target = sectionMap[tab];
    if (target) {
      setMainTab(target.main);
      setSubTab(target.sub);
    }
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container flex items-center justify-between h-14 px-4">
          <h1 className="text-sm font-bold text-gradient">Plano do Milhão</h1>
          <div className="flex items-center gap-1">
            {data.wizardComplete && (
              <>
                <Button variant="ghost" size="icon" onClick={() => setShowFinancialSetup(true)} title="Perfil financeiro">
                  <Settings className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleExportJSON} title="Exportar JSON">
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="Importar JSON">
                  <Upload className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm("Resetar todo o plano?")) resetPlan(); }} title="Resetar">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </>
            )}
            <ThemeToggle />
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          </div>
        </div>
      </header>

      <Hero goalLabel={goalLabel} />

      <main className="container px-4 py-8 max-w-3xl mx-auto">
        {!data.wizardComplete ? (
          <Wizard onComplete={(config) => {
            completeWizard(config);
            if (!data.financialProfile) {
              setShowFinancialSetup(true);
            }
          }} />
        ) : (
          <div className="space-y-6">
            {/* Main Navigation — 5 tabs, single row */}
            <TabsList className="w-full grid grid-cols-5 glass-card h-11">
              <TabButton active={mainTab === "inicio"} onClick={() => { setMainTab("inicio"); setSubTab("overview"); }} icon={Home} label="Início" />
              <TabButton active={mainTab === "financas"} onClick={() => { setMainTab("financas"); setSubTab("gastos"); }} icon={Wallet} label="Finanças" />
              <TabButton active={mainTab === "plano"} onClick={() => { setMainTab("plano"); setSubTab("plano"); }} icon={CalendarCheck} label="Plano" />
              <TabButton active={mainTab === "simulador"} onClick={() => { setMainTab("simulador"); setSubTab("simulador"); }} icon={Calculator} label="Simular" />
              <TabButton active={mainTab === "educacao"} onClick={() => { setMainTab("educacao"); setSubTab("aprender"); }} icon={GraduationCap} label="Aprender" />
            </TabsList>

            {/* Sub-navigation per section */}
            {mainTab === "inicio" && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                <SubTabChip active={subTab === "overview"} onClick={() => setSubTab("overview")} label="Visão Geral" />
                <SubTabChip active={subTab === "diagnostico"} onClick={() => setSubTab("diagnostico")} label="Diagnóstico" />
                <SubTabChip active={subTab === "jornada"} onClick={() => setSubTab("jornada")} label="Jornada" />
                <SubTabChip active={subTab === "patrimonio"} onClick={() => setSubTab("patrimonio")} label="Patrimônio" />
                <SubTabChip active={subTab === "estrategia"} onClick={() => setSubTab("estrategia")} label="Estratégia" />
              </div>
            )}
            {mainTab === "financas" && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                <SubTabChip active={subTab === "gastos"} onClick={() => setSubTab("gastos")} label="💸 Gastos" />
                <SubTabChip active={subTab === "dividas"} onClick={() => setSubTab("dividas")} label="📋 Dívidas" />
                <SubTabChip active={subTab === "renda"} onClick={() => setSubTab("renda")} label="💰 Renda" />
              </div>
            )}
            {mainTab === "plano" && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                <SubTabChip active={subTab === "plano"} onClick={() => setSubTab("plano")} label="📅 Aportes" />
                <SubTabChip active={subTab === "dashboard"} onClick={() => setSubTab("dashboard")} label="📊 Dashboard" />
              </div>
            )}
            {mainTab === "educacao" && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                <SubTabChip active={subTab === "aprender"} onClick={() => setSubTab("aprender")} label="📚 Lições" />
                <SubTabChip active={subTab === "investir"} onClick={() => setSubTab("investir")} label="📈 Investir" />
                <SubTabChip active={subTab === "comportamento"} onClick={() => setSubTab("comportamento")} label="🧠 Hábitos" />
                <SubTabChip active={subTab === "armadilhas"} onClick={() => setSubTab("armadilhas")} label="🛡️ Armadilhas" />
                <SubTabChip active={subTab === "glossario"} onClick={() => setSubTab("glossario")} label="📖 Glossário" />
              </div>
            )}

            {/* Content */}
            <div className="min-h-[60vh]">
              {/* INÍCIO */}
              {subTab === "overview" && (
                <div className="space-y-6">
                  <StrategicHome
                    appData={appData}
                    config={data.config}
                    monthRecords={data.monthRecords}
                    startDate={data.startDate}
                    onNavigateToTab={navigateToTab}
                    onOpenQuickDeposit={() => setShowQuickDeposit(true)}
                  />
                  <SharePlan
                    config={data.config}
                    monthRecords={data.monthRecords}
                    startDate={data.startDate}
                    profile={data.financialProfile}
                    onExportJSON={handleExportJSON}
                    onImportClick={() => fileInputRef.current?.click()}
                  />
                  <NotificationSettings
                    settings={data.notificationSettings}
                    onUpdate={updateNotificationSettings}
                  />
                </div>
              )}
              {subTab === "diagnostico" && (
                <FinancialDiagnostic appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
              )}
              {subTab === "jornada" && (
                <JourneyPhases appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
              )}
              {subTab === "patrimonio" && (
                <WealthDistribution appData={appData} config={data.config} />
              )}
              {subTab === "estrategia" && (
                <StrategicHome appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} onNavigateToTab={navigateToTab} onOpenQuickDeposit={() => setShowQuickDeposit(true)} />
              )}

              {/* FINANÇAS */}
              {subTab === "gastos" && (
                <ExpensePanel
                  appData={appData} config={data.config}
                  onAddExpense={addExpense} onUpdateExpense={updateExpense} onDeleteExpense={deleteExpense}
                  onDuplicateExpense={duplicateExpense} onMarkExpensePaid={markExpensePaid} onConvertToRecurring={convertToRecurring}
                />
              )}
              {subTab === "dividas" && (
                <DebtModule appData={appData} config={data.config} onAddDebt={addDebt} onUpdateDebt={updateDebt} onDeleteDebt={deleteDebt} />
              )}
              {subTab === "renda" && (
                <IncomePanel appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate}
                  onAddIncome={addIncome} onUpdateIncome={updateIncome} onDeleteIncome={deleteIncome} />
              )}

              {/* PLANO */}
              {subTab === "plano" && (
                <MonthlyTracker
                  config={data.config} monthRecords={data.monthRecords} startDate={data.startDate}
                  onUpdateMonth={updateMonthRecord} onUpdateNotes={updateMonthNotes}
                  onToggleCompleted={toggleMonthCompleted} onGenerateAutoPlan={generateAutoPlan}
                />
              )}
              {subTab === "dashboard" && (
                <Dashboard config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
              )}

              {/* SIMULADOR */}
              {mainTab === "simulador" && (
                <AdvancedSimulator config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
              )}

              {/* EDUCAÇÃO */}
              {subTab === "aprender" && <MiniLessons />}
              {subTab === "investir" && <InvestmentGuide />}
              {subTab === "comportamento" && (
                <BehavioralPanel appData={appData} config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
              )}
              {subTab === "armadilhas" && <TrapDetector />}
              {subTab === "glossario" && <FinancialGlossary />}
            </div>
          </div>
        )}

        {data.wizardComplete && (
          <div className="mt-12">
            <HowToUse />
          </div>
        )}
      </main>

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
        onDismiss={() => { if (newMilestone) setDismissedMilestones([...dismissedMilestones, newMilestone]); }}
      />
    </div>
  );
};

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-md text-[10px] sm:text-xs font-medium transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

function SubTabChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export default Index;
