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

  j := public.add_plan_partner_v1(p, 'Parceira', 30);
  new_partner := (j->>'partner_id')::uuid;
  IF new_partner = removed_partner THEN
    RAISE EXCEPTION 'L6: reutilizou parceiro removed';
  END IF;
  IF j->>'mode' <> 'casal'
     OR (SELECT mode FROM public.plans WHERE id = p) <> 'casal' THEN
    RAISE EXCEPTION 'L6: mode nao virou casal atomicamente';
  END IF;
  IF (SELECT status FROM public.plan_members WHERE id = removed_partner) <> 'removed' THEN
    RAISE EXCEPTION 'L6: parceiro removido foi tocado';
  END IF;

  partner := j->'partner';
  IF partner ? 'cpf_last4' OR partner ? 'identity_status'
     OR partner ? 'linked_auth_user_id' OR partner ? 'user_id' THEN
    RAISE EXCEPTION 'L6: payload expoe campo privado: %', partner;
  END IF;

  blocked := false;
  BEGIN PERFORM public.add_plan_partner_v1(p, 'Outra', 25);
  EXCEPTION WHEN unique_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L6: segundo parceiro ativo aceito'; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role','authenticated')::text, true);
  blocked := false;
  BEGIN PERFORM public.add_plan_partner_v1(p, 'Invasor', 30);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L6: cross-user aceito'; END IF;

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  DELETE FROM public.plan_members WHERE plan_id = p;
  DELETE FROM public.plans WHERE id = p;
  DELETE FROM auth.users WHERE id IN (u, u2);
  RAISE NOTICE 'L6 add_plan_partner_v1: OK';
END $$;

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
  INSERT INTO public.expenses (plan_id, user_id, member_id, category, expense_type,
                               is_essential, amount, is_recurring)
  VALUES (p, u, parceiro, 'moradia', 'fixed', true, 1500, true);

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  j := public.remove_plan_partner_v1(p);
  IF (j->>'removed_partner_id')::uuid <> parceiro OR j->>'mode' <> 'individual' THEN
    RAISE EXCEPTION 'L7: payload inesperado: %', j;
  END IF;

  SELECT status, is_active, removed_at INTO rec
    FROM public.plan_members WHERE id = parceiro;
  IF rec.status <> 'removed' OR rec.is_active <> false OR rec.removed_at IS NULL THEN
    RAISE EXCEPTION 'L7: flags de remocao incorretas';
  END IF;
  IF (SELECT status FROM public.plan_members WHERE id = titular) <> 'active' THEN
    RAISE EXCEPTION 'L7: titular foi afetado';
  END IF;
  IF (SELECT mode FROM public.plans WHERE id = p) <> 'individual' THEN
    RAISE EXCEPTION 'L7: mode nao virou individual';
  END IF;

  SELECT count(*) INTO expenses_kept FROM public.expenses
   WHERE plan_id = p AND member_id = parceiro;
  IF expenses_kept <> 1 THEN RAISE EXCEPTION 'L7: historico financeiro sumiu'; END IF;

  blocked := false;
  BEGIN PERFORM public.remove_plan_partner_v1(p);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L7: remocao sem parceiro ativo passou'; END IF;

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

