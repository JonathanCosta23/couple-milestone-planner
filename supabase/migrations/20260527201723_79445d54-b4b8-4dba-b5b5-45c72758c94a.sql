
DROP FUNCTION IF EXISTS public.reset_user_plan_data();

CREATE OR REPLACE FUNCTION public.upsert_plan_with_members(
  p_mode text,
  p_primary_name text,
  p_primary_age integer DEFAULT NULL,
  p_partner_name text DEFAULT NULL,
  p_partner_age integer DEFAULT NULL,
  p_goal_amount numeric DEFAULT NULL,
  p_initial_amount numeric DEFAULT NULL,
  p_monthly_contribution numeric DEFAULT NULL,
  p_goal_years integer DEFAULT NULL,
  p_goal_purpose text DEFAULT NULL,
  p_goal_purpose_custom text DEFAULT NULL,
  p_wizard_complete boolean DEFAULT NULL,
  p_onboarding_complete boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_existing_primary public.plan_members%ROWTYPE;
  v_existing_partner public.plan_members%ROWTYPE;
  v_members jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'upsert_plan_with_members: usuário não autenticado.';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('individual', 'casal') THEN
    RAISE EXCEPTION 'upsert_plan_with_members: modo inválido (use individual ou casal).';
  END IF;

  SELECT * INTO v_plan FROM public.plans
   WHERE user_id = uid ORDER BY created_at ASC LIMIT 1;

  IF v_plan.id IS NULL THEN
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
    )
    RETURNING * INTO v_plan;
  ELSE
    UPDATE public.plans SET
      mode = p_mode,
      goal_amount = COALESCE(p_goal_amount, goal_amount),
      initial_amount = COALESCE(p_initial_amount, initial_amount),
      monthly_contribution = COALESCE(p_monthly_contribution, monthly_contribution),
      goal_years = COALESCE(p_goal_years, goal_years),
      goal_months = COALESCE(p_goal_years * 12, goal_months),
      goal_purpose = COALESCE(p_goal_purpose, goal_purpose),
      goal_purpose_custom = COALESCE(p_goal_purpose_custom, goal_purpose_custom),
      wizard_complete = COALESCE(p_wizard_complete, wizard_complete),
      onboarding_complete = COALESCE(p_onboarding_complete, onboarding_complete),
      updated_at = now()
    WHERE id = v_plan.id AND user_id = uid
    RETURNING * INTO v_plan;
  END IF;

  SELECT * INTO v_existing_primary FROM public.plan_members
   WHERE plan_id = v_plan.id AND is_primary = true
   ORDER BY created_at ASC LIMIT 1;

  IF v_existing_primary.id IS NULL THEN
    INSERT INTO public.plan_members (plan_id, user_id, name, age, is_primary, role, is_active)
    VALUES (v_plan.id, uid, p_primary_name, p_primary_age, true, 'titular', true);
  ELSE
    UPDATE public.plan_members
       SET name = p_primary_name,
           age = COALESCE(p_primary_age, age),
           is_active = true,
           updated_at = now()
     WHERE id = v_existing_primary.id;
  END IF;

  SELECT * INTO v_existing_partner FROM public.plan_members
   WHERE plan_id = v_plan.id AND is_primary = false
   ORDER BY created_at ASC LIMIT 1;

  IF p_mode = 'casal' THEN
    IF v_existing_partner.id IS NULL THEN
      IF p_partner_name IS NOT NULL AND length(trim(p_partner_name)) > 0 THEN
        INSERT INTO public.plan_members (plan_id, user_id, name, age, is_primary, role, is_active)
        VALUES (v_plan.id, uid, p_partner_name, p_partner_age, false, 'parceiro', true);
      END IF;
    ELSE
      UPDATE public.plan_members
         SET name = COALESCE(NULLIF(p_partner_name, ''), name),
             age = COALESCE(p_partner_age, age),
             is_active = true,
             updated_at = now()
       WHERE id = v_existing_partner.id;
    END IF;
  ELSE
    IF v_existing_partner.id IS NOT NULL AND v_existing_partner.is_active THEN
      UPDATE public.plan_members
         SET is_active = false, updated_at = now()
       WHERE id = v_existing_partner.id;
    END IF;
  END IF;

  SELECT jsonb_agg(to_jsonb(pm.*) ORDER BY pm.is_primary DESC, pm.created_at ASC)
    INTO v_members
    FROM public.plan_members pm
   WHERE pm.plan_id = v_plan.id AND pm.is_active = true;

  RETURN jsonb_build_object(
    'plan', to_jsonb(v_plan),
    'members', COALESCE(v_members, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_plan_with_members(text, text, integer, text, integer, numeric, numeric, numeric, integer, text, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_plan_with_members(text, text, integer, text, integer, numeric, numeric, numeric, integer, text, text, boolean, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_month_with_members(
  p_plan_id uuid,
  p_month_key text,
  p_members jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL,
  p_completed boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_tracking public.monthly_tracking%ROWTYPE;
  v_year integer;
  v_month integer;
  v_planned_total numeric := 0;
  v_actual_total numeric := 0;
  v_shortfall numeric;
  v_status text;
  v_member jsonb;
  v_member_id uuid;
  v_invalid_count integer;
  v_members_out jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'upsert_month_with_members: usuário não autenticado.';
  END IF;
  IF p_plan_id IS NULL OR p_month_key IS NULL THEN
    RAISE EXCEPTION 'upsert_month_with_members: plan_id e month_key são obrigatórios.';
  END IF;

  PERFORM 1 FROM public.plans WHERE id = p_plan_id AND user_id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'upsert_month_with_members: plano não pertence ao usuário.';
  END IF;

  v_year  := split_part(p_month_key, '-', 1)::integer;
  v_month := split_part(p_month_key, '-', 2)::integer;

  IF jsonb_typeof(p_members) = 'array' THEN
    FOR v_member IN SELECT * FROM jsonb_array_elements(p_members) LOOP
      v_planned_total := v_planned_total
        + COALESCE((v_member->>'planned_selic')::numeric, 0)
        + COALESCE((v_member->>'planned_cdb')::numeric, 0);
      v_actual_total := v_actual_total
        + COALESCE((v_member->>'actual_selic')::numeric, 0)
        + COALESCE((v_member->>'actual_cdb')::numeric, 0);
    END LOOP;
  END IF;

  v_shortfall := GREATEST(0, v_planned_total - v_actual_total);

  IF COALESCE(p_completed, false) THEN
    v_status := 'completed';
  ELSIF v_actual_total <= 0 THEN
    v_status := 'pending';
  ELSIF v_actual_total >= v_planned_total AND v_planned_total > 0 THEN
    v_status := 'completed';
  ELSE
    v_status := 'partial';
  END IF;

  IF jsonb_typeof(p_members) = 'array' AND jsonb_array_length(p_members) > 0 THEN
    SELECT COUNT(*) INTO v_invalid_count
      FROM jsonb_array_elements(p_members) AS elem
     WHERE NOT EXISTS (
       SELECT 1 FROM public.plan_members pm
        WHERE pm.id = (elem->>'plan_member_id')::uuid
          AND pm.plan_id = p_plan_id
          AND pm.user_id = uid
          AND pm.is_active = true
     );
    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION 'upsert_month_with_members: % membro(s) inválido(s) para este plano.', v_invalid_count;
    END IF;
  END IF;

  INSERT INTO public.monthly_tracking (
    user_id, plan_id, year, month, month_key,
    planned_total, actual_total, shortfall, status, notes
  ) VALUES (
    uid, p_plan_id, v_year, v_month, p_month_key,
    v_planned_total, v_actual_total, v_shortfall, v_status, p_notes
  )
  ON CONFLICT (plan_id, month_key) DO UPDATE SET
    year = EXCLUDED.year,
    month = EXCLUDED.month,
    planned_total = EXCLUDED.planned_total,
    actual_total = EXCLUDED.actual_total,
    shortfall = EXCLUDED.shortfall,
    status = EXCLUDED.status,
    notes = COALESCE(EXCLUDED.notes, public.monthly_tracking.notes),
    updated_at = now()
  RETURNING * INTO v_tracking;

  DELETE FROM public.monthly_member_tracking
   WHERE monthly_tracking_id = v_tracking.id AND user_id = uid;

  IF jsonb_typeof(p_members) = 'array' THEN
    FOR v_member IN SELECT * FROM jsonb_array_elements(p_members) LOOP
      v_member_id := NULLIF(v_member->>'plan_member_id', '')::uuid;
      IF v_member_id IS NULL THEN CONTINUE; END IF;
      INSERT INTO public.monthly_member_tracking (
        user_id, monthly_tracking_id, plan_member_id,
        planned_selic, planned_cdb, actual_selic, actual_cdb
      ) VALUES (
        uid, v_tracking.id, v_member_id,
        COALESCE((v_member->>'planned_selic')::numeric, 0),
        COALESCE((v_member->>'planned_cdb')::numeric, 0),
        COALESCE((v_member->>'actual_selic')::numeric, 0),
        COALESCE((v_member->>'actual_cdb')::numeric, 0)
      );
    END LOOP;
  END IF;

  SELECT jsonb_agg(to_jsonb(mm.*) ORDER BY mm.created_at ASC)
    INTO v_members_out
    FROM public.monthly_member_tracking mm
   WHERE mm.monthly_tracking_id = v_tracking.id;

  RETURN jsonb_build_object(
    'tracking', to_jsonb(v_tracking),
    'members', COALESCE(v_members_out, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_month_with_members(uuid, text, jsonb, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_month_with_members(uuid, text, jsonb, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_user_plan_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_counts jsonb := '{}'::jsonb;
  v_deleted integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'reset_user_plan_data: usuário não autenticado.';
  END IF;

  DELETE FROM public.monthly_member_tracking WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('monthly_member_tracking', v_deleted);

  DELETE FROM public.monthly_tracking WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('monthly_tracking', v_deleted);

  DELETE FROM public.assets WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('assets', v_deleted);

  DELETE FROM public.income WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('income', v_deleted);

  DELETE FROM public.expenses WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('expenses', v_deleted);

  DELETE FROM public.debts WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('debts', v_deleted);

  DELETE FROM public.milestones WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('milestones', v_deleted);

  DELETE FROM public.insights_log WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('insights_log', v_deleted);

  DELETE FROM public.education_progress WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('education_progress', v_deleted);

  DELETE FROM public.plan_members WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('plan_members', v_deleted);

  DELETE FROM public.plans WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('plans', v_deleted);

  UPDATE public.user_financial_data
     SET plan_data = '{}'::jsonb,
         app_data  = '{}'::jsonb,
         updated_at = now()
   WHERE user_id = uid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('user_financial_data_cleared', v_deleted);

  RETURN jsonb_build_object('ok', true, 'user_id', uid, 'cleared', v_counts);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_user_plan_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_user_plan_data() TO authenticated;
