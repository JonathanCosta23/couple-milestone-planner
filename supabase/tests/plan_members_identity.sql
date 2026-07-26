-- Testes SQL do Subpasso 4.a.1
-- Executar contra staging: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f ...
-- Cada bloco abre BEGIN ... ROLLBACK para não persistir.

-- 1) authenticated não acessa a tabela privada
BEGIN;
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000c0001';
  p uuid;
  m uuid;
  denied boolean := false;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u,'p@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'individual',1000000,0,0,21,252) RETURNING id INTO p;

  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Titular', true,'titular','active') RETURNING id INTO m;

  PERFORM set_config('role','authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  BEGIN
    PERFORM * FROM public.plan_member_private_identity LIMIT 1;
    RAISE EXCEPTION 'authenticated should NOT SELECT plan_member_private_identity';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'expected denial on private table SELECT';
  END IF;

  denied := false;
  BEGIN
    INSERT INTO public.plan_member_private_identity
      (member_id, plan_id, user_id, cpf_hmac, hmac_key_version)
    VALUES (m, p, u, repeat('a', 64), '1');
    RAISE EXCEPTION 'authenticated should NOT INSERT into private table';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'expected denial on private table INSERT';
  END IF;
END $$;
ROLLBACK;

-- 2) Sincronização status ↔ is_active + bloqueio de reativação legada
BEGIN;
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000c0002';
  p uuid;
  m uuid;
  cur_status text;
  cur_active boolean;
  cur_removed timestamptz;
  blocked boolean := false;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u,'s@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (u,'casal',1000000,0,0,21,252) RETURNING id INTO p;

  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Titular', true,'titular','active');
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Parceiro', false,'parceiro','active') RETURNING id INTO m;

  UPDATE public.plan_members SET is_active = false WHERE id = m;
  SELECT status, is_active, removed_at INTO cur_status, cur_active, cur_removed
    FROM public.plan_members WHERE id = m;
  IF cur_status <> 'removed' OR cur_active <> false OR cur_removed IS NULL THEN
    RAISE EXCEPTION 'sync trigger failed: %,%,%', cur_status, cur_active, cur_removed;
  END IF;

  BEGIN
    UPDATE public.plan_members SET is_active = true WHERE id = m;
  EXCEPTION WHEN check_violation THEN blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'legacy reactivation via is_active should be blocked';
  END IF;

  UPDATE public.plan_members SET status = 'active' WHERE id = m;
  SELECT status, is_active, removed_at INTO cur_status, cur_active, cur_removed
    FROM public.plan_members WHERE id = m;
  IF cur_status <> 'active' OR cur_active <> true OR cur_removed IS NOT NULL THEN
    RAISE EXCEPTION 'explicit reintegration failed: %,%,%', cur_status, cur_active, cur_removed;
  END IF;
END $$;
ROLLBACK;

-- 3) Combinação incorreta member/plan/user rejeitada; membro removed/pending
--    não recebe registros financeiros.
BEGIN;
DO $$
DECLARE
  u1 uuid := '00000000-0000-0000-0000-0000000c0003';
  u2 uuid := '00000000-0000-0000-0000-0000000c0004';
  p1 uuid; p2 uuid;
  m1 uuid; m_removed uuid; m_pending uuid;
  blocked boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u1,'u1@test.local','authenticated','authenticated'),
    (u2,'u2@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u1,'individual',1000000,0,0,21,252) RETURNING id INTO p1;
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u2,'individual',1000000,0,0,21,252) RETURNING id INTO p2;

  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p1, u1, 'A', true,'titular','active') RETURNING id INTO m1;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p1, u1, 'R', false,'parceiro','removed') RETURNING id INTO m_removed;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p2, u2, 'P', false,'parceiro','pending_invitation') RETURNING id INTO m_pending;

  blocked := false;
  BEGIN
    INSERT INTO public.plan_member_private_identity
      (member_id, plan_id, user_id, cpf_hmac, hmac_key_version)
    VALUES (m1, p2, u1, repeat('b', 64), '1');
  EXCEPTION WHEN foreign_key_violation THEN blocked := true; END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'composite FK should reject cross-plan combination';
  END IF;

  blocked := false;
  BEGIN
    INSERT INTO public.assets (plan_id, user_id, member_id, asset_type,
      invested_amount, current_amount, net_estimated,
      has_fgc, has_sovereign_guarantee, mark_to_market, is_active)
    VALUES (p1, u1, m_removed, 'renda_fixa', 100, 100, 100, false, false, false, true);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'assets should reject removed member'; END IF;

  blocked := false;
  BEGIN
    INSERT INTO public.assets (plan_id, user_id, member_id, asset_type,
      invested_amount, current_amount, net_estimated,
      has_fgc, has_sovereign_guarantee, mark_to_market, is_active)
    VALUES (p2, u2, m_pending, 'renda_fixa', 100, 100, 100, false, false, false, true);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'assets should reject pending_invitation member'; END IF;
