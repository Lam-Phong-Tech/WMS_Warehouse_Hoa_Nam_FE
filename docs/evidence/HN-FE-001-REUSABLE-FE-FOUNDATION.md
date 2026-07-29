# HN-FE-001 - Reusable FE Foundation Evidence

## Traceability

| Field | Value |
| --- | --- |
| Parent Task | WWHN-38 - [FE] Khung ung dung, dang nhap, dieu huong va trang thai UI dung chung |
| Parent Temp Key | HN-FE-001 |
| Epic Temp Key | HN-EPIC-02 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Dependencies | HN-UX-001; HN-FND-001 |
| Output | Reusable FE Nen tang |

## Scope Verified

- React/Vite/TypeScript app shell remains aligned with the technical guide.
- Runtime providers are centralized in `src/app/providers/AppProviders.tsx`.
- Session bootstrap runs before route decisions through `bootstrapAuth()` and
  `ProtectedRoute`.
- Route-level RBAC is handled by `RequirePermission`; no-permission state is
  routed to the shared no-permission page/state.
- API calls use the shared `http` wrapper and `axios` interceptor for envelope
  unwrap, refresh handling, field validation errors, permission errors, and
  request IDs.
- Shared components are exported through `src/shared/components/index.ts`,
  including layout, forms, data display, feedback, permission controls,
  navigation, cards, and page-level UI states.

## Acceptance Criteria Mapping

| Acceptance Criteria | Evidence |
| --- | --- |
| Reusable FE Nen tang reviewed/verified | `AppProviders`, router/layout/session store, API wrapper, shared component barrel |
| Loading/empty/error/success/disabled/confirm states | `Loading`, `PageSkeleton`, `EmptyState`, `ErrorState`, `ApiErrorAlert`, `ConfirmButton`, `ConfirmDialog`, `ActionButton` |
| RBAC/API error display | `RequirePermission`, `PermissionGuard`, `NoPermissionState`, `ApiErrorAlert`, `api-error.ts`, `axios.ts` |
| No hard-coded business rules outside contract | FE keeps RBAC as UX aid only; API/business validation remains backend-owned |
| Lint/build/test suitable for handoff | Run results should be appended below when executed in the branch |
| BA/QA traceability | This evidence file plus `docs/WMS_FRONTEND_STANDARDIZATION.md` |

## Blockers / Disposition

- No FE1 P0/P1 blocker identified in the reusable foundation scope.
- Endpoint/payload/business-rule gaps outside the current approved contract must
  be raised to BE/BA with owner and ETA before UI behavior is changed.

## Verification Log

Executed on 2026-07-29 in `C:\ERP_HOA_NAM\Hoa_Nam_Tools`:

```text
npm.cmd run test
Result: PASS - 32 test files, 276 tests

npm.cmd run lint
Result: PASS

npm.cmd run build
Result: PASS - tsc -b and vite build completed
```
