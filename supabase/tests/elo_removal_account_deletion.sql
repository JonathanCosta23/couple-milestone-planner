\set ON_ERROR_STOP on

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
