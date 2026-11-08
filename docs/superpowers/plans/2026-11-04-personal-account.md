# Personal account and sessions implementation plan

> For agentic workers: execute independent frontend/backend tasks with subagent-driven-development; root integrates and verifies.

**Goal:** Add a self-service Profile sidebar destination and implement the 32 Desktop/Tablet reference states with working profile/avatar, security/MFA, sessions, notification and interface preferences.

**Spec:** User request and `Hoa_Nam_UIUX_V2/phiendangnhap_nguoidung/{Desktop,Tablet}/U01-U32`; design rules remain in `docs/ui/DESIGN_FOUNDATIONS.md`.

**Architecture:** Keep `/profile` and the current shell/auth/MFA contracts. Add scoped self-service endpoints and additive storage for missing account preferences, avatar and declared installation metadata. Preserve the existing account session replacement policy: the user explicitly selected “Giữ chính sách hiện tại”. Physical hardware is never inferred from browser/IP; show actual installation/session identities and unknown metadata honestly.

**Stack:** Existing React/TypeScript, shared UI/themes/tokens, TanStack Query/Zustand, Laravel/PostgreSQL (production), SQLite (tests) and existing TOTP implementation.

## Constraints and review focus

- Own-account endpoints scope by authenticated user; role/department/username remain IAM-owned.
- Profile and preferences enforce optimistic versions; email changes require password reauthentication; avatar is validated private image content.
- Never expose refresh tokens, TOTP secrets/recovery codes or raw session credentials in logs/storage. Keep current-session and legacy token protections.
- Save real notification delivery preferences, enforce mandatory account-security in-app notices. Apply saved interface preferences across the application; cancel/discard leaves active settings intact.
- One right drawer body scroll, sticky actions, tablets use section selector, mobile has no horizontal table/field overflow.
- Original backend dirty deployment files must remain untouched. Backend changes use a separate worktree based on origin/dev.

## Tasks

- [x] Backend: audit active bound `P10ProfileController` / `P10SessionFamily` / `MfaService`, add missing self-profile email/avatar/preferences/installation-device/bulk-session endpoints, migrations and authorization/concurrency/delivery tests. Preserve existing routes and single-session policy. Provide exact DTO/enums/error codes to frontend.
- [x] Frontend: `ProfilePage`, focused personal-account components, `profile.service.ts`, `profile.types.ts`, VI/EN copy. Six reference sections: profile, security, devices/sessions, notifications, appearance, other. Right-side edit/avatar/password/device/session workflows, honest error/empty/stale/unknown-mutation outcomes.
- [x] Integration: sidebar route/labels, profile-owned page heading, avatar metadata, persistent device request identity, global preference provider/store, common date formatting/theme/readability/density/motion and safe preferred landing page.
- [x] MFA: reuse enrollment/QR/confirm/recovery and disable endpoints inside a profile security drawer; keep the forced enrollment route working. QR is local; secrets are transient and disappear on close.
- [x] QA: deterministic real-page browser fixture with captured local API writes; focused profile/password/avatar/preferences/notifications/session/MFA states and 1440/1024/768/390/320 plus dark. Unit/API tests cover ownership, version conflicts, current session, unchanged policy and persistence.
- [ ] Final: review source/contracts and requirement checklist, run relevant tests/lint/typecheck/build, inspect migrations/deployment compatibility, push authorized changes to dev and verify deployment manifests. Report actual verification limits and any remaining backend/deployment issue.
