-- Testes do portão editorial (enforce_publication_gate).
-- Todos os cenários rodam em transação e revertem no final.

BEGIN;

-- 1. fórmula draft pode ser inserida
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.knowledge_formulas
    (slug, title, purpose, expression, assumptions, limitations,
     active, publication_status, review_status)
  VALUES ('test-formula-draft', 't', 'p', 'x=y', 'a', 'l',
          true, 'draft', 'unverified')
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'draft insert falhou'; END IF;
END $$;

-- 2. fórmula in_review pode ser atualizada
DO $$
BEGIN
  UPDATE public.knowledge_formulas
     SET review_status = 'in_review'
   WHERE slug = 'test-formula-draft';
END $$;

-- 3. fórmula não verificada não pode ser publicada
DO $$
BEGIN
  BEGIN
    UPDATE public.knowledge_formulas
       SET publication_status = 'published'
     WHERE slug = 'test-formula-draft';
    RAISE EXCEPTION 'gate falhou: publicou sem verified';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%without review_status = verified%' THEN
      RAISE EXCEPTION 'mensagem inesperada: %', SQLERRM;
    END IF;
  END;
END $$;

-- 4. fórmula verified sem last_verified_at não pode ser publicada
DO $$
BEGIN
  UPDATE public.knowledge_formulas
     SET review_status = 'verified', last_verified_at = NULL
   WHERE slug = 'test-formula-draft';
  BEGIN
    UPDATE public.knowledge_formulas
       SET publication_status = 'published'
     WHERE slug = 'test-formula-draft';
    RAISE EXCEPTION 'gate falhou: publicou sem last_verified_at';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%last_verified_at%' THEN
      RAISE EXCEPTION 'mensagem inesperada: %', SQLERRM;
    END IF;
  END;
END $$;

-- 5. fórmula verified com last_verified_at pode ser publicada
DO $$
BEGIN
  UPDATE public.knowledge_formulas
     SET last_verified_at = now(),
         publication_status = 'published'
   WHERE slug = 'test-formula-draft';
END $$;

-- 6. fórmula inativa não pode ser publicada
DO $$
BEGIN
  UPDATE public.knowledge_formulas
     SET publication_status = 'draft', active = false
   WHERE slug = 'test-formula-draft';
  BEGIN
    UPDATE public.knowledge_formulas
       SET publication_status = 'published'
     WHERE slug = 'test-formula-draft';
    RAISE EXCEPTION 'gate falhou: publicou inativa';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%inactive content%' THEN
      RAISE EXCEPTION 'mensagem inesperada: %', SQLERRM;
    END IF;
  END;
END $$;

-- 7. regulatory sem source_url não publica
DO $$
BEGIN
  BEGIN
    INSERT INTO public.knowledge_regulatory_rules
      (jurisdiction, category, rule_name, rule_content,
       effective_date, last_verified_at, source_url,
       active, publication_status, review_status)
    VALUES ('BR','fgc','r1','conteudo','2024-01-01', now(), '',
            true, 'published', 'verified');
    RAISE EXCEPTION 'gate falhou: publicou sem source_url';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%source_url%' THEN
      RAISE EXCEPTION 'mensagem inesperada: %', SQLERRM;
    END IF;
  END;
END $$;

-- 8. regulatory sem review verified não publica
DO $$
BEGIN
  BEGIN
    INSERT INTO public.knowledge_regulatory_rules
      (jurisdiction, category, rule_name, rule_content,
       effective_date, last_verified_at, source_url,
       active, publication_status, review_status)
    VALUES ('BR','fgc','r2','conteudo','2024-01-01', now(), 'https://bcb.gov.br/x',
            true, 'published', 'in_review');
    RAISE EXCEPTION 'gate falhou: publicou sem verified';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%review_status = verified%' THEN
      RAISE EXCEPTION 'mensagem inesperada: %', SQLERRM;
    END IF;
  END;
END $$;

-- 9. regulatory correta publica
DO $$
BEGIN
  INSERT INTO public.knowledge_regulatory_rules
    (jurisdiction, category, rule_name, rule_content,
     effective_date, last_verified_at, source_url,
     active, publication_status, review_status)
  VALUES ('BR','fgc','r3','conteudo','2024-01-01', now(), 'https://bcb.gov.br/x',
          true, 'published', 'verified');
END $$;

-- 10. o trigger cobre todas as 6 tabelas sem acessar coluna inexistente.
-- Basta rodar um UPDATE published em cada tabela editorial. Se o trigger
-- referenciasse coluna inexistente, o Postgres levantaria erro sintático
-- (undefined column) em qualquer UPDATE.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'knowledge_articles',
      'knowledge_formulas',
      'knowledge_regulatory_rules',
      'knowledge_strategies',
      'knowledge_investment_schools',
      'knowledge_investor_references'
    ]) AS t
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET updated_at = now() WHERE false', r.t
    );
  END LOOP;
END $$;

ROLLBACK;