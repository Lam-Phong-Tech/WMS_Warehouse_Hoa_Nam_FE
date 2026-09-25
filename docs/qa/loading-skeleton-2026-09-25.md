# Immediate skeleton layout with one coordinated reveal

Base: `ad77802478072081146fa783e908c67e1d95030a` on `dev`.

## User-visible change

Navigation immediately renders neutral placeholder boxes for the heading,
filters, KPI cards, chart panels and table, rather than a blank page with one
spinner. The route-chunk fallback and the data/chart fallback use the same eager
layout. All placeholders animate through ONE parent animation; individual boxes
never reveal independently. The existing loading controller still switches the
whole content group to ready after its reads and chart rendering settle.

The fallback is presentation-only. It never registers a pending ticket itself.
The actual content stays mounted, hidden and inert under the skeleton so chart
measurement and parallel reads continue. Both occupy the same CSS grid cell;
the skeleton contributes height from the first render, including before a route
chunk mounts. Existing sidebar/header, offline/error rendering, background
refetch policy, API mapping and write/export handlers are unchanged.

The RPT-01 through RPT-08 families (nine route entries including separate
OutboundFlow) have an eager report/reconciliation layout. History query variants
share that layout. Other routed screens use list/overview/detail/auth layouts;
dialogs and drawers default to compact field placeholders. These are structural
placeholders, not business fixture data or exact per-state screenshot replicas.
No fake progress percentages or minimum-duration timers were introduced.

## Checks performed

- Verified the fetched router, boundary and existing CSS against their Git blob
  hashes before editing. The route constants used by tests were also hash-checked
  and are not modified by this commit.
- 13 route-layout tests passed with Node 22.16.0 after TypeScript transpilation.
  The test runner import was adapted from Vitest to node:test; emitted alias
  imports were resolved to the same fetched source. Assertions were unchanged.
- 24 isolated Chromium layout cases passed: six layouts at CSS viewport widths
  1920, 800 (@2x), 375 and 320. Checks include immediate visible boxes, top-aligned
  grid overlay, hidden but measurable content, no horizontal overflow, no fake
  interactive controls, exactly one animation and reduced-motion handling.
- Browser layout checks rendered the actual new skeleton component and CSS in a
  standalone harness with preinstalled React 16 UMD, a Fragment compatibility
  shim and a translation stub. They are NOT a React 19 application walkthrough.
  Desktop and tablet screenshots were visually inspected. These checks caught
  and corrected an overlay placement error and a narrow-title overflow.
- TypeScript 5.8.3 syntax transpilation passed for nine reviewed source/test files.
  This is not a full application typecheck or production build.
- Six React integration regressions were added for unresolved route chunks,
  staggered reads plus chart completion, no content remount, no self-blocking
  fallback, standalone route placeholders and compact dialog placeholders.
  They were authored but not executed locally because the application's React
  19 / React Query / Vitest dependencies are unavailable in this environment.

Full dependency-backed build/lint/tests and an authenticated check of the
correct deployed commit remain required for application-wide runtime signoff.
