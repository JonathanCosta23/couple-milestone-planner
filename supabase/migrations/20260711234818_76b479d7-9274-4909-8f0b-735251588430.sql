
-- ============================================================
-- Sprint 4: FGC Protection Engine — regulatory data & events
-- ============================================================

-- Conglomerados financeiros
CREATE TABLE public.financial_conglomerates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  official_name TEXT NOT NULL,
  external_reference TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  source_name TEXT,
  source_url TEXT,
  effective_date DATE,
  last_verified_at TIMESTAMPTZ,
  version TEXT NOT NULL DEFAULT '1.0.0',
  review_status TEXT NOT NULL DEFAULT 'verified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.financial_conglomerates TO anon, authenticated;
GRANT ALL ON public.financial_conglomerates TO service_role;
ALTER TABLE public.financial_conglomerates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conglomerates readable by all"
  ON public.financial_conglomerates FOR SELECT
  USING (active = true);

-- Instituições financeiras normalizadas
CREATE TABLE public.financial_institutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  document_reference TEXT,
  conglomerate_id UUID REFERENCES public.financial_conglomerates(id) ON DELETE SET NULL,
  fgc_association_status TEXT NOT NULL DEFAULT 'unknown',
  association_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  source_name TEXT,
  source_url TEXT,
  effective_date DATE,
  last_verified_at TIMESTAMPTZ,
  version TEXT NOT NULL DEFAULT '1.0.0',
  review_status TEXT NOT NULL DEFAULT 'verified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fi_conglomerate ON public.financial_institutions(conglomerate_id);
CREATE INDEX idx_fi_trade_name ON public.financial_institutions(lower(trade_name));
GRANT SELECT ON public.financial_institutions TO anon, authenticated;
GRANT ALL ON public.financial_institutions TO service_role;
ALTER TABLE public.financial_institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Institutions readable by all"
  ON public.financial_institutions FOR SELECT
  USING (active = true);

-- Regras regulatórias FGC versionadas
CREATE TABLE public.fgc_regulatory_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_key TEXT NOT NULL,
  numeric_value NUMERIC,
  currency TEXT DEFAULT 'BRL',
  window_years INTEGER,
  description TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  effective_date DATE NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version TEXT NOT NULL DEFAULT '1.0.0',
  review_status TEXT NOT NULL DEFAULT 'verified',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fgc_rules_key_active ON public.fgc_regulatory_rules(rule_key, active);
GRANT SELECT ON public.fgc_regulatory_rules TO anon, authenticated;
GRANT ALL ON public.fgc_regulatory_rules TO service_role;
ALTER TABLE public.fgc_regulatory_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FGC rules readable by all"
  ON public.fgc_regulatory_rules FOR SELECT
  USING (active = true);

-- Catálogo de produtos FGC
CREATE TABLE public.fgc_product_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  coverage_status TEXT NOT NULL,
  conditions TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT,
  effective_date DATE NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version TEXT NOT NULL DEFAULT '1.0.0',
  review_status TEXT NOT NULL DEFAULT 'verified',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fgc_product_catalog TO anon, authenticated;
GRANT ALL ON public.fgc_product_catalog TO service_role;
ALTER TABLE public.fgc_product_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FGC product catalog readable by all"
  ON public.fgc_product_catalog FOR SELECT
  USING (active = true);

