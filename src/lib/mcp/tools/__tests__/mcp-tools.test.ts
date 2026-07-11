import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/supabase-js before importing the tools.
const buildFrom = (result: { data: unknown; error: unknown }) => {
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  chain.select = passthrough;
  chain.eq = passthrough;
  chain.order = passthrough;
  chain.limit = passthrough;
  chain.maybeSingle = () => Promise.resolve(result);
  // Terminal await for non-single queries.
  (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
};

let planResult: { data: unknown; error: unknown } = { data: null, error: null };
let assetsResult: { data: unknown; error: unknown } = { data: [], error: null };
let monthsResult: { data: unknown; error: unknown } = { data: [], error: null };
let membersResult: { data: unknown; error: unknown } = { data: [], error: null };
let planIdResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "plans") return buildFrom(planResult);
      if (table === "assets") return buildFrom(assetsResult);
      if (table === "monthly_tracking") return buildFrom(monthsResult);
      if (table === "plan_members") {
        // Two calls: one .maybeSingle() for plan_id row, one terminal for list.
        const listResult = membersResult;
        const idResult = planIdResult;
        const chain: Record<string, unknown> = {};
        const passthrough = () => chain;
        chain.select = passthrough;
        chain.eq = passthrough;
        chain.order = passthrough;
        chain.limit = passthrough;
        chain.maybeSingle = () => Promise.resolve(idResult);
        (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve(listResult).then(resolve);
        return chain;
      }
      return buildFrom({ data: null, error: null });
    },
  }),
}));

import getPlanOverview from "../get-plan-overview";
import listAssets from "../list-assets";
import listMonthlyTracking from "../list-monthly-tracking";

const authedCtx = {
  isAuthenticated: () => true,
  getUserId: () => "user-a",
  getToken: () => "token-a",
};
const anonCtx = {
  isAuthenticated: () => false,
  getUserId: () => "",
  getToken: () => "",
};

beforeEach(() => {
  planResult = { data: null, error: null };
  assetsResult = { data: [], error: null };
  monthsResult = { data: [], error: null };
  membersResult = { data: [], error: null };
  planIdResult = { data: null, error: null };
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "anon";
});

describe("MCP tools — auth guard", () => {
  it("get_plan_overview requires authentication", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await getPlanOverview.handler({}, anonCtx as any);
    expect(res.isError).toBe(true);
    expect(res.structuredContent.code).toBe("not_authenticated");
  });
  it("list_assets requires authentication", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await listAssets.handler({}, anonCtx as any);
    expect(res.isError).toBe(true);
    expect(res.structuredContent.code).toBe("not_authenticated");
  });
  it("list_monthly_tracking requires authentication", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await listMonthlyTracking.handler({}, anonCtx as any);
    expect(res.isError).toBe(true);
    expect(res.structuredContent.code).toBe("not_authenticated");
  });
});

describe("MCP tools — error hygiene", () => {
  it("get_plan_overview never leaks raw supabase error", async () => {
    planResult = { data: null, error: { message: "permission denied for table plans", code: "42501" } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await getPlanOverview.handler({}, authedCtx as any);
    expect(res.isError).toBe(true);
    expect(res.structuredContent.code).toBe("read_failed");
    const text = res.content[0].text as string;
    expect(text).not.toMatch(/permission|policy|plans|42501|jwt/i);
  });
  it("list_assets never leaks raw supabase error", async () => {
    assetsResult = { data: null, error: { message: "RLS violation on assets" } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await listAssets.handler({}, authedCtx as any);
    expect(res.isError).toBe(true);
    expect(res.structuredContent.code).toBe("read_failed");
    expect((res.content[0].text as string)).not.toMatch(/RLS|assets|violation/i);
  });
});

describe("MCP tools — data minimization", () => {
  it("list_assets does not select internal UUIDs", async () => {
    assetsResult = {
      data: [
        {
          asset_type: "renda_fixa",
          asset_subtype: "CDB",
          ticker_or_name: "CDB Nubank",
          institution: "Nubank",
          conglomerate: "Nu",
          bucket: "protection",
          has_fgc: true,
          has_sovereign_guarantee: false,
          liquidity_type: "daily",
          invested_amount: 1000,
          current_amount: 1050,
          maturity_date: null,
        },
      ],
      error: null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await listAssets.handler({}, authedCtx as any);
    const asset = res.structuredContent.assets[0];
    expect(asset.id).toBeUndefined();
    expect(asset.user_id).toBeUndefined();
    expect(asset.member_id).toBeUndefined();
  });

  it("get_plan_overview does not expose plan.id, member.id or user_id", async () => {
    planResult = {
      data: {
        mode: "individual",
        goal_amount: 1000000,
        goal_years: 20,
        goal_purpose: null,
        initial_amount: 0,
        monthly_contribution: 500,
        onboarding_complete: true,
      },
      error: null,
    };
    planIdResult = { data: { plan_id: "plan-xxx" }, error: null };
    membersResult = {
      data: [{ name: "Ana", role: "titular", is_primary: true, age: 30 }],
      error: null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await getPlanOverview.handler({}, authedCtx as any);
    const s = res.structuredContent;
    expect(s.id).toBeUndefined();
    expect(s.plan_id).toBeUndefined();
    expect(s.user_id).toBeUndefined();
    expect(s.members[0].id).toBeUndefined();
    expect(s.members[0].user_id).toBeUndefined();
  });
});

describe("MCP tools — limit validation", () => {
  it("list_monthly_tracking schema enforces 1..60", () => {
    // Zod-based inputSchema is a map of validators; assert bounds directly.
    const limitSchema = listMonthlyTracking.inputSchema.limit;
    expect(limitSchema.safeParse(0).success).toBe(false);
    expect(limitSchema.safeParse(61).success).toBe(false);
    expect(limitSchema.safeParse(1).success).toBe(true);
    expect(limitSchema.safeParse(60).success).toBe(true);
    expect(limitSchema.safeParse(undefined).success).toBe(true);
  });
});

describe("MCP tools — read-only annotations", () => {
  it("all tools declare readOnlyHint: true", () => {
    expect(getPlanOverview.annotations?.readOnlyHint).toBe(true);
    expect(listAssets.annotations?.readOnlyHint).toBe(true);
    expect(listMonthlyTracking.annotations?.readOnlyHint).toBe(true);
  });
});