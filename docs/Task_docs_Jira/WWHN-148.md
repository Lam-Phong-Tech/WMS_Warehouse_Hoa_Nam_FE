# WWHN-148 — [FE1] Rà soát khả năng triển khai và tái sử dụng

Cập nhật: 2026-08-04 ICT  
Nhánh thực hiện: `m1`  
Task cha: `WWHN-30` — `[UX] Đặc tả field và trạng thái UI cho luồng core`  
Dependency: `HN-UX-002-ST01`

## 1. Kết luận điều hành

FE1 đã xử lý toàn bộ phần có thể kiểm soát trong repository cho review 72/100:

- Khôi phục evidence API mapping bắt buộc và giữ `check:api-mapping` fail-fast.
- Khóa traceability WWHN-148 bằng một tài liệu canonical và một CI gate riêng.
- Sửa lỗi format làm CI `m1` đỏ trước khi lint/type/test/build/API/E2E được chạy.
- Tách sạch Vite và Vitest config, loại bỏ coupling type không cần thiết và chặn quay lại `__dirname`/CommonJS config-loader pattern.
- Mở rộng browser evidence để có desktop/tablet/mobile, shared UI states, role không quyền và API 422 retry-safe.
- Đặt policy canonical cho response của mutation ảnh hưởng tồn kho; read-side fallback được đóng băng trong normalization register cho đến khi BE lock contract.

Trạng thái chính xác sau thay đổi là **FE-owned closure complete, final acceptance pending independent gates**. FE1 không tự đánh dấu 100/100 thay BAS, BA, BE1/BE2 hoặc QA2.

## 2. Trạng thái dependency đọc trực tiếp từ Jira

| Jira | Owner | Trạng thái tại 2026-08-04 | Evidence bắt buộc để đóng |
| --- | --- | --- | --- |
| `WWHN-146` — Field/state matrix | BAS | `To Do` | Field Spec Master có version/date/approver, state matrix loading/empty/error/success/disabled/confirm |
| `WWHN-147` — Rule/label/validation | BA | `To Do` | BA approval comment cho rule, label, validation, error copy và open-point disposition |
| `WWHN-148` — FE review | FE1 | `In Progress` | Commit exact SHA, full CI, API mapping, runtime evidence, blocker matrix |
| `WWHN-149` — QA2 testability | QA2 | `To Do` | Pass/fail theo build/env/browser cho UI state, responsive, RBAC, API error và testability |

Không chuyển `WWHN-148` sang Done trước khi các evidence độc lập trên được đính kèm hoặc có formal disposition từ owner.

## 3. Baseline kỹ thuật áp dụng

Các thay đổi tuân theo `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`:

- React/Vite/TypeScript SPA theo module.
- API call đi qua `src/shared/api/http.ts`; endpoint nằm tại `src/shared/api/endpoints.ts`.
- RBAC dựa trên permission code, không dựa role name; FE là UX gate, BE là security authority.
- Server response theo envelope chuẩn và được unwrap tập trung tại shared HTTP client.
- Unit/integration dùng Vitest; runtime evidence dùng Playwright.
- Quality gates bắt buộc gồm format, lint, typecheck, test, build, health và API mapping.

## 4. Ma trận xử lý review 72/100

