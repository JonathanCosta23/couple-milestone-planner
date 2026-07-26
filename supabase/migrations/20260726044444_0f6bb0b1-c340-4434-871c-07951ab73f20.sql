
-- ============================================================
-- Subpasso 4.a — Identidade dos participantes (schema only)
-- ============================================================

-- 1) Novos campos em plan_members
ALTER TABLE public.plan_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS identity_status text NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS cpf_last4 text,
  ADD COLUMN IF NOT EXISTS linked_auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- Backfill: is_active → status. Preflight confirmou 0 inconsistências.
UPDATE public.plan_members
   SET status = CASE WHEN is_active THEN 'active' ELSE 'removed' END
 WHERE status = 'active' AND is_active = false;

UPDATE public.plan_members
   SET removed_at = COALESCE(removed_at, updated_at)
 WHERE status = 'removed' AND removed_at IS NULL;

-- CHECKs de domínio
ALTER TABLE public.plan_members
  DROP CONSTRAINT IF EXISTS plan_members_status_check,
  ADD  CONSTRAINT plan_members_status_check
    CHECK (status IN ('active','removed','pending_invitation'));

ALTER TABLE public.plan_members
  DROP CONSTRAINT IF EXISTS plan_members_identity_status_check,
  ADD  CONSTRAINT plan_members_identity_status_check
    CHECK (identity_status IN ('missing','verified','needs_review'));

-- cpf_last4: aceitar NULL ou exatamente 4 dígitos numéricos
ALTER TABLE public.plan_members
  DROP CONSTRAINT IF EXISTS plan_members_cpf_last4_check,
  ADD  CONSTRAINT plan_members_cpf_last4_check
    CHECK (cpf_last4 IS NULL OR cpf_last4 ~ '^[0-9]{4}$');

-- Consistência interna: se status=removed, removed_at deve existir
ALTER TABLE public.plan_members
  DROP CONSTRAINT IF EXISTS plan_members_removed_at_consistency,
  ADD  CONSTRAINT plan_members_removed_at_consistency
    CHECK (
      (status = 'removed' AND removed_at IS NOT NULL)
      OR (status <> 'removed')
    );

-- 2) Constraints de unicidade "no máximo 1 titular ativo / 1 parceiro ativo"
--    Índice único parcial em vez de unique constraint para permitir múltiplos
--    membros 'removed' historicamente.
DROP INDEX IF EXISTS ux_plan_members_one_active_primary;
CREATE UNIQUE INDEX ux_plan_members_one_active_primary
  ON public.plan_members (plan_id)
  WHERE status = 'active' AND is_primary = true;

DROP INDEX IF EXISTS ux_plan_members_one_active_partner;
CREATE UNIQUE INDEX ux_plan_members_one_active_partner
  ON public.plan_members (plan_id)
  WHERE status = 'active' AND is_primary = false;

-- 3) Tabela privada de identidade — CPF fica apenas em HMAC
--    Sem policies para authenticated; acesso somente via service_role/edge function.
CREATE TABLE IF NOT EXISTS public.plan_member_private_identity (
  member_id         uuid PRIMARY KEY REFERENCES public.plan_members(id) ON DELETE CASCADE,
  plan_id           uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL,
  cpf_hmac          text NOT NULL,
  hmac_key_version  text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Cinturão: cpf_hmac deve ser hex de 64 chars (SHA-256). Bloqueia CPF cru.
ALTER TABLE public.plan_member_private_identity
  DROP CONSTRAINT IF EXISTS pmpi_cpf_hmac_hex_check,
  ADD  CONSTRAINT pmpi_cpf_hmac_hex_check
    CHECK (cpf_hmac ~ '^[a-f0-9]{64}$');

-- Unicidade no escopo do plano — não global. Não revela CPF entre planos.
DROP INDEX IF EXISTS ux_pmpi_plan_cpf_hmac;
CREATE UNIQUE INDEX ux_pmpi_plan_cpf_hmac
  ON public.plan_member_private_identity (plan_id, cpf_hmac);

-- GRANTs: authenticated NÃO recebe nenhum privilégio. Apenas service_role.
REVOKE ALL ON public.plan_member_private_identity FROM anon, authenticated, PUBLIC;
GRANT  ALL ON public.plan_member_private_identity TO service_role;

-- RLS habilitada sem policies para authenticated: bloqueia SELECT/INSERT/UPDATE/DELETE
-- vindos do client. service_role bypassa RLS por padrão.
ALTER TABLE public.plan_member_private_identity ENABLE ROW LEVEL SECURITY;

-- Trigger de updated_at
DROP TRIGGER IF EXISTS pmpi_set_updated_at ON public.plan_member_private_identity;
CREATE TRIGGER pmpi_set_updated_at
  BEFORE UPDATE ON public.plan_member_private_identity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Trigger que bloqueia registros financeiros vinculados a membro 'removed'
CREATE OR REPLACE FUNCTION public.block_writes_to_removed_member()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_status    text;
BEGIN
  v_member_id := COALESCE(NEW.member_id, NULL);
  IF v_member_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT status INTO v_status
    FROM public.plan_members
   WHERE id = v_member_id
   LIMIT 1;
  IF v_status = 'removed' THEN
    RAISE EXCEPTION 'Cannot attach % to a removed member.', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- assets/income/expenses/debts têm member_id direto.
-- monthly_member_tracking usa plan_member_id → função equivalente.
CREATE OR REPLACE FUNCTION public.block_writes_to_removed_member_mmt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.plan_member_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT status INTO v_status
    FROM public.plan_members
   WHERE id = NEW.plan_member_id
   LIMIT 1;
  IF v_status = 'removed' THEN
    RAISE EXCEPTION 'Cannot attach monthly_member_tracking to a removed member.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assets_block_removed ON public.assets;
CREATE TRIGGER trg_assets_block_removed
  BEFORE INSERT OR UPDATE OF member_id ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.block_writes_to_removed_member();

DROP TRIGGER IF EXISTS trg_income_block_removed ON public.income;
CREATE TRIGGER trg_income_block_removed
  BEFORE INSERT OR UPDATE OF member_id ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.block_writes_to_removed_member();

DROP TRIGGER IF EXISTS trg_expenses_block_removed ON public.expenses;
CREATE TRIGGER trg_expenses_block_removed
  BEFORE INSERT OR UPDATE OF member_id ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.block_writes_to_removed_member();

DROP TRIGGER IF EXISTS trg_debts_block_removed ON public.debts;
CREATE TRIGGER trg_debts_block_removed
  BEFORE INSERT OR UPDATE OF member_id ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.block_writes_to_removed_member();

DROP TRIGGER IF EXISTS trg_mmt_block_removed ON public.monthly_member_tracking;
CREATE TRIGGER trg_mmt_block_removed
  BEFORE INSERT OR UPDATE OF plan_member_id ON public.monthly_member_tracking
  FOR EACH ROW EXECUTE FUNCTION public.block_writes_to_removed_member_mmt();
