# WWHN-237 — nửa FE (variance query/report DEFERRED)

Disposition đầy đủ nằm ở repo BE: `docs/decision-records/DISP-STK-237-VARIANCE-REPORT-DEFERRED.md`.
Tài liệu này chỉ ghi phần FE để FE1/QA1 không phải mở hai repo mới hiểu được phạm vi.

## Kiểm soát

- Jira: `WWHN-237` (child of `WWHN-60`; QA gate `WWHN-238`).
- Branch: `m1`. Baseline điều khiển: `docs/HN_SRS_FRD_v1.12_FULL.md` — `REQ-SRS-037` (Must, adopt tại `WWHN-334`).
- Gate: `npm run wwhn-237:verify` · `npx vitest run src/test/wwhn-237-variance-report-guard.test.ts`.
- Identity: `docs/evidence/WWHN-237/FE_CLOSURE_IDENTITY.json`.
- Status: `PROPOSED` — chờ approver ghi disposition trên Jira.

## Lỗi thật ở phía FE

Trước task này FE **không** có route/permission/menu kiểm kê (`WWHN-230` đã khoá). Nhưng
**hợp đồng** thì vẫn khai capability bị cấm, và không guard nào bắt được vì nó nằm trong file
hợp đồng chứ không trong source runtime:

| # | File | Hiện trạng trước | Sau |
|---|---|---|---|
| 1 | `docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json` | criticalFlow `APPLY_ADJUSTMENT` → `POST /stocktake-sessions/:sessionId/apply-adjustment`, permission `stocktake.adjust`, `feDisposition: IMPLEMENTED_EXACT_V1_7_SESSION_VERSION_CAS` — tức FE tuyên bố **đã implement** capability mà `REQ-SRS-037` cấm | Gỡ criticalFlow; thêm khối `removedFromMvp` neo `REQ-SRS-037` / `WWHN-237` |
| 2 | cùng file, `SCAN_CLASSIFY.requestConstraints.context` | `["INBOUND","OUTBOUND","STOCKTAKE","WARRANTY_TEMP_ONLY"]` — thừa một giá trị runtime trả `422`, thiếu ba giá trị đang phục vụ | `["INBOUND","OUTBOUND","INVENTORY","TRACE","WARRANTY_RECEIVE","WARRANTY_TEMP_ONLY"]` khớp `ScanController@classify` |
| 3 | `src/styles/hn-wms-page-normalize.css` | Selector chết `.hn-mvp-screen > .stocktake-page` | Gỡ |
| 4 | `src/shared/hooks/usePermission.ts` | Doc-comment mô tả `stocktake.manage` / `stocktake.adjust` như quyền đang tồn tại | Viết lại theo `REQ-SRS-037`, giữ nguyên hành vi hàm |

## Thay đổi trong task

- `docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json` — mục 1 + 2 ở trên.
- `docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json` — thêm `scopeDisposition` (Option A, effective date theo mốc `WWHN-334` → DONE, affected ticket, cổng tái mở).
- `scripts/verify-wwhn-237-closure.mjs` (mới, 17 check) + `package.json` script `wwhn-237:verify`.
- `src/test/wwhn-237-variance-report-guard.test.ts` (mới, 6 test).
- `src/styles/hn-wms-page-normalize.css`, `src/shared/hooks/usePermission.ts` — mục 3 + 4.
- `.github/workflows/ci.yml` + `scripts/assert-ci-gates.mjs` — gắn gate `wwhn_237` vào bộ enforce.

Zero thay đổi route, permission, menu, màn hình hay report code.

## Ranh giới

`variance` của **reconciliation** (balance vs ledger) là hợp lệ và phải giữ — `AC-SRS-037` chỉ
định đó là cơ chế thay thế. Chỉ `variance` của **kiểm kê** (đếm tay vs hệ thống) mới bị cấm. Vì
vậy danh sách mảnh cấm trong guard FE **không** chứa chữ `variance` trần.

`docs/api-evidence/M1_API_MAPPING.md` và `M3_DEPENDENCY_LIST.md` đã có sẵn khối
"Removed-from-MVP boundary — Stocktake" từ `WWHN-296`; task này không sửa hai file đó, chỉ bổ sung
phần `scopeDisposition` mà chúng trỏ tới.

## Điều kiện mở lại

Đúng bộ 4 điều kiện tại `DISP-STK-237 §2` (BE). Trước đó `npm run wwhn-237:verify` fail-closed.
