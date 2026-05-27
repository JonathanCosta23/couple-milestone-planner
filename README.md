# Plano do Milhão

Aplicativo de planejamento financeiro pessoal e patrimonial para brasileiros — individual ou casal — focado em construir patrimônio de forma responsável, segura e compreensível. O produto combina planejamento, educação financeira, comportamento, acompanhamento mensal, arquitetura patrimonial e alertas de risco. Não é simulador de juros compostos nem recomendação personalizada de investimento.

## Princípios

1. Fonte única de verdade: Supabase normalizado (plans, plan_members, assets, incomes, expenses, debts, monthly_tracking, monthly_member_tracking, milestones, insights_log).
2. Login obrigatório como porta de entrada. Suporte a e-mail + Google.
3. Modo do plano canônico: `individual` ou `casal`, persistido em `plans.mode`.
4. Nomes dinâmicos vindos de `plan_members.name`. Nada hardcoded.
5. Linguagem clara, humana, sem prometer retorno. Disclaimers obrigatórios.
6. Milestones disparam apenas por patrimônio realizado (`milestones.origin = 'realized'`).

## Stack

- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS v3 + shadcn-ui + Radix
- React Router, TanStack Query, React Hook Form + Zod
- Recharts para projeções
- Supabase (auth, Postgres, edge functions) provisionado via Lovable Cloud
- Vitest + Testing Library para testes

## Scripts

```sh
npm install          # instala dependências
npm ci               # instalação limpa determinística (CI / reset local)
npm run dev          # dev server com HMR (porta 8080)
npm run build        # build de produção
npm run preview      # serve o build localmente
npm run lint         # ESLint (zero erros é critério de aceite)
npm test             # roda a suíte de testes uma vez (Vitest, comando oficial de CI)
npm run test:watch   # modo watch durante desenvolvimento
```

> **CI oficial:** `npm ci && npm run lint && npm test && npm run build`.
> O `vitest.config.ts` está configurado com `clearMocks`, pool de forks
> limitado (`maxForks: 2`) e `teardownTimeout` curto para encerrar de
> forma determinística e evitar processos pendurados.

## Arquitetura de dados

Fonte de verdade desejada: **tabelas Supabase normalizadas**. CRUD acontece via writers dedicados em `src/hooks/`:

- `usePlanWriter` → `plans` + `plan_members`
- `useAssetWriter` → `assets`
- `useIncomeWriter` → `incomes`
- `useExpenseWriter` → `expenses`
- `useDebtWriter` → `debts`
- `useMonthlyTrackingWriter` → `monthly_tracking` + `monthly_member_tracking` (RPC transacional `upsert_month_with_members`)

Camada derivada única em `src/hooks/useFinancialCore.ts` calcula reserva, taxa de poupança, score de saúde, fase da jornada, projeções nominal/líquido/real e próximo melhor passo. Todas as telas leem dessa camada.

**localStorage e blob `user_financial_data`** existem apenas como **compatibilidade de migração** e cache offline. Não são fonte de verdade: todos os writers normalizados (incluindo `monthly_tracking` e `monthly_member_tracking`, concluídos na Fase 2.D) escrevem direto nas tabelas Supabase, e a hidratação por `useDataHydration` sempre vence sobre o cache local. `dataMigrationService` e `blobMigrationService` migram dados antigos para o schema normalizado no primeiro login.

### Fonte de verdade (Fase 2.E)

- **Supabase normalizado é a fonte oficial de verdade** para dados financeiros. Todo CRUD novo passa pelos writers (`usePlanWriter`, `useAssetWriter`, `useIncomeWriter`, `useExpenseWriter`, `useDebtWriter`, `useMonthlyTrackingWriter`).
- **`user_financial_data` (blob JSONB) é legado controlado**. Não há mais autosave contínuo: o blob só é escrito em pontos explícitos de migração (handleUseLocal do diálogo de conflito e primeiro upload de cache local quando o usuário ainda não tem dados na nuvem) e zerado pelo `resetService`.
- **localStorage é cache e preferência**. Continua guardando `plano-do-milhao-v6` / `plano-do-milhao-app-v7` para uso offline e migração, mas nunca sobrescreve dados normalizados carregados do Supabase no login.
- Ao logar, a hidratação das tabelas normalizadas vence sobre o cache local. Se as tabelas estiverem vazias e o blob legado tiver dados, o `BlobMigrationDialog` oferece a migração uma única vez.
- O flag por usuário `plano-do-milhao-migration-done:<uid>` marca a migração como resolvida e impede que o mesmo blob seja reimportado em sessões futuras. O `resetService` limpa esse flag junto com o resto do cache do produto.