END $$;
ROLLBACK;

-- 4) Somente um titular ativo e um parceiro ativo por plano
BEGIN;
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000c0005';
  p uuid;
  blocked boolean := false;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u,'z@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u,'casal',1000000,0,0,21,252) RETURNING id INTO p;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'T1', true,'titular','active');
  BEGIN
    INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
    VALUES (p, u, 'T2', true,'titular','active');
  EXCEPTION WHEN unique_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'two active primaries allowed'; END IF;

  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'P1', false,'parceiro','active');
  blocked := false;
  BEGIN
    INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
    VALUES (p, u, 'P2', false,'parceiro','active');
  EXCEPTION WHEN unique_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'two active partners allowed'; END IF;
END $$;
ROLLBACK;

-- 5) linked_auth_user_id inválido é rejeitado pela FK
BEGIN;
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000c0006';
  p uuid;
  blocked boolean := false;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u,'l@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u,'individual',1000000,0,0,21,252) RETURNING id INTO p;
  BEGIN
    INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status, linked_auth_user_id)
    VALUES (p, u, 'X', true,'titular','active', '00000000-0000-0000-0000-0000dead0001');
  EXCEPTION WHEN foreign_key_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'invalid linked_auth_user_id accepted'; END IF;
END $$;
ROLLBACK;
-- =====================================================================
-- Subpasso 4.a.2 — Novos cenários (fgc cross-tenant + RPCs de parceiro
-- + grants privados + atomicidade da identidade + sync completo).
-- =====================================================================

