# Loading follow-up: chart readiness and cached filter reads

Base reviewed: `1546674f5337ad726640c0090f7d0ed1d5413915` on `dev`.

## Changes

- `LazyApexChart` previously waited for IntersectionObserver and then an isolated,
  blank Suspense fallback. Neither module readiness nor Apex's SVG draw joined
  the page barrier. It now prepares every mounted chart inside the nearest page,
  dialog or drawer scope and acknowledges actual `mounted` / `updated` events.
- A committed chart revision owns its acknowledgement. Late callbacks/cleanup
  from a previous revision cannot release the newest revision. Unmount/caught
  chunk failure releases pending work; failure shows the shared error state with
  a retry, never synthetic success. No timeout/progress percentage is added.
- Reuse a shared lazy module after successful loading. Preserve event callbacks,
  disabled animation, responsive width measurement/containment and width remount.
  Do not remount on a data update or erase legend/zoom state deliberately.
- A ready chart's incidental redraw (e.g. draft filter typing/background data)
  does not remask the page. Initial mounts and foreground-blocked redraws join.
- ChartCard's pending state now participates and uses UnifiedLoading rather than
  its own bare spinner. Segmented report controls declare foreground read batches.
- Newly observed/enabled query keys join the foreground batch even when cached.
  Existing active query updates stay background; inactive/background-marked reads
  and the page behind an open dialog are not armed by this new subscription.
- Remove remaining stagger-child entrance delays inside a coordinated surface.

No API endpoints, response mapping, mock business data, permissions, routes,
mutations or warehouse shell were changed.

## Source audit scope and existing coverage

`router/index.tsx` puts every routed page in `withPageLoader`/`routeEl` and a
CoordinatedLoadingBoundary, except MainLayout's shell (intentionally independent).
The eight report entries were checked: InventoryFlow, OutboundFlow,
StockReconcile, Traceability, ImportQuality, PackingLabel, Warranty, Recipient.
The additional PendingEvidence entry also uses that boundary.

Shared chart consumers checked by repository search: Area, Bar, Donut,
HorizontalBar, Line, MultiSeriesBar, StackedBar, Waterfall, plus the putaway tray
selection grid. Dashboard overview and inventory-flow SVG charts render from
props without a separate chart-library import; their API work uses the page gate.

UiDialog/UiDrawer already create independent visible loading scopes. PageSkeleton,
UiStateSurface and Loading/LoadingState already participate. Searches also covered
Suspense, setLoading, isLoading, UiSpinner, TableLoadingBanner and animation-delay.
TableLoadingBanner consumers include Inventory, Warranty, Reversal, AuditLogs and
warranty pickers; they often pass isFetching, so their background indicators were
not indiscriminately promoted into page-blocking work. Submit/export button
spinners were not converted into page-level read blockers.

This is a source-path audit, NOT an authenticated manual pass through every
screen, modal, permission and API outcome.

## Verification actually performed

- 9 pure lifecycle/controller regression tests passed in an isolated Node test
  runner after TypeScript transpilation. Only the test-runner import and emitted
  relative extensions were adapted; production code/test bodies were preserved.
- Strict isolated TypeScript check passed for chart-render-cycle and its imported
  controller. Syntax transpilation passed for the modified TSX files.
- Three React Query integration regressions were added for cached filter groups,
  disabled-to-enabled cached queries, and existing active background refetches.
  These were authored but could not be executed in the local dependency-free
  review environment. CI is configured to execute them alongside existing tests.
- The observed GitHub Actions run `35991811906` ended before creating any job.
  It did NOT supply a full application typecheck, build or browser-test result.
  Full dependency-backed verification is therefore still required; no claim of
  100% runtime validation is made.

## Runtime acceptance checks still needed

On each report, throttle the chart chunk and API responses independently: one
page status until all foreground reads and mounted chart drawings settle. Repeat
cached filter/tab changes and refresh; the first response must not reveal alone.
Check chart chunk failure/retry, keyboard controls, modal close while loading,
keep-alive navigation, offline reads, and desktop/tablet resize. Confirm typing
in an unapplied filter and ordinary background refresh do not hide a ready page.