DO $$
DECLARE
  u  uuid := '00000000-0000-0000-0000-0000000c1008';
  u2 uuid := '00000000-0000-0000-0000-0000000c1108';
  j jsonb; m jsonb;
  p_ind uuid; p_cas uuid;
  titular uuid; parceiro uuid;
  blocked boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u,'l8a@test.local','authenticated','authenticated'),
    (u2,'l8b@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

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
      RAISE EXCEPTION 'L8: retorno expoe campo privado: %', m;
    END IF;
  END LOOP;

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
    RAISE EXCEPTION 'L8: parceiro nao deveria ter linked_auth_user_id';
  END IF;

  blocked := false;
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', '00000000-0000-0000-0000-0000000c1208'::text,
                        'role','authenticated')::text, true);
    PERFORM public.upsert_plan_with_members_v3('casal', 'Sem parceiro');
  EXCEPTION WHEN check_violation THEN blocked := true;
            WHEN foreign_key_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'L8: casal sem parceiro aceito'; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);
  j := public.upsert_plan_with_members_v3('individual', 'Titular A2', p_ind, 45,
                                          NULL, NULL, 2000000);
  IF (j->>'is_new_plan')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'L8: is_new_plan deveria ser false';
  END IF;
  IF (SELECT goal_amount FROM public.plans WHERE id = p_ind) <> 2000000 THEN
    RAISE EXCEPTION 'L8: meta nao atualizou';
  END IF;
  IF (SELECT name FROM public.plan_members WHERE id = titular) <> 'Titular A2'
     OR (SELECT age FROM public.plan_members WHERE id = titular) <> 45 THEN
    RAISE EXCEPTION 'L8: perfil do titular nao atualizou';
  END IF;
  IF (SELECT count(*) FROM public.plan_members WHERE plan_id = p_ind) <> 1 THEN
    RAISE EXCEPTION 'L8: upsert criou ou removeu membro em plano existente';
  END IF;

  blocked := false;
  BEGIN
    PERFORM public.upsert_plan_with_members_v3('casal', 'Titular A2', p_ind, 45, 'X', 30);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L8: troca de modo aceita em plano existente'; END IF;
  IF (SELECT mode FROM public.plans WHERE id = p_ind) <> 'individual'
     OR (SELECT count(*) FROM public.plan_members WHERE plan_id = p_ind) <> 1 THEN
    RAISE EXCEPTION 'L8: falha nao fez rollback integral';
  END IF;

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  PERFORM set_config('role','postgres', true);
  DELETE FROM public.plan_members WHERE plan_id IN (p_ind, p_cas);
  DELETE FROM public.plans WHERE id IN (p_ind, p_cas);
  DELETE FROM auth.users WHERE id IN (u, u2);
  RAISE NOTICE 'L8 upsert_plan_with_members_v3: OK';
