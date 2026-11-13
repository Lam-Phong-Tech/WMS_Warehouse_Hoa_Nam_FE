# Simplified Chinese localization audit — 13 November 2026

## Catalog completeness

The baseline runtime catalog contained 5,949 Chinese entries for 6,858 Vietnamese keys. The existing Chinese parity test reproduced the 909-key coverage failure.

- Connected 586 existing supplement translations that were not loaded by `messages.zh.ts`.
- Added the remaining 323 missing entries for recent reports, dashboard, authentication, permissions, warranty, packing labels and transaction details.
- Replaced English report-export text inherited from the English catalog and corrected warehouse terminology and Chinese date labels.
- Runtime catalogs now contain **6,858 Vietnamese, 6,858 English and 6,858 Chinese entries**, with no missing/extra keys, empty strings or interpolation-variable mismatches.

The remaining language-independent strings are reviewed acronyms/file extensions (SKU, Excel, PDF), sort symbols, variable-only templates and native language names. Customer names, item names, identifiers and authored content remain data.

## Labels, forms and errors

The label audit inspected 677 production TypeScript/TSX files and checked 807 business/legacy/auth/action labels. It added 23 missing Chinese mappings, corrected warehouse terminology for stock issue/posting, warranty intake and reconciliation, and covered routed navigation/breadcrumb labels. Four PV/master-data number-format branches now select `zh-CN` instead of English for Chinese.

Shared error localization now has Chinese equivalents for every supported English backend contract: 38 exact messages, 57 validation/business templates and 225 field labels. Validation templates translate recognized field labels before generic UI templates; captured names, quantities, SKU codes and raw error metadata are preserved.

Component regressions exercise Chinese report search placeholders, KPI hints, trace filters/details/pagination and already visible password validation, including changes between Vietnamese, English and Chinese without replacing business data.

## Verification and limits

Catalog and label regressions check full key coverage, repeated interpolation variables, actual Chinese runtime resolution, and untranslated Vietnamese/English prose. The committed [verification manifest](./evidence/2026-11-13-localization-verification.json) records counts and test paths. Raw baseline and final runner output remains local under `outputs/chinese-*.json`.

Final verification: **106 distinct tests across 14 files passed**, with TypeScript, targeted ESLint and `git diff --check` passing. `outputs/chinese-verification-summary.json` selects the latest result for each file and records no failures; the earlier failed runs remain as evidence of the gaps found and corrected. Error regressions also verify that an `Error` instantiated from a known English client message changes to Chinese when the active language changes, while unknown content and the original error remain intact.

This audit covers the current source catalog and supported display/error paths. It is not a claim that every live route and state was manually opened. Unknown custom notification content and arbitrary backend prose outside the known message contracts retain their source text to preserve business details; these require a verified translation contract when introduced. The changes have not been deployed to the live website.
