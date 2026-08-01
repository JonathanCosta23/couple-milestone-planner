-- Passo 4.c.1 — regressão de lifecycle com ownership explícito
-- Execução: psql -v ON_ERROR_STOP=1 -f supabase/tests/plan_member_lifecycle_4c1.sql

BEGIN;

-- C1. Remoção preserva histórico financeiro e ownership.
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000004c2001';
  p uuid;
  titular uuid;
  parceiro uuid;
  expense_id uuid;
  j jsonb;
  blocked boolean := false;
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);

  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u, 'ownership-lifecycle-c1@test.local', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans
    (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u, 'casal', 1000000, 0, 0, 21, 252)
  RETURNING id INTO p;

  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Titular', true, 'titular', 'active')
  RETURNING id INTO titular;

  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Parceiro', false, 'parceiro', 'active')
  RETURNING id INTO parceiro;

  INSERT INTO public.expenses
    (plan_id, member_id, ownership_scope, category, expense_type,
     is_essential, amount, is_recurring)
  VALUES (p, parceiro, 'individual', 'moradia', 'fixed', true, 1500, true)
  RETURNING id INTO expense_id;

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role', 'authenticated')::text, true);

  j := public.remove_plan_partner_v1(p);
  ASSERT (j->>'removed_partner_id')::uuid = parceiro,
    'C1: removeu participante incorreto';
  ASSERT j->>'mode' = 'individual', 'C1: mode deveria ser individual';
  ASSERT (SELECT status FROM public.plan_members WHERE id=parceiro)='removed',
    'C1: parceiro deveria estar removed';
  ASSERT (SELECT is_active FROM public.plan_members WHERE id=parceiro)=false,
    'C1: parceiro deveria estar inativo';
  ASSERT (SELECT mode FROM public.plans WHERE id=p)='individual',
    'C1: plano deveria estar individual';
  ASSERT (SELECT member_id FROM public.expenses WHERE id=expense_id)=parceiro,
    'C1: histórico perdeu member_id';
  ASSERT (SELECT ownership_scope FROM public.expenses WHERE id=expense_id)='individual',
    'C1: histórico perdeu ownership individual';
  ASSERT (SELECT amount FROM public.expenses WHERE id=expense_id)=1500,
    'C1: valor financeiro foi alterado';

  BEGIN
    PERFORM public.remove_plan_partner_v1(p);
  EXCEPTION WHEN no_data_found THEN
    blocked := true;
  END;
  ASSERT blocked, 'C1: segunda remoção deveria falhar';

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  RAISE NOTICE 'C1 lifecycle removal + ownership: OK';
END $$;

