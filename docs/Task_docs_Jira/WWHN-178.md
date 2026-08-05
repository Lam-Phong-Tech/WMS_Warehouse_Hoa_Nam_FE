# WWHN-178 — FE Master/SKU/import closure package

- Task: **WWHN-178 — [FE1] Triển khai UI dữ liệu danh mục/SKU/import**
- Parent: **WWHN-39 — [FE] Màn hình dùng lại cho dữ liệu danh mục và SKU/item/code**
- QA2: **WWHN-179**
- Baseline dependency: **HN-MC-001 / WWHN-14 / WWHN-100 / WWHN-101**
- BE contract dependency: **WWHN-36 / WWHN-37 / WWHN-171**
- Repository: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`
- Branch: `m1`
- Architecture reference: `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`
- Updated: **2026-08-05 (Asia/Bangkok)**

## 1. Kết luận xử lý

**FE-owned P0/P1/P2 closure: 100% implemented and machine-verifiable.**

Không còn P0 thuộc phạm vi FE: mọi capability chưa có contract chính thức đều bị chặn trước HTTP bằng contract registry và typed fail-closed error.

Các gate cần chữ ký độc lập của BA/BAS, BE và QA2 đã được chuyển thành test pack, evidence schema và lệnh thực thi cụ thể. FE **không tự nhận QA2 sign-off** và **không tự nhận/coi backend evidence là BE sign-off** khi chưa có kết quả chạy trên đúng environment/build/SHA.

## 2. Đối chiếu Techstack/Architecture Guide

| Nguyên tắc | Cách áp dụng |
| --- | --- |
| Module-based architecture | Contract của Master Data đặt tại `src/modules/master-data/contracts/`. |
| API-first | Chỉ các path đã publish được bật; `/items`, `/physical-codes`, `/skus/import-excel` fail-closed. |
| Shared HTTP client | Capability approved tiếp tục gọi qua `src/shared/api/http.ts`; không có axios/fetch trực tiếp trong service. |
| RBAC theo permission code | Route/action dùng `sku.manage` hoặc `master.manage`; direct API evidence tách khỏi UI guard. |
| Type safety | Contract registry, capability, status và typed error được khai báo TypeScript. |
| Testing | Unit/Vitest cho contract gate; Playwright cho UI/validation/responsive/RBAC/error. |
| Error handling | Typed code `WMS_FE_CONTRACT_NOT_APPROVED`; API 403 UI hiển thị HTTP status, error code và request ID. |
| CI/evidence trace | Test metadata dùng `SOURCE_SHA`, environment, build version, browser, viewport và timestamp. |

## 3. Closure matrix theo đánh giá 80/100

| Sev | Vấn đề đánh giá | Xử lý gốc rễ | Evidence / gate | Trạng thái |
| --- | --- | --- | --- | --- |
| P0 | Endpoint chưa có contract có thể bị gọi runtime | Central contract registry + `assertMasterDataContractApproved()` trước HTTP; typed error; unit test xác nhận không mở capability ngoài contract | `master-data.contract.ts`, `master-data.contract.test.ts`, `master-data.service.test.ts` | **FE COMPLETE** |
| P1 | QA2 WWHN-179 chưa test | Test pack deterministic cho success/loading/empty/403/validation/disabled/item-code blocker/RBAC/3 viewport/keyboard; screenshot, video, trace, metadata | `e2e/wwhn-178-master-sku-qa2.spec.ts` | **READY FOR QA2; independent execution required** |
| P1 | HN-MC-001 chưa baseline | Machine-readable proposal khóa field/enum/import/item/code semantics và danh sách open point; không biến proposal FE thành BA baseline | `docs/api-evidence/WWHN-178_MASTER_SKU_CONTRACT_BASELINE.json` | **FE PREPARED; WWHN-14/100/101 sign-off required** |
| P1 | BE contract còn mở | Capability matrix chỉ bật path đã publish; item/code/import vẫn disabled tới khi OpenAPI/Postman/payload/error/permission/sample data được khóa | Contract registry + baseline JSON | **FE FAIL-CLOSED; WWHN-36/37/171 sign-off required** |
| P1 | Backend authorization chưa có evidence độc lập | Direct API runner không qua browser, bắt buộc HTTP 403, kiểm tra deny code, request ID, data-scope probe và redaction token | `scripts/run-wwhn-178-direct-api-rbac.mjs` | **READY FOR BE/QA LIVE EXECUTION** |
| P1 | PR/CI trace chưa đủ | Theo chỉ đạo thực hiện trực tiếp `m1`, không tạo branch/PR riêng. Trace chuẩn là single commit + push workflow run + immutable artifact. Exact SHA được GitHub sinh sau commit và được ghi vào Jira/CI artifact, không hard-code self-SHA trong chính commit | Git commit, Actions run, evidence metadata | **COMPLETED AFTER PUSH/CI** |
| P2 | UI evidence thiếu | Bộ scenario bao phủ loading, empty, error, success, disabled, validation, responsive, accessibility/keyboard và RBAC | Playwright screenshots/video/trace/JSON | **FE PACK COMPLETE; QA2 capture required** |

## 4. Contract capability registry

### 4.1 Capability được bật

| Capability | Method/path | Permission |
| --- | --- | --- |
| Product list | `GET /products` | `sku.manage` hoặc `master.manage` |
| Product create | `POST /products` | `sku.manage` hoặc `master.manage` |
| Product status | `PATCH /products/:id/enable` hoặc `/disable` | `sku.manage` hoặc `master.manage` |
| Product category | `GET/POST /product-categories` | Backend RBAC / `master.manage` |
| UOM reference | `GET /uoms` | Route/action context |
| Supplier reference | `GET /suppliers` | Route/action context |

### 4.2 Capability bị khóa

| Capability | Path | Điều kiện bắt buộc để mở |
| --- | --- | --- |
| Item list | `GET /items` | WWHN-14/100/101 baseline + WWHN-36/37/171 OpenAPI/Postman + permission/error/sample data + QA2 |
| Physical code list | `GET /physical-codes` | Code identity/type/carrier/duplicate/cardinality baseline + official contract + QA2 |
| SKU import | `POST /skus/import-excel` | File/multipart schema, column dictionary, enum, duplicate/upsert, atomicity/partial-write, row error, permission/data-scope/audit, sample 403/409/413/415/422 |

**Quy tắc:** không đổi `approved: false` thành `true` chỉ bằng sửa FE. Mọi lần gỡ khóa phải kèm exact OpenAPI/Postman version/hash, Jira owner sign-off và test cập nhật trong cùng change set.

## 5. Field/enum/import semantics cần owner chốt

### Product/SKU

- `id`: backend-generated immutable identifier.
- `product_code`: business SKU/product code; required; uniqueness scope do BA/BE chốt.
- `barcode`: optional; generation và uniqueness do backend chốt.
- Required create fields hiện tại: `product_code`, `name`, `uom_id`, `list_price_net`, `vat_rate`, `status`.
- Status UI hiện tại: `active`, `inactive`, `discontinued`.
- VAT UI hiện tại: `0`, `5`, `8`, `10`.
- BE cần publish validation code và sample `409/422`.

### Item

Item là inventory instance/traceable unit liên kết SKU/product; **không đồng nghĩa** với `product_code`. Cần chốt identity generation, serial/lot matrix, warehouse/data-scope và lifecycle enum.

### Physical Code

Physical code là scannable carrier code ánh xạ item hoặc SKU; **không đồng nghĩa** với SKU business code. Cần chốt `code_type`, duplicate resolution, carrier semantics, cardinality và lifecycle.

### Import

Import tiếp tục disabled tới khi có đủ: endpoint/multipart field, file type/encoding/size/row limit, column dictionary, required field/enum, duplicate/upsert, transaction atomicity hoặc partial-write, row error schema, permission/data-scope/audit và sample response.

## 6. Automated tests

### Unit/contract

```bash
npm run test -- src/modules/master-data/contracts/master-data.contract.test.ts
npm run test -- src/modules/master-data/services/master-data.service.test.ts
npm run master-sku:verify
```

Expected:

- Approved capabilities pass.
- `ITEM_LIST`, `PHYSICAL_CODE_LIST`, `SKU_IMPORT` throw `WMS_FE_CONTRACT_NOT_APPROVED`.
- Không có HTTP call cho path chưa approved.
- Canonical Product/SKU mapping vẫn là `/products`.

### QA2 UI evidence

```bash
SOURCE_SHA="$(git rev-parse HEAD)" \
VITE_APP_ENV="QA" \
VITE_APP_VERSION="<build-id>" \
WWHN_178_EVIDENCE_DIR="test-results/wwhn-178/$(git rev-parse HEAD)" \
npx playwright test e2e/wwhn-178-master-sku-qa2.spec.ts --project=chromium
```

Checklist thực thi QA2:

1. Chạy trên exact commit SHA, exact build ID, named environment và browser version.
2. Giữ screenshot/video/trace/JSON cho từng scenario.
3. Xác nhận desktop `1440x900`, tablet `768x1024`, mobile `375x812`.
4. Xác nhận loading, empty, success, 403, validation, disabled import, item/code blocker.
5. Xác nhận keyboard focus, named dialog, no horizontal overflow.
6. Comment **PASS/FAIL** vào WWHN-179 và attach/link artifact.
7. Nếu dùng live backend, không thay controlled FE suite bằng screenshot thủ công; chạy cả controlled và live smoke.

## 7. Backend authorization evidence

### Contract-only validation, không cần secret

```bash
SOURCE_SHA="$(git rev-parse HEAD)" \
WWHN_178_ENV="CI" \
node scripts/run-wwhn-178-direct-api-rbac.mjs --contract-only
```

### Live direct API permission deny

```bash
SOURCE_SHA="$(git rev-parse HEAD)" \
WWHN_178_ENV="QA" \
WWHN_178_API_BASE_URL="https://<qa-api>/api/v1" \
WWHN_178_DENIED_TOKEN="<token-role-khong-co-quyen-master>" \
WWHN_178_DENIED_METHOD="POST" \
WWHN_178_DENIED_PATH="/products" \
node scripts/run-wwhn-178-direct-api-rbac.mjs
```

### Live data-scope deny

Bổ sung:

```bash
WWHN_178_SCOPE_DENIED_TOKEN="<token-co-quyen-nhung-ngoai-scope>" \
WWHN_178_SCOPE_DENIED_METHOD="GET" \
WWHN_178_SCOPE_DENIED_PATH="/products?warehouse_id=<outside-scope>"
```

Pass criteria:

- Request gọi trực tiếp API, không qua UI.
- HTTP status bắt buộc `403`.
- `error_code` thuộc deny catalog khi backend trả code.
- Có request ID.
- Token bị redacted trong artifact.
- Evidence ghi exact SHA/environment/timestamp.
- BE/QA xác nhận role, permission catalog và scope fixture của token.

## 8. Trace PR / CI

Theo yêu cầu **chỉ sửa trực tiếp nhánh `m1`, không tạo nhánh riêng**, PR URL được disposition là **N/A by delivery instruction**, không được tạo PR giả để lấp checklist.

Trace bắt buộc sau push:

- Repository/branch: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE@m1`.
- Single commit message bằng tiếng Việt.
- Exact commit URL/SHA: ghi tại Jira comment WWHN-178 sau commit.
- Workflow run URL/build ID/environment: ghi tại Jira comment sau Actions run.
- Log/artifact: lint, typecheck, unit, build, health, API mapping, Master/SKU closure và Playwright evidence.
- Nếu GitHub Actions không tạo run, ghi rõ infrastructure limitation; không claim CI pass bằng log tự ghi.

