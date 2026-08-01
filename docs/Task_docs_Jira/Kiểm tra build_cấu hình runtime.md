# WWHN-296 - Kiểm tra build/cấu hình runtime

## 1. Thông tin Jira và traceability

| Trường | Giá trị |
| --- | --- |
| Jira task | WWHN-296 |
| Tiêu đề | [FE1] Kiểm tra build/cấu hình runtime |
| Loại issue | Subtask |
| Trạng thái khi kiểm tra | In Progress |
| Priority | Medium |
| Assignee | FE1 - Quang Nguyễn Thanh |
| Reporter | Wuangg |
| Task cha | WWHN-79 - [PROD] Sẵn sàng hạ tầng, secret, backup và monitoring |
| Dependency | HN-DEVOPS-004-ST01 |
| Parent Temp Key | HN-DEVOPS-004 |
| Epic Temp Key | HN-EPIC-10 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Output đầu ra | FE prod check |
| Link nguồn | https://tan0110.atlassian.net/browse/WWHN-296 |
| Ngày cập nhật evidence | 2026-08-01 ICT |

Tài liệu này là evidence bàn giao cho output **FE prod check**. Phạm vi bám đúng Jira: kiểm tra build/cấu hình runtime, artifact deploy tối thiểu, API mapping evidence, RBAC/API error/UI state foundation; không tự thay đổi API contract và không tự chốt rule nghiệp vụ khi thiếu input BA/BE/DevOps.

## 2. Kết luận nhanh

| Lớp kiểm | Câu hỏi cần trả lời | Kết luận 2026-08-01 |
| --- | --- | --- |
| Toolchain/build | Repo build bằng script nào, output ra đâu, build có pass không? | Pass `npm.cmd run build`; output `dist/index.html`, `dist/assets/*`, `dist/health.json`. |
| Runtime env | FE lấy API base URL, timeout, credentials, health path từ đâu? | Có validator tập trung tại `src/shared/config/env.ts`; `.env.example` có đủ biến runtime chính. |
| API contract | FE có base axios, endpoint/error handling, API mapping check không? | Pass `npm.cmd run check:api-mapping -- --no-live`; mapping M1/M2/M3 không có method/path error, còn warning coverage phạm vi. |
| RBAC/error UI | Route/action permission và 403/API error hiển thị thế nào? | Có `RequirePermission`, permission store theo active context, `ApiErrorAlert`, `NoPermissionState`. |
| BA/QA evidence | Có lint/test/build/coverage/health result và risk/blocker rõ không? | Có evidence lệnh chạy ngày 2026-08-01; không còn blocker build/runtime FE1 P0/P1, còn dependency DevOps/runtime và contract coverage cần sign-off. |

Kết luận bàn giao: **FE build/runtime baseline đạt điều kiện bàn giao có điều kiện** cho WWHN-79. Điều kiện còn lại nằm ở xác nhận runtime prod/UAT từ DevOps và phạm vi API contract ngoài mapping M1/M2/M3 đã có.

## 3. Input đầu vào đã kiểm

| Input Jira yêu cầu | Nguồn đã kiểm | Cách dùng trong FE prod check |
| --- | --- | --- |
| Task cha WWHN-79 | Jira WWHN-296 Description | Giữ scope production readiness: hạ tầng, secret, backup, monitoring; FE chỉ bàn giao phần build/runtime/evidence. |
| Dependency HN-DEVOPS-004-ST01 | Jira WWHN-296 Description | Cần DevOps xác nhận environment/deploy base URL/secret handling trước sign-off production cuối. |
| Baseline nghiệp vụ/API/UI specification | `swagger-api.json`, `README.md`, `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`, shared component docs, `docs/api-evidence/*` | Đối chiếu endpoint/payload/error/UI state; không tự suy diễn rule nghiệp vụ nếu contract thiếu. |
| API evidence task cha | `docs/api-evidence/M1_API_MAPPING.md`, `M2_DEPENDENCY_LIST.md`, `M3_DEPENDENCY_LIST.md` | Đã đủ file để chạy check offline; script pass với warning coverage. |
| Cấu hình build/environment từ DevOps | `.env.example`, `.env`, `src/shared/config/env.ts` | Xác minh FE đã có biến runtime; giá trị prod thật phải inject ngoài repo. |

## 4. Runtime configuration