-- 6) fgc_guarantee_events: bloqueio cross-user, member removed/pending,
--    e permitido para holder null / holder próprio ativo.
BEGIN;
DO $$
DECLARE
  uA uuid := '00000000-0000-0000-0000-0000000c0a06';
  uB uuid := '00000000-0000-0000-0000-0000000c0b06';
  pA uuid; pB uuid;
  mA_active uuid; mA_removed uuid; mA_pending uuid; mB_active uuid;
  blocked boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (uA,'fA@test.local','authenticated','authenticated'),
    (uB,'fB@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (uA,'individual',1000000,0,0,21,252) RETURNING id INTO pA;
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (uB,'individual',1000000,0,0,21,252) RETURNING id INTO pB;

  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (pA, uA, 'A-Titular', true,'titular','active') RETURNING id INTO mA_active;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (pA, uA, 'A-Removido', false,'parceiro','removed') RETURNING id INTO mA_removed;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (pA, uA, 'A-Pendente', false,'parceiro','pending_invitation') RETURNING id INTO mA_pending;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (pB, uB, 'B-Titular', true,'titular','active') RETURNING id INTO mB_active;

  -- 6.1 usuário A associando ao membro ativo de B → member_scope_mismatch
  blocked := false;
  BEGIN
    INSERT INTO public.fgc_guarantee_events
      (user_id, holder_member_id, event_date, gross_credit_amount,
       guaranteed_amount_received, tax_withheld, source_type)
    VALUES (uA, mB_active, current_date, 100, 100, 0, 'evento');
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'cross-tenant holder deve ser bloqueado';
  END IF;

  -- 6.2 A associando ao próprio membro ativo → permitido
  INSERT INTO public.fgc_guarantee_events
    (user_id, holder_member_id, event_date, gross_credit_amount,
     guaranteed_amount_received, tax_withheld, source_type)
  VALUES (uA, mA_active, current_date, 100, 100, 0, 'evento');

  -- 6.3 A associando a membro removed → member_not_active
  blocked := false;
  BEGIN
    INSERT INTO public.fgc_guarantee_events
      (user_id, holder_member_id, event_date, gross_credit_amount,
       guaranteed_amount_received, tax_withheld, source_type)
    VALUES (uA, mA_removed, current_date, 100, 100, 0, 'evento');
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'holder removido aceito'; END IF;

  -- 6.4 A com holder pending → bloqueado
  blocked := false;
  BEGIN
    INSERT INTO public.fgc_guarantee_events
      (user_id, holder_member_id, event_date, gross_credit_amount,
       guaranteed_amount_received, tax_withheld, source_type)
    VALUES (uA, mA_pending, current_date, 100, 100, 0, 'evento');
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'holder pending aceito'; END IF;

  -- 6.5 holder null continua permitido
  INSERT INTO public.fgc_guarantee_events
    (user_id, holder_member_id, event_date, gross_credit_amount,
     guaranteed_amount_received, tax_withheld, source_type)
  VALUES (uA, NULL, current_date, 100, 100, 0, 'evento');

  -- 6.6 UPDATE de user_id também é validado
  DECLARE
    ev_id uuid;
  BEGIN
    INSERT INTO public.fgc_guarantee_events
      (user_id, holder_member_id, event_date, gross_credit_amount,
       guaranteed_amount_received, tax_withheld, source_type)
    VALUES (uA, mA_active, current_date, 100, 100, 0, 'evento')
    RETURNING id INTO ev_id;
    blocked := false;
    BEGIN
      UPDATE public.fgc_guarantee_events SET user_id = uB WHERE id = ev_id;
    EXCEPTION WHEN check_violation THEN blocked := true; END;
    IF NOT blocked THEN RAISE EXCEPTION 'UPDATE de user_id sem revalidar'; END IF;
  END;
END $$;
ROLLBACK;


-- 7) add_plan_partner_v1 / remove_plan_partner_v1 — atomicidade e regras
BEGIN;
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000c0a07';
  p uuid;
  primary_id uuid;
  first_partner uuid;
  second_partner uuid;
  removed_ct integer;
  active_ct integer;
  mode text;
  blocked boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u,'partner@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u,'individual',1000000,0,0,21,252) RETURNING id INTO p;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Titular', true,'titular','active') RETURNING id INTO primary_id;

  -- Simula chamada da RPC autenticada como u.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  -- 7.1 sucesso adiciona parceiro e muda mode=casal
  PERFORM public.add_plan_partner_v1(p, 'Parceira', 30);
  SELECT mode INTO mode FROM public.plans WHERE id = p;
  IF mode <> 'casal' THEN RAISE EXCEPTION 'mode nao virou casal: %', mode; END IF;
  SELECT id INTO first_partner FROM public.plan_members
    WHERE plan_id = p AND is_primary = false AND status = 'active' LIMIT 1;

  -- 7.2 tentar adicionar segundo parceiro ativo → partner_already_active
  blocked := false;
  BEGIN
    PERFORM public.add_plan_partner_v1(p, 'Outro', 25);
  EXCEPTION WHEN unique_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'segundo parceiro ativo aceito'; END IF;

  -- 7.3 remover parceiro → status=removed, mode=individual
  PERFORM public.remove_plan_partner_v1(p);
  SELECT mode INTO mode FROM public.plans WHERE id = p;
  IF mode <> 'individual' THEN RAISE EXCEPTION 'mode nao virou individual: %', mode; END IF;

  SELECT count(*) INTO removed_ct FROM public.plan_members
    WHERE plan_id = p AND is_primary = false AND status = 'removed';
  IF removed_ct <> 1 THEN RAISE EXCEPTION 'esperava 1 parceiro removido, got %', removed_ct; END IF;

  -- 7.4 add novo parceiro NÃO reativa o antigo — cria linha nova
  PERFORM public.add_plan_partner_v1(p, 'NovaParceira', 28);
  SELECT id INTO second_partner FROM public.plan_members
    WHERE plan_id = p AND is_primary = false AND status = 'active' LIMIT 1;
  IF second_partner IS NULL THEN RAISE EXCEPTION 'novo parceiro nao criado'; END IF;
  IF second_partner = first_partner THEN RAISE EXCEPTION 'reativou antigo em vez de criar novo'; END IF;

  -- Antigo permanece removed.
  SELECT status INTO mode FROM public.plan_members WHERE id = first_partner;
  IF mode <> 'removed' THEN RAISE EXCEPTION 'antigo saiu de removed: %', mode; END IF;

  -- 7.5 remover em plano sem parceiro ativo → partner_not_active
  PERFORM public.remove_plan_partner_v1(p);
  blocked := false;
  BEGIN
    PERFORM public.remove_plan_partner_v1(p);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'remove sem parceiro ativo passou'; END IF;

  -- 7.6 cross-user: outro usuário não pode operar neste plano
  DECLARE
    u2 uuid := '00000000-0000-0000-0000-0000000c0b07';
  BEGIN
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (u2,'other@test.local','authenticated','authenticated')
    ON CONFLICT (id) DO NOTHING;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text, 'role','authenticated')::text, true);
    blocked := false;
    BEGIN
      PERFORM public.add_plan_partner_v1(p, 'X', 20);
    EXCEPTION WHEN no_data_found THEN blocked := true; END;
    IF NOT blocked THEN RAISE EXCEPTION 'outro usuario adicionou parceiro em plano alheio'; END IF;
  END;
