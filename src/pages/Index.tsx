import { useState, useMemo, useRef } from "react";
import { usePlanData } from "@/hooks/usePlanData";
import { useAppData } from "@/hooks/useAppData";
import { Hero } from "@/components/plan/Hero";
import { Onboarding } from "@/components/plan/Onboarding";
import { FinancialProfileSetup } from "@/components/plan/FinancialProfileSetup";
import { Wizard } from "@/components/plan/Wizard";
import { HomeDashboard } from "@/components/plan/HomeDashboard";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Download, Upload, RotateCcw, Home, Activity, Map, BookOpen,
  Calculator, DollarSign, PieChart, CalendarCheck, Settings,
  Brain, ShieldAlert, GraduationCap, Wallet, CreditCard, Compass,
} from "lucide-react";
import { toast } from "sonner";

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
  const [activeTab, setActiveTab] = useState("home");
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
      toast.success("Plano importado com sucesso! Backup salvo automaticamente.");
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            {/* Navigation — 4 rows */}
            <div className="space-y-1.5">
              <TabsList className="w-full grid grid-cols-4 glass-card h-9">
                <TabsTrigger value="home" className="gap-1 text-[10px] sm:text-xs px-1">
                  <Home className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Início</span>
                </TabsTrigger>
                <TabsTrigger value="gastos" className="gap-1 text-[10px] sm:text-xs px-1">
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Gastos</span>
                </TabsTrigger>
                <TabsTrigger value="dividas" className="gap-1 text-[10px] sm:text-xs px-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dívidas</span>
                </TabsTrigger>
                <TabsTrigger value="renda" className="gap-1 text-[10px] sm:text-xs px-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Renda</span>
                </TabsTrigger>
              </TabsList>
              <TabsList className="w-full grid grid-cols-4 glass-card h-9">
                <TabsTrigger value="diagnostico" className="gap-1 text-[10px] sm:text-xs px-1">
                  <Activity className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Diagnóstico</span>
                </TabsTrigger>
                <TabsTrigger value="jornada" className="gap-1 text-[10px] sm:text-xs px-1">
                  <Map className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Jornada</span>
                </TabsTrigger>
                <TabsTrigger value="simulador" className="gap-1 text-[10px] sm:text-xs px-1">
                  <Calculator className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Simulador</span>
                </TabsTrigger>
                <TabsTrigger value="patrimonio" className="gap-1 text-[10px] sm:text-xs px-1">
                  <PieChart className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Patrimônio</span>
                </TabsTrigger>
              </TabsList>
              <TabsList className="w-full grid grid-cols-4 glass-card h-9">
                <TabsTrigger value="investir" className="gap-1 text-[10px] sm:text-xs px-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Investir</span>
                </TabsTrigger>
                <TabsTrigger value="estrategia" className="gap-1 text-[10px] sm:text-xs px-1">
                  <Compass className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Estratégia</span>
                </TabsTrigger>
                <TabsTrigger value="comportamento" className="gap-1 text-[10px] sm:text-xs px-1">
                  <Brain className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hábitos</span>
                </TabsTrigger>
                <TabsTrigger value="plano" className="gap-1 text-[10px] sm:text-xs px-1">
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Plano</span>
                </TabsTrigger>
              </TabsList>
              <TabsList className="w-full grid grid-cols-3 glass-card h-9">
                <TabsTrigger value="armadilhas" className="gap-1 text-[10px] sm:text-xs px-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Armadilhas</span>
                </TabsTrigger>
                <TabsTrigger value="aprender" className="gap-1 text-[10px] sm:text-xs px-1">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Aprender</span>
                </TabsTrigger>
                <TabsTrigger value="glossario" className="gap-1 text-[10px] sm:text-xs px-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Glossário</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="home">
              <HomeDashboard
                appData={appData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
                onNavigateToTab={setActiveTab}
                onOpenQuickDeposit={() => setShowQuickDeposit(true)}
              />
              <div className="mt-6 space-y-4">
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
            </TabsContent>

            <TabsContent value="gastos">
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
            </TabsContent>

            <TabsContent value="dividas">
              <DebtModule
                appData={appData}
                config={data.config}
                onAddDebt={addDebt}
                onUpdateDebt={updateDebt}
                onDeleteDebt={deleteDebt}
              />
            </TabsContent>

            <TabsContent value="renda">
              <IncomePanel
                appData={appData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
                onAddIncome={addIncome}
                onUpdateIncome={updateIncome}
                onDeleteIncome={deleteIncome}
              />
            </TabsContent>

            <TabsContent value="diagnostico">
              <FinancialDiagnostic
                appData={appData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
              />
            </TabsContent>

            <TabsContent value="jornada">
              <JourneyPhases
                appData={appData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
              />
            </TabsContent>

            <TabsContent value="simulador" className="space-y-6">
              <AdvancedSimulator
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
              />
              <Dashboard config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
            </TabsContent>

            <TabsContent value="patrimonio">
              <WealthDistribution appData={appData} config={data.config} />
            </TabsContent>

            <TabsContent value="investir">
              <InvestmentGuide />
            </TabsContent>

            <TabsContent value="estrategia">
              <StrategicHome
                appData={appData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
                onNavigateToTab={setActiveTab}
                onOpenQuickDeposit={() => setShowQuickDeposit(true)}
              />
            </TabsContent>

            <TabsContent value="comportamento">
              <BehavioralPanel
                appData={appData}
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
              />
            </TabsContent>

            <TabsContent value="plano">
              <MonthlyTracker
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
                onUpdateMonth={updateMonthRecord}
                onUpdateNotes={updateMonthNotes}
                onToggleCompleted={toggleMonthCompleted}
                onGenerateAutoPlan={generateAutoPlan}
              />
            </TabsContent>

            <TabsContent value="armadilhas">
              <TrapDetector />
            </TabsContent>

            <TabsContent value="aprender">
              <MiniLessons />
            </TabsContent>

            <TabsContent value="glossario">
              <FinancialGlossary />
            </TabsContent>
          </Tabs>
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
        onDismiss={() => {
          if (newMilestone) setDismissedMilestones((prev) => [...prev, newMilestone]);
        }}
      />
    </div>
  );
};

export default Index;
