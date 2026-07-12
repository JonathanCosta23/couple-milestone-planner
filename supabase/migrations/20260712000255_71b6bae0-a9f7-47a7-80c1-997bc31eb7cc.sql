
-- Schools of investment thought
CREATE TABLE public.knowledge_investment_schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  central_question TEXT NOT NULL,
  core_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  when_it_works TEXT,
  when_it_fails TEXT,
  jurisdiction TEXT NOT NULL DEFAULT 'BR',
  version TEXT NOT NULL DEFAULT '1.0.0',
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_status TEXT NOT NULL DEFAULT 'verified',
  educational_disclaimer TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_investment_schools TO authenticated;
GRANT ALL ON public.knowledge_investment_schools TO service_role;
ALTER TABLE public.knowledge_investment_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read active schools"
  ON public.knowledge_investment_schools FOR SELECT
  TO authenticated USING (active = true);

-- Investor references
CREATE TABLE public.knowledge_investor_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  short_bio TEXT NOT NULL,
  historical_context TEXT NOT NULL,
  documented_principles JSONB NOT NULL DEFAULT '[]'::jsonb,
  associated_school_slugs JSONB NOT NULL DEFAULT '[]'::jsonb,
  lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  controversies_or_risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  historical_positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_date DATE,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_status TEXT NOT NULL DEFAULT 'verified',
  educational_only BOOLEAN NOT NULL DEFAULT true,
  educational_disclaimer TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_investor_references TO authenticated;
GRANT ALL ON public.knowledge_investor_references TO service_role;
ALTER TABLE public.knowledge_investor_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read active investor refs"
  ON public.knowledge_investor_references FOR SELECT
  TO authenticated USING (active = true);

-- Asset education cases
CREATE TABLE public.knowledge_asset_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT,
  company_name TEXT NOT NULL,
  share_class TEXT,
  sector TEXT NOT NULL,
  subsector TEXT,
  business_model TEXT NOT NULL,
  revenue_drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
  cost_drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
  competitive_advantages JSONB NOT NULL DEFAULT '[]'::jsonb,
  capital_intensity TEXT,
  cyclicality TEXT,
  government_exposure TEXT,
  currency_exposure TEXT,
  commodity_exposure TEXT,
  regulatory_exposure TEXT,
  governance_summary TEXT,
  debt_summary TEXT,
  cash_flow_summary TEXT,
  dividend_summary TEXT,
  positive_thesis JSONB NOT NULL DEFAULT '[]'::jsonb,
  negative_thesis JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  indicators_to_watch JSONB NOT NULL DEFAULT '[]'::jsonb,
  events_to_watch JSONB NOT NULL DEFAULT '[]'::jsonb,
  reporting_period TEXT,
  associated_school_slugs JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_date DATE,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_status TEXT NOT NULL DEFAULT 'unverified',
  educational_only BOOLEAN NOT NULL DEFAULT true,
  educational_disclaimer TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  active BOOLEAN NOT NULL DEFAULT true,
  ticker_validated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_cases_ticker ON public.knowledge_asset_cases(ticker) WHERE ticker IS NOT NULL;
GRANT SELECT ON public.knowledge_asset_cases TO authenticated;
GRANT ALL ON public.knowledge_asset_cases TO service_role;
ALTER TABLE public.knowledge_asset_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read active asset cases"
  ON public.knowledge_asset_cases FOR SELECT
  TO authenticated USING (active = true);

-- updated_at triggers
CREATE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON public.knowledge_investment_schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_investor_refs_updated_at
  BEFORE UPDATE ON public.knowledge_investor_references
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_asset_cases_updated_at
  BEFORE UPDATE ON public.knowledge_asset_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
