import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getRuntimeEnv } from "./_env";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    getRuntimeEnv("SUPABASE_URL"),
    getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY") || getRuntimeEnv("SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_monthly_tracking",
  title: "Listar aportes mensais",
  description:
    "Retorna os meses mais recentes do acompanhamento de aportes do usuário autenticado (mês, planejado, realizado, déficit e status). Somente leitura.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(60)
      .optional()
      .describe("Quantos meses recentes retornar (1 a 60). Padrão: 12."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "Autenticação necessária." }],
        structuredContent: { code: "not_authenticated" },
        isError: true,
      };
    }

    const { data, error } = await supabaseForUser(ctx)
      .from("monthly_tracking")
      .select("month_key, year, month, planned_total, actual_total, shortfall, status, notes")
      .eq("user_id", ctx.getUserId())
      .order("month_key", { ascending: false })
      .limit(limit ?? 12);

    if (error) {
      console.error("mcp.list_monthly_tracking.query_failed", error);
      return {
        content: [{ type: "text", text: "Não foi possível carregar o histórico mensal. Tente novamente." }],
        structuredContent: { code: "read_failed" },
        isError: true,
      };
    }

    const months = data ?? [];
    const payload = { count: months.length, months };
    const summaryText = `${months.length} mês(es) de acompanhamento retornado(s).`;
    return {
      content: [{ type: "text", text: summaryText }],
      structuredContent: payload,
    };
  },
});
