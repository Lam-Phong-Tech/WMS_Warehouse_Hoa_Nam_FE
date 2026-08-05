# WWHN-175 Branch Scope Map

Status: `TRACEABLE_CLOSURE_SCOPE`

## Comparison baseline

- Integration baseline: `dev@3f168d816aad7d5e32690ec392c83992a3e3a494`
- Pre-closure branch head: `m1@79321532b6325b9be598aabdc49f92806b116b1f`
- Comparison result: `m1` ahead by 81 commits, behind by 0.
- Repository metadata references a non-existent `main` branch; actual branches observed are `cross`, `dev`, `m1`.
- Architecture guide identifies the integration-line concept; this map therefore uses `dev` as the practical baseline.

## Existing implementation evidence attributed to WWHN-175

- `src/app/providers/AppProviders.tsx`
- `src/app/router/index.tsx`
- `src/app/router/ProtectedRoute.tsx`
- `src/app/router/RequirePermission.tsx`
- `src/app/layouts/MainLayout.tsx`
- `src/app/layouts/SideNav.tsx`
- `src/modules/auth/services/auth.service.ts`
- `src/shared/api/axios.ts`
- `src/shared/store/auth.store.ts`
- `src/shared/components/index.ts`
- `src/shared/components/README.md`
- `src/modules/component-catalog/ComponentCatalogPage.tsx`

These paths are implementation evidence. Their complete historical diff is not automatically attributed to the closure commit.

## Exact closure file allowlist

The single commit containing this document may change only the following WWHN-175 closure surfaces:

- `.github/workflows/ci.yml`
- `package.json`
- `docs/Task_docs_Jira/WWHN-175.md`
- `docs/evidence/wwhn-175/README.md`
- `docs/evidence/wwhn-175/WWHN-175_CLOSURE_REGISTER.json`
- `docs/evidence/wwhn-175/ARCHITECTURE_DISPOSITION.md`
- `docs/evidence/wwhn-175/WWHN-176_QA2_EXECUTION_MATRIX.md`
- `docs/evidence/wwhn-175/WWHN-177_DEVOPS_HANDOFF.md`
- `docs/evidence/wwhn-175/BRANCH_SCOPE_MAP.md`
- `e2e/wwhn-175-foundation-evidence.spec.ts`
- `scripts/verify-wwhn-175-closure.mjs`
- `scripts/create-wwhn-177-dev-handoff.mjs`
- `scripts/collect-wms-runtime-evidence.mjs`
- `scripts/assert-ci-gates.mjs`

## Explicitly outside closure scope

The broad `dev...m1` diff also contains BA documents, master data, inventory, inbound/outbound, warranty, reports, prior task documents and other changes. They are not re-reviewed or accepted by WWHN-175 merely because they share branch `m1`.

## Review rule

Review and acceptance must use the exact closure commit SHA from GitHub/Jira, not the moving branch name. Any file outside the allowlist in that commit is a scope violation and must be explained before acceptance.
