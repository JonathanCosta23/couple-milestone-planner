-- =====================================================================
-- Passo 4.c.1 — Ownership financeiro canônico e backfill seguro
-- =====================================================================

-- 1. Coluna inicialmente nullable, sem DEFAULT: clientes antigos não podem
-- criar ownership implícito depois que a constraint final for aplicada.
ALTER TABLE public.assets   ADD COLUMN IF NOT EXISTS ownership_scope text;
ALTER TABLE public.income   ADD COLUMN IF NOT EXISTS ownership_scope text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS ownership_scope text;
ALTER TABLE public.debts    ADD COLUMN IF NOT EXISTS ownership_scope text;

-- Assets tinha member_id obrigatório no schema anterior. Shared/review exigem
-- null explícito, portanto a nulabilidade passa a ser governada pelo CHECK.
ALTER TABLE public.assets ALTER COLUMN member_id DROP NOT NULL;

-- Snapshot estrutural para auditoria do backfill. Nenhum valor financeiro é
-- copiado para esta tabela temporária.
CREATE TEMP TABLE ownership_4c1_before ON COMMIT DROP AS
SELECT 'asset'::text AS entity, id AS record_id, user_id, plan_id, member_id
  FROM public.assets
UNION ALL
SELECT 'income', id, user_id, plan_id, member_id FROM public.income
UNION ALL
SELECT 'expense', id, user_id, plan_id, member_id FROM public.expenses
UNION ALL
SELECT 'debt', id, user_id, plan_id, member_id FROM public.debts;

-- 2. Preflight: relata a distribuição e aborta corrupção que não pode ser
-- classificada deterministicamente.
DO $preflight$
DECLARE
  r record;
  v_total bigint;
  v_linked bigint;
  v_null_individual bigint;
  v_null_couple bigint;
  v_missing_member bigint := 0;
  v_cross_plan bigint := 0;
  v_cross_user bigint := 0;
  v_bad_plans bigint := 0;
  v_fgc_without_holder bigint := 0;
  v_blob_present bigint := 0;
BEGIN
  FOR r IN SELECT unnest(ARRAY['assets','income','expenses','debts']) AS table_name LOOP
    EXECUTE format(
      'SELECT count(*), count(*) FILTER (WHERE member_id IS NOT NULL),
              count(*) FILTER (WHERE member_id IS NULL AND p.mode = ''individual''),
              count(*) FILTER (WHERE member_id IS NULL AND p.mode = ''casal'')
         FROM public.%I x JOIN public.plans p ON p.id = x.plan_id',
      r.table_name
    ) INTO v_total, v_linked, v_null_individual, v_null_couple;
    RAISE NOTICE 'ownership_preflight table=% total=% linked=% null_individual=% null_couple=%',
      r.table_name, v_total, v_linked, v_null_individual, v_null_couple;

    EXECUTE format(
      'SELECT
         count(*) FILTER (WHERE x.member_id IS NOT NULL AND pm.id IS NULL),
         count(*) FILTER (WHERE pm.id IS NOT NULL AND pm.plan_id <> x.plan_id),
         count(*) FILTER (WHERE pm.id IS NOT NULL AND pm.user_id <> x.user_id)
       FROM public.%I x
       LEFT JOIN public.plan_members pm ON pm.id = x.member_id',
      r.table_name
    ) INTO v_total, v_linked, v_null_individual;
    v_missing_member := v_missing_member + v_total;
    v_cross_plan := v_cross_plan + v_linked;
    v_cross_user := v_cross_user + v_null_individual;
  END LOOP;

  SELECT count(*) INTO v_bad_plans
  FROM public.plans p
  WHERE (SELECT count(*) FROM public.plan_members pm
          WHERE pm.plan_id = p.id AND pm.status = 'active' AND pm.is_primary) <> 1
     OR (p.mode = 'individual' AND
         (SELECT count(*) FROM public.plan_members pm
           WHERE pm.plan_id = p.id AND pm.status = 'active' AND NOT pm.is_primary) <> 0)
     OR (p.mode = 'casal' AND
         (SELECT count(*) FROM public.plan_members pm
           WHERE pm.plan_id = p.id AND pm.status = 'active' AND NOT pm.is_primary) <> 1);

  SELECT count(*) INTO v_fgc_without_holder
    FROM public.fgc_guarantee_events WHERE holder_member_id IS NULL;
  SELECT count(*) INTO v_blob_present
    FROM public.user_financial_data
   WHERE (plan_data IS NOT NULL AND plan_data <> '{}'::jsonb)
      OR (app_data IS NOT NULL AND app_data <> '{}'::jsonb);

  RAISE NOTICE 'ownership_preflight missing_member=% cross_plan=% cross_user=% inconsistent_plans=% fgc_without_holder=% legacy_blobs=%',
    v_missing_member, v_cross_plan, v_cross_user, v_bad_plans,
    v_fgc_without_holder, v_blob_present;

  IF v_missing_member > 0 OR v_cross_plan > 0 OR v_cross_user > 0 THEN
    RAISE EXCEPTION 'ownership_preflight_referential_corruption: missing=% cross_plan=% cross_user=%',
      v_missing_member, v_cross_plan, v_cross_user
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_bad_plans > 0 THEN
    RAISE EXCEPTION 'ownership_preflight_inconsistent_plans: %', v_bad_plans
      USING ERRCODE = 'check_violation';
  END IF;
