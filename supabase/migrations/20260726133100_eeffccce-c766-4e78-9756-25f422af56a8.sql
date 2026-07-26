-- =====================================================================
-- Passo 4.a.3 — plan_members read-only para clientes; RPCs de domínio;
-- vínculo automático do titular ao auth.users; upsert v3 sem reativação.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Revogar escritas diretas em plan_members
-- ---------------------------------------------------------------------
-- SELECT permanece habilitado por RLS já existente. Toda escrita passa
-- exclusivamente por RPCs de domínio (add/remove partner, update profile,
-- upsert wizard) ou pela Edge Function member-identity (service_role).
REVOKE INSERT, UPDATE, DELETE ON public.plan_members
  FROM PUBLIC, anon, authenticated;

-- Policies de escrita ficam sem efeito prático sem GRANT, mas removê-las
-- torna a intenção explícita e evita reintrodução acidental de GRANTs.
DROP POLICY IF EXISTS "Users can create own plan_members" ON public.plan_members;
DROP POLICY IF EXISTS "Users can update own plan_members" ON public.plan_members;
DROP POLICY IF EXISTS "Users can delete own plan_members" ON public.plan_members;


-- ---------------------------------------------------------------------
-- 2) Trigger: vincula titular ao auth.users automaticamente
-- ---------------------------------------------------------------------
-- Preenche linked_auth_user_id = user_id quando is_primary=true e o
-- vínculo ainda é null. Parceiros nunca recebem vínculo automático — o
-- fluxo de convite (futuro) definirá o linked_auth_user_id do parceiro.
CREATE OR REPLACE FUNCTION public.link_primary_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_primary = true
     AND NEW.linked_auth_user_id IS NULL
     AND NEW.user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
    NEW.linked_auth_user_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_members_link_primary ON public.plan_members;
CREATE TRIGGER trg_plan_members_link_primary
  BEFORE INSERT OR UPDATE OF is_primary, linked_auth_user_id, user_id
  ON public.plan_members
  FOR EACH ROW EXECUTE FUNCTION public.link_primary_auth_user();

-- Backfill titulares existentes.
UPDATE public.plan_members pm
   SET linked_auth_user_id = pm.user_id
 WHERE pm.is_primary = true
   AND pm.linked_auth_user_id IS NULL
   AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = pm.user_id);


