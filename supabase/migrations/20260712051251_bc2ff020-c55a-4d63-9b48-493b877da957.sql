
-- Safety: abort if orphans exist
DO $$
DECLARE n_state int; n_ev int;
BEGIN
  SELECT count(*) INTO n_state FROM public.user_action_state WHERE plan_id IS NULL;
  SELECT count(*) INTO n_ev    FROM public.user_action_events WHERE plan_id IS NULL;
  IF n_state > 0 OR n_ev > 0 THEN
    RAISE EXCEPTION 'Aborting: found orphan rows (state=%, events=%)', n_state, n_ev;
  END IF;
END $$;

ALTER TABLE public.user_action_state  ALTER COLUMN plan_id SET NOT NULL;
ALTER TABLE public.user_action_events ALTER COLUMN plan_id SET NOT NULL;

-- Helper: user owns the plan OR is an active member
CREATE OR REPLACE FUNCTION public.user_can_access_plan(_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = _plan_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.plan_members pm
    WHERE pm.plan_id = _plan_id
      AND pm.user_id = auth.uid()
      AND pm.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_plan(uuid) TO authenticated, service_role;

-- ===== user_action_state =====
DROP POLICY IF EXISTS "Users manage their own action state" ON public.user_action_state;

CREATE POLICY "action_state_select_own_plan"
  ON public.user_action_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.user_can_access_plan(plan_id));

CREATE POLICY "action_state_insert_own_plan"
  ON public.user_action_state FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.user_can_access_plan(plan_id));

CREATE POLICY "action_state_update_own_plan"
  ON public.user_action_state FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.user_can_access_plan(plan_id))
  WITH CHECK (auth.uid() = user_id AND public.user_can_access_plan(plan_id));

-- No DELETE policy for authenticated: app uses status transitions (dismissed / expired).
-- service_role bypasses RLS.

-- ===== user_action_events =====
DROP POLICY IF EXISTS "Users insert their own action events" ON public.user_action_events;
DROP POLICY IF EXISTS "Users view their own action events"   ON public.user_action_events;

CREATE POLICY "action_events_select_own_plan"
  ON public.user_action_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.user_can_access_plan(plan_id));

CREATE POLICY "action_events_insert_own_plan"
  ON public.user_action_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.user_can_access_plan(plan_id));

-- Append-only for authenticated: no UPDATE / DELETE policies.

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_user_action_state_user_plan_status
  ON public.user_action_state (user_id, plan_id, status);

DROP INDEX IF EXISTS public.idx_user_action_events_user;
CREATE INDEX IF NOT EXISTS idx_user_action_events_user_plan_created
  ON public.user_action_events (user_id, plan_id, created_at DESC);
