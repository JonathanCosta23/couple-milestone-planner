import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_ORIGIN = "https://couple-milestone-planner.lovable.app";

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function safeDeleteError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("User not found")) return "auth_required";
  return "delete_failed";
}

function corsHeaders(req: Request): Record<string, string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ORIGIN)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const origin = req.headers.get("origin") ?? DEFAULT_ORIGIN;
  const allowedOrigin = configured.includes(origin) ? origin : configured[0] ?? DEFAULT_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(req, 500, { error: "server_error" });

    const authorization = req.headers.get("authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(req, 401, { error: "auth_required" });

    const scopedClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await scopedClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user?.id || !user.email) return json(req, 401, { error: "auth_required" });

    const body = await req.json().catch(() => ({}));
    const confirmedEmail = normalizeEmail((body as Record<string, unknown>).email);
    if (!confirmedEmail || confirmedEmail !== normalizeEmail(user.email)) {
      return json(req, 400, { error: "email_mismatch" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id, false);
    if (deleteError) return json(req, 500, { error: safeDeleteError(deleteError) });

    return json(req, 200, { deleted: true });
  } catch {
    return json(req, 500, { error: "server_error" });
  }
});
