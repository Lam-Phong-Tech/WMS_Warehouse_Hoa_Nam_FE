# WWHN-296 - Kiểm tra build/cấu hình runtime

## 1. Thông tin Jira và traceability

| Trường | Giá trị |
| --- | --- |
| Jira task | WWHN-296 |
| Tiêu đề | [FE1] Kiểm tra build/cấu hình runtime |
| Loại issue | Subtask |
| Trạng thái khi đọc | In Progress |
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
| Ngày kiểm tra tài liệu | 2026-08-01 ICT |

Tài liệu này là evidence bàn giao cho output **FE prod check**. Phạm vi bám đúng Jira:
kiểm tra build/cấu hình runtime, không tự thay đổi API contract, không tự mở rộng quy tắc
nghiệp vụ, và ghi rõ blocker nếu input/dependency còn thiếu.

## 2. Mục tiêu

Xác minh frontend WMS Hoa Nam có thể build production, có cấu hình runtime rõ ràng, có
artifact deploy tối thiểu, và có cơ chế kiểm soát API/RBAC/UI state đủ để BA/QA/DevOps
kiểm tra trước khi đi tiếp luồng production readiness của task cha WWHN-79.

Mục tiêu được kiểm ở 5 lớp:

| Lớp kiểm | Câu hỏi cần trả lời | Kết luận hiện tại |
| --- | --- | --- |
| Toolchain/build | Repo build bằng script nào, output ra đâu, build có pass không? | Pass `npm.cmd run build`; output `dist/index.html`, `dist/assets/*`, `dist/health.json`. |
| Runtime env | FE lấy API base URL, timeout, credentials, health path từ đâu? | Có validator tập trung tại `src/shared/config/env.ts`; `.env.example` đủ biến runtime chính. |
| API contract | FE có base axios, endpoint/error handling, API mapping check không? | Có axios runtime config và interceptor; API mapping check đang bị blocker do thiếu docs evidence files. |
| RBAC/error UI | Route/action permission và 403/API error hiển thị thế nào? | Có `RequirePermission`, permission store theo active context, `ApiErrorAlert`, `NoPermissionState`. |
| BA/QA evidence | Có lint/test/build/health result và risk/blocker rõ không? | Có evidence lệnh chạy ngày 2026-08-01; còn blocker API mapping docs thiếu file nguồn. |

## 3. Input đầu vào

| Input Jira yêu cầu | Nguồn đã kiểm | Cách dùng trong FE prod check |
| --- | --- | --- |
| Task cha WWHN-79 | Jira WWHN-296 Description | Giữ scope production readiness: hạ tầng, secret, backup, monitoring; FE chỉ bàn giao phần build/runtime/evidence. |
| Dependency HN-DEVOPS-004-ST01 | Jira WWHN-296 Description | Cần DevOps xác nhận environment/deploy base URL/secret handling trước sign-off production cuối. |
| Baseline nghiệp vụ/API/UI specification | `swagger-api.json`, `README.md`, `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`, shared components docs | Đối chiếu endpoint/payload/error/UI state; không tự suy diễn rule nghiệp vụ nếu contract thiếu. |
| Dữ liệu mẫu/evidence task cha | Chưa có file `docs/api-evidence/*` trong repo hiện tại | Ghi blocker cho API mapping evidence; không đánh dấu API mapping pass khi thiếu input. |
| Cấu hình build/environment từ DevOps | `.env.example`, `.env`, `src/shared/config/env.ts` | Xác minh FE đã có biến runtime; cần DevOps cung cấp giá trị prod thật ngoài repo. |

## 4. Vai trò và phối hợp