Exact SHA không thể tự chứa trong file thuộc chính commit vì tạo vòng tham chiếu hash. Vì vậy SHA được ghi trong Jira comment và artifact runtime qua `SOURCE_SHA/GITHUB_SHA`.

## 9. Evidence file naming

```text
WWHN-178__<scenario>__<viewport>.png
WWHN-178__<scenario>__<viewport>.json
WWHN-178_DIRECT_API_RBAC_PLAN.json
permission-deny.json
data-scope-deny.json
WWHN-178_DIRECT_API_RBAC_SUMMARY.json
```

Metadata tối thiểu: task, QA task, result, source SHA, environment, build version, browser/project, viewport, role/scenario, route/URL, timestamp, assertions, screenshot/video/trace policy và evidence boundary.

## 10. Owner sign-off boundary

### FE1 đã hoàn tất

- Runtime contract gate và typed error.
- Canonical product mapping không regression.
- Unit test cho approved/blocked capability.
- QA2 executable pack.
- Direct API RBAC/data-scope runner.
- Machine-readable baseline/open-point register.
- Jira closure document và trace rules.

### Không được FE tự nhận

- WWHN-14/100/101 BA/BAS baseline approval.
- WWHN-36/37/171 official OpenAPI/Postman approval.
- Backend 403/data-scope pass trước khi live artifact tồn tại.
- WWHN-179 QA2 pass trước khi QA2 chạy đúng build/env/browser.
- CI pass khi chưa có GitHub Actions run/log.

## 11. Definition of Done

WWHN-178 có thể được đánh giá **FE scope 100%** khi single commit đã push và quality gates pass.

Parent/cross-functional acceptance chỉ đạt **100% toàn luồng** sau khi:

- BA/BAS chốt HN-MC-001 tại WWHN-14/100/101.
- BE1/BE2 khóa OpenAPI/Postman tại WWHN-36/37/171.
- BE/QA attach live direct API 403 + data-scope evidence.
- QA2 chạy WWHN-179 và comment PASS trên exact build/SHA.
- Jira chứa commit URL, workflow run/build ID, environment và artifact links.
