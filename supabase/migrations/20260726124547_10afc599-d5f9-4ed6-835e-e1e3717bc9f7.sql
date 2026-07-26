
-- =====================================================================
-- Subpasso 4.a.1 — Hardening de identidade e integridade dos membros
-- =====================================================================

-- --------------------------------------------------------------
-- 1) Sincronização automática entre status e is_active
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_plan_member_status_flags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_status_changed boolean;
  v_active_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NULL THEN
      NEW.status := 'active';
    END IF;
    IF NEW.status = 'active' THEN
      NEW.is_active := true;
      NEW.removed_at := NULL;
    ELSIF NEW.status = 'removed' THEN
      NEW.is_active := false;
      NEW.removed_at := COALESCE(NEW.removed_at, now());
    ELSIF NEW.status = 'pending_invitation' THEN
      NEW.is_active := false;
      NEW.removed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  v_status_changed := (NEW.status IS DISTINCT FROM OLD.status);
  v_active_changed := (NEW.is_active IS DISTINCT FROM OLD.is_active);

  IF v_status_changed THEN
    IF NEW.status = 'active' THEN
      NEW.is_active := true;
      NEW.removed_at := NULL;
    ELSIF NEW.status = 'removed' THEN
      NEW.is_active := false;
      NEW.removed_at := COALESCE(NEW.removed_at, now());
    ELSIF NEW.status = 'pending_invitation' THEN
      NEW.is_active := false;
      NEW.removed_at := NULL;
    END IF;
  ELSIF v_active_changed THEN
    IF OLD.is_active = true AND NEW.is_active = false THEN
      -- Compat com writers legados: desativar equivale a remover.
      NEW.status := 'removed';
      NEW.removed_at := COALESCE(NEW.removed_at, now());
    ELSIF OLD.is_active = false AND NEW.is_active = true THEN
      -- Reativação só via RPC autorizada mudando status explicitamente.
      RAISE EXCEPTION 'explicit_reintegration_required'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_members_sync_status ON public.plan_members;
CREATE TRIGGER trg_plan_members_sync_status
  BEFORE INSERT OR UPDATE ON public.plan_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_plan_member_status_flags();

-- Backfill defensivo antes da constraint dura.
UPDATE public.plan_members
   SET status = 'active', removed_at = NULL
 WHERE status = 'active' AND (is_active = false OR removed_at IS NOT NULL);

UPDATE public.plan_members
   SET is_active = false,
       removed_at = COALESCE(removed_at, updated_at, now())
 WHERE status = 'removed';

UPDATE public.plan_members
   SET is_active = false, removed_at = NULL
 WHERE status = 'pending_invitation';

ALTER TABLE public.plan_members
  DROP CONSTRAINT IF EXISTS plan_members_status_flags_consistency,
  ADD  CONSTRAINT plan_members_status_flags_consistency
    CHECK (
      (status = 'active' AND is_active = true  AND removed_at IS NULL)
      OR (status = 'removed' AND is_active = false AND removed_at IS NOT NULL)
      OR (status = 'pending_invitation' AND is_active = false AND removed_at IS NULL)
    );

-- --------------------------------------------------------------
-- 2) linked_auth_user_id: FK + backfill primário + índice único parcial
-- --------------------------------------------------------------
UPDATE public.plan_members pm
   SET linked_auth_user_id = pm.user_id
 WHERE pm.is_primary = true
   AND pm.linked_auth_user_id IS NULL
   AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = pm.user_id);

ALTER TABLE public.plan_members
  DROP CONSTRAINT IF EXISTS plan_members_linked_auth_user_fk;
ALTER TABLE public.plan_members
  ADD  CONSTRAINT plan_members_linked_auth_user_fk
    FOREIGN KEY (linked_auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS ux_plan_members_linked_auth_per_plan;
CREATE UNIQUE INDEX ux_plan_members_linked_auth_per_plan
  ON public.plan_members (plan_id, linked_auth_user_id)
  WHERE linked_auth_user_id IS NOT NULL AND status = 'active';

-- --------------------------------------------------------------
-- 3) Integridade composta da tabela privada
-- --------------------------------------------------------------
ALTER TABLE public.plan_members
  DROP CONSTRAINT IF EXISTS plan_members_id_plan_user_unique,
  ADD  CONSTRAINT plan_members_id_plan_user_unique UNIQUE (id, plan_id, user_id);