| Hạng mục | Nguồn code | Kết quả kiểm |
| --- | --- | --- |
| Env name | `src/shared/config/env.ts` | Chỉ nhận `local`, `dev`, `uat`, `prod`, `test`; invalid env throw sớm. |
| API base URL | `VITE_API_BASE_URL` qua `runtimeConfig.apiBaseUrl` | Required; validate URL `http/https`; normalize bỏ slash cuối. |
| API health path | `VITE_API_HEALTH_PATH` | Optional; mặc định `/health`; tự thêm slash đầu nếu thiếu. |
| API timeout | `VITE_API_TIMEOUT_MS` | Optional; mặc định `10000`; reject số không hợp lệ hoặc `<= 0`. |
| Credentials/cookie | `VITE_API_WITH_CREDENTIALS` | Boolean string `true/1`; truyền vào axios `withCredentials`. |
| Storage URL | `VITE_STORAGE_URL` | Optional; validate URL nếu có; empty fallback theo storage util. |
| Feature flags | `VITE_ENABLE_ANALYTICS`, `VITE_ENABLE_DEBUG`, `VITE_ENABLE_PERF_MONITOR` | Boolean string; `.env.example` không hard-code bật prod. |

Production note: giá trị prod thật không được commit vào repo. DevOps cần inject qua pipeline/hosting và xác nhận domain/CORS/cookie policy khớp `VITE_API_WITH_CREDENTIALS`.

## 5. Build/tooling configuration

| Hạng mục | Nguồn | Kết quả |
| --- | --- | --- |
| Framework | `package.json`, `vite.config.ts` | React + TypeScript + Vite SPA. |
| Build script | `npm.cmd run build` | Chạy `tsc -b && vite build`. |
| Alias | `vite.config.ts`, `vitest.config.ts` | `@` trỏ về `./src`; đã đổi từ `__dirname` sang `import.meta.url`/`fileURLToPath` để tránh warning future native loader. |
| Chunk split | `vite.config.ts` | Có `manualChunks` cho React, data, form, AntD, rc, emotion, dayjs, utils, vendor. |
| Chunk warning limit | `vite.config.ts` | `1500`; build hiện pass. |
| Health artifact | `scripts/check-frontend-health.mjs`, `public/health.json`, `dist/health.json` | Check pass; contract `status=ok`, `service=wms-hoa-nam-frontend`, `component=frontend`, `healthcheck=static`. |
| QA scripts | `package.json` | Đã có `test:e2e` (`playwright test`) và `test:coverage` (`vitest run --coverage`) để khớp README handover. |

## 6. API/runtime behavior

| Hạng mục | Nguồn code | Kết quả |
| --- | --- | --- |
| Axios base | `src/shared/api/axios.ts` | Dùng `runtimeConfig.apiBaseUrl`, `apiTimeoutMs`, `apiWithCredentials`. |
| Auth header | `src/shared/api/axios.ts`, `memoryStorage` | Tự gắn `Authorization: Bearer <token>` nếu có token. |
| 401 handling | `src/shared/api/axios.ts` | Gom request đồng thời vào một lần refresh; retry request gốc một lần; refresh fail thì logout và về login. |
| 403 password change | `src/shared/api/axios.ts` | `PASSWORD_CHANGE_REQUIRED` redirect `/change-password` nếu chưa ở màn này. |
| 403 no permission | `src/shared/api/axios.ts` | Đánh dấu `_isNoPermission=true` để UI render trạng thái không có quyền. |
| 422 validation | `src/shared/api/axios.ts` | Đánh dấu `_isValidationError=true`. |
| 409 conflict | `src/shared/api/axios.ts` | Đánh dấu `_isConflictError=true`. |
| Error display | `src/shared/components/feedback/ApiErrorAlert.tsx` | Chuẩn hóa message, field errors; 403 render `NoPermissionState`. |

API mapping offline đã pass method/path cho 45 endpoint rows trong M1/M2/M3. Warning còn lại là phạm vi mapping nhỏ hơn toàn bộ `swagger-api.json` 288 route và runtime permission catalog không fetch live do thiếu `VITE_TEST_EMAIL`/`VITE_TEST_PASSWORD`; đây là risk coverage/sign-off, không phải lỗi build.

## 7. RBAC/UI state

| Acceptance area | Nguồn code | Kết quả |
| --- | --- | --- |
| Route-level RBAC | `src/app/router/RequirePermission.tsx` | Permission rỗng cho authenticated user; super admin bypass; array permission dùng OR; thiếu quyền chuyển về route no-permission. |
| Permission state | `src/shared/store/auth.store.ts` | `permissionCodes` gắn với active context, không phải union toàn tài khoản. |
| Action-level permission | `src/modules/auth/components/Can.tsx`, `src/shared/components/feedback/ActionDropdown.tsx`, `src/lib/permissions/index.ts` | Có helper render action theo permission/scope. |
| API 403 UI | `ApiErrorAlert`, `NoPermissionState` | 403 thường hiển thị state không có quyền nhất quán. |
| Loading | `TableContainer`, `LoadingState`, `PageSkeleton`, `FormModal/FormDrawer/FormPage` | Có skeleton/loading button/state chuẩn cho table/page/form. |
| Empty | `TableContainer`, `EmptyState`, `FilteredEmptyState`, `DataTable` locale | Có empty state cho chưa có dữ liệu và filter không có kết quả. |
| Error | `ApiErrorAlert`, `ErrorBoundary`, `ErrorState` | Có parser API error và boundary fallback. |
| Disabled/confirm | `FormActions`, `ConfirmButton`, `ConfirmDialog`, `ActionDropdown` | Có loading/disabled và confirm cho action phù hợp. |
| Success | `sonner` toast usage và shared feedback components | Có nền tảng feedback success; QA cần kiểm trên từng workflow cụ thể. |

