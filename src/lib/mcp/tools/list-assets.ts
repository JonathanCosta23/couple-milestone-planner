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
  name: "list_assets",
  title: "List investments",
  description:
    "List the signed-in user's active investments (assets) with type, institution, invested amount, current amount, bucket, FGC coverage and liquidity, plus totals.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }

    const { data, error } = await supabaseForUser(ctx)
      .from("assets")
      .select(
        "id, asset_type, asset_subtype, ticker_or_name, institution, conglomerate, bucket, has_fgc, has_sovereign_guarantee, liquidity_type, invested_amount, current_amount, maturity_date",
      )
      .eq("user_id", ctx.getUserId())
      .eq("is_active", true)
      .order("current_amount", { ascending: false });

    if (error) {
      console.error("mcp.list_assets.query_failed", error);
      return {
        content: [{ type: "text", text: "Não foi possível carregar os investimentos. Tente novamente." }],
        isError: true,
      };
    }

    const assets = data ?? [];
    const total_invested = assets.reduce((sum, a) => sum + Number(a.invested_amount ?? 0), 0);
    const total_current = assets.reduce((sum, a) => sum + Number(a.current_amount ?? 0), 0);

    const payload = { count: assets.length, total_invested, total_current, assets };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
