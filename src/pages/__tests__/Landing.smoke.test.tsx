import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Landing from "@/pages/Landing";

// Landing must render for anonymous visitors without opening a modal.
// We stub the legal dialogs footer (has portal side effects) to keep the smoke
// test deterministic.
vi.mock("@/components/plan/LegalDialogs", () => ({
  LegalFooter: () => <div data-testid="legal-footer">Termos · Privacidade · Aviso</div>,
}));

describe("Landing page", () => {
  it("renders hero, CTAs to /signup and /login, and educational disclaimer", () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<Landing />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    // Hero copy
    expect(
      screen.getByRole("heading", {
        name: /rotina mensal clara, segura e mensurável/i,
        level: 1,
      }),
    ).toBeInTheDocument();

    // CTAs point to the standalone auth pages (not modals).
    const signupLinks = screen.getAllByRole("link", { name: /criar conta|criar minha conta|criar conta grátis/i });
    expect(signupLinks.length).toBeGreaterThan(0);
    for (const link of signupLinks) {
      expect(link.getAttribute("href")).toBe("/signup");
    }

    const loginLinks = screen.getAllByRole("link", { name: /^entrar$|já tenho conta/i });
    expect(loginLinks.length).toBeGreaterThan(0);
    for (const link of loginLinks) {
      expect(link.getAttribute("href")).toBe("/login");
    }

    // Educational disclaimer explicit.
    expect(screen.getByText(/não constitui recomendação de investimento/i)).toBeInTheDocument();

    // MCP section explains read-only (multiple mentions are expected).
    expect(screen.getAllByText(/somente leitura/i).length).toBeGreaterThan(0);

    // Legal footer is present.
    expect(screen.getByTestId("legal-footer")).toBeInTheDocument();
  });
});