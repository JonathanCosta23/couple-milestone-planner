-- 1. Constraint trigger valida OLD.plan_id e NEW.plan_id
CREATE OR REPLACE FUNCTION public.assert_plan_mode_consistency_for(p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_mode    text;
  v_primary integer;
  v_partner integer;
BEGIN
  IF p_plan_id IS NULL THEN
    RETURN;
  END IF;
  SELECT mode INTO v_mode FROM public.plans WHERE id = p_plan_id;
  IF v_mode IS NULL THEN
    -- Plano apagado nesta transação; membros seguem em cascade.
    RETURN;
  END IF;
  SELECT
    count(*) FILTER (WHERE is_primary AND status = 'active'),
    count(*) FILTER (WHERE NOT is_primary AND status = 'active')
  INTO v_primary, v_partner
  FROM public.plan_members
  WHERE plan_id = p_plan_id;

  IF v_primary <> 1 THEN
    RAISE EXCEPTION 'plan_members_inconsistent: plan=% requer 1 titular ativo, tem %', p_plan_id, v_primary
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_mode = 'individual' AND v_partner <> 0 THEN
    RAISE EXCEPTION 'plan_members_inconsistent: plan=% modo individual requer 0 parceiros ativos, tem %', p_plan_id, v_partner
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_mode = 'casal' AND v_partner <> 1 THEN
    RAISE EXCEPTION 'plan_members_inconsistent: plan=% modo casal requer 1 parceiro ativo, tem %', p_plan_id, v_partner
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_plan_mode_consistency_for(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.assert_plan_mode_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_old uuid;
  v_new uuid;
BEGIN
  IF TG_TABLE_NAME = 'plans' THEN
    v_old := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.id ELSE NULL END;
    v_new := CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN NEW.id ELSE NULL END;
  ELSE
    v_old := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN OLD.plan_id ELSE NULL END;
    v_new := CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN NEW.plan_id ELSE NULL END;
  END IF;

  IF v_old IS NOT NULL THEN
    PERFORM public.assert_plan_mode_consistency_for(v_old);
  END IF;
  IF v_new IS NOT NULL AND v_new IS DISTINCT FROM v_old THEN
    PERFORM public.assert_plan_mode_consistency_for(v_new);
  END IF;
  RETURN NULL;
END;
$$;

-- 2. plans: sem INSERT/DELETE diretos; UPDATE só em colunas de configuração
REVOKE INSERT, DELETE, UPDATE ON public.plans FROM authenticated;
REVOKE INSERT, DELETE, UPDATE ON public.plans FROM anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT UPDATE (
  goal_amount,
  initial_amount,
  monthly_contribution,
  goal_years,
  goal_months,
  goal_purpose,
  goal_purpose_custom,
  assumption_selic,
  assumption_cdb_pct,
  assumption_inflation,
  assumption_ir,
  assumption_iof,
  wizard_complete,
  onboarding_complete,
  updated_at
) ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

-- 3. Reintegração exige identidade privada válida
CREATE OR REPLACE FUNCTION public.reintegrate_plan_member_v1(p_plan_id uuid, p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_plan_user uuid;
  v_member public.plan_members%ROWTYPE;
  v_identity public.plan_member_private_identity%ROWTYPE;
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

  -- Identidade privada precisa existir, pertencer ao mesmo plano/usuário
  -- e conter HMAC íntegro. Sem isso, não há reintegração.
  SELECT * INTO v_identity FROM public.plan_member_private_identity
   WHERE member_id = p_member_id LIMIT 1;
  IF NOT FOUND
     OR v_identity.plan_id <> p_plan_id
     OR v_identity.user_id <> uid
     OR v_identity.cpf_hmac IS NULL
     OR v_identity.cpf_hmac !~ '^[a-f0-9]{64}$'
     OR coalesce(btrim(v_identity.hmac_key_version), '') = ''
     OR v_member.cpf_last4 IS NULL
     OR v_member.cpf_last4 !~ '^[0-9]{4}$' THEN
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

-- 4. Preview de impacto: legado sem titular + escopo do impacto
CREATE OR REPLACE FUNCTION public.get_plan_member_removal_impact_v1(p_plan_id uuid, p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_member public.plan_members%ROWTYPE;
  v_plan_user uuid;
  v_assets int; v_income int; v_expenses int; v_recurring int; v_debts int;
  v_mmt int; v_fgc int;
  v_legacy_assets int; v_legacy_income int; v_legacy_expenses int; v_legacy_debts int;
  v_legacy_total int;
  v_linked_total int;
  v_scope text;
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

  SELECT count(*) INTO v_assets   FROM public.assets   WHERE plan_id=p_plan_id AND member_id=p_member_id;
  SELECT count(*) INTO v_income   FROM public.income   WHERE plan_id=p_plan_id AND member_id=p_member_id;
  SELECT count(*) INTO v_expenses FROM public.expenses WHERE plan_id=p_plan_id AND member_id=p_member_id;
  -- Subconjunto de v_expenses: recorrentes já estão contabilizadas em expenses.
  SELECT count(*) INTO v_recurring FROM public.expenses
   WHERE plan_id=p_plan_id AND member_id=p_member_id AND is_recurring;
  SELECT count(*) INTO v_debts    FROM public.debts    WHERE plan_id=p_plan_id AND member_id=p_member_id;
  SELECT count(*) INTO v_mmt      FROM public.monthly_member_tracking WHERE plan_member_id=p_member_id;
  SELECT count(*) INTO v_fgc      FROM public.fgc_guarantee_events WHERE user_id=uid AND holder_member_id=p_member_id;

  SELECT count(*) INTO v_legacy_assets   FROM public.assets   WHERE plan_id=p_plan_id AND member_id IS NULL;
  SELECT count(*) INTO v_legacy_income   FROM public.income   WHERE plan_id=p_plan_id AND member_id IS NULL;
  SELECT count(*) INTO v_legacy_expenses FROM public.expenses WHERE plan_id=p_plan_id AND member_id IS NULL;
  SELECT count(*) INTO v_legacy_debts    FROM public.debts    WHERE plan_id=p_plan_id AND member_id IS NULL;

  v_legacy_total := v_legacy_assets + v_legacy_income + v_legacy_expenses + v_legacy_debts;
  v_linked_total := v_assets + v_income + v_expenses + v_debts + v_mmt + v_fgc;

  IF v_linked_total = 0 THEN
    v_scope := 'none';
  ELSIF v_mmt > 0 OR v_fgc > 0 OR v_assets > 0 THEN
    v_scope := 'wealth_and_history';
  ELSE
    v_scope := 'cashflow_only';
  END IF;

  RETURN jsonb_build_object(
    'plan_id',   p_plan_id,
    'member_id', p_member_id,
    'linked', jsonb_build_object(
      'assets',                  v_assets,
      'income',                  v_income,
      'expenses',                v_expenses,
      -- recurring_expenses_count é SUBCONJUNTO de expenses: nunca somar aos dois.
      'expenses_recurring',      v_recurring,
      'recurring_expenses_count', v_recurring,
      'debts',                   v_debts,
      'monthly_member_tracking', v_mmt,
      'fgc_events',              v_fgc,
      'total',                   v_linked_total
    ),
    'unassigned', jsonb_build_object(
      'assets_no_member',   v_legacy_assets,
      'income_no_member',   v_legacy_income,
      'expenses_no_member', v_legacy_expenses,
      'debts_no_member',    v_legacy_debts,
      'total',              v_legacy_total
    ),
    'legacy_data_requires_review', (v_legacy_total > 0),
    'impact_scope', v_scope
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reintegrate_plan_member_v1(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_plan_member_removal_impact_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reintegrate_plan_member_v1(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_plan_member_removal_impact_v1(uuid, uuid) TO authenticated, service_role;