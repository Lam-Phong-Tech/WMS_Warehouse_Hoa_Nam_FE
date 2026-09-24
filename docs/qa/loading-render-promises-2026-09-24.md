# Report chart loading: promise completion and transition hand-off

Base reviewed: `7e7facbb2623810226262a0d68a457bf074b3688` on `dev`.

## Remaining gaps fixed

1. An already-rendered chart's background draw was not registered with the gate.
   A refresh starting before that draw finished could therefore stop waiting too
   early. Foreground-only participants now remain registered. They do not hide a
   ready page, but join a real foreground loading cycle. Validation-only clicks
   still do not manufacture a loader.
2. Lifecycle events alone do not cover rejected asynchronous engine promises and
   can read mutable chart configuration. The lazy renderer now waits for the
   actual `render()` / `updateOptions()` promise. A per-instance queue serializes
   engine work and coalesces pending inputs to the latest revision. An older draw
   cannot announce that a newer revision is ready.
3. A render/update failure becomes an error caught by the existing chart boundary,
   releasing only that chart ticket and exposing an explicit retry. Closing a
   chart cancels presentation callbacks, not HTTP/backend work. Discarded engines
   cannot update a replacement after StrictMode/Activity cleanup.
4. Equal inputs acknowledge completion without redrawing. Plain chart config and
   series are copied so engine mutation cannot change source data. Public events
   and props are retained; no report calculations or API mapping were changed.
5. `useTabView` registers its pending React transition. The page does not reveal
   a newly selected tab before its panel commits and chart tickets take over.
   Selecting the active tab does nothing; the select callback remains stable.

The engine stays lazy-loaded. The existing responsive width measurement,
inline-size containment, width remount and disabled chart animation are retained.
No production business fixtures, delay timer or fake percentage was added.

## Report scope

The existing router's page gate covers the RPT-01 through RPT-08 report families:
InventoryFlow (including the separate OutboundFlow route), StockReconcile,
Traceability, ImportQuality, PackingLabel, Warranty, Recipient and PendingEvidence
(history). PendingEvidence has both IoHistoryReport and the RPT-08 presentation;
its route wrapper encloses both. These are eight report families and nine route
entries because outbound has its own entry.

This patch changes the shared Apex entry, its renderer/controller and shared tab
transition hook. Existing SVG markup remains unchanged under the page gate.
It is not a claim that every report/state has passed a browser walkthrough.

## Verification actually executed

- **42/42 independent logic tests passed** in Node 22.16.0: 25 new renderer/gate
  cases plus all 17 existing loading-controller regressions. The existing test
  file's blob hash was checked against `3fe0fab355677f2d82f4894f19faad0439690a00`.
- Source was transpiled with local TypeScript 5.8.3. Only the test-runner import
  (Vitest to node:test) and emitted relative module extensions were adapted.
  Production logic and test assertions were not replaced.
- Strict isolated TypeScript checking passed for the controller, render-cycle,
  render-runtime and both independent test files. The only test-runner type shim
  re-exported node:test's `it` as Vitest's `it`.
- Syntax transpilation passed for all 10 local source/test TypeScript files,
  including the unchanged baseline test. This is NOT a full application build.
- Five React integration cases were authored for two-chart reveal, rejected
  rendering, StrictMode replacement, suspended tab transitions and no-op tabs.
  They were NOT executed in this environment: application dependencies are not
  installed and the npm registry cannot be resolved here.
- Existing DOM-only report/tray mocks use the former react-apexcharts module name.
  A test-only resolver alias directs those mocks to the new renderer facade;
  their assertions remain unchanged. The new integration tests mock only the
  apexcharts/client engine and exercise the actual facade. Dedicated CI also
  includes the existing chart-consumer suites and tab-transition tests.

## Browser verification boundary

A read-only visit to the live frontend was attempted through the connected
browser on September 24, 2026. It reached the login screen. No authenticated
session was available, no report was entered and no build identifier was visible.
No credentials were guessed and no business action was submitted.

A full dependency-backed typecheck/build and authenticated Desktop/Tablet
acceptance of the committed build are still required before a 100% runtime signoff.
