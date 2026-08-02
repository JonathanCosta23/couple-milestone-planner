-- ELO security hardening
-- 1. membership lookup leaves the exposed public API schema;
-- 2. direct writes are reduced to display_name, household name and state data;
-- 3. household lifecycle RPCs validate identity, capacity and input bounds;
-- 4. mutable technical fields are always derived server-side.

BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.elo_is_member(p_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.elo_members AS m
     WHERE m.household_id = p_household_id
       AND m.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION app_private.elo_is_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.elo_is_member(uuid) TO authenticated, service_role;

-- Policies no longer depend on SECURITY DEFINER helpers in the exposed schema.
DROP POLICY IF EXISTS elo_households_select ON public.elo_households;
CREATE POLICY elo_households_select ON public.elo_households
FOR SELECT TO authenticated
USING (app_private.elo_is_member(id));

DROP POLICY IF EXISTS elo_households_update ON public.elo_households;
CREATE POLICY elo_households_update ON public.elo_households
FOR UPDATE TO authenticated
USING (app_private.elo_is_member(id))
WITH CHECK (app_private.elo_is_member(id));

DROP POLICY IF EXISTS elo_members_select ON public.elo_members;
CREATE POLICY elo_members_select ON public.elo_members
FOR SELECT TO authenticated
USING (app_private.elo_is_member(household_id));

DROP POLICY IF EXISTS elo_members_update_self ON public.elo_members;
DROP POLICY IF EXISTS elo_members_update_display_name_only ON public.elo_members;
CREATE POLICY elo_members_update_display_name_only ON public.elo_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY elo_members_update_display_name_only ON public.elo_members IS
  'Only the caller own row is eligible. SQL column grants and the immutable trigger restrict the mutation to display_name.';

DROP POLICY IF EXISTS elo_state_select ON public.elo_state;
CREATE POLICY elo_state_select ON public.elo_state
FOR SELECT TO authenticated
USING (app_private.elo_is_member(household_id));

DROP POLICY IF EXISTS elo_state_insert ON public.elo_state;
DROP POLICY IF EXISTS elo_state_update ON public.elo_state;
CREATE POLICY elo_state_update ON public.elo_state
FOR UPDATE TO authenticated
USING (app_private.elo_is_member(household_id))
WITH CHECK (app_private.elo_is_member(household_id));

-- Exact client privileges. Lifecycle and membership creation remain RPC-only.
REVOKE ALL ON public.elo_households FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.elo_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.elo_state FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.elo_households TO authenticated;
GRANT UPDATE (name) ON public.elo_households TO authenticated;
GRANT SELECT ON public.elo_members TO authenticated;
GRANT UPDATE (display_name) ON public.elo_members TO authenticated;
GRANT SELECT ON public.elo_state TO authenticated;
GRANT UPDATE (data) ON public.elo_state TO authenticated;

GRANT ALL ON public.elo_households TO service_role;
GRANT ALL ON public.elo_members TO service_role;
GRANT ALL ON public.elo_state TO service_role;

-- Technical fields are server-owned.
CREATE OR REPLACE FUNCTION public.elo_touch_household()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS elo_household_touch ON public.elo_households;
CREATE TRIGGER elo_household_touch
BEFORE UPDATE ON public.elo_households
FOR EACH ROW EXECUTE FUNCTION public.elo_touch_household();

CREATE OR REPLACE FUNCTION public.elo_touch_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.elo_touch_household() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.elo_touch_state() FROM PUBLIC, anon, authenticated;

-- Remove exposed helpers introduced only to pin household_id/role in RLS.
-- Column-level grants + immutable trigger now provide that guarantee without
-- making signed-in users callers of extra SECURITY DEFINER functions.
DROP FUNCTION IF EXISTS public.elo_member_household_of(uuid);
DROP FUNCTION IF EXISTS public.elo_member_role_of(uuid);

-- Replace the old public membership helper after all policies were migrated.
DROP FUNCTION IF EXISTS public.elo_is_member(uuid);

CREATE OR REPLACE FUNCTION app_private.elo_create_household(
  p_name text,
  p_display_name text
)
RETURNS TABLE (household_id uuid, invite_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing uuid;
  v_household_id uuid;
  v_invite_code text;
  v_name text := coalesce(nullif(btrim(p_name), ''), 'ELO Casal');
  v_display_name text := coalesce(nullif(btrim(p_display_name), ''), 'Pessoa 1');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF char_length(v_name) > 80 OR char_length(v_display_name) > 80 THEN
    RAISE EXCEPTION 'invalid_household_payload' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  SELECT m.household_id INTO v_existing
    FROM public.elo_members AS m
   WHERE m.user_id = v_user_id
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY
      SELECT h.id, h.invite_code
        FROM public.elo_households AS h
       WHERE h.id = v_existing;
    RETURN;
  END IF;

  v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  INSERT INTO public.elo_households(name, invite_code, created_by)
  VALUES (v_name, v_invite_code, v_user_id)
  RETURNING id INTO v_household_id;

  INSERT INTO public.elo_members(household_id, user_id, display_name, role)
  VALUES (v_household_id, v_user_id, v_display_name, 'owner');

  INSERT INTO public.elo_state(household_id, data, updated_by)
  VALUES (v_household_id, '{}'::jsonb, v_user_id);

  RETURN QUERY SELECT v_household_id, v_invite_code;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.elo_join_household(
  p_invite_code text,
  p_display_name text
)
RETURNS TABLE (household_id uuid, invite_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing uuid;
  v_household_id uuid;
  v_code text;
  v_member_count integer;
  v_input_code text := upper(btrim(coalesce(p_invite_code, '')));
  v_display_name text := coalesce(nullif(btrim(p_display_name), ''), 'Pessoa 2');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_input_code !~ '^[A-F0-9]{10}$' OR char_length(v_display_name) > 80 THEN
    RAISE EXCEPTION 'invalid_invite_payload' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  SELECT m.household_id INTO v_existing
    FROM public.elo_members AS m
   WHERE m.user_id = v_user_id
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY
      SELECT h.id, h.invite_code
        FROM public.elo_households AS h
       WHERE h.id = v_existing;
    RETURN;
  END IF;

  SELECT h.id, h.invite_code
    INTO v_household_id, v_code
    FROM public.elo_households AS h
   WHERE h.invite_code = v_input_code
   FOR UPDATE;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'invalid_invite_code' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT count(*) INTO v_member_count
    FROM public.elo_members AS m
   WHERE m.household_id = v_household_id;

  IF v_member_count >= 2 THEN
    RAISE EXCEPTION 'household_full' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.elo_members(household_id, user_id, display_name, role)
  VALUES (v_household_id, v_user_id, v_display_name, 'member');

  RETURN QUERY SELECT v_household_id, v_code;
END;
$$;

REVOKE ALL ON FUNCTION app_private.elo_create_household(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.elo_join_household(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.elo_create_household(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.elo_join_household(text, text) TO authenticated, service_role;

-- Exposed wrappers are SECURITY INVOKER. The privileged implementation stays
-- in a non-exposed schema and can only create the caller own membership.
CREATE OR REPLACE FUNCTION public.elo_create_household(
  p_name text DEFAULT 'ELO Casal',
  p_display_name text DEFAULT 'Pessoa 1'
)
RETURNS TABLE (household_id uuid, invite_code text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, app_private
AS $$
  SELECT * FROM app_private.elo_create_household(p_name, p_display_name);
$$;

CREATE OR REPLACE FUNCTION public.elo_join_household(
  p_invite_code text,
  p_display_name text DEFAULT 'Pessoa 2'
)
RETURNS TABLE (household_id uuid, invite_code text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public, app_private
AS $$
  SELECT * FROM app_private.elo_join_household(p_invite_code, p_display_name);
$$;

REVOKE ALL ON FUNCTION public.elo_create_household(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.elo_join_household(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.elo_create_household(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.elo_join_household(text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.elo_create_household(text, text) IS
  'SECURITY INVOKER wrapper. Atomic implementation lives in app_private and creates only the caller own owner membership.';
COMMENT ON FUNCTION public.elo_join_household(text, text) IS
  'SECURITY INVOKER wrapper. Requires a valid invite code and creates only the caller own member row.';

COMMIT;
