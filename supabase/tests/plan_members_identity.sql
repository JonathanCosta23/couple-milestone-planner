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