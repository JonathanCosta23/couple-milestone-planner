CREATE TABLE public.legal_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  consent_type text NOT NULL,
  version text NOT NULL,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, consent_type, version)
);

CREATE INDEX idx_legal_consents_user_type ON public.legal_consents (user_id, consent_type);

GRANT SELECT, INSERT, DELETE ON public.legal_consents TO authenticated;
GRANT ALL ON public.legal_consents TO service_role;

ALTER TABLE public.legal_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own legal_consents"
  ON public.legal_consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own legal_consents"
  ON public.legal_consents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own legal_consents"
  ON public.legal_consents FOR DELETE TO authenticated
  USING (auth.uid() = user_id);