-- Recria FK composta na tabela privada de identidade.
ALTER TABLE public.plan_member_private_identity
  DROP CONSTRAINT IF EXISTS plan_member_private_identity_member_id_fkey,
  DROP CONSTRAINT IF EXISTS pmpi_member_plan_user_fk,
  DROP CONSTRAINT IF EXISTS pmpi_user_fk;

ALTER TABLE public.plan_member_private_identity
  ADD CONSTRAINT pmpi_member_plan_user_fk
    FOREIGN KEY (member_id, plan_id, user_id)
    REFERENCES public.plan_members(id, plan_id, user_id)
    ON DELETE CASCADE;

ALTER TABLE public.plan_member_private_identity
  ADD CONSTRAINT pmpi_user_fk
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- --------------------------------------------------------------
-- 4) Triggers financeiros: exigir status = 'active'
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_writes_to_removed_member()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.member_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT status INTO v_status
    FROM public.plan_members
   WHERE id = NEW.member_id
   LIMIT 1;
  IF v_status IS NULL OR v_status <> 'active' THEN
    RAISE EXCEPTION 'member_not_active'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

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
  IF v_status IS NULL OR v_status <> 'active' THEN
    RAISE EXCEPTION 'member_not_active'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Guarda-chuva para fgc_guarantee_events (holder_member_id opcional).
CREATE OR REPLACE FUNCTION public.block_writes_to_removed_holder_fge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.holder_member_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT status INTO v_status
    FROM public.plan_members
   WHERE id = NEW.holder_member_id
   LIMIT 1;
  IF v_status IS NULL OR v_status <> 'active' THEN
    RAISE EXCEPTION 'member_not_active'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fge_block_removed ON public.fgc_guarantee_events;
CREATE TRIGGER trg_fge_block_removed
  BEFORE INSERT OR UPDATE OF holder_member_id ON public.fgc_guarantee_events
  FOR EACH ROW EXECUTE FUNCTION public.block_writes_to_removed_holder_fge();

-- --------------------------------------------------------------
-- 5) RPC transacional set_plan_member_identity_v1
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_plan_member_identity_v1(
  p_authenticated_user_id uuid,
  p_member_id             uuid,
  p_cpf_hmac              text,
  p_cpf_last4             text,
  p_hmac_key_version      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member record;
BEGIN
  IF p_authenticated_user_id IS NULL OR p_member_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF p_cpf_hmac IS NULL OR p_cpf_hmac !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF p_cpf_last4 IS NULL OR p_cpf_last4 !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF p_hmac_key_version IS NULL OR length(p_hmac_key_version) = 0 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;

  SELECT id, plan_id, user_id, status
    INTO v_member
    FROM public.plan_members
   WHERE id = p_member_id
   LIMIT 1;

  IF NOT FOUND OR v_member.user_id <> p_authenticated_user_id THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_member.status <> 'active' THEN
    RAISE EXCEPTION 'member_not_active' USING ERRCODE = 'check_violation';
  END IF;

  -- Duplicidade dentro do mesmo plano (nunca cross-plan).
  IF EXISTS (
    SELECT 1 FROM public.plan_member_private_identity
     WHERE plan_id = v_member.plan_id
       AND cpf_hmac = p_cpf_hmac
       AND member_id <> p_member_id
  ) THEN
    RAISE EXCEPTION 'duplicate_in_plan' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.plan_member_private_identity AS pmpi
    (member_id, plan_id, user_id, cpf_hmac, hmac_key_version)
  VALUES
    (p_member_id, v_member.plan_id, v_member.user_id, p_cpf_hmac, p_hmac_key_version)
  ON CONFLICT (member_id) DO UPDATE
    SET cpf_hmac = EXCLUDED.cpf_hmac,
        hmac_key_version = EXCLUDED.hmac_key_version,
        updated_at = now();

  UPDATE public.plan_members
     SET cpf_last4 = p_cpf_last4,
         identity_status = 'verified',
         updated_at = now()
   WHERE id = p_member_id;

  RETURN jsonb_build_object(
    'member_id', p_member_id,
    'cpf_last4', p_cpf_last4,
    'identity_status', 'verified'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_plan_member_identity_v1(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_plan_member_identity_v1(uuid, uuid, text, text, text) TO service_role;
