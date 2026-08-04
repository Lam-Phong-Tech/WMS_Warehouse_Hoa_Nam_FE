# WWHN-181 — FE1 Xác minh ánh xạ / payload / lỗi

## 1. Trạng thái kiểm soát

| Trường | Giá trị |
| --- | --- |
| Task | WWHN-181 |
| Parent | WWHN-40 — HN-INT-001 |
| Dependency | HN-INT-001-ST01 |
| Branch bắt buộc | `m1` |
| Kết quả FE implementation | **Đã hoàn tất code guard, regression test, CI verifier và evidence template** |
| Final FE sign-off | **CONDITIONAL PASS — NOT FINAL** |
| Lý do chưa final | WWHN-180, WWHN-182 và WWHN-183 là bằng chứng độc lập của BE1/BA, QA2 và BA G1; FE1 không được tự ký thay. |
| Final gate | `FE-FINAL-SIGNOFF` fail-closed |
| Contract evidence token | `BE-CONFIRMATION-EVIDENCE` |
| Cross-role gate token | `QA-BA-GATES` |
| Runtime evidence token | `RUNTIME-EVIDENCE` |

Tài liệu này xác nhận phạm vi FE đã được xử lý sâu tới code/service/test/CI.
Nó không biến các task bên ngoài thành Done và không ghi một final sign-off giả.

## 2. Closure matrix P0 / P1 / P2

| ID | Sev | Required fix | Xử lý trong FE | Evidence | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| FE1-P0-01 | P0 | Chỉ final sau BE contract, QA2 và BA G1 | Tách `WMS_FE_IMPLEMENTATION_READINESS` khỏi `WMS_FINAL_SIGNOFF`; `finalAllowed=false`; test bắt buộc final gate phải throw. | `src/shared/api/wms-contract-signoff.ts`; `src/test/wms-contract-signoff-guards.test.ts` | **FE closed; final external gate pending** |
| FE1-P0-02 | P0 | Khóa endpoint/payload/error/permission/idempotency/sample | Tạo baseline machine-readable; khóa 4 critical flows; validate Scan payload/response; receipt/issue/adjustment bắt buộc `Idempotency-Key` + `If-Match`; endpoint chưa duyệt fail-closed. | `docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json`; service tests; CI artifact | **FE contract guard closed; WWHN-180 pending independent sign-off** |
| FE1-P1-01 | P1 | Canonical Scan path | Constant đổi thành `/scan/classify`; base URL đã có `/api/v1`, nên effective runtime URL là `POST /api/v1/scan/classify`; test cấm lặp prefix. | `endpoints.ts`; `scanService.ts`; regression test | **Closed** |
| FE1-P1-02 | P1 | Runtime permission mapping | Route chỉ là entry gate; action riêng cho `stocktake.adjust`, `warranty.temp_only`, `report.export`, `scan.inbound/outbound/warranty`; alias cũ chuẩn hóa có whitelist, không nâng quyền rộng. TEMP_ONLY bị chặn trước network khi thiếu quyền. | `wms-permissions.ts`; `permission.ts`; `access.ts`; `warrantyService.ts` | **Closed phía FE; Backend authorization evidence pending** |
| FE1-P1-03 | P1 | Dashboard/Reports canonical disposition | Dashboard quick, XNT và XNT export được ghi mapping; `/reports/hub` và `/reports/warranty-defects` bị fail-closed trước network tới khi BE/BA chốt. | `reportsService.ts`; `M1_API_MAPPING.md`; baseline JSON | **Closed bằng disposition rõ ràng** |
| FE1-P1-04 | P1 | QA2 chạy trên commit/build/env cụ thể | Cung cấp checklist happy/negative/RBAC/idempotency/retry/responsive và mẫu runtime evidence. | `RUNTIME_EVIDENCE_TEMPLATE.md`; CI artifact | **Prepared; WWHN-182 pending QA2 execution** |
| FE1-P1-05 | P1 | BA G1 decision | Final gate yêu cầu BA ghi Go / Conditional Go / No-Go và disposition các điểm FE-SO. | Tài liệu này; `WMS_EXTERNAL_GATES` | **Prepared; WWHN-183 pending BA decision** |
| FE1-P2-01 | P2 | Runtime screenshot/video/API error thật | Chuẩn hóa run identity, viewport, role fixture, request/response/request ID, HAR sanitized và UI-state checklist. Không commit PII/token. | `RUNTIME_EVIDENCE_TEMPLATE.md` | **Prepared; evidence thật phải do QA2 chạy** |

