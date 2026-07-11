import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getPlanOverview from "./tools/get-plan-overview";
import listAssets from "./tools/list-assets";
import listMonthlyTracking from "./tools/list-monthly-tracking";

// Build the OAuth issuer from the Supabase project ref (Vite inlines this at
// build time). Never derive it from SUPABASE_URL — on Lovable Cloud that value
// is the .lovable.cloud proxy and mcp-js rejects any token whose configured
// issuer doesn't match the direct supabase.co issuer the discovery document
// publishes (RFC 8414 §3.3).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "plano-do-milhao-mcp",
  title: "Plano do Milhão",
  version: "0.1.0",
  instructions:
    "Read-only access to the signed-in user's financial plan on Plano do Milhão: current plan and goal, active participants, investments (assets) with totals, and the recent monthly deposit history. Use get_plan_overview first to know the plan mode and goal, list_assets to inspect the portfolio, and list_monthly_tracking to review recent execution.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getPlanOverview, listAssets, listMonthlyTracking],
});