END
$preflight$;

-- 3. Backfill determinístico.
-- Vínculos existentes, inclusive membros removed, preservam ownership histórico.
UPDATE public.assets   SET ownership_scope = 'individual' WHERE member_id IS NOT NULL;
UPDATE public.income   SET ownership_scope = 'individual' WHERE member_id IS NOT NULL;
UPDATE public.expenses SET ownership_scope = 'individual' WHERE member_id IS NOT NULL;
UPDATE public.debts    SET ownership_scope = 'individual' WHERE member_id IS NOT NULL;

-- Null em plano individual: existe exatamente um proprietário possível.
UPDATE public.assets r
   SET member_id = pm.id, ownership_scope = 'individual'
  FROM public.plans p, public.plan_members pm
 WHERE p.id = r.plan_id AND p.mode = 'individual'
   AND pm.plan_id = p.id AND pm.is_primary AND pm.status = 'active'
   AND r.member_id IS NULL;
UPDATE public.income r
   SET member_id = pm.id, ownership_scope = 'individual'
  FROM public.plans p, public.plan_members pm
 WHERE p.id = r.plan_id AND p.mode = 'individual'
   AND pm.plan_id = p.id AND pm.is_primary AND pm.status = 'active'
   AND r.member_id IS NULL;
UPDATE public.expenses r
   SET member_id = pm.id, ownership_scope = 'individual'
  FROM public.plans p, public.plan_members pm
 WHERE p.id = r.plan_id AND p.mode = 'individual'
   AND pm.plan_id = p.id AND pm.is_primary AND pm.status = 'active'
   AND r.member_id IS NULL;
UPDATE public.debts r
   SET member_id = pm.id, ownership_scope = 'individual'
  FROM public.plans p, public.plan_members pm
 WHERE p.id = r.plan_id AND p.mode = 'individual'
   AND pm.plan_id = p.id AND pm.is_primary AND pm.status = 'active'
   AND r.member_id IS NULL;

-- Null em plano casal é ambíguo: nunca inferir titular, parceiro ou shared.
UPDATE public.assets r SET ownership_scope = 'needs_review'
  FROM public.plans p WHERE p.id = r.plan_id AND p.mode = 'casal' AND r.member_id IS NULL;
UPDATE public.income r SET ownership_scope = 'needs_review'
  FROM public.plans p WHERE p.id = r.plan_id AND p.mode = 'casal' AND r.member_id IS NULL;
UPDATE public.expenses r SET ownership_scope = 'needs_review'
  FROM public.plans p WHERE p.id = r.plan_id AND p.mode = 'casal' AND r.member_id IS NULL;
