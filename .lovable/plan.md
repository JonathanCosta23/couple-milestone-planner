

# Plan: Fix Navigation Issues Found During Testing

## Issues to Fix

### 1. Milestone Alert Cascade
After wizard completion, 6 milestone alerts appear one after another. Fix: show only the highest reached milestone on first load, not every intermediate one.

**File:** `src/pages/Index.tsx`
- Change the `newMilestone` logic to only show the single highest unreached milestone, or batch-dismiss all milestones below the highest one on initial load.

### 2. Function Component Ref Warnings
`FinancialGlossary`, `TrapDetector`, and `SharePlan` are receiving refs they can't handle.

**File:** `src/pages/Index.tsx`
- Check how these components are rendered — likely being passed a `ref` prop inadvertently. Remove the ref or wrap components with `React.forwardRef`.

### 3. Sub-nav truncation (minor)
Some pill labels are cut off. This is acceptable since the nav is horizontally scrollable, but adding `scroll-padding` or ensuring the last item has right padding would improve it slightly.

**File:** `src/components/plan/SubNav.tsx`
- Add right padding to the scroll container to prevent last-item clipping.

## Technical Details

- Milestone fix: Initialize `dismissedMilestones` with all milestones below the highest reached one, so only the top milestone shows once.
- Ref fix: Inspect the `renderContent` function for any accidental ref forwarding pattern (possibly from a wrapper or mapping).
- SubNav padding: Add `pr-4` to the scrollable container.

