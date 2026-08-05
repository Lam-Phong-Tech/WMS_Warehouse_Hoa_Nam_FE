# WWHN-144 — FE layout/navigation/shared component closure

## 1. Mục tiêu và phạm vi

WWHN-144 triển khai khung giao diện responsive, navigation shell, menu theo RBAC, route guard và shared component phục vụ parent WWHN-29.

**Disposition API mapping:** WWHN-144 và WWHN-29 là **UX frame scope**, **không phải API integration endpoint scope**. Mock API trong E2E chỉ tạo state xác định để kiểm thử hành vi FE. Backend authorization, direct API denial, data scope và audit vẫn thuộc BE/QA1; FE hide menu hoặc redirect không được dùng thay bằng chứng authorization phía server.

## 2. Kết quả xử lý theo redflag

| Mức | Redflag | Xử lý gốc rễ | Evidence/gate |
| --- | --- | --- | --- |
| P0 | N/A trực tiếp cho FE layout/navigation/shared component | Không mở rộng scope hoặc tạo thay đổi giả để “đóng P0”. Route/menu vẫn fail-closed theo baseline kỹ thuật. | `ProtectedRoute`, `RequirePermission`, WWHN-144 closure verifier |
| P1 | QA2 WWHN-145 chưa chạy | Tạo E2E deterministic cho desktop/tablet/mobile, RBAC menu, anonymous direct URL, authenticated direct URL và `/errors/403`; video được bật riêng cho project QA2. | `e2e/auth-role-navigation-qa2.spec.ts`, project `wwhn-144-chromium` |
| P1 | Test gate chưa có evidence mới | CI chạy format, lint, typecheck, unit/integration, build, API mapping, closure verifier và E2E; mọi outcome được thu thập trước khi final gate kết luận. | `.github/workflows/ci.yml`, `scripts/assert-ci-gates.mjs` |
| P1 | Parent WWHN-29 chưa sẵn sàng | Ghi rõ dependency gate: **không chuyển parent WWHN-29** khi WWHN-143 còn In Progress hoặc WWHN-145 chưa được QA2 review/transition. | Jira live status + mục 6 tài liệu này |
| P1 | Evidence WWHN-144 chưa đủ sâu | Sinh screenshot, video, HTML/JSON report và metadata có filename, env, build, role, viewport, timestamp, source SHA, route, final URL và assertion. | `docs/evidence/wwhn-144/README.md`, Actions artifact |
| P2 | Responsive viewport chưa khớp | Khóa đúng `1440x900`, `768x1024`, `375x812`; bỏ ma trận cũ 1024x768, 390x844 và test desktop 1280x720/mobile 375x667 khỏi closure suite. | `VIEWPORTS` trong QA2 E2E |
| P2 | API mapping warning cần disposition | Chốt UX frame scope; không tạo endpoint giả, không sửa OpenAPI và không coi mocked API là integration pass. | Mục 1 và metadata `apiScopeDisposition` |
| P2 | Blob image comment không truy vết | Evidence chuẩn là GitHub commit/workflow/artifact; cấm `blob:` và blob storage URL trong closure document. | `verify-wwhn-144-closure.mjs` |

## 3. Thay đổi kỹ thuật

### 3.1 Testability contract ổn định

- `MainLayout` có `data-testid="desktop-navigation"` cho desktop sider.
- `AppHeader` có `data-testid="navigation-toggle"` cho responsive toggle.
- `SideNav` dùng semantic `<nav aria-label="Điều hướng chính">` và `data-testid="primary-navigation"`.
- Selector không phụ thuộc class nội bộ của Ant Design nên giảm flaky khi nâng version UI library.
- Ba case responsive dùng authenticated bootstrap (`refresh` + `me`) trước khi kiểm tra shell để cô lập đúng layout/navigation scope; login form và login API error tiếp tục được kiểm thử ở runtime evidence suite riêng.

### 3.2 QA2 E2E matrix

| Scenario | Role | Viewport | Expected |
| --- | --- | --- | --- |
| Anonymous direct URL `/master-data` | anonymous | 1440x900 | Redirect `/login`, không render protected content |
| RBAC menu | inventory_viewer | 1440x900 | Có `Tồn & truy vết`, không có `Danh mục & SKU` |
| Authenticated direct URL bypass | inventory_viewer | 1440x900 | Redirect `/errors/403` |
| Direct `/errors/403` | inventory_viewer | 1440x900 | Render “Không có quyền truy cập” |
| Responsive desktop | super_admin | 1440x900 | Fixed sider và primary navigation visible |
| Responsive tablet | super_admin | 768x1024 | Không có desktop sider; drawer mở từ toggle |
| Responsive mobile | super_admin | 375x812 | Không có desktop sider; drawer mở từ toggle |

