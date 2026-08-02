REVOKE EXECUTE ON FUNCTION public.elo_create_household(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.elo_join_household(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.elo_is_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.elo_create_household(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.elo_join_household(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.elo_is_member(uuid) TO authenticated;