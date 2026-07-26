
-- =====================================================================
-- Subpasso 4.a.2 — Isolamento cross-tenant, atomicidade temporária,
-- e cobertura completa (parceiro / titular / holder FGC).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) fgc_guarantee_events: validar existência, ownership e status ativo
-- ---------------------------------------------------------------------
-- Substitui o trigger anterior que só checava status ativo.
-- Agora bloqueia associação a membro de outro usuário com código fechado
-- `member_scope_mismatch` (nunca vaza nome, CPF ou UUID de outra conta).
CREATE OR REPLACE FUNCTION public.block_writes_to_removed_holder_fge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_member_user uuid;
  v_status text;
BEGIN
  IF NEW.holder_member_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT user_id, status
    INTO v_member_user, v_status
    FROM public.plan_members
   WHERE id = NEW.holder_member_id
   LIMIT 1;
  -- Membro inexistente ou pertence a outro usuário: código único fechado.
  IF v_member_user IS NULL OR v_member_user <> NEW.user_id THEN
    RAISE EXCEPTION 'member_scope_mismatch'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'member_not_active'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Reage também quando user_id do evento muda, além de holder_member_id.
DROP TRIGGER IF EXISTS trg_fge_block_removed ON public.fgc_guarantee_events;
CREATE TRIGGER trg_fge_block_removed
  BEFORE INSERT OR UPDATE OF holder_member_id, user_id
  ON public.fgc_guarantee_events
  FOR EACH ROW EXECUTE FUNCTION public.block_writes_to_removed_holder_fge();


-- ---------------------------------------------------------------------
-- 2) RPC transacional: add_plan_partner_v1
-- ---------------------------------------------------------------------
-- Regras:
--  * Deriva usuário de auth.uid() (nunca aceita user_id do cliente).
--  * Valida ownership do plano.
--  * Falha se já existir parceiro ativo neste plano.
--  * NUNCA reativa parceiro removed: cria membro novo.
--  * Atualiza plans.mode='casal' na mesma transação.
--  * Qualquer erro faz rollback completo (nada de estado parcial).
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
  v_new_id uuid;
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

  -- Já existe parceiro ativo? Rejeita — reintegração vem em RPC futura.
  IF EXISTS (
    SELECT 1 FROM public.plan_members
     WHERE plan_id = p_plan_id
       AND is_primary = false
       AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'partner_already_active' USING ERRCODE = 'unique_violation';
  END IF;

  -- Cria SEMPRE um membro novo. Registros anteriores com status='removed'
  -- permanecem removed, preservando histórico.
  INSERT INTO public.plan_members
    (plan_id, user_id, name, age, is_primary, role, status)
  VALUES
    (p_plan_id, uid, v_name, p_age, false, 'parceiro', 'active')
  RETURNING id INTO v_new_id;

  UPDATE public.plans
     SET mode = 'casal', updated_at = now()
   WHERE id = p_plan_id AND user_id = uid;

  RETURN jsonb_build_object(
    'plan_id', p_plan_id,
    'partner_id', v_new_id,
    'mode', 'casal'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_plan_partner_v1(uuid, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_plan_partner_v1(uuid, text, integer)
  TO authenticated, service_role;


-- ---------------------------------------------------------------------
-- 3) RPC transacional: remove_plan_partner_v1
-- ---------------------------------------------------------------------
-- Regras:
--  * Deriva usuário de auth.uid().
--  * Valida ownership do plano.
--  * Só remove parceiro atualmente ATIVO.
--  * Nunca remove o primary.
--  * status='removed' aciona trigger que sincroniza is_active/removed_at.
--  * Muda plans.mode para 'individual' na mesma transação.
--  * Dados históricos preservados: não apaga nem transfere neste passo.
CREATE OR REPLACE FUNCTION public.remove_plan_partner_v1(
  p_plan_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_plan_user uuid;
  v_partner record;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = 'check_violation';
  END IF;

  SELECT user_id INTO v_plan_user
    FROM public.plans WHERE id = p_plan_id LIMIT 1;
  IF v_plan_user IS NULL OR v_plan_user <> uid THEN
    RAISE EXCEPTION 'plan_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT id, is_primary, status
    INTO v_partner
    FROM public.plan_members
   WHERE plan_id = p_plan_id
     AND is_primary = false
     AND status = 'active'
   ORDER BY created_at ASC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partner_not_active' USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.plan_members
     SET status = 'removed', updated_at = now()
   WHERE id = v_partner.id;

  UPDATE public.plans
     SET mode = 'individual', updated_at = now()
   WHERE id = p_plan_id AND user_id = uid;

  RETURN jsonb_build_object(
    'plan_id', p_plan_id,
    'removed_partner_id', v_partner.id,
    'mode', 'individual'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_plan_partner_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_plan_partner_v1(uuid)
  TO authenticated, service_role;
