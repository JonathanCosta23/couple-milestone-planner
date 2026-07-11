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
  title: "Visão geral do plano",
  description:
    "Retorna o plano financeiro atual do usuário autenticado: modo (individual ou casal), meta, prazo, aporte mensal e participantes ativos. Somente leitura.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Autenticação necessária." }],
        structuredContent: { code: "not_authenticated" },
        isError: true,
      };
    }
    const client = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: plan, error: planError } = await client
      .from("plans")
      .select(
        "mode, goal_amount, goal_years, goal_purpose, initial_amount, monthly_contribution, onboarding_complete",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (planError) {
      console.error("mcp.get_plan_overview.plan_query_failed", planError);
      return {
        content: [{ type: "text", text: "Não foi possível carregar o plano. Tente novamente." }],
        structuredContent: { code: "read_failed" },
        isError: true,
      };
    }
    if (!plan) {
      return {
        content: [
          {
            type: "text",
            text:
              "Nenhum plano financeiro foi encontrado para esta conta. Verifique se você conectou a mesma conta usada no Plano do Milhão. Se conectou a conta errada, desvincule o conector no ChatGPT/Claude e conecte novamente com a conta correta.",
          },
        ],
        structuredContent: {
          code: "no_plan",
          hint: "wrong_or_new_account",
          message:
            "Nenhum plano encontrado para o usuário autenticado. Provavelmente é uma conta diferente da usada no app, ou o plano ainda não foi criado.",
        },
      };
    }

    // Fetch active members separately using plan_id resolved via RLS-safe query
    // (we intentionally do NOT return plan_id to MCP consumers).
    const { data: planIdRow } = await client
      .from("plan_members")
      .select("plan_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const { data: members, error: membersError } = await client
      .from("plan_members")
      .select("name, role, is_primary, age")
      .eq("plan_id", planIdRow?.plan_id ?? "")
      .eq("is_active", true)
      .order("is_primary", { ascending: false });

    if (membersError) {
      console.error("mcp.get_plan_overview.members_query_failed", membersError);
      return {
        content: [{ type: "text", text: "Não foi possível carregar os participantes do plano. Tente novamente." }],
        structuredContent: { code: "read_failed" },
        isError: true,
      };
    }

    const structured = {
      mode: plan.mode,
      goal_amount: plan.goal_amount,
      goal_years: plan.goal_years,
      goal_purpose: plan.goal_purpose,
      initial_amount: plan.initial_amount,
      monthly_contribution: plan.monthly_contribution,
      onboarding_complete: plan.onboarding_complete,
      members: members ?? [],
    };

    const memberNames = (members ?? []).map((m) => m.name).filter(Boolean).join(", ");
    const summaryText =
      `Plano ${plan.mode === "casal" ? "de casal" : "individual"} — meta ` +
      `R$ ${Number(plan.goal_amount ?? 0).toLocaleString("pt-BR")} em ` +
      `${plan.goal_years ?? "?"} anos, aporte mensal R$ ` +
      `${Number(plan.monthly_contribution ?? 0).toLocaleString("pt-BR")}` +
      (memberNames ? `. Participantes: ${memberNames}.` : ".");

    return {
      content: [{ type: "text", text: summaryText }],
      structuredContent: structured,
    };
  },
});
