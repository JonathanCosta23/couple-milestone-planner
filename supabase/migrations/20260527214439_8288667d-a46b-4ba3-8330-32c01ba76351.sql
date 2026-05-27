CREATE OR REPLACE FUNCTION public.upsert_plan_with_members_v2(
  p_mode text,
  p_primary_name text,
  p_plan_id uuid DEFAULT NULL,
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
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_existing_primary public.plan_members%ROWTYPE;
  v_existing_partner public.plan_members%ROWTYPE;
  v_members jsonb;
  v_partner_name text := NULLIF(trim(COALESCE(p_partner_name, '')), '');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'upsert_plan_with_members_v2: usuário não autenticado.';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('individual', 'casal') THEN
    RAISE EXCEPTION 'upsert_plan_with_members_v2: modo inválido (use individual ou casal).';
  END IF;
  IF p_primary_name IS NULL OR length(trim(p_primary_name)) = 0 THEN
    RAISE EXCEPTION 'upsert_plan_with_members_v2: nome do titular é obrigatório.';
  END IF;

  -- Resolve plano alvo: explícito (com validação) ou principal do usuário.
  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.plans
     WHERE id = p_plan_id AND user_id = uid LIMIT 1;
    IF v_plan.id IS NULL THEN
      RAISE EXCEPTION 'upsert_plan_with_members_v2: plano % não pertence ao usuário.', p_plan_id;
    END IF;
  ELSE
    SELECT * INTO v_plan FROM public.plans
     WHERE user_id = uid ORDER BY created_at ASC LIMIT 1;
  END IF;

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
      IF v_partner_name IS NULL THEN
        RAISE EXCEPTION 'upsert_plan_with_members_v2: modo casal exige nome do parceiro.';
      END IF;
      INSERT INTO public.plan_members (plan_id, user_id, name, age, is_primary, role, is_active)
      VALUES (v_plan.id, uid, v_partner_name, p_partner_age, false, 'parceiro', true);
    ELSE
      UPDATE public.plan_members
         SET name = COALESCE(v_partner_name, name),
             age = COALESCE(p_partner_age, age),
             is_active = true,
             updated_at = now()
       WHERE id = v_existing_partner.id;
    END IF;
  ELSE
    -- individual: desativa parceiro, preservando histórico.
    IF v_existing_partner.id IS NOT NULL AND v_existing_partner.is_active THEN
      UPDATE public.plan_members
         SET is_active = false, updated_at = now()
       WHERE id = v_existing_partner.id;
    END IF;
  END IF;

  -- Garantia final: modo casal nunca pode ficar com apenas titular ativo.
  IF p_mode = 'casal' THEN
    PERFORM 1 FROM public.plan_members
     WHERE plan_id = v_plan.id AND is_primary = false AND is_active = true LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'upsert_plan_with_members_v2: modo casal requer um parceiro ativo.';
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
$function$;