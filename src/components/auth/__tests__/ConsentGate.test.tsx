import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const fetchConsentStatusMock = vi.fn();
const recordConsentsMock = vi.fn();

vi.mock("@/lib/services/consentService", () => ({
  fetchConsentStatus: (...a: unknown[]) => fetchConsentStatusMock(...a),
  recordConsents: (...a: unknown[]) => recordConsentsMock(...a),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { ConsentGate } from "@/components/auth/ConsentGate";

beforeEach(() => {
  fetchConsentStatusMock.mockReset();
  recordConsentsMock.mockReset();
});

describe("ConsentGate", () => {
  it("bloqueia o app até que os 3 consentimentos sejam aceitos", async () => {
    fetchConsentStatusMock.mockResolvedValue({
      allAccepted: false,
      pending: ["terms", "privacy", "educational_disclaimer"],
      accepted: [],
    });
    recordConsentsMock.mockResolvedValue({ ok: true });

    render(
      <ConsentGate userId="u1" onSignOut={vi.fn()}>
        <div>APP_PROTEGIDO</div>
      </ConsentGate>,
    );

    await screen.findByText(/Antes de continuar/i);
    expect(screen.queryByText("APP_PROTEGIDO")).toBeNull();

    // Nenhum ID técnico deve vazar na UI.
    expect(screen.queryByText(/terms_v1/)).toBeNull();
    expect(screen.queryByText(/privacy_v1/)).toBeNull();
    expect(screen.queryByText(/educational_disclaimer_v1/)).toBeNull();

    const button = screen.getByRole("button", { name: /Aceitar e continuar/i });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Aceitar Termos de Uso/i));
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Aceitar Política de Privacidade/i));
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Aceitar aviso educacional/i));
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);

    await waitFor(() => expect(recordConsentsMock).toHaveBeenCalledTimes(1));
    const payload = recordConsentsMock.mock.calls[0][0];
    expect(payload.userId).toBe("u1");
    expect(payload.types).toEqual(
      expect.arrayContaining(["terms", "privacy", "educational_disclaimer"]),
    );

    await screen.findByText("APP_PROTEGIDO");
  });

  it("libera direto quando todos os consentimentos já estão aceitos", async () => {
    fetchConsentStatusMock.mockResolvedValue({
      allAccepted: true,
      pending: [],
      accepted: [],
    });
    render(
      <ConsentGate userId="u1" onSignOut={vi.fn()}>
        <div>APP_PROTEGIDO</div>
      </ConsentGate>,
    );
    await screen.findByText("APP_PROTEGIDO");
  });

  it("exibe mensagem segura sem detalhes técnicos quando o registro falha", async () => {
    fetchConsentStatusMock.mockResolvedValue({
      allAccepted: false,
      pending: ["terms", "privacy", "educational_disclaimer"],
      accepted: [],
    });
    recordConsentsMock.mockResolvedValue({ ok: false, error: "Sem permissão para esta operação." });
    const { toast } = await import("sonner");

    render(
      <ConsentGate userId="u1" onSignOut={vi.fn()}>
        <div>APP_PROTEGIDO</div>
      </ConsentGate>,
    );
    await screen.findByText(/Antes de continuar/i);

    fireEvent.click(screen.getByLabelText(/Aceitar Termos de Uso/i));
    fireEvent.click(screen.getByLabelText(/Aceitar Política de Privacidade/i));
    fireEvent.click(screen.getByLabelText(/Aceitar aviso educacional/i));
    fireEvent.click(screen.getByRole("button", { name: /Aceitar e continuar/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const msg = (toast.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(msg).not.toMatch(/rls|permission|violates|constraint|boom/i);
    expect(screen.queryByText("APP_PROTEGIDO")).toBeNull();
  });
});
