
CREATE TABLE public.tax_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction text NOT NULL DEFAULT 'BR',
  tax_type text NOT NULL,
  product_category text NOT NULL,
  min_days integer NOT NULL,
  max_days integer,
  rate numeric NOT NULL,
  calculation_base text NOT NULL DEFAULT 'yield',
  effective_date date NOT NULL,
  expires_at date,
  source_url text,
  source_name text,
  last_verified_at date,
  version text NOT NULL DEFAULT '1.0',
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tax_rules TO anon, authenticated;
GRANT ALL ON public.tax_rules TO service_role;
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_rules_public_read_active" ON public.tax_rules FOR SELECT USING (active = true);

CREATE TABLE public.iof_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction text NOT NULL DEFAULT 'BR',
  product_category text NOT NULL DEFAULT 'fixed_income_taxable',
  holding_day integer NOT NULL,
  rate numeric NOT NULL,
  calculation_base text NOT NULL DEFAULT 'yield',
  effective_date date NOT NULL,
  expires_at date,
  source_url text,
  source_name text,
  last_verified_at date,
  version text NOT NULL DEFAULT '1.0',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.iof_rules TO anon, authenticated;
GRANT ALL ON public.iof_rules TO service_role;
ALTER TABLE public.iof_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iof_rules_public_read_active" ON public.iof_rules FOR SELECT USING (active = true);

-- IR regressivo renda fixa tributável (BR)
INSERT INTO public.tax_rules (tax_type, product_category, min_days, max_days, rate, effective_date, source_url, source_name, last_verified_at, version, notes) VALUES
('income_tax', 'fixed_income_taxable', 0, 180, 0.225, '2005-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Lei 11.033/2004', '2026-07-11', '1.0', 'Faixa 1 IR regressivo'),
('income_tax', 'fixed_income_taxable', 181, 360, 0.20, '2005-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Lei 11.033/2004', '2026-07-11', '1.0', 'Faixa 2 IR regressivo'),
('income_tax', 'fixed_income_taxable', 361, 720, 0.175, '2005-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Lei 11.033/2004', '2026-07-11', '1.0', 'Faixa 3 IR regressivo'),
('income_tax', 'fixed_income_taxable', 721, NULL, 0.15, '2005-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Lei 11.033/2004', '2026-07-11', '1.0', 'Faixa 4 IR regressivo');

-- Produtos isentos IR (LCI, LCA)
INSERT INTO public.tax_rules (tax_type, product_category, min_days, max_days, rate, effective_date, source_url, source_name, last_verified_at, version, notes) VALUES
('income_tax', 'fixed_income_exempt', 0, NULL, 0, '2004-12-21', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Lei 11.033/2004', '2026-07-11', '1.0', 'Isento IR pessoa física');

-- IOF regressivo (tabela completa 1-29 dias, 0 após 30)
INSERT INTO public.iof_rules (product_category, holding_day, rate, effective_date, source_url, source_name, last_verified_at, version) VALUES
('fixed_income_taxable', 1, 0.96, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 2, 0.93, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 3, 0.90, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 4, 0.86, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 5, 0.83, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 6, 0.80, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 7, 0.76, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 8, 0.73, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 9, 0.70, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 10, 0.66, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 11, 0.63, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 12, 0.60, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 13, 0.56, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 14, 0.53, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 15, 0.50, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 16, 0.46, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 17, 0.43, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 18, 0.40, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 19, 0.36, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 20, 0.33, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 21, 0.30, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 22, 0.26, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 23, 0.23, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 24, 0.20, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 25, 0.16, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 26, 0.13, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 27, 0.10, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 28, 0.06, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 29, 0.03, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0'),
('fixed_income_taxable', 30, 0.00, '1999-01-01', 'https://www.gov.br/receitafederal/pt-br', 'Receita Federal — Decreto 6.306/2007', '2026-07-11', '1.0');
