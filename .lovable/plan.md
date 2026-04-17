# Plano do Milhão — Refatoração Estrutural

Status: **Fase 2.A — Lote 1 concluído** · Atualizado: 2026-04-17

## Princípios da refatoração

1. **Fonte única de verdade**: tabelas Supabase normalizadas. AppData/PlanData no localStorage tornam-se cache offline e ponto de migração.
2. **Modo do plano formal**: `plan_mode` ∈ {`individual`, `casal`} persistido em `plans.mode`. Toda a UI reage a uma única variável.
3. **Nomes 100% dinâmicos**: lidos de `plan_members.name`. Zero hardcoded (`Jonathan`, `Isabella`, `Pessoa 1/2`).
4. **Login first**: autenticação é a primeira fase real. Local-only continua suportado mas o fluxo recomendado entra em conta.
5. **Coerência entre telas**: todas as métricas saem de `useFinancialCore` (já existe, será reforçado).
6. **Milestones reais**: popup de meta atingida só dispara por patrimônio realizado, salvo em `milestones` com `origin = 'realized'`.
7. **Migração transparente**: ao logar, dados v6/v7 do localStorage são detectados, copiados para backup local e migrados para o banco normalizado sem perguntar.

## Roadmap

### Fase 1 — Fundação (concluída)
- 1.A enum + tabelas (`plan_members`, `monthly_member_tracking`).
- 1.B `usePlan` + `dataMigrationService`.
- 1.C `useFinancialCore` com overlay de cloud (modo + nomes canônicos).
- 1.D Index.tsx propaga `effectiveAppData`.

### Fase 2 — Operação real (em execução)

Dividida em 4 lotes para reduzir risco:

- **2.A — Fundação de escrita**
  - **Lote 1 ✅**: renomear `PlanMode` para `individual`/`casal` em todo o código com loader retrocompatível em `appStorage`. Remover `incomeJonathan`/`incomeIsabella` do tipo público; conversão automática via `LegacyFinancialProfile` interno em `appStorage`.
  - **Lote 2 ⏳**: criar `usePlanWriter` (CRUD direto em `plans` + `plan_members`).
  - **Lote 3 ⏳**: Wizard e PlanModeSelector escrevendo no banco normalizado.
  - **Lote 4 ⏳**: login obrigatório.
- **2.B — assets**: CRUD real de patrimônio.
- **2.C — income, expenses, debts**: 3 hooks de CRUD.
- **2.D — monthly_tracking + monthly_member_tracking**: tracker mensal no banco.

### Fase 3 — Coerência financeira
- Régua única entre Estrutura, Saúde, Jornada e Hábitos via `journeyService`.
- Simular vs Projeção com mesmo motor.
- Fase da Jornada bloqueada por regras objetivas.

### Fase 4 — Onboarding e milestones
- Onboarding sem Selic/CDB; modo avançado opcional.
- Popup de meta só por `milestones.origin = 'realized'`.

### Fase 5 — Polimento e beta
- Radar sem falsos "parece seguro".
- Glossário e Investir revisados.
- QA: consistência reserva entre telas, Simular=Projeção, Patrimônio=Concentração=Governança.

## Conversão `solo`/`couple` → `individual`/`casal`

- Tipo canônico em `models.ts`: `export type PlanMode = "individual" | "casal"`.
- Loader em `appStorage.normalizeAppData` aceita strings legadas e converte ao carregar.
- `dataMigrationService.toCanonicalMode` continua aceitando ambas para JSONs antigos importados.

## Backups

- Snapshot em `localStorage["plano-do-milhao-pre-migration-backup"]` antes de qualquer migração.
- Export JSON do plano antigo permanece em Perfil → Dados.
