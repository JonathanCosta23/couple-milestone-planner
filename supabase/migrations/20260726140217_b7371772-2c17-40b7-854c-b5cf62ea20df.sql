
-- =====================================================================
-- Passo 4.b.1 — Integridade do modo, ciclo de vida e preparo de reintegração.
-- Todas as operações são reversíveis: sem DELETE de dados existentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Preflight: aborta se houver plano inconsistente
-- ---------------------------------------------------------------------
DO $preflight$
DECLARE
  bad_count integer := 0;
  bad_report text := '';
  r record;
BEGIN
  FOR r IN
    SELECT
      p.id,
      p.mode,
      (SELECT count(*) FROM public.plan_members m
        WHERE m.plan_id = p.id AND m.status = 'active' AND m.is_primary) AS n_primary,
      (SELECT count(*) FROM public.plan_members m
        WHERE m.plan_id = p.id AND m.status = 'active' AND NOT m.is_primary) AS n_partner
    FROM public.plans p
  LOOP
    IF r.n_primary <> 1
       OR (r.mode = 'individual' AND r.n_partner <> 0)
       OR (r.mode = 'casal'      AND r.n_partner <> 1)
    THEN
      bad_count := bad_count + 1;
      bad_report := bad_report || format(
        '  plan=%s mode=%s primary_active=%s partner_active=%s',
        r.id, r.mode, r.n_primary, r.n_partner) || E'\n';
    END IF;
  END LOOP;
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'preflight_inconsistent_plans: % plano(s) precisam de correção manual antes de aplicar a constraint:%s%s',
      bad_count, E'\n', bad_report;
  END IF;
END
$preflight$;

-- ---------------------------------------------------------------------
-- 2) Função e constraint triggers diferidos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_plan_mode_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_id uuid;
  v_mode    text;
  v_primary integer;
  v_partner integer;
BEGIN
  IF TG_TABLE_NAME = 'plans' THEN
    v_plan_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_plan_id := COALESCE(NEW.plan_id, OLD.plan_id);
  END IF;
  IF v_plan_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT mode INTO v_mode FROM public.plans WHERE id = v_plan_id;
  IF v_mode IS NULL THEN
    -- Plano foi apagado nesta transação; membros seguem em cascade.
    RETURN NULL;
  END IF;
  SELECT
    count(*) FILTER (WHERE is_primary AND status = 'active'),
    count(*) FILTER (WHERE NOT is_primary AND status = 'active')
  INTO v_primary, v_partner
  FROM public.plan_members
  WHERE plan_id = v_plan_id;

  IF v_primary <> 1 THEN
    RAISE EXCEPTION 'plan_members_inconsistent: plan=% requer 1 titular ativo, tem %', v_plan_id, v_primary
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_mode = 'individual' AND v_partner <> 0 THEN
    RAISE EXCEPTION 'plan_members_inconsistent: plan=% modo individual requer 0 parceiros ativos, tem %', v_plan_id, v_partner
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_mode = 'casal' AND v_partner <> 1 THEN
    RAISE EXCEPTION 'plan_members_inconsistent: plan=% modo casal requer 1 parceiro ativo, tem %', v_plan_id, v_partner
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_plans_mode_consistency        ON public.plans;
DROP TRIGGER IF EXISTS trg_members_mode_consistency      ON public.plan_members;

CREATE CONSTRAINT TRIGGER trg_plans_mode_consistency
  AFTER INSERT OR UPDATE ON public.plans
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.assert_plan_mode_consistency();

CREATE CONSTRAINT TRIGGER trg_members_mode_consistency
  AFTER INSERT OR UPDATE OR DELETE ON public.plan_members
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.assert_plan_mode_consistency();

-- ---------------------------------------------------------------------
-- 3) Proteger plans.mode contra UPDATE direto por clientes
-- ---------------------------------------------------------------------
-- Revoga UPDATE total e concede apenas nas colunas realmente editáveis.
-- Escritas em `mode` passam obrigatoriamente pelas RPCs SECURITY DEFINER
-- (add_plan_partner_v1, remove_plan_partner_v1, normalize_plan_mode_v1,
-- upsert_plan_with_members_v3, reintegrate_plan_member_v1).
REVOKE UPDATE ON public.plans FROM anon, authenticated;
GRANT UPDATE (
  goal_amount, initial_amount, monthly_contribution,
  goal_years, goal_months, goal_purpose, goal_purpose_custom,
  assumption_selic, assumption_cdb_pct, assumption_inflation,
  assumption_ir, assumption_iof, engine_version, status, start_date,
  onboarding_complete, wizard_complete, updated_at
) ON public.plans TO authenticated;

