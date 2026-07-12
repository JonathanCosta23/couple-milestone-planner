ALTER TABLE public.user_action_state
  ADD COLUMN IF NOT EXISTS condition_signature TEXT,
  ADD COLUMN IF NOT EXISTS condition_version   TEXT NOT NULL DEFAULT 'sig-v1',
  ADD COLUMN IF NOT EXISTS last_validated_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_until     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS user_action_state_signature_idx
  ON public.user_action_state (user_id, plan_id, action_key, condition_signature);