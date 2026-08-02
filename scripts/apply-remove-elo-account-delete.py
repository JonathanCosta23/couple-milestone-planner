from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise RuntimeError(f"Expected block not found in {path}: {old[:100]!r}")
    write(path, content.replace(old, new))


# Remove the ELO route and bundle entry.
replace("src/App.tsx", 'const Elo = lazy(() => import("./pages/Elo"));\n', "")
replace("src/App.tsx", '                <Route path="/elo" element={<RequireAuth><Elo /></RequireAuth>} />\n', "")

# Replace reset-plan language and callback with permanent account deletion.
settings = read("src/pages/index/SettingsHub.tsx")
settings = settings.replace(
    'import { Download, Upload, RotateCcw, Settings, ArrowLeft, ChevronDown } from "lucide-react";',
    'import { Download, Upload, Settings, ArrowLeft, ChevronDown, Trash2 } from "lucide-react";',
)
settings = settings.replace("  onOpenReset: () => void;", "  onOpenDeleteAccount: () => void;")
settings = settings.replace("  onExport, onTriggerImport, onSignOut, onSwitchAccount, onOpenReset,", "  onExport, onTriggerImport, onSignOut, onSwitchAccount, onOpenDeleteAccount,")
settings = settings.replace("          onClick={onOpenReset}", "          onClick={onOpenDeleteAccount}")
settings = settings.replace('          <RotateCcw className="w-4 h-4 mr-2.5" /> Resetar plano', '          <Trash2 className="w-4 h-4 mr-2.5" /> Excluir conta permanentemente')
settings = settings.replace("          Ações destrutivas. Não podem ser desfeitas.", "          A exclusão remove permanentemente a conta e todos os dados vinculados.")
write("src/pages/index/SettingsHub.tsx", settings)

# Wire the new dialog into the application shell.
index = read("src/pages/Index.tsx")
index = index.replace('import { ResetPlanDialog } from "@/components/plan/ResetPlanDialog";', 'import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";')
index = index.replace("const [showResetDialog, setShowResetDialog] = useState(false);", "const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);")
index = index.replace("onOpenReset={() => setShowResetDialog(true)}", "onOpenDeleteAccount={() => setShowDeleteAccountDialog(true)}")
index = index.replace(
    '''      <ResetPlanDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        userId={user?.id}
      />

      <LegalFooter onRequestReset={() => setShowResetDialog(true)} />''',
    '''      <DeleteAccountDialog
        open={showDeleteAccountDialog}
        onOpenChange={setShowDeleteAccountDialog}
        userId={user?.id}
        userEmail={user?.email}
      />

      <LegalFooter onRequestDeleteAccount={() => setShowDeleteAccountDialog(true)} />''',
)
if "showResetDialog" in index or "ResetPlanDialog" in index or "onOpenReset" in index:
    raise RuntimeError("Stale reset dialog reference remains in Index.tsx")
write("src/pages/Index.tsx", index)

# Update legal/privacy copy and footer action.
legal = read("src/components/plan/LegalDialogs.tsx")
legal = legal.replace('atalho opcional para "Apagar meus dados".', 'atalho opcional para "Excluir conta permanentemente".')
legal = legal.replace(
    '''          <strong>Seus direitos (LGPD).</strong> Você pode exportar seus dados
          (Perfil → Exportar) e apagar tudo a qualquer momento usando
          <em> "Resetar plano"</em> — isso limpa o banco, o cache local e a
          fila de sincronização. A conta de autenticação permanece e pode ser
          excluída por solicitação.''',
    '''          <strong>Seus direitos (LGPD).</strong> Você pode exportar seus dados
          em Configurações e excluir permanentemente sua conta pela Zona de
          risco. A exclusão remove a autenticação, os dados financeiros, o
          cache local e a fila de sincronização, sem possibilidade de recuperação.''',
)
legal = legal.replace("  /** Quando informado, o link \"Apagar meus dados\" aciona o reset. */\n  onRequestReset?: () => void;", "  /** Quando informado, abre o fluxo de exclusão permanente da conta. */\n  onRequestDeleteAccount?: () => void;")
legal = legal.replace("export function LegalFooter({ onRequestReset }: LegalFooterProps)", "export function LegalFooter({ onRequestDeleteAccount }: LegalFooterProps)")
legal = legal.replace("{onRequestReset && (", "{onRequestDeleteAccount && (")
legal = legal.replace("onClick={onRequestReset}", "onClick={onRequestDeleteAccount}")
legal = legal.replace("Apagar meus dados", "Excluir conta")
legal = legal.replace("Última atualização: maio de 2026", "Última atualização: agosto de 2026")
write("src/components/plan/LegalDialogs.tsx", legal)

