-- Lote 4.b.1.1-C — Cobertura SQL integral do ciclo de vida de participantes.
--
-- Execução: psql -v ON_ERROR_STOP=1 -f supabase/tests/plan_member_lifecycle.sql
-- Requer papel administrativo (postgres/supabase_admin): os blocos criam
-- usuários de teste em auth.users e alternam para `authenticated` via
-- set_config('role', ...).
--
-- Convenções de todos os blocos:
--  * dados isolados por UUID fixo de teste, nunca dados reais;
--  * cada bloco limpa o que criou e o arquivo inteiro roda em BEGIN ... ROLLBACK;
--  * cada bloco emite RAISE NOTICE com o resultado;
--  * qualquer asserção falha aborta com código diferente de zero.
--
-- Os constraint triggers trg_plans_mode_consistency e
-- trg_members_mode_consistency são DEFERRABLE INITIALLY DEFERRED: os blocos
-- usam SET CONSTRAINTS ALL IMMEDIATE para forçar a validação real e voltam
-- para SET CONSTRAINTS ALL DEFERRED ao final.

BEGIN;

-- =====================================================================
-- L1. Constraint trigger real: estados válidos, inválidos e intermediários
-- =====================================================================
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000c1001';
  p_ind uuid; p_cas uuid;
  m_ind uuid; m_cas_t uuid; m_cas_p uuid;
  failed boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u, 'l1@test.local', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- individual: 1 titular, 0 parceiros => passa no IMMEDIATE
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'individual',1000000,0,0,21,252) RETURNING id INTO p_ind;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_ind, u, 'T', true, 'titular', 'active') RETURNING id INTO m_ind;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  -- casal: 1 titular + 1 parceiro => passa
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'casal',1000000,0,0,21,252) RETURNING id INTO p_cas;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_cas, u, 'T', true, 'titular', 'active') RETURNING id INTO m_cas_t;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_cas, u, 'P', false, 'parceiro', 'active') RETURNING id INTO m_cas_p;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  -- casal sem parceiro ativo => falha no IMMEDIATE
  failed := false;
  BEGIN
    UPDATE public.plan_members SET status = 'removed' WHERE id = m_cas_p;
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'L1: casal sem parceiro ativo deveria falhar'; END IF;
  -- o savepoint interno reverteu o UPDATE: parceiro continua ativo
  IF (SELECT status FROM public.plan_members WHERE id = m_cas_p) <> 'active' THEN
    RAISE EXCEPTION 'L1: rollback do sub-bloco não restaurou o parceiro';
  END IF;

  -- individual com parceiro ativo => falha
  failed := false;
  BEGIN
    INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
    VALUES (p_ind, u, 'P-extra', false, 'parceiro', 'active');
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'L1: individual com parceiro ativo deveria falhar'; END IF;

  -- casal com dois parceiros ativos => bloqueado (índice único ou trigger)
  failed := false;
  BEGIN
    INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
    VALUES (p_cas, u, 'P2', false, 'parceiro', 'active');
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN unique_violation OR check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'L1: dois parceiros ativos deveriam falhar'; END IF;

  -- dois titulares ativos => bloqueado
  failed := false;
  BEGIN
    INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
    VALUES (p_cas, u, 'T2', true, 'titular', 'active');
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN unique_violation OR check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'L1: dois titulares ativos deveriam falhar'; END IF;

  -- zero titulares ativos => falha
  failed := false;
  BEGIN
    UPDATE public.plan_members SET status = 'removed' WHERE id = m_ind;
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'L1: zero titulares ativos deveria falhar'; END IF;

  -- estado intermediário inválido é permitido enquanto DEFERRED e o estado
  -- final válido confirma sem erro.
  UPDATE public.plan_members SET status = 'removed' WHERE id = m_cas_p;   -- casal inválido
  UPDATE public.plans SET mode = 'individual' WHERE id = p_cas;           -- volta a ser válido
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  DELETE FROM public.plan_members WHERE plan_id IN (p_ind, p_cas);
  DELETE FROM public.plans WHERE id IN (p_ind, p_cas);
  DELETE FROM auth.users WHERE id = u;
  RAISE NOTICE 'L1 constraint trigger real: OK';
END $$;

-- =====================================================================
-- L2. OLD.plan_id e NEW.plan_id no constraint trigger
-- =====================================================================
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000c1002';
  pA uuid; pB uuid;
  tA uuid; tB uuid; partnerA uuid;
  failed boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u, 'l2@test.local', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'casal',1000000,0,0,21,252) RETURNING id INTO pA;
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'individual',1000000,0,0,21,252) RETURNING id INTO pB;

  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (pA, u, 'A-T', true, 'titular', 'active') RETURNING id INTO tA;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (pA, u, 'A-P', false, 'parceiro', 'active') RETURNING id INTO partnerA;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (pB, u, 'B-T', true, 'titular', 'active') RETURNING id INTO tB;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  -- Mover o parceiro de A para B quebra os DOIS planos:
  -- A (casal) fica sem parceiro ativo e B (individual) ganha um parceiro ativo.
  failed := false;
  BEGIN
    UPDATE public.plan_members SET plan_id = pB WHERE id = partnerA;
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN
    RAISE EXCEPTION 'L2: movimentação inconsistente entre planos deveria falhar';
  END IF;
  IF (SELECT plan_id FROM public.plan_members WHERE id = partnerA) <> pA THEN
    RAISE EXCEPTION 'L2: membro não voltou ao plano original após rollback';
  END IF;

  -- Movimentação válida: ajustar os dois modos na mesma transação.
  UPDATE public.plan_members SET plan_id = pB WHERE id = partnerA;
  UPDATE public.plans SET mode = 'individual' WHERE id = pA;
  UPDATE public.plans SET mode = 'casal' WHERE id = pB;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  IF (SELECT plan_id FROM public.plan_members WHERE id = partnerA) <> pB THEN
    RAISE EXCEPTION 'L2: movimentação válida não persistiu';
  END IF;

  DELETE FROM public.plan_members WHERE plan_id IN (pA, pB);
  DELETE FROM public.plans WHERE id IN (pA, pB);
  DELETE FROM auth.users WHERE id = u;
  RAISE NOTICE 'L2 OLD.plan_id/NEW.plan_id: OK';
