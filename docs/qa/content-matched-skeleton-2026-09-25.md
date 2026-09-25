# Skeleton boxes aligned to the mounted screen

Base reviewed: `03d5792fbaeffaf11c167f18259c7d9521d5183e` on `dev`.

## Why the previous visual was too generic

`LoadingSkeleton` drew four filters, two chart panels and five table columns for
most report routes. Actual source differs: inbound has three main filter fields
and seven desktop table columns; reconciliation has six KPI cards and an
11-column table; recipient/agency has six table columns; printing and warranty
have horizontal progress summaries, not the generic pair of chart panels.
Copying one silhouette across these views does not match their content.

## Change

- The existing loading boundary now renders `ContentLoadingSkeleton` against its
  hidden, still-mounted content. It measures actual card, text, field, table-cell,
  plot, progress and circle rectangles. It does not clone HTML, field values,
  image URLs, IDs, event handlers, chart series or business strings.
- This uses each screen's real CSS and active DOM, including responsive hidden
  columns, current tab, field widths, card counts, padding and inner scrollers.
  There is no second invented grid or universal five-column table for mounted
  pages. Progress summaries stay horizontal; native round regions stay round.
- Root-relative coordinates account for ancestor scale. Overflow is clipped at
  the real scroll container as well as the content edge, so table cells cannot
  paint over a neighboring card. Width/height are not inferred from sample data.
- Mutation, resize, scrolling and font completion refresh the projection. Reads
  are coalesced to one animation frame. Identical geometry is not re-rendered.
  Traversal has explicit node/shape budgets to avoid unbounded large-table work.
- All shapes still use ONE existing pulse ancestor. There are no per-card reveal
  timers. The loading controller, HTTP reads, mutation/export handling and chart
  completion queue are unchanged. Only the existing ready decision exposes the
  real content in one pass. The new visual never registers a pending ticket.
- Dialog/drawer scopes use their own content. Hidden nested scopes, generic
  fallback skeletons, fixed overlays, tooltips and zero-size nodes are excluded.
  Observers and pending frame callbacks are removed on reveal/unmount.

The router already wraps the RPT-01 through RPT-08 report families (including
separate outbound and the history presentations), other routed pages and shared
UiDialog/UiDrawer scopes. This is a shared presentation change, not an edit of
report queries or a promise that every authenticated screen has been walked.

## Cold-route limitation

Before a lazy route module has mounted, its real layout does not exist to measure.
The eager route skeleton remains the fallback for that interval, or for an
unmeasurable/zero-size tree. Once substantive content mounts, its geometry replaces
that fallback. This patch does not claim an exact per-route silhouette before
any route code is available. It primarily fixes the long API/chart wait where
the prior implementation kept showing the generic template despite a real layout
already existing underneath it.

## Verification executed

- Verified the original boundary against Git blob
  `0ac4aa583ff682c1a27404a707c02ed5bd7ce924` before the narrow presentation patch.
- Strict TypeScript checking passed for the dependency-free DOM geometry module.
- 12/12 geometry logic regressions passed using Node after TypeScript transpilation;
  only the test-runner import was adapted from Vitest to node:test.
- 36/36 isolated Chromium checks passed: eight structural fixtures at widths
  1920, 800, 375 and 320, plus fallback/mount hand-off, reduced motion and teardown.
  These executed the new geometry reader and new class component, checking field
  position/dimension agreement, a single animation/status, no copied values or
  interactive placeholders, no added horizontal overflow and hidden source DOM.
- Desktop and tablet screenshots of the structural harness were inspected.
- The browser harness uses the preinstalled React 16 runtime for this standalone
  class component, not the project's React 19 app/providers. Structural fixtures
  are test-only layouts, not authenticated report data or full report replicas.
- Five React regression tests were added to the existing loading test directory.
  They have NOT been run with the application's React/Vitest dependencies here.
- Full application typecheck/build/lint and authenticated report walkthroughs are
  not certified by these isolated checks. No successful CI result is assumed.
