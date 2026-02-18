import { useState, useMemo, useRef } from "react";
import { usePlanData } from "@/hooks/usePlanData";
import { Hero } from "@/components/plan/Hero";
import { Wizard } from "@/components/plan/Wizard";
import { HomeDashboard } from "@/components/plan/HomeDashboard";
import { Dashboard } from "@/components/plan/Dashboard";
import { MonthlyTracker } from "@/components/plan/MonthlyTracker";
import { MilestoneAlert } from "@/components/plan/MilestoneAlert";
import { HowToUse } from "@/components/plan/HowToUse";
import { NotificationSettings } from "@/components/plan/NotificationSettings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { generateProjection, getReachedMilestones } from "@/lib/calculator";
import { MILESTONES } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Upload, RotateCcw, Calculator, CalendarCheck, Home } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const {
    data, completeWizard, updateConfig, updateMonthRecord, updateMonthNotes,
    toggleMonthCompleted, generateAutoPlan, resetPlan, exportJSON, importJSON,
    updateNotificationSettings,
  } = usePlanData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dismissedMilestones, setDismissedMilestones] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("home");

  const planned = useMemo(
    () => data.wizardComplete ? generateProjection(data.config, "planned", data.monthRecords, data.startDate) : [],
    [data]
  );
  const reached = useMemo(() => getReachedMilestones(planned, MILESTONES), [planned]);
  const newMilestone = reached.find((m) => !dismissedMilestones.includes(m)) || null;

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
      if (importJSON(result)) {
        toast.success("Plano importado com sucesso!");
      } else {
        toast.error("Arquivo inválido. Verifique o formato JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container flex items-center justify-between h-14 px-4">
          <h1 className="text-sm font-bold text-gradient">Plano do Milhão</h1>
          <div className="flex items-center gap-1">
            {data.wizardComplete && (
              <>
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

      <Hero />

      <main className="container px-4 py-8 max-w-3xl mx-auto">
        {!data.wizardComplete ? (
          <Wizard onComplete={completeWizard} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="w-full grid grid-cols-3 glass-card">
              <TabsTrigger value="home" className="gap-1.5 text-xs sm:text-sm">
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Início</span>
              </TabsTrigger>
              <TabsTrigger value="simulador" className="gap-1.5 text-xs sm:text-sm">
                <Calculator className="w-4 h-4" />
                <span className="hidden sm:inline">Simulador</span>
              </TabsTrigger>
              <TabsTrigger value="plano" className="gap-1.5 text-xs sm:text-sm">
                <CalendarCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Plano</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="home">
              <HomeDashboard
                config={data.config}
                monthRecords={data.monthRecords}
                startDate={data.startDate}
                onNavigateToTracker={() => setActiveTab("plano")}
              />
              <div className="mt-6">
                <NotificationSettings
                  settings={data.notificationSettings}
                  onUpdate={updateNotificationSettings}
                />
              </div>
            </TabsContent>

            <TabsContent value="simulador">
              <Dashboard config={data.config} monthRecords={data.monthRecords} startDate={data.startDate} />
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
          </Tabs>
        )}

        <div className="mt-12">
          <HowToUse />
        </div>
      </main>

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
