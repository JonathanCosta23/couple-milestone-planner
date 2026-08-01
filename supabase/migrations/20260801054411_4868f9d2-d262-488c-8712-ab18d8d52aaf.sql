BEGIN;

DO $$
DECLARE
  owner_id uuid := '00000000-0000-0000-0000-000000000c01';
  v_plan uuid;
  v_primary uuid;
  v_partner uuid;
  v_json jsonb;
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

  UPDATE public.plans SET goal_amount = 2000000 WHERE id = v_plan;
  ASSERT (SELECT goal_amount FROM public.plans WHERE id = v_plan) = 2000000,
    'authenticated deveria atualizar goal_amount';

  BEGIN
    UPDATE public.plans SET updated_at = now() WHERE id = v_plan;
    RAISE EXCEPTION 'FALHA: authenticated atualizou updated_at';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

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

  BEGIN
    PERFORM public.assert_plan_mode_consistency_for(v_plan);
    RAISE EXCEPTION 'FALHA: authenticated executou assert_plan_mode_consistency_for';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  v_json := public.get_plan_member_removal_impact_v1(v_plan, v_partner);
  ASSERT v_json ? 'impact_category' AND v_json ? 'data_coverage',
    'preview deveria expor impact_category e data_coverage';
  ASSERT NOT (v_json::text ILIKE '%cpf%' OR v_json::text ILIKE '%hmac%'),
    'preview não pode expor identidade';

  PERFORM set_config('role', 'postgres', true);
  DELETE FROM public.plan_members WHERE plan_id = v_plan;
  DELETE FROM public.plans WHERE id = v_plan;
  DELETE FROM auth.users WHERE id = owner_id;
  RAISE NOTICE 'plan_privileges_hardening: OK';
END $$;

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
    PERFORM public.assert_plan_mode_consistency_for(v_plan);
    RAISE EXCEPTION 'FALHA: estado inconsistente não foi bloqueado';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'constraint trigger bloqueou estado inconsistente: OK';
  END;
  DELETE FROM public.plan_members WHERE plan_id = v_plan;
  DELETE FROM public.plans WHERE id = v_plan;
  DELETE FROM auth.users WHERE id = owner_id;
END $$;

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

DO $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['mode','user_id','status','start_date',
                             'engine_version','updated_at'] LOOP
    ASSERT NOT has_column_privilege('authenticated', 'public.plans', col, 'UPDATE'),
      format('authenticated não pode atualizar %s', col);
  END LOOP;
  FOREACH col IN ARRAY ARRAY['goal_amount','assumption_selic','wizard_complete',
                             'monthly_contribution','initial_amount'] LOOP
    ASSERT has_column_privilege('authenticated', 'public.plans', col, 'UPDATE'),
      format('authenticated deveria atualizar %s', col);
  END LOOP;
  RAISE NOTICE 'matriz de colunas de plans: OK';
END $$;

DO $$
DECLARE
  r record;
  offenders int := 0;
BEGIN
  FOR r IN
    SELECT c.relname, a.privilege_type
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(c.relacl) a
     WHERE n.nspname = 'public'
       AND c.relname IN ('plans','plan_member_private_identity')
       AND a.grantee = 0
       AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
  LOOP
    offenders := offenders + 1;
    RAISE WARNING 'ACL indevida para PUBLIC: %.%', r.relname, r.privilege_type;
  END LOOP;
  ASSERT offenders = 0, 'PUBLIC não pode ter DML/SELECT em plans nem na tabela privada';
  RAISE NOTICE 'ACL de PUBLIC: OK';
END $$;

DO $$
DECLARE
  role_name text;
  priv text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      ASSERT NOT has_table_privilege(role_name, 'public.plan_member_private_identity', priv),
        format('%s não pode ter %s na tabela privada', role_name, priv);
    END LOOP;
    ASSERT NOT has_function_privilege(role_name,
      'public.set_plan_member_identity_v1(uuid,uuid,text,text,text)', 'EXECUTE'),
      format('%s não pode executar set_plan_member_identity_v1', role_name);
  END LOOP;

  FOREACH priv IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
    ASSERT has_table_privilege('service_role', 'public.plan_member_private_identity', priv),
      format('service_role precisa de %s na tabela privada', priv);
  END LOOP;
  ASSERT has_function_privilege('service_role',
    'public.set_plan_member_identity_v1(uuid,uuid,text,text,text)', 'EXECUTE'),
    'service_role precisa executar set_plan_member_identity_v1';
  RAISE NOTICE 'grants da tabela privada e da RPC de identidade: OK';
END $$;

ROLLBACK;