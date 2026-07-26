import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Painel MCP substituído por dublê que expõe o callback recebido.
vi.mock("@/components/integrations/McpConnectionPanel", () => ({
  McpConnectionPanel: ({ onSwitchAccount }: { onSwitchAccount: () => void }) => (
    <button type="button" data-testid="switch" onClick={() => onSwitchAccount()}>
      switch
    </button>
  ),
}));

// Demais seções da SettingsHub não interessam para este teste.
vi.mock("@/components/plan/PlanModeSelector", () => ({ PlanModeSelector: () => null }));
vi.mock("@/components/plan/SharePlan", () => ({ SharePlan: () => null }));
vi.mock("@/components/plan/NotificationSettings", () => ({ NotificationSettings: () => null }));
vi.mock("@/components/plan/RestoreBackupButton", () => ({ RestoreBackupButton: () => null }));
vi.mock("@/components/plan/PlanSettingsSection", () => ({ PlanSettingsSection: () => null }));
vi.mock("@/components/plan/FinancialProfileSetup", () => ({ FinancialProfileSetup: () => null }));

import { SettingsHub } from "@/pages/index/SettingsHub";

function fakeConfig() {
  return {
    contributors: [{ name: "Ana", plannedSelic: 0, plannedCDB: 0 }],
    targetAmount: 1_000_000,
    initialAmount: 0,
    years: 20,
  } as unknown as Parameters<typeof SettingsHub>[0]["config"];
}

describe("SettingsHub — troca de conta MCP", () => {
  it("aciona onSwitchAccount específico (não o logout genérico)", () => {
    const onSignOut = vi.fn();
    const onSwitchAccount = vi.fn();
    render(
      <MemoryRouter>
        <SettingsHub
          appData={{ primaryProfile: {}, mode: "individual" } as never}
          config={fakeConfig()}
          monthRecords={[]}
          startDate={"2025-01"}
          financialProfile={undefined}
          notificationSettings={undefined as never}
          onUpdateNotificationSettings={vi.fn()}
          planActions={{
            setMode: vi.fn(),
            addPartner: vi.fn(),
            removePartner: vi.fn(),
            updatePrimaryProfile: vi.fn(),
            updatePartnerProfile: vi.fn(),
          }}
          onSaveFinancialProfile={vi.fn()}
          planSettingsInitial={{
            goalAmount: 1_000_000,
            initialAmount: 0,
            monthlyContribution: 0,
            goalYears: 20,
            goalPurpose: "liberdade-financeira",
          }}
          onSavePlanSettings={vi.fn(async () => {})}
          onExport={vi.fn()}
          onTriggerImport={vi.fn()}
          onSignOut={onSignOut}
          onSwitchAccount={onSwitchAccount}
          onOpenReset={vi.fn()}
        />
      </MemoryRouter>,
    );
    screen.getByTestId("switch").click();
    expect(onSwitchAccount).toHaveBeenCalledTimes(1);
    expect(onSignOut).not.toHaveBeenCalled();
  });
});