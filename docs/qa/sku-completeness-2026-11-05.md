# SKU usage and information completeness

## Behavior

- Usage selector filters ACTIVE/INACTIVE independently of information completeness.
- PENDING means at least one missing brand/category/model; COMPLETE requires all three.
- Both conditions are applied by the backend before pagination, together with keyword, SKU type and brand.
- Dashboard counts only active pending SKUs. Its link applies ACTIVE + PENDING, including navigation while the SKU screen stays mounted.
- Each row keeps its usage badge and shows a separate completeness badge plus missing field names.
- Usage CSS is scoped to the usage badge so warning colors are preserved on active and inactive rows.

## Verification

- PHPUnit SKU management and Dashboard privacy regressions: 16 tests, 64 assertions passed, including all eight combinations of present/missing fields, status/type/brand/keyword intersection, invalid filter, Dashboard count and pagination over 100 records.
- Vitest SKU screen: 9 focused tests passed, including independent selectors/reset, missing Model badge, Dashboard initial and same-mounted navigation.
- Regression evidence: the new tests failed before the corresponding fixes (completeness filter, deep-link navigation, warning badge colors and clipped labels).
- Browser verification uses the real SKU screen, hooks and shared UI components with a read-only transport fixture. Checks light/dark at 1440/1024/768/390/320px, control bounds, badge distinction/contrast, missing fields and table/header/arrow contrast. Screenshots are local test artifacts, not production data.
- Production build (TypeScript + Vite) and scoped ESLint passed. Vite reports existing large-chunk warnings. Browser matrix passed all 10 cases; labels fit without ellipsis after widening the status column.

## Limits

- No authenticated production API/browser verification or deployment claim.
- Initial full frontend run encountered failures in DashboardPage, auth-security-rbac-audit, layout-overflow-guards and AgencyComparisonTab. It was interrupted under local resource pressure; this is not a passing full-suite result. A separate baseline run also failed the existing Bệnh/Lỗi test in MvpMasterScreens (button name `Bộ lọc tìm kiếm`).
- Full backend suite was attempted and interrupted after a prolonged run; focused SKU and Dashboard regressions are the verification scope.
- Deploy backend with information_status support before frontend. No schema/data migration is needed. Inbound SKU validation is unchanged.