# SEO no longer needs to block a removed route.
robots = read("public/robots.txt").replace("Disallow: /elo\n", "")
write("public/robots.txt", robots)
seo = read("src/pages/__tests__/seoContracts.test.ts")
seo = seo.replace('      "/elo",\n', "")
seo = seo.replace('["/elo", "/connect", "/login", "/signup", "/forgot-password"]', '["/connect", "/login", "/signup", "/forgot-password"]')
write("src/pages/__tests__/seoContracts.test.ts", seo)

settings_test = read("src/pages/index/__tests__/SettingsHub.switchAccount.test.tsx").replace("onOpenReset={vi.fn()}", "onOpenDeleteAccount={vi.fn()}")
write("src/pages/index/__tests__/SettingsHub.switchAccount.test.tsx", settings_test)

# Supabase function registration.
config = read("supabase/config.toml")
if "[functions.delete-account]" not in config:
    config += '\n[functions.delete-account]\nverify_jwt = false\n'
write("supabase/config.toml", config)

write("src/lib/services/accountDeletionService.ts", r'''import { supabase } from "@/integrations/supabase/client";
import { clearAll } from "@/lib/offlineQueue";
import { clearProductLocalCache } from "@/lib/services/localCacheOwner";

export type AccountDeletionErrorCode =
  | "auth_required"
  | "email_mismatch"
  | "delete_failed";

export class AccountDeletionError extends Error {
  constructor(public readonly code: AccountDeletionErrorCode) {
    super(code);
    this.name = "AccountDeletionError";
  }
}

export async function deleteAccountPermanently(userId: string, email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!userId || !normalizedEmail) throw new AccountDeletionError("auth_required");

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new AccountDeletionError("auth_required");

  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { email: normalizedEmail },
  });

  if (error) throw new AccountDeletionError("delete_failed");
  if (!data || data.deleted !== true) {
    const code = data?.error === "email_mismatch" ? "email_mismatch" : "delete_failed";
    throw new AccountDeletionError(code);
  }

  clearProductLocalCache(userId);
  await clearAll(userId);

  // O usuário já foi removido no servidor. A limpeza local não pode transformar
  // uma exclusão confirmada em falso erro de interface.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // sessão local inválida após exclusão é o estado esperado
  }
}

export function accountDeletionMessage(error: unknown): string {
  if (error instanceof AccountDeletionError) {
    if (error.code === "auth_required") return "Sua sessão expirou. Entre novamente antes de excluir a conta.";
    if (error.code === "email_mismatch") return "O e-mail informado não corresponde à conta autenticada.";
  }
  return "Não foi possível excluir a conta. Nenhuma nova tentativa será feita automaticamente.";
}
''')