END $$;

-- =====================================================================
-- L3. UPDATE permitido como authenticated dispara o trigger sem negar acesso
-- =====================================================================
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000c1003';
  p uuid;
  v_goal numeric; v_selic numeric; v_wizard boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u, 'l3@test.local', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'individual',1000000,0,0,21,252) RETURNING id INTO p;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'T', true, 'titular', 'active');

  PERFORM set_config('role','authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  UPDATE public.plans SET goal_amount = 2500000 WHERE id = p;
  UPDATE public.plans SET assumption_selic = 0.11 WHERE id = p;
  UPDATE public.plans SET wizard_complete = true WHERE id = p;
  SET CONSTRAINTS ALL IMMEDIATE;   -- executa o constraint trigger SECURITY DEFINER
  SET CONSTRAINTS ALL DEFERRED;

  SELECT goal_amount, assumption_selic, wizard_complete
    INTO v_goal, v_selic, v_wizard
    FROM public.plans WHERE id = p;
  IF v_goal <> 2500000 OR v_selic <> 0.11 OR v_wizard IS NOT TRUE THEN
    RAISE EXCEPTION 'L3: updates permitidos não persistiram: %,%,%', v_goal, v_selic, v_wizard;
  END IF;

  PERFORM set_config('role','postgres', true);
  DELETE FROM public.plan_members WHERE plan_id = p;
  DELETE FROM public.plans WHERE id = p;
  DELETE FROM auth.users WHERE id = u;
  RAISE NOTICE 'L3 update permitido + trigger: OK';
END $$;

-- =====================================================================
-- L4. Isolamento RLS entre usuários
-- =====================================================================
DO $$
DECLARE
  uA uuid := '00000000-0000-0000-0000-0000000c1004';
  uB uuid := '00000000-0000-0000-0000-0000000c1104';
  pA uuid; pB uuid;
  visible integer; affected integer;
  blocked boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (uA,'l4a@test.local','authenticated','authenticated'),
    (uB,'l4b@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (uA,'individual',1000000,0,0,21,252) RETURNING id INTO pA;
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (uB,'individual',1000000,0,0,21,252) RETURNING id INTO pB;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (pA, uA, 'A', true,'titular','active');
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (pB, uB, 'B', true,'titular','active');

  PERFORM set_config('role','authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uA::text, 'role','authenticated')::text, true);

  SELECT count(*) INTO visible FROM public.plans WHERE id = pA;
  IF visible <> 1 THEN RAISE EXCEPTION 'L4: usuário A não enxerga o próprio plano'; END IF;
  SELECT count(*) INTO visible FROM public.plans WHERE id = pB;
  IF visible <> 0 THEN RAISE EXCEPTION 'L4: usuário A enxerga plano alheio'; END IF;

  UPDATE public.plans SET goal_amount = 1234567 WHERE id = pA;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'L4: update no próprio plano falhou'; END IF;

  UPDATE public.plans SET goal_amount = 999 WHERE id = pB;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'L4: update alterou plano alheio'; END IF;

  blocked := false;
  BEGIN
    PERFORM public.add_plan_partner_v1(pB, 'Invasor', 30);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L4: RPC de ciclo de vida operou plano alheio'; END IF;

  PERFORM set_config('role','postgres', true);
  IF (SELECT goal_amount FROM public.plans WHERE id = pB) <> 1000000 THEN
    RAISE EXCEPTION 'L4: plano de B foi alterado';
  END IF;

  DELETE FROM public.plan_members WHERE plan_id IN (pA, pB);
  DELETE FROM public.plans WHERE id IN (pA, pB);
  DELETE FROM auth.users WHERE id IN (uA, uB);
  RAISE NOTICE 'L4 isolamento RLS de plans: OK';
END $$;

-- =====================================================================
-- L5. normalize_plan_mode_v1
-- =====================================================================
DO $$
DECLARE
  u  uuid := '00000000-0000-0000-0000-0000000c1005';
  u2 uuid := '00000000-0000-0000-0000-0000000c1105';
  p uuid; partner_id uuid;
  j jsonb;
  members_before integer; members_after integer;
  blocked boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u,'l5a@test.local','authenticated','authenticated'),
    (u2,'l5b@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'casal',1000000,0,0,21,252) RETURNING id INTO p;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'T', true,'titular','active');

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  SELECT count(*) INTO members_before FROM public.plan_members WHERE plan_id = p;
  j := public.normalize_plan_mode_v1(p);
  SELECT count(*) INTO members_after FROM public.plan_members WHERE plan_id = p;

  IF j->>'mode' <> 'individual' THEN RAISE EXCEPTION 'L5: esperava individual'; END IF;
  IF (j->>'primary_active')::int <> 1 OR (j->>'partner_active')::int <> 0 THEN
    RAISE EXCEPTION 'L5: contagens erradas: %', j;
  END IF;
  IF (SELECT mode FROM public.plans WHERE id = p) <> 'individual' THEN
    RAISE EXCEPTION 'L5: plans.mode não foi corrigido';
  END IF;
  IF members_after <> members_before THEN
    RAISE EXCEPTION 'L5: normalize alterou os membros';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(j)) <> 4
     OR NOT (j ? 'plan_id' AND j ? 'mode' AND j ? 'primary_active' AND j ? 'partner_active') THEN
    RAISE EXCEPTION 'L5: payload com campos não autorizados: %', j;
  END IF;
  IF (j->>'plan_id')::uuid <> p THEN RAISE EXCEPTION 'L5: plan_id divergente'; END IF;

  -- 1 titular + 1 parceiro => casal
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'P', false,'parceiro','active') RETURNING id INTO partner_id;
  j := public.normalize_plan_mode_v1(p);
  IF j->>'mode' <> 'casal' OR (j->>'partner_active')::int <> 1 THEN
    RAISE EXCEPTION 'L5: esperava casal: %', j;
  END IF;

  -- Não reativa membro removido.
  UPDATE public.plan_members SET status = 'removed' WHERE id = partner_id;
  j := public.normalize_plan_mode_v1(p);
  IF j->>'mode' <> 'individual' THEN RAISE EXCEPTION 'L5: esperava individual após remoção'; END IF;
  IF (SELECT status FROM public.plan_members WHERE id = partner_id) <> 'removed' THEN
    RAISE EXCEPTION 'L5: normalize reativou membro removido';
  END IF;

  -- Estado estrutural inválido (0 titulares ativos) => plan_members_inconsistent
  UPDATE public.plan_members SET status = 'removed'
   WHERE plan_id = p AND is_primary = true;
  blocked := false;
  BEGIN
    PERFORM public.normalize_plan_mode_v1(p);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L5: estado inválido não retornou inconsistência'; END IF;
  UPDATE public.plan_members SET status = 'active'
   WHERE plan_id = p AND is_primary = true;

  -- cross-user => plan_not_found
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role','authenticated')::text, true);
  blocked := false;
  BEGIN
    PERFORM public.normalize_plan_mode_v1(p);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L5: cross-user não bloqueado'; END IF;

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  DELETE FROM public.plan_members WHERE plan_id = p;
  DELETE FROM public.plans WHERE id = p;
  DELETE FROM auth.users WHERE id IN (u, u2);
  RAISE NOTICE 'L5 normalize_plan_mode_v1: OK';
END $$;

-- =====================================================================
-- L6. add_plan_partner_v1
-- =====================================================================
DO $$
DECLARE
  u  uuid := '00000000-0000-0000-0000-0000000c1006';
  u2 uuid := '00000000-0000-0000-0000-0000000c1106';
  p uuid; removed_partner uuid; new_partner uuid;
  j jsonb; partner jsonb;
  blocked boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u,'l6a@test.local','authenticated','authenticated'),
    (u2,'l6b@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'individual',1000000,0,0,21,252) RETURNING id INTO p;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'T', true,'titular','active');
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Antigo', false,'parceiro','removed') RETURNING id INTO removed_partner;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  -- Validações de entrada
  FOREACH j IN ARRAY ARRAY['{"n":"","a":30}'::jsonb, '{"n":"   ","a":30}'::jsonb] LOOP
    blocked := false;
    BEGIN
      PERFORM public.add_plan_partner_v1(p, j->>'n', (j->>'a')::int);
    EXCEPTION WHEN check_violation THEN blocked := true; END;
    IF NOT blocked THEN RAISE EXCEPTION 'L6: nome vazio aceito'; END IF;
  END LOOP;

  blocked := false;
  BEGIN PERFORM public.add_plan_partner_v1(p, repeat('x', 121), 30);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L6: nome > 120 aceito'; END IF;

  blocked := false;
  BEGIN PERFORM public.add_plan_partner_v1(p, 'Idade baixa', -1);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L6: idade negativa aceita'; END IF;

  blocked := false;
  BEGIN PERFORM public.add_plan_partner_v1(p, 'Idade alta', 131);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L6: idade > 130 aceita'; END IF;

  -- Sucesso
  j := public.add_plan_partner_v1(p, 'Parceira', 30);
  new_partner := (j->>'partner_id')::uuid;
  IF new_partner = removed_partner THEN
    RAISE EXCEPTION 'L6: reutilizou parceiro removed';
  END IF;
  IF j->>'mode' <> 'casal'
     OR (SELECT mode FROM public.plans WHERE id = p) <> 'casal' THEN
    RAISE EXCEPTION 'L6: mode não virou casal atomicamente';
  END IF;
  IF (SELECT status FROM public.plan_members WHERE id = removed_partner) <> 'removed' THEN
    RAISE EXCEPTION 'L6: parceiro removido foi tocado';
  END IF;

  partner := j->'partner';
  IF partner ? 'cpf_last4' OR partner ? 'identity_status'
     OR partner ? 'linked_auth_user_id' OR partner ? 'user_id' THEN
    RAISE EXCEPTION 'L6: payload expõe campo privado: %', partner;
  END IF;

  -- Segundo parceiro ativo => partner_already_active
  blocked := false;
  BEGIN PERFORM public.add_plan_partner_v1(p, 'Outra', 25);
  EXCEPTION WHEN unique_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L6: segundo parceiro ativo aceito'; END IF;

  -- cross-user
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role','authenticated')::text, true);
  blocked := false;
  BEGIN PERFORM public.add_plan_partner_v1(p, 'Invasor', 30);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L6: cross-user aceito'; END IF;

  -- Estado final passa no constraint trigger real
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  DELETE FROM public.plan_members WHERE plan_id = p;
  DELETE FROM public.plans WHERE id = p;
  DELETE FROM auth.users WHERE id IN (u, u2);
  RAISE NOTICE 'L6 add_plan_partner_v1: OK';
END $$;

-- =====================================================================
-- L7. remove_plan_partner_v1
-- =====================================================================
DO $$
DECLARE
  u  uuid := '00000000-0000-0000-0000-0000000c1007';
  u2 uuid := '00000000-0000-0000-0000-0000000c1107';
  p uuid; titular uuid; parceiro uuid;
  j jsonb; rec record;
  expenses_kept integer;
  blocked boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u,'l7a@test.local','authenticated','authenticated'),
    (u2,'l7b@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'casal',1000000,0,0,21,252) RETURNING id INTO p;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'T', true,'titular','active') RETURNING id INTO titular;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'P', false,'parceiro','active') RETURNING id INTO parceiro;
  INSERT INTO public.expenses (plan_id, user_id, member_id, ownership_scope,
                     category, expense_type, is_essential, amount, is_recurring)
VALUES (p, u, parceiro, 'individual', 'moradia', 'fixed', true, 1500, true);

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  j := public.remove_plan_partner_v1(p);
  IF (j->>'removed_partner_id')::uuid <> parceiro OR j->>'mode' <> 'individual' THEN
    RAISE EXCEPTION 'L7: payload inesperado: %', j;
  END IF;

  SELECT status, is_active, removed_at INTO rec
    FROM public.plan_members WHERE id = parceiro;
  IF rec.status <> 'removed' OR rec.is_active <> false OR rec.removed_at IS NULL THEN
    RAISE EXCEPTION 'L7: flags de remoção incorretas: %', rec;
  END IF;
  IF (SELECT status FROM public.plan_members WHERE id = titular) <> 'active' THEN
    RAISE EXCEPTION 'L7: titular foi afetado';
  END IF;
  IF (SELECT mode FROM public.plans WHERE id = p) <> 'individual' THEN
    RAISE EXCEPTION 'L7: mode não virou individual';
  END IF;

  SELECT count(*) INTO expenses_kept FROM public.expenses
   WHERE plan_id = p AND member_id = parceiro;
  IF expenses_kept <> 1 THEN RAISE EXCEPTION 'L7: histórico financeiro sumiu'; END IF;

  blocked := false;
  BEGIN PERFORM public.remove_plan_partner_v1(p);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L7: remoção sem parceiro ativo passou'; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role','authenticated')::text, true);
  blocked := false;
  BEGIN PERFORM public.remove_plan_partner_v1(p);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L7: cross-user aceito'; END IF;

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  DELETE FROM public.expenses WHERE plan_id = p;
  DELETE FROM public.plan_members WHERE plan_id = p;
  DELETE FROM public.plans WHERE id = p;
  DELETE FROM auth.users WHERE id IN (u, u2);
  RAISE NOTICE 'L7 remove_plan_partner_v1: OK';