END $$;
ROLLBACK;


-- 8) Grants da tabela privada: authenticated não faz nada + RPC identidade
--    não é executável por authenticated.
BEGIN;
DO $$
DECLARE
  denied boolean;
BEGIN
  PERFORM set_config('role','authenticated', true);

  denied := false;
  BEGIN
    PERFORM * FROM public.plan_member_private_identity LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'SELECT privado permitido'; END IF;

  denied := false;
  BEGIN
    UPDATE public.plan_member_private_identity SET cpf_hmac = repeat('0',64)
     WHERE member_id = '00000000-0000-0000-0000-000000000000';
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'UPDATE privado permitido'; END IF;

  denied := false;
  BEGIN
    DELETE FROM public.plan_member_private_identity
      WHERE member_id = '00000000-0000-0000-0000-000000000000';
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'DELETE privado permitido'; END IF;

  denied := false;
  BEGIN
    PERFORM public.set_plan_member_identity_v1(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000000',
      repeat('a', 64), '9999', '1'
    );
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'RPC identidade executavel por authenticated'; END IF;
END $$;
ROLLBACK;


-- 9) Sincronização status ↔ is_active — cobertura completa
BEGIN;
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000c0a09';
  p uuid;
  m_active uuid; m_removed uuid; m_pending uuid;
  cur_active boolean; cur_removed timestamptz; cur_status text;
  blocked boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u,'sync@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u,'casal',1000000,0,0,21,252) RETURNING id INTO p;

  -- INSERT active → is_active=true, removed_at=null
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'T', true,'titular','active') RETURNING id INTO m_active;
  SELECT is_active, removed_at INTO cur_active, cur_removed FROM public.plan_members WHERE id = m_active;
  IF cur_active <> true OR cur_removed IS NOT NULL THEN
    RAISE EXCEPTION 'INSERT active: flags inconsistentes';
  END IF;

  -- INSERT removed → is_active=false, removed_at set
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'R', false,'parceiro','removed') RETURNING id INTO m_removed;
  SELECT is_active, removed_at INTO cur_active, cur_removed FROM public.plan_members WHERE id = m_removed;
  IF cur_active <> false OR cur_removed IS NULL THEN
    RAISE EXCEPTION 'INSERT removed: flags inconsistentes';
  END IF;

  -- INSERT pending → is_active=false, removed_at=null
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'P', false,'parceiro','pending_invitation') RETURNING id INTO m_pending;
  SELECT is_active, removed_at INTO cur_active, cur_removed FROM public.plan_members WHERE id = m_pending;
  IF cur_active <> false OR cur_removed IS NOT NULL THEN
    RAISE EXCEPTION 'INSERT pending: flags inconsistentes';
  END IF;

  -- UPDATE is_active true→false vira removed
  DELETE FROM public.plan_members WHERE id = m_pending;
  UPDATE public.plan_members SET is_active = false WHERE id = m_active;
  SELECT status, removed_at INTO cur_status, cur_removed FROM public.plan_members WHERE id = m_active;
  IF cur_status <> 'removed' OR cur_removed IS NULL THEN
    RAISE EXCEPTION 'is_active false nao virou removed';
  END IF;

  -- UPDATE is_active false→true bloqueado (explicit_reintegration_required)
  blocked := false;
  BEGIN
    UPDATE public.plan_members SET is_active = true WHERE id = m_active;
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'reativacao via is_active permitida'; END IF;

  -- UPDATE status removed→active reintegra explicitamente
  UPDATE public.plan_members SET status = 'active' WHERE id = m_active;
  SELECT is_active, removed_at INTO cur_active, cur_removed FROM public.plan_members WHERE id = m_active;
  IF cur_active <> true OR cur_removed IS NOT NULL THEN
    RAISE EXCEPTION 'reintegracao explicita nao restaurou flags';
  END IF;

  -- Constraint impede combinações impossíveis ainda que trigger seja
  -- burlado num contexto administrativo hipotético.
  blocked := false;
  BEGIN
    ALTER TABLE public.plan_members DISABLE TRIGGER trg_plan_members_sync_status;
    BEGIN
      UPDATE public.plan_members
         SET status = 'removed', is_active = true, removed_at = NULL
       WHERE id = m_active;
    EXCEPTION WHEN check_violation THEN blocked := true; END;
    ALTER TABLE public.plan_members ENABLE TRIGGER trg_plan_members_sync_status;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'constraint permitiu removed+active'; END IF;
