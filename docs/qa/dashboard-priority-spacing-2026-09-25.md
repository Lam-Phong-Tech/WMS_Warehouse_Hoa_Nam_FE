# MAP-01 priority-card whitespace

Reviewed base: `2f06a97d5da5ab63b3bcb20f018905745fb74dfb` (`dev`).

## Cause and change

The dashboard used a two-column grid with row-wise stretching, and `.snapshot-priority` also
had `min-height: 300px`. The measured stock chart is now taller, so the short
priority list stretches to the chart's height and leaves a large white tail.

The new `snapshot-main-grid.css` is imported by the eager stock-chart stylesheet.
It is scoped to `.hn-dashboard-snapshot` and is more specific than the legacy
rules, regardless of CSS import order. The first grid track fits the priority
list; the stock-composition card starts directly below it with the existing
10px gap. The chart spans two tracks, and recent documents remain below it.
Cards align to their content instead of stretching. Priority bottom padding is
8px, not an arbitrary card height. No chart height or width is changed.

The absolute legacy priority shimmer gets a relative, measurable loading slot
when the old card minimum is removed. Named-container and viewport breakpoints
reset both row and column coordinates for the existing one-column layout.
The four articles retain their DOM/focus order: chart, priority, recent, stock.
There are no negative margins, measurement timers, DOM reparenting, fake tasks,
API changes, count limits, clipped task rows, or changes to loading-controller
readiness and chart numbers.

## Executed verification

`node scripts/verify-dashboard-priority-layout.mjs --chromium /usr/bin/chromium
--base-css <reviewed-legacy-layout-excerpt.css>` passed 76 isolated Chromium
checks. The local run used reviewed relevant rules from dashboard-overview.css
(blob `9332ee804d2b31ac0131ca3cf99c4fa1148a46b8`), NOT the full application.
The normal script default reads the full dashboard stylesheet from the repo.

Coverage: 1920/1625/1280/1024/900/800/375/320px viewports, 0/1/3/5 tasks,
both CSS orders, loading, a narrow 850px container in a 1625px viewport,
live resize in both directions, a task removal, and reduced motion.
Assertions cover card padding, sibling gaps, unchanged chart dimensions,
no implicit tablet column, unchanged DOM/focus order and contained shimmer.
In the three-item harness, the white tail changed from 231px to 9px
(8px padding + 1px border); the chart remained the same size.
Desktop and tablet browser screenshots were reviewed as structural checks.

The original stock-flow CSS blob was hash-verified before adding only its import.
Full-app typecheck/build, authenticated production screenshots and deployment
status are not certified by this CSS-only harness. Test markup lives only in
`scripts/`; no production example data was added.
