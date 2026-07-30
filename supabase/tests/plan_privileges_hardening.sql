-- Microfechamento 4.b.1.1-B.1
-- Cobre: privilégios de public.plans, constraint trigger SECURITY DEFINER,
-- versões de HMAC aceitas na reintegração e contrato do preview de remoção.
--
-- Execução: psql -f supabase/tests/plan_privileges_hardening.sql
-- Sempre roda em transação e faz ROLLBACK ao final.

BEGIN;

DO $$
DECLARE
  owner_id uuid := '00000000-0000-0000-0000-000000000c01';
  v_plan uuid;
  v_primary uuid;
  v_partner uuid;
  v_json jsonb;
  v_ok boolean;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (owner_id, 'hardening@test.local', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (owner_id, 'casal', 1000000, 0, 0, 21, 252)
  RETURNING id INTO v_plan;

  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (v_plan, owner_id, 'Titular', true, 'titular', 'active')
  RETURNING id INTO v_primary;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (v_plan, owner_id, 'Parceiro', false, 'parceiro', 'active')
  RETURNING id INTO v_partner;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', owner_id::text, 'role', 'authenticated')::text, true);

  -- 1. authenticated atualiza coluna permitida e o COMMIT lógico segue válido.
  UPDATE public.plans SET goal_amount = 2000000 WHERE id = v_plan;
  ASSERT (SELECT goal_amount FROM public.plans WHERE id = v_plan) = 2000000,
    'authenticated deveria atualizar goal_amount';

  -- 2. authenticated NÃO pode atualizar updated_at diretamente.
  BEGIN
    UPDATE public.plans SET updated_at = now() WHERE id = v_plan;
    RAISE EXCEPTION 'FALHA: authenticated atualizou updated_at';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 3. authenticated NÃO pode inserir nem deletar planos.
  BEGIN
    INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                              monthly_contribution, goal_years, goal_months)
    VALUES (owner_id, 'individual', 1, 0, 0, 1, 12);
    RAISE EXCEPTION 'FALHA: authenticated inseriu plano';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.plans WHERE id = v_plan;
    RAISE EXCEPTION 'FALHA: authenticated apagou plano';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 4. authenticated NÃO pode chamar a função auxiliar do constraint trigger.
  BEGIN
    PERFORM public.assert_plan_mode_consistency_for(v_plan);
    RAISE EXCEPTION 'FALHA: authenticated executou assert_plan_mode_consistency_for';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 5. Preview detecta blob legado e registros sem participante.
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.income (plan_id, user_id, member_id, source, income_type, amount)
  VALUES (v_plan, owner_id, NULL, 'Legado', 'salary', 100);
  INSERT INTO public.fgc_guarantee_events
    (user_id, holder_member_id, event_date, gross_credit_amount,
     guaranteed_amount_received, tax_withheld, source_type)
  VALUES (owner_id, NULL, current_date, 1000, 1000, 0, 'manual');
  INSERT INTO public.user_financial_data (user_id, plan_data, app_data)
  VALUES (owner_id, '{"legacy": true}'::jsonb, '{}'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET plan_data = EXCLUDED.plan_data;

  PERFORM set_config('role', 'authenticated', true);
  v_json := public.get_plan_member_removal_impact_v1(v_plan, v_partner);
  ASSERT (v_json->>'legacy_blob_present')::boolean,
    'preview deveria detectar blob legado';
  ASSERT (v_json->>'legacy_unassigned_records_present')::boolean,
    'preview deveria detectar registros sem member_id';
  ASSERT (v_json->>'legacy_data_requires_review')::boolean,
    'legacy_data_requires_review deveria ser true';
  ASSERT v_json->>'data_coverage' = 'normalized_only',
    'data_coverage deveria ser normalized_only';
  ASSERT (v_json#>>'{unassigned,fgc_events_no_member}')::int = 1,
    'FGC sem titular deveria aparecer em unassigned';
  ASSERT (v_json#>>'{unassigned,total}')::int >= 2,
    'FGC sem titular deveria somar em unassigned.total';
  ASSERT v_json->>'impact_category' IN ('none','cashflow_only','wealth_and_history'),
    'impact_category inválido';

  -- 6. Sem legado, o preview retorna cobertura limpa.
  PERFORM set_config('role', 'postgres', true);
  DELETE FROM public.income WHERE plan_id = v_plan AND member_id IS NULL;
  DELETE FROM public.fgc_guarantee_events WHERE user_id = owner_id AND holder_member_id IS NULL;
  DELETE FROM public.user_financial_data WHERE user_id = owner_id;
  PERFORM set_config('role', 'authenticated', true);
  v_json := public.get_plan_member_removal_impact_v1(v_plan, v_partner);
  ASSERT v_json->>'data_coverage' = 'normalized_and_legacy_clear',
    'sem legado, data_coverage deveria ser normalized_and_legacy_clear';
  ASSERT NOT (v_json->>'legacy_data_requires_review')::boolean,
    'sem legado, legacy_data_requires_review deveria ser false';

  -- 7. Reintegração: só aceita hmac_key_version suportada.
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.plan_members SET status = 'removed' WHERE id = v_partner;
  UPDATE public.plans SET mode = 'individual' WHERE id = v_plan;
  UPDATE public.plan_members
     SET identity_status = 'verified', cpf_last4 = '1234'
   WHERE id = v_partner;

  -- 7a. identidade ausente => rejeitado
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    PERFORM public.reintegrate_plan_member_v1(v_plan, v_partner);
    RAISE EXCEPTION 'FALHA: reintegrou sem identidade privada';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 7b. HMAC malformado => rejeitado
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.plan_member_private_identity
    (member_id, plan_id, user_id, cpf_hmac, hmac_key_version)
  VALUES (v_partner, v_plan, owner_id, 'nao-e-hex', '1');
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    PERFORM public.reintegrate_plan_member_v1(v_plan, v_partner);
    RAISE EXCEPTION 'FALHA: reintegrou com HMAC malformado';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 7c. versões não suportadas ('', '2', '999') => rejeitado
  FOREACH v_json IN ARRAY ARRAY['""'::jsonb, '"2"'::jsonb, '"999"'::jsonb] LOOP
    PERFORM set_config('role', 'postgres', true);
    UPDATE public.plan_member_private_identity
       SET cpf_hmac = repeat('a', 64), hmac_key_version = (v_json #>> '{}')
     WHERE member_id = v_partner;
    PERFORM set_config('role', 'authenticated', true);
    BEGIN
      PERFORM public.reintegrate_plan_member_v1(v_plan, v_partner);
      RAISE EXCEPTION 'FALHA: reintegrou com hmac_key_version não suportada';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;

  -- 7d. cpf_last4 malformado => rejeitado
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.plan_member_private_identity
     SET hmac_key_version = '1' WHERE member_id = v_partner;
  UPDATE public.plan_members SET cpf_last4 = '12' WHERE id = v_partner;
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    PERFORM public.reintegrate_plan_member_v1(v_plan, v_partner);
    RAISE EXCEPTION 'FALHA: reintegrou com cpf_last4 malformado';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 7e. versão '1' com tudo válido => aceito
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.plan_members SET cpf_last4 = '1234' WHERE id = v_partner;
  PERFORM set_config('role', 'authenticated', true);
  v_json := public.reintegrate_plan_member_v1(v_plan, v_partner);
  ASSERT v_json->>'mode' = 'casal', 'reintegração com versão 1 deveria funcionar';

  PERFORM set_config('role', 'postgres', true);
  RAISE NOTICE 'plan_privileges_hardening: OK';
END $$;

-- 8. Estado inconsistente é bloqueado no COMMIT pelo constraint trigger.
DO $$
DECLARE
  owner_id uuid := '00000000-0000-0000-0000-000000000c02';
  v_plan uuid;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (owner_id, 'inconsistente@test.local', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (owner_id, 'casal', 1000000, 0, 0, 21, 252)
  RETURNING id INTO v_plan;
  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, status)
  VALUES (v_plan, owner_id, 'Titular', true, 'titular', 'active');
  BEGIN
    -- casal sem parceiro ativo: deve falhar ao checar a consistência.
    PERFORM public.assert_plan_mode_consistency_for(v_plan);
    RAISE EXCEPTION 'FALHA: estado inconsistente não foi bloqueado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'constraint trigger bloqueou estado inconsistente: OK';
  END;
END $$;

-- 9. PUBLIC/anon não têm SELECT/INSERT/UPDATE/DELETE em public.plans.
DO $$
BEGIN
  ASSERT NOT has_table_privilege('anon', 'public.plans', 'SELECT'), 'anon não pode ler plans';
  ASSERT NOT has_table_privilege('anon', 'public.plans', 'INSERT'), 'anon não pode inserir plans';
  ASSERT NOT has_table_privilege('anon', 'public.plans', 'UPDATE'), 'anon não pode atualizar plans';
  ASSERT NOT has_table_privilege('anon', 'public.plans', 'DELETE'), 'anon não pode apagar plans';
  ASSERT has_table_privilege('authenticated', 'public.plans', 'SELECT'), 'authenticated lê plans via RLS';
  ASSERT NOT has_table_privilege('authenticated', 'public.plans', 'INSERT'), 'authenticated não insere plans';
  ASSERT NOT has_table_privilege('authenticated', 'public.plans', 'DELETE'), 'authenticated não apaga plans';
  ASSERT has_column_privilege('authenticated', 'public.plans', 'goal_amount', 'UPDATE'),
    'authenticated atualiza goal_amount';
  ASSERT NOT has_column_privilege('authenticated', 'public.plans', 'updated_at', 'UPDATE'),
    'authenticated não atualiza updated_at';
  ASSERT NOT has_column_privilege('authenticated', 'public.plans', 'mode', 'UPDATE'),
    'authenticated não altera mode';
  ASSERT NOT has_function_privilege('authenticated',
    'public.assert_plan_mode_consistency_for(uuid)', 'EXECUTE'),
    'authenticated não executa a função auxiliar';
  RAISE NOTICE 'privilégios de plans: OK';
END $$;

ROLLBACK;