Kết luận: cơ chế UI state/RBAC đáp ứng yêu cầu nền tảng của Jira. Với từng màn nghiệp vụ, BA/QA vẫn cần kiểm wording/rule/field theo specification riêng.

## 8. Evidence lệnh đã chạy

Môi trường chạy: Windows PowerShell trong workspace `C:\HoaNamFE\Hoa_Nam_Tools`, ngày 2026-08-01 ICT. Do PowerShell có thể chặn `npm.ps1` theo Execution Policy, evidence dùng `npm.cmd`.

| Gate | Command | Kết quả |
| --- | --- | --- |
| Lint | `npm.cmd run lint` | Pass, exit code 0. |
| Unit test | `npm.cmd run test` | Pass: 35 test files, 300 tests. |
| Coverage smoke | `npm.cmd run test:coverage` | Pass: 35 test files, 300 tests; statements 60.21%, branches 46.64%, funcs 55.86%, lines 60.09%. |
| Build | `npm.cmd run build` | Pass, exit code 0; Vite built successfully. |
| Health artifact | `npm.cmd run health:check` | Pass: `Frontend build exposes /health.json and index.html.` |
| Health contract | `Get-Content dist\health.json` | `status=ok`, `service=wms-hoa-nam-frontend`, `component=frontend`, `healthcheck=static`. |
| API mapping offline | `npm.cmd run check:api-mapping -- --no-live` | Pass: 0 errors; 1 warning coverage/catalog fallback. |
| Git status | `git -c safe.directory=C:/HoaNamFE/Hoa_Nam_Tools status --short` | Chạy được không cần đổi global config; workspace có nhiều thay đổi ngoài phạm vi task. |

Build output quan sát được:

| Artifact | Trạng thái |
| --- | --- |
| `dist/index.html` | Có sau build. |
| `dist/assets/*.js/css` | Có sau build; chunk lớn nhất quan sát: `vendor-antd` khoảng 1,314.49 kB raw / 396.65 kB gzip. |
| `dist/health.json` | Có và pass health contract. |

## 9. Acceptance Criteria mapping

| Acceptance Criteria từ Jira | Evidence / đánh giá | Trạng thái |
| --- | --- | --- |
| Output “FE prod check” được rà soát/xác minh, gắn evidence vào HN-DEVOPS-004 và không còn blocker thuộc vai trò FE1. | Tài liệu này là output FE prod check; lint/test/coverage/build/health/API mapping offline pass. | Pass có điều kiện |
| UI đáp ứng quy tắc nghiệp vụ, field specification và responsive; xử lý loading, empty, error, success, disabled và confirm khi phù hợp. | Cơ chế shared UI state đã có; chưa kiểm từng màn responsive bằng screenshot trong task này. | Pass nền tảng, cần QA/BA kiểm màn cụ thể |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu hoặc quy tắc trái contract. | Có `RequirePermission`, permission store theo active context, `ApiErrorAlert`, 403 handling. | Pass nền tảng |
| Tích hợp đúng endpoint/payload đã duyệt; lint, build và test phù hợp phải pass. | Lint/test/coverage/build pass; API mapping M1/M2/M3 pass offline method/path. | Pass partial, còn risk coverage ngoài M1/M2/M3 |
| BA/QA có evidence để kiểm tra; không còn P0/P1 blocker chưa có disposition. | Evidence lệnh đã ghi. P1 DevOps/runtime và API coverage ngoài mapping có owner/disposition. | Pass có điều kiện |

## 10. Blocker, risk và disposition

