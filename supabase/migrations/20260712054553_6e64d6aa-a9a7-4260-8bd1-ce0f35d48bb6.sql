
-- ============================================================
-- 1) Add review_status / last_verified_at to formulas & rules
-- ============================================================
ALTER TABLE public.knowledge_formulas
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'in_review',
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

ALTER TABLE public.knowledge_regulatory_rules
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'in_review';

ALTER TABLE public.knowledge_formulas
  DROP CONSTRAINT IF EXISTS knowledge_formulas_review_status_check,
  ADD CONSTRAINT knowledge_formulas_review_status_check
    CHECK (review_status IN ('unverified','in_review','verified','outdated'));

ALTER TABLE public.knowledge_regulatory_rules
  DROP CONSTRAINT IF EXISTS knowledge_regulatory_rules_review_status_check,
  ADD CONSTRAINT knowledge_regulatory_rules_review_status_check
    CHECK (review_status IN ('unverified','in_review','verified','outdated'));

-- Backfill existing rows: draft / in_review, no automatic verification.
UPDATE public.knowledge_formulas
   SET review_status = 'in_review',
       last_verified_at = NULL,
       publication_status = 'draft';

UPDATE public.knowledge_regulatory_rules
   SET review_status = 'in_review',
       publication_status = 'draft';

-- ============================================================
-- 2) Publication gate — safe across all 6 tables
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_publication_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  row_json jsonb := to_jsonb(NEW);
BEGIN
  IF (row_json->>'publication_status') = 'published' THEN
    IF COALESCE((row_json->>'active')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Cannot publish inactive content in %', TG_TABLE_NAME;
    END IF;
    IF (row_json->>'review_status') IS DISTINCT FROM 'verified' THEN
      RAISE EXCEPTION 'Cannot publish % without review_status = verified', TG_TABLE_NAME;
    END IF;
    IF NOT (row_json ? 'last_verified_at') OR (row_json->>'last_verified_at') IS NULL THEN
      RAISE EXCEPTION 'Cannot publish % without last_verified_at', TG_TABLE_NAME;
    END IF;
    IF row_json ? 'educational_disclaimer'
       AND coalesce(btrim(row_json->>'educational_disclaimer'), '') = '' THEN
      RAISE EXCEPTION 'Cannot publish % without educational_disclaimer', TG_TABLE_NAME;
    END IF;
    IF TG_TABLE_NAME = 'knowledge_regulatory_rules'
       AND coalesce(btrim(row_json->>'source_url'), '') = '' THEN
      RAISE EXCEPTION 'Cannot publish % without source_url', TG_TABLE_NAME;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger is already installed on all six tables by prior migration.

-- ============================================================
-- 3) Formulas & regulatory rules require verified review
-- ============================================================
DROP POLICY IF EXISTS "formulas_read_published" ON public.knowledge_formulas;
CREATE POLICY "formulas_read_published"
  ON public.knowledge_formulas FOR SELECT TO anon, authenticated
  USING (active = true AND publication_status = 'published' AND review_status = 'verified');

DROP POLICY IF EXISTS "regulatory_read_published" ON public.knowledge_regulatory_rules;
CREATE POLICY "regulatory_read_published"
  ON public.knowledge_regulatory_rules FOR SELECT TO anon, authenticated
  USING (active = true AND publication_status = 'published' AND review_status = 'verified');

-- ============================================================
-- 4) Learning progress: only for topics with published content
-- ============================================================
CREATE OR REPLACE FUNCTION public.topic_has_published_content(_topic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.knowledge_articles a
    WHERE a.topic_id = _topic_id
      AND a.active = true
      AND a.publication_status = 'published'
      AND a.review_status = 'verified'
  );
$$;

REVOKE ALL ON FUNCTION public.topic_has_published_content(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.topic_has_published_content(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users insert their own learning progress" ON public.user_learning_progress;
DROP POLICY IF EXISTS "Users update their own learning progress" ON public.user_learning_progress;

CREATE POLICY "learning_progress_insert_own_published"
  ON public.user_learning_progress FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.topic_has_published_content(topic_id)
  );

CREATE POLICY "learning_progress_update_own_published"
  ON public.user_learning_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.topic_has_published_content(topic_id)
  );

-- ============================================================
-- 5) Harden SECURITY DEFINER helpers (search_path + grants)
-- ============================================================
ALTER FUNCTION public.user_can_access_plan(uuid) SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.user_can_access_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_plan(uuid) TO authenticated, service_role;
