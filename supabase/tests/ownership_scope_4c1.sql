-- Passo 4.c.1 — ownership financeiro canônico
-- Execução:
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/ownership_scope_4c1.sql
-- Requer papel administrativo para criar usuários isolados em auth.users.

BEGIN;

DO $$
DECLARE
  u_a uuid := '00000000-0000-0000-0000-0000004c1001';
  u_b uuid := '00000000-0000-0000-0000-0000004c1002';
  p_ind uuid; p_couple uuid; p_hist uuid; p_b uuid;
  m_ind uuid; m_couple_primary uuid; m_partner uuid;
  m_hist_primary uuid; m_hist_partner uuid; m_b uuid;
  hist_expense uuid;
  inserted_income uuid;
  j jsonb;
  blocked boolean;
  before_amount numeric;
  after_amount numeric;
  total_rows bigint;
  shared_rows bigint;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u_a, 'ownership-a@test.local', 'authenticated', 'authenticated'),
    (u_b, 'ownership-b@test.local', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans
    (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u_a, 'individual', 1000000, 0, 0, 21, 252)
  RETURNING id INTO p_ind;
  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_ind, u_a, 'Titular A', true, 'titular', 'active')
  RETURNING id INTO m_ind;

  INSERT INTO public.plans
    (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u_a, 'casal', 1000000, 0, 0, 21, 252)
  RETURNING id INTO p_couple;
  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_couple, u_a, 'Titular casal', true, 'titular', 'active')
  RETURNING id INTO m_couple_primary;
  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_couple, u_a, 'Parceiro casal', false, 'parceiro', 'active')
  RETURNING id INTO m_partner;

  INSERT INTO public.plans
    (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u_a, 'casal', 1000000, 0, 0, 21, 252)
  RETURNING id INTO p_hist;
  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_hist, u_a, 'Titular histórico', true, 'titular', 'active')
  RETURNING id INTO m_hist_primary;
  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_hist, u_a, 'Ex-parceiro', false, 'parceiro', 'active')
  RETURNING id INTO m_hist_partner;

  INSERT INTO public.plans
    (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u_b, 'individual', 1000000, 0, 0, 21, 252)
  RETURNING id INTO p_b;
  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p_b, u_b, 'Titular B', true, 'titular', 'active')
  RETURNING id INTO m_b;

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  -- O backfill aplicado precisa deixar todos os registros classificados e
  -- nenhum shared criado automaticamente nesta fase.
  SELECT
    (SELECT count(*) FROM public.assets) +
    (SELECT count(*) FROM public.income) +
    (SELECT count(*) FROM public.expenses) +
    (SELECT count(*) FROM public.debts),
    (SELECT count(*) FROM public.assets WHERE ownership_scope='shared') +
    (SELECT count(*) FROM public.income WHERE ownership_scope='shared') +
    (SELECT count(*) FROM public.expenses WHERE ownership_scope='shared') +
    (SELECT count(*) FROM public.debts WHERE ownership_scope='shared')
  INTO total_rows, shared_rows;
  ASSERT shared_rows = 0, '4.c.1 não deve criar ownership shared';
  ASSERT NOT EXISTS (SELECT 1 FROM public.assets WHERE ownership_scope IS NULL),
    'assets sem ownership_scope';
  ASSERT NOT EXISTS (SELECT 1 FROM public.income WHERE ownership_scope IS NULL),
    'income sem ownership_scope';
  ASSERT NOT EXISTS (SELECT 1 FROM public.expenses WHERE ownership_scope IS NULL),
    'expenses sem ownership_scope';
  ASSERT NOT EXISTS (SELECT 1 FROM public.debts WHERE ownership_scope IS NULL),
    'debts sem ownership_scope';

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);

  -- Create normal: user_id omitido e derivado do plano.
  INSERT INTO public.income
    (plan_id, member_id, ownership_scope, source, income_type, amount)
  VALUES (p_ind, m_ind, 'individual', 'Salário', 'salary', 5000)
  RETURNING id INTO inserted_income;
  ASSERT (SELECT user_id FROM public.income WHERE id=inserted_income) = u_a,
    'trigger deve derivar user_id do plano';

  INSERT INTO public.assets
    (plan_id, member_id, ownership_scope, asset_type,
     invested_amount, current_amount, net_estimated,
     has_fgc, has_sovereign_guarantee, mark_to_market, is_active)
  VALUES (p_ind, m_ind, 'individual', 'renda_fixa', 100, 100, 100,
          false, false, false, true);
  INSERT INTO public.expenses
    (plan_id, member_id, ownership_scope, category, expense_type,
     is_essential, amount, is_recurring)
  VALUES (p_ind, m_ind, 'individual', 'moradia', 'fixed', true, 100, true);
  INSERT INTO public.debts
    (plan_id, member_id, ownership_scope, debt_type,
     total_balance, monthly_payment, interest_rate, effective_cost)
  VALUES (p_ind, m_ind, 'individual', 'loan', 1000, 100, 0.01, 0.01);

  -- user_id forjado é ignorado, nunca confiado.
  INSERT INTO public.income
    (plan_id, user_id, member_id, ownership_scope, source, income_type, amount)
  VALUES (p_ind, u_b, m_ind, 'individual', 'Extra', 'other', 10)
  RETURNING id INTO inserted_income;
  ASSERT (SELECT user_id FROM public.income WHERE id=inserted_income) = u_a,
    'user_id forjado não foi substituído';

  -- Scope ausente falha, sem fallback.
  blocked := false;
  BEGIN
    INSERT INTO public.income (plan_id, member_id, source, income_type, amount)
    VALUES (p_ind, m_ind, 'Sem scope', 'other', 1);
  EXCEPTION WHEN not_null_violation OR check_violation THEN blocked := true;
  END;
  ASSERT blocked, 'create sem ownership_scope deveria falhar';

  -- Combinações canônicas inválidas.
  blocked := false;
  BEGIN
    INSERT INTO public.expenses
      (plan_id, member_id, ownership_scope, category, expense_type,
       is_essential, amount, is_recurring)
    VALUES (p_ind, NULL, 'individual', 'outros', 'variable', false, 1, false);
  EXCEPTION WHEN not_null_violation OR check_violation THEN blocked := true;
  END;
  ASSERT blocked, 'individual sem member_id deveria falhar';

  blocked := false;
  BEGIN
    INSERT INTO public.expenses
      (plan_id, member_id, ownership_scope, category, expense_type,
       is_essential, amount, is_recurring)
    VALUES (p_ind, m_ind, 'shared', 'outros', 'variable', false, 1, false);
  EXCEPTION WHEN check_violation THEN blocked := true;
  END;
  ASSERT blocked, 'shared com member_id deveria falhar';

  blocked := false;
  BEGIN
    INSERT INTO public.expenses
      (plan_id, member_id, ownership_scope, category, expense_type,
       is_essential, amount, is_recurring)
    VALUES (p_ind, m_ind, 'needs_review', 'outros', 'variable', false, 1, false);
  EXCEPTION WHEN check_violation THEN blocked := true;
  END;
  ASSERT blocked, 'needs_review com member_id deveria falhar';

  -- Cross-plan e cross-user.
  blocked := false;
  BEGIN
    INSERT INTO public.income
      (plan_id, member_id, ownership_scope, source, income_type, amount)
    VALUES (p_ind, m_partner, 'individual', 'Cross plan', 'other', 1);
  EXCEPTION WHEN check_violation THEN blocked := true;
  END;
  ASSERT blocked, 'member_id de outro plano deveria falhar';

  blocked := false;
  BEGIN
    INSERT INTO public.income
      (plan_id, member_id, ownership_scope, source, income_type, amount)
    VALUES (p_b, m_b, 'individual', 'Cross user', 'other', 1);
  EXCEPTION WHEN no_data_found OR check_violation THEN blocked := true;
  END;
  ASSERT blocked, 'usuário A não pode gravar no plano de B';

  -- Histórico de membro removido permanece individual e editável em campos
  -- financeiros comuns, mas não recebe novas movimentações.
  INSERT INTO public.expenses
    (plan_id, member_id, ownership_scope, category, expense_type,
     is_essential, amount, is_recurring)
  VALUES (p_hist, m_hist_partner, 'individual', 'moradia', 'fixed', true, 777, true)
  RETURNING id INTO hist_expense;
  SELECT amount INTO before_amount FROM public.expenses WHERE id=hist_expense;

  PERFORM public.remove_plan_partner_v1(p_hist);
  ASSERT (SELECT status FROM public.plan_members WHERE id=m_hist_partner)='removed',
    'parceiro histórico deveria estar removed';
  ASSERT (SELECT ownership_scope FROM public.expenses WHERE id=hist_expense)='individual',
    'ownership histórico foi perdido';

  UPDATE public.expenses SET amount=778 WHERE id=hist_expense;
  SELECT amount INTO after_amount FROM public.expenses WHERE id=hist_expense;
  ASSERT before_amount=777 AND after_amount=778,
    'update financeiro comum de histórico deveria preservar owner';
  ASSERT (SELECT member_id FROM public.expenses WHERE id=hist_expense)=m_hist_partner,
    'update comum alterou member_id histórico';

  blocked := false;
  BEGIN
    INSERT INTO public.income
      (plan_id, member_id, ownership_scope, source, income_type, amount)
    VALUES (p_hist, m_hist_partner, 'individual', 'Nova após remoção', 'other', 1);
  EXCEPTION WHEN check_violation THEN blocked := true;
  END;
  ASSERT blocked, 'novo write para membro removed deveria falhar';

  -- Itens ambíguos controlados para o resumo de revisão.
  INSERT INTO public.assets
    (plan_id, member_id, ownership_scope, asset_type,
     invested_amount, current_amount, net_estimated,
     has_fgc, has_sovereign_guarantee, mark_to_market, is_active)
  VALUES (p_couple, NULL, 'needs_review', 'renda_fixa', 12, 12, 12,
          false, false, false, true);
  INSERT INTO public.income
    (plan_id, member_id, ownership_scope, source, income_type, amount)
  VALUES (p_couple, NULL, 'needs_review', 'Ambígua', 'other', 12);
  INSERT INTO public.expenses
    (plan_id, member_id, ownership_scope, category, expense_type,
     is_essential, amount, is_recurring)
  VALUES (p_couple, NULL, 'needs_review', 'outros', 'variable', false, 12, false);
  INSERT INTO public.debts
    (plan_id, member_id, ownership_scope, debt_type,
     total_balance, monthly_payment, interest_rate, effective_cost)
  VALUES (p_couple, NULL, 'needs_review', 'loan', 12, 1, 0, 0);

  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.fgc_guarantee_events
    (user_id, holder_member_id, event_date, gross_credit_amount,
     guaranteed_amount_received, tax_withheld, source_type)
  VALUES (u_a, NULL, current_date, 100, 100, 0, 'manual');
  INSERT INTO public.user_financial_data (user_id, plan_data, app_data)
  VALUES (u_a, '{"legacy":true}'::jsonb, '{}'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET plan_data=EXCLUDED.plan_data;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text, true);
  j := public.get_plan_ownership_review_summary_v1(p_couple);
  ASSERT (j->>'assets_needs_review')::int=1, 'resumo assets incorreto';
  ASSERT (j->>'income_needs_review')::int=1, 'resumo income incorreto';
  ASSERT (j->>'expenses_needs_review')::int=1, 'resumo expenses incorreto';
  ASSERT (j->>'debts_needs_review')::int=1, 'resumo debts incorreto';
  ASSERT (j->>'fgc_without_holder')::int=1, 'resumo FGC incorreto';
  ASSERT (j->>'legacy_blob_present')::boolean, 'resumo deveria detectar blob';
  ASSERT (j->>'total_needs_review')::int=6, 'total_needs_review deve somar categorias disjuntas';
  ASSERT (SELECT count(*) FROM jsonb_object_keys(j))=8, 'payload do resumo fora do contrato';
  ASSERT j::text NOT ILIKE '%cpf%' AND j::text NOT ILIKE '%hmac%'
     AND j::text NOT ILIKE '%amount%' AND j::text NOT ILIKE '%name%',
    'resumo expôs dados sensíveis ou valores';

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_b::text, 'role', 'authenticated')::text, true);
  blocked := false;
  BEGIN
    PERFORM public.get_plan_ownership_review_summary_v1(p_couple);
  EXCEPTION WHEN no_data_found THEN blocked := true;
  END;
  ASSERT blocked, 'resumo cross-user deveria ser bloqueado';

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  PERFORM set_config('role', 'postgres', true);
  RAISE NOTICE 'ownership_scope_4c1: OK total_preexistente=% shared=%', total_rows, shared_rows;
END $$;

ROLLBACK;
