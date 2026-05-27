/**
 * QuickDeposit — modo batch.
 *
 * Cobre o risco P0 identificado na auditoria: o componente antigo
 * iterava `onUpdateMonth` por contribuidor, disparando uma RPC por
 * pessoa e permitindo persistência parcial em modo casal. Agora deve
 * delegar a UMA única chamada `onSaveBatch`.
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { QuickDeposit } from "@/components/plan/QuickDeposit";
import type { PlanConfig, MonthRecord } from "@/lib/types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeConfig(plannedSelic: number[], plannedCDB: number[]): PlanConfig {
  return {
    initialAmount: 0,
    targetAmount: 1_000_000,
    years: 20,
    selicRate: 0.13,
    cdbRate: 0.13,
    contributors: plannedSelic.map((s, i) => ({
      name: i === 0 ? "Ana" : "Bruno",
      plannedSelic: s,
      plannedCDB: plannedCDB[i] ?? 0,
    })),
  };
}

describe("QuickDeposit — batch save", () => {
  it("solo: faz UMA única chamada de onSaveBatch com o aporte do titular", async () => {
    const onSaveBatch = vi.fn().mockResolvedValue({ ok: true, queuedOffline: false });
    const cfg = makeConfig([800], [200]);
    const records: MonthRecord[] = [];
    const { getByText, getAllByRole } = render(
      <QuickDeposit
        open
        onOpenChange={() => {}}
        config={cfg}
        monthRecords={records}
        onSaveBatch={onSaveBatch}
      />,
    );
    fireEvent.change(getAllByRole("spinbutton")[0], { target: { value: "1000" } });
    fireEvent.click(getByText(/Salvar aporte/i));
    await waitFor(() => expect(onSaveBatch).toHaveBeenCalledTimes(1));
    const [, batch] = onSaveBatch.mock.calls[0];
    expect(batch).toHaveLength(1);
    expect(batch[0].contributorIndex).toBe(0);
    expect(batch[0].deposit.actualSelic + batch[0].deposit.actualCDB).toBe(1000);
  });

  it("casal: envia os DOIS aportes em uma única chamada — sem perder o primeiro membro", async () => {
    const onSaveBatch = vi.fn().mockResolvedValue({ ok: true, queuedOffline: false });
    const cfg = makeConfig([600, 500], [400, 500]);
    const { getByText, getAllByRole } = render(
      <QuickDeposit
        open
        onOpenChange={() => {}}
        config={cfg}
        monthRecords={[]}
        onSaveBatch={onSaveBatch}
      />,
    );
    const inputs = getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "1000" } });
    fireEvent.change(inputs[1], { target: { value: "800" } });
    fireEvent.click(getByText(/Salvar aporte/i));
    await waitFor(() => expect(onSaveBatch).toHaveBeenCalledTimes(1));
    const [, batch] = onSaveBatch.mock.calls[0];
    expect(batch).toHaveLength(2);
    const indexes = batch.map((b: { contributorIndex: number }) => b.contributorIndex).sort();
    expect(indexes).toEqual([0, 1]);
    const totals = batch.map((b: { deposit: { actualSelic: number; actualCDB: number } }) =>
      b.deposit.actualSelic + b.deposit.actualCDB,
    );
    expect(totals).toContain(1000);
    expect(totals).toContain(800);
  });

  it("não fecha o modal e mostra erro quando a persistência falha", async () => {
    const onSaveBatch = vi.fn().mockResolvedValue({ ok: false, reason: "rpc_failed" });
    const onOpenChange = vi.fn();
    const cfg = makeConfig([1000], [0]);
    const { getByText, getAllByRole } = render(
      <QuickDeposit
        open
        onOpenChange={onOpenChange}
        config={cfg}
        monthRecords={[]}
        onSaveBatch={onSaveBatch}
      />,
    );
    fireEvent.change(getAllByRole("spinbutton")[0], { target: { value: "500" } });
    fireEvent.click(getByText(/Salvar aporte/i));
    await waitFor(() => expect(onSaveBatch).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});