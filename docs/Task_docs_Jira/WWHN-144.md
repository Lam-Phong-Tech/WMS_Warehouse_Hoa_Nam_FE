# WWHN-144 — FE layout/navigation/shared component closure

## 1. Mục tiêu và phạm vi

WWHN-144 triển khai khung giao diện responsive, navigation shell, menu theo RBAC, route guard và shared component phục vụ parent WWHN-29 theo `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`.

**Disposition API mapping:** WWHN-144 và WWHN-29 là **UX frame scope**, **không phải API integration endpoint scope**. Mock API trong E2E chỉ tạo state xác định để kiểm thử hành vi FE. Backend authorization, direct API denial, data scope và audit vẫn thuộc BE/QA1; FE hide menu hoặc redirect không được dùng thay bằng chứng authorization phía server.

## 2. Kết quả xử lý theo redflag

| Mức | Redflag | Xử lý gốc rễ | Evidence/gate |
| --- | --- | --- | --- |
| P0 | N/A trực tiếp cho FE layout/navigation/shared component | Không mở rộng scope hoặc tạo thay đổi giả để “đóng P0”. Route/menu tiếp tục fail-closed theo permission code và baseline kỹ thuật. | `ProtectedRoute`, `RequirePermission`, WWHN-144 closure verifier |
| P1 | QA2 WWHN-145 chưa chạy | Duy trì E2E deterministic cho desktop/tablet/mobile, RBAC menu, anonymous direct URL, authenticated direct URL và `/errors/403`; video bật riêng cho project QA2. QA2 vẫn phải review độc lập trên exact SHA/build/env. | `e2e/auth-role-navigation-qa2.spec.ts`, project `wwhn-144-chromium` |
| P1 | Test gate chưa có evidence mới | CI chạy format, lint, typecheck, unit/integration, build, health, API mapping, closure verifier và E2E; final aggregate fail nếu bất kỳ mandatory gate nào không success. | `.github/workflows/ci.yml`, `scripts/assert-ci-gates.mjs` |
| P1 | Parent WWHN-29 chưa sẵn sàng | Ghi rõ dependency gate: **không chuyển parent WWHN-29** khi WWHN-143 còn In Progress hoặc WWHN-145 chưa được QA2 review/transition. | Jira live status + mục 7 |
| P1 | Evidence WWHN-144 chưa đủ sâu | Sinh screenshot, video, HTML/JSON report và metadata có filename, env, build, role, viewport, timestamp, source SHA, route, final URL và assertion. | `docs/evidence/wwhn-144/README.md`, Actions artifact |
| P2 | Responsive viewport chưa khớp | Khóa đúng `1440x900`, `768x1024`, `375x812`; không dùng ma trận cũ làm closure evidence. | `VIEWPORTS` trong QA2 E2E |
| P2 | API mapping warning cần disposition | Chốt UX frame scope; không tạo endpoint giả, không sửa OpenAPI và không coi mocked API là integration pass. | Mục 1 và metadata `apiScopeDisposition` |
| P2 | Blob image comment không truy vết | Evidence chuẩn là commit, workflow run, manifest và file/folder bàn giao chuẩn; cấm `blob:` hoặc ảnh dán tạm làm nguồn đóng ticket. | `verify-wwhn-144-closure.mjs` |

## 3. Audit exact-SHA ngày 05/08/2026

### 3.1 Phát hiện nguyên nhân gốc

Audit GitHub Actions trên SHA `9ee2b2dcd351419bcaad4e256ef528cfa37ad381`, workflow run `31014623303`, cho thấy toàn bộ gate kỹ thuật phía sau đã chạy và pass, gồm lint, typecheck, unit/integration, build, health, API mapping, WWHN-144 verifier và E2E. Job vẫn fail ở bước tổng hợp vì `npm run format:check` phát hiện Prettier drift tại `src/shared/api/wms-contract-signoff.ts`.

Điều này làm evidence cũ không còn đủ điều kiện exact-SHA dù layout/navigation/RBAC không hồi quy. Nguyên nhân là thay đổi cross-task được đưa vào cùng nhánh `m1` sau evidence trước đó nhưng không giữ format gate sạch.

### 3.2 Remediation triệt để

- Format lại biểu thức `WMS_P0_P1_CONTRACT_GATES` theo Prettier thay vì whitelist/bỏ qua file.
- Không thêm drift vào known-debt baseline.
- Không hạ mức kiểm soát `format:check` hoặc final aggregate.
- Bắt buộc tạo evidence mới trên commit cuối cùng của remediation; evidence SHA cũ không được dùng thay.
- Giữ fail-closed đối với QA2 WWHN-145 và dependency WWHN-143; automation pass không được tự nhận là reviewer sign-off.

## 4. Thay đổi kỹ thuật và testability

- `MainLayout` có `data-testid="desktop-navigation"` cho desktop sider.
- `AppHeader` có `data-testid="navigation-toggle"` cho responsive toggle.
- `SideNav` dùng semantic `<nav aria-label="Điều hướng chính">` và `data-testid="primary-navigation"`.
- Selector không phụ thuộc class nội bộ của Ant Design.
- RBAC dựa trên permission code, không dựa trên tên role.
- Direct URL thiếu quyền chuyển `/errors/403`; anonymous protected URL chuyển `/login`.
- FE guard chỉ là UX gate; backend vẫn là security authority.

