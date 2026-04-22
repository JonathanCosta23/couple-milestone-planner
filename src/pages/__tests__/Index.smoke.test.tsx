/**
 * Smoke test do shell: garante que <Index /> monta sem crash quando o
 * usuário não está autenticado (caminho mais barato e seguro).
 * Mockamos os hooks pesados para evitar chamadas reais ao Supabase.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }),
}));

vi.mock("@/hooks/usePlan", () => ({
  usePlan: () => ({
    plan: null, members: [], primaryMember: null, partnerMember: null,
    refresh: vi.fn(), isCouple: false, primaryName: "", partnerName: "",
  }),
}));

vi.mock("@/hooks/useCloudSync", () => ({
  useCloudSync: () => ({
    loadFromCloud: vi.fn().mockResolvedValue(null),
    saveToCloud: vi.fn(),
    hasLocalData: () => false,
  }),
}));

vi.mock("@/hooks/useAssetWriter", () => ({
  useAssetWriter: () => ({ listAssets: vi.fn().mockResolvedValue({ data: [] }) }),
  assetRowToInvestment: (r: unknown) => r,
}));

vi.mock("@/hooks/useDataHydration", () => ({
  useDataHydration: () => ({ hydrated: true, counts: { incomes: 0, expenses: 0, debts: 0 }, forceRefresh: vi.fn() }),
}));

vi.mock("@/components/auth/AuthPage", () => ({
  AuthPage: () => <div data-testid="auth-page">Entrar</div>,
}));

import Index from "@/pages/Index";

describe("Index — smoke (shell autenticado)", () => {
  it("renderiza AuthPage quando não há usuário, sem crash", () => {
    render(<Index />);
    expect(screen.getByTestId("auth-page")).toBeInTheDocument();
  });
});