write("src/components/account/DeleteAccountDialog.tsx", r'''import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accountDeletionMessage, deleteAccountPermanently } from "@/lib/services/accountDeletionService";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  userEmail?: string;
}

export function DeleteAccountDialog({ open, onOpenChange, userId, userEmail }: DeleteAccountDialogProps) {
  const [typedEmail, setTypedEmail] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const normalizedAccountEmail = (userEmail ?? "").trim().toLowerCase();
  const confirmed = useMemo(
    () => Boolean(userId && normalizedAccountEmail && typedEmail.trim().toLowerCase() === normalizedAccountEmail && understood),
    [normalizedAccountEmail, typedEmail, understood, userId],
  );

  useEffect(() => {
    if (!open) {
      setTypedEmail("");
      setUnderstood(false);
      setDeleting(false);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!confirmed || !userId || !userEmail) return;
    setDeleting(true);
    try {
      await deleteAccountPermanently(userId, userEmail);
      toast.success("Conta excluída permanentemente.");
      window.location.replace("/login?account_deleted=1");
    } catch (error) {
      toast.error(accountDeletionMessage(error));
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !deleting && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            Excluir conta permanentemente?
          </DialogTitle>
          <DialogDescription>
            Esta ação remove sua conta, plano, histórico financeiro, backups e dados de sincronização. Não existe recuperação.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <Trash2 className="h-4 w-4" aria-hidden />
          <AlertTitle>Exclusão definitiva</AlertTitle>
          <AlertDescription>Exporte um backup antes de continuar, caso precise preservar alguma informação.</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="delete-account-email">Digite o e-mail da conta para confirmar</Label>
          <Input
            id="delete-account-email"
            type="email"
            autoComplete="off"
            value={typedEmail}
            onChange={(event) => setTypedEmail(event.target.value)}
            placeholder={userEmail ?? "seu@email.com"}
            disabled={deleting}
          />
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="delete-account-understood"
            checked={understood}
            onCheckedChange={(value) => setUnderstood(value === true)}
            disabled={deleting}
          />
          <Label htmlFor="delete-account-understood" className="text-sm font-normal leading-snug">
            Entendo que a exclusão é permanente e que todos os dados serão removidos.
          </Label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!confirmed || deleting}>
            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="mr-2 h-4 w-4" aria-hidden />}
            Excluir minha conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
''')

write("src/lib/services/__tests__/accountDeletionService.test.ts", r'''import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const invoke = vi.fn();
const signOut = vi.fn();
const clearAll = vi.fn();
const clearProductLocalCache = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession, signOut }, functions: { invoke } },
}));
vi.mock("@/lib/offlineQueue", () => ({ clearAll }));
vi.mock("@/lib/services/localCacheOwner", () => ({ clearProductLocalCache }));

import { AccountDeletionError, deleteAccountPermanently } from "@/lib/services/accountDeletionService";

describe("deleteAccountPermanently", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
    invoke.mockResolvedValue({ data: { deleted: true }, error: null });
    signOut.mockResolvedValue({ error: null });
    clearAll.mockResolvedValue(undefined);
  });

  it("exclui no servidor antes de limpar a conta local", async () => {
    await deleteAccountPermanently("user-1", "USER@EXAMPLE.COM");
    expect(invoke).toHaveBeenCalledWith("delete-account", { body: { email: "user@example.com" } });
    expect(clearProductLocalCache).toHaveBeenCalledWith("user-1");
    expect(clearAll).toHaveBeenCalledWith("user-1");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("não limpa dados locais quando o servidor rejeita", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("failed") });
    await expect(deleteAccountPermanently("user-1", "user@example.com")).rejects.toMatchObject({ code: "delete_failed" });
    expect(clearProductLocalCache).not.toHaveBeenCalled();
    expect(clearAll).not.toHaveBeenCalled();
  });

  it("exige uma sessão autenticada", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(deleteAccountPermanently("user-1", "user@example.com")).rejects.toBeInstanceOf(AccountDeletionError);
    expect(invoke).not.toHaveBeenCalled();
  });
});
''')

write("supabase/functions/delete-account/index.ts", r'''import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
''')

write("supabase/functions/delete-account/index_test.ts", r'''import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeEmail, safeDeleteError } from "./index.ts";

Deno.test("normalizeEmail trims and lowercases", () => {
  assertEquals(normalizeEmail("  USER@Example.COM "), "user@example.com");
});

Deno.test("normalizeEmail rejects non-string payloads", () => {
  assertEquals(normalizeEmail(null), "");
  assertEquals(normalizeEmail(123), "");
});

Deno.test("unknown deletion errors never leak provider details", () => {
  assertEquals(safeDeleteError(new Error("database detail with secret")), "delete_failed");
});
''')

