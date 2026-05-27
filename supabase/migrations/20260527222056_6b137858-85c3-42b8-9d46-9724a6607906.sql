-- Harden SECURITY DEFINER function execution: revoke from PUBLIC and anon,
-- grant EXECUTE only to authenticated for user-facing RPCs.
-- Internal trigger functions stay restricted (no client-facing EXECUTE).

-- handle_new_user runs as auth trigger; no external EXECUTE needed.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Validation triggers — never called from clients.
REVOKE EXECUTE ON FUNCTION public.validate_asset_member_link() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_flow_member_link() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- User-facing RPCs: revoke broad access, grant only to signed-in users.
-- Each function validates auth.uid() internally.
REVOKE EXECUTE ON FUNCTION public.reset_user_plan_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_user_plan_data() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_plan_with_members(
  text, text, integer, text, integer, numeric, numeric, numeric, integer, text, text, boolean, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_plan_with_members(
  text, text, integer, text, integer, numeric, numeric, numeric, integer, text, text, boolean, boolean
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_plan_with_members_v2(
  text, text, uuid, integer, text, integer, numeric, numeric, numeric, integer, text, text, boolean, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_plan_with_members_v2(
  text, text, uuid, integer, text, integer, numeric, numeric, numeric, integer, text, text, boolean, boolean
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_month_with_members(uuid, text, jsonb, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_month_with_members(uuid, text, jsonb, text, boolean) TO authenticated;