END $$;
ROLLBACK;


-- 10) Atomicidade de set_plan_member_identity_v1: rollback em duplicidade
BEGIN;
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000000c0a10';
  p uuid;
  m1 uuid; m2 uuid;
  hmac_val text := repeat('a', 64);
  before_priv integer; after_priv integer;
  blocked boolean;
  ret jsonb;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u,'idem@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u,'casal',1000000,0,0,21,252) RETURNING id INTO p;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'T', true,'titular','active') RETURNING id INTO m1;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'P', false,'parceiro','active') RETURNING id INTO m2;

  -- 10.1 sucesso grava
  ret := public.set_plan_member_identity_v1(u, m1, hmac_val, '1111', '1');
  IF NOT (ret ? 'member_id' AND ret ? 'cpf_last4' AND ret ? 'identity_status') THEN
    RAISE EXCEPTION 'retorno sem chaves esperadas';
  END IF;
  IF ret ? 'cpf_hmac' OR ret ? 'user_id' OR ret ? 'plan_id' THEN
    RAISE EXCEPTION 'retorno vazou campo privado: %', ret;
  END IF;

  -- 10.2 mesmo HMAC em outro membro DO MESMO PLANO → rollback
  SELECT count(*) INTO before_priv FROM public.plan_member_private_identity;
  blocked := false;
  BEGIN
    PERFORM public.set_plan_member_identity_v1(u, m2, hmac_val, '2222', '1');
  EXCEPTION WHEN unique_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'duplicidade no mesmo plano aceita'; END IF;
  SELECT count(*) INTO after_priv FROM public.plan_member_private_identity;
  IF after_priv <> before_priv THEN
    RAISE EXCEPTION 'rollback nao ocorreu (privadas: % -> %)', before_priv, after_priv;
  END IF;

  -- 10.3 membro removed rejeitado
  UPDATE public.plan_members SET status='removed' WHERE id = m2;
  blocked := false;
  BEGIN
    PERFORM public.set_plan_member_identity_v1(u, m2, repeat('b', 64), '3333', '1');
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'identidade em membro removed aceita'; END IF;

  -- 10.4 membro pending rejeitado
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'X', false,'parceiro','pending_invitation') RETURNING id INTO m2;
  blocked := false;
  BEGIN
    PERFORM public.set_plan_member_identity_v1(u, m2, repeat('c', 64), '4444', '1');
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'identidade em membro pending aceita'; END IF;

  -- 10.5 mesmo HMAC em plano diferente é permitido
  DECLARE
    u2 uuid := '00000000-0000-0000-0000-0000000c0b10';
    p2 uuid;
    m3 uuid;
  BEGIN
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (u2,'idem2@test.local','authenticated','authenticated')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
    VALUES (u2,'individual',1000000,0,0,21,252) RETURNING id INTO p2;
    INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
    VALUES (p2, u2, 'T2', true,'titular','active') RETURNING id INTO m3;
    -- Mesmo HMAC do m1 (plano diferente): permitido.
    PERFORM public.set_plan_member_identity_v1(u2, m3, hmac_val, '5555', '1');
  END;

  -- 10.6 membro de outro usuário rejeitado
  blocked := false;
  BEGIN
    PERFORM public.set_plan_member_identity_v1(u, m1, repeat('d', 64), '6666', '1');
    -- ainda mesmo user, ok. Agora tenta com wrong user:
    PERFORM public.set_plan_member_identity_v1(
      '00000000-0000-0000-0000-000000000000', m1, repeat('e', 64), '7777', '1'
    );
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'RPC aceitou member de outro usuario'; END IF;
END $$;
ROLLBACK;
