# WWHN-211 / WWHN-212 — FE closure evidence

This directory locks the FE-owned inventory/read/trace scope and CI evidence. It does **not** fabricate BA, Tech Lead, PM, BE, QA1 or QA2 formal sign-off.

## Code-owned closure

The inventory service owns exactly six read/trace integrations: balance list, balance subledger, movement list, movement detail, movement source trace and physical-code trace. `scripts/verify-wwhn-211-closure.mjs` fails CI if one of those mappings disappears, route/action RBAC is removed, API retry handling is lost, or Safe-stock/Scan dead scope returns to the WWHN-211 inventory service.

The dedicated workflow `.github/workflows/wwhn-211-fe-closure.yml` runs formatting, lint, typecheck, focused unit tests, production build and the WWHN-212 Playwright matrix on the exact commit SHA. It uploads screenshots/video/trace/test reports plus SHA-256 evidence under `wwhn-211-fe-<FULL_SHA>`.

The repository-wide Prettier debt discovered by the exact-SHA gate was remediated with the repository's own Prettier configuration before the final acceptance run. The one-off remediation workflow is intentionally removed from the final tree so the acceptance SHA is evaluated by check-only CI, not by a mutating formatter.

## Scope boundary

WWHN-211 FE code scope is limited to Inventory balance/subledger and Stock Movement/Physical Code read/trace. Safe-stock configuration/alerts and scan mutation/workflows remain outside this service and must be traced to their own approved task/flow.

## External gates

WWHN-108/WWHN-17 Source-of-Truth decisions, official role-authored approval/effective-date comments, independent BE/QA1 direct API evidence and QA2's formal review outcome remain external evidence. They must be authored by the responsible roles and are intentionally not synthesized by this repository control.
