# WWHN-153 — Rà soát ánh xạ contract/UI và đóng P0/P1/P2 FE

## 1. Thông tin bàn giao

| Trường | Giá trị |
| --- | --- |
| Repository | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` |
| Nhánh triển khai | `m1` — không tạo nhánh phụ |
| Review đầu vào | Chưa đạt — `72/100` |
| Ngày xử lý | 2026-08-04 |
| Phạm vi | BA-FE-P0-01..02, BA-FE-P1-01..05, BA-FE-P2-01..02 |
| Trạng thái FE-owned | **Đã hoàn tất toàn bộ remediation có thể thực hiện bằng FE code/CI/docs** |
| Final cross-role sign-off | **Conditional pass — chưa final** vì WWHN-31 và bằng chứng độc lập BE/QA/BA còn pending |

> Quy ước trung thực: “FE hoàn tất 100%” không đồng nghĩa tự ký thay BE1/BE2/QA1/QA2/BA. FE khóa fail-closed và cung cấp đầy đủ cơ chế/evidence; final acceptance chỉ mở khi artifact độc lập tồn tại.

## 2. Kết quả kỹ thuật chính

1. CI không còn chạy `prettier --write` trước `prettier --check`. Gate mới read-only, fail khi có drift mới; nợ format cũ được khóa theo Git blob prefix và không thể âm thầm mở rộng.
2. Có gate riêng: format, lint, typecheck, unit/integration test, env contract, UAT contract, master/SKU, WMS contract, build, health, API mapping, Playwright runtime evidence.
3. CI tách `SOURCE_SHA` của `m1` và `EXECUTION_SHA`/merge SHA, ghi run/build/env/outcome vào manifest JSON + Markdown.
4. Browser evidence tạo screenshot/video/trace cho 1440×900, 1024×768, 390×844 và controlled login API 422.
5. Runtime RBAC có service `/permissions` + reconciliation alias/canonical/missing; action nhạy cảm có service-level defense-in-depth trước HTTP.
6. Scan kiểm payload, mã trùng, status, số lượng **và đúng tập code** response.
7. Post Receipt/Post Issue kiểm permission, line trùng, quantity, idempotency, optimistic lock và response `movement_ref + request_id`.
8. Apply Adjustment chỉ dùng `stocktake.adjust`, chặn SKU trùng, yêu cầu idempotency/If-Match và không chấp nhận 2xx thiếu `session_id + movement_ref + request_id`.
9. Report export và Warranty TEMP_ONLY đều có service guard; backend vẫn là authority cuối và phải có negative 403 runtime.
10. Final FE sign-off giữ `finalAllowed = false` tới khi đủ WWHN-31/WWHN-180/WWHN-182/WWHN-183.

## 3. Closure matrix P0/P1/P2

| ID | Sev | Required fix | Thay đổi thực hiện | Evidence/điều kiện đóng | Owner/reviewer | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| BA-FE-P0-01 | P0 | Official OpenAPI/schema version/hash/changelog + independent reviewer | `WMS_FE_CONTRACT_BASELINE.json` có vùng `officialContract` fail-closed; verifier cấm FE tự điền hash giả; critical mapping tách khỏi official sign-off | BE1/BE2 phát hành WWHN-31 version + SHA256 + changelog; QA1 review đúng hash | BE1 + BE2 + QA1 | **External blocker; FE guard complete** |
| BA-FE-P0-02 | P0 | Chỉ final khi WWHN-31/WWHN-180 và BA/QA pass | `WMS_FINAL_SIGNOFF.finalAllowed=false`; regression + CI verifier kiểm fail-closed | WWHN-31/WWHN-180 pass, QA2 evidence, BA G1 minutes | FE1 + BA + QA | **FE complete; external blocker** |
| BA-FE-P1-01 | P1 | WWHN-150/151 versioned architecture/schema evidence | Gate matrix yêu cầu exact artifacts; local constants không được gắn nhãn official | WWHN-150 + WWHN-151 attachments versioned | BE1 + BE2 | **External blocker** |
| BA-FE-P1-02 | P1 | QA1 review exact OpenAPI hash | Baseline và runtime template có trường official SHA256; verifier kiểm trạng thái pending | WWHN-152 pass/fail constraints/error/testability trên đúng hash | QA1 | **External blocker** |
| BA-FE-P1-03 | P1 | QA2 evidence + BA G1 | Playwright controlled evidence, immutable CI manifest, runtime template RT-01..RT-10 | WWHN-182 real DEV/UAT evidence; WWHN-183 Go/Conditional Go/No-Go | QA2 + BA | **FE evidence tooling complete; external blocker** |
| BA-FE-P1-04 | P1 | Runtime `/permissions`, approved mapping, backend 403 | `wms-permission-catalog.ts`, canonical aliases, missing-code reconciliation, service permission guards, `useCanAny` loại broad unapproved fallback | BE/BA duyệt catalog; QA2 direct API 403 | BE/RBAC + FE1 + BA + QA2 | **FE complete; external blocker** |
| BA-FE-P1-05 | P1 | Lock endpoint/payload/error/permission/sample response cho 4 flow | Request/response/action guards cho Scan, Receipt, Issue, Adjustment; baseline ghi accepted/error HTTP và required evidence | BE/BA/QA official sign-off + samples | BE1 + BA + QA | **FE complete; external blocker** |
| BA-FE-P2-01 | P2 | Closure matrix đọc nhanh | Chính bảng này + JSON matrix trong baseline + generated contract evidence | Commit/CI artifact của source SHA | FE1 | **Complete** |
| BA-FE-P2-02 | P2 | PR/SHA/build/env/log/screenshot/video | CI manifest tách source/execution SHA; artifact chứa contract/runtime manifest, screenshot/video/trace, health; full gate outcomes | QA2 bổ sung API error/RBAC thật trên named UAT build | FE1 + DevOps + QA2 | **FE complete; external runtime supplement** |

## 4. Critical-flow contract matrix

| Flow | Endpoint | Permission | FE request guard | FE success evidence guard | Negative cases bắt buộc |
| --- | --- | --- | --- | --- | --- |
| Scan classify | `POST /scan/classify` → runtime `/api/v1/scan/classify` | `scan.classify` hoặc `inventory.trace` | codes non-empty/unique, warehouse positive | `batch_id`, item status hợp lệ, đúng count, không duplicate, đúng tập code | 403, duplicate, unknown/invalid, 409, 422, 5xx |
| Post Receipt | `POST /inbound-documents/:id/post-receipt` | `inbound.post` | document/line/qty, unique line IDs, `Idempotency-Key`, `If-Match` | `receipt_id`, `movement_ref`, `request_id` | 403, 409 replay/conflict, 412 stale, 422, 428 |
| Post Issue | `POST /outbound-documents/:id/post-issue` | `outbound.post` | document/line/qty, unique line IDs, `Idempotency-Key`, `If-Match` | `issue_id`, `movement_ref`, `request_id` | 403, insufficient stock, 409, 412, 422, 428 |
| Apply Adjustment | `POST /stocktake/sessions/:sessionId/apply-adjustment` | **chỉ** `stocktake.adjust` (`stocktake.apply` chỉ là alias) | session/lines/SKU unique/actual≥0, `Idempotency-Key`, `If-Match` | matching `session_id`, `ADJUSTED/PARTIALLY_ADJUSTED`, `movement_ref`, `request_id` | 403, duplicate SKU, stale/replay, 409, 412, 422, 428 |

## 5. RBAC boundary

- `ROUTE_PERMISSIONS` chỉ là gate truy cập trang/UX.
- `useCanAny` khi nhận một nhóm có canonical WMS permission sẽ bỏ qua fallback không được catalog duyệt; vì vậy `stocktake.manage` không thể cấp quyền Apply Adjustment.
- Service guard chặn request trước HTTP để giảm thao tác sai từ UI.
- Backend bắt buộc tiếp tục enforce permission + data scope và trả 403 cho direct API request không quyền.
- `/permissions` runtime được normalize từ `code`, `permission_code`, `name` hoặc string; output chỉ rõ alias observed và canonical code còn thiếu.

## 6. CI/evidence contract

### Gate bắt buộc

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run env:verify
npm run uat:p0p1:verify
npm run master-sku:verify
npm run wms-contract:verify
npm run build
npm run health:check
npm run check:api-mapping
npm run test:e2e:evidence
npm run wms-evidence:collect
```

