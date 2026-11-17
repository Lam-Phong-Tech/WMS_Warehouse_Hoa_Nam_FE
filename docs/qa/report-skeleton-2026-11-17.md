# Report skeleton layout regression — 2026-11-17

## Cause and change

The shared content projection measured closed dropdown menus (opacity zero) and
the bodies of collapsed `details`, including controls with nonzero layout boxes.
These controls became visible, absolutely positioned skeleton blocks over cards.
The reader now prunes transparent branches and visits only the first direct
summary of a closed `details`. Inherited `visibility:hidden` on the loading
source remains measurable; decorative `aria-hidden` icons are preserved.

`ContentLoadingSkeleton` also observes `data-open` and the end of CSS transitions,
with paired listener cleanup, so opening/closing controls refreshes the projection
without requiring a resize. Gradient backgrounds count as paint, preserving the
native table placeholder bars.

The inbound/outbound native KPI skeletons also had zero-width grid tracks due to
the loaded card's flex alignment, and their desktop chart/progress placeholders
retained dimensions larger than the current panels. Explicit skeleton grid
tracks and placeholder sizing correct these loading-only layouts across the
desktop and tablet breakpoints.

## Regression coverage

- `src/shared/ui/loading/content-skeleton-visibility.test.ts`: closed transparent
  menu, closed/open advanced filters, inherited hidden source, decorative icons,
  and gradient-only table placeholders. Rectangle stubs supply the layout that
  JSDOM lacks; the real traversal and computed styles execute.
- `e2e/report-skeleton.spec.ts`: real shared projection, real report combobox,
  native `details`, opening/closing without a page resize, KPI placeholder widths,
  and chart/progress containment.
- Report matrix: inbound, outbound, stock reconciliation, traceability, import
  quality, packing labels, warranty/components, recipient/agency, and both history
  presentations at 1920, 1024, 768 pixels in light/dark themes.
- Each report comparison verifies that excluding genuinely hidden DOM does not
  change projected geometry, the source remains hidden, shapes remain in page
  bounds, the document has no horizontal overflow, and placeholders contain no
  interactive controls. Screenshots are saved under `test-results/report-skeleton/`.

Run `npm run test:report-skeleton` for the isolated Chromium suite. The fixture
mounts real report components/providers and holds the HTTP adapter pending. It
does not contact a backend or certify deployed authenticated routes or loaded
business data. Its margin simulates the content width beside the sidebar.

## Verification

- Before the fix, the dropdown and collapsed-filter unit regressions failed
  with extra controls (7 instead of 4/5 shapes).
- The gradient regression failed with 4 instead of 5 shapes. The native KPI
  browser regressions failed with placeholder width zero on inbound/outbound.
- `npx vitest run src/shared/ui/loading --maxWorkers=2`: 13 files, 112 tests passed.
- The initial complete report matrix passed 64 Chromium checks (60 report/width/
  theme combinations and 4 focused regressions). All 60 report screenshots saved.
- Subsequent visual inspection found the remaining native chart overflow below
  980px on inbound/outbound. Expanded containment tests failed at 768px with
  21.84px overflow. The native skeleton sizing was moved to the base rules so it
  also applies below the desktop breakpoint. The fixture now has 68 checks in
  total, including native containment at all three widths.
- After the tablet correction, all 20 affected/focused checks passed: inbound/
  outbound across all six width/theme combinations, native containment at all
  three widths, and dropdown/details opening/closing. The other report layouts
  and shared TypeScript implementation were unchanged by this final CSS correction.
- `npm run typecheck`: passed after the final changes.
- ESLint for the two modified shared loading modules and the new unit test: passed.
- `git diff --check`: passed.
- An independent code review found no actionable issues in the shared projection,
  observer cleanup, skeleton-only CSS changes, or added regressions.
- The full repository Vitest run was attempted but manually stopped while the
  unrelated `CatalogMasterScreen.interactions.test.tsx` was progressing slowly.
  No full-suite pass is claimed; this is separate from the completed loading and
  report browser checks above. Full-suite progress is in
  `outputs/skeleton-audit/full-suite.log` (local output, not a required source file).

Visual inspection covered every report's desktop light image, plus representative
tablet/dark images. Automated geometry assertions covered all matrix combinations.
Browser output also contains the existing MUI `:first-child` SSR warning; these
fixtures run client-side. No production deployment or authenticated live-site
verification was performed.
