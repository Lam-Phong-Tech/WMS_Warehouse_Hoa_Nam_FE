# WWHN-178 — FE Master/SKU/import closure package

- Task: **WWHN-178 — [FE1] Triển khai UI dữ liệu danh mục/SKU/import**
- Parent: **WWHN-39 — [FE] Màn hình dùng lại cho dữ liệu danh mục và SKU/item/code**
- QA2: **WWHN-179**
- Baseline dependency: **HN-MC-001 / WWHN-14 / WWHN-100 / WWHN-101**
- BE contract dependency: **WWHN-36 / WWHN-37 / WWHN-171**
- Repository/branch: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE@m1`
- Architecture reference: `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`
- Updated: **2026-08-06 (Asia/Bangkok)**

## 1. Kết luận chính xác

**FE-owned P0/P1/P2 controls: COMPLETE. Overall cross-functional acceptance: BLOCKED_BY_INDEPENDENT_OWNER_GATES.**

Không còn P0 trực tiếp phía FE. `/items`, `/physical-codes` và `/skus/import-excel` bị chặn bằng typed contract gate trước HTTP. FE không tự mở endpoint chỉ vì UI đã tồn tại.

FE **không tự nhận QA2 sign-off** và **không tự nhận/coi backend evidence là BE sign-off**. WWHN-178/WWHN-39 không được kết luận đóng toàn luồng cho tới khi QA2, BA/BAS và BE/QA cung cấp evidence độc lập.

Nguồn trạng thái machine-readable duy nhất:

`docs/evidence/wwhn-178/WWHN-178_CLOSURE_REGISTER.json`

## 2. Xử lý gốc rễ theo đánh giá Remove Flag

| Sev | Vấn đề | Xử lý trong FE | Evidence | Trạng thái nghiệm thu |
| --- | --- | --- | --- | --- |
| P0 | Runtime endpoint chưa có contract | Central registry + `assertMasterDataContractApproved()` + typed error `WMS_FE_CONTRACT_NOT_APPROVED`; unit test buộc không phát sinh HTTP | `master-data.contract.ts`, contract/service tests | **FE PASS** |
| P1 | QA2 WWHN-179 chưa PASS | Cung cấp deterministic Playwright pack cho loading/empty/success/403/validation/RBAC/keyboard và 3 viewport; không giả lập chữ ký QA2 | `e2e/wwhn-178-master-sku-qa2.spec.ts` | **PENDING QA2** |
| P1 | HN-MC-001 chưa baseline | Ghi proposal/open points dạng JSON; FE không biến proposal thành baseline | `docs/api-evidence/WWHN-178_MASTER_SKU_CONTRACT_BASELINE.json` | **PENDING WWHN-14/100/101** |
| P1 | BE contract còn mở | Item/physical-code/import vẫn `approved:false`; chỉ mở bằng exact OpenAPI/Postman version/hash + payload/error/permission/sample data | contract registry | **PENDING WWHN-36/37/171** |
| P1 | Backend authorization chưa có evidence live | Có direct API runner tách khỏi UI; contract-only CI không được coi là live proof | `scripts/run-wwhn-178-direct-api-rbac.mjs` | **PENDING BE+QA LIVE RUN** |
| P1 | CI trace không đồng bộ | Loại bỏ hard-coded acceptance run. Run nghiệm thu được chọn theo rule `CURRENT_SUCCESSFUL_PUSH_RUN_FOR_EXACT_SOURCE_SHA`; hai run `30987735727` và `30987738397` chỉ là historical/superseded | closure register + current workflow metadata | **FE PASS; current run required** |
| P2 | Parent closure matrix thiếu | Thêm matrix subtask → status → evidence → owner → blocker; CI kiểm tra bắt buộc đủ trường | closure register, mục 3 | **FE PASS** |

## 3. Parent closure matrix — WWHN-39

| Issue | Owner | Status quan sát 2026-08-06 | Evidence hiện có | Remaining blocker | Closure decision |
| --- | --- | --- | --- | --- | --- |
| WWHN-178 | FE1 | `IN PROGRESS REDF` | contract gate, unit tests, QA2 pack, direct API runner, closure register | Independent BA/BE/QA gates | **FE complete; chưa close parent** |
| WWHN-179 | QA2 | `TO DO` | executable pack sẵn sàng | QA2 phải chạy exact SHA/build/browser/env, attach screenshot/video/trace, comment PASS/FAIL | **Pending owner** |
| WWHN-39 | FE1/Lead | `IN PROGRESS` | matrix này + WWHN-178 evidence | WWHN-179, HN-MC-001, BE official contract, live authorization | **NOT READY TO CLOSE** |

Parent chỉ được chuyển trạng thái đóng khi mọi hàng bắt buộc có owner outcome và không còn P0/P1 chưa disposition.

## 4. Contract boundary

### Capability được phép gọi

- `GET/POST /products`
- `PATCH /products/:id/enable` hoặc `/disable`
- `GET/POST /product-categories`
- `GET /uoms`
- `GET /suppliers`

Tất cả request đi qua `src/shared/api/http.ts`; route/action dùng `sku.manage` hoặc `master.manage`.

### Capability bắt buộc fail-closed

| Capability | Path | Điều kiện để mở |
| --- | --- | --- |
| Item list | `GET /items` | BA/BAS item semantics + official BE contract + QA2 |
| Physical code list | `GET /physical-codes` | physical-code identity/type/carrier/cardinality/duplicate semantics + official BE contract + QA2 |
| SKU import | `POST /skus/import-excel` | multipart/file schema, column dictionary, enum, duplicate/upsert, atomicity, row error, permission/data-scope/audit, sample errors |

Không đổi `approved:false` thành `true` bằng thay đổi FE độc lập.

## 5. QA2 WWHN-179 execution gate

```bash
SOURCE_SHA="$(git rev-parse HEAD)" \
VITE_APP_ENV="QA" \
VITE_APP_VERSION="<exact-build-id>" \
WWHN_178_EVIDENCE_DIR="test-results/wwhn-178/$(git rev-parse HEAD)" \
npx playwright test e2e/wwhn-178-master-sku-qa2.spec.ts --project=chromium
```

QA2 phải ghi browser/version, environment, exact source SHA, build ID, timestamp và outcome PASS/FAIL. Evidence tối thiểu gồm screenshot, video, trace và JSON cho desktop `1440x900`, tablet `768x1024`, mobile `375x812`; loading, empty, success, 403/request-id, validation, disabled import, item/code blocker, keyboard/focus và overflow.

## 6. Backend authorization gate

Contract-only check:

```bash
SOURCE_SHA="$(git rev-parse HEAD)" WWHN_178_ENV="CI" \
node scripts/run-wwhn-178-direct-api-rbac.mjs --contract-only
```

Live permission/data-scope check:

```bash
SOURCE_SHA="$(git rev-parse HEAD)" \
WWHN_178_ENV="QA" \
WWHN_178_API_BASE_URL="https://<qa-api>/api/v1" \
WWHN_178_DENIED_TOKEN="<denied-role-token>" \
WWHN_178_DENIED_METHOD="POST" \
WWHN_178_DENIED_PATH="/products" \
WWHN_178_SCOPE_DENIED_TOKEN="<outside-scope-token>" \
WWHN_178_SCOPE_DENIED_METHOD="GET" \
WWHN_178_SCOPE_DENIED_PATH="/products?warehouse_id=<outside-scope>" \
node scripts/run-wwhn-178-direct-api-rbac.mjs
```

Pass criteria: request trực tiếp API, HTTP 403, deny code nếu contract quy định, request ID, token redacted, role/permission/scope fixture được BE/QA xác nhận. UI disabled không thay thế bằng chứng này.

## 7. CI provenance — một nguồn nghiệm thu

Do chỉ sửa trực tiếp `m1`, PR riêng là N/A theo delivery instruction. Exact commit SHA không thể tự ghi trong chính commit vì tạo vòng hash.

Rule bắt buộc:

`CURRENT_SUCCESSFUL_PUSH_RUN_FOR_EXACT_SOURCE_SHA`

Run/artifact được dùng nghiệm thu phải đồng thời thỏa:

1. Event là push vào `refs/heads/m1`.
2. `head_sha`/`SOURCE_SHA` bằng exact commit đang review.
3. Workflow conclusion là `success`.
4. Artifact tên `wms-fe-closure-evidence-<SOURCE_SHA>` thuộc chính run đó.
5. Jira chỉ ghi đúng một run/artifact final; run cũ được đánh dấu superseded.

Run `30987735727` và `30987738397` không còn là acceptance pointer cho commit mới. Chúng chỉ là historical evidence.

## 8. Automated enforcement

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run master-sku:verify
npm run build
npm run check:api-mapping
npm run test:e2e:wwhn-178
```

`master-sku:verify` fail khi:

- endpoint chưa approved có thể phát sinh HTTP;
- task doc khai overall 100% khi owner gates còn pending;
- hard-code một run ID làm acceptance source;
- thiếu QA2/BA/BE/live authorization gate;
- thiếu hàng WWHN-178, WWHN-179 hoặc WWHN-39 trong parent matrix;
- status/evidence/owner/blocker của matrix không đầy đủ.

## 9. Definition of Done

FE-owned scope đạt COMPLETE khi exact commit trên `m1` có current successful push run và artifact đúng SHA.

Cross-functional acceptance chỉ đạt sau khi:

- WWHN-179 có QA2 PASS độc lập;
- WWHN-14/100/101 baseline field, enum, import rule, item/code/physical-code semantics;
- WWHN-36/37/171 khóa official OpenAPI/Postman/payload/error/permission/sample data;
- BE/QA có live direct API 403, permission deny và data-scope deny evidence;
- WWHN-39 matrix được Lead xác nhận không còn P0/P1 mở.