END $$;

-- =====================================================================
-- L8. upsert_plan_with_members_v3 — plano novo e plano existente
-- =====================================================================
DO $$
DECLARE
  u  uuid := '00000000-0000-0000-0000-0000000c1008';
  u2 uuid := '00000000-0000-0000-0000-0000000c1108';
  u3 uuid := '00000000-0000-0000-0000-0000000c1208';
  j jsonb; m jsonb;
  p_ind uuid; p_cas uuid;
  titular uuid; parceiro uuid;
  removed_partner uuid; still_removed uuid;
  err text;
  blocked boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u,'l8a@test.local','authenticated','authenticated'),
    (u2,'l8b@test.local','authenticated','authenticated'),
    (u3,'l8c@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- Plano novo individual
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);
  j := public.upsert_plan_with_members_v3('individual', 'Titular A');
  p_ind := (j#>>'{plan,id}')::uuid;
  IF (j->>'is_new_plan')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'L8: is_new_plan deveria ser true';
  END IF;
  IF jsonb_array_length(j->'members') <> 1 THEN
    RAISE EXCEPTION 'L8: individual deveria criar exatamente 1 membro';
  END IF;
  SELECT id INTO titular FROM public.plan_members
   WHERE plan_id = p_ind AND is_primary = true;
  IF (SELECT linked_auth_user_id FROM public.plan_members WHERE id = titular) <> u THEN
    RAISE EXCEPTION 'L8: titular sem linked_auth_user_id';
  END IF;
  FOR m IN SELECT * FROM jsonb_array_elements(j->'members') LOOP
    IF m ? 'cpf_last4' OR m ? 'identity_status' OR m ? 'linked_auth_user_id' THEN
      RAISE EXCEPTION 'L8: retorno expõe campo privado: %', m;
    END IF;
  END LOOP;

  -- Plano novo casal (outro usuário)
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role','authenticated')::text, true);
  j := public.upsert_plan_with_members_v3('casal', 'Titular B', NULL, 40, 'Parceiro B', 38);
  p_cas := (j#>>'{plan,id}')::uuid;
  IF jsonb_array_length(j->'members') <> 2 THEN
    RAISE EXCEPTION 'L8: casal deveria criar 2 membros';
  END IF;
  SELECT id INTO parceiro FROM public.plan_members
   WHERE plan_id = p_cas AND is_primary = false AND status = 'active';
  IF (SELECT linked_auth_user_id FROM public.plan_members WHERE id = parceiro) IS NOT NULL THEN
    RAISE EXCEPTION 'L8: parceiro não deveria ter linked_auth_user_id';
  END IF;

  -- casal sem nome de parceiro em plano novo => partner_name_required.
  -- O usuário existe de verdade: foreign_key_violation NÃO conta como sucesso.
  blocked := false;
  err := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u3::text, 'role','authenticated')::text, true);
    PERFORM public.upsert_plan_with_members_v3('casal', 'Sem parceiro');
  EXCEPTION WHEN check_violation THEN blocked := true; err := SQLERRM;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'L8: casal sem parceiro aceito'; END IF;
  IF err IS NULL OR err NOT ILIKE '%partner_name_required%' THEN
    RAISE EXCEPTION 'L8: erro inesperado para casal sem parceiro: %', err;
  END IF;
  IF (SELECT count(*) FROM public.plans WHERE user_id = u3) <> 0 THEN
    RAISE EXCEPTION 'L8: plano persistido apesar de partner_name_required';
  END IF;
  IF (SELECT count(*) FROM public.plan_members WHERE user_id = u3) <> 0 THEN
    RAISE EXCEPTION 'L8: membro persistido apesar de partner_name_required';
  END IF;

  -- Plano existente: atualiza meta e perfis, sem lifecycle
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);
  j := public.upsert_plan_with_members_v3('individual', 'Titular A2', p_ind, 45,
                                          NULL, NULL, 2000000);
  IF (j->>'is_new_plan')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'L8: is_new_plan deveria ser false';
  END IF;
  IF (SELECT goal_amount FROM public.plans WHERE id = p_ind) <> 2000000 THEN
    RAISE EXCEPTION 'L8: meta não atualizou';
  END IF;
  IF (SELECT name FROM public.plan_members WHERE id = titular) <> 'Titular A2'
     OR (SELECT age FROM public.plan_members WHERE id = titular) <> 45 THEN
    RAISE EXCEPTION 'L8: perfil do titular não atualizou';
  END IF;
  IF (SELECT count(*) FROM public.plan_members WHERE plan_id = p_ind) <> 1 THEN
    RAISE EXCEPTION 'L8: upsert criou ou removeu membro em plano existente';
  END IF;

  -- Troca de modo em plano existente => member_lifecycle_action_required
  blocked := false;
  BEGIN
    PERFORM public.upsert_plan_with_members_v3('casal', 'Titular A2', p_ind, 45, 'X', 30);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L8: troca de modo aceita em plano existente'; END IF;
  IF (SELECT mode FROM public.plans WHERE id = p_ind) <> 'individual'
     OR (SELECT count(*) FROM public.plan_members WHERE plan_id = p_ind) <> 1 THEN
    RAISE EXCEPTION 'L8: falha não fez rollback integral';
  END IF;

  -- v3 nunca reativa parceiro removed em plano existente.
  PERFORM set_config('role','postgres', true);
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_ind, u, 'Ex-parceiro', false, 'parceiro', 'removed')
  RETURNING id INTO removed_partner;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);
  j := public.upsert_plan_with_members_v3('individual', 'Titular A2', p_ind, 45,
                                          NULL, NULL, 2100000);
  SELECT id INTO still_removed FROM public.plan_members
   WHERE plan_id = p_ind AND is_primary = false;
  IF still_removed IS DISTINCT FROM removed_partner THEN
    RAISE EXCEPTION 'L8: member_id do parceiro removed foi substituído';
  END IF;
  IF (SELECT status FROM public.plan_members WHERE id = removed_partner) <> 'removed'
     OR (SELECT is_active FROM public.plan_members WHERE id = removed_partner) <> false THEN
    RAISE EXCEPTION 'L8: v3 reativou parceiro removed';
  END IF;
  IF (SELECT count(*) FROM public.plan_members WHERE plan_id = p_ind) <> 2 THEN
    RAISE EXCEPTION 'L8: v3 criou parceiro novo em plano existente';
  END IF;
  IF (SELECT mode FROM public.plans WHERE id = p_ind) <> 'individual' THEN
    RAISE EXCEPTION 'L8: mode mudou indevidamente';
  END IF;

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  PERFORM set_config('role','postgres', true);
  DELETE FROM public.plan_members WHERE plan_id IN (p_ind, p_cas);
  DELETE FROM public.plans WHERE id IN (p_ind, p_cas);
  DELETE FROM auth.users WHERE id IN (u, u2, u3);
  RAISE NOTICE 'L8 upsert_plan_with_members_v3: OK';