| Bên | Trách nhiệm trong WWHN-296 | Ghi chú phối hợp |
| --- | --- | --- |
| FE1 | Kiểm tra build/runtime, ghi evidence, phát hiện mismatch/blocker thuộc FE surface. | Không sửa API contract hoặc hard-code dữ liệu để che thiếu input. |
| DevOps | Cung cấp runtime environment, domain/API base URL, deploy path, secret policy, monitoring/health integration. | Owner của dependency HN-DEVOPS-004-ST01. |
| BE1/BE2 | Cung cấp endpoint/payload/validation/error code/permission catalog/dữ liệu mẫu. | FE đã có check API mapping script nhưng cần đủ docs mapping và credential nếu muốn check live catalog. |
| BA/BAS | Xác nhận rule nghiệp vụ, field specification, UI wording, trạng thái empty/error/success/confirm. | FE chỉ xác nhận cơ chế UI state, không tự chốt wording/rule mới. |
| QA | Dùng evidence lint/test/build/health và checklist UI/RBAC để nghiệm thu. | Cần bổ sung responsive/e2e screenshot nếu QA yêu cầu evidence trực quan theo màn cụ thể. |

## 5. Runtime configuration đã rà soát

| Hạng mục | Nguồn code | Kết quả kiểm |
| --- | --- | --- |
| Env name | `src/shared/config/env.ts` | Chỉ nhận `local`, `dev`, `uat`, `prod`, `test`; invalid env throw error sớm. |
| API base URL | `VITE_API_BASE_URL` qua `runtimeConfig.apiBaseUrl` | Required; validate URL `http/https`; normalize bỏ slash cuối. |
| API health path | `VITE_API_HEALTH_PATH` | Optional; mặc định `/health`; tự thêm slash đầu nếu thiếu. |
| API timeout | `VITE_API_TIMEOUT_MS` | Optional; mặc định `10000`; reject số không hợp lệ hoặc <= 0. |
| Credentials/cookie | `VITE_API_WITH_CREDENTIALS` | Boolean string `true/1`; truyền vào axios `withCredentials`. |
| Storage URL | `VITE_STORAGE_URL` | Optional; validate URL nếu có; empty fallback theo logic storage util. |
| Feature flags | `VITE_ENABLE_ANALYTICS`, `VITE_ENABLE_DEBUG`, `VITE_ENABLE_PERF_MONITOR` | Boolean string; chưa thấy hard-code bật prod trong config mẫu. |

Env mẫu hiện tại trong `.env.example`:

| Biến | Giá trị mẫu / trạng thái |
| --- | --- |
| `VITE_APP_ENV` | `local` |
| `VITE_APP_TITLE` | `WMS Hoa Nam` |
| `VITE_APP_VERSION` | `1.0.0` |
| `VITE_API_BASE_URL` | `https://astrodev.test8.io.vn/api/v1` |
| `VITE_API_HEALTH_PATH` | `/health` |
| `VITE_API_TIMEOUT_MS` | `10000` |
| `VITE_API_WITH_CREDENTIALS` | `false` |
| `VITE_STORAGE_URL` | empty |
| Feature flags | false |

Production note: giá trị prod thật không được commit vào repo. DevOps cần inject qua environment
của pipeline/hosting và xác nhận domain/CORS/cookie policy khớp với `VITE_API_WITH_CREDENTIALS`.

## 6. Build configuration đã rà soát

| Hạng mục | Nguồn | Kết quả |
| --- | --- | --- |
| Framework | `package.json`, `vite.config.ts` | React + TypeScript + Vite SPA. |
| Build script | `npm.cmd run build` | Chạy `tsc -b && vite build`. |
| Alias | `vite.config.ts` | `@` trỏ về `./src`. |
| Chunk split | `vite.config.ts` | Có `manualChunks` cho React, data, form, AntD, rc, emotion, dayjs, utils, vendor. |
| Chunk warning limit | `vite.config.ts` | `1500`; build hiện không vượt hard error. |
| Health artifact | `scripts/check-frontend-health.mjs`, `dist/health.json` | Check pass; contract `status=ok`, `service=wms-hoa-nam-frontend`. |
| Static output | `dist/` | `dist/index.html`, `dist/assets/*`, `dist/health.json`. |

Build warning cần theo dõi:

| Warning | Ảnh hưởng hiện tại | Disposition |
| --- | --- | --- |
| Vite cảnh báo `__dirname` không được hỗ trợ bởi `configLoader: 'native'` trong future major version | Không làm fail build ngày 2026-08-01 | FE1 nên tạo follow-up kỹ thuật đổi sang `import.meta.dirname` ở `vite.config.ts`; warning không phải P0/P1 blocker cho build hiện tại. |
| Plugin timings: `vite:css-post`, `rolldown:vite-resolve` chiếm thời gian đáng kể | Không làm fail build | Theo dõi nếu CI build time vượt SLA; chưa cần đổi cấu hình nếu pipeline vẫn đạt thời gian cho phép. |