UPDATE public.debts r SET ownership_scope = 'needs_review'
  FROM public.plans p WHERE p.id = r.plan_id AND p.mode = 'casal' AND r.member_id IS NULL;

DO $post_backfill$
DECLARE
  v_null_scope bigint;
  v_shared bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM public.assets WHERE ownership_scope IS NULL) +
    (SELECT count(*) FROM public.income WHERE ownership_scope IS NULL) +
    (SELECT count(*) FROM public.expenses WHERE ownership_scope IS NULL) +
    (SELECT count(*) FROM public.debts WHERE ownership_scope IS NULL)
    INTO v_null_scope;
  SELECT
    (SELECT count(*) FROM public.assets WHERE ownership_scope = 'shared') +
    (SELECT count(*) FROM public.income WHERE ownership_scope = 'shared') +
    (SELECT count(*) FROM public.expenses WHERE ownership_scope = 'shared') +
    (SELECT count(*) FROM public.debts WHERE ownership_scope = 'shared')
    INTO v_shared;
  IF v_null_scope > 0 THEN
    RAISE EXCEPTION 'ownership_backfill_incomplete: %', v_null_scope
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_shared <> 0 THEN
    RAISE EXCEPTION 'ownership_backfill_unexpected_shared: %', v_shared
      USING ERRCODE = 'check_violation';
  END IF;
  RAISE NOTICE 'ownership_backfill complete; shared=0';
END
$post_backfill$;

-- Auditoria estrutural do backfill. Não registra valores, nomes, CPF ou HMAC.
INSERT INTO public.audit_log
  (user_id, plan_id, entity, entity_id, action, old_value, new_value)
SELECT b.user_id, b.plan_id, b.entity, b.record_id, 'update',
       jsonb_build_object(
         'ownership_scope', NULL,
         'member_id_present', b.member_id IS NOT NULL,
         'origin', 'pre_4c1'
       ),
       jsonb_build_object(
         'ownership_scope', x.ownership_scope,
         'member_id_present', x.member_id IS NOT NULL,
         'origin', 'backfill'
       )
FROM ownership_4c1_before b
JOIN LATERAL (
  SELECT ownership_scope, member_id FROM public.assets WHERE b.entity='asset' AND id=b.record_id
  UNION ALL
  SELECT ownership_scope, member_id FROM public.income WHERE b.entity='income' AND id=b.record_id
  UNION ALL
  SELECT ownership_scope, member_id FROM public.expenses WHERE b.entity='expense' AND id=b.record_id
  UNION ALL
  SELECT ownership_scope, member_id FROM public.debts WHERE b.entity='debt' AND id=b.record_id
) x ON true;

-- 4. Constraints canônicas.
ALTER TABLE public.assets
  ALTER COLUMN ownership_scope SET NOT NULL,
  DROP CONSTRAINT IF EXISTS assets_ownership_scope_check,
  DROP CONSTRAINT IF EXISTS assets_ownership_member_check,
  ADD CONSTRAINT assets_ownership_scope_check
    CHECK (ownership_scope IN ('individual','shared','needs_review')),
  ADD CONSTRAINT assets_ownership_member_check
    CHECK ((ownership_scope='individual' AND member_id IS NOT NULL)
        OR (ownership_scope IN ('shared','needs_review') AND member_id IS NULL));
ALTER TABLE public.income
  ALTER COLUMN ownership_scope SET NOT NULL,
  DROP CONSTRAINT IF EXISTS income_ownership_scope_check,
  DROP CONSTRAINT IF EXISTS income_ownership_member_check,
  ADD CONSTRAINT income_ownership_scope_check
    CHECK (ownership_scope IN ('individual','shared','needs_review')),
  ADD CONSTRAINT income_ownership_member_check
    CHECK ((ownership_scope='individual' AND member_id IS NOT NULL)
        OR (ownership_scope IN ('shared','needs_review') AND member_id IS NULL));