## Fluxo básico do usuário

1. Login ou cadastro (e-mail, Google).
2. Migração silenciosa de dados locais legados, se houver.
3. Wizard de perfil financeiro (modo, participantes, objetivo, aportes).
4. Home como central de decisão: rotina do mês, CTA "Registrar aporte", gargalo principal e próximo passo.
5. Plano (Aportes, Estrutura, Simular, Projeção, Saúde, Jornada, Hábitos, Patrimônio, Concentração, Governança).
6. Histórico (Meses, Gastos, Renda, Dívidas) e Perfil (Aprender, Glossário, Radar, Investir, Exportar, Dados).

## Operações destrutivas

"Resetar plano" exige confirmação explícita (`AlertDialog` + digitar `RESETAR`) e usa `resetService` + RPC `reset_user_plan_data` para limpar Supabase, offline queue (`offlineQueue` + dead-letter) e todas as chaves de `localStorage` (atuais, legadas e backups). Autenticação é preservada.

## Compliance, privacidade e limitações

- **Natureza do produto.** Ferramenta de organização e educação financeira pessoal. **Não é** consultoria, corretora, gestora nem agente autônomo de investimentos. Nenhum texto ou número exibido constitui recomendação personalizada.
- **Disclaimer obrigatório.** Toda projeção exibe explicitamente que os valores são *estimativas baseadas nas premissas cadastradas pelo usuário* (Selic, CDI, inflação, IR, aportes, prazo). O componente `LegalFooter` mantém o disclaimer + links para Termos, Privacidade e Aviso educacional acessíveis em todas as telas autenticadas (`src/components/plan/LegalDialogs.tsx`).
- **Consentimento versionado.** No primeiro login (e sempre que a versão dos documentos for incrementada) o `ConsentGate` bloqueia o app autenticado até o usuário aceitar **Termos de Uso** + **Aviso educacional**. O aceite é gravado em `public.legal_consents` com `consent_type` + `version` (ex.: `terms_v1`, `educational_disclaimer_v1`) + timestamp + `metadata`. RLS por `auth.uid()`; sem aceite, só restam *Aceitar* ou *Sair da conta*. Versões oficiais centralizadas em `src/lib/consent/versions.ts`.
- **Sem promessas.** O produto não promete retorno garantido, enriquecimento rápido ou independência financeira em prazo fixo. Toda copy de UI segue esse contrato.
- **LGPD.** Coletamos apenas o necessário para operar o produto: e-mail/nome (auth), dados financeiros cadastrados pelo usuário, participantes do plano, preferências e logs de eventos de produto (`product_events`, `audit_log`). Não vendemos nem compartilhamos dados pessoais para marketing.
- **Direito de exclusão.** O usuário pode (a) exportar seus dados em **Perfil → Exportar** e (b) apagar tudo com **"Resetar plano"** ou pelo link *"Apagar meus dados"* no rodapé legal — limpa banco, cache local e fila offline em uma transação destrutiva. A conta de autenticação permanece e pode ser removida sob solicitação.
- **Auditoria crítica.** Reset destrutivo aguarda o `logProductEvent("plan_reset", { critical: true })`. Se a auditoria falhar, o usuário recebe um toast de aviso explícito (`"Plano resetado, mas a auditoria falhou"`); o `ResetResult.audit` carrega o status para a UI tratar.
- **Segurança de acesso.** Todas as tabelas têm RLS por `auth.uid()`. RPCs transacionais (`upsert_plan_with_members`, `upsert_month_with_members`, `reset_user_plan_data`) rodam como `SECURITY DEFINER` e validam o usuário autenticado.
- **Limitações conhecidas.** Sem billing, sem multiusuário real (compartilhamento de plano entre contas), sem integração Open Finance, sem geração de PDF. Premissas econômicas são editáveis pelo usuário mas seguem defaults centralizados em `src/lib/financialAssumptions.ts`.