## 7. API/runtime behavior đã rà soát

| Hạng mục | Nguồn code | Kết quả |
| --- | --- | --- |
| Axios base | `src/shared/api/axios.ts` | Dùng `runtimeConfig.apiBaseUrl`, `apiTimeoutMs`, `apiWithCredentials`. |
| Auth header | `src/shared/api/axios.ts`, `memoryStorage` | Tự gắn `Authorization: Bearer <token>` nếu có token. |
| 401 handling | `src/shared/api/axios.ts` | Gom request đồng thời vào một lần refresh; retry request gốc một lần; refresh fail thì logout và về login. |
| 403 password change | `src/shared/api/axios.ts` | `PASSWORD_CHANGE_REQUIRED` redirect `/change-password` nếu chưa ở màn này. |
| 403 no permission | `src/shared/api/axios.ts` | Đánh dấu `_isNoPermission=true` để UI render trạng thái không có quyền. |
| 422 validation | `src/shared/api/axios.ts` | Đánh dấu `_isValidationError=true`. |
| 409 conflict | `src/shared/api/axios.ts` | Đánh dấu `_isConflictError=true`. |
| Idempotency key | `src/shared/api/axios.ts` | Tự thêm cho endpoint cấp/cấp lại tài khoản nhân sự theo pattern hiện có. |
| Error display | `src/shared/components/feedback/ApiErrorAlert.tsx` | Chuẩn hóa message, field errors; 403 render `NoPermissionState`. |

Kết luận: runtime API surface có nền tảng phù hợp cho prod check. Phần chưa đóng là đối chiếu
mapping endpoint/payload toàn bộ vì thiếu file evidence mapping trong repo hiện tại.

## 8. RBAC/UI state đã rà soát

| Acceptance area | Nguồn code | Kết quả |
| --- | --- | --- |
| Route-level RBAC | `src/app/router/RequirePermission.tsx` | Permission rỗng cho authenticated user; super admin bypass; array permission dùng OR; thiếu quyền chuyển về route no-permission. |
| Permission state | `src/shared/store/auth.store.ts` | `permissionCodes` gắn với active context, không phải union toàn tài khoản. |
| Action-level permission | `src/modules/auth/components/Can.tsx`, `src/shared/components/feedback/ActionDropdown.tsx`, `src/lib/permissions/index.ts` | Có helper render action theo permission/scope; tránh gọi hook trong loop sai pattern. |
| API 403 UI | `ApiErrorAlert`, `NoPermissionState` | 403 thường hiển thị state không có quyền nhất quán. |
| Loading | `TableContainer`, `LoadingState`, `PageSkeleton`, `FormModal/FormDrawer/FormPage` | Có skeleton/loading button/state chuẩn cho table/page/form. |
| Empty | `TableContainer`, `EmptyState`, `FilteredEmptyState`, `DataTable` locale | Có empty state cho chưa có dữ liệu và filter không có kết quả. |
| Error | `ApiErrorAlert`, `ErrorBoundary`, `ErrorState` | Có parser API error và boundary fallback. |
| Disabled/confirm | `FormActions`, `ConfirmButton`, `ConfirmDialog`, `ActionDropdown` | Có loading/disabled và confirm cho action phù hợp. |
| Success | `sonner` toast usage và shared feedback components | Có nền tảng feedback success; cần QA kiểm trên từng workflow cụ thể. |

Kết luận: cơ chế UI state/RBAC đáp ứng yêu cầu nền tảng của Jira. Với từng màn nghiệp vụ,
BA/QA vẫn cần kiểm wording/rule/field theo specification riêng; FE1 không tự chốt nếu thiếu spec.

## 9. Evidence lệnh đã chạy

Môi trường chạy: Windows PowerShell trong workspace `C:\HoaNamFE\Hoa_Nam_Tools`, ngày
2026-08-01 ICT. Do PowerShell chặn `npm.ps1` theo Execution Policy, evidence dùng `npm.cmd`.

