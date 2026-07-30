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
- Teste: `src/hooks/__tests__/planWriterModeSwitch.test.ts` e
  `src/hooks/planWriter/__tests__/modeChange.parsers.test.ts` (unit) +
  cenário RLS ao rodar em staging.

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
## get_plan_member_removal_impact_v1 (contrato do payload)
- `linked.expenses` conta TODAS as despesas do participante.
- `linked.expenses_recurring` / `linked.recurring_expenses_count` é
  **subconjunto** de `linked.expenses`: nunca somar os dois — recorrentes já
  estão contabilizadas em `expenses`.
- `linked.total` soma apenas categorias disjuntas (assets, income, expenses,
  debts, monthly_member_tracking, fgc_events).
- `unassigned.*` conta registros do plano **sem participante vinculado**
  (dados legados anteriores à separação por `plan_member_id`).
  Inclui `assets_no_member`, `income_no_member`, `expenses_no_member`,
  `debts_no_member` e `fgc_events_no_member` (eventos FGC do usuário sem
  `holder_member_id`). `monthly_tracking` agregado **não** entra: é do plano,
  não de um participante.
- `legacy_blob_present`: `true` quando existe linha em
  `public.user_financial_data` com `plan_data` ou `app_data` não vazio.
  Apenas presença — o conteúdo do JSON nunca é retornado.
- `legacy_unassigned_records_present`: `true` quando `unassigned.total > 0`.
- `legacy_data_requires_review` = `legacy_blob_present OR unassigned.total > 0`.
  Enquanto o app mantiver dual-write no blob `user_financial_data`, é
  esperado que essa flag continue `true` para muitos usuários até a retirada
  definitiva do blob.
- `impact_category` (o que a remoção afeta): `none`, `cashflow_only`
  (renda/gastos/dívidas) ou `wealth_and_history` (patrimônio, FGC ou
  histórico mensal).
- `data_coverage` (qualidade da leitura): `normalized_only` quando há blob
  legado ou registros sem `member_id`; `normalized_and_legacy_clear` quando
  não há nenhuma dessas pendências.

## reintegrate_plan_member_v1 (reforço 4.b.1.1-B)
- Além de `identity_status = 'verified'`, exige linha válida em
  `plan_member_private_identity` (mesmo plano, mesmo usuário, `cpf_hmac`
  com 64 hex) e `cpf_last4` com 4 dígitos.
- `hmac_key_version` precisa estar na lista explícita de versões suportadas.
  Hoje: `('1')`. Durante uma rotação futura, a lista poderá conter
  temporariamente a versão antiga e a nova ao mesmo tempo; depois da rotação,
  a antiga é removida. Valores arbitrários nunca são aceitos.
- Sem esses requisitos: `identity_verification_required`.
- Teste: `supabase/tests/plan_privileges_hardening.sql`.

## assert_plan_mode_consistency / assert_plan_mode_consistency_for (4.b.1.1-B.1)
- Motivo: o constraint trigger diferido precisa ler `plans` e `plan_members`
  para validar a coerência de `mode` no COMMIT, mesmo com a função auxiliar
  sem `EXECUTE` para o cliente.
- Ambas são `SECURITY DEFINER` com `SET search_path TO pg_catalog, public` e
  usam apenas nomes de tabela totalmente qualificados.
- `auth.uid()`: não usam — a validação é estrutural, sobre o plano.
- Grants: `REVOKE ALL` de `PUBLIC`, `anon` e `authenticated`; `EXECUTE`
  apenas para `service_role` (e o owner). O trigger continua executando
  automaticamente; o cliente não consegue chamar diretamente.
- Proibido: qualquer escrita — as funções só leem e levantam
  `check_violation` com `plan_members_inconsistent`.
- Teste: `supabase/tests/plan_privileges_hardening.sql`.

## plans (privilégios 4.b.1.1-B)
- `PUBLIC` e `anon`: sem `SELECT`, `INSERT`, `UPDATE` ou `DELETE`.
- `authenticated`: apenas `SELECT` (filtrado por RLS) e `UPDATE` em colunas
  de configuração financeira/objetivo (`goal_*`, `initial_amount`,
  `monthly_contribution`, `assumption_*`, `wizard_complete`,
  `onboarding_complete`).
- `updated_at` **não** é atualizável pelo cliente: fica sob controle das RPCs,
  do trigger de timestamp e de operações server-side.
- `service_role`: privilégios completos.
- Criação de plano só via `upsert_plan_with_members_v3`; `mode` só via
  RPCs de ciclo de vida; exclusão só via `reset_user_plan_data`.
