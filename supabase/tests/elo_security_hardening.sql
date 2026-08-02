-- ELO security regression suite.
-- Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/elo_security_hardening.sql

BEGIN;

DO $$
DECLARE
  user_a uuid := '00000000-0000-0000-0000-0000000e1001';
  user_b uuid := '00000000-0000-0000-0000-0000000e1002';
  user_c uuid := '00000000-0000-0000-0000-0000000e1003';
  household_a uuid;
  household_c uuid;
  code_a text;
  state_version bigint;
  state_updated_by uuid;
  blocked boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (user_a, 'elo-a@test.local', 'authenticated', 'authenticated'),
    (user_b, 'elo-b@test.local', 'authenticated', 'authenticated'),
    (user_c, 'elo-c@test.local', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- A creates the household and is the only owner.
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);

  SELECT household_id, invite_code INTO household_a, code_a
    FROM public.elo_create_household('Casa A', 'Ana');

  ASSERT household_a IS NOT NULL AND code_a ~ '^[A-F0-9]{10}$',
    'create must return a valid household and invite code';
  ASSERT (SELECT role FROM public.elo_members WHERE user_id = user_a) = 'owner',
    'creator must be owner';

  -- B joins only through the invite-code lifecycle RPC.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  PERFORM public.elo_join_household(lower(code_a), 'Bia');

  ASSERT (SELECT household_id FROM public.elo_members WHERE user_id = user_b) = household_a,
    'invite join must use the expected household';
  ASSERT (SELECT role FROM public.elo_members WHERE user_id = user_b) = 'member',
    'invite join cannot self-promote';

  -- A third account cannot take over or overfill a couple household.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_c::text, 'role', 'authenticated')::text, true);
  blocked := false;
  BEGIN
    PERFORM public.elo_join_household(code_a, 'Cris');
  EXCEPTION WHEN check_violation THEN
    blocked := SQLERRM = 'household_full';
  END;
  ASSERT blocked, 'third member must be rejected with household_full';
  ASSERT NOT EXISTS (SELECT 1 FROM public.elo_members WHERE user_id = user_c),
    'failed join cannot leave a membership row';

  -- B can change only display_name on the own membership row.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  UPDATE public.elo_members SET display_name = 'Beatriz' WHERE user_id = user_b;
  ASSERT (SELECT display_name FROM public.elo_members WHERE user_id = user_b) = 'Beatriz',
    'self display name update should succeed';

  blocked := false;
  BEGIN
    UPDATE public.elo_members SET role = 'owner' WHERE user_id = user_b;
  EXCEPTION WHEN insufficient_privilege THEN blocked := true;
  END;
  ASSERT blocked, 'authenticated cannot update role';

  -- C creates another household; B cannot move the own row into it.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_c::text, 'role', 'authenticated')::text, true);
  SELECT household_id INTO household_c
    FROM public.elo_create_household('Casa C', 'Cris');

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  blocked := false;
  BEGIN
    UPDATE public.elo_members SET household_id = household_c WHERE user_id = user_b;
  EXCEPTION WHEN insufficient_privilege THEN blocked := true;
  END;
  ASSERT blocked, 'authenticated cannot move membership to another household';
  ASSERT (SELECT household_id FROM public.elo_members WHERE user_id = user_b) = household_a,
    'blocked move must preserve the original household';

  -- State technical fields are server-owned.
  UPDATE public.elo_state SET data = '{"ok":true}'::jsonb WHERE household_id = household_a;
  PERFORM set_config('role', 'postgres', true);
  SELECT version, updated_by INTO state_version, state_updated_by
    FROM public.elo_state WHERE household_id = household_a;
  ASSERT state_version = 2, 'state version must be incremented by trigger';
  ASSERT state_updated_by = user_b, 'state updated_by must be derived from auth.uid()';

  -- RLS isolation: A cannot see C household.
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  ASSERT NOT EXISTS (SELECT 1 FROM public.elo_households WHERE id = household_c),
    'RLS must hide another household';

  -- Exposed SECURITY DEFINER lookup helpers were removed from public schema.
  PERFORM set_config('role', 'postgres', true);
  ASSERT to_regprocedure('public.elo_is_member(uuid)') IS NULL,
    'public elo_is_member must not remain exposed';
  ASSERT to_regprocedure('public.elo_member_household_of(uuid)') IS NULL,
    'public elo_member_household_of must be removed';
  ASSERT to_regprocedure('public.elo_member_role_of(uuid)') IS NULL,
    'public elo_member_role_of must be removed';
  ASSERT to_regprocedure('app_private.elo_is_member(uuid)') IS NOT NULL,
    'private membership helper must exist';
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.elo_create_household(text,text)'::regprocedure),
    'public create wrapper must be SECURITY INVOKER';
  ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.elo_join_household(text,text)'::regprocedure),
    'public join wrapper must be SECURITY INVOKER';
  ASSERT (SELECT prosecdef FROM pg_proc WHERE oid = 'app_private.elo_create_household(text,text)'::regprocedure),
    'private create implementation must be SECURITY DEFINER';
  ASSERT (SELECT prosecdef FROM pg_proc WHERE oid = 'app_private.elo_join_household(text,text)'::regprocedure),
    'private join implementation must be SECURITY DEFINER';

  -- Exact client privilege boundary.
  ASSERT has_table_privilege('authenticated', 'public.elo_members', 'SELECT'),
    'authenticated needs SELECT on elo_members';
  ASSERT has_column_privilege('authenticated', 'public.elo_members', 'display_name', 'UPDATE'),
    'authenticated needs UPDATE(display_name)';
  ASSERT NOT has_column_privilege('authenticated', 'public.elo_members', 'role', 'UPDATE'),
    'authenticated cannot update role';
  ASSERT NOT has_column_privilege('authenticated', 'public.elo_members', 'household_id', 'UPDATE'),
    'authenticated cannot update household_id';
  ASSERT NOT has_table_privilege('authenticated', 'public.elo_members', 'INSERT'),
    'authenticated cannot insert elo_members directly';
  ASSERT NOT has_table_privilege('authenticated', 'public.elo_members', 'DELETE'),
    'authenticated cannot delete elo_members directly';
  ASSERT has_column_privilege('authenticated', 'public.elo_state', 'data', 'UPDATE'),
    'authenticated needs UPDATE(data)';
  ASSERT NOT has_column_privilege('authenticated', 'public.elo_state', 'updated_by', 'UPDATE'),
    'authenticated cannot forge updated_by';
  ASSERT NOT has_column_privilege('authenticated', 'public.elo_state', 'version', 'UPDATE'),
    'authenticated cannot forge version';

  DELETE FROM public.elo_state WHERE household_id IN (household_a, household_c);
  DELETE FROM public.elo_members WHERE household_id IN (household_a, household_c);
  DELETE FROM public.elo_households WHERE id IN (household_a, household_c);
  DELETE FROM auth.users WHERE id IN (user_a, user_b, user_c);

  RAISE NOTICE 'elo security hardening: OK';
END $$;

ROLLBACK;
