# WWHN-178 — FE Master/SKU/import closure package (R2)

- Task: **WWHN-178 — [FE1] Triển khai UI dữ liệu danh mục/SKU/import**
- Parent: **WWHN-39 — [FE] Màn hình dùng lại cho dữ liệu danh mục và SKU/item/code**
- QA2: **WWHN-179**
- Baseline dependency: **HN-MC-001 / WWHN-14 / WWHN-100 / WWHN-101**
- BE contract dependency: **WWHN-36 / WWHN-37 / WWHN-171**
- Repository/branch: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE@m1`
- Architecture reference: `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`
- Updated: **2026-08-20 (Asia/Bangkok) — R2**

## 0. Vì sao có R2

R1 (2026-08-06) bị **evidence rot** sau các refactor hợp lệ của những ticket đóng
sau đó (WWHN-330/331 mở import SKU chính thức; MasterPage.tsx cũ được thay bằng
`ApiMasterScreens.SkuMasterScreen` — MST-01):

1. QA2 pack R1 mô tả UI không còn tồn tại (tabs Item/Mã vật lý, nút "Import SKU
   cũ") → fail toàn bộ, không còn là bằng chứng.
2. Guard forbid call-site trong `verify-master-sku-closure.mjs` dùng regex
   một-dòng, Prettier xuống dòng sau `(` nên **không bao giờ match** — guard
   PASS trong khi `/skus/import-excel` đã được gọi thật (hợp lệ theo WWHN-331).
3. Bảng "capability được phép" R1 liệt kê `/uoms`, `/suppliers` — hai endpoint
   **ma**: BE có controller nhưng không có route/spec/bảng/seeder → gọi là 404.

R2 xử lý gốc rễ cả ba điểm; cơ chế gate đổi từ "hình dạng call-site" sang
"**path phải tồn tại trong OpenAPI đã pin**" nên refactor/format không thể làm
guard câm lặng.

Khi chạy lại QA2 pack đã viết mới tại đúng exact SHA để lấy evidence (bước bắt
buộc trước khi công bố PASS), phát hiện thêm **một bug thật, không phải lỗi
test**: `ApiMasterScreens.tsx` (chứa `SkuMasterScreen`/MST-01) tự định nghĩa
một component tên trùng `ApiErrorAlert` (chỉ là `<div>` + message + nút "Thử
lại"), che khuất hoàn toàn component dùng chung cùng tên đã được nâng cấp để
hiện `NoPermissionState` + error code + `request_id` khi 403. Kết quả thực tế
trên MST-01: lỗi 403 chỉ hiện message chung chung, không có mã lỗi lẫn
request_id — đúng thứ mà comment 14740 (P1 "Backend authorization chưa có
evidence live") đòi phải truy vết được. Đã xóa component cục bộ, chuyển sang
dùng component dùng chung, chạy lại đủ 8 gate + evidence tại đúng SHA cuối
cùng đã chạm code (`b9c7413`).

## 1. Kết luận chính xác

**FE-owned P0/P1/P2 controls: COMPLETE. Overall cross-functional acceptance:
BLOCKED_BY_INDEPENDENT_OWNER_GATES.**

FE **không tự nhận QA2 sign-off** và **không tự nhận/coi backend evidence là BE
sign-off**. WWHN-178/WWHN-39 không được kết luận đóng toàn luồng cho tới khi
QA2, BA/BAS và BE/QA xác nhận độc lập trên Jira.

Nguồn trạng thái machine-readable duy nhất:
`docs/evidence/wwhn-178/WWHN-178_CLOSURE_REGISTER.json` (schema 2.1.0).

## 2. Xử lý gốc rễ theo đánh giá Remove Flag (comment 14740)

| Sev | Vấn đề | Xử lý R2 | Evidence | Trạng thái |
| --- | --- | --- | --- | --- |
| P0 | Runtime endpoint chưa có contract | Gate PINNED_CONTRACT_PRESENCE: mọi capability master/SKU phải có path trong `swagger-api.json` (pin BE m1 `7da26cb`, sha256 `46cbfc01…`, verify bằng `check:api-mapping`). Import `/skus/import-*` đã CONTRACT_PINNED theo WWHN-330/331. Endpoint ma `/uoms`, `/suppliers` bị cấm tuyệt đối. | `scripts/verify-master-sku-closure.mjs`, `docs/api-evidence/BE_CONTRACT_PIN.json` | **FE PASS** |
| P1 | QA2 `WWHN-179` chưa PASS | Pack R2 viết lại theo UI hiện tại, chạy một lệnh tại exact SHA, tự sinh screenshot/video/trace/JSON | `e2e/wwhn-178-master-sku-qa2.spec.ts` | **EVIDENCED — chờ QA2 comment PASS/FAIL** |
| P1 | `HN-MC-001` chưa baseline | Xác minh 0-hit trong cả 4 tài liệu baseline; cập nhật proposal JSON kèm **divergenceRegister 8 điểm lệch** SRS↔ERD↔DevGuide↔wireframe làm checklist cho WWHN-14/100/101. FE không biến proposal thành baseline. | `docs/api-evidence/WWHN-178_MASTER_SKU_CONTRACT_BASELINE.json` | **PENDING BA/BAS (WWHN-14/100/101)** |
| P1 | BE contract còn mở | OpenAPI 2.0.0 đã publish + pin (BE m1 `7da26cb`, 183 paths/231 operations, HN-BE-API-003 permission matrix); FE `check:api-mapping` PASS trên pin | `BE_CONTRACT_PIN.json`, BE `HN-BE-API-003_ENDPOINT_PERMISSION_MATRIX.json` | **EVIDENCED — chờ BE1/BE2 comment xác nhận** |
| P1 | Backend authorization chưa có live evidence | Live direct API trên BE local (nginx `127.0.0.1:8080`, PostgreSQL 16): positive-control 200, permission-deny **403 `ACCESS_DENIED` + request_id**, data-scope **404 mask** (import-reports ACTOR_SCOPED — master-data là dữ liệu toàn cục theo thiết kế, SRS §13.8 cho phép mask) | `docs/evidence/wwhn-178/generated/<SOURCE_SHA>/rbac/` | **EVIDENCED — chờ BE/QA xác nhận fixture** |
| P1 | CI trace chưa chốt | **DEC-178-CI-LOCAL-01**: quota GitHub Actions 3000/3000 đã cạn → gate nghiệm thu chạy local tại exact SHA (tiền lệ DEC-325-CI-LOCAL-01), evidence pack + SHA256SUMS commit kèm; không run in_progress, không hard-code run ID | closure register `acceptancePolicy` | **FE PASS** |
| P2 | Parent closure matrix | Matrix cập nhật theo trạng thái Jira 2026-08-20; verify script bắt buộc đủ trường | closure register mục `parentClosureMatrix` | **FE PASS** |

## 3. Parent closure matrix — WWHN-39

| Issue | Owner | Status quan sát 2026-08-20 | Evidence hiện có | Remaining blocker | Closure decision |
| --- | --- | --- | --- | --- | --- |
| WWHN-178 | FE1 | `DONE REDFLAG` | contract-pin gate, QA2 pack R2, live RBAC evidence, closure register 2.1.0 | Sign-off comments của QA2/BA-BAS/BE | **FE complete; chưa close parent** |
| WWHN-179 | QA2 | `TO DO` | executable pack R2 + evidence tự sinh | QA2 chạy exact SHA, attach evidence, comment PASS/FAIL | **Pending owner** |
| WWHN-39 | FE1/Lead | `IN PROGRESS` | matrix này + WWHN-178 evidence | WWHN-179, HN-MC-001 (WWHN-14/100/101), BE contract sign-off | **NOT READY TO CLOSE** |

## 4. Contract boundary (R2)

### Capability CONTRACT_PINNED (được phép gọi)

Theo `swagger-api.json` pin BE m1 `7da26cb` (OpenAPI 2.0.0):

- `GET/POST /products`, `GET/PATCH /products/:id`, `PATCH /products/:id/enable|disable` — `sku.view`/`sku.manage`
- `GET /product-categories`, `/brands`, `/product-models`, `/power-sources`, `/package-variants` (catalog refs MST-02)
- `GET /skus/import-template`, `POST /skus/import-excel`, `GET /skus/import-reports[/:id][/error-file]` — `sku.manage` (WWHN-330/331)
- `GET /item-instances`, `GET /physical-codes` — pinned; MST-01 không gọi trực tiếp

### Capability bị cấm (phantom — BE không có route/spec)

| Path | Lý do |
| --- | --- |
| `GET /uoms` | Controller tồn tại nhưng không route/không spec/không bảng → 404 `RESOURCE_NOT_FOUND` |
| `GET /suppliers` | Như trên; supplier chỉ là cột text trên `import_batches` |

Không mở capability mới bằng thay đổi FE độc lập — điều kiện mở là path xuất
hiện trong spec pin mới (`npm run contract:sync -- <BE_SHA> --repin`).

## 5. QA2 WWHN-179 execution gate

```bash
SOURCE_SHA="$(git rev-parse HEAD)" \
VITE_APP_ENV="QA" \
VITE_APP_VERSION="<exact-build-id>" \
WWHN_178_EVIDENCE_DIR="docs/evidence/wwhn-178/generated/$(git rev-parse HEAD)/qa2" \
npx playwright test e2e/wwhn-178-master-sku-qa2.spec.ts --project=chromium
```

QA2 phải ghi browser/version, environment, exact source SHA, build ID,
timestamp và outcome PASS/FAIL. Evidence tối thiểu gồm screenshot, video, trace
và JSON cho desktop `1440x900`, tablet `768x1024`, mobile `375x812`; loading,
empty, success, 403 `ACCESS_DENIED`/request-id, validation, import modal theo
permission, view-only, route RBAC, contract boundary và overflow.

## 6. Backend authorization gate

Contract-only check:

```bash
SOURCE_SHA="$(git rev-parse HEAD)" WWHN_178_ENV="CI" \
node scripts/run-wwhn-178-direct-api-rbac.mjs --contract-only
```

Live permission/data-scope check (BE local hoặc QA):

```bash
SOURCE_SHA="$(git rev-parse HEAD)" \
WWHN_178_ENV="LOCAL_PG" \
WWHN_178_API_BASE_URL="http://127.0.0.1:8080/api/v1" \
WWHN_178_CONTROL_TOKEN="<sku.view-token>" \
WWHN_178_DENIED_TOKEN="<token-thiếu-sku.manage>" \
WWHN_178_DENIED_METHOD="POST" \
WWHN_178_DENIED_PATH="/products" \
WWHN_178_SCOPE_DENIED_TOKEN="<warehouse-scoped-sku.manage-token>" \
WWHN_178_SCOPE_DENIED_METHOD="GET" \
WWHN_178_SCOPE_DENIED_PATH="/skus/import-reports/<report-của-actor-khác>" \
WWHN_178_SCOPE_EXPECTED_STATUS="404" \
node scripts/run-wwhn-178-direct-api-rbac.mjs
```

Pass criteria: request trực tiếp API (không UI), positive control 200 chứng
minh server sống, **HTTP 403 + `ACCESS_DENIED` + request ID** cho permission
deny, **404 `RESOURCE_NOT_FOUND` mask** cho bản ghi ngoài data-scope
(ImportReportController ACTOR_SCOPED; master-data là dữ liệu toàn cục — không
có warehouse scope theo thiết kế), token redacted, fixture role/permission/scope
được BE/QA xác nhận. UI disabled không thay thế bằng chứng này.

## 7. Provenance nghiệm thu — DEC-178-CI-LOCAL-01

GitHub Actions quota 3000/3000 đã dùng hết và **cấm phát sinh thêm phí**, nên
rule CI `CURRENT_SUCCESSFUL_PUSH_RUN_FOR_EXACT_SOURCE_SHA` (R1) được thay bằng:

`LOCAL_EXACT_SHA_EVIDENCE_GATE` — theo tiền lệ **DEC-325-CI-LOCAL-01**:

1. Toàn bộ gate mục 8 chạy local tại exact commit trên `m1`.
2. Evidence pack ghi `sourceSha` = `executionSha` = exact SHA, kèm `SHA256SUMS`.
3. Run `30987735727` và `30987738397` chỉ là historical/superseded.
4. Không hard-code run ID; không dùng bất kỳ run `in_progress` nào làm nghiệm thu.
5. Khi quota CI được cấp lại, rule R1 tự động thay thế rule local cho các vòng sau.

Candidate commit của R2: **`b9c7413d4ea5c6f8745b92e8108abc08d0c0fbbe`**
(commit-cuối-chạm-artifact — commit `707841f` trước đó bị supersede vì bug
ApiErrorAlert-shadow lộ ra ngay khi chạy evidence tại SHA đó). Evidence pack:
`docs/evidence/wwhn-178/generated/b9c7413d4ea5c6f8745b92e8108abc08d0c0fbbe/`
(qa2/ = 10 kịch bản × screenshot+JSON; rbac/ = 3 probe live PASS + plan/summary;
`SHA256SUMS` ký 25 file).

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

- capability master/SKU trỏ tới path không có trong OpenAPI đã pin;
- src tham chiếu endpoint ma `/uoms` hoặc `/suppliers`;
- register không khớp `BE_CONTRACT_PIN.json` (chống register rot);
- owner gate bị tự chuyển sang trạng thái sign-off khi chưa có comment owner;
- thiếu hàng WWHN-178/WWHN-179/WWHN-39 hoặc thiếu trường trong parent matrix;
- task doc thiếu boundary QA2/BE, thiếu DEC-178-CI-LOCAL-01, hoặc khai hoàn tất tuyệt đối.

## 9. Definition of Done

FE-owned scope đạt COMPLETE khi exact commit trên `m1` có evidence pack local
exact-SHA (mục 7) với đủ 8 gate PASS.

Cross-functional acceptance chỉ đạt sau khi:

- WWHN-179 có QA2 PASS độc lập (chạy lại pack tại exact SHA);
- WWHN-14/100/101 baseline HN-MC-001 (field, enum, import rule, item/code/physical-code semantics — xử lý 8 divergences trong `WWHN-178_MASTER_SKU_CONTRACT_BASELINE.json`);
- WWHN-36/37/171 có comment BE1/BE2 xác nhận OpenAPI 2.0.0 pin `46cbfc01…` là contract chính thức;
- BE/QA xác nhận fixture của live authorization evidence;
- WWHN-39 matrix được Lead xác nhận không còn P0/P1 mở.
