# [FE1] Rà soát ánh xạ contract/UI — Hồ sơ xử lý P0/P1/P2

## 1. Thông tin bàn giao

| Trường | Giá trị |
| --- | --- |
| Jira task | WWHN-153 — `[FE1] Rà soát ánh xạ contract/UI` |
| Nhánh | `m1` |
| Repository | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` |
| Ngày cập nhật | 2026-08-03 |
| Review đầu vào | Chưa đạt — 72/100 |
| Trạng thái FE | **Conditional pass — chưa final sign-off** |
| Nguyên tắc | FE fail-closed; không tự xác nhận thay BE/BA/QA; không tự suy diễn nghiệp vụ tồn kho |

## 2. Kết luận điều hành

Phần FE có thể xử lý bằng code đã được chuyển thành guard có thể kiểm chứng trong CI:

- Endpoint canonical cho inbound/outbound/report được tập trung trong `src/shared/api/endpoints.ts`.
- Scan, Post Receipt, Post Issue và Apply Adjustment có payload validation, idempotency và optimistic-lock guard.
- Post Receipt/Post Issue chỉ được coi là thành công khi response có movement/request evidence.
- Route permission được ghi rõ là UX gate; backend vẫn là nguồn enforcement RBAC và data scope.
- FE final sign-off được khóa bằng `WMS_FINAL_SIGNOFF.finalAllowed = false` cho tới khi đủ contract và gate độc lập.
- CI có gate `npm run wms-contract:verify` để kiểm OpenAPI hash, critical paths, permission catalog FE, regression guard và trạng thái fail-closed.
- CI xuất artifact `wms-contract-evidence-<commit_sha>` chứa commit SHA, run ID, runner OS, Node version, OpenAPI SHA256 và trạng thái critical flows.

Không tuyên bố 100% acceptance khi các bằng chứng BE/BA/QA độc lập chưa có. Mục tiêu 100% ở phía FE được hiểu là: **không còn P0/P1/P2 thuộc phạm vi FE bị bỏ trống, mọi blocker ngoài FE có owner, điều kiện đóng và evidence requirement cụ thể**.

## 3. Ma trận xử lý review 72/100

| Mức | Vấn đề review | Xử lý đã thực hiện trong FE | Trạng thái | Điều kiện đóng cuối |
| --- | --- | --- | --- | --- |
| P0 | Contract nguồn WWHN-31 chưa hoàn tất | `WMS_OPENAPI_LOCAL_SNAPSHOT` lưu OpenAPI version/hash/disposition; `verify-wms-contract-signoff.mjs` tính lại SHA256 và fail khi snapshot drift | FE guarded; external blocker | BE1/BE2 phát hành OpenAPI/schema chính thức có version/hash/changelog; QA1 review constraints/error/testability |
| P0 | Final FE sign-off chưa hợp lệ | `WMS_FINAL_SIGNOFF.finalAllowed = false`; `assertFinalSignoffAllowed()` luôn chặn khi còn blocker | Đã xử lý fail-closed | WWHN-31/WWHN-180 pass và có BA/QA confirmation độc lập |
| P1 | WWHN-150/WWHN-151 chưa đóng | Đưa vào `WMS_P0_P1_CONTRACT_GATES` với owner và required fix; CI không coi local snapshot là official evidence | External blocker | BE1/BE2 attach Architecture/OpenAPI core và Schema/API modules evidence versioned |
| P1 | ROUTE_PERMISSIONS vẫn là UX gate | Mapping tập trung tại `src/app/router/access.ts`; action permission tách tại `src/shared/constants/wms-permissions.ts`; regression test bảo vệ boundary | FE guarded | BE/RBAC cung cấp runtime permission catalog hoặc mapping versioned có BA duyệt |
| P1 | Critical stock-changing flow chưa đủ sign-off | Scan/Post Receipt/Post Issue/Apply Adjustment có validation; receipt/issue yêu cầu movementRef/requestId; receipt/issue/adjustment yêu cầu `Idempotency-Key` và `If-Match` | FE guarded | BE/BA/QA khóa endpoint, payload, error code, permission và sample response chính thức |
| P1 | BE confirmation còn yếu | Code/tài liệu không sử dụng comment cá nhân làm final evidence; gate yêu cầu OpenAPI/Postman/schema có version/hash và reviewer độc lập | External blocker | BE1/BE2 cung cấp artifact versioned và independent reviewer |
| P1 | QA1/QA2/BA gate chưa chạy | Gate `QA-BA-GATES` giữ trạng thái external blocker; FE chỉ cung cấp local regression evidence | External blocker | WWHN-152, WWHN-182 và WWHN-183 có pass/fail evidence hoặc Go/No-Go minutes |
| P2 | Evidence UI/build runtime chưa đủ | CI xuất contract evidence JSON theo commit/run; Prettier patch được xuất thành artifact; PR/commit/build trace được ghi trong tài liệu này | Một phần hoàn tất | QA/FE attach screenshot/video desktop/tablet/mobile, API error thật và build environment đã định danh |

## 4. Critical-flow contract matrix

| Flow | Endpoint FE | Guard FE | Permission FE | Response/evidence requirement | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| Scan classify | `POST /scan-batches/classify` | Không cho payload rỗng, code rỗng, duplicate hoặc warehouse_id không hợp lệ | `scan.classify` / `inventory.trace` là UX gate | Cần official sample response và error catalog từ BE | Conditional |
| Post Receipt | `POST /inbound-documents/:id/post-receipt` | Validate document, lines, quantity, `Idempotency-Key`, `If-Match` | `inbound.post` | Bắt buộc `receiptId`, `movementRef`, `requestId` | FE guarded |
| Post Issue | `POST /outbound-documents/:id/post-issue` | Validate document, lines, quantity, `Idempotency-Key`, `If-Match` | `outbound.post` | Bắt buộc `issueId`, `movementRef`, `requestId` | FE guarded |
| Apply Adjustment | `POST /stocktake/sessions/:sessionId/apply-adjustment` | Validate session, lines, actual_qty, `Idempotency-Key`, `If-Match` | `stocktake.adjust` | Cần official success/error/idempotency sample từ BE | FE guarded |

## 5. File thay đổi và vai trò

| File | Nội dung |
| --- | --- |
| `src/shared/api/wms-contract-signoff.ts` | Danh sách P0/P1 gates, OpenAPI snapshot metadata và final sign-off fail-closed |
| `src/shared/api/endpoints.ts` | Endpoint canonical cho WMS modules |
| `src/shared/constants/wms-permissions.ts` | Permission catalog và action-level permission groups |
| `src/app/router/access.ts` | Route-level UX gates, không thay backend enforcement |
| `src/modules/scan/services/scanService.ts` | Scan payload guard; block physical-code endpoint chưa duyệt |
| `src/modules/receiving/services/receivingService.ts` | Post Receipt idempotency/If-Match và response evidence guard |
| `src/modules/shipping/services/shippingService.ts` | Post Issue idempotency/If-Match và response evidence guard |
| `src/modules/stocktake/services/stocktakeService.ts` | Apply Adjustment payload/idempotency/If-Match guard |
| `src/test/wms-contract-signoff-guards.test.ts` | Regression guard cho endpoint, permission, payload, evidence và final-signoff blocker |
| `scripts/verify-wms-contract-signoff.mjs` | CI gate kiểm hash OpenAPI, critical flow, permission, regression và xuất evidence JSON |
| `.github/workflows/ci.yml` | Deterministic install, quality gates, Prettier patch artifact và WMS contract evidence artifact |
| `package.json` | Thêm lệnh `wms-contract:verify` |

## 6. CI và evidence

### Lệnh bắt buộc

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

### Artifact CI

| Artifact | Mục đích |
| --- | --- |
| `prettier-patch-<commit_sha>` | Bản vá định dạng toàn bộ source khi repository còn drift Prettier |
| `wms-contract-evidence-<commit_sha>` | Evidence JSON có OpenAPI SHA256, commit SHA, run ID, môi trường và trạng thái từng critical flow |

### Baseline CI trước sửa

- Commit `a63af89ec1dc9c83968ec966f5924a0cf93ac6c5` thất bại tại `npm run format:check`.
- 15 file bị Prettier cảnh báo; các bước lint/test/build bị skip.
- Vì vậy baseline cũ không đủ điều kiện P2 build evidence dù tài liệu local trước đó ghi PASS.

### Commit triển khai trong lượt này

| Commit | Nội dung |
| --- | --- |
| `5511a3f35dda56a6eadb758ff179d5c9f9124264` | Chuẩn hóa deterministic install và tạo Prettier patch artifact |
| `809db5bcd21bbeb9b273a74f53dabeefa6165407` | Thêm script kiểm chứng P0/P1/P2 contract sign-off |
| `4c23ed3cdddda7a5e27a53eacb75fe45f11e0f11` | Tích hợp lệnh `wms-contract:verify` |
| `ab910c9f71abf1860e83f3ed89ae3077844bb92b` | Nối gate/evidence contract vào CI |

## 7. Owner và điều kiện đóng

| Gate | Owner | Evidence bắt buộc |
| --- | --- | --- |
| WWHN-31 official contract | BE1 + BE2 + QA1 | OpenAPI/schema version/hash/changelog; QA1 constraints/error/testability pass/fail |
| WWHN-150/WWHN-151 | BE1 + BE2 | Architecture/OpenAPI core và Schema/API modules artifact versioned |
| Permission catalog | BE/RBAC + BA + FE1 | `/permissions` runtime catalog hoặc mapping versioned có BA approval |
| Critical flows | BE1 + BA + QA | Endpoint, payload, 403/409/412/422, idempotency replay, permission và sample response |
| QA gates | QA1 + QA2 | Happy/negative/RBAC/idempotency/retry evidence trên named build/env |
| BA G1 | BA | WWHN-183 Go/No-Go minutes |
| Runtime UI evidence | FE1 + QA/DevOps | Screenshot/video desktop/tablet/mobile, API error thật, PR, commit SHA, build ID/env, CI log |

## 8. Giới hạn và điểm không được phép tuyên bố

- Không coi `swagger-api.json` local là official WWHN-31 artifact.
- Không coi comment “tôi là BE” là contract evidence.
- Không coi route/action permission FE là backend authorization.
- Không tự tính tồn kho cuối cùng trong client.
- Không đánh dấu final sign-off khi thiếu BA/QA confirmation độc lập.
- Không tuyên bố CI PASS cho tới khi GitHub Actions run của HEAD hoàn tất thành công.

## 9. Trạng thái bàn giao

**FE implementation:** đã có guard và trace cho toàn bộ mục P0/P1/P2 thuộc phạm vi code/CI.  
**Final acceptance:** vẫn bị chặn bởi official contract, permission catalog và QA/BA gate độc lập.  
**Mức sẵn sàng đề xuất:** FE conditional pass; chưa đủ dữ liệu trung thực để tuyên bố 100% acceptance toàn dự án.