write("supabase/migrations/20260802033000_remove_elo_and_permanent_account_deletion.sql", r'''-- Remove ELO Casal and make account deletion atomic with application-data cleanup.
BEGIN;

-- Public ELO API and tables are removed. Historical migrations remain immutable;
-- this forward migration is the canonical removal.
DROP FUNCTION IF EXISTS public.elo_create_household(text, text);
DROP FUNCTION IF EXISTS public.elo_join_household(text, text);
DROP TABLE IF EXISTS public.elo_state;
DROP TABLE IF EXISTS public.elo_members;
DROP TABLE IF EXISTS public.elo_households;
DROP FUNCTION IF EXISTS app_private.elo_create_household(text, text);
DROP FUNCTION IF EXISTS app_private.elo_join_household(text, text);
DROP FUNCTION IF EXISTS app_private.elo_is_member(uuid);
DROP FUNCTION IF EXISTS public.elo_touch_household();
DROP FUNCTION IF EXISTS public.elo_touch_state();

-- auth.admin.deleteUser performs the auth.users DELETE. This BEFORE DELETE
-- trigger removes every public row owned by the same user inside that database
-- transaction. Any cleanup failure aborts the account deletion instead of
-- leaving a partially deleted account.
CREATE OR REPLACE FUNCTION public.cleanup_application_data_before_auth_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT c.table_schema, c.table_name
      FROM information_schema.columns AS c
     WHERE c.table_schema = 'public'
       AND c.column_name = 'user_id'
       AND c.table_name NOT IN ('plan_members', 'plans')
     GROUP BY c.table_schema, c.table_name
     ORDER BY c.table_name
  LOOP
    EXECUTE format(
      'DELETE FROM %I.%I WHERE user_id::text = $1::text',
      v_table.table_schema,
      v_table.table_name
    ) USING OLD.id;
  END LOOP;

  IF to_regclass('public.plan_members') IS NOT NULL THEN
    DELETE FROM public.plan_members WHERE user_id::text = OLD.id::text;
  END IF;
  IF to_regclass('public.plans') IS NOT NULL THEN
    DELETE FROM public.plans WHERE user_id::text = OLD.id::text;
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_application_data_before_auth_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cleanup_application_data_before_auth_delete ON auth.users;
CREATE TRIGGER cleanup_application_data_before_auth_delete
BEFORE DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.cleanup_application_data_before_auth_delete();

COMMIT;
''')

write("supabase/tests/elo_removal_account_deletion.sql", r'''\set ON_ERROR_STOP on

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('elo_households', 'elo_members', 'elo_state');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ELO relations remain: %', v_count;
  END IF;

  SELECT count(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.proname LIKE 'elo_%'
     AND n.nspname IN ('public', 'app_private');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'ELO functions remain: %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'cleanup_application_data_before_auth_delete'
       AND tgrelid = 'auth.users'::regclass
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Permanent account cleanup trigger is missing';
  END IF;

  IF has_function_privilege('authenticated', 'public.cleanup_application_data_before_auth_delete()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated users must not execute cleanup trigger function';
  END IF;

  RAISE NOTICE 'ELO removal and permanent deletion contract: OK';
END $$;
''')

# Delete obsolete runtime artifacts and test contract. Historical migrations stay.
for relative in [
    "src/pages/Elo.tsx",
    "src/components/plan/ResetPlanDialog.tsx",
    "supabase/tests/elo_security_hardening.sql",
    "elo-online/index.html",
    "elo-online/manifest.webmanifest",
    "elo-online/sw.js",
    "elo-online/icon.svg",
]:
    target = ROOT / relative
    if target.exists():
        target.unlink()

# Ensure no runtime ELO route/page references remain.
for relative in ["src/App.tsx", "src/pages/Index.tsx", "src/pages/index/SettingsHub.tsx"]:
    content = read(relative)
    if "/elo" in content or "pages/Elo" in content or "ELO Casal" in content:
        raise RuntimeError(f"Stale ELO runtime reference in {relative}")

# Remove this temporary script from the resulting source commit.
Path(__file__).unlink()