| Mức | Vấn đề | Root cause | Thay đổi trong `m1` | Trạng thái sau sửa |
| --- | --- | --- | --- | --- |
| P1 | `HN-UX-002-ST01` chưa chốt | `WWHN-146` và `WWHN-147` chưa có sign-off thực tế | Ghi đúng trạng thái Jira, owner, evidence tối thiểu; final gate giữ fail-closed | FE disposition hoàn tất; chờ BAS + BA |
| P1 | QA2 chưa review testability | `WWHN-149` còn To Do; evidence CI cũ chỉ cover login | Mở rộng `e2e/wms-runtime-evidence.spec.ts` cho UI states và role 403; tài liệu hóa checklist QA2 | FE test package sẵn; chờ QA2 pass/fail |
| P1 | `check:api-mapping` thiếu M1 evidence | File bị mất sau merge, tài liệu cũ vẫn ghi đã pass | Khôi phục `docs/api-evidence/M1_API_MAPPING.md`; gate WWHN-148 kiểm tra nội dung và script API mapping tiếp tục fail-fast | Đóng trong phạm vi FE |
| P1 | Contract/permission/sample data conditional | BE contract, catalog và negative samples chưa final | Mapping rõ active/fail-closed; critical mutation giữ permission/idempotency/optimistic-lock/success-evidence guards | FE guard hoàn tất; chờ BE1/BE2 |
| P1 | Runtime evidence chưa đủ | Chỉ có 3 viewport login + 422 | Bổ sung component-catalog states và limited-role 403, giữ screenshot/video/trace theo exact CI SHA | FE controlled evidence hoàn tất; named-backend QA evidence còn mở |
| P2 | Nhiều fallback normalization | Read services chịu nhiều response alias trong lúc contract chưa khóa | Tạo `WWHN-148_NORMALIZATION_REGISTER.json`; critical mutation ưu tiên canonical fields và chỉ chấp nhận alias whitelist đã đăng ký; đóng băng read aliases và quy định removal gate | Đóng policy/code guard; cleanup cuối chờ BE lock |
| P2 | Vite/Vitest warning | Vite config còn tham chiếu type Vitest dù config test đã tách | Loại bỏ Vitest reference khỏi Vite config; dùng ESM `node:path`/`node:url`; verifier chặn CommonJS/`__dirname` regression | Đóng trong phạm vi FE/Tech Lead |

## 5. API, permission và sample-error disposition

Nguồn FE canonical:

- `docs/api-evidence/M1_API_MAPPING.md`
- `docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json`
- `src/shared/api/endpoints.ts`
- `src/shared/constants/wms-permissions.ts`
- `src/shared/api/wms-action-permission.ts`

Critical flows:

| Flow | Endpoint | Permission | Request safeguards | Success evidence bắt buộc |
| --- | --- | --- | --- | --- |
| Scan classify | `POST /api/v1/scan/classify` | `scan.classify` / route alternative theo catalog | unique codes, positive warehouse, enum source | `batch_id`, item code/status |
| Post receipt | `POST /api/v1/inbound-documents/{id}/post-receipt` | `inbound.post` | unique lines, positive qty, `Idempotency-Key`, `If-Match` | `receipt_id`, `movement_ref`, `request_id` |
| Post issue | `POST /api/v1/outbound-documents/{id}/post-issue` | `outbound.post` | unique lines, positive qty, `Idempotency-Key`, `If-Match` | `issue_id`, `movement_ref`, `request_id` |
| Apply adjustment | `POST /api/v1/stocktake/sessions/{id}/apply-adjustment` | `stocktake.adjust` | unique SKU, non-negative qty, `Idempotency-Key`, `If-Match` | `session_id`, valid status, `movement_ref`, `request_id` |

Independent BE evidence still required:

- Versioned OpenAPI/schema and changelog/hash.
- Permission catalog approved by BE/RBAC + BA.
- Canonical request/response samples.
- Negative samples: 403, 409, 412/428, 422.
- Idempotency replay/conflict behavior against named backend build.

## 6. UI state, responsive và RBAC evidence

CI controlled browser suite phải tạo screenshot, video và trace cho:

| Scenario | Viewport / role | Assertion tối thiểu |
| --- | --- | --- |
| Login responsive | 1440×900, 1024×768, 390×844 | Heading/action visible, no horizontal overflow |
| Shared UI states | Desktop component catalog | Loading, empty, error, no-permission, API field error, confirm và disabled action visible |
| Limited-role RBAC | Authenticated user không có `sku.manage/master.manage` | Điều hướng `/master-data` bị chặn và render `/errors/403` |
| API validation error | Login API 422 | POST thật được intercept, payload đúng, message visible, submit được enable lại |

Ranh giới: controlled mocks chứng minh FE state machine và rendering. QA2 vẫn phải chạy cùng checklist trên named build/environment với backend thật để final pass.

