# Import mode filter

User approved replacing the unusable SKU type filter on import history with **Chế độ nhập: Tất cả / Chạy thử / Ghi thật**, then committing/pushing to dev and deploying. User subsequently waived real-website UI testing. Use the existing UiSelect, styling and stored report mode. No backend/schema change is needed.

Work is isolated from origin/dev in the managed import-mode-filter worktree because the original checkout contains an unrelated, unpushed Dashboard commit.

1. Add failing model/UI regressions for mode filtering, rejected COMMIT reports, table/page reset, metrics, trend, clear and export mode/IDs.
2. Add an optional import mode criterion to the shared filter without changing reconciliation SKU type behavior. Replace the page selector and remove its unnecessary SKU catalog lookup. Include mode in export parameters. Localize the exact approved Vietnamese choices and English/Chinese equivalents.
3. Run the related tests, targeted lint and build/typecheck. Review, commit only scoped files, push HEAD to origin/dev and follow the deployment workflow to completion. Real-website UI testing is excluded at the user's request; pipeline/manifest checks establish deployment status.

Verification before commit: the new regressions failed for the missing mode selector and missing mode criterion, then all 33 tests in the 8 import-match test files passed after implementation. Targeted ESLint and diff whitespace checks passed. Independent read-only review found no actionable issues. Commit/push typecheck hooks and CI will verify the remaining build/deployment gates.