-- C2. Preview conta ownership, legado e continua somente leitura.
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000004c2002';
  u2 uuid := '00000000-0000-0000-0000-0000004c2102';
  p uuid;
  titular uuid;
  parceiro uuid;
  mt uuid;
  j jsonb;
  before_rows bigint;
  after_rows bigint;
  blocked boolean := false;
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);

  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u, 'ownership-lifecycle-c2a@test.local', 'authenticated', 'authenticated'),
    (u2, 'ownership-lifecycle-c2b@test.local', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans
    (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u, 'casal', 1000000, 0, 0, 21, 252)
  RETURNING id INTO p;

  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Titular', true, 'titular', 'active')
  RETURNING id INTO titular;
  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Parceiro', false, 'parceiro', 'active')
  RETURNING id INTO parceiro;

  INSERT INTO public.assets
    (plan_id, member_id, ownership_scope, asset_type,
     invested_amount, current_amount, net_estimated,
     has_fgc, has_sovereign_guarantee, mark_to_market, is_active)
  VALUES (p, parceiro, 'individual', 'renda_fixa', 100, 100, 100,
          true, false, false, true);
  INSERT INTO public.income
    (plan_id, member_id, ownership_scope, source, income_type, amount)
  VALUES (p, parceiro, 'individual', 'Salário', 'salary', 5000);
  INSERT INTO public.expenses
    (plan_id, member_id, ownership_scope, category, expense_type,
     is_essential, amount, is_recurring)
  VALUES (p, parceiro, 'individual', 'moradia', 'fixed', true, 1500, true),
         (p, parceiro, 'individual', 'lazer', 'variable', false, 200, false);
  INSERT INTO public.debts
    (plan_id, member_id, ownership_scope, debt_type,
     total_balance, monthly_payment, interest_rate, effective_cost)
  VALUES (p, parceiro, 'individual', 'loan', 1000, 100, 0.01, 0.01);
  INSERT INTO public.monthly_tracking
    (user_id, plan_id, year, month, month_key)
  VALUES (u, p, 2026, 8, '2026-08') RETURNING id INTO mt;
  INSERT INTO public.monthly_member_tracking
    (user_id, monthly_tracking_id, plan_member_id)
  VALUES (u, mt, parceiro);
  INSERT INTO public.fgc_guarantee_events
    (user_id, holder_member_id, event_date, gross_credit_amount,
     guaranteed_amount_received, tax_withheld, source_type)
  VALUES (u, parceiro, current_date, 1000, 1000, 0, 'manual');

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO before_rows FROM public.plan_members WHERE plan_id=p;
  j := public.get_plan_member_removal_impact_v1(p, parceiro);
  SELECT count(*) INTO after_rows FROM public.plan_members WHERE plan_id=p;

  ASSERT before_rows=after_rows, 'C2: preview alterou participantes';
  ASSERT (j#>>'{linked,assets}')::int=1, 'C2: assets incorreto';
  ASSERT (j#>>'{linked,income}')::int=1, 'C2: income incorreto';
  ASSERT (j#>>'{linked,expenses}')::int=2, 'C2: expenses incorreto';
  ASSERT (j#>>'{linked,recurring_expenses_count}')::int=1,
    'C2: recurring incorreto';
  ASSERT (j#>>'{linked,debts}')::int=1, 'C2: debts incorreto';
  ASSERT (j#>>'{linked,monthly_member_tracking}')::int=1,
    'C2: monthly tracking incorreto';
  ASSERT (j#>>'{linked,fgc_events}')::int=1, 'C2: FGC incorreto';
  ASSERT (j#>>'{linked,total}')::int=7,
    'C2: total não pode somar recurring novamente';

  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.income
    (plan_id, member_id, ownership_scope, source, income_type, amount)
  VALUES (p, NULL, 'needs_review', 'Legado', 'other', 10);
  INSERT INTO public.fgc_guarantee_events
    (user_id, holder_member_id, event_date, gross_credit_amount,
     guaranteed_amount_received, tax_withheld, source_type)
  VALUES (u, NULL, current_date, 10, 10, 0, 'manual');
  INSERT INTO public.user_financial_data (user_id, plan_data, app_data)
  VALUES (u, '{"legacy":true}'::jsonb, '{}'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET plan_data=EXCLUDED.plan_data;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role', 'authenticated')::text, true);
  j := public.get_plan_member_removal_impact_v1(p, parceiro);
  ASSERT (j->>'legacy_blob_present')::boolean,
    'C2: blob legado não detectado';
  ASSERT (j->>'legacy_unassigned_records_present')::boolean,
    'C2: unassigned não detectado';
  ASSERT (j->>'legacy_data_requires_review')::boolean,
    'C2: revisão legada deveria ser necessária';
  ASSERT j->>'data_coverage'='normalized_only',
    'C2: cobertura deveria ser normalized_only';
  ASSERT (j#>>'{unassigned,income_no_member}')::int=1,
    'C2: income sem membro incorreto';
  ASSERT (j#>>'{unassigned,fgc_events_no_member}')::int=1,
    'C2: FGC sem holder incorreto';
  ASSERT j::text NOT ILIKE '%legacy":true%'
     AND j::text NOT ILIKE '%cpf%'
     AND j::text NOT ILIKE '%hmac%',
    'C2: preview expôs blob ou identidade';

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.get_plan_member_removal_impact_v1(p, parceiro);
  EXCEPTION WHEN no_data_found THEN
    blocked := true;
  END;
  ASSERT blocked, 'C2: preview cross-user deveria falhar';

  RAISE NOTICE 'C2 lifecycle preview + ownership: OK';
END $$;

-- C3. Reintegração preserva ownership e bloqueia cross-user.
DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000004c2003';
  u2 uuid := '00000000-0000-0000-0000-0000004c2103';
  p uuid;
  titular uuid;
  parceiro uuid;
  expense_id uuid;
  before_amount numeric;
  j jsonb;
  blocked boolean := false;
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);

  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u, 'ownership-lifecycle-c3a@test.local', 'authenticated', 'authenticated'),
    (u2, 'ownership-lifecycle-c3b@test.local', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans
    (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u, 'casal', 1000000, 0, 0, 21, 252)
  RETURNING id INTO p;
  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Titular', true, 'titular', 'active')
  RETURNING id INTO titular;
  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Parceiro', false, 'parceiro', 'active')
  RETURNING id INTO parceiro;

  INSERT INTO public.expenses
    (plan_id, member_id, ownership_scope, category, expense_type,
     is_essential, amount, is_recurring)
  VALUES (p, parceiro, 'individual', 'moradia', 'fixed', true, 999, true)
  RETURNING id INTO expense_id;
  SELECT amount INTO before_amount FROM public.expenses WHERE id=expense_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role', 'authenticated')::text, true);
  PERFORM public.remove_plan_partner_v1(p);

  PERFORM set_config('role', 'postgres', true);
  UPDATE public.plan_members
     SET identity_status='verified', cpf_last4='1234'
   WHERE id=parceiro;
  INSERT INTO public.plan_member_private_identity
    (member_id, plan_id, user_id, cpf_hmac, hmac_key_version)
  VALUES (parceiro, p, u, repeat('a', 64), '1');

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.reintegrate_plan_member_v1(p, parceiro);
  EXCEPTION WHEN no_data_found THEN
    blocked := true;
  END;
  ASSERT blocked, 'C3: cross-user deveria falhar';
  ASSERT (SELECT status FROM public.plan_members WHERE id=parceiro)='removed',
    'C3: cross-user alterou status';
  ASSERT (SELECT mode FROM public.plans WHERE id=p)='individual',
    'C3: cross-user alterou mode';
  ASSERT (SELECT amount FROM public.expenses WHERE id=expense_id)=before_amount,
    'C3: cross-user alterou valor';
  ASSERT (SELECT ownership_scope FROM public.expenses WHERE id=expense_id)='individual',
    'C3: cross-user alterou ownership';

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role', 'authenticated')::text, true);
  j := public.reintegrate_plan_member_v1(p, parceiro);
  ASSERT (j->>'member_id')::uuid=parceiro, 'C3: membro reintegrado incorreto';
  ASSERT j->>'mode'='casal', 'C3: mode deveria ser casal';
  ASSERT (SELECT status FROM public.plan_members WHERE id=parceiro)='active',
    'C3: parceiro deveria estar active';
  ASSERT (SELECT mode FROM public.plans WHERE id=p)='casal',
    'C3: plano deveria estar casal';
  ASSERT (SELECT member_id FROM public.expenses WHERE id=expense_id)=parceiro,
    'C3: reintegração alterou owner histórico';
  ASSERT (SELECT ownership_scope FROM public.expenses WHERE id=expense_id)='individual',
    'C3: reintegração alterou scope histórico';
  ASSERT (SELECT amount FROM public.expenses WHERE id=expense_id)=before_amount,
    'C3: reintegração alterou valor financeiro';

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  RAISE NOTICE 'C3 lifecycle reintegration + ownership: OK';
END $$;

ROLLBACK;
