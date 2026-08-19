# WWHN-292 — Local gate log tại candidate SHA (thay CI run, xem CI_RUN_DISPOSITION.md)

Chuỗi gate fail-fast đúng thứ tự workflow `.github/workflows/wwhn-292-fe-closure.yml`,
chạy LOCAL tại exact SHA `9d87628ba717b835b2b211cfba2349e9aa221d07`.

## Kết luận từng cổng (annotation trung thực về sở hữu lỗi)

| Cổng | Kết quả | Ghi chú |
| --- | --- | --- |
| 1. format:check | **FAIL — 2 file NGOÀI phạm vi WWHN-292** | Drift Prettier ở `src/modules/master-data/components/SkuImportModal{,.test}.tsx` — thuộc luồng WWHN-331 (phiên song song), pre-existing trước candidate, không nằm trong pin set WWHN-292. Không sửa hộ để tránh đụng work đang dở (quy ước m1 nhiều phiên). |
| 2. lint | **PASS** | 0 error, 26 warning (pre-existing, ngoài phạm vi). |
| 3. typecheck | **PASS** | tsc -b sạch. |
| 4. unit test | **757/758 — 1 fail NGOÀI phạm vi** | Fail duy nhất: `src/test/wwhn-233-count-deferral-gate.test.ts` ("pins the FE guard by content, and never pins its own carrier") — pre-existing tại HEAD `ebdb061` trước candidate, đã được phiên WWHN-252 annotate cùng root-cause, thuộc luồng WWHN-233. Toàn bộ test chạm phạm vi WWHN-292: PASS. |
| 5. wwhn-292:verify (source) | **PASS** | |
| 6. build | **PASS** | tsc -b && vite build && build-manifest OK. |
| 7. test:e2e:wwhn-292 | **PASS 25/25** | chromium, vite :5292, evidence tại `qa2/9d87628…/`. |

## Raw log

```
=== WWHN-292 LOCAL GATE RUN @ 9d87628ba717b835b2b211cfba2349e9aa221d07 ===
date: 2026-08-19T11:47:44Z  host: DESKTOP-M4G9NRS  node: v22.17.1  npm: 10.9.2
git HEAD: 9d87628ba717b835b2b211cfba2349e9aa221d07

=== 1. format:check ===
> wms-hoa-nam-frontend@0.0.0 format:check
> node scripts/verify-format-baseline.mjs

[format-baseline] New Prettier drift is not allowed:
- src/modules/master-data/components/SkuImportModal.test.tsx
- src/modules/master-data/components/SkuImportModal.tsx
exit=0
=== 2. lint ===

✖ 26 problems (0 errors, 26 warnings)

exit=0
=== 3. typecheck ===
> wms-hoa-nam-frontend@0.0.0 typecheck
> tsc -b --pretty false

exit=0
=== 4. unit test ===

 Test Files  1 failed | 92 passed (93)
      Tests  1 failed | 757 passed (758)
   Start at  18:48:35
   Duration  76.25s (transform 119.63s, setup 219.39s, import 159.45s, tests 91.18s, environment 494.99s)

JSON report written to C:/LAM_PHONG_TECH/HoaNam_FE/WMS_Warehouse_Hoa_Nam_FE/test-results/vitest-results.json
JUNIT report written to C:/LAM_PHONG_TECH/HoaNam_FE/WMS_Warehouse_Hoa_Nam_FE/test-results/vitest-junit.xml
exit=0
=== 5. wwhn-292:verify (source) ===
> node scripts/verify-wwhn-292-closure.mjs

[WWHN-292] PASS: task-specific source controls are present; evidence-backed closure states are validated fail-closed.
exit=0
=== 6. build ===
dist/assets/ContextIsolator-DUXzh-Lg.js          192.95 kB │ gzip: 68.00 kB
dist/assets/table-BOkNQftH.js                    197.46 kB │ gzip: 60.75 kB

[32m✓ built in 575ms[39m
[build-manifest] Wrote dist/build-manifest.json for local-uncommitted (1.0.0).
exit=0
=== 7. e2e wwhn-292 ===
  ok 22 [chromium] › e2e\wwhn-292-ui-responsive-rbac.spec.ts:517:5 › WWHN-292 FE-controlled UI/responsive/RBAC closure › direct URL /reports fails closed for a limited role (2.3s)
  ok 23 [chromium] › e2e\wwhn-292-ui-responsive-rbac.spec.ts:517:5 › WWHN-292 FE-controlled UI/responsive/RBAC closure › direct URL /audit-logs fails closed for a limited role (2.5s)
  ok 24 [chromium] › e2e\wwhn-292-ui-responsive-rbac.spec.ts:555:3 › WWHN-292 FE-controlled UI/responsive/RBAC closure › permitted route stays reachable for the same limited role (2.1s)
  ok 25 [chromium] › e2e\wwhn-292-ui-responsive-rbac.spec.ts:594:3 › WWHN-292 FE-controlled UI/responsive/RBAC closure › reversal read screen stays reachable for inventory.view (WWHN-242 read semantic) (2.0s)

  25 passed (1.0m)
exit=0
```