-- ---------------------------------------------------------------------
-- 3) RPC: update_plan_member_profile_v1
-- ---------------------------------------------------------------------
-- Única rota autorizada para o cliente editar dados de um membro.
-- Permite alterar somente: name, age, avatar_color.
-- Bloqueia: status, is_active, removed_at, cpf_last4, identity_status,
-- linked_auth_user_id, is_primary, role, plan_id, user_id.
CREATE OR REPLACE FUNCTION public.update_plan_member_profile_v1(
  p_member_id     uuid,
  p_name          text    DEFAULT NULL,
  p_age           integer DEFAULT NULL,
  p_avatar_color  text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_member public.plan_members%ROWTYPE;
  v_name text := NULLIF(btrim(coalesce(p_name, '')), '');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_member_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_member FROM public.plan_members WHERE id = p_member_id LIMIT 1;
  IF NOT FOUND OR v_member.user_id <> uid THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_member.status <> 'active' THEN
    RAISE EXCEPTION 'member_not_active' USING ERRCODE = 'check_violation';
  END IF;

  -- Validações de conteúdo.
  IF p_name IS NOT NULL AND v_name IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF v_name IS NOT NULL AND length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF p_age IS NOT NULL AND (p_age < 0 OR p_age > 130) THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF p_avatar_color IS NOT NULL
     AND p_avatar_color !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.plan_members
     SET name         = COALESCE(v_name, name),
         age          = COALESCE(p_age, age),
         avatar_color = COALESCE(p_avatar_color, avatar_color),
         updated_at   = now()
   WHERE id = p_member_id
     AND user_id = uid
   RETURNING * INTO v_member;

  RETURN to_jsonb(v_member) - 'cpf_last4' - 'identity_status'
         - 'linked_auth_user_id';
END;
$$;

REVOKE ALL ON FUNCTION public.update_plan_member_profile_v1(uuid, text, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_plan_member_profile_v1(uuid, text, integer, text)
  TO authenticated, service_role;


-- ---------------------------------------------------------------------
-- 4) add_plan_partner_v1 devolve o parceiro completo
-- ---------------------------------------------------------------------
-- Frontend passa a confiar apenas no retorno; nenhum SELECT extra.
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
    'partner',    to_jsonb(v_new)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_plan_partner_v1(uuid, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_plan_partner_v1(uuid, text, integer)
  TO authenticated, service_role;


-- ---------------------------------------------------------------------
-- 5) upsert_plan_with_members_v3 — criação/atualização segura do plano
-- ---------------------------------------------------------------------
-- Diferenças em relação à v2:
--   * Cria parceiro novo apenas se não houver parceiro ATIVO. NUNCA reativa
--     registros com status='removed' (o histórico permanece intacto).
--   * Trigger garante linked_auth_user_id do titular = auth.uid().
--   * Retorna somente membros ativos, alinhados ao contrato do writer.
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
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_mode NOT IN ('individual', 'casal') THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;
  IF v_primary_name IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;

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
    ) RETURNING * INTO v_plan;
  ELSE
    UPDATE public.plans SET
      mode                  = p_mode,
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
  END IF;

  -- Titular: cria (trigger vincula) ou atualiza dados seguros.
  SELECT * INTO v_primary FROM public.plan_members
   WHERE plan_id = v_plan.id AND is_primary = true AND status = 'active'
   ORDER BY created_at ASC LIMIT 1;

  IF v_primary.id IS NULL THEN
    INSERT INTO public.plan_members (plan_id, user_id, name, age, is_primary, role, status)
    VALUES (v_plan.id, uid, v_primary_name, p_primary_age, true, 'titular', 'active')
    RETURNING * INTO v_primary;
  ELSE
    UPDATE public.plan_members
       SET name = v_primary_name,
           age  = COALESCE(p_primary_age, age),
           updated_at = now()
     WHERE id = v_primary.id;
  END IF;

  -- Parceiro: só cria linha nova se não houver ativo. NUNCA reativa
  -- registros com status='removed' — reintegração exige RPC dedicada.
  SELECT * INTO v_active_partner FROM public.plan_members
   WHERE plan_id = v_plan.id AND is_primary = false AND status = 'active'
   ORDER BY created_at ASC LIMIT 1;

  IF p_mode = 'casal' THEN
    IF v_active_partner.id IS NULL THEN
      IF v_partner_name IS NULL THEN
        RAISE EXCEPTION 'partner_name_required' USING ERRCODE = 'check_violation';
      END IF;
      INSERT INTO public.plan_members
        (plan_id, user_id, name, age, is_primary, role, status)
      VALUES
        (v_plan.id, uid, v_partner_name, p_partner_age, false, 'parceiro', 'active');
    ELSIF v_partner_name IS NOT NULL THEN
      UPDATE public.plan_members
         SET name = v_partner_name,
             age  = COALESCE(p_partner_age, age),
             updated_at = now()
       WHERE id = v_active_partner.id;
    END IF;
  ELSE
    IF v_active_partner.id IS NOT NULL THEN
      UPDATE public.plan_members
         SET status = 'removed', updated_at = now()
       WHERE id = v_active_partner.id;
    END IF;
  END IF;

  SELECT jsonb_agg(to_jsonb(pm.*) ORDER BY pm.is_primary DESC, pm.created_at ASC)
    INTO v_members
    FROM public.plan_members pm
   WHERE pm.plan_id = v_plan.id AND pm.status = 'active';

  RETURN jsonb_build_object(
    'plan',    to_jsonb(v_plan),
    'members', COALESCE(v_members, '[]'::jsonb)
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