## 3. Canonical API mapping

`VITE_API_BASE_URL` có suffix `/api/v1`. Endpoint constant phải là relative path.

| Flow | Method | FE constant path | Effective runtime URL | Permission | Payload / header guard |
| --- | --- | --- | --- | --- | --- |
| Scan classify | POST | `/scan/classify` | `/api/v1/scan/classify` | `scan.classify` | `codes` không rỗng, không duplicate, warehouse dương; response bắt buộc `batch_id`, số item khớp request và status hợp lệ |
| Post receipt | POST | `/inbound-documents/:id/post-receipt` | `/api/v1/inbound-documents/{id}/post-receipt` | `inbound.post` | line hợp lệ; `Idempotency-Key`; `If-Match`; receipt/movement/request evidence |
| Post issue | POST | `/outbound-documents/:id/post-issue` | `/api/v1/outbound-documents/{id}/post-issue` | `outbound.post` | line hợp lệ; `Idempotency-Key`; `If-Match`; issue/movement/request evidence |
| Apply adjustment | POST | `/stocktake/sessions/:sessionId/apply-adjustment` | `/api/v1/stocktake/sessions/{sessionId}/apply-adjustment` | `stocktake.adjust` | line hợp lệ; `Idempotency-Key`; `If-Match` |

Không đưa `/api/v1` vào `API_ENDPOINTS.SCAN_BATCHES_CLASSIFY`, vì Axios sẽ tạo
sai URL `/api/v1/api/v1/scan/classify`.

## 4. Permission / RBAC runtime mapping

### 4.1 Route-entry

| Route | Permission |
| --- | --- |
| Scan | `inventory.trace` OR `scan.classify` |
| Stocktake | `stocktake.count` |
| Warranty | `warranty.manage` |
| Reports | `report.view` |

### 4.2 Sensitive action

| Action | Canonical permission |
| --- | --- |
| Scan trong nhập kho | `scan.inbound` |
| Scan trong xuất kho | `scan.outbound` |
| Scan trong bảo hành | `scan.warranty` |
| Apply stocktake adjustment | `stocktake.adjust` |
| Tạo warranty TEMP_ONLY | `warranty.temp_only` |
| Export report | `report.export` |
| Post receipt / issue | `inbound.post` / `outbound.post` |

Frontend guard chỉ là UX/defense-in-depth. **Backend authorization** vẫn là
nguồn quyết định cho HTTP 403 và data scope. Alias chỉ áp dụng cho các tên cũ
đã liệt kê, ví dụ `stocktake.apply → stocktake.adjust`; không tự coi
`stocktake.manage` là `stocktake.adjust`.

## 5. Dashboard / Reports disposition

| Endpoint | Disposition |
| --- | --- |
| `/reports/dashboard-quick` | Active FE mapping, WWHN-180 vẫn phải xác nhận contract chính thức. |
| `/reports/inventory-xnt` | Active FE mapping. |
| `/reports/inventory-xnt/export-excel` | Active, action-gated bằng `report.export`. |
| `/reports/hub` | Blocked; service ném `WMS_FE_CONTRACT_NOT_APPROVED` trước network. |
| `/reports/warranty-defects` | Blocked; service ném `WMS_FE_CONTRACT_NOT_APPROVED` trước network. |

Không còn tình trạng UI âm thầm gọi một proposal endpoint rồi dùng lỗi runtime
làm bằng chứng contract.