### 3.3 CI gate không che lỗi

Trước sửa, CI dừng tại format drift và toàn bộ lint/test/build/E2E bị skipped. Pipeline mới dùng `continue-on-error` ở từng validation step để thu thập đầy đủ outcome, vẫn upload evidence bằng `if: always()`, sau đó `scripts/assert-ci-gates.mjs` fail job nếu bất kỳ mandatory gate nào không `success`. Cách này không nới gate; nó loại bỏ blind spot và cho phép chẩn đoán toàn bộ lỗi trong một run.

### 3.4 Formatting blocker

- `src/shared/api/axios.ts` được khôi phục đúng format blob sạch, bao gồm newline cuối file.
- `src/modules/auth/services/auth.service.ts` được làm sạch Prettier debt phát sinh sau thay đổi contract, bao gồm newline cuối file; không cập nhật hash baseline để hợp thức hóa drift.
- Không thêm file vào known-debt baseline và không giảm mức kiểm soát Prettier.

## 4. Evidence contract

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
- WMS aggregate evidence manifest.

Mỗi scenario JSON chứa:

- `sourceSha`;
- `environment`;
- `buildVersion`;
- `role`;
- `viewport`;
- `browserProject`;
- `route` và `finalUrl`;
- `timestamp`;
- `screenshotFilename`;
- `reportFilename` và video policy;
- `result`, `assertions`, `apiScopeDisposition`.

## 5. Lệnh kiểm tra

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

GitHub Actions là nguồn evidence chuẩn cho exact SHA vì runner ghi nhận env/build/workflow và đóng gói artifact bất biến. Local run chỉ dùng để debug, không thay thế CI evidence.

## 6. Jira dependency và workflow guard

Trạng thái live tại thời điểm audit trước commit:

- WWHN-143: **In Progress**;
- WWHN-145: **To Do**;
- WWHN-29: **In Progress**.

Quy tắc bắt buộc:

1. FE1 cung cấp commit + CI artifact cho WWHN-144 và WWHN-145.
2. QA2 review độc lập evidence và chạy/review smoke trên đúng build/env/SHA.
3. Không chuyển parent WWHN-29 khi WWHN-143 còn In Progress hoặc WWHN-145 chưa đạt workflow approval.
4. Không tự nhận QA2 PASS thay assignee; automation pass là technical evidence, không thay reviewer sign-off.
5. Jira comment chỉ tham chiếu repository commit, workflow run và standard attachment/artifact; không sử dụng ảnh blob comment làm evidence đóng.

## 7. Definition of Done

### FE technical closure

- [x] Không có P0 code blocker riêng FE layout/navigation/shared component.
- [x] Exact viewport matrix được mã hóa bằng test.
- [x] RBAC menu và direct URL guard có assertion thực, không còn comment placeholder.
- [x] `/errors/403` được kiểm thử cho anonymous/authenticated context.
- [x] Evidence metadata đầy đủ filename/env/build/role/viewport/timestamp/SHA.
- [x] CI không còn che các gate sau lỗi đầu tiên.
- [x] API scope có disposition rõ ràng.
- [x] Blob comment bị loại khỏi evidence contract.
- [x] Closure verifier fail nếu contract bị hồi quy.

### External approval gate

- [ ] GitHub Actions trên final commit đạt toàn bộ mandatory gates.
- [ ] QA2 xác nhận WWHN-145 trên exact SHA/artifact.
- [ ] WWHN-143 hoàn tất owner/reviewer workflow.
- [ ] Lead + QA xác nhận parent WWHN-29 đủ điều kiện chuyển trạng thái.

## 8. Traceability

- Parent: WWHN-29.
- FE implementation/evidence: WWHN-144.
- QA2 responsive/RBAC smoke: WWHN-145.
- BAS screen inventory/field-state dependency: WWHN-143.
- Branch duy nhất: `m1`.
- Commit policy: một commit tiếng Việt sau khi hoàn thiện toàn bộ thay đổi.