END $$;

-- =====================================================================
-- L9. get_plan_member_removal_impact_v1 — validação, contagens e semântica
-- =====================================================================
DO $$
DECLARE
  u  uuid := '00000000-0000-0000-0000-0000000c1009';
  u2 uuid := '00000000-0000-0000-0000-0000000c1109';
  p uuid; titular uuid; parceiro uuid; pendente uuid; removido uuid;
  mt uuid;
  j jsonb;
  blocked boolean;
  snapshot_before bigint; snapshot_after bigint;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u,'l9a@test.local','authenticated','authenticated'),
    (u2,'l9b@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'casal',1000000,0,0,21,252) RETURNING id INTO p;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'T', true,'titular','active') RETURNING id INTO titular;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'P', false,'parceiro','active') RETURNING id INTO parceiro;

  -- Dados vinculados ao parceiro
  INSERT INTO public.assets (plan_id, user_id, member_id, ownership_scope, asset_type,
  invested_amount, current_amount, net_estimated,
  has_fgc, has_sovereign_guarantee, mark_to_market, is_active)
VALUES (p, u, parceiro, 'individual', 'renda_fixa', 100, 100, 100, true, false, false, true);
  INSERT INTO public.income (plan_id, user_id, member_id, ownership_scope,
                     source, income_type, amount)
VALUES (p, u, parceiro, 'individual', 'Salário', 'salary', 5000);
  INSERT INTO public.expenses (plan_id, user_id, member_id, ownership_scope,
                     category, expense_type, is_essential, amount, is_recurring)
VALUES (p, u, parceiro, 'individual', 'moradia', 'fixed', true, 1500, true),
       (p, u, parceiro, 'individual', 'lazer', 'variable', false, 200, false);
  INSERT INTO public.debts (plan_id, user_id, member_id, ownership_scope,
                    debt_type, total_balance, monthly_payment, interest_rate, effective_cost)
VALUES (p, u, parceiro, 'individual', 'cartao', 1000, 100, 0.1, 0.12);
  INSERT INTO public.monthly_tracking (user_id, plan_id, year, month, month_key)
  VALUES (u, p, 2026, 7, '2026-07') RETURNING id INTO mt;
  INSERT INTO public.monthly_member_tracking (user_id, monthly_tracking_id, plan_member_id)
  VALUES (u, mt, parceiro);
  INSERT INTO public.fgc_guarantee_events
    (user_id, holder_member_id, event_date, gross_credit_amount,
     guaranteed_amount_received, tax_withheld, source_type)
  VALUES (u, parceiro, current_date, 1000, 1000, 0, 'evento');

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  j := public.get_plan_member_removal_impact_v1(p, parceiro);
  IF (j#>>'{linked,assets}')::int <> 1
     OR (j#>>'{linked,income}')::int <> 1
     OR (j#>>'{linked,expenses}')::int <> 2
     OR (j#>>'{linked,recurring_expenses_count}')::int <> 1
     OR (j#>>'{linked,debts}')::int <> 1
     OR (j#>>'{linked,monthly_member_tracking}')::int <> 1
     OR (j#>>'{linked,fgc_events}')::int <> 1 THEN
    RAISE EXCEPTION 'L9: contagens vinculadas incorretas: %', j->'linked';
  END IF;
  -- recurring é subconjunto de expenses e não entra novamente no total
  IF (j#>>'{linked,recurring_expenses_count}')::int > (j#>>'{linked,expenses}')::int THEN
    RAISE EXCEPTION 'L9: recurring maior que expenses';
  END IF;
  IF (j#>>'{linked,total}')::int <> 7 THEN
    RAISE EXCEPTION 'L9: linked.total deveria ser 7 (sem somar recorrentes), got %',
      j#>>'{linked,total}';
  END IF;
  IF j->>'data_coverage' <> 'normalized_and_legacy_clear'
     OR (j->>'legacy_blob_present')::boolean
     OR (j->>'legacy_data_requires_review')::boolean THEN
    RAISE EXCEPTION 'L9: sem legado deveria estar limpo: %', j;
  END IF;
  IF j->>'impact_category' <> 'wealth_and_history' THEN
    RAISE EXCEPTION 'L9: impact_category inesperado: %', j->>'impact_category';
  END IF;
  IF j::text ILIKE '%cpf%' OR j::text ILIKE '%hmac%' THEN
    RAISE EXCEPTION 'L9: payload expõe identidade';
  END IF;

  -- Legado: registros sem member_id, FGC sem holder e blob não vazio
  PERFORM set_config('role','postgres', true);
  INSERT INTO public.income (plan_id, user_id, member_id, ownership_scope,
                     source, income_type, amount)
VALUES (p, u, NULL, 'needs_review', 'Legado', 'other', 100);
  INSERT INTO public.fgc_guarantee_events
    (user_id, holder_member_id, event_date, gross_credit_amount,
     guaranteed_amount_received, tax_withheld, source_type)
  VALUES (u, NULL, current_date, 500, 500, 0, 'evento');
  INSERT INTO public.user_financial_data (user_id, plan_data, app_data)
  VALUES (u, '{"legacy":true}'::jsonb, '{}'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET plan_data = EXCLUDED.plan_data;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  SELECT count(*) INTO snapshot_before FROM public.plan_members WHERE plan_id = p;
  j := public.get_plan_member_removal_impact_v1(p, parceiro);
  SELECT count(*) INTO snapshot_after FROM public.plan_members WHERE plan_id = p;
  IF snapshot_before <> snapshot_after THEN
    RAISE EXCEPTION 'L9: preview alterou dados';
  END IF;
  IF NOT (j->>'legacy_blob_present')::boolean
     OR NOT (j->>'legacy_unassigned_records_present')::boolean
     OR NOT (j->>'legacy_data_requires_review')::boolean
     OR j->>'data_coverage' <> 'normalized_only' THEN
    RAISE EXCEPTION 'L9: legado não detectado: %', j;
  END IF;
  IF (j#>>'{unassigned,income_no_member}')::int <> 1
     OR (j#>>'{unassigned,fgc_events_no_member}')::int <> 1
     OR (j#>>'{unassigned,total}')::int <> 2 THEN
    RAISE EXCEPTION 'L9: unassigned incorreto: %', j->'unassigned';
  END IF;
  IF j::text ILIKE '%legacy":true%' THEN
    RAISE EXCEPTION 'L9: payload devolveu conteúdo do blob';
  END IF;

  -- Blob vazio volta a ser false
  PERFORM set_config('role','postgres', true);
  UPDATE public.user_financial_data
     SET plan_data = '{}'::jsonb, app_data = '{}'::jsonb WHERE user_id = u;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);
  j := public.get_plan_member_removal_impact_v1(p, parceiro);
  IF (j->>'legacy_blob_present')::boolean THEN
    RAISE EXCEPTION 'L9: blob vazio deveria ser false';
  END IF;

  -- Validações negativas
  blocked := false;
  BEGIN PERFORM public.get_plan_member_removal_impact_v1(p, titular);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L9: titular aceito no preview'; END IF;

  PERFORM set_config('role','postgres', true);
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Pendente', false,'parceiro','pending_invitation') RETURNING id INTO pendente;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Removido', false,'parceiro','removed') RETURNING id INTO removido;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  blocked := false;
  BEGIN PERFORM public.get_plan_member_removal_impact_v1(p, pendente);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L9: pending_invitation aceito'; END IF;

  blocked := false;
  BEGIN PERFORM public.get_plan_member_removal_impact_v1(p, removido);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L9: membro removed aceito'; END IF;

  blocked := false;
  BEGIN PERFORM public.get_plan_member_removal_impact_v1(p, gen_random_uuid());
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L9: membro de outro plano aceito'; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role','authenticated')::text, true);
  blocked := false;
  BEGIN PERFORM public.get_plan_member_removal_impact_v1(p, parceiro);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L9: cross-user aceito'; END IF;

  PERFORM set_config('request.jwt.claims', '', true);
  blocked := false;
  BEGIN PERFORM public.get_plan_member_removal_impact_v1(p, parceiro);
  EXCEPTION WHEN insufficient_privilege THEN blocked := true;
            WHEN others THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'L9: chamada sem autenticação aceita'; END IF;

  PERFORM set_config('role','postgres', true);
  DELETE FROM public.monthly_member_tracking WHERE user_id = u;
  DELETE FROM public.monthly_tracking WHERE user_id = u;
  DELETE FROM public.fgc_guarantee_events WHERE user_id = u;
  DELETE FROM public.assets WHERE plan_id = p;
  DELETE FROM public.income WHERE plan_id = p;
  DELETE FROM public.expenses WHERE plan_id = p;
  DELETE FROM public.debts WHERE plan_id = p;
  DELETE FROM public.user_financial_data WHERE user_id = u;
  DELETE FROM public.plan_members WHERE plan_id = p;
  DELETE FROM public.plans WHERE id = p;
  DELETE FROM auth.users WHERE id IN (u, u2);
  RAISE NOTICE 'L9 get_plan_member_removal_impact_v1: OK';
END $$;

-- =====================================================================
-- L10. reintegrate_plan_member_v1
-- =====================================================================
DO $$
DECLARE
  u  uuid := '00000000-0000-0000-0000-0000000c1010';
  u2 uuid := '00000000-0000-0000-0000-0000000c1110';
  p uuid; titular uuid; removido_1 uuid; removido_2 uuid;
  j jsonb;
  expenses_before integer; expenses_after integer;
  hmac_before text; hmac_after text;
  blocked boolean;
  v text;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u,'l10a@test.local','authenticated','authenticated'),
    (u2,'l10b@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'individual',1000000,0,0,21,252) RETURNING id INTO p;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'T', true,'titular','active') RETURNING id INTO titular;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'R1', false,'parceiro','removed') RETURNING id INTO removido_1;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'R2', false,'parceiro','removed') RETURNING id INTO removido_2;
  INSERT INTO public.expenses (plan_id, user_id, member_id, ownership_scope,
                     category, expense_type, is_essential, amount, is_recurring)
VALUES (p, u, titular, 'individual', 'moradia', 'fixed', true, 1000, true);
  SELECT count(*) INTO expenses_before FROM public.expenses WHERE plan_id = p;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  -- titular é rejeitado
  blocked := false;
  BEGIN PERFORM public.reintegrate_plan_member_v1(p, titular);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L10: titular aceito'; END IF;

  -- identity_status pendente => rejeitado
  blocked := false;
  BEGIN PERFORM public.reintegrate_plan_member_v1(p, removido_2);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L10: identidade não verificada aceita'; END IF;

  PERFORM set_config('role','postgres', true);
  UPDATE public.plan_members SET identity_status = 'verified', cpf_last4 = '1234'
   WHERE id = removido_2;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  -- sem linha privada => rejeitado
  blocked := false;
  BEGIN PERFORM public.reintegrate_plan_member_v1(p, removido_2);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L10: sem identidade privada aceito'; END IF;

  -- HMAC malformado é barrado pelo CHECK da própria tabela privada
  PERFORM set_config('role','postgres', true);
  blocked := false;
  BEGIN
    INSERT INTO public.plan_member_private_identity
      (member_id, plan_id, user_id, cpf_hmac, hmac_key_version)
    VALUES (removido_2, p, u, 'nao-hex', '1');
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L10: CHECK de HMAC hexadecimal ausente'; END IF;
  INSERT INTO public.plan_member_private_identity
    (member_id, plan_id, user_id, cpf_hmac, hmac_key_version)
  VALUES (removido_2, p, u, repeat('a', 64), '1');

  -- versões não suportadas
  FOREACH v IN ARRAY ARRAY['', '2', '999'] LOOP
    PERFORM set_config('role','postgres', true);
    UPDATE public.plan_member_private_identity
       SET cpf_hmac = repeat('a', 64), hmac_key_version = v
     WHERE member_id = removido_2;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u::text, 'role','authenticated')::text, true);
    blocked := false;
    BEGIN PERFORM public.reintegrate_plan_member_v1(p, removido_2);
    EXCEPTION WHEN check_violation THEN blocked := true; END;
    IF NOT blocked THEN
      RAISE EXCEPTION 'L10: hmac_key_version % aceita', v;
    END IF;
  END LOOP;

  -- cpf_last4 malformado é barrado pelo CHECK da própria tabela
  PERFORM set_config('role','postgres', true);
  UPDATE public.plan_member_private_identity SET hmac_key_version = '1'
   WHERE member_id = removido_2;
  blocked := false;
  BEGIN
    UPDATE public.plan_members SET cpf_last4 = '12' WHERE id = removido_2;
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L10: CHECK de cpf_last4 ausente'; END IF;

  -- sucesso: member_id explícito, nunca o primeiro removido por acaso
  PERFORM set_config('role','postgres', true);
  UPDATE public.plan_members SET cpf_last4 = '1234' WHERE id = removido_2;

  -- cross-user: B não reintegra membro do plano de A
  SELECT cpf_hmac INTO hmac_before
    FROM public.plan_member_private_identity WHERE member_id = removido_2;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role','authenticated')::text, true);
  blocked := false;
  BEGIN PERFORM public.reintegrate_plan_member_v1(p, removido_2);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L10: cross-user reintegrou membro alheio'; END IF;
  PERFORM set_config('role','postgres', true);
  IF (SELECT status FROM public.plan_members WHERE id = removido_2) <> 'removed' THEN
    RAISE EXCEPTION 'L10: cross-user alterou status do membro';
  END IF;
  IF (SELECT mode FROM public.plans WHERE id = p) <> 'individual' THEN
    RAISE EXCEPTION 'L10: cross-user alterou o mode do plano';
  END IF;
  SELECT cpf_hmac INTO hmac_after
    FROM public.plan_member_private_identity WHERE member_id = removido_2;
  IF hmac_after IS DISTINCT FROM hmac_before THEN
    RAISE EXCEPTION 'L10: cross-user alterou a identidade privada';
  END IF;
  IF (SELECT count(*) FROM public.expenses WHERE plan_id = p) <> expenses_before THEN
    RAISE EXCEPTION 'L10: cross-user alterou dados financeiros';
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);
  j := public.reintegrate_plan_member_v1(p, removido_2);
  IF (SELECT count(*) FROM jsonb_object_keys(j)) <> 3
     OR NOT (j ? 'plan_id' AND j ? 'member_id' AND j ? 'mode') THEN
    RAISE EXCEPTION 'L10: payload fora do contrato: %', j;
  END IF;
  IF (j->>'member_id')::uuid <> removido_2 OR j->>'mode' <> 'casal' THEN
    RAISE EXCEPTION 'L10: reintegrou o membro errado: %', j;
  END IF;
  IF (SELECT status FROM public.plan_members WHERE id = removido_1) <> 'removed' THEN
    RAISE EXCEPTION 'L10: reintegrou o primeiro removido automaticamente';
  END IF;
  IF (SELECT mode FROM public.plans WHERE id = p) <> 'casal' THEN
    RAISE EXCEPTION 'L10: mode não virou casal na mesma transação';
  END IF;
  SELECT count(*) INTO expenses_after FROM public.expenses WHERE plan_id = p;
  IF expenses_after <> expenses_before THEN
    RAISE EXCEPTION 'L10: dados financeiros alterados';
  END IF;

  -- já existe parceiro ativo => bloqueado
  PERFORM set_config('role','postgres', true);
  UPDATE public.plan_members SET identity_status = 'verified', cpf_last4 = '5678'
   WHERE id = removido_1;
  INSERT INTO public.plan_member_private_identity
    (member_id, plan_id, user_id, cpf_hmac, hmac_key_version)
  VALUES (removido_1, p, u, repeat('b', 64), '1');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);
  blocked := false;
  BEGIN PERFORM public.reintegrate_plan_member_v1(p, removido_1);
  EXCEPTION WHEN unique_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L10: segundo parceiro ativo aceito'; END IF;

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  PERFORM set_config('role','postgres', true);
  DELETE FROM public.plan_member_private_identity WHERE plan_id = p;
  DELETE FROM public.expenses WHERE plan_id = p;
  DELETE FROM public.plan_members WHERE plan_id = p;
  DELETE FROM public.plans WHERE id = p;
  DELETE FROM auth.users WHERE id IN (u, u2);
  RAISE NOTICE 'L10 reintegrate_plan_member_v1: OK';
END $$;

-- =====================================================================
-- L11. Rollback real de set_plan_member_identity_v1
--      Trigger temporário falha no UPDATE público feito DEPOIS do upsert
--      da identidade privada. Nada pode sobrar.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.__test_fail_member_identity_update()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.identity_status = 'verified'
     AND NEW.identity_status IS DISTINCT FROM OLD.identity_status THEN
    RAISE EXCEPTION 'simulated_failure_after_private_write'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER __test_fail_member_identity_update
  BEFORE UPDATE ON public.plan_members
  FOR EACH ROW EXECUTE FUNCTION public.__test_fail_member_identity_update();

DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000c1011';
  p uuid; m uuid;
  failed boolean := false;
  private_rows integer;
  cur_last4 text; cur_status text;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u,'l11@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'individual',1000000,0,0,21,252) RETURNING id INTO p;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'T', true,'titular','active') RETURNING id INTO m;

  BEGIN
    PERFORM public.set_plan_member_identity_v1(u, m, repeat('c', 64), '9876', '1');
  EXCEPTION WHEN raise_exception THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'L11: RPC deveria falhar com o trigger temporário'; END IF;

  SELECT count(*) INTO private_rows
    FROM public.plan_member_private_identity WHERE member_id = m;
  IF private_rows <> 0 THEN
    RAISE EXCEPTION 'L11: linha privada permaneceu após falha';
  END IF;

  SELECT cpf_last4, identity_status INTO cur_last4, cur_status
    FROM public.plan_members WHERE id = m;
  IF cur_last4 IS NOT NULL OR cur_status = 'verified' THEN
    RAISE EXCEPTION 'L11: escrita parcial em plan_members: %, %', cur_last4, cur_status;
  END IF;

  DELETE FROM public.plan_members WHERE plan_id = p;
  DELETE FROM public.plans WHERE id = p;
  DELETE FROM auth.users WHERE id = u;
  RAISE NOTICE 'L11 rollback real de set_plan_member_identity_v1: OK';
END $$;

DROP TRIGGER IF EXISTS __test_fail_member_identity_update ON public.plan_members;
DROP FUNCTION IF EXISTS public.__test_fail_member_identity_update();

ROLLBACK;