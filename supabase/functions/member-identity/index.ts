/**
 * member-identity — Edge Function que gerencia identidade privada de
 * participantes de plano.
 *
 * Boundary de segurança:
 *  - Valida JWT via `auth.getClaims()`; user_id vem SEMPRE do token.
 *  - Nunca aceita user_id/plan_id/member_id sem verificação de ownership.
 *  - CPF é normalizado, validado (11 dígitos + DV) e imediatamente
 *    transformado em HMAC-SHA-256 com `CPF_HMAC_SECRET` (nunca logado,
 *    nunca retornado).
 *  - Escrita na tabela `plan_member_private_identity` só é possível pelo
 *    service_role (a tabela nega leitura/escrita a authenticated).
 *  - Erros são fechados (`invalid_cpf`, `duplicate_in_plan`,
 *    `member_not_found`, `unauthorized`, `server_error`).
 *  - Nunca revela existência de CPF em outro plano.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { hmacCpf, isValidCpf, normalizeCpf } from "./cpf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Versão da chave HMAC — constante do código (rotação futura vira "2").
// Não vem de env var: o valor precisa ser previsível para comparação
// determinística de HMACs em backfill/rotação.
const CPF_HMAC_KEY_VERSION = "1";

type ErrorCode =
  | "unauthorized"
  | "invalid_payload"
  | "invalid_cpf"
  | "member_not_found"
  | "duplicate_in_plan"
  | "server_error";

function errorResponse(code: ErrorCode, status = 400): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function successResponse(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AuthContext {
  userId: string;
  authClient: ReturnType<typeof createClient>;
  serviceClient: ReturnType<typeof createClient>;
}

async function authenticate(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return errorResponse("unauthorized", 401);
  const token = authHeader.slice(7);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("member-identity.missing_env"); // sem valores
    return errorResponse("server_error", 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const claims = await authClient.auth.getClaims(token);
  if (claims.error || !claims.data?.claims?.sub) {
    return errorResponse("unauthorized", 401);
  }
  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    userId: claims.data.claims.sub as string,
    authClient,
    serviceClient,
  };
}

/**
 * Confirma que o membro pertence a um plano do usuário autenticado. Nunca
 * confia em plan_id/member_id vindos do payload sem checar ownership.
 */
async function ownedMemberOr404(
  ctx: AuthContext,
  memberId: string,
): Promise<{ planId: string; isPrimary: boolean; status: string } | Response> {
  const { data, error } = await ctx.serviceClient
    .from("plan_members")
    .select("plan_id, is_primary, status, user_id")
    .eq("id", memberId)
    .maybeSingle();
  if (error) {
    console.error("member-identity.member_lookup_failed", { memberId });
    return errorResponse("server_error", 500);
  }
  if (!data || data.user_id !== ctx.userId) {
    return errorResponse("member_not_found", 404);
  }
  return {
    planId: data.plan_id as string,
    isPrimary: !!data.is_primary,
    status: data.status as string,
  };
}

async function handleSet(
  ctx: AuthContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const memberId = typeof body.member_id === "string" ? body.member_id : "";
  const cpfInput = body.cpf;
  if (!memberId) return errorResponse("invalid_payload");
  const cpf = normalizeCpf(cpfInput);
  if (!cpf || !isValidCpf(cpf)) return errorResponse("invalid_cpf");

  const secret = Deno.env.get("CPF_HMAC_SECRET");
  if (!secret || secret.length < 32) {
    console.error("member-identity.missing_hmac_secret");
    return errorResponse("server_error", 500);
  }

  let cpfHmac: string;
  try {
    cpfHmac = await hmacCpf(cpf, secret);
  } catch (_err) {
    console.error("member-identity.hmac_failed");
    return errorResponse("server_error", 500);
  }
  const cpfLast4 = cpf.slice(-4);

  // RPC transacional: valida ownership, membro ativo, duplicidade no plano,
  // grava HMAC na tabela privada e atualiza cpf_last4/identity_status. Se
  // qualquer etapa falhar, rollback completo. Nunca retorna cpf_hmac.
  const rpc = await ctx.serviceClient.rpc("set_plan_member_identity_v1", {
    p_authenticated_user_id: ctx.userId,
    p_member_id: memberId,
    p_cpf_hmac: cpfHmac,
    p_cpf_last4: cpfLast4,
    p_hmac_key_version: CPF_HMAC_KEY_VERSION,
  });
  if (rpc.error) {
    const code = (rpc.error as { code?: string; message?: string }).code;
    const msg = String((rpc.error as { message?: string }).message ?? "");
    if (code === "23505" || /duplicate_in_plan/.test(msg)) {
      return errorResponse("duplicate_in_plan", 409);
    }
    if (/member_not_found/.test(msg)) return errorResponse("member_not_found", 404);
    if (/member_not_active/.test(msg)) return errorResponse("member_not_found", 404);
    if (/invalid_payload/.test(msg)) return errorResponse("invalid_payload");
    console.error("member-identity.rpc_failed", { code });
    return errorResponse("server_error", 500);
  }
  return successResponse({
    member_id: memberId,
    cpf_last4: cpfLast4,
    identity_status: "verified",
  });
}

async function handleLookup(
  ctx: AuthContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const memberId = typeof body.member_id === "string" ? body.member_id : "";
  if (!memberId) return errorResponse("invalid_payload");
  const ownership = await ownedMemberOr404(ctx, memberId);
  if (ownership instanceof Response) return ownership;

  const { data, error } = await ctx.serviceClient
    .from("plan_members")
    .select("cpf_last4, identity_status")
    .eq("id", memberId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) return errorResponse("server_error", 500);
  if (!data) return errorResponse("member_not_found", 404);
  return successResponse({
    member_id: memberId,
    cpf_last4: data.cpf_last4 ?? null,
    identity_status: data.identity_status ?? "missing",
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("invalid_payload", 405);

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid_payload");
  }
  const action = typeof body?.action === "string" ? body.action : "";
  if (action === "set") return handleSet(auth, body);
  if (action === "lookup") return handleLookup(auth, body);
  return errorResponse("invalid_payload");
});