## Testes

Vitest + Testing Library cobrem os fluxos críticos de dados. Comandos:

```sh
npm test                              # CI / one-shot (equivalente a vitest run)
npm run test:watch                    # modo watch durante desenvolvimento
npx vitest run path/to/file.test.ts   # arquivo específico
```

Boas práticas adotadas para confiabilidade:
- `clearMocks: true` no Vitest limpa histórico entre testes sem destruir
  implementações de mock declaradas no escopo do módulo.
- `cleanup()` do Testing Library roda em `afterEach` global
  (`src/test/setup.ts`) para desmontar o DOM entre testes.
- `auditService` é mockado nos testes de RPC (`transactionalRpcs`,
  `planWriterModeSwitch`) para evitar chamadas fire-and-forget a
  `supabase.from("audit_log")` fora do escopo testado.

Fluxos cobertos hoje (não removíveis sem substituição):

- **Writers e `member_id`** (`src/hooks/__tests__/writerPayload.memberId.test.ts`): updates parciais de asset/income/expense/debt não apagam `member_id` existente.
- **Offline queue / replay** (`src/lib/__tests__/offlineQueue.helpers.test.ts`): `sanitizeUpdatePayload` nunca envia `member_id` em update parcial que não menciona o campo (preserva vínculo na nuvem e em conflito "manter meu"); `validateCreatePayload` exige `plan_id` + `member_id` válidos para criar **asset** — payloads órfãos vão para *dead-letter* em vez de inserir dado inválido; merge `update+update` e `create+update` preservam o `member_id` original.
- **RPCs transacionais** (`src/hooks/__tests__/transactionalRpcs.test.ts`, `planWriterModeSwitch.test.ts`, `planWriterV2.test.ts`): `upsert_plan_with_members` / `upsert_plan_with_members_v2` e `upsert_month_with_members` são chamadas com o payload correto; v2 recebe `p_plan_id` explícito, falha quando casal não tem parceiro e cai em fallback apenas se a RPC v2 não existir (PGRST202).
- **Reset destrutivo** (`src/lib/services/__tests__/resetService.test.ts`): RPC `reset_user_plan_data`, fila offline e todas as chaves de `localStorage` do produto (incluindo milestones celebrados) são limpas; chaves de outros sistemas são preservadas; idempotente em re-execução; falha de RPC não bloqueia limpeza local.
- **Auditoria de reset** (`src/lib/services/__tests__/resetService.test.ts`): evento crítico `plan_reset` é aguardado em `product_events`; falha de auditoria propaga `audit.ok=false` para a UI sem mascarar o problema.
- **Consentimento legal** (`src/lib/services/__tests__/consentService.test.ts`): `fetchConsentStatus` exige bater a versão oficial (`CONSENT_VERSIONS`); registros em versão antiga continuam pendentes; `recordConsents` faz upsert com `user_id` + `consent_type` + `version`; sem `userId` não toca o banco. RLS por `auth.uid()` na tabela `legal_consents`.
- **Migração blob → tabelas** (`src/lib/services/__tests__/blobMigrationService.test.ts`): blob legado só migra quando as tabelas normalizadas estão vazias para o plano (dados normalizados vencem); erros são propagados por categoria sem abortar as demais.
- **Ciclo de vida de dados** (`src/hooks/__tests__/useDataLifecycle.test.tsx`): boot sem usuário não toca a nuvem; auto-save não dispara antes da hidratação (anti race).
- **Premissas financeiras** (`src/lib/__tests__/financialAssumptions.test.ts`, `financialEngine.test.ts`): defaults centralizados, override por plano, override explícito de UI, projeção nominal/líquido/real coerente.
- **Serviços derivados** (`src/lib/services/__tests__/`): `projectionService` (nominal ≥ líquido ≥ real, renda passiva pela regra dos 4%), `milestoneService` (celebra só marcos realizados, sem repetição), `allocationService` (concentração + cobertura FGC/soberano), `auditService` (audit_log + product_events em paralelo, fail-soft).

## Mais informações

Este projeto é gerenciado pela [Lovable](https://lovable.dev). Edits feitos no Lovable são commitados automaticamente. Para deploy: abrir o projeto e usar Share → Publish. Domínio customizado em Project → Settings → Domains.
