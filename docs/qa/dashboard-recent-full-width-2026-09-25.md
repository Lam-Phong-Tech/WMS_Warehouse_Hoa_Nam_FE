# MAP-01: close the empty column beside recent documents

Reviewed base: `56b5f7de40ce94652c27bb290c228d60618bdd6f` on `dev`.

## Cause and narrow fix

The preceding priority-card patch fixed its stretched white tail, but left recent
documents in column 1 / row 3. Stock composition spanned rows 2 through 3 even
though the card was content-height. Its unused grid area therefore appeared as
a large blank block to the right of recent documents.

Two production declarations change in `snapshot-main-grid.css`:

- Recent documents: `grid-column: 1 / -1` on row 3.
- Stock composition: `grid-row: 2`, no longer spanning the documents row.

The upper group stays as chart on the left and priority + stock on the right.
Recent documents now begin after the taller upper column and occupy the entire
next row, with the existing 10px gap. Priority retains its 8px bottom padding.
The chart's dimensions, stock card content, empty state, business queries, data,
loading coordination and DOM/focus order are unchanged. The existing one-column
resets still apply on narrow containers and viewports. No dummy records, extra
cards, forced vertical stretching, hidden content or negative margins are added.

## Executed verification

Updated `scripts/verify-dashboard-priority-layout.mjs` to assert the recent
card reaches BOTH grid edges, clears BOTH upper columns, does not overlap stock,
and leaves no trailing empty grid track. The old assertion that documents always
follow the chart alone would miss this regression and has been replaced.

85 isolated Chromium scenarios passed using the source-reviewed geometry excerpt
of dashboard-overview.css (blob `9332ee804d2b31ac0131ca3cf99c4fa1148a46b8`).
The run used system Chromium through the preinstalled Playwright driver. It did
NOT load the full application or full dashboard stylesheet. The script defaults
to the full repository stylesheet when run in the installed project without
`--base-css`.

Coverage: 1920/1625/1280/1024/900/800/375/320px, 0/1/3/5 tasks, both stylesheet
orders, loading, 10 test-only document rows, an 850px container in a wide viewport,
live resize both ways, task removal, wrapping descriptions and reduced motion.
The 1625px harness reproduced a 620.47px empty column before the patch and 0px
after it. Priority bottom spacing stayed 9px including its border, and the chart
kept the same width and height. Desktop/tablet structural screenshots were read.

No full application build, authenticated API walkthrough or deployment result
is claimed by this layout-only verification.