-- Eventos de garantia (histórico opcional do usuário)
CREATE TABLE public.fgc_guarantee_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  holder_member_id UUID REFERENCES public.plan_members(id) ON DELETE SET NULL,
  institution_id UUID REFERENCES public.financial_institutions(id) ON DELETE SET NULL,
  conglomerate_id UUID REFERENCES public.financial_conglomerates(id) ON DELETE SET NULL,
  event_date DATE NOT NULL,
  gross_credit_amount NUMERIC NOT NULL DEFAULT 0,
  guaranteed_amount_received NUMERIC NOT NULL DEFAULT 0,
  tax_withheld NUMERIC NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL DEFAULT 'user_declared',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fgc_events_user ON public.fgc_guarantee_events(user_id, event_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fgc_guarantee_events TO authenticated;
GRANT ALL ON public.fgc_guarantee_events TO service_role;
ALTER TABLE public.fgc_guarantee_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own FGC events"
  ON public.fgc_guarantee_events FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own FGC events"
  ON public.fgc_guarantee_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own FGC events"
  ON public.fgc_guarantee_events FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own FGC events"
  ON public.fgc_guarantee_events FOR DELETE
  USING (auth.uid() = user_id);

-- Triggers updated_at
CREATE TRIGGER trg_fc_updated BEFORE UPDATE ON public.financial_conglomerates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fi_updated BEFORE UPDATE ON public.financial_institutions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_frr_updated BEFORE UPDATE ON public.fgc_regulatory_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fpc_updated BEFORE UPDATE ON public.fgc_product_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fge_updated BEFORE UPDATE ON public.fgc_guarantee_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Seed: regras oficiais vigentes
-- ============================================================
INSERT INTO public.fgc_regulatory_rules
  (rule_key, numeric_value, currency, window_years, description, source_name, source_url, effective_date, version)
VALUES
  ('ordinary_limit_per_cpf_per_conglomerate', 250000, 'BRL', NULL,
   'Limite ordinário de garantia por CPF/CNPJ, por instituição associada ou conjunto de instituições do mesmo conglomerado.',
   'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('aggregate_limit_four_year_window', 1000000, 'BRL', 4,
   'Teto agregado de pagamentos de garantia ordinária por CPF/CNPJ em janela de 4 anos.',
   'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2017-12-21', '1.0.0');

-- ============================================================
-- Seed: catálogo de produtos
-- ============================================================
INSERT INTO public.fgc_product_catalog (product_code, product_name, coverage_status, conditions, source_name, source_url, effective_date, version) VALUES
  ('demand_deposit',   'Depósitos à vista / conta corrente', 'potentially_covered', 'Conforme regulamento do FGC vigente.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('savings',          'Poupança',                            'potentially_covered', 'Conforme regulamento do FGC vigente.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('salary_account',   'Conta-salário elegível',              'potentially_covered', 'Conforme regulamento do FGC vigente.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('cdb',              'CDB',                                 'potentially_covered', 'Cobertura depende da associação da instituição emissora ao FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('rdb',              'RDB',                                 'potentially_covered', 'Cobertura depende da associação da instituição emissora ao FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('lci',              'LCI',                                 'potentially_covered', 'Cobertura depende da associação da instituição emissora ao FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('lca',              'LCA',                                 'potentially_covered', 'Cobertura depende da associação da instituição emissora ao FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('lcd',              'LCD',                                 'potentially_covered', 'Cobertura conforme regras vigentes do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2023-10-01', '1.0.0'),
  ('lc',               'LC (Letra de Câmbio)',                'potentially_covered', 'Cobertura depende da associação da instituição emissora ao FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('lh',               'LH (Letra Hipotecária)',              'potentially_covered', 'Cobertura conforme regulamento do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('compromissada',    'Operações compromissadas elegíveis',  'potentially_covered', 'Somente as operações compromissadas expressamente previstas pelo regulamento do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('tesouro',          'Tesouro Direto / Títulos públicos',   'not_covered',         'Títulos do Tesouro Nacional não fazem parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('fund',             'Fundos de investimento',              'not_covered',         'Fundos de investimento não fazem parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('debenture',        'Debêntures',                          'not_covered',         'Debêntures não fazem parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('cri',              'CRI',                                 'not_covered',         'CRI não faz parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('cra',              'CRA',                                 'not_covered',         'CRA não faz parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('lf',               'Letras Financeiras',                  'not_covered',         'LF não faz parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('lig',              'LIG',                                 'not_covered',         'LIG não faz parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2018-01-01', '1.0.0'),
  ('acao',             'Ações',                               'not_covered',         'Ações não fazem parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('etf',              'ETFs',                                'not_covered',         'ETFs não fazem parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('fii',              'Fundos imobiliários',                 'not_covered',         'FII não faz parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('crypto',           'Criptomoedas',                        'not_covered',         'Criptomoedas não fazem parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('previdencia',      'Previdência privada baseada em fundos', 'not_covered',       'Previdência privada baseada em fundos não faz parte da garantia ordinária do FGC.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('dpge',             'DPGE',                                'special_guarantee_review', 'DPGE é sujeito a regras da garantia especial do FGC, com condições próprias.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0'),
  ('other',            'Outros ativos não enquadrados',       'needs_review',        'Produto sem classificação conclusiva. Requer revisão.', 'Fundo Garantidor de Créditos', 'https://www.fgc.org.br/', '2013-05-22', '1.0.0');