ALTER TABLE public.expenses
  ALTER COLUMN ownership_scope SET NOT NULL,
  DROP CONSTRAINT IF EXISTS expenses_ownership_scope_check,
  DROP CONSTRAINT IF EXISTS expenses_ownership_member_check,
  ADD CONSTRAINT expenses_ownership_scope_check
    CHECK (ownership_scope IN ('individual','shared','needs_review')),
  ADD CONSTRAINT expenses_ownership_member_check
    CHECK ((ownership_scope='individual' AND member_id IS NOT NULL)
        OR (ownership_scope IN ('shared','needs_review') AND member_id IS NULL));
ALTER TABLE public.debts
  ALTER COLUMN ownership_scope SET NOT NULL,
  DROP CONSTRAINT IF EXISTS debts_ownership_scope_check,
  DROP CONSTRAINT IF EXISTS debts_ownership_member_check,
  ADD CONSTRAINT debts_ownership_scope_check
    CHECK (ownership_scope IN ('individual','shared','needs_review')),
  ADD CONSTRAINT debts_ownership_member_check
    CHECK ((ownership_scope='individual' AND member_id IS NOT NULL)
        OR (ownership_scope IN ('shared','needs_review') AND member_id IS NULL));

-- Remove qualquer resolver legado que inferia titular a partir de member_id null.
DO $drop_legacy_resolver$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname, t.tgname
      FROM pg_catalog.pg_trigger t
      JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
     WHERE n.nspname='public'
       AND c.relname IN ('assets','income','expenses','debts')
       AND p.proname='validate_flow_member_link'
       AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.%I', r.tgname, r.relname);
  END LOOP;
END
$drop_legacy_resolver$;
DROP FUNCTION IF EXISTS public.validate_flow_member_link();

-- 5. Validação server-side. O user_id é derivado do plano, nunca confiado.
CREATE OR REPLACE FUNCTION public.enforce_financial_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_plan_user uuid;
  v_member_plan uuid;
  v_member_user uuid;
  v_member_status text;
  v_link_changed boolean := true;
BEGIN
  SELECT p.user_id INTO v_plan_user FROM public.plans p WHERE p.id=NEW.plan_id;
  IF v_plan_user IS NULL THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE='no_data_found';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_plan_user THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE='no_data_found';
  END IF;
  NEW.user_id := v_plan_user;

  IF NEW.ownership_scope IS NULL THEN
    RAISE EXCEPTION 'ownership_required' USING ERRCODE='not_null_violation';
  END IF;
  IF NEW.ownership_scope NOT IN ('individual','shared','needs_review') THEN
    RAISE EXCEPTION 'ownership_scope_invalid' USING ERRCODE='check_violation';
  END IF;

  IF TG_OP='UPDATE' THEN
    v_link_changed := NEW.member_id IS DISTINCT FROM OLD.member_id
                   OR NEW.ownership_scope IS DISTINCT FROM OLD.ownership_scope
                   OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
                   OR NEW.user_id IS DISTINCT FROM OLD.user_id;
  END IF;

  IF NEW.ownership_scope='individual' THEN
    IF NEW.member_id IS NULL THEN
      RAISE EXCEPTION 'member_required' USING ERRCODE='not_null_violation';
    END IF;
    SELECT pm.plan_id, pm.user_id, pm.status
      INTO v_member_plan, v_member_user, v_member_status
      FROM public.plan_members pm WHERE pm.id=NEW.member_id;
    IF v_member_plan IS NULL OR v_member_plan<>NEW.plan_id OR v_member_user<>v_plan_user THEN
      RAISE EXCEPTION 'member_scope_mismatch' USING ERRCODE='check_violation';
    END IF;
    IF v_link_changed AND v_member_status<>'active' THEN
      RAISE EXCEPTION 'member_not_active' USING ERRCODE='check_violation';
    END IF;
  ELSIF NEW.member_id IS NOT NULL THEN
    RAISE EXCEPTION 'ownership_member_mismatch' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.enforce_financial_ownership() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_financial_ownership() TO service_role;