| Gate | Command | Kết quả |
| --- | --- | --- |
| Lint | `npm.cmd run lint` | Pass, exit code 0. |
| Unit test | `npm.cmd run test` | Pass: 35 test files, 297 tests. |
| Build | `npm.cmd run build` | Pass, exit code 0; Vite built in 31.45s. |
| Health artifact | `npm.cmd run health:check` | Pass: `Frontend build exposes /health.json and index.html.` |
| Health contract | `Get-Content dist\health.json` | `status=ok`, `service=wms-hoa-nam-frontend`, `component=frontend`, `healthcheck=static`. |
| API mapping | `npm.cmd run check:api-mapping -- --no-live` | Fail do thiếu file `docs/api-evidence/M1_API_MAPPING.md`; chưa phải endpoint mismatch. |
| Git status | `git status --short` | Không chạy được do Git `dubious ownership`; chưa đổi global safe.directory. |

Build output quan sát được:

| Artifact | Trạng thái |
| --- | --- |
| `dist/index.html` | Có sau build. |
| `dist/assets/*.js/css` | Có sau build; chunk lớn nhất quan sát: `vendor-antd` khoảng 1,276.77 kB raw / 387.03 kB gzip. |
| `dist/health.json` | Có và pass health contract. |

## 10. Acceptance Criteria mapping

| Acceptance Criteria từ Jira | Evidence / đánh giá | Trạng thái |
| --- | --- | --- |
| Output “FE prod check” được rà soát/xác minh, gắn evidence vào HN-DEVOPS-004 và không còn blocker thuộc vai trò FE1. | Tài liệu này là output FE prod check; lint/test/build/health pass. Cần gắn file/evidence này vào HN-DEVOPS-004/Jira. | Pass có điều kiện |
| UI đáp ứng quy tắc nghiệp vụ, field specification và responsive; xử lý loading, empty, error, success, disabled và confirm khi phù hợp. | Cơ chế shared UI state đã có; chưa kiểm từng màn responsive bằng screenshot trong task này. | Pass nền tảng, cần QA/BA kiểm màn cụ thể |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu hoặc quy tắc trái contract. | Có `RequirePermission`, permission store theo active context, `ApiErrorAlert`, 403 handling. Chưa phát hiện hard-code runtime trái contract trong phạm vi build/runtime. | Pass nền tảng |
| Tích hợp đúng endpoint/payload đã duyệt; lint, build và test phù hợp phải pass. | Lint/test/build pass. Endpoint/payload mapping chưa xác minh toàn bộ do thiếu `docs/api-evidence/*`. | Pass partial, còn blocker evidence |
| BA/QA có evidence để kiểm tra; không còn P0/P1 blocker chưa có disposition. | Evidence lệnh đã ghi. Blocker API mapping được ghi owner/ETA bên dưới; không thấy P0/P1 build/runtime blocker thuộc FE1. | Pass có điều kiện |

## 11. Blocker, risk và disposition

| Mã | Loại | Mô tả | Owner đề xuất | ETA/Điều kiện đóng | Severity |
| --- | --- | --- | --- | --- | --- |
| WWHN-296-B01 | Blocker evidence/API mapping | `npm.cmd run check:api-mapping -- --no-live` fail vì thiếu `docs/api-evidence/M1_API_MAPPING.md`; script cũng kỳ vọng `M2_DEPENDENCY_LIST.md`, `M3_DEPENDENCY_LIST.md`. | FE1 phối hợp BE/BA hoặc owner tài liệu API evidence | Bổ sung đúng các file mapping hoặc cập nhật script theo location hiện hành; chạy lại command pass hoặc có warning có disposition. | P1 cho API mapping sign-off, không chặn build artifact |
| WWHN-296-R01 | Runtime/DevOps dependency | Giá trị prod thật của `VITE_API_BASE_URL`, `VITE_API_WITH_CREDENTIALS`, CORS/cookie policy chưa được xác nhận trong repo. | DevOps - HN-DEVOPS-004-ST01 | DevOps cung cấp env prod/UAT và xác nhận deploy config ngoài repo. | P1 trước prod deploy |
| WWHN-296-R02 | Future tooling warning | Vite warning về `__dirname` khi configLoader native thành default trong future major. | FE1 | Follow-up đổi sang `import.meta.dirname` hoặc suppress có chủ đích sau review. | P2 |
| WWHN-296-R03 | Git workspace metadata | `git status --short` bị Git chặn vì dubious ownership giữa repo owner và sandbox user. | Local workspace owner / FE1 | Chạy `git config --global --add safe.directory C:/HoaNamFE/Hoa_Nam_Tools` nếu cần kiểm status/commit trong môi trường này. | P2 |
| WWHN-296-R04 | README script drift | README nhắc `test:e2e`, `test:coverage` nhưng `package.json` chưa có scripts tương ứng. | FE1 | Bổ sung scripts hoặc cập nhật README để tránh handover lệch. | P2 |

