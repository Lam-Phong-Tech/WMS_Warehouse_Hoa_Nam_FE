# Profile login history implementation plan

> Execute inline with the executing-plans skill.

**Goal:** Keep previous phone/browser logins visible as signed out after another device replaces them.

**Design:** Preserve the existing active device inventory. Add a separate read-only, self-scoped paginated history of ended login families, using retained refresh records. Rank the whole family before filtering inactive records so token rotation never creates a false logout. Show history immediately below active devices using the existing device illustrations and semantic status badges. Show login/end dates and browser; hide an empty history. Retention follows existing token pruning (normally 30 days after expiry/revocation), with no auth policy change or schema change.

**Tech stack:** Laravel, React, TanStack Query, existing WMS tokens/components.

## Tasks

- [x] Add backend tests for replacement phone → desktop, rotations, repeated logins, expiry, account isolation, pagination, validation and no credential leakage.
- [x] Add GET /auth/device-history in the profile controller, a family-ranked paginated query and safe serializer. Keep existing device/session actions unchanged.
- [x] Add frontend history types/service and a focused history component inside the profile sessions panel, with previous/next page controls, error/retry, empty/loading states and query invalidation after revocation.
- [x] Verify browser cards, dates, states, pagination and responsive overflow with a fixture; run backend regressions and frontend checks.
- [x] Review changes, commit and push both repositories to dev under the user's existing authorization.

## Review focus

No cross-account data or token hashes; no rotated ancestor mistaken for logout; signed-out/expired entries have no revoke controls; existing active counts/revocation remain authoritative; partial backend rollout must show history load failure without hiding active devices.

## Verification

Backend: profile self-service, session replacement and session persistence regressions passed (31 tests / 371 assertions), then refreshed history tests passed (2 tests / 28 assertions), including same-second rotation and authentication rejection. Frontend: typecheck, targeted lint, profile/transport/presentation/history unit tests and desktop/mobile browser scenarios passed. Browser pagination fixture was corrected to forward query parameters. Independent code review found missing history invalidation after reconciling a committed revocation with a lost response; the new regression reproduced the issue and passed after the fix. Desktop 1440px and mobile 390px screenshots inspected. Live phone/desktop login against production has not been performed.