DROP TRIGGER IF EXISTS trg_assets_enforce_ownership ON public.assets;
CREATE TRIGGER trg_assets_enforce_ownership
  BEFORE INSERT OR UPDATE OF member_id, ownership_scope, plan_id, user_id ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_ownership();
DROP TRIGGER IF EXISTS trg_income_enforce_ownership ON public.income;
CREATE TRIGGER trg_income_enforce_ownership
  BEFORE INSERT OR UPDATE OF member_id, ownership_scope, plan_id, user_id ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_ownership();
DROP TRIGGER IF EXISTS trg_expenses_enforce_ownership ON public.expenses;
CREATE TRIGGER trg_expenses_enforce_ownership
  BEFORE INSERT OR UPDATE OF member_id, ownership_scope, plan_id, user_id ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_ownership();
DROP TRIGGER IF EXISTS trg_debts_enforce_ownership ON public.debts;
CREATE TRIGGER trg_debts_enforce_ownership
  BEFORE INSERT OR UPDATE OF member_id, ownership_scope, plan_id, user_id ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_ownership();

-- 6. Resumo somente-leitura para futura UI de revisão.
CREATE OR REPLACE FUNCTION public.get_plan_ownership_review_summary_v1(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_plan_user uuid;
  v_assets int;
  v_income int;
  v_expenses int;
  v_debts int;
  v_fgc int;
  v_blob boolean;
  v_total int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT user_id INTO v_plan_user FROM public.plans WHERE id=p_plan_id;
  IF v_plan_user IS NULL OR v_plan_user<>uid THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE='no_data_found';
  END IF;

  SELECT count(*) INTO v_assets FROM public.assets
    WHERE plan_id=p_plan_id AND ownership_scope='needs_review';
  SELECT count(*) INTO v_income FROM public.income
    WHERE plan_id=p_plan_id AND ownership_scope='needs_review';
  SELECT count(*) INTO v_expenses FROM public.expenses
    WHERE plan_id=p_plan_id AND ownership_scope='needs_review';
  SELECT count(*) INTO v_debts FROM public.debts
    WHERE plan_id=p_plan_id AND ownership_scope='needs_review';
  SELECT count(*) INTO v_fgc FROM public.fgc_guarantee_events
    WHERE user_id=uid AND holder_member_id IS NULL;
  SELECT EXISTS(
    SELECT 1 FROM public.user_financial_data
     WHERE user_id=uid
       AND ((plan_data IS NOT NULL AND plan_data<>'{}'::jsonb)
         OR (app_data IS NOT NULL AND app_data<>'{}'::jsonb))
  ) INTO v_blob;

  -- O blob é uma categoria disjunta de revisão e conta como um item de atenção.
  v_total := v_assets + v_income + v_expenses + v_debts + v_fgc
           + CASE WHEN v_blob THEN 1 ELSE 0 END;

  RETURN jsonb_build_object(
    'plan_id', p_plan_id,
    'assets_needs_review', v_assets,
    'income_needs_review', v_income,
    'expenses_needs_review', v_expenses,
    'debts_needs_review', v_debts,
    'fgc_without_holder', v_fgc,
    'legacy_blob_present', v_blob,
    'total_needs_review', v_total
  );
END
$function$;
REVOKE ALL ON FUNCTION public.get_plan_ownership_review_summary_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_plan_ownership_review_summary_v1(uuid)
  TO authenticated, service_role;

COMMENT ON COLUMN public.assets.ownership_scope IS 'individual, shared ou needs_review; null nunca possui significado implícito';
COMMENT ON COLUMN public.income.ownership_scope IS 'individual, shared ou needs_review; null nunca possui significado implícito';
COMMENT ON COLUMN public.expenses.ownership_scope IS 'individual, shared ou needs_review; null nunca possui significado implícito';
COMMENT ON COLUMN public.debts.ownership_scope IS 'individual, shared ou needs_review; null nunca possui significado implícito';
