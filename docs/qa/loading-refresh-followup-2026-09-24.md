# Loading follow-up: actual refresh lifetime and unmarked read controls

Base: `fd71018f5a811055ab43e2f46dc0b95c4dc9e2f5` on `dev`.

## Additional fixes

1. A plain HTML/UiButton refresh of an already-active cached query previously
   looked like background polling unless its control supplied data-action-kind.
   The shared page/dialog boundary now detects QueryCache fetch events started
   synchronously by its own click, Enter or submit event. It then joins the whole
   foreground read group. Merely clicking/validating does not show loading.
   The intent expires in a microtask, so it cannot leak into a later poll.
   Nested/portal boundaries own their own gestures. Mutations are not observed.
2. `useReportRefresh` now joins the nearest loading scope through a real promise
   ticket. Removed the old 420ms minimum spinner duration. Completion of a read
   cannot release another unfinished read/chart ticket. Parallel reads, rejected
   promises and synchronous throws settle correctly. Requests are not cancelled
   or resent when closing/navigating away.
3. Keep-alive/Activity deactivation releases presentation tickets; resuming
   rejoins unfinished reads. Work completed while hidden cannot leave a spinner
   on return. Toasts from a hidden/unmounted report are suppressed.
4. Refresh feedback uses returned React Query/allSettled outcomes before the
   legacy readError fallback. A resolved failed query does not produce a success
   toast; a successful retry does not reuse an old render's error. Unknown service
   response shapes retain the existing fallback contract.

## Scope

The boundary is already wired into report routes and the remaining routed pages
by `withPageLoader`, and into UiDialog/UiDrawer. This patch fixes their shared
interaction path rather than copying different loading rules into each page.
It supplements the chart mounted/updated readiness fix in the base commit.

No business fixtures, endpoint mapping, permissions, warehouse shell, report
calculations or write/export handlers were changed. Foreground promise tracking
is explicitly for reads, not mutations.

## Verification performed in this continuation

- 23 independent logic tests PASSED using Node 22.16.0. TypeScript was transpiled;
  test-runner imports were changed from Vitest to node:test and relative emitted
  module extensions were adapted. Production logic/test bodies were unchanged.
  These cover read/parallel/chart barriers, errors, old/new request isolation,
  deactivation/resume, interaction expiry and refresh-result interpretation.
- Strict isolated TypeScript checking PASSED for the dependency-free controller,
  foreground-read, foreground-interaction and report-refresh-result modules.
- Syntax transpilation PASSED for all 11 local TypeScript/TSX files reviewed.
- The React hook regression suite was updated to the no-minimum-delay contract,
  with error-result, stale-error and unmount checks. Four React integration tests
  were added for unmarked refresh, Enter search, background isolation and saves.
  These React tests were authored but NOT executed here: the review environment
  lacks the application's dependencies and cannot resolve the npm registry.
- GitHub CI run `35994554177` at the base commit reported failure. Returned job
  records had no executed step details; requesting static-gate logs returned
  BlobNotFound. This is not evidence of a successful full typecheck/build and
  does not establish the cause of that CI failure.

Dedicated CI now includes the report-refresh tests alongside loading/chart tests.
Full dependency-backed build/lint and authenticated Desktop/Tablet walkthroughs
of every report, modal and remaining page are NOT certified by this log.
