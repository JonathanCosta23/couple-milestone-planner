-- Hardening: UNIQUE constraints para garantir integridade lógica
-- 1) education_progress: uma linha por (user_id, lesson_id)
-- 2) insights_log: um insight ativo por (user_id, plan_id, insight_type)
-- Verificado previamente: não existem duplicatas atuais nas tabelas.

ALTER TABLE public.education_progress
  ADD CONSTRAINT education_progress_user_lesson_unique
  UNIQUE (user_id, lesson_id);

ALTER TABLE public.insights_log
  ADD CONSTRAINT insights_log_user_plan_type_unique
  UNIQUE (user_id, plan_id, insight_type);