| Mã | Loại | Mô tả | Owner đề xuất | Điều kiện đóng | Severity |
| --- | --- | --- | --- | --- | --- |
| WWHN-296-B01 | API mapping evidence | Đã đóng blocker thiếu file `docs/api-evidence/*`; `check:api-mapping -- --no-live` pass 0 errors. Còn warning phạm vi mapping 45 route so với 288 route Swagger. | FE1 phối hợp BE/BA | Xác nhận phạm vi M1/M2/M3 là đủ cho WWHN-296 hoặc mở task riêng để mở rộng mapping toàn Swagger. | P2 risk coverage |
| WWHN-296-R01 | Runtime/DevOps dependency | Giá trị prod thật của `VITE_API_BASE_URL`, `VITE_API_WITH_CREDENTIALS`, CORS/cookie policy chưa được xác nhận trong repo. | DevOps - HN-DEVOPS-004-ST01 | DevOps cung cấp env prod/UAT và xác nhận deploy config ngoài repo. | P1 trước prod deploy |
| WWHN-296-R02 | Runtime permission catalog | `check:api-mapping -- --no-live` dùng FE fallback catalog vì không có `VITE_TEST_EMAIL`/`VITE_TEST_PASSWORD`; chưa fetch live `/permissions`. | QA/BE/DevOps | Cung cấp credential test/runtime an toàn và chạy mapping không `--no-live`. | P2 |
| WWHN-296-R03 | UI/e2e visual evidence | Task này chưa capture responsive screenshot cho từng màn nghiệp vụ. | QA/FE1 | Chạy Playwright/capture script theo màn cụ thể nếu QA yêu cầu nghiệm thu trực quan. | P2 |

Đã xử lý trong task này:

| Mã cũ | Trạng thái | Ghi chú |
| --- | --- | --- |
| Vite `__dirname` warning | Đã xử lý | `vite.config.ts` và `vitest.config.ts` dùng `fileURLToPath(import.meta.url)`. |
| README script drift | Đã xử lý | `package.json` có `test:e2e` và `test:coverage`; đã thêm `@vitest/coverage-v8`. |
| Git dubious ownership local | Có workaround không đổi global | Dùng `git -c safe.directory=C:/HoaNamFE/Hoa_Nam_Tools status --short`. |

## 11. Checklist bàn giao BA/QA/DevOps

| Người nhận | Checklist cần kiểm |
| --- | --- |
| BA/QA | Dùng build đã pass để kiểm các màn nghiệp vụ có đủ loading, empty, error, success, disabled, confirm; kiểm wording/field/enum/status theo spec đã duyệt. |
| QA | Chạy lại `lint`, `test`, `test:coverage`, `build`, `health:check`, `check:api-mapping -- --no-live` trên máy/CI độc lập; bổ sung screenshot responsive nếu nghiệm thu UI cụ thể. |
| QA/BE | Nếu có credential runtime an toàn, chạy `npm.cmd run check:api-mapping` không `--no-live` để kiểm permission catalog live. |
| DevOps | Inject env prod/UAT ngoài repo; xác nhận API base URL, CORS, cookie/credentials, deploy static artifact, cache policy và health route `/health.json`. |
| FE1 | Gắn tài liệu/evidence này vào HN-DEVOPS-004/WWHN-296; mở follow-up nếu cần mở rộng API mapping toàn Swagger hoặc visual evidence theo màn. |

## 12. Definition of Done đánh giá

| DoD | Trạng thái | Ghi chú |
| --- | --- | --- |
| Code/review/lint/build/test hoàn tất | Pass lint/test/coverage/build/health/API mapping offline tại workspace ngày 2026-08-01 | Review formal/PR không nằm trong phạm vi lệnh local này. |
| Evidence UI và traceability hoàn tất | Pass tài liệu traceability; UI evidence nền tảng có trong code | Cần screenshot/e2e theo màn nếu QA yêu cầu. |
| Contract mismatch có disposition | Có disposition cho API mapping coverage và live permission catalog | Không có method/path error trong mapping M1/M2/M3. |
| Tài liệu component/build cập nhật khi cần | File này cập nhật output FE prod check; package scripts đã khớp README handover | Các tài liệu khác có thể cần đồng bộ nếu scope task riêng yêu cầu. |
| BA/QA có thể kiểm theo AC | Có checklist và evidence commands | Cần BA/QA xác nhận formal sign-off. |
| Không còn blocker chưa có owner/điều kiện đóng | Đã gán owner đề xuất và điều kiện đóng cho từng risk còn lại | P1 còn lại thuộc DevOps runtime input trước prod sign-off. |

## 13. Kết luận FE prod check

FE build/runtime baseline hiện đủ điều kiện bàn giao **có điều kiện** cho luồng production readiness:

- `lint`, `unit test`, `coverage smoke`, `build`, `health:check`, `check:api-mapping -- --no-live` đã pass.
- Runtime config có validator tập trung, không phụ thuộc hard-code API base URL trong code.
- Axios/RBAC/API error/UI state foundation đáp ứng yêu cầu nền tảng của WWHN-296.
- API mapping evidence không còn fail do thiếu file; M1/M2/M3 pass method/path offline, còn risk coverage toàn Swagger và live permission catalog.
- DevOps vẫn cần xác nhận runtime values prod/UAT và CORS/cookie policy ngoài repo trước prod sign-off.

Disposition đề xuất: gắn tài liệu này vào HN-DEVOPS-004/WWHN-296, đồng thời giữ `WWHN-296-R01` là điều kiện bắt buộc trước production deploy.