## 6. UI states và runtime evidence

QA2 phải kiểm tra đầy đủ các trạng thái: **loading, empty, error, success,
disabled, confirm, retry**, responsive và accessibility.

Bằng chứng tối thiểu:

1. Scan success và negative response trên `/api/v1/scan/classify`.
2. 403 trực tiếp từ API với actor thiếu quyền; ảnh UI disabled không đủ.
3. 422 field validation, 409 conflict/idempotency replay, 412 stale `If-Match`,
   428 missing precondition, 5xx và retry.
4. `warranty.temp_only` thiếu quyền phải không có network request.
5. Report hub và warranty-defects bị block phải không có network request.
6. Screenshot/video ở 1920, 1366, 1024, 768 và mobile viewport.
7. Commit SHA, CI run/build ID, environment, browser, role, permission fixture,
   request ID và sanitized HAR.

**Không tự nhận QA2 sign-off.**  
**Không tự nhận BE authorization sign-off.**

## 7. Automated regression / CI gates

Các lệnh bắt buộc:

```bash
npm run format:check
npm run lint
npm run test
npm run env:verify
npm run uat:p0p1:verify
npm run master-sku:verify
npm run wms-contract:verify
npm run build
npm run health:check
npm run check:api-mapping
```

`wms-contract:verify` tạo
`docs/evidence/wms-contract-signoff/ci-contract-evidence.json` và CI upload
artifact `wms-contract-evidence-${GITHUB_SHA}`.

Verifier không còn phụ thuộc vào một `swagger-api.json` không tồn tại trong
branch. Khi official OpenAPI chưa có, `check:api-mapping` chạy ở chế độ
FE constant/baseline validation và phát warning rõ ràng; không được mô tả chế độ
này là BE OpenAPI sign-off.

## 8. PR/CI trace

| Field | Value |
| --- | --- |
| Repository | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` |
| Branch | `m1` |
| Commit | Commit duy nhất chứa code và tài liệu closure này |
| Previous observed CI | Head cũ `bcc2574...`: format/lint/test pass; 37 test files, 317 tests; pipeline dừng tại master-SKU verifier do regex JSX không xử lý icon `>` |
| CI reliability fix | Verifier mới kiểm tra JSX đa dòng bằng semantic pattern; evidence token được kiểm tra theo ngữ nghĩa Việt/Anh |
| New CI run | Điền từ workflow chạy trên commit closure |
| Artifact | `wms-contract-evidence-${GITHUB_SHA}` |

## 9. External gate handoff

| Gate | Owner | Bằng chứng bắt buộc | Current disposition |
| --- | --- | --- | --- |
| WWHN-180 / `BE-CONFIRMATION-EVIDENCE` | BE1 + BA | endpoint, method, payload, response, error code, permission, idempotency, sample và canonical OpenAPI/Jira decision | Pending independent sign-off |
| WWHN-182 / `QA-BA-GATES` | QA2 | runtime happy/negative/RBAC/idempotency/retry/responsive trên exact SHA/build/env | Pending execution |
| WWHN-183 / `QA-BA-GATES` | BA | G1 minutes: Go / Conditional Go / No-Go; closure FE-SO-001…006 | Pending BA decision |
| `RUNTIME-EVIDENCE` | QA2 + FE1 support | screenshots/video/network evidence theo template | Pending runtime run |

## 10. Kết luận

Phạm vi FE1 có thể tự chịu trách nhiệm đã được xử lý đầy đủ ở mức code,
payload/response validation, permission mapping, fail-closed contract,
regression test, CI verifier, API mapping và evidence template.

Task **không được chuyển thành Final FE sign-off** trước khi WWHN-180,
WWHN-182 và WWHN-183 có bằng chứng độc lập. Sau khi ba gate đó pass, BA có thể
đổi disposition từ `CONDITIONAL PASS — NOT FINAL` sang final mà không cần FE
tự sửa lại contract logic đã khóa trong commit này.
