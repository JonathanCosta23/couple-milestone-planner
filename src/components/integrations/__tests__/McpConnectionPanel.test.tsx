import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// -- Mocks --------------------------------------------------------------

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "ana@exemplo.com" } }),
}));

const revokeMock = vi.fn(async (_id: string) => ({ error: null as string | null }));
const reloadMock = vi.fn(async () => {});
let mockGrants: Array<{ clientId: string; name: string; scopes: string[]; grantedAt: string }> = [];
let mockState: string = "ready";
let mockErrorCode: string | null = null;

vi.mock("@/hooks/useMcpConnections", () => ({
  useMcpConnections: () => ({
    state: mockState,
    grants: mockGrants,
    errorCode: mockErrorCode,
    reload: reloadMock,
    revoke: revokeMock,
  }),
}));

vi.mock("@/lib/mcp/mcpConnectionConfig", () => ({
  MCP_DATA_ACCESSED: ["Seu plano atual e a meta financeira"],
  MCP_ENDPOINT_UNAVAILABLE_MESSAGE: "A integração MCP não está disponível neste ambiente.",
  MCP_READONLY_DESCRIPTION:
    "O assistente conectado vê apenas os seus dados e não cria, altera ou apaga nada.",
  endpointAvailable: true,
  mcpEndpoint: "https://example.supabase.co/functions/v1/mcp",
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { McpConnectionPanel } from "@/components/integrations/McpConnectionPanel";
import { toast } from "sonner";

function renderPanel(onSwitchAccount = vi.fn()) {
  return {
    onSwitchAccount,
    ...render(
      <MemoryRouter>
        <McpConnectionPanel onSwitchAccount={onSwitchAccount} />
      </MemoryRouter>,
    ),
  };
}

beforeEach(() => {
  revokeMock.mockReset().mockResolvedValue({ error: null });
  reloadMock.mockReset().mockResolvedValue(undefined);
  mockGrants = [];
  mockState = "ready";
  mockErrorCode = null;
  (toast.success as ReturnType<typeof vi.fn>).mockReset();
  (toast.error as ReturnType<typeof vi.fn>).mockReset();
});

describe("McpConnectionPanel — conteúdo estático", () => {
  it("mostra a conta ativa e o endpoint disponível", () => {
    renderPanel();
    expect(screen.getByText("ana@exemplo.com")).toBeInTheDocument();
    expect(
      screen.getByText("https://example.supabase.co/functions/v1/mcp"),
    ).toBeInTheDocument();
  });

  it("mostra os dados acessíveis e a descrição read-only global", () => {
    renderPanel();
    expect(screen.getByText("Dados acessíveis")).toBeInTheDocument();
    expect(
      screen.getByText(/somente ferramentas\s+de consulta e não cria, altera ou apaga/i),
    ).toBeInTheDocument();
  });

  it("usa o título 'Aplicativos autorizados'", () => {
    renderPanel();
    expect(screen.getByText("Aplicativos autorizados")).toBeInTheDocument();
    expect(screen.queryByText("Assistentes autorizados")).not.toBeInTheDocument();
  });

  it("renderiza o bloco 'Dados retornando vazio?' com prompt e passos", () => {
    renderPanel();
    expect(screen.getByText("Dados retornando vazio?")).toBeInTheDocument();
    expect(screen.getByText("Mostre a visão geral do meu plano.")).toBeInTheDocument();
    expect(
      screen.getByText("Confirme o e-mail da conta ativa."),
    ).toBeInTheDocument();
  });
});

describe("McpConnectionPanel — endpoint indisponível", () => {
  it("exibe mensagem segura quando o endpoint não é resolvido", async () => {
    vi.resetModules();
    vi.doMock("@/lib/mcp/mcpConnectionConfig", () => ({
      MCP_DATA_ACCESSED: ["Seu plano"],
      MCP_ENDPOINT_UNAVAILABLE_MESSAGE: "A integração MCP não está disponível neste ambiente.",
      MCP_READONLY_DESCRIPTION: "somente leitura.",
      endpointAvailable: false,
      mcpEndpoint: null,
    }));
    const { McpConnectionPanel: Panel } = await import(
      "@/components/integrations/McpConnectionPanel"
    );
    render(
      <MemoryRouter>
        <Panel onSwitchAccount={() => {}} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("A integração MCP não está disponível neste ambiente."),
    ).toBeInTheDocument();
    vi.doUnmock("@/lib/mcp/mcpConnectionConfig");
    vi.resetModules();
  });
});

describe("McpConnectionPanel — grants", () => {
  it("não expõe clientId e não marca cada grant individualmente como 'somente leitura'", () => {
    mockGrants = [
      { clientId: "uuid-super-secret-1234", name: "ChatGPT", scopes: ["openid", "email"], grantedAt: "2025-01-15T00:00:00Z" },
    ];
    renderPanel();
    expect(screen.queryByText(/uuid-super-secret/i)).not.toBeInTheDocument();
    // A garantia read-only é global, não por item.
    const item = screen.getByText("ChatGPT").closest("li")!;
    expect(within(item).queryByText(/somente leitura/i)).toBeNull();
    expect(within(item).getByText(/Autorizado em/)).toBeInTheDocument();
    // Escopos amigáveis.
    expect(within(item).getByText(/Identidade da conta/)).toBeInTheDocument();
    expect(within(item).getByText(/E-mail da conta/)).toBeInTheDocument();
  });
});

describe("McpConnectionPanel — revogação", () => {
  it("pede confirmação e chama revoke + reload em sucesso", async () => {
    mockGrants = [{ clientId: "c1", name: "ChatGPT", scopes: [], grantedAt: "2025-01-15T00:00:00Z" }];
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Revogar acesso de ChatGPT/i }));
    await user.click(await screen.findByRole("button", { name: "Revogar acesso" }));
    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(reloadMock).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith(
      "Acesso revogado. Atualize a lista novamente em alguns instantes.",
    );
  });

  it("mantém o item e NÃO chama reload quando revoke falha", async () => {
    mockGrants = [{ clientId: "c1", name: "ChatGPT", scopes: [], grantedAt: "2025-01-15T00:00:00Z" }];
    revokeMock.mockResolvedValueOnce({ error: "grant_revoke_failed" });
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Revogar acesso de ChatGPT/i }));
    await user.click(await screen.findByRole("button", { name: "Revogar acesso" }));
    await waitFor(() => expect(revokeMock).toHaveBeenCalled());
    expect(reloadMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
  });

  it("falha de reload após revoke bem-sucedido não gera falso erro", async () => {
    mockGrants = [{ clientId: "c1", name: "ChatGPT", scopes: [], grantedAt: "2025-01-15T00:00:00Z" }];
    reloadMock.mockRejectedValueOnce(new Error("boom"));
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Revogar acesso de ChatGPT/i }));
    await user.click(await screen.findByRole("button", { name: "Revogar acesso" }));
    await waitFor(() => expect(revokeMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Acesso revogado. Atualize a lista novamente em alguns instantes.",
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("McpConnectionPanel — troca de conta", () => {
  it("chama onSwitchAccount (não é apresentado como revogação)", async () => {
    const { onSwitchAccount } = renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Sair e conectar outra conta/i }));
    const dialog = await screen.findByRole("alertdialog");
    // Copy do diálogo deixa claro que sair não revoga.
    expect(
      within(dialog).getByText(/não revoga acessos OAuth/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/plano e seus dados financeiros serão mantidos/i),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Sair agora" }));
    await waitFor(() => expect(onSwitchAccount).toHaveBeenCalledTimes(1));
  });
});

describe("McpConnectionPanel — foco após fechar AlertDialog (Radix padrão)", () => {
  it("retorna o foco ao botão que abriu o diálogo de troca de conta", async () => {
    renderPanel();
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: /Sair e conectar outra conta/i });
    trigger.focus();
    await user.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});