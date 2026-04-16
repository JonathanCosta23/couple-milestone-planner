# Plano do Milhão — Refatoração Estrutural

Status: **Fase 1 em execução** · Atualizado: 2026-04-16

## Princípios da refatoração

1. **Fonte única de verdade**: tabelas Supabase normalizadas. AppData/PlanData no localStorage tornam-se cache offline e ponto de migração.
2. **Modo do plano formal**: `plan_mode` ∈ {`individual`, `casal`} persistido em `plans.mode`. Toda a UI reage a uma única variável.
3. **Nomes 100% dinâmicos**: lidos de `plan_members.name`. Zero hardcoded (`Jonathan`, `Isabella`, `Pessoa 1/2`).
4. **Login first**: autenticação é a primeira fase real. Local-only continua suportado mas o fluxo recomendado entra em conta.
5. **Coerência entre telas**: todas as métricas saem de `useFinancialCore` (já existe, será reforçado).
6. **Milestones reais**: popup de meta atingida só dispara por patrimônio realizado, salvo em `milestones` com `origin = 'realized'`.
7. **Migração transparente**: ao logar, dados v6/v7 do localStorage são detectados, copiados para backup local e migrados para o banco normalizado sem perguntar.

## Modelo de dados canônico

| Tabela | Status | Notas |
|---|---|---|
| `auth.users` | nativa | login |
| `profiles` | existe | display_name; `plan_mode` deprecated em favor de `plans.mode` |
| `plans` | existe | mode (`individual`/`casal`), goal_amount, premissas, start_date |
| `plan_members` | **a criar** | substitui `members` que tem campos legados de selic/cdb hardcoded |
| `assets` | existe | RLS completa |
| `income` | existe | múltiplas fontes por membro |
| `expenses` | existe | ownership shared/individual via `member_id` |
| `debts` | existe | priority, interest_rate, member_id |
| `monthly_tracking` | existe | planned_total + actual_total por mês |
| `monthly_member_tracking` | **a criar** | rastreio por membro quando casal |
| `milestones` | existe | origin: `projected`/`realized`, status: `pending`/`celebrated` |
| `insights_log` | existe | gerados pelos services |
| `education_progress` | existe | em uso |
| `user_financial_data` | existe | **deprecated** após migração |

## Roadmap

### Fase 1 — Fundação (em execução)

- **1.A** Documentação + migration: enum `plan_mode` (individual/casal), tabela `plan_members`, tabela `monthly_member_tracking`, ajustes em `plans.mode`.
- **1.B** Hook `usePlan(user)` central que lê plans + plan_members. Serviço `dataMigrationService` que detecta localStorage v6/v7 ao logar, faz backup e migra.
- **1.C** Refatorar `useFinancialCore` para consumir o novo modelo. Adapter temporário mantém shape de `appData` para componentes ainda não migrados.
- **1.D** Refatorar componentes em lotes: UnifiedHome, PlanModeSelector, Wizard, FinancialProfileSetup, ExpensePanel, DebtModule, CoupleGovernance, ConcentrationMap, PatrimonialArchitecture, MonthlyTracker, IncomePanel, InvestmentForm.
- **1.E** Remover `usePlanData`/`useAppData`/`user_financial_data` legados após QA.

### Fase 2 — Patrimônio como operação real

- CRUD completo em `assets` direto na tabela.
- ConcentrationMap e CoupleGovernance lêem `assets`, não AppData.
- Empty state com CTA "Cadastrar investimento".
- Edição de titular/instituição/bucket/liquidez/FGC com persistência imediata.

### Fase 3 — Coerência financeira

- Régua única entre Estrutura, Saúde, Jornada e Hábitos via `journeyService`.
- Simular vs Projeção com mesmo motor.
- Reserva em meses derivada apenas em `metricsService.emergencyMonths`.
- Fase da Jornada bloqueada por regras objetivas.

### Fase 4 — Onboarding e milestones

- Login como primeira fase obrigatória (com bypass local opcional).
- Onboarding padrão sem Selic/CDB; modo avançado opcional.
- Popup de meta só por `milestones.origin = 'realized'`, salvo no banco, exibido uma única vez.
- Recuperação de senha + sessão persistente.

### Fase 5 — Polimento e beta

- Radar sem falsos "parece seguro".
- Glossário e Investir revisados.
- Exportar/Ajuda/Dados completos.
- QA: consistência reserva entre telas, Simular=Projeção, Patrimônio=Concentração=Governança.
- Tema claro refinado.

## Conversão `solo`/`couple` → `individual`/`casal`

- `solo` → `individual`
- `couple` → `casal`

`src/lib/types.ts`: `export type PlanMode = "individual" | "casal"`. Loader de localStorage v7 converte automaticamente.

## Backups

- Snapshot em `localStorage["plano-do-milhao-pre-migration-backup"]` antes de qualquer migração.
- Export JSON do plano antigo permanece em Perfil → Dados.
