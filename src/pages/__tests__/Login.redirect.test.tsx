import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

// Captura o onSuccess passado ao AuthPage sem depender de Supabase.
let capturedOnSuccess: (() => void) | null = null;

vi.mock("@/components/auth/AuthPage", () => ({
  AuthPage: (props: { onSuccess?: () => void }) => {
    capturedOnSuccess = props.onSuccess ?? null;
    return <div data-testid="auth-page" />;
  },
}));

import Login from "@/pages/Login";

function renderAt(initialEntry: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div data-testid="home" />} />
          <Route path="/connect" element={<div data-testid="connect" />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("Login redirect", () => {
  it("navega para /connect quando redirect=/connect", async () => {
    renderAt("/login?redirect=%2Fconnect");
    expect(capturedOnSuccess).not.toBeNull();
    await act(async () => {
      capturedOnSuccess?.();
    });
    expect(screen.getByTestId("connect")).toBeInTheDocument();
  });

  it("ignora redirect inválido e volta para /", async () => {
    renderAt("/login?redirect=https%3A%2F%2Fevil.com");
    await act(async () => {
      capturedOnSuccess?.();
    });
    expect(screen.getByTestId("home")).toBeInTheDocument();
  });

  it("ignora redirect fora da allowlist", async () => {
    renderAt("/login?redirect=%2Fadmin");
    await act(async () => {
      capturedOnSuccess?.();
    });
    expect(screen.getByTestId("home")).toBeInTheDocument();
  });
});