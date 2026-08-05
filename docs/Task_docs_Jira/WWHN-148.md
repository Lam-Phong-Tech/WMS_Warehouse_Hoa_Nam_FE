# WWHN-148 — [FE1] Rà soát khả năng triển khai và tái sử dụng

Cập nhật: 2026-08-05 ICT  
Nhánh: `m1`  
Task cha: `WWHN-30`  
Dependency: `HN-UX-002-ST01`

## 1. Kết luận điều hành

FE-owned remediation đã hoàn tất ở mức repository và được siết thêm theo đánh giá 82/100. Trạng thái chính xác là:

**FE-owned remediation complete; final acceptance pending independent evidence.**

Không có P0 trực tiếp thuộc FE1. Tuy nhiên final sign-off vẫn phải fail-closed cho đến khi BAS, BA, BE1/BE2 và QA2 cung cấp evidence độc lập, cùng exact FE SHA, BE SHA, immutable build ID, named DEV/UAT environment và SHA256 artifact.

## 2. Root-cause closure theo đánh giá 82/100

| Mức | Vấn đề | Root cause | Xử lý trong `m1` | Gate cuối |
| --- | --- | --- | --- | --- |
| P1 | `HN-UX-002-ST01` chưa chốt | WWHN-146/147 chưa có approval độc lập | Thêm closure manifest bắt buộc evidence URL + SHA256 + decision | BAS WWHN-146 approved; BA WWHN-147 approved |
| P1 | QA2 chưa review testability | Controlled evidence không phải runtime thật | Thêm QA2 runtime runbook với named env/build/backend, scenario và artifact schema | WWHN-149 PASS |
| P1 | Contract/permission/sample data conditional | FE không được tự ký contract BE | Manifest yêu cầu OpenAPI version/hash, permission catalog và sample 403/409/422/idempotency | WWHN-180 independent PASS |
| P1 | G1 contract gate mở | Evidence cross-role không cùng SHA/digest | Manifest khóa WWHN-180/182/183 và final policy | WWHN-182 PASS; WWHN-183 GO; P0/P1=0 |
| P1 | Runtime evidence là controlled mocks | Chưa có named DEV/UAT + backend thật | Runbook bắt buộc direct API, raw trace đã redact và request ID | QA2 artifact hash hợp lệ |
| P2 | Normalization fallback tạm thời | BE contract chưa được lock chính thức | Giữ registry có owner/removal gate; CI không cho mở rộng alias âm thầm | Xóa alias sau BE lock contract |
| P2 | Blob image comment không truy vết | Blob URL không có filename/env/build/SHA/hash | Chính sách mới reject blob image comment cho final; bắt buộc artifact URL + SHA256 | Jira comment chuẩn hóa |

## 3. Baseline kỹ thuật

Tuân thủ `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`:

- React/Vite/TypeScript SPA theo module.
- API qua `src/shared/api/http.ts`; endpoint qua `src/shared/api/endpoints.ts`.
- RBAC theo permission code; FE là UX gate, BE là security authority.
- 401/403/409/412/422 xử lý fail-safe; không lộ stack trace/secret.
- Critical mutation dùng `Idempotency-Key` và `If-Match` khi contract yêu cầu.
- Vitest cho unit/integration; Playwright cho browser evidence.
- CI bắt buộc format, lint, typecheck, test, build, health, API mapping và WWHN-148 verifier.

## 4. Canonical evidence package

### Repository artifacts

- `docs/evidence/wwhn-148/WWHN-148_CLOSURE_MANIFEST.json`
- `docs/evidence/wwhn-148/QA2_RUNTIME_EVIDENCE_RUNBOOK.md`
- `docs/api-evidence/M1_API_MAPPING.md`
- `docs/api-evidence/WWHN-148_NORMALIZATION_REGISTER.json`
- `scripts/verify-wwhn-148-closure.mjs`
- `e2e/wms-runtime-evidence.spec.ts`
- `src/test/wwhn-148-critical-response-contract.test.ts`

### Không được dùng làm final evidence

