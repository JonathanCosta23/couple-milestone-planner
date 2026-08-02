\set ON_ERROR_STOP on

BEGIN;

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

  RAISE NOTICE 'ELO schema removal contract: OK';
END $$;

CREATE TABLE public.__test_account_owned_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payload text NOT NULL
);

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-0000-0000-0000000d0001';
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (v_user_id, 'permanent-delete@test.local', 'authenticated', 'authenticated');

  INSERT INTO public.__test_account_owned_data (user_id, payload)
  VALUES (v_user_id, 'must be deleted');

  DELETE FROM auth.users WHERE id = v_user_id;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Authentication user was not deleted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.__test_account_owned_data WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Owned application data was not deleted';
  END IF;

  RAISE NOTICE 'Permanent authentication and application-data deletion: OK';
END $$;

DROP TABLE public.__test_account_owned_data;

ROLLBACK;
