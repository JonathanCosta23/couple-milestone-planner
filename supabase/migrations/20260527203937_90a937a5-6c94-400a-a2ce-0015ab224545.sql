-- ===== audit_log =====
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid,
  entity text NOT NULL,
  entity_id text,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit_log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit_log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_audit_log_user_created
  ON public.audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_log_entity
  ON public.audit_log (user_id, entity, entity_id);

-- ===== product_events =====
CREATE TABLE public.product_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid,
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.product_events TO authenticated;
GRANT ALL ON public.product_events TO service_role;

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own product_events"
  ON public.product_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product_events"
  ON public.product_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_product_events_user_created
  ON public.product_events (user_id, created_at DESC);
CREATE INDEX idx_product_events_event
  ON public.product_events (user_id, event_name, created_at DESC);

-- ===== milestones dedup (origin='realized') =====
-- Garante que um marco real (atingido em patrimônio realizado) só seja
-- gravado uma vez por (plan_id, milestone_type, value, origin='realized').
CREATE UNIQUE INDEX IF NOT EXISTS uniq_milestones_realized
  ON public.milestones (plan_id, milestone_type, value)
  WHERE origin = 'realized';