- Controlled mocks hoặc local fixture.
- Screenshot đơn lẻ không có build/env/SHA.
- Blob image comment.
- Branch URL động.
- Comment tự claim PASS không có artifact hash.
- Evidence từ SHA/build khác với release candidate.

## 5. QA2 runtime matrix bắt buộc

QA2 phải chạy trên named DEV/UAT environment và backend thật:

1. Responsive: 1440×900, 1024×768, 390×844.
2. UI states: loading, empty, error, success, disabled, confirm.
3. Route RBAC và action visibility.
4. Direct API 403 không có business write.
5. 422 field mapping và retry-safe.
6. 409 business conflict.
7. Idempotency replay cùng key/cùng payload, không side effect lần hai.
8. Idempotency conflict cùng key/payload khác trả 409.
9. Stale `If-Match` trả 409 hoặc 412.
10. Không stack trace, SQL, path nội bộ, token hoặc secret.
11. Request ID truy vết từ UI/API sang audit/backend log.

Artifact bắt buộc gồm build metadata, QA2 identity, contract metadata, raw request/response đã redact, screenshots/videos/traces, request-ID map, redaction report, result summary, `SHA256SUMS` và package digest.

## 6. Cross-role final gate

Final chỉ được mở khi đồng thời:

| Gate | Điều kiện |
| --- | --- |
| WWHN-146 | BAS `APPROVED`, evidence URL và SHA256 |
| WWHN-147 | BA `APPROVED`, evidence URL và SHA256 |
| WWHN-149 | QA2 `PASS` trên named build/env/backend thật |
| WWHN-180 | Versioned OpenAPI/schema, permission catalog, sample 403/409/422/idempotency; independent confirmation |
| WWHN-182 | QA2 API/DB/runtime evidence `PASS`, artifact digest hợp lệ |
| WWHN-183 | BA decision `GO`, open P0=0, open P1=0, minutes URL + SHA256 |

`CONDITIONAL_GO`, missing hash, placeholder, mismatched SHA/build hoặc còn P0/P1 đều giữ `finalAllowed=NO`.

## 7. Normalization disposition

Critical mutation hiện ưu tiên canonical snake_case success evidence và reject alias không có trong registry. Các fallback còn lại là debt có kiểm soát, không phải contract chính thức.

Removal gate:

1. BE1/BE2 phát hành OpenAPI/schema versioned và hash.
2. BA/BAS duyệt field/state/rule.
3. FE cập nhật official/generated types.
4. Xóa alias/fallback và registry entry tương ứng.
5. Unit/integration/API mapping/CI pass trên exact SHA.

Không được mở rộng alias âm thầm trước removal gate.

## 8. Automated gate

`npm run wwhn-148:verify` kiểm tra:

- Canonical document và legacy pointer.
- API mapping và fail-closed boundary.
- Cross-role closure manifest đủ WWHN-146/147/149/180/182/183.
- QA2 runbook có named env/build/backend, 403/409/412/422, idempotency và SHA256.
- Normalization registry hợp lệ.
- Vite/Vitest config isolation.
- Responsive/RBAC/API-error controlled scenarios vẫn tồn tại.
- Package và CI thực sự gọi verifier.

## 9. Jira handoff format

Comment WWHN-148 sau commit phải ghi:

- exact FE commit SHA;
- CI run URL/status;
- artifact filename + digest;
- file paths đã thay đổi;
- FE scope PASS;
- external gate status của WWHN-146/147/149/180/182/183;
- không đính blob image comment làm canonical evidence.

## 10. Definition of Done

### FE-owned DoD

- Chỉ sửa nhánh `m1`.
- Một commit tiếng Việt duy nhất.
- Repository artifacts và verifier hoàn chỉnh.
- CI exact SHA phải pass trước khi claim FE closure.
- Jira handoff có SHA/build/env/artifact/hash rõ ràng.

### Final 100% DoD

Chỉ đạt 100% khi toàn bộ cross-role gate ở mục 6 pass bằng evidence độc lập. FE1 không tự ký thay BAS, BA, BE hoặc QA2 và không được ghi 100% khi các gate còn pending.
