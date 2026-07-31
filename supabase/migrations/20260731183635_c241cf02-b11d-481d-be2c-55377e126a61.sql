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

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'individual',1000000,0,0,21,252) RETURNING id INTO p_ind;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_ind, u, 'T', true, 'titular', 'active') RETURNING id INTO m_ind;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'casal',1000000,0,0,21,252) RETURNING id INTO p_cas;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_cas, u, 'T', true, 'titular', 'active') RETURNING id INTO m_cas_t;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_cas, u, 'P', false, 'parceiro', 'active') RETURNING id INTO m_cas_p;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  failed := false;
  BEGIN
    UPDATE public.plan_members SET status = 'removed' WHERE id = m_cas_p;
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'L1: casal sem parceiro ativo deveria falhar'; END IF;
  IF (SELECT status FROM public.plan_members WHERE id = m_cas_p) <> 'active' THEN
    RAISE EXCEPTION 'L1: rollback do sub-bloco nao restaurou o parceiro';
  END IF;

  failed := false;
  BEGIN
    INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
    VALUES (p_ind, u, 'P-extra', false, 'parceiro', 'active');
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'L1: individual com parceiro ativo deveria falhar'; END IF;

  failed := false;
  BEGIN
    INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
    VALUES (p_cas, u, 'P2', false, 'parceiro', 'active');
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN unique_violation OR check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'L1: dois parceiros ativos deveriam falhar'; END IF;

  failed := false;
  BEGIN
    INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
    VALUES (p_cas, u, 'T2', true, 'titular', 'active');
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN unique_violation OR check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'L1: dois titulares ativos deveriam falhar'; END IF;

  failed := false;
  BEGIN
    UPDATE public.plan_members SET status = 'removed' WHERE id = m_ind;
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN RAISE EXCEPTION 'L1: zero titulares ativos deveria falhar'; END IF;

  UPDATE public.plan_members SET status = 'removed' WHERE id = m_cas_p;
  UPDATE public.plans SET mode = 'individual' WHERE id = p_cas;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  DELETE FROM public.plan_members WHERE plan_id IN (p_ind, p_cas);
  DELETE FROM public.plans WHERE id IN (p_ind, p_cas);
  DELETE FROM auth.users WHERE id = u;
  RAISE NOTICE 'L1 constraint trigger real: OK';
END $$;

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

  failed := false;
  BEGIN
    UPDATE public.plan_members SET plan_id = pB WHERE id = partnerA;
    SET CONSTRAINTS ALL IMMEDIATE;
  EXCEPTION WHEN check_violation THEN failed := true;
  END;
  SET CONSTRAINTS ALL DEFERRED;
  IF NOT failed THEN
    RAISE EXCEPTION 'L2: movimentacao inconsistente entre planos deveria falhar';
  END IF;
  IF (SELECT plan_id FROM public.plan_members WHERE id = partnerA) <> pA THEN
    RAISE EXCEPTION 'L2: membro nao voltou ao plano original apos rollback';
  END IF;

  UPDATE public.plan_members SET plan_id = pB WHERE id = partnerA;
  UPDATE public.plans SET mode = 'individual' WHERE id = pA;
  UPDATE public.plans SET mode = 'casal' WHERE id = pB;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  IF (SELECT plan_id FROM public.plan_members WHERE id = partnerA) <> pB THEN
    RAISE EXCEPTION 'L2: movimentacao valida nao persistiu';
  END IF;

  DELETE FROM public.plan_members WHERE plan_id IN (pA, pB);
  DELETE FROM public.plans WHERE id IN (pA, pB);
  DELETE FROM auth.users WHERE id = u;
  RAISE NOTICE 'L2 OLD.plan_id/NEW.plan_id: OK';
END $$;

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
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  SELECT goal_amount, assumption_selic, wizard_complete
    INTO v_goal, v_selic, v_wizard
    FROM public.plans WHERE id = p;
  IF v_goal <> 2500000 OR v_selic <> 0.11 OR v_wizard IS NOT TRUE THEN
    RAISE EXCEPTION 'L3: updates permitidos nao persistiram: %,%,%', v_goal, v_selic, v_wizard;
  END IF;

  PERFORM set_config('role','postgres', true);
  DELETE FROM public.plan_members WHERE plan_id = p;
  DELETE FROM public.plans WHERE id = p;
  DELETE FROM auth.users WHERE id = u;
  RAISE NOTICE 'L3 update permitido + trigger: OK';
END $$;

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
  IF visible <> 1 THEN RAISE EXCEPTION 'L4: usuario A nao enxerga o proprio plano'; END IF;
  SELECT count(*) INTO visible FROM public.plans WHERE id = pB;
  IF visible <> 0 THEN RAISE EXCEPTION 'L4: usuario A enxerga plano alheio'; END IF;

  UPDATE public.plans SET goal_amount = 1234567 WHERE id = pA;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'L4: update no proprio plano falhou'; END IF;

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
    RAISE EXCEPTION 'L5: plans.mode nao foi corrigido';
  END IF;
  IF members_after <> members_before THEN
    RAISE EXCEPTION 'L5: normalize alterou os membros';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(j)) <> 4
     OR NOT (j ? 'plan_id' AND j ? 'mode' AND j ? 'primary_active' AND j ? 'partner_active') THEN
    RAISE EXCEPTION 'L5: payload com campos nao autorizados: %', j;
  END IF;
  IF (j->>'plan_id')::uuid <> p THEN RAISE EXCEPTION 'L5: plan_id divergente'; END IF;

  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'P', false,'parceiro','active') RETURNING id INTO partner_id;
  j := public.normalize_plan_mode_v1(p);
  IF j->>'mode' <> 'casal' OR (j->>'partner_active')::int <> 1 THEN
    RAISE EXCEPTION 'L5: esperava casal: %', j;
  END IF;

  UPDATE public.plan_members SET status = 'removed' WHERE id = partner_id;
  j := public.normalize_plan_mode_v1(p);
  IF j->>'mode' <> 'individual' THEN RAISE EXCEPTION 'L5: esperava individual apos remocao'; END IF;
  IF (SELECT status FROM public.plan_members WHERE id = partner_id) <> 'removed' THEN
    RAISE EXCEPTION 'L5: normalize reativou membro removido';
  END IF;

  UPDATE public.plan_members SET status = 'removed'
   WHERE plan_id = p AND is_primary = true;
  blocked := false;
  BEGIN
    PERFORM public.normalize_plan_mode_v1(p);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L5: estado invalido nao retornou inconsistencia'; END IF;
  UPDATE public.plan_members SET status = 'active'
   WHERE plan_id = p AND is_primary = true;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role','authenticated')::text, true);
  blocked := false;
  BEGIN
    PERFORM public.normalize_plan_mode_v1(p);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L5: cross-user nao bloqueado'; END IF;

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  DELETE FROM public.plan_members WHERE plan_id = p;
  DELETE FROM public.plans WHERE id = p;
  DELETE FROM auth.users WHERE id IN (u, u2);
  RAISE NOTICE 'L5 normalize_plan_mode_v1: OK';
END $$;