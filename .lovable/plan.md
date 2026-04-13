

# Fix: SubNav Clipping on Mobile

## Root Cause

The SubNav container uses `-mx-1 px-1 pr-6` which doesn't properly account for the parent's `px-4` padding. The last chip gets clipped because the right padding inside the scroll container isn't enough to push the last item fully into view.

## Changes

### 1. `src/components/plan/SubNav.tsx`
Refactor the component with a proper two-layer approach:

- **Outer wrapper**: Uses negative margins (`-mx-4`) to break out of the parent's padding, creating a full-bleed scroll area.
- **Inner scrollable div**: Has `px-4` on the left and a spacer element (or `after:` pseudo-element with `min-w-4`) on the right to guarantee the last chip is never clipped.
- Reduce `gap` from `gap-2` to `gap-1.5` for tighter mobile fit.
- Add a right-edge fade gradient mask (via CSS `mask-image` or an overlay `div`) as a visual hint that more content is scrollable.
- Keep `scrollbar-hide`, `snap-scroll-x`, and `-webkit-overflow-scrolling: touch`.
- Ensure `shrink-0` on all buttons so they never compress.

### 2. `src/index.css`
Add a utility class `.scroll-fade-right` that applies a subtle linear-gradient mask on the right edge (transparent to white over ~24px) to hint at scrollable content. This provides the "premium continuity hint" without a visible scrollbar.

### 3. Validation
After implementation, test on 390x844 and 360x800 viewports to confirm no clipping on any of the three SubNav instances (Plano with 6 items, Histórico with 4, Perfil with 7).