## 5. QA2 E2E matrix

| Scenario | Role | Viewport | Expected |
| --- | --- | --- | --- |
| Anonymous direct URL `/master-data` | anonymous | 1440x900 | Redirect `/login`, không render protected content |
| RBAC menu | inventory_viewer | 1440x900 | Có menu được phép, menu không có quyền không tồn tại trong DOM |
| Authenticated direct URL bypass | inventory_viewer | 1440x900 | Redirect `/errors/403` |
| Direct `/errors/403` | inventory_viewer | 1440x900 | Render trạng thái không có quyền |
| Responsive desktop | super_admin | 1440x900 | Fixed sider và primary navigation visible |
| Responsive tablet | super_admin | 768x1024 | Không có desktop sider; drawer mở từ toggle |
| Responsive mobile | super_admin | 375x812 | Không có desktop sider; drawer mở từ toggle |

## 6. Evidence contract

Artifact chuẩn: `wms-fe-closure-evidence-<SOURCE_SHA>`, retention 90 ngày.

Nội dung tối thiểu:

- `docs/Task_docs_Jira/WWHN-144.md`;
- `docs/evidence/wwhn-144/README.md`;
- `test-results/wwhn-144/<SOURCE_SHA>/*.png`;
- `test-results/wwhn-144/<SOURCE_SHA>/*.json`;
- `test-results/playwright-results.json`;
- `playwright-report/index.html`;
- Playwright video trong `test-results/`;
- `dist/build-manifest.json` và `dist/health.json` khi build pass;
- aggregate evidence manifest.

Mỗi scenario JSON chứa `sourceSha`, `environment`, `buildVersion`, `role`, `viewport`, `browserProject`, `route`, `finalUrl`, `timestamp`, `screenshotFilename`, `reportFilename`, video policy, `result`, `assertions` và `apiScopeDisposition`.

### Quy tắc bàn giao Jira

- GitHub Actions artifact là nguồn CI bất biến, nhưng không dùng một file ZIP mơ hồ làm evidence duy nhất.
- Khi bàn giao QA2/Jira, phải giải nén thành report/screenshot/video/metadata có tên file rõ ràng hoặc cung cấp folder link chuẩn có manifest.
- Jira comment phải ghi exact commit SHA, workflow run, artifact name, environment/build và owner review.
- Không sử dụng URL `blob:` hoặc ảnh paste tạm làm evidence đóng ticket.

## 7. Jira dependency và workflow guard

Trạng thái live tại thời điểm audit:

- WWHN-143: **In Progress**;
- WWHN-145: **To Do**;
- WWHN-29: **In Progress**.

Quy tắc bắt buộc:

1. FE1 cung cấp final commit + CI artifact cho WWHN-144 và WWHN-145.
2. QA2 review độc lập responsive/RBAC/direct URL/403 trên đúng build/env/SHA.
3. Không chuyển parent WWHN-29 khi WWHN-143 còn In Progress hoặc WWHN-145 chưa đạt workflow approval.
4. Không tự nhận QA2 PASS thay assignee; automation pass là technical evidence, không thay reviewer sign-off.
5. Lead + QA chỉ move parent sau khi dependency và independent review đều đóng.

## 8. Lệnh kiểm tra bắt buộc

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run wwhn-144:verify
npm run build
npm run check:api-mapping
npm run test:e2e:wwhn-144
```

GitHub Actions là nguồn evidence chuẩn cho exact SHA. Local run chỉ dùng để debug, không thay thế CI evidence.

## 9. Definition of Done

### FE technical closure

- [x] Không có P0 code blocker riêng FE layout/navigation/shared component.
- [x] Exact viewport matrix được mã hóa bằng test.
- [x] RBAC menu và direct URL guard có assertion thực.
- [x] `/errors/403` được kiểm thử đúng ngữ cảnh.
- [x] Evidence metadata có filename/env/build/role/viewport/timestamp/SHA.
- [x] API scope có disposition rõ ràng.
- [x] Blob comment bị loại khỏi evidence contract.
- [x] Prettier drift làm fail exact-SHA được xử lý tại nguồn, không bypass baseline.
- [x] Closure verifier fail nếu contract bị hồi quy.

### External approval gate

- [ ] GitHub Actions trên final commit đạt toàn bộ mandatory gates.
- [ ] QA2 xác nhận WWHN-145 trên exact SHA/artifact.
- [ ] WWHN-143 hoàn tất owner/reviewer workflow.
- [ ] Lead + QA xác nhận parent WWHN-29 đủ điều kiện chuyển trạng thái.

## 10. Traceability

- Parent: WWHN-29.
- FE implementation/evidence: WWHN-144.
- QA2 responsive/RBAC smoke: WWHN-145.
- BAS screen inventory/field-state dependency: WWHN-143.
- Branch duy nhất: `m1`.
- Commit policy: một commit tiếng Việt sau khi hoàn thiện toàn bộ thay đổi.
