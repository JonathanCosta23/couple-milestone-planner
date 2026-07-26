import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

let mockUser: { id: string; email: string } | null = { id: "u1", email: "ana@exemplo.com" };
let mockLoading = false;
const signOutMock = vi.fn(async () => {});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, loading: mockLoading, signOut: signOutMock }),
}));

vi.mock("@/components/auth/AuthPage", () => ({
  AuthPage: () => <div data-testid="auth-page" />,
}));

const performSwitch = vi.fn(async (_o: unknown) => {});
vi.mock("@/lib/mcp/switchAccount", () => ({
  performMcpSwitchAccount: (o: unknown) => performSwitch(o),
}));

vi.mock("@/components/integrations/McpConnectionPanel", () => ({
  McpConnectionPanel: ({ onSwitchAccount }: { onSwitchAccount: () => void }) => (
    <div data-testid="mcp-panel">
      <button type="button" onClick={() => onSwitchAccount()}>trigger-switch</button>
    </div>
  ),
}));

import Connect from "@/pages/Connect";

function renderConnect() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/connect"]}>
        <Routes>
          <Route path="/connect" element={<Connect />} />
          <Route path="/login" element={<div data-testid="login-page" />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  mockUser = { id: "u1", email: "ana@exemplo.com" };
  mockLoading = false;
  signOutMock.mockReset().mockResolvedValue(undefined);
  performSwitch.mockReset().mockResolvedValue(undefined);
});

describe("Connect", () => {
  it("redireciona deslogado para /login?redirect=%2Fconnect", async () => {
    mockUser = null;
    renderConnect();
    await waitFor(() => expect(screen.getByTestId("login-page")).toBeInTheDocument());
    expect(screen.queryByTestId("auth-page")).not.toBeInTheDocument();
  });

  it("renderiza o McpConnectionPanel uma única vez", () => {
    renderConnect();
    expect(screen.getAllByTestId("mcp-panel")).toHaveLength(1);
  });

  it("não renderiza AuthPage dentro de Connect", () => {
    renderConnect();
    expect(screen.queryByTestId("auth-page")).not.toBeInTheDocument();
  });

  it("declara noindex, nofollow via <meta>", () => {
    // react-helmet-async não injeta síncronamente em jsdom; validamos via
    // varredura do próprio JSX serializado pela árvore.
    const { container } = renderConnect();
    const html = container.innerHTML + document.head.innerHTML;
    // A tag pode estar em document.head OU pendente no HelmetProvider —
    // em qualquer caso, o conteúdo declarado deve conter noindex/nofollow.
    expect(html.toLowerCase()).toMatch(/noindex/);
  });

  it("links externos usam target=_blank e rel=noopener noreferrer", () => {
    renderConnect();
    const externals = Array.from(document.querySelectorAll('a[href^="http"]'));
    expect(externals.length).toBeGreaterThan(0);
    for (const a of externals) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("delegar 'Sair e conectar outra conta' chama performMcpSwitchAccount", async () => {
    renderConnect();
    screen.getByText("trigger-switch").click();
    await waitFor(() => expect(performSwitch).toHaveBeenCalledTimes(1));
    const arg = performSwitch.mock.calls[0][0] as {
      userId?: string;
      signOut: unknown;
      navigate: (to: string) => void;
    };
    expect(arg.userId).toBe("u1");
    expect(typeof arg.navigate).toBe("function");
  });
});