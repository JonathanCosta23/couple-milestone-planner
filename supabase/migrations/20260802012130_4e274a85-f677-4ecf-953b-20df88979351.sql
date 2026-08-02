CREATE TABLE IF NOT EXISTS public.elo_households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'ELO Casal',
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.elo_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.elo_households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.elo_state (
  household_id uuid PRIMARY KEY REFERENCES public.elo_households(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.elo_is_member(p_household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.elo_members m
    WHERE m.household_id = p_household_id AND m.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.elo_is_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.elo_is_member(uuid) TO authenticated;

GRANT SELECT ON public.elo_households TO authenticated;
GRANT UPDATE (name, updated_at) ON public.elo_households TO authenticated;
GRANT SELECT ON public.elo_members TO authenticated;
GRANT UPDATE (display_name) ON public.elo_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.elo_state TO authenticated;
GRANT ALL ON public.elo_households TO service_role;
GRANT ALL ON public.elo_members TO service_role;
GRANT ALL ON public.elo_state TO service_role;

ALTER TABLE public.elo_households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elo_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elo_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS elo_households_select ON public.elo_households;
CREATE POLICY elo_households_select ON public.elo_households
FOR SELECT TO authenticated USING (public.elo_is_member(id));

DROP POLICY IF EXISTS elo_households_update ON public.elo_households;
CREATE POLICY elo_households_update ON public.elo_households
FOR UPDATE TO authenticated USING (public.elo_is_member(id)) WITH CHECK (public.elo_is_member(id));

DROP POLICY IF EXISTS elo_members_select ON public.elo_members;
CREATE POLICY elo_members_select ON public.elo_members
FOR SELECT TO authenticated USING (public.elo_is_member(household_id));

DROP POLICY IF EXISTS elo_members_update_self ON public.elo_members;
CREATE POLICY elo_members_update_self ON public.elo_members
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS elo_state_select ON public.elo_state;
CREATE POLICY elo_state_select ON public.elo_state
FOR SELECT TO authenticated USING (public.elo_is_member(household_id));

DROP POLICY IF EXISTS elo_state_insert ON public.elo_state;
CREATE POLICY elo_state_insert ON public.elo_state
FOR INSERT TO authenticated WITH CHECK (public.elo_is_member(household_id));

DROP POLICY IF EXISTS elo_state_update ON public.elo_state;
CREATE POLICY elo_state_update ON public.elo_state
FOR UPDATE TO authenticated USING (public.elo_is_member(household_id)) WITH CHECK (public.elo_is_member(household_id));

-- Guardas de imutabilidade: vínculo de casal só muda via RPC com convite
CREATE OR REPLACE FUNCTION public.elo_members_guard_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.household_id IS DISTINCT FROM OLD.household_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'membership_change_requires_rpc' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS elo_members_guard_immutable_trg ON public.elo_members;
CREATE TRIGGER elo_members_guard_immutable_trg BEFORE UPDATE ON public.elo_members
FOR EACH ROW EXECUTE FUNCTION public.elo_members_guard_immutable();

CREATE OR REPLACE FUNCTION public.elo_households_guard_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.invite_code IS DISTINCT FROM OLD.invite_code
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'household_field_immutable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS elo_households_guard_immutable_trg ON public.elo_households;
CREATE TRIGGER elo_households_guard_immutable_trg BEFORE UPDATE ON public.elo_households
FOR EACH ROW EXECUTE FUNCTION public.elo_households_guard_immutable();

REVOKE EXECUTE ON FUNCTION public.elo_members_guard_immutable() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.elo_households_guard_immutable() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.elo_create_household(
  p_name text DEFAULT 'ELO Casal', p_display_name text DEFAULT 'Pessoa 1'
) RETURNS TABLE (household_id uuid, invite_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing uuid; v_household_id uuid; v_invite_code text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  SELECT m.household_id INTO v_existing FROM public.elo_members m WHERE m.user_id = v_user_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT h.id, h.invite_code FROM public.elo_households h WHERE h.id = v_existing;
    RETURN;
  END IF;
  INSERT INTO public.elo_households(name, created_by)
  VALUES (coalesce(nullif(trim(p_name), ''), 'ELO Casal'), v_user_id)
  RETURNING id, elo_households.invite_code INTO v_household_id, v_invite_code;
  INSERT INTO public.elo_members(household_id, user_id, display_name, role)
  VALUES (v_household_id, v_user_id, coalesce(nullif(trim(p_display_name), ''), 'Pessoa 1'), 'owner');
  INSERT INTO public.elo_state(household_id, data, updated_by)
  VALUES (v_household_id, '{}'::jsonb, v_user_id);
  RETURN QUERY SELECT v_household_id, v_invite_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.elo_join_household(
  p_invite_code text, p_display_name text DEFAULT 'Pessoa 2'
) RETURNS TABLE (household_id uuid, invite_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing uuid; v_household_id uuid; v_code text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  SELECT m.household_id INTO v_existing FROM public.elo_members m WHERE m.user_id = v_user_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT h.id, h.invite_code FROM public.elo_households h WHERE h.id = v_existing;
    RETURN;
  END IF;
  SELECT h.id, h.invite_code INTO v_household_id, v_code
  FROM public.elo_households h
  WHERE upper(h.invite_code) = upper(trim(p_invite_code)) LIMIT 1;
  IF v_household_id IS NULL THEN RAISE EXCEPTION 'Código de convite inválido'; END IF;
  INSERT INTO public.elo_members(household_id, user_id, display_name, role)
  VALUES (v_household_id, v_user_id, coalesce(nullif(trim(p_display_name), ''), 'Pessoa 2'), 'member');
  RETURN QUERY SELECT v_household_id, v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.elo_create_household(text, text) FROM public;
REVOKE ALL ON FUNCTION public.elo_join_household(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.elo_create_household(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.elo_join_household(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.elo_touch_state()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS elo_state_touch ON public.elo_state;
CREATE TRIGGER elo_state_touch BEFORE UPDATE ON public.elo_state
FOR EACH ROW EXECUTE FUNCTION public.elo_touch_state();