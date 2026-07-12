
-- ============================================================
-- 1) Add publication_status to editorial tables
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'knowledge_articles',
    'knowledge_formulas',
    'knowledge_regulatory_rules',
    'knowledge_investment_schools',
    'knowledge_investor_references',
    'knowledge_asset_cases'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT ''draft''',
      t
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      t, t || '_publication_status_check'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (publication_status IN (''draft'',''in_review'',''published'',''archived''))',
      t, t || '_publication_status_check'
    );
  END LOOP;
END $$;

-- ============================================================
-- 2) Safer defaults on newly created rows going forward
-- ============================================================
ALTER TABLE public.knowledge_articles            ALTER COLUMN review_status SET DEFAULT 'in_review';
ALTER TABLE public.knowledge_investment_schools  ALTER COLUMN review_status SET DEFAULT 'in_review';
ALTER TABLE public.knowledge_investor_references ALTER COLUMN review_status SET DEFAULT 'in_review';
ALTER TABLE public.knowledge_asset_cases         ALTER COLUMN review_status SET DEFAULT 'in_review';

ALTER TABLE public.knowledge_investment_schools  ALTER COLUMN last_verified_at DROP NOT NULL;
ALTER TABLE public.knowledge_investment_schools  ALTER COLUMN last_verified_at DROP DEFAULT;
ALTER TABLE public.knowledge_investor_references ALTER COLUMN last_verified_at DROP NOT NULL;
ALTER TABLE public.knowledge_investor_references ALTER COLUMN last_verified_at DROP DEFAULT;
ALTER TABLE public.knowledge_asset_cases         ALTER COLUMN last_verified_at DROP NOT NULL;
ALTER TABLE public.knowledge_asset_cases         ALTER COLUMN last_verified_at DROP DEFAULT;

-- ============================================================
-- 3) Publication gate trigger (no publish unless active + verified)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_publication_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.publication_status = 'published' THEN
    IF COALESCE(NEW.active, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Cannot publish inactive content in %', TG_TABLE_NAME;
    END IF;
    IF NEW.review_status IS DISTINCT FROM 'verified' THEN
      RAISE EXCEPTION 'Cannot publish % without review_status = verified (got %)', TG_TABLE_NAME, NEW.review_status;
    END IF;
    IF to_jsonb(NEW) ? 'last_verified_at' AND (to_jsonb(NEW)->>'last_verified_at') IS NULL THEN
      RAISE EXCEPTION 'Cannot publish % without last_verified_at', TG_TABLE_NAME;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'knowledge_articles',
    'knowledge_formulas',
    'knowledge_regulatory_rules',
    'knowledge_investment_schools',
    'knowledge_investor_references',
    'knowledge_asset_cases'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_publication_gate ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_publication_gate BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_publication_gate()',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- 4) Migrate existing seeds to draft / in_review
-- ============================================================

-- Articles: placeholder "Conteúdo em revisão" → draft/in_review; rest → in_review/draft (nothing published yet)
UPDATE public.knowledge_articles
   SET publication_status = 'draft',
       review_status = 'in_review',
       last_verified_at = NULL;

-- Formulas: keep as-is but move to draft until editorial verifies
UPDATE public.knowledge_formulas
   SET publication_status = 'draft';

-- Regulatory rules: draft until re-verified
UPDATE public.knowledge_regulatory_rules
   SET publication_status = 'draft';

-- Schools: no documented human review → in_review/draft, drop timestamp
UPDATE public.knowledge_investment_schools
   SET publication_status = 'draft',
       review_status = 'in_review',
       last_verified_at = NULL;

-- Investor references: source_date null → in_review/draft
UPDATE public.knowledge_investor_references
   SET publication_status = 'draft',
       review_status = 'in_review',
       last_verified_at = NULL;

-- Asset cases: everything draft; unvalidated tickers stay unverified
UPDATE public.knowledge_asset_cases
   SET publication_status = 'draft',
       review_status = CASE
         WHEN ticker_validated = false THEN 'unverified'
         ELSE 'in_review'
       END,
       last_verified_at = NULL;

-- ============================================================
-- 5) Read policies: active + published + verified
-- ============================================================

-- Articles
DROP POLICY IF EXISTS "Active articles are public readable" ON public.knowledge_articles;
CREATE POLICY "articles_read_published"
  ON public.knowledge_articles FOR SELECT TO anon, authenticated
  USING (active = true AND publication_status = 'published' AND review_status = 'verified');

-- Formulas
DROP POLICY IF EXISTS "Active formulas are public readable" ON public.knowledge_formulas;
CREATE POLICY "formulas_read_published"
  ON public.knowledge_formulas FOR SELECT TO anon, authenticated
  USING (active = true AND publication_status = 'published');

-- Regulatory rules
DROP POLICY IF EXISTS "Active regulatory rules are public readable" ON public.knowledge_regulatory_rules;
CREATE POLICY "regulatory_read_published"
  ON public.knowledge_regulatory_rules FOR SELECT TO anon, authenticated
  USING (active = true AND publication_status = 'published');

-- Schools
DROP POLICY IF EXISTS "Authenticated can read active schools" ON public.knowledge_investment_schools;
CREATE POLICY "schools_read_published"
  ON public.knowledge_investment_schools FOR SELECT TO authenticated
  USING (active = true AND publication_status = 'published' AND review_status = 'verified');

-- Investor references
DROP POLICY IF EXISTS "Authenticated can read active investor refs" ON public.knowledge_investor_references;
CREATE POLICY "investor_refs_read_published"
  ON public.knowledge_investor_references FOR SELECT TO authenticated
  USING (active = true AND publication_status = 'published' AND review_status = 'verified');

-- Asset cases
DROP POLICY IF EXISTS "Authenticated can read active asset cases" ON public.knowledge_asset_cases;
CREATE POLICY "asset_cases_read_published"
  ON public.knowledge_asset_cases FOR SELECT TO authenticated
  USING (active = true AND publication_status = 'published' AND review_status = 'verified');

-- ============================================================
-- 6) Sources: no more USING (true); tied to parent article
-- ============================================================
DROP POLICY IF EXISTS "Sources are public readable" ON public.knowledge_sources;

CREATE POLICY "sources_read_published_article"
  ON public.knowledge_sources FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_articles a
      WHERE a.id = knowledge_sources.article_id
        AND a.active = true
        AND a.publication_status = 'published'
        AND a.review_status = 'verified'
    )
  );
