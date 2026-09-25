# MAP-01 stock/flow chart: source audit and presentation correction

FE base: `a847bc7a5b4dcbad5f3bbc06fb198c6e9d5b3a24`, branch `dev`.
BE source reviewed read-only: `dev` at `a7b1203596e810bdf7708058c86778e75b9b14b3`.

## Findings

- The screenshot's renderer was SnapshotChart in DashboardSnapshot.tsx, not the
  legacy OverviewFlowChart. It used maxFlow for bar/tick geometry and maxTrend
  for inventory geometry, but displayed only the flow numeric axis. Thus an
  inventory point visually level with 485 did not mean 485 units of inventory.
- A fixed 760 x 238 viewBox with preserveAspectRatio="none" permitted unequal
  horizontal/vertical scaling. Maximum inventory was placed exactly on the plot
  top, with no headroom. Both choices contributed to a compressed-looking chart.
- FE buildTrendRows maps dashboard-overview stock_trend[].closing_qty directly.
  The MAP-01 bars and closing series use the same overview payload and date range.
- BE Modules/Warehouse/app/Http/Controllers/OperationalReportController.php,
  buildDashboardOverview, sums signed stock_movements.qty_delta before the range
  for opening stock and adds each day's signed net_change to running stock.
  The sum includes REVERSAL and OPENING; the four gross flow columns do not.
  No missing outbound subtraction was found in this source path.
- Fewer receipts than yesterday do not imply decreasing closing stock. Closing
  decreases when the day's total signed movement is negative. Small declines
  against a large total may also occupy less than one screen pixel.

No authenticated production payload/database was obtained. This source audit
cannot certify every numeric point in the supplied screenshot or the deployed
backend version. It does not force the line to fall or change ledger arithmetic.

## Patch

- Extract the ready-state drawing to SnapshotStockFlowPlot. Keep the dashboard's
  filter, KPI, navigation, permission, loading, error and empty branches intact.
- Use measured CSS-pixel width and an equal-size SVG viewBox with uniform scaling,
  a 300/320px chart height, distinct numbered left flow/right closing axes and
  zero-based signed domains with headroom. Do not truncate inventory to zero.
- Join series by date, preserve provided balances and represent missing/non-finite
  chart inputs as gaps. Do not reconstruct closing from gross bars or carry a
  previous balance into missing data. The upstream API normalizer is unchanged.
- Keep all dates. Long/narrow ranges scroll inside the chart; labels adapt to
  pixel spacing. Inline-size containment prevents the SVG from widening its card.
- Hover/focus exposes daily inbound, combined product/component outbound, closing
  and signed closing change versus the preceding calendar day. Missing opening
  or an absent preceding day does not manufacture a delta.
- Keep keyboard focus, add Arrow/Home/End navigation and Escape dismissal, clamp
  tooltip placement within the visible chart area, and release resize observers.
- No backend, API mapping, business fixtures, loading controller, shell or other
  page was modified. Test fixtures exist only in test files/harnesses.

## Verification actually performed

- Reconstructed original DashboardSnapshot.tsx matched its Git blob exactly:
  `04c9269b57d733b1e4a9c9d6c8166f4c91731f9c`. Its only production diff is one import
  and replacing the old ready-state renderer with the extracted component.
- 24/24 dependency-free model regressions passed in Node 22.16.0 after TS 5.8.3
  transpilation (Vitest runner import adapted to node:test; assertions unchanged).
- Strict isolated TypeScript/no-unused checking passed for the geometry module.
- 30/30 isolated Chromium checks passed: 1/7/14/30/90 days at 1920/940/800/375/320px,
  then keyboard/tooltip/decline/unmount checks. They check numeric axes, exact
  geometry, unscaled circles/text, no overlapping date/title labels, no page-wide
  horizontal overflow, zero bars and inventory headroom. Screenshots inspected.
- Browser harness rendered the actual class component/CSS with preinstalled React
  16, a day-formatting stub and an SVG tabIndex casing compatibility shim. It was
  NOT the full React 19 application or an authenticated production-data test.
- Syntax transpilation passed for all five changed/new TS/TSX files. Eight React
  DOM integration tests were authored for the normal Vitest environment but were
  not executed here (project dependencies unavailable). No full build/CI pass is
  claimed by these isolated checks.