END $$;

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

  INSERT INTO public.assets (plan_id, user_id, member_id, asset_type,
    invested_amount, current_amount, net_estimated,
    has_fgc, has_sovereign_guarantee, mark_to_market, is_active)
  VALUES (p, u, parceiro, 'renda_fixa', 100, 100, 100, true, false, false, true);
  INSERT INTO public.income (plan_id, user_id, member_id, source, income_type, amount)
  VALUES (p, u, parceiro, 'Salario', 'salary', 5000);
  INSERT INTO public.expenses (plan_id, user_id, member_id, category, expense_type,
                               is_essential, amount, is_recurring)
  VALUES (p, u, parceiro, 'moradia', 'fixed', true, 1500, true),
         (p, u, parceiro, 'lazer', 'variable', false, 200, false);
  INSERT INTO public.debts (plan_id, user_id, member_id, debt_type, total_balance,
                            monthly_payment, interest_rate, effective_cost)
  VALUES (p, u, parceiro, 'cartao', 1000, 100, 0.1, 0.12);
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
  IF (j#>>'{linked,recurring_expenses_count}')::int > (j#>>'{linked,expenses}')::int THEN
    RAISE EXCEPTION 'L9: recurring maior que expenses';
  END IF;
  IF (j#>>'{linked,total}')::int <> 7 THEN
    RAISE EXCEPTION 'L9: linked.total deveria ser 7, got %', j#>>'{linked,total}';
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
    RAISE EXCEPTION 'L9: payload expoe identidade';
  END IF;

  PERFORM set_config('role','postgres', true);
  INSERT INTO public.income (plan_id, user_id, member_id, source, income_type, amount)
  VALUES (p, u, NULL, 'Legado', 'other', 100);
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
    RAISE EXCEPTION 'L9: legado nao detectado: %', j;
  END IF;
  IF (j#>>'{unassigned,income_no_member}')::int <> 1
     OR (j#>>'{unassigned,fgc_events_no_member}')::int <> 1
     OR (j#>>'{unassigned,total}')::int <> 2 THEN
    RAISE EXCEPTION 'L9: unassigned incorreto: %', j->'unassigned';
  END IF;
  IF j::text ILIKE '%legacy":true%' THEN
    RAISE EXCEPTION 'L9: payload devolveu conteudo do blob';
  END IF;

  PERFORM set_config('role','postgres', true);
  UPDATE public.user_financial_data
     SET plan_data = '{}'::jsonb, app_data = '{}'::jsonb WHERE user_id = u;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);
  j := public.get_plan_member_removal_impact_v1(p, parceiro);
  IF (j->>'legacy_blob_present')::boolean THEN
    RAISE EXCEPTION 'L9: blob vazio deveria ser false';
  END IF;

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
  IF NOT blocked THEN RAISE EXCEPTION 'L9: membro inexistente aceito'; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role','authenticated')::text, true);
  blocked := false;
  BEGIN PERFORM public.get_plan_member_removal_impact_v1(p, parceiro);
  EXCEPTION WHEN no_data_found THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L9: cross-user aceito'; END IF;

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

DO $$
DECLARE
  u  uuid := '00000000-0000-0000-0000-0000000c1010';
  p uuid; titular uuid; removido_1 uuid; removido_2 uuid;
  j jsonb;
  expenses_before integer; expenses_after integer;
  blocked boolean;
  v text;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u,'l10@test.local','authenticated','authenticated')
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
  INSERT INTO public.expenses (plan_id, user_id, member_id, category, expense_type,
                               is_essential, amount, is_recurring)
  VALUES (p, u, titular, 'moradia', 'fixed', true, 1000, true);
  SELECT count(*) INTO expenses_before FROM public.expenses WHERE plan_id = p;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  blocked := false;
  BEGIN PERFORM public.reintegrate_plan_member_v1(p, titular);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L10: titular aceito'; END IF;

  blocked := false;
  BEGIN PERFORM public.reintegrate_plan_member_v1(p, removido_2);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L10: identidade nao verificada aceita'; END IF;

  PERFORM set_config('role','postgres', true);
  UPDATE public.plan_members SET identity_status = 'verified', cpf_last4 = '1234'
   WHERE id = removido_2;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role','authenticated')::text, true);

  blocked := false;
  BEGIN PERFORM public.reintegrate_plan_member_v1(p, removido_2);
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L10: sem identidade privada aceito'; END IF;

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

  PERFORM set_config('role','postgres', true);
  UPDATE public.plan_member_private_identity SET hmac_key_version = '1'
   WHERE member_id = removido_2;
  blocked := false;
  BEGIN
    UPDATE public.plan_members SET cpf_last4 = '12' WHERE id = removido_2;
  EXCEPTION WHEN check_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'L10: CHECK de cpf_last4 ausente'; END IF;

  PERFORM set_config('role','postgres', true);
  UPDATE public.plan_members SET cpf_last4 = '1234' WHERE id = removido_2;
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
    RAISE EXCEPTION 'L10: mode nao virou casal na mesma transacao';
  END IF;
  SELECT count(*) INTO expenses_after FROM public.expenses WHERE plan_id = p;
  IF expenses_after <> expenses_before THEN
    RAISE EXCEPTION 'L10: dados financeiros alterados';
  END IF;

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
  DELETE FROM auth.users WHERE id = u;
  RAISE NOTICE 'L10 reintegrate_plan_member_v1: OK';
END $$;

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
  IF NOT failed THEN RAISE EXCEPTION 'L11: RPC deveria falhar com o trigger temporario'; END IF;

  SELECT count(*) INTO private_rows
    FROM public.plan_member_private_identity WHERE member_id = m;
  IF private_rows <> 0 THEN
    RAISE EXCEPTION 'L11: linha privada permaneceu apos falha';
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