### Artifact

`wms-fe-closure-evidence-<SOURCE_SHA>` gồm:

- `contract-evidence.json`: baseline hash, closure matrix, critical-flow disposition, automated checks.
- `runtime-manifest.json/.md`: source SHA, execution SHA, run/build ID, runner/Node/env, outcome từng gate.
- `test-results`: screenshot/video/trace controlled evidence.
- `playwright-report`.
- `dist/health.json` và SHA256 trong manifest.

### Format gate

- Không sửa source trong runner.
- Không cho phép drift mới.
- Chỉ chấp nhận file nợ lịch sử nếu Git blob vẫn đúng prefix đã khóa tại `known-prettier-debt.json`.
- Nếu file nợ được sửa, bắt buộc format sạch; không được cập nhật baseline để che nợ mới.

## 7. File thay đổi chính

| Nhóm | File |
| --- | --- |
| CI/build evidence | `.github/workflows/ci.yml`, `package.json`, `playwright.config.ts`, `e2e/wms-runtime-evidence.spec.ts`, `scripts/collect-wms-runtime-evidence.mjs` |
| Contract/closure | `docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json`, `src/shared/api/wms-contract-signoff.ts`, `scripts/verify-wms-contract-signoff.mjs` |
| RBAC | `src/shared/constants/wms-permissions.ts`, `src/shared/api/wms-action-permission.ts`, `src/shared/api/wms-permission-catalog.ts`, `src/shared/hooks/usePermission.ts` |
| Critical flow | `scanService.ts`, `receivingService.ts`, `shippingService.ts`, `stocktakeService.ts`, `reportsService.ts`, `warrantyService.ts`, shared contract validators |
| Regression | `src/test/wms-contract-signoff-guards.test.ts` |
| Evidence docs | File này, `RUNTIME_EVIDENCE_TEMPLATE.md`, format baseline |

## 8. Điều kiện final 100% cross-role

Final sign-off chỉ được mở khi đồng thời có:

1. WWHN-31 official OpenAPI/schema: version, SHA256, changelog, independent reviewer.
2. WWHN-150/WWHN-151 versioned artifacts.
3. WWHN-152 QA1 exact-hash review.
4. BE/BA approved runtime permission catalog + QA2 direct 403 evidence.
5. WWHN-182 QA2 evidence trên đúng source/build/env.
6. WWHN-183 BA G1 minutes `Go` hoặc disposition được phê duyệt.
7. WWHN-180 independent confirmation.

Không có mục nào ở trên được FE tự đánh dấu pass bằng comment hoặc local snapshot.

## 9. Kết luận bàn giao

- **FE-owned remediation:** hoàn tất, có automated guards và trace cho toàn bộ 9 mục review.
- **Code safety:** fail-closed tại permission, payload, optimistic lock, idempotency và success evidence.
- **Evidence quality:** source SHA/merge SHA/build/env/log/screenshot/video được tự động hóa và đóng gói theo commit.
- **Final acceptance toàn dự án:** còn phụ thuộc artifact chính thức và sign-off độc lập; không tuyên bố sai là đã hoàn tất thay các owner đó.
