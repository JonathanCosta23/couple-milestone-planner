
-- Knowledge foundation tables
CREATE TABLE public.knowledge_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'basic' CHECK (difficulty IN ('basic','intermediate','advanced')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_topics TO anon, authenticated;
GRANT ALL ON public.knowledge_topics TO service_role;
ALTER TABLE public.knowledge_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active topics are public readable" ON public.knowledge_topics
  FOR SELECT USING (active = true);

CREATE TABLE public.knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.knowledge_topics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  difficulty TEXT NOT NULL DEFAULT 'basic' CHECK (difficulty IN ('basic','intermediate','advanced')),
  estimated_minutes INTEGER NOT NULL DEFAULT 3,
  jurisdiction TEXT NOT NULL DEFAULT 'BR',
  version TEXT NOT NULL DEFAULT '1.0.0',
  effective_date DATE,
  last_verified_at TIMESTAMPTZ,
  review_status TEXT NOT NULL DEFAULT 'unverified' CHECK (review_status IN ('unverified','in_review','verified','outdated')),
  educational_disclaimer TEXT NOT NULL DEFAULT 'Conteúdo educacional. Não constitui recomendação de investimento.',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_articles TO anon, authenticated;
GRANT ALL ON public.knowledge_articles TO service_role;
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active articles are public readable" ON public.knowledge_articles
  FOR SELECT USING (active = true);
CREATE INDEX idx_knowledge_articles_topic ON public.knowledge_articles(topic_id);

CREATE TABLE public.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'institutional' CHECK (source_type IN ('primary','institutional','regulatory','academic','media','internal')),
  publication_date DATE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_primary_source BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_sources TO anon, authenticated;
GRANT ALL ON public.knowledge_sources TO service_role;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sources are public readable" ON public.knowledge_sources
  FOR SELECT USING (true);
CREATE INDEX idx_knowledge_sources_article ON public.knowledge_sources(article_id);

CREATE TABLE public.knowledge_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expression TEXT NOT NULL,
  input_definition JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions TEXT NOT NULL,
  limitations TEXT NOT NULL,
  example TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_formulas TO anon, authenticated;
GRANT ALL ON public.knowledge_formulas TO service_role;
ALTER TABLE public.knowledge_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active formulas are public readable" ON public.knowledge_formulas
  FOR SELECT USING (active = true);

CREATE TABLE public.knowledge_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suitable_context TEXT NOT NULL,
  risks TEXT NOT NULL,
  common_mistakes TEXT NOT NULL,
  educational_only BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_strategies TO anon, authenticated;
GRANT ALL ON public.knowledge_strategies TO service_role;
ALTER TABLE public.knowledge_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active strategies are public readable" ON public.knowledge_strategies
  FOR SELECT USING (active = true);

CREATE TABLE public.knowledge_regulatory_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL DEFAULT 'BR',
  category TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  rule_content TEXT NOT NULL,
  effective_date DATE NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_regulatory_rules TO anon, authenticated;
GRANT ALL ON public.knowledge_regulatory_rules TO service_role;
ALTER TABLE public.knowledge_regulatory_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active regulatory rules are public readable" ON public.knowledge_regulatory_rules
  FOR SELECT USING (active = true);

CREATE TABLE public.user_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.knowledge_topics(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  completed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_learning_progress TO authenticated;
GRANT ALL ON public.user_learning_progress TO service_role;
ALTER TABLE public.user_learning_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own learning progress" ON public.user_learning_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own learning progress" ON public.user_learning_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own learning progress" ON public.user_learning_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own learning progress" ON public.user_learning_progress
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER trg_knowledge_topics_updated BEFORE UPDATE ON public.knowledge_topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_knowledge_articles_updated BEFORE UPDATE ON public.knowledge_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_knowledge_formulas_updated BEFORE UPDATE ON public.knowledge_formulas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_knowledge_strategies_updated BEFORE UPDATE ON public.knowledge_strategies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_knowledge_regulatory_updated BEFORE UPDATE ON public.knowledge_regulatory_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_user_learning_progress_updated BEFORE UPDATE ON public.user_learning_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial topics (15 basic themes). Articles start as 'unverified' until sources are attached.
INSERT INTO public.knowledge_topics (slug, title, description, category, difficulty, sort_order) VALUES
  ('orcamento', 'Orçamento financeiro', 'Como organizar entradas e saídas do mês.', 'foundations', 'basic', 10),
  ('reserva-emergencia', 'Reserva de emergência', 'Colchão de segurança para imprevistos.', 'foundations', 'basic', 20),
  ('dividas-juros', 'Dívidas e juros', 'Como juros aceleram dívidas e como priorizar quitação.', 'foundations', 'basic', 30),
  ('juros-compostos', 'Juros compostos', 'O motor do crescimento do dinheiro no tempo.', 'foundations', 'basic', 40),
  ('inflacao', 'Inflação', 'O que corrói o poder de compra do seu dinheiro.', 'foundations', 'basic', 50),
  ('cdi', 'CDI', 'Referência usada por muitos investimentos de renda fixa.', 'renda-fixa', 'basic', 60),
  ('liquidez', 'Liquidez', 'A facilidade de transformar um ativo em dinheiro.', 'foundations', 'basic', 70),
  ('fgc', 'FGC', 'Cobertura do Fundo Garantidor de Créditos.', 'protecao', 'basic', 80),
  ('diversificacao', 'Diversificação', 'Reduzir risco distribuindo entre ativos diferentes.', 'estrategia', 'basic', 90),
  ('concentracao', 'Concentração', 'Riscos de depender demais de um único ativo ou instituição.', 'risco', 'basic', 100),
  ('patrimonio-nominal-real', 'Patrimônio nominal e real', 'A diferença entre o número na tela e o poder de compra.', 'foundations', 'intermediate', 110),
  ('renda-passiva', 'Renda passiva', 'Fluxos financeiros que continuam mesmo sem trabalhar ativamente.', 'estrategia', 'intermediate', 120),
  ('risco-retorno', 'Risco e retorno', 'Como a promessa de retorno maior costuma vir com mais risco.', 'foundations', 'basic', 130),
  ('ir-renda-fixa', 'Imposto de renda em renda fixa', 'Como o IR incide sobre aplicações mais comuns.', 'tributacao', 'intermediate', 140),
  ('iof', 'IOF', 'Imposto que incide sobre operações financeiras de curto prazo.', 'tributacao', 'basic', 150);

-- Minimal draft articles (unverified). Content follows the "simple + detailed" contract.
INSERT INTO public.knowledge_articles (topic_id, title, summary, content, difficulty, estimated_minutes)
SELECT
  t.id,
  t.title,
  'Introdução educacional sobre ' || t.title || '.',
  jsonb_build_object(
    'simple', jsonb_build_object(
      'what', 'Conteúdo em revisão. Assim que a versão final estiver publicada, ela aparecerá aqui.',
      'why', 'Entender este tema ajuda a tomar decisões financeiras com mais consciência.',
      'example', 'Exemplo em preparação.',
      'nextAction', 'Continue explorando os outros tópicos enquanto revisamos este conteúdo.'
    ),
    'detailed', jsonb_build_object(
      'concept', 'Conteúdo detalhado em revisão editorial.',
      'howToCalculate', null,
      'assumptions', 'A versão final trará premissas e fórmulas com fontes.',
      'limitations', 'Este material é educacional e não representa recomendação de investimento.',
      'commonMistake', 'Confundir informação educacional com aconselhamento personalizado.',
      'whenNotToUse', 'Nunca utilize como única base para decisões financeiras relevantes.'
    )
  ),
  t.difficulty,
  3
FROM public.knowledge_topics t;
