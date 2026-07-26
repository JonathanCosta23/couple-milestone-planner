/**
 * SettingsHub — bloco "Mais → Configurações" da Home.
 *
 * Extraído de `Index.tsx` para reduzir o tamanho do shell e manter a
 * organização visual da seção (Conta, Dados, Notificações, Sessão e Zona
 * de risco). Sem alteração de comportamento.
 */
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, RotateCcw, Settings, ArrowLeft, ChevronDown } from "lucide-react";
import { PlanModeSelector } from "@/components/plan/PlanModeSelector";
import { SharePlan } from "@/components/plan/SharePlan";
import { NotificationSettings } from "@/components/plan/NotificationSettings";
import { RestoreBackupButton } from "@/components/plan/RestoreBackupButton";
import { McpConnectionPanel } from "@/components/integrations/McpConnectionPanel";
import {
  PlanSettingsSection,
  type PlanSettingsInitial,
  type PlanSettingsPatch,
} from "@/components/plan/PlanSettingsSection";
import type { AppData } from "@/lib/models";
import type { PlanConfig, MonthRecord, PlanData, FinancialProfile, EmotionalGoal } from "@/lib/types";

const FinancialProfileSetup = lazy(() =>
  import("@/components/plan/FinancialProfileSetup").then((m) => ({ default: m.FinancialProfileSetup }))
);

type NotificationSettingsType = PlanData["notificationSettings"];

export interface SettingsHubProps {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  financialProfile: FinancialProfile | undefined;
  notificationSettings: NotificationSettingsType;
  onUpdateNotificationSettings: (s: NotificationSettingsType) => void;
  planActions: {
    setMode: (mode: "individual" | "casal") => Promise<void> | void;
    addPartner: (name: string, age: number) => Promise<void> | void;
    removePartner: () => Promise<void> | void;
    updatePrimaryProfile: (patch: Partial<AppData["primaryProfile"]>) => Promise<void> | void;
    updatePartnerProfile: (patch: Partial<NonNullable<AppData["partner"]>["profile"]>) => Promise<void> | void;
  };
  emotionalGoal?: EmotionalGoal;
  emotionalGoalCustom?: string;
  onSaveFinancialProfile: (profile: FinancialProfile, goal: EmotionalGoal, customGoal?: string) => void;
  /** Estado inicial e handler da nova seção "Plano e meta". */
  planSettingsInitial: PlanSettingsInitial;
  onSavePlanSettings: (patch: PlanSettingsPatch) => Promise<void>;
  /** Deep-link opcional (ex.: "plano-meta") vindo de useAppNavigation. */
  settingsFocus?: string | null;
  onSettingsFocusHandled?: () => void;
  onExport: () => void;
  onTriggerImport: () => void;
  onSignOut: () => void;
  onOpenReset: () => void;
}

export function SettingsHub({
  appData, config, monthRecords, startDate, financialProfile,
  notificationSettings, onUpdateNotificationSettings,
  planActions, emotionalGoal, emotionalGoalCustom, onSaveFinancialProfile,
  planSettingsInitial, onSavePlanSettings,
  settingsFocus, onSettingsFocusHandled,
  onExport, onTriggerImport, onSignOut, onOpenReset,
}: SettingsHubProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Conta e plano
        </h3>
        <PlanModeSelector
          appData={appData}
          onSetMode={planActions.setMode}
          onAddPartner={planActions.addPartner}
          onRemovePartner={planActions.removePartner}
          onUpdatePrimaryProfile={planActions.updatePrimaryProfile}
          onUpdatePartnerProfile={planActions.updatePartnerProfile}
        />
        <PlanSettingsSection
          initial={planSettingsInitial}
          onSave={onSavePlanSettings}
          autoExpand={settingsFocus === "plano-meta"}
          onAutoExpandConsumed={onSettingsFocusHandled}
        />
        <Button
          variant="outline"
          className="w-full justify-between h-12 rounded-xl"
          onClick={() => setProfileOpen((v) => !v)}
          aria-expanded={profileOpen}
        >
          <span className="flex items-center">
            <Settings className="w-4 h-4 mr-2.5" /> Perfil financeiro
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
        </Button>
        {profileOpen && (
          <div className="pt-2">
            <Suspense fallback={<div className="text-sm text-muted-foreground px-1 py-4">Carregando…</div>}>
              <FinancialProfileSetup
                config={config}
                profile={financialProfile}
                emotionalGoal={emotionalGoal}
                emotionalGoalCustom={emotionalGoalCustom}
                onSave={(profile, goal, custom) => {
                  onSaveFinancialProfile(profile, goal, custom);
                  setProfileOpen(false);
                }}
                onSkip={() => setProfileOpen(false)}
              />
            </Suspense>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Dados e backup
        </h3>
        <SharePlan
          config={config}
          monthRecords={monthRecords}
          startDate={startDate}
          profile={financialProfile}
          onExportJSON={onExport}
          onImportClick={onTriggerImport}
        />
        <Button variant="outline" className="w-full justify-start h-12 rounded-xl" onClick={onExport}>
          <Download className="w-4 h-4 mr-2.5" /> Backup e exportação
        </Button>
        <Button variant="outline" className="w-full justify-start h-12 rounded-xl" onClick={onTriggerImport}>
          <Upload className="w-4 h-4 mr-2.5" /> Importar dados
        </Button>
        <RestoreBackupButton />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Notificações
        </h3>
        <NotificationSettings settings={notificationSettings} onUpdate={onUpdateNotificationSettings} />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Integrações
        </h3>
        <McpConnectionPanel onSignOut={onSignOut} />
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Sessão
        </h3>
        <Button variant="outline" className="w-full justify-start h-12 rounded-xl text-muted-foreground" onClick={onSignOut}>
          <ArrowLeft className="w-4 h-4 mr-2.5" /> Sair da conta
        </Button>
      </section>

      <section className="space-y-2 pt-2 border-t border-destructive/20">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive px-1">
          Zona de risco
        </h3>
        <p className="text-xs text-muted-foreground px-1">
          Ações destrutivas. Não podem ser desfeitas.
        </p>
        <Button
          variant="outline"
          className="w-full justify-start h-12 rounded-xl border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/5"
          onClick={onOpenReset}
        >
          <RotateCcw className="w-4 h-4 mr-2.5" /> Resetar plano
        </Button>
      </section>
    </div>
  );
}

// Re-export usado por consumidores que ainda precisam dos tipos.
export type { SettingsHubProps as _SettingsHubProps };
