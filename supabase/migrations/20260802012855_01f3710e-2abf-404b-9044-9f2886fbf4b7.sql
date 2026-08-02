REVOKE ALL ON public.elo_households FROM anon, authenticated;
REVOKE ALL ON public.elo_members FROM anon, authenticated;
REVOKE ALL ON public.elo_state FROM anon, authenticated;

GRANT SELECT ON public.elo_households TO authenticated;
GRANT UPDATE (name) ON public.elo_households TO authenticated;

GRANT SELECT ON public.elo_members TO authenticated;
GRANT UPDATE (display_name) ON public.elo_members TO authenticated;

GRANT SELECT, INSERT ON public.elo_state TO authenticated;
GRANT UPDATE (data, version, updated_by, updated_at) ON public.elo_state TO authenticated;

GRANT ALL ON public.elo_households TO service_role;
GRANT ALL ON public.elo_members TO service_role;
GRANT ALL ON public.elo_state TO service_role;