## 7. Service normalization policy

`docs/api-evidence/WWHN-148_NORMALIZATION_REGISTER.json` là source register cho debt normalization.

Quy tắc:

1. Shared HTTP client là nơi duy nhất unwrap API envelope.
2. Mutation ảnh hưởng tồn kho ưu tiên canonical success payload; chỉ alias whitelist trong register được phép tạm thời. Alias ngoài register hoặc thiếu evidence bắt buộc phải fail closed.
3. Read-side aliases hiện có chỉ được giữ tạm thời và không được mở rộng âm thầm.
4. Sau khi BE lock OpenAPI/schema và BA/BAS chốt field/state/rule, FE thay aliases bằng official/generated type, cập nhật tests và xóa registry entry đã hết hiệu lực.
5. Mọi thay đổi registry phải có owner, lý do và contract reference.

## 8. Vite/Vitest config disposition

- `vite.config.ts` chỉ nhập `defineConfig` từ `vite`; không tham chiếu `vitest/config`.
- `vitest.config.ts` là config test riêng và nhập `defineConfig` từ `vitest/config`.
- Cả hai dùng ESM-safe `fileURLToPath(import.meta.url)` với `node:path`/`node:url`.
- Gate `wwhn-148:verify` fail nếu quay lại `__dirname`, `__filename`, `require(...)` hoặc nhúng Vitest types vào Vite config.

Không nâng version Vite/Vitest trong task này vì review yêu cầu xử lý config loader, không yêu cầu dependency upgrade. Tránh tạo regression ngoài scope.

## 9. Automated gates

`npm run wwhn-148:verify` kiểm tra:

- Canonical WWHN-148 document và legacy pointer.
- M1 API mapping, normalization register và dependency keys.
- Required 403/409/422/idempotency evidence language.
- Vite/Vitest config isolation.
- Runtime evidence có đủ 3 viewport, component catalog, role 403 và API 422.
- Package/CI thực sự gọi gate, không chỉ ghi trong tài liệu.

Full gate order:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run env:verify
npm run uat:p0p1:verify
npm run master-sku:verify
npm run wms-contract:verify
npm run wwhn-148:verify
npm run build
npm run health:check
npm run check:api-mapping
npm run test:e2e:evidence
```

## 10. Evidence package cần gắn Jira

| Artifact | Owner | Trạng thái |
| --- | --- | --- |
| Commit exact SHA trên `m1` | FE1 | Ghi sau commit duy nhất |
| CI run + raw outcomes | FE1/DevOps | Ghi sau workflow exact SHA |
| `M1_API_MAPPING.md` + script log | FE1 | Có trong repo; CI xác minh |
| Screenshot/video/trace controlled | FE1 | CI artifact |
| Field/state matrix | BAS (`WWHN-146`) | Chưa có — external blocker |
| Rule/label/validation approval | BA (`WWHN-147`) | Chưa có — external blocker |
| QA2 pass/fail | QA2 (`WWHN-149`) | Chưa có — external blocker |
| OpenAPI/permission/negative samples | BE1/BE2 | Chưa có — external blocker |

## 11. Definition of Done và sign-off rule

### FE-owned DoD

- Code/docs/evidence nằm trên đúng nhánh `m1`.
- Không tạo branch phụ.
- Một commit tiếng Việt duy nhất chứa toàn bộ remediation.
- Full CI exact SHA phải pass trước khi ghi FE closure complete.
- Jira comment phải nêu commit, CI, evidence và blocker owner.

### Final 100/100 DoD

Chỉ đạt khi đồng thời:

1. FE-owned DoD pass.
2. `WWHN-146` có BAS evidence approved.
3. `WWHN-147` có BA approval.
4. `WWHN-149` có QA2 pass/fail và không còn P0/P1 defect mở.
5. BE1/BE2 cung cấp contract/permission/sample data versioned và QA xác minh trên exact backend build.

Cho đến thời điểm đó, trạng thái hợp lệ là **Conditional Pass — FE complete, independent gates pending**; không ghi “100% final” sai bằng chứng.