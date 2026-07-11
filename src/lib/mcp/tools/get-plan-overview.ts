import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "get_plan_overview",
  title: "Get plan overview",
  description:
    "Return the signed-in user's current financial plan: mode (individual or couple), goal amount, timeframe, monthly contribution, and the active participants.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const client = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: plan, error: planError } = await client
      .from("plans")
      .select(
        "id, mode, goal_amount, goal_years, goal_purpose, initial_amount, monthly_contribution, onboarding_complete",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (planError) {
      return { content: [{ type: "text", text: planError.message }], isError: true };
    }
    if (!plan) {
      return {
        content: [{ type: "text", text: "No plan configured yet." }],
        structuredContent: { plan: null, members: [] },
      };
    }

    const { data: members, error: membersError } = await client
      .from("plan_members")
      .select("id, name, role, is_primary, age")
      .eq("plan_id", plan.id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false });

    if (membersError) {
      return { content: [{ type: "text", text: membersError.message }], isError: true };
    }

    const summary = {
      mode: plan.mode,
      goal_amount: plan.goal_amount,
      goal_years: plan.goal_years,
      goal_purpose: plan.goal_purpose,
      initial_amount: plan.initial_amount,
      monthly_contribution: plan.monthly_contribution,
      onboarding_complete: plan.onboarding_complete,
      members: members ?? [],
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
