-- Passo 4.c.1 — preview de remoção com ownership explícito
-- Execução: psql -v ON_ERROR_STOP=1 -f supabase/tests/plan_member_preview_4c1.sql

BEGIN;

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
    (u, 'ownership-preview-a@test.local', 'authenticated', 'authenticated'),
    (u2, 'ownership-preview-b@test.local', 'authenticated', 'authenticated')
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

  ASSERT before_rows=after_rows, 'preview alterou participantes';
  ASSERT (j#>>'{linked,assets}')::int=1, 'assets incorreto';
  ASSERT (j#>>'{linked,income}')::int=1, 'income incorreto';
  ASSERT (j#>>'{linked,expenses}')::int=2, 'expenses incorreto';
  ASSERT (j#>>'{linked,recurring_expenses_count}')::int=1,
    'recurring incorreto';
  ASSERT (j#>>'{linked,debts}')::int=1, 'debts incorreto';
  ASSERT (j#>>'{linked,monthly_member_tracking}')::int=1,
    'monthly tracking incorreto';
  ASSERT (j#>>'{linked,fgc_events}')::int=1, 'FGC incorreto';
  ASSERT (j#>>'{linked,total}')::int=7,
    'total não pode somar recurring novamente';

  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
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
    'blob legado não detectado';
  ASSERT (j->>'legacy_unassigned_records_present')::boolean,
    'unassigned não detectado';
  ASSERT (j->>'legacy_data_requires_review')::boolean,
    'revisão legada deveria ser necessária';
  ASSERT j->>'data_coverage'='normalized_only',
    'cobertura deveria ser normalized_only';
  ASSERT (j#>>'{unassigned,income_no_member}')::int=1,
    'income sem membro incorreto';
  ASSERT (j#>>'{unassigned,fgc_events_no_member}')::int=1,
    'FGC sem holder incorreto';
  ASSERT j::text NOT ILIKE '%legacy":true%'
     AND j::text NOT ILIKE '%cpf%'
     AND j::text NOT ILIKE '%hmac%',
    'preview expôs blob ou identidade';

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.get_plan_member_removal_impact_v1(p, parceiro);
  EXCEPTION WHEN no_data_found THEN
    blocked := true;
  END;
  ASSERT blocked, 'preview cross-user deveria falhar';

  RAISE NOTICE 'plan member preview 4.c.1: OK';
END $$;

ROLLBACK;
