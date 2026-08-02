CREATE OR REPLACE FUNCTION public.elo_member_household_of(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT household_id FROM public.elo_members WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.elo_member_role_of(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT role::text FROM public.elo_members WHERE user_id = _user_id LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.elo_member_household_of(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.elo_member_role_of(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.elo_member_household_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.elo_member_role_of(uuid) TO authenticated;

DROP POLICY IF EXISTS elo_members_update_self ON public.elo_members;

CREATE POLICY elo_members_update_self ON public.elo_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND household_id = public.elo_member_household_of(auth.uid())
  AND role::text = public.elo_member_role_of(auth.uid())
);