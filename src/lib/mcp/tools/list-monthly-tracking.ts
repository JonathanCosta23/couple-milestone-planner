import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

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
  name: "list_monthly_tracking",
  title: "List monthly tracking",
  description:
    "Return the most recent months of the signed-in user's monthly deposit tracking: month, planned total, actual total, shortfall, and status.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(60)
      .optional()
      .describe("How many recent months to return. Defaults to 12."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }

    const { data, error } = await supabaseForUser(ctx)
      .from("monthly_tracking")
      .select("month_key, year, month, planned_total, actual_total, shortfall, status, notes")
      .eq("user_id", ctx.getUserId())
      .order("month_key", { ascending: false })
      .limit(limit ?? 12);

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    const months = data ?? [];
    const payload = { count: months.length, months };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
