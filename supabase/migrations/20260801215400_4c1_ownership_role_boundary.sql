-- =====================================================================
-- Passo 4.c.1 — fronteira de autenticação do trigger de ownership
--
-- `auth.uid()` pode permanecer definido em sessões administrativas de teste.
-- A autorização por usuário é obrigatória para a role cliente authenticated;
-- postgres/service_role continuam aptos a executar migrations, backfills e
-- operações internas controladas. RLS permanece habilitada nas tabelas.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.enforce_financial_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_plan_user uuid;
  v_member_plan uuid;
  v_member_user uuid;
  v_member_status text;
  v_link_changed boolean := true;
  v_session_role text := current_setting('role', true);
BEGIN
  SELECT p.user_id INTO v_plan_user
    FROM public.plans p
   WHERE p.id = NEW.plan_id;

  IF v_plan_user IS NULL THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE='no_data_found';
  END IF;

  -- Somente a role cliente precisa ser comparada ao JWT. Operações internas
  -- passam por funções SECURITY DEFINER ou service_role e têm contratos
  -- próprios. O cliente continua protegido também por RLS.
  IF v_session_role = 'authenticated'
     AND (auth.uid() IS NULL OR auth.uid() <> v_plan_user) THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE='no_data_found';
  END IF;

  -- Nunca confiar em user_id recebido no payload.
  NEW.user_id := v_plan_user;

  IF NEW.ownership_scope IS NULL THEN
    RAISE EXCEPTION 'ownership_required' USING ERRCODE='not_null_violation';
  END IF;
  IF NEW.ownership_scope NOT IN ('individual','shared','needs_review') THEN
    RAISE EXCEPTION 'ownership_scope_invalid' USING ERRCODE='check_violation';
  END IF;

  IF TG_OP='UPDATE' THEN
    v_link_changed := NEW.member_id IS DISTINCT FROM OLD.member_id
                   OR NEW.ownership_scope IS DISTINCT FROM OLD.ownership_scope
                   OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
                   OR NEW.user_id IS DISTINCT FROM OLD.user_id;
  END IF;

  IF NEW.ownership_scope='individual' THEN
    IF NEW.member_id IS NULL THEN
      RAISE EXCEPTION 'member_required' USING ERRCODE='not_null_violation';
    END IF;

    SELECT pm.plan_id, pm.user_id, pm.status
      INTO v_member_plan, v_member_user, v_member_status
      FROM public.plan_members pm
     WHERE pm.id = NEW.member_id;

    IF v_member_plan IS NULL
       OR v_member_plan <> NEW.plan_id
       OR v_member_user <> v_plan_user THEN
      RAISE EXCEPTION 'member_scope_mismatch' USING ERRCODE='check_violation';
    END IF;

    IF v_link_changed AND v_member_status <> 'active' THEN
      RAISE EXCEPTION 'member_not_active' USING ERRCODE='check_violation';
    END IF;
  ELSIF NEW.member_id IS NOT NULL THEN
    RAISE EXCEPTION 'ownership_member_mismatch' USING ERRCODE='check_violation';
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.enforce_financial_ownership()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_financial_ownership()
  TO service_role;
