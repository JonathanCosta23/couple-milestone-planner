

# Plan: Contextual Education Integration

## What We're Building

A new component `ContextualEducation` that suggests relevant mini-lessons based on the user's current financial state. This component will appear in three places: **Home**, **Diagnóstico**, and **Simulador**.

## Logic: Which Lessons to Suggest When

Create a function `getContextualLessonSuggestions(appData, config, monthRecords, startDate)` in `src/lib/educationContent.ts` that returns lesson IDs + reasons based on:

| Condition | Lesson | Reason shown |
|-----------|--------|-------------|
| `emergencyMonths < 3` | `emergency-101` | "Sua reserva está baixa" |
| `debtWeight > 0.15` or has active debts | `good-vs-bad-debt` | "Você tem dívidas ativas" |
| `investedWealth > 100000` or has investments | `fgc-guide` | "Proteja seu patrimônio" |
| `savingsRate < 0.1` | `patrimonio-vs-renda` | "Aumente seu potencial" |
| Always (low priority) | `compound-magic` | "Entenda o motor do crescimento" |
| Simulator context or high-risk allocation | `traps-101` | "Cuidado com promessas irreais" |

## New Component: `ContextualEducation.tsx`

A compact card showing 1-2 relevant lesson suggestions with:
- Lesson emoji + title
- Short contextual reason (why this lesson matters *now*)
- Tap to expand inline (reuses `MiniLessons` lesson card pattern)
- Accepts a `context` prop (`"home" | "diagnostic" | "simulator"`) to filter/prioritize

## Integration Points

### 1. `UnifiedHome.tsx`
Add `<ContextualEducation>` between the behavioral nudge (section 7) and shortcuts (section 8). Shows max 1 suggestion.

### 2. `FinancialDiagnostic.tsx`
Add after the bottleneck/opportunity cards at the bottom. Shows 1-2 suggestions based on lowest score dimensions.

### 3. `AdvancedSimulator.tsx`
Add after the scenario comparisons. Shows `traps-101` if custom rate > 20%, or `compound-magic` as default context.

## Files Changed

1. **`src/lib/educationContent.ts`** — Add `getContextualLessonSuggestions()` function
2. **`src/components/plan/ContextualEducation.tsx`** — New component
3. **`src/components/plan/UnifiedHome.tsx`** — Import and render
4. **`src/components/plan/FinancialDiagnostic.tsx`** — Import and render
5. **`src/components/plan/AdvancedSimulator.tsx`** — Import and render

