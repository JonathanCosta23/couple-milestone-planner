import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlanSettingsSection } from "@/components/plan/PlanSettingsSection";

const baseInitial = {
  goalAmount: 1_000_000,
  initialAmount: 10_000,
  monthlyContribution: 2_000,
  goalYears: 20,
  goalPurpose: "liberdade-financeira" as const,
  goalPurposeCustom: undefined as string | undefined,
};

describe("PlanSettingsSection", () => {
  it("abre automaticamente quando autoExpand=true e consome o foco", async () => {
    const consumed = vi.fn();
    render(
      <PlanSettingsSection
        initial={baseInitial}
        onSave={vi.fn().mockResolvedValue(undefined)}
        autoExpand
        onAutoExpandConsumed={consumed}
      />,
    );
    expect(await screen.findByLabelText(/Meta patrimonial/i)).toBeInTheDocument();
    await waitFor(() => expect(consumed).toHaveBeenCalled());
  });

  it("bloqueia salvar com meta zero e prazo fora do intervalo", async () => {
    const onSave = vi.fn();
    render(
      <PlanSettingsSection initial={baseInitial} onSave={onSave} autoExpand />,
    );
    const goal = await screen.findByLabelText(/Meta patrimonial/i);
    fireEvent.change(goal, { target: { value: "0" } });
    const years = screen.getByLabelText(/Prazo/i);
    fireEvent.change(years, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar plano/i }));
    await waitFor(() => expect(screen.getByText(/maior que zero/i)).toBeInTheDocument());
    expect(screen.getByText(/entre 1 e 50 anos/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("envia payload correto e converte máscara BRL", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <PlanSettingsSection initial={baseInitial} onSave={onSave} autoExpand />,
    );
    const goal = await screen.findByLabelText(/Meta patrimonial/i);
    fireEvent.change(goal, { target: { value: "2.500.000" } });
    const monthly = screen.getByLabelText(/Aporte mensal/i);
    fireEvent.change(monthly, { target: { value: "3.000" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar plano/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        goalAmount: 2_500_000,
        monthlyContribution: 3_000,
        goalYears: 20,
        goalPurpose: "liberdade-financeira",
      }),
    );
  });

  it("exige texto quando propósito='outro'", async () => {
    const onSave = vi.fn();
    render(
      <PlanSettingsSection
        initial={{ ...baseInitial, goalPurpose: "outro" }}
        onSave={onSave}
        autoExpand
      />,
    );
    await screen.findByLabelText(/Descreva o propósito/i);
    fireEvent.click(screen.getByRole("button", { name: /Salvar plano/i }));
    await waitFor(() =>
      expect(screen.getByText(/Descreva o propósito da meta/i)).toBeInTheDocument(),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("aceita 1.000,50 e envia 1000.50; aceita 0,99 e envia 0.99", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <PlanSettingsSection initial={baseInitial} onSave={onSave} autoExpand />,
    );
    const initial = await screen.findByLabelText(/Patrimônio inicial/i);
    fireEvent.change(initial, { target: { value: "1.000,50" } });
    const monthly = screen.getByLabelText(/Aporte mensal/i);
    fireEvent.change(monthly, { target: { value: "0,99" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar plano/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        initialAmount: 1000.5,
        monthlyContribution: 0.99,
      }),
    );
  });

  it("bloqueia formato monetário inválido", async () => {
    const onSave = vi.fn();
    render(
      <PlanSettingsSection initial={baseInitial} onSave={onSave} autoExpand />,
    );
    const goal = await screen.findByLabelText(/Meta patrimonial/i);
    fireEvent.change(goal, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar plano/i }));
    await waitFor(() =>
      expect(screen.getByText(/Formato inválido/i)).toBeInTheDocument(),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("desabilita salvar e alerta quando cloudReady=false", async () => {
    const onSave = vi.fn();
    render(
      <PlanSettingsSection
        initial={baseInitial}
        onSave={onSave}
        autoExpand
        cloudReady={false}
      />,
    );
    const saveBtn = await screen.findByRole("button", { name: /Salvar plano/i });
    expect(saveBtn).toBeDisabled();
    expect(
      screen.getByTestId("plan-settings-cloud-loading"),
    ).toBeInTheDocument();
    fireEvent.click(saveBtn);
    expect(onSave).not.toHaveBeenCalled();
  });
});