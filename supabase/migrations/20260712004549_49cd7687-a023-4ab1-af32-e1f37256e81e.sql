
CREATE TABLE public.user_action_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  action_category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  snoozed_until TIMESTAMP WITH TIME ZONE,
  dismissed_reason TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  engine_version TEXT NOT NULL DEFAULT 'nba-v1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT user_action_state_status_check
    CHECK (status IN ('active','snoozed','dismissed','completed','not_applicable','expired')),
  CONSTRAINT user_action_state_unique_key UNIQUE (user_id, plan_id, action_key)
);

CREATE INDEX idx_user_action_state_user_plan ON public.user_action_state(user_id, plan_id);
CREATE INDEX idx_user_action_state_status ON public.user_action_state(user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_action_state TO authenticated;
GRANT ALL ON public.user_action_state TO service_role;

ALTER TABLE public.user_action_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own action state"
  ON public.user_action_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_action_state_updated_at
  BEFORE UPDATE ON public.user_action_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Events (analytics-light, sem valores financeiros).
CREATE TABLE public.user_action_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  action_category TEXT NOT NULL,
  event_type TEXT NOT NULL,
  engine_version TEXT NOT NULL DEFAULT 'nba-v1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT user_action_events_type_check
    CHECK (event_type IN (
      'action_shown','action_opened','action_snoozed','action_dismissed',
      'action_completed','action_invalidated','related_content_opened'
    ))
);

CREATE INDEX idx_user_action_events_user ON public.user_action_events(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.user_action_events TO authenticated;
GRANT ALL ON public.user_action_events TO service_role;

ALTER TABLE public.user_action_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own action events"
  ON public.user_action_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view their own action events"
  ON public.user_action_events FOR SELECT
  USING (auth.uid() = user_id);
