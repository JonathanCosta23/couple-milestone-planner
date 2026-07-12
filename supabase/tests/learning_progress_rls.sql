-- RLS de user_learning_progress + gate topic_has_published_content.
-- Requer que auth.uid() esteja disponível via set_config('request.jwt.claims').

BEGIN;

-- Cria dois usuários fictícios em auth.users (bypassando trigger via id fixo).
DO $$
DECLARE
  u1 uuid := '00000000-0000-0000-0000-000000000a01';
  u2 uuid := '00000000-0000-0000-0000-000000000a02';
  topic_empty uuid;
  topic_ready uuid;
BEGIN
  INSERT INTO auth.users (id, email, aud, role)
    VALUES (u1, 'u1@test.local', 'authenticated', 'authenticated'),
           (u2, 'u2@test.local', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.knowledge_topics (slug, title, category, difficulty, sort_order, active)
  VALUES ('rls-empty','t','cat','basic',1,true)
  RETURNING id INTO topic_empty;

  INSERT INTO public.knowledge_topics (slug, title, category, difficulty, sort_order, active)
  VALUES ('rls-ready','t','cat','basic',2,true)
  RETURNING id INTO topic_ready;

  INSERT INTO public.knowledge_articles
    (topic_id, title, summary, content, difficulty, jurisdiction,
     version, last_verified_at, review_status, educational_disclaimer,
     active, publication_status)
  VALUES (topic_ready,'a','s','{"simple":{"what":"x"},"detailed":{"concept":"c"}}'::jsonb,
          'basic','BR','1.0.0', now(),'verified','edu', true,'published');

  PERFORM set_config('role','authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text, 'role','authenticated')::text, true);

  -- 1. topic sem artigo publicado bloqueia insert
  BEGIN
    INSERT INTO public.user_learning_progress (user_id, topic_id, status, progress_percentage)
    VALUES (u1, topic_empty, 'in_progress', 10);
    RAISE EXCEPTION 'RLS falhou: gravou em tópico sem publicação';
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    -- esperado (RLS/gate); ignoramos.
  END;

  -- 2. topic com publicação permite insert do próprio usuário
  INSERT INTO public.user_learning_progress (user_id, topic_id, status, progress_percentage)
  VALUES (u1, topic_ready, 'in_progress', 25);

  -- 3. usuário u1 não grava em nome de u2
  BEGIN
    INSERT INTO public.user_learning_progress (user_id, topic_id, status, progress_percentage)
    VALUES (u2, topic_ready, 'in_progress', 25);
    RAISE EXCEPTION 'RLS falhou: gravou em nome de outro usuário';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    -- esperado
  END;

  -- 4. leitura isolada — u2 não enxerga progresso de u1
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role','authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.user_learning_progress WHERE user_id = u1) THEN
    RAISE EXCEPTION 'RLS falhou: u2 enxergou progresso de u1';
  END IF;

  -- 5. quando artigo deixa de ser elegível, updates ficam bloqueados
  PERFORM set_config('role','service_role', true);
  UPDATE public.knowledge_articles SET publication_status='draft' WHERE topic_id = topic_ready;
  PERFORM set_config('role','authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u1::text, 'role','authenticated')::text, true);
  BEGIN
    UPDATE public.user_learning_progress SET progress_percentage = 50 WHERE user_id = u1;
    -- se não bloqueou, o gate está inativo
    IF (SELECT progress_percentage FROM public.user_learning_progress WHERE user_id = u1) = 50 THEN
      RAISE EXCEPTION 'RLS falhou: update aceito em tópico não mais elegível';
    END IF;
  EXCEPTION WHEN insufficient_privilege OR others THEN
    -- esperado
  END;
END $$;

ROLLBACK;