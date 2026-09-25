# Non-blocking filters after the first page reveal

Base: FE `a1dce210fdd91572feedf822759a3e66e2cf9048`, branch `dev`.

## Cause and fix

Every routed page is wrapped by CoordinatedLoadingBoundary. Clicks with
filter/search/reset/refresh/retry markers, plain interactive refetches, newly
observed query keys and local loading participants can set its phase to loading.
Previously that phase hid the entire content subtree, added inert/aria-hidden,
and displayed a full-page skeleton, including the filters the user was using.
CSS also forced all descendants invisible on any loading/offline phase, so
removing only the React cover would not fix it.

A shared initial-only presentation policy now controls the cover, focus handling,
aria-hidden, inert, page aria-busy, min-height and grid layout. CSS is keyed by the
same explicit data-loading-blocked flag, not by request activity alone. Once a
surface has revealed, subsequent query/participant work cannot cover or re-lock
it. Local table/chart pending, empty, error and offline renderers remain in place.

This applies through the existing route wrapper to reports and operational,
catalog, administration and public pages. UiDialog/UiDrawer use the same initial-
only rule: first opening still waits safely; later picker filters do not re-mask
the dialog. No page-specific fallback data, cache policy, endpoint, permission,
mutation, warehouse scope or filter criteria were changed.

First entry still coordinates route code, API reads and chart preparation.
An initially failed read still settles to the existing error state; an offline
first entry retains its existing offline state. New route/dialog instances get a
fresh initial barrier. A hidden keep-alive page keeps its revealed state.

## Source-path audit

- router/index.tsx: shared withPageLoader/routeEl boundary; shell is independent.
- MainLayout.tsx / KeepAliveOutlet.tsx: filter query strings are not remount keys;
  the existing pathname + screen identity is preserved.
- Repository searches for data-loading-phase, PageSkeleton, location.reload,
  loading participants and filter/query consumers located the global hide path.
  Actual location.reload calls found are error recovery and PWA update handling;
  those safety/update flows were not removed.
- Updated older foreground-query, refresh/Enter and deferred-tab regression
  expectations: tracking pending work no longer means hiding the whole page.

## Verification

Executed locally:
- 17 presentation/controller tests passed. Exact controller source was verified
  against its remote Git blob hash. Test bodies were transpiled unchanged; only
  the runner import was adapted from Vitest to node:test in the temporary runner.
- Strict isolated TypeScript check of the presentation policy and controller.
- Syntax transpilation of changed TS/TSX files.
- Chromium: 18 post-initial CSS cases (1920/800/390 widths, page/dialog/drawer,
  loading/offline), plus 9 first-entry checks. Real revised CSS preserved input
  visibility, focus, value, form position, boundary height and scroll position.
  Swapping in the original stylesheet reproduced hidden controls.

Added real React/React Query regressions (no boundary/Query mocks) for initial
loading versus filtering, form submit, URL-preserving search, marker actions,
uncached offline filters, errors, local chart participants, unmarked dropdowns,
pagination and out-of-order result completion. The tests use isolated test data,
not application mock data. These dependency-backed tests and the full application
build were not executable in the local dependency-free environment. The existing
loading-sync-verification workflow runs them on push; check that run separately.
No authenticated end-to-end verification of every live screen is claimed.

## Acceptance check

Open a page for the first time: its coordinated skeleton remains. Then apply
filters/search (mouse and Enter), switch dropdown values, paginate, sort, clear
and refresh while throttling only the relevant reads. Filters/header/unrelated
cards stay visible and usable; only the results region reports pending. Repeat
with errors, offline/new keys, rapid changes, a modal picker and a report chart.