-- ---------------------------------------------------------------------
-- 4) normalize_plan_mode_v1: só corrige mode a partir dos membros reais
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_plan_mode_v1(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_primary integer;
  v_partner integer;
  v_target text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND user_id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT
    count(*) FILTER (WHERE is_primary AND status = 'active'),
    count(*) FILTER (WHERE NOT is_primary AND status = 'active')
  INTO v_primary, v_partner
  FROM public.plan_members
  WHERE plan_id = p_plan_id;

  IF v_primary = 1 AND v_partner = 0 THEN
    v_target := 'individual';
  ELSIF v_primary = 1 AND v_partner = 1 THEN
    v_target := 'casal';
  ELSE
    RAISE EXCEPTION 'plan_members_inconsistent' USING ERRCODE = 'check_violation';
  END IF;

  IF v_plan.mode <> v_target THEN
    UPDATE public.plans
       SET mode = v_target, updated_at = now()
     WHERE id = p_plan_id AND user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'plan_id',        p_plan_id,
    'mode',           v_target,
    'primary_active', v_primary,
    'partner_active', v_partner
  );
END;
$$;
REVOKE ALL ON FUNCTION public.normalize_plan_mode_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_plan_mode_v1(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5) add_plan_partner_v1 — payload enxuto
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_plan_partner_v1(
  p_plan_id uuid,
  p_name    text,
  p_age     integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_plan_user uuid;
  v_new public.plan_members%ROWTYPE;
  v_name text := NULLIF(btrim(coalesce(p_name, '')), '');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_plan_id IS NULL OR v_name IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF p_age IS NOT NULL AND (p_age < 0 OR p_age > 130) THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;

  SELECT user_id INTO v_plan_user
    FROM public.plans WHERE id = p_plan_id LIMIT 1;
  IF v_plan_user IS NULL OR v_plan_user <> uid THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.plan_members
     WHERE plan_id = p_plan_id
       AND is_primary = false
       AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'partner_already_active' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.plan_members
    (plan_id, user_id, name, age, is_primary, role, status)
  VALUES
    (p_plan_id, uid, v_name, p_age, false, 'parceiro', 'active')
  RETURNING * INTO v_new;

  UPDATE public.plans
     SET mode = 'casal', updated_at = now()
   WHERE id = p_plan_id AND user_id = uid;

  RETURN jsonb_build_object(
    'plan_id',    p_plan_id,
    'partner_id', v_new.id,
    'mode',       'casal',
    'partner',    jsonb_build_object(
      'id',           v_new.id,
      'plan_id',      v_new.plan_id,
      'name',         v_new.name,
      'age',          v_new.age,
      'avatar_color', v_new.avatar_color,
      'is_primary',   v_new.is_primary,
      'is_active',    v_new.is_active,
      'role',         v_new.role,
      'status',       v_new.status
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.add_plan_partner_v1(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_plan_partner_v1(uuid, text, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6) upsert_plan_with_members_v3 — trata plano NOVO vs EXISTENTE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_plan_with_members_v3(
  p_mode                  text,
  p_primary_name          text,
  p_plan_id               uuid    DEFAULT NULL,
  p_primary_age           integer DEFAULT NULL,
  p_partner_name          text    DEFAULT NULL,
  p_partner_age           integer DEFAULT NULL,
  p_goal_amount           numeric DEFAULT NULL,
  p_initial_amount        numeric DEFAULT NULL,
  p_monthly_contribution  numeric DEFAULT NULL,
  p_goal_years            integer DEFAULT NULL,
  p_goal_purpose          text    DEFAULT NULL,
  p_goal_purpose_custom   text    DEFAULT NULL,
  p_wizard_complete       boolean DEFAULT NULL,
  p_onboarding_complete   boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_primary public.plan_members%ROWTYPE;
  v_active_partner public.plan_members%ROWTYPE;
  v_members jsonb;
  v_partner_name text := NULLIF(btrim(coalesce(p_partner_name, '')), '');
  v_primary_name text := NULLIF(btrim(coalesce(p_primary_name, '')), '');
  v_is_new_plan boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_mode NOT IN ('individual', 'casal') THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF v_primary_name IS NULL OR length(v_primary_name) > 120 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF p_primary_age IS NOT NULL AND (p_primary_age < 0 OR p_primary_age > 130) THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF v_partner_name IS NOT NULL AND length(v_partner_name) > 120 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF p_partner_age IS NOT NULL AND (p_partner_age < 0 OR p_partner_age > 130) THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;

  -- Resolve plano alvo
  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.plans
     WHERE id = p_plan_id AND user_id = uid LIMIT 1;
    IF v_plan.id IS NULL THEN
      RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'no_data_found';
    END IF;
  ELSE
    SELECT * INTO v_plan FROM public.plans
     WHERE user_id = uid ORDER BY created_at ASC LIMIT 1;
  END IF;

  v_is_new_plan := (v_plan.id IS NULL);

  IF v_is_new_plan THEN
    INSERT INTO public.plans (
      user_id, mode, goal_amount, initial_amount, monthly_contribution,
      goal_years, goal_months, goal_purpose, goal_purpose_custom,
      wizard_complete, onboarding_complete
    ) VALUES (
      uid, p_mode,
      COALESCE(p_goal_amount, 1000000),
      COALESCE(p_initial_amount, 0),
      COALESCE(p_monthly_contribution, 0),
      COALESCE(p_goal_years, 21),
      COALESCE(p_goal_years, 21) * 12,
      p_goal_purpose, p_goal_purpose_custom,
      COALESCE(p_wizard_complete, true),
      COALESCE(p_onboarding_complete, false)
    ) RETURNING * INTO v_plan;

    -- Titular sempre criado no fluxo novo (com trigger de link automático).
    INSERT INTO public.plan_members (plan_id, user_id, name, age, is_primary, role, status)
    VALUES (v_plan.id, uid, v_primary_name, p_primary_age, true, 'titular', 'active')
    RETURNING * INTO v_primary;

    -- Parceiro só no modo casal, exigindo nome.
    IF p_mode = 'casal' THEN
      IF v_partner_name IS NULL THEN
        RAISE EXCEPTION 'partner_name_required' USING ERRCODE = 'check_violation';
      END IF;
      INSERT INTO public.plan_members
        (plan_id, user_id, name, age, is_primary, role, status)
      VALUES
        (v_plan.id, uid, v_partner_name, p_partner_age, false, 'parceiro', 'active');
    END IF;
  ELSE
    -- Plano existente: proibido mudar ciclo de vida por aqui.
    IF v_plan.mode <> p_mode THEN
      RAISE EXCEPTION 'member_lifecycle_action_required' USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.plans SET
      goal_amount           = COALESCE(p_goal_amount, goal_amount),
      initial_amount        = COALESCE(p_initial_amount, initial_amount),
      monthly_contribution  = COALESCE(p_monthly_contribution, monthly_contribution),
      goal_years            = COALESCE(p_goal_years, goal_years),
      goal_months           = COALESCE(p_goal_years * 12, goal_months),
      goal_purpose          = COALESCE(p_goal_purpose, goal_purpose),
      goal_purpose_custom   = COALESCE(p_goal_purpose_custom, goal_purpose_custom),
      wizard_complete       = COALESCE(p_wizard_complete, wizard_complete),
      onboarding_complete   = COALESCE(p_onboarding_complete, onboarding_complete),
      updated_at            = now()
    WHERE id = v_plan.id AND user_id = uid
    RETURNING * INTO v_plan;

    -- Atualiza nome/idade do titular ativo se houver.
    SELECT * INTO v_primary FROM public.plan_members
     WHERE plan_id = v_plan.id AND is_primary = true AND status = 'active'
     ORDER BY created_at ASC LIMIT 1;
    IF v_primary.id IS NOT NULL THEN
      UPDATE public.plan_members
         SET name = v_primary_name,
             age  = COALESCE(p_primary_age, age),
             updated_at = now()
       WHERE id = v_primary.id;
    END IF;

    -- Atualiza nome/idade do parceiro ativo se houver e se veio no payload.
    SELECT * INTO v_active_partner FROM public.plan_members
     WHERE plan_id = v_plan.id AND is_primary = false AND status = 'active'
     ORDER BY created_at ASC LIMIT 1;
    IF v_active_partner.id IS NOT NULL AND v_partner_name IS NOT NULL THEN
      UPDATE public.plan_members
         SET name = v_partner_name,
             age  = COALESCE(p_partner_age, age),
             updated_at = now()
       WHERE id = v_active_partner.id;
    END IF;
    -- Nunca cria, remove ou reativa parceiro aqui.
  END IF;

  -- Retorno enxuto: só campos seguros dos membros ativos.
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pm.id, 'plan_id', pm.plan_id, 'name', pm.name, 'age', pm.age,
      'avatar_color', pm.avatar_color, 'is_primary', pm.is_primary,
      'is_active', pm.is_active, 'role', pm.role, 'status', pm.status
    ) ORDER BY pm.is_primary DESC, pm.created_at ASC
  )
  INTO v_members
  FROM public.plan_members pm
  WHERE pm.plan_id = v_plan.id AND pm.status = 'active';

  RETURN jsonb_build_object(
    'plan',    to_jsonb(v_plan),
    'members', COALESCE(v_members, '[]'::jsonb),
    'is_new_plan', v_is_new_plan
  );
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_plan_with_members_v3(
  text, text, uuid, integer, text, integer,
  numeric, numeric, numeric, integer, text, text, boolean, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_plan_with_members_v3(
  text, text, uuid, integer, text, integer,
  numeric, numeric, numeric, integer, text, text, boolean, boolean
) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7) get_plan_member_removal_impact_v1: preview somente-leitura
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_plan_member_removal_impact_v1(
  p_plan_id   uuid,
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_member public.plan_members%ROWTYPE;
  v_plan_user uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_plan_id IS NULL OR p_member_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  SELECT user_id INTO v_plan_user FROM public.plans WHERE id = p_plan_id LIMIT 1;
  IF v_plan_user IS NULL OR v_plan_user <> uid THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO v_member FROM public.plan_members
   WHERE id = p_member_id AND plan_id = p_plan_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_member.is_primary THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF v_member.status <> 'active' THEN
    RAISE EXCEPTION 'member_not_active' USING ERRCODE = 'check_violation';
  END IF;

  RETURN jsonb_build_object(
    'plan_id',   p_plan_id,
    'member_id', p_member_id,
    'linked', jsonb_build_object(
      'assets',                    (SELECT count(*) FROM public.assets   WHERE plan_id=p_plan_id AND member_id=p_member_id),
      'income',                    (SELECT count(*) FROM public.income   WHERE plan_id=p_plan_id AND member_id=p_member_id),
      'expenses',                  (SELECT count(*) FROM public.expenses WHERE plan_id=p_plan_id AND member_id=p_member_id),
      'expenses_recurring',        (SELECT count(*) FROM public.expenses WHERE plan_id=p_plan_id AND member_id=p_member_id AND is_recurring),
      'debts',                     (SELECT count(*) FROM public.debts    WHERE plan_id=p_plan_id AND member_id=p_member_id),
      'monthly_member_tracking',   (SELECT count(*) FROM public.monthly_member_tracking WHERE plan_member_id=p_member_id),
      'fgc_events',                (SELECT count(*) FROM public.fgc_guarantee_events WHERE user_id=uid AND holder_member_id=p_member_id)
    ),
    'unassigned', jsonb_build_object(
      'assets_no_member',   (SELECT count(*) FROM public.assets   WHERE plan_id=p_plan_id AND member_id IS NULL),
      'income_no_member',   (SELECT count(*) FROM public.income   WHERE plan_id=p_plan_id AND member_id IS NULL),
      'expenses_no_member', (SELECT count(*) FROM public.expenses WHERE plan_id=p_plan_id AND member_id IS NULL),
      'debts_no_member',    (SELECT count(*) FROM public.debts    WHERE plan_id=p_plan_id AND member_id IS NULL)
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_plan_member_removal_impact_v1(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_plan_member_removal_impact_v1(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8) reintegrate_plan_member_v1: explícita, exige identidade verificada
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reintegrate_plan_member_v1(
  p_plan_id   uuid,
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_plan_user uuid;
  v_member public.plan_members%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_plan_id IS NULL OR p_member_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  SELECT user_id INTO v_plan_user FROM public.plans WHERE id = p_plan_id LIMIT 1;
  IF v_plan_user IS NULL OR v_plan_user <> uid THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO v_member FROM public.plan_members
   WHERE id = p_member_id AND plan_id = p_plan_id AND user_id = uid LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_member.is_primary THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF v_member.status <> 'removed' THEN
    RAISE EXCEPTION 'member_not_removed' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.plan_members
     WHERE plan_id = p_plan_id AND is_primary = false AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'partner_already_active' USING ERRCODE = 'unique_violation';
  END IF;
  IF v_member.identity_status <> 'verified' THEN
    RAISE EXCEPTION 'identity_verification_required' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.plan_members
     SET status = 'active', updated_at = now()
   WHERE id = p_member_id;

  UPDATE public.plans
     SET mode = 'casal', updated_at = now()
   WHERE id = p_plan_id AND user_id = uid;

  RETURN jsonb_build_object(
    'plan_id',   p_plan_id,
    'member_id', p_member_id,
    'mode',      'casal'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.reintegrate_plan_member_v1(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reintegrate_plan_member_v1(uuid, uuid) TO authenticated, service_role;
