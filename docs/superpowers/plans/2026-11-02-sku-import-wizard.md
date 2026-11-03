# SKU Import Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the SKU Excel import dialog into a compact, accessible three-step flow without changing import rules.

**Architecture:** Keep file, digest, preview, and commit logic in `SkuImportModal`. Add a local step state and render only the controls and result for the current step. Use MUI layout primitives and scoped styling. Preserve the existing service calls and payload validity checks.

**Tech Stack:** React 19, TypeScript, MUI 9, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-02-sku-import-wizard-design.md`

## Global Constraints

- Do not change backend contracts, Excel templates, or SKU import rules.
- Preserve file type/size checks, SHA-256, stale-preview invalidation, permission checks, API error handling, and Vietnamese/English/Chinese translations.
- Keep the dialog content bounded by the viewport and usable on narrow screens.

## Review Focus

- Invalid file selection stays on step 1 and shows its error.
- A failed validation stays on step 2 and allows a retry without writing data.
- Changing the file or update option after validation invalidates import eligibility.
- A commit rejection remains visible with its report and does not claim success.
- Reset and close return to step 1 on the next open.

---

### Task 1: Step flow and behavior

**Files:**
- Modify: `src/modules/master-data/components/SkuImportModal.tsx`
- Test: `src/modules/master-data/components/SkuImportModal.test.tsx`

**Interfaces:**
- Local state: `type ImportStep = "select" | "review" | "done"`.
- Existing `canCommit` remains the only gate for the import action.

- [x] **Step 1: Write failing tests** for initial step, validation transition, retry, back navigation, successful or duplicate commit, reset, and the Review Focus cases.
- [x] **Step 2: Run** `pnpm exec vitest run src/modules/master-data/components/SkuImportModal.test.tsx` and confirm the new tests fail for missing step UI.
- [x] **Step 3: Implement** step state and conditional content in `SkuImportModal`; move action controls to the dialog footer; transition on validation and commit while retaining existing mutation guards.
- [x] **Step 4: Run** the same test file and confirm all tests pass.

### Task 2: Copy, responsive layout, and verification

**Files:**
- Modify: `src/modules/master-data/components/SkuImportModal.tsx`
- Modify: `src/shared/i18n/messages.ts`
- Modify: `src/shared/i18n/messages.en.ts`
- Modify: `src/shared/i18n/messages.zh.ts`
- Create: `src/modules/master-data/components/sku-import-modal.css`
- Modify: `docs/ui/vuexy-sync/allowlists/css-baseline.json`

**Interfaces:**
- Translation keys under `masterData.import` for step titles, step descriptions, back, and result actions.
- Scoped class `hn-sku-import-dialog` on the dialog.

- [x] **Step 1: Add failing assertions** for step labels, accessible navigation, and responsive layout hooks.
- [x] **Step 2: Run** the targeted Vitest file and confirm new assertions fail.
- [x] **Step 3: Add** translated copy and scoped styling for step indicator, upload card, options, and footer; keep the dialog height content driven and cap it at the viewport.
- [x] **Step 4: Run** targeted Vitest, TypeScript typecheck, formatting check on touched files, and UI guard scripts. Browser inspection was stopped because the computer-use tool could not verify the open Chrome URL. Repository-wide UI guards reported unrelated existing violations.

## Self-review

The two tasks cover each spec requirement. Type and service interfaces stay unchanged. No new dependency or global dialog styling is needed.
