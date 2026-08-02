-- 1. SECURITY DEFINER internos: remover EXECUTE de usuários logados
REVOKE EXECUTE ON FUNCTION public.assert_plan_mode_consistency() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.assert_plan_mode_consistency_for(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.set_plan_member_identity_v1(uuid, uuid, text, text, text) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.set_plan_member_identity_v1(uuid, uuid, text, text, text) TO service_role;

-- 2. Elo Casal: guardas de imutabilidade (aplicadas apenas se as tabelas existirem)
DO $do$
BEGIN
  IF to_regclass('public.elo_members') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.elo_members_guard_immutable()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $body$
    BEGIN
      IF NEW.household_id IS DISTINCT FROM OLD.household_id
         OR NEW.user_id IS DISTINCT FROM OLD.user_id
         OR NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'membership_change_requires_rpc'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      RETURN NEW;
    END;
    $body$;
  $fn$;

  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.elo_households_guard_immutable()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $body$
    BEGIN
      IF NEW.invite_code IS DISTINCT FROM OLD.invite_code
         OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'household_field_immutable'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      RETURN NEW;
    END;
    $body$;
  $fn$;

  EXECUTE 'DROP TRIGGER IF EXISTS elo_members_guard_immutable_trg ON public.elo_members';
  EXECUTE 'CREATE TRIGGER elo_members_guard_immutable_trg BEFORE UPDATE ON public.elo_members FOR EACH ROW EXECUTE FUNCTION public.elo_members_guard_immutable()';
  EXECUTE 'DROP TRIGGER IF EXISTS elo_households_guard_immutable_trg ON public.elo_households';
  EXECUTE 'CREATE TRIGGER elo_households_guard_immutable_trg BEFORE UPDATE ON public.elo_households FOR EACH ROW EXECUTE FUNCTION public.elo_households_guard_immutable()';

  EXECUTE 'REVOKE UPDATE ON public.elo_members FROM authenticated';
  EXECUTE 'GRANT UPDATE (display_name) ON public.elo_members TO authenticated';
  EXECUTE 'REVOKE UPDATE ON public.elo_households FROM authenticated';
  EXECUTE 'GRANT UPDATE (name, updated_at) ON public.elo_households TO authenticated';
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.elo_members_guard_immutable() FROM authenticated, anon, public';
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.elo_households_guard_immutable() FROM authenticated, anon, public';
END
$do$;