# Auditoria SECURITY DEFINER

Todas as funções abaixo usam `SECURITY DEFINER` para operar em transações
multi-tabela ou aplicar RLS controlado. Cada função fixa `search_path`,
valida `auth.uid()` quando lida com dados do usuário e limita `EXECUTE` a
`authenticated` / `service_role`. Segredos e IDs reais não são incluídos.

## handle_new_user
- Motivo: trigger em `auth.users` precisa inserir em `public.profiles` mesmo
  antes de a sessão do novo usuário estar ativa.
- `auth.uid()`: não usa; identifica o usuário via `NEW.id` do trigger.
- `search_path`: `public`.
- EXECUTE: função de trigger, não é chamada por roles diretamente.
- Permite: criar profile 1:1 com o novo usuário.
- Proibido: alterar outros usuários (só recebe `NEW`).
- Teste: signup ponta a ponta cria linha em `profiles` (coberto em `docs/qa-checklist.md`).

## user_can_access_plan
- Motivo: usada em policies RLS para checar ownership OU membership ativa
  sem recursão nas próprias policies.
- `auth.uid()`: sim, único elo com o chamador.
- `search_path`: `pg_catalog, public`.
- EXECUTE: `authenticated`, `service_role`.
- Permite: verificar se o chamador enxerga um plano.
- Proibido: retornar `true` para plano de terceiro (não há branch sem `auth.uid()`).
- Teste: `supabase/tests/user_action_state_rls.sql` (cenários owner/member/inactive/stranger).

## topic_has_published_content
- Motivo: gate estável em RLS de `user_learning_progress`; evita marcar
  progresso em tópico sem conteúdo publicado.
- `auth.uid()`: não usa; a checagem é sobre o tópico, não o usuário.
- `search_path`: `pg_catalog, public`.
- EXECUTE: `authenticated`, `service_role`.
- Permite: policy validar `topic_id` sem expor `knowledge_articles`.
- Proibido: qualquer efeito colateral (função `STABLE`).
- Teste: `supabase/tests/learning_progress_rls.sql`.

## upsert_plan_with_members / upsert_plan_with_members_v2
- Motivo: transação multi-tabela (`plans` + `plan_members`) com invariantes de
  modo individual/casal. `SECURITY DEFINER` evita depender de RLS combinada
  entre as duas tabelas durante a mesma operação.
- `auth.uid()`: sim; toda escrita passa por `WHERE user_id = uid`.
- `search_path`: `public`.
- EXECUTE: `authenticated`, `service_role`.
- Permite: manter titular/parceiro coerentes com o modo do plano.
- Proibido: gravar em plano de outro usuário (checagem explícita `RAISE`).
- Teste: `src/hooks/__tests__/planWriterV2.test.ts` (unit) + cenário RLS ao rodar em staging.

## upsert_month_with_members
- Motivo: sincroniza `monthly_tracking` + `monthly_member_tracking` numa
  mesma transação, validando membros do plano.
- `auth.uid()`: sim; valida ownership do plano antes de qualquer escrita.
- `search_path`: `public`.
- EXECUTE: `authenticated`, `service_role`.
- Permite: registrar mês com desdobramento por membro.
- Proibido: aceitar `plan_member_id` que não pertença ao plano do usuário
  (contagem `v_invalid_count` dispara `RAISE`).
- Teste: `src/hooks/__tests__/monthlyTrackingWriter.modes.test.ts`.

## reset_user_plan_data
- Motivo: reset destrutivo precisa apagar em cascata várias tabelas do
  usuário numa transação única.
- `auth.uid()`: sim; todos os `DELETE` filtram por `user_id = uid`.
- `search_path`: `public`.
- EXECUTE: `authenticated`, `service_role`.
- Permite: apagar apenas dados do próprio usuário.
- Proibido: alcançar dados de outro `user_id` (não há branch sem filtro).
- Teste: `src/lib/services/__tests__/resetService.test.ts` valida contrato
  do serviço; cenário SQL a executar em staging antes de release.

## enforce_publication_gate (trigger)
- Motivo: valida invariantes editoriais globais nas seis tabelas de
  conhecimento. Roda como definer para acessar colunas com privilégios
  consistentes.
- `auth.uid()`: não usa; regra é sobre o conteúdo.
- `search_path`: `pg_catalog, public`.
- EXECUTE: função de trigger, não chamada diretamente.
- Permite: bloquear publicação de conteúdo inativo, não verificado, sem
  disclaimer/`last_verified_at` ou (para regulatórios) sem `source_url`.
- Teste: `supabase/tests/editorial_publication_gate.sql`.