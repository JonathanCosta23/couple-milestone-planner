-- Remove ELO Casal and make account deletion atomic with application-data cleanup.
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
    SELECT
      c.table_schema,
      c.table_name,
      CASE c.table_name
        WHEN 'plan_members' THEN 90
        WHEN 'plans' THEN 100
        ELSE 0
      END AS delete_order
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'user_id'
    GROUP BY c.table_schema, c.table_name
    ORDER BY delete_order, c.table_name
  LOOP
    EXECUTE format(
      'DELETE FROM %I.%I WHERE user_id::text = $1::text',
      v_table.table_schema,
      v_table.table_name
    ) USING OLD.id;
  END LOOP;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_application_data_before_auth_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cleanup_application_data_before_auth_delete ON auth.users;
CREATE TRIGGER cleanup_application_data_before_auth_delete
BEFORE DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.cleanup_application_data_before_auth_delete();

COMMIT;
