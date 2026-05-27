import { describe, it, expect, vi, beforeEach } from "vitest";

const selectChain = {
  eq: vi.fn(),
};
const fromMock = vi.fn();
const upsertMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { fetchConsentStatus, recordConsents } from "@/lib/services/consentService";
import { CONSENT_VERSIONS } from "@/lib/consent/versions";

beforeEach(() => {
  fromMock.mockReset();
  upsertMock.mockReset();
  selectChain.eq.mockReset();
});

describe("consentService.fetchConsentStatus", () => {
  it("retorna pending para todos quando não há registros", async () => {
    fromMock.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    });
    const status = await fetchConsentStatus("u1");
    expect(status.allAccepted).toBe(false);
    expect(status.pending).toContain("terms");
    expect(status.pending).toContain("educational_disclaimer");
  });

  it("considera aceite apenas quando a versão bate com a oficial", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({
          data: [
            { consent_type: "terms", version: CONSENT_VERSIONS.terms, accepted_at: "2026-01-01" },
            { consent_type: "educational_disclaimer", version: "old_v0", accepted_at: "2025-01-01" },
          ],
          error: null,
        }),
      }),
    });
    const status = await fetchConsentStatus("u1");
    expect(status.pending).toEqual(["educational_disclaimer"]);
    expect(status.allAccepted).toBe(false);
  });

  it("retorna allAccepted=true quando todas as versões batem", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({
          data: [
            { consent_type: "terms", version: CONSENT_VERSIONS.terms, accepted_at: "x" },
            { consent_type: "educational_disclaimer", version: CONSENT_VERSIONS.educational_disclaimer, accepted_at: "x" },
          ],
          error: null,
        }),
      }),
    });
    const status = await fetchConsentStatus("u1");
    expect(status.allAccepted).toBe(true);
    expect(status.pending).toEqual([]);
  });

  it("sem userId não consulta banco", async () => {
    const status = await fetchConsentStatus("");
    expect(status.allAccepted).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("consentService.recordConsents", () => {
  it("grava upsert com versões oficiais", async () => {
    upsertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert: upsertMock });

    const r = await recordConsents({ userId: "u1", types: ["terms", "educational_disclaimer"] });
    expect(r.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [rows] = upsertMock.mock.calls[0];
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ user_id: "u1", consent_type: "terms", version: CONSENT_VERSIONS.terms }),
      expect.objectContaining({ user_id: "u1", consent_type: "educational_disclaimer", version: CONSENT_VERSIONS.educational_disclaimer }),
    ]));
  });

  it("propaga erro do banco", async () => {
    upsertMock.mockResolvedValue({ error: { message: "rls" } });
    fromMock.mockReturnValue({ upsert: upsertMock });
    const r = await recordConsents({ userId: "u1", types: ["terms"] });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("rls");
  });

  it("sem userId retorna missing_user sem chamar banco", async () => {
    const r = await recordConsents({ userId: "", types: ["terms"] });
    expect(r.ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
});