Không ghi nhận blocker build/runtime P0/P1 thuộc FE1 sau khi lint, unit test, build và health check
đã pass. Các P1 còn lại nằm ở evidence/API mapping và DevOps runtime input trước production sign-off.

## 12. Checklist bàn giao BA/QA/DevOps

| Người nhận | Checklist cần kiểm |
| --- | --- |
| BA/QA | Dùng build đã pass để kiểm các màn nghiệp vụ có đủ loading, empty, error, success, disabled, confirm; kiểm wording/field/enum/status theo spec đã duyệt. |
| QA | Chạy lại lint/test/build/health trên máy/CI độc lập; bổ sung screenshot responsive nếu nghiệm thu UI cụ thể. |
| QA/BE | Sau khi có `docs/api-evidence/*`, chạy lại `npm.cmd run check:api-mapping -- --no-live`; nếu có credential runtime, chạy không `--no-live` để kiểm permission catalog live. |
| DevOps | Inject env prod/UAT ngoài repo; xác nhận API base URL, CORS, cookie/credentials, deploy static artifact, cache policy và health route `/health.json`. |
| FE1 | Gắn tài liệu/evidence vào HN-DEVOPS-004/WWHN-296; tạo follow-up cho Vite `__dirname`, README script drift và API evidence missing. |

## 13. Definition of Done đánh giá

| DoD | Trạng thái | Ghi chú |
| --- | --- | --- |
| Code/review/lint/build/test hoàn tất | Pass phần lint/build/test tại workspace ngày 2026-08-01 | Review code formal/PR không nằm trong phạm vi lệnh local này. |
| Evidence UI và traceability hoàn tất | Pass tài liệu traceability; UI evidence nền tảng có trong code | Cần screenshot/e2e theo màn nếu QA yêu cầu. |
| Contract mismatch có disposition | Có disposition cho blocker thiếu API mapping docs | Chưa thể kết luận toàn bộ endpoint/payload pass. |
| Tài liệu component/build cập nhật khi cần | File này cập nhật output FE prod check; tài liệu build/component liên quan đã tồn tại | README script drift cần follow-up. |
| BA/QA có thể kiểm theo AC | Có checklist và evidence commands | Cần BA/QA xác nhận formal sign-off. |
| Không còn blocker chưa có owner/ETA | Đã gán owner đề xuất và điều kiện đóng cho từng blocker/risk | P1 còn lại cần xử lý trước production sign-off. |

## 14. Kết luận FE prod check

FE build/runtime baseline hiện đủ điều kiện bàn giao **có điều kiện** cho luồng production
readiness:

- `lint`, `unit test`, `build`, `health:check` đã pass.
- Runtime config có validator tập trung, không phụ thuộc hard-code API base URL trong code.
- Axios/RBAC/API error/UI state foundation đáp ứng yêu cầu nền tảng của WWHN-296.
- Chưa đóng được API endpoint/payload mapping toàn bộ vì thiếu `docs/api-evidence/*`.
- Cần DevOps xác nhận runtime values prod/UAT và CORS/cookie policy ngoài repo trước prod sign-off.

Disposition đề xuất: gắn tài liệu này vào HN-DEVOPS-004/WWHN-296, đồng thời mở follow-up cho
`WWHN-296-B01` và `WWHN-296-R01` trước khi đánh dấu production readiness hoàn tất.
