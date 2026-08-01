# WWHN-311 - Hoàn thiện tài liệu build/component FE

## 1. Thông tin Jira và truy xuất nguồn

| Trường | Giá trị |
| --- | --- |
| Jira task | WWHN-311 |
| Tiêu đề | [FE1] Hoàn thiện tài liệu build/component FE |
| Loại issue | Subtask |
| Task cha | WWHN-83 - [HANDOVER] Gói bàn giao sản phẩm, kỹ thuật, QA, release và vận hành |
| Trạng thái khi đọc | In Progress |
| Priority | Medium |
| Labels | Committed, FE1, HoaNam, Wave-4 |
| Người chịu trách nhiệm | FE1 - Quang Nguyễn Thanh |
| Reporter | Wuangg |
| Ngày tạo | 2026-07-19 21:28 ICT |
| Cập nhật Jira gần nhất khi đọc | 2026-08-01 19:35 ICT |
| Link nguồn | https://tan0110.atlassian.net/browse/WWHN-311 |

Tài liệu này là output bàn giao cho task WWHN-311. Nội dung được viết theo đúng
Description Jira: Mục tiêu, Input đầu vào, Vai trò và phối hợp, Source &
Traceability, Acceptance Criteria, Output đầu ra, Definition of Done và Phạm vi
thực hiện.

## 2. Mục tiêu

Hoàn thiện tài liệu build/component FE để BA, QA, DevOps và các FE khác có thể
kiểm tra, tái tạo, review và vận hành phần Frontend handover của WMS Hoa Nam.

Mục tiêu không dừng ở việc liệt kê lệnh build. Tài liệu phải trả lời được các
câu hỏi thực tế sau:

- FE được build bằng toolchain nào, lấy cấu hình từ đâu, output nào là artifact
  bàn giao.
- Component dùng chung đang được tổ chức thế nào, component nào là foundation
  cho UI state, form, table, RBAC và feedback.
- Quy tắc tích hợp API, payload, error, endpoint và RBAC được kiểm soát qua đâu.
- BA/QA cần kiểm gì để xác nhận UI đáp ứng loading, empty, error, success,
  disabled, confirm, responsive và permission denied.
- Khi có mismatch giữa Jira/OpenAPI/BE/UI thì FE1 xử lý ra sao, ghi blocker ở
  đâu, ai là owner, và điều kiện đóng là gì.

## 3. Input đầu vào

| Nhóm input | Nguồn trong repo / Jira | Cách sử dụng trong tài liệu |
| --- | --- | --- |
| Task cha | WWHN-83 | Giữ scope handover tổng thể: sản phẩm, kỹ thuật, QA, release và vận hành. |
| Dependency | HN-HO-001-ST01 | Xem là nguồn dependency cần khóa trước khi final sign-off nếu liên quan contract/API/evidence. |
| Baseline kỹ thuật | `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` | Là chuẩn chính cho architecture, module structure, API wrapper, RBAC, build/env/health. |
| Quy tắc review | `system-design.md` | Dùng làm guardrail khi đánh giá code/component: module ownership, shared scope, API, RBAC, test, không hard-code. |
| README dự án | `README.md` | Nguồn nhanh cho scripts, env, project structure, build output, CI/CD baseline. |
| Component foundation | `src/shared/components/README.md` | Nguồn cho taxonomy shared components và quy tắc import/barrel. |
| Table/list pattern | `src/shared/components/data-display/README.md`, `src/shared/components/data-display/TABLE_PATTERN.md` | Nguồn cho DataTable, TableContainer, search/filter/pagination. |
| Permission foundation | `src/shared/components/permission/README.md`, `src/app/router/access.ts`, `src/lib/permissions` | Nguồn cho route/action RBAC UX gate và data scope. |
| Component catalog | `src/modules/component-catalog/ComponentCatalogPage.tsx` | Route nội bộ cho BA/QA xem UI states dùng chung. |
| API contract snapshot | `swagger-api.json`, `src/shared/api/endpoints.ts`, `src/shared/api/http.ts`, `src/shared/api/api-error.ts` | Nguồn đối chiếu endpoint, envelope, error parser, request/response handling. |
| Evidence/sign-off liên quan | `docs/Task_docs_Jira/HN-INT-001-FE-SIGN-OFF.md`, `docs/Task_docs_Jira/HN-TEC-001-FE-CONTRACT-FEEDBACK.md` | Nguồn trace các blocker P0/P1, conditional sign-off, contract mismatch và kết quả lint/build/test trước đó. |

## 4. Vai trò và phối hợp

| Bên liên quan | Trách nhiệm trong WWHN-311 | Điểm phối hợp bắt buộc |
| --- | --- | --- |
| FE1 - Quang Nguyễn Thanh | Chủ sở hữu chính của tài liệu build/component FE và frontend handover. | Không tự đổi contract; cập nhật tài liệu khi có thay đổi build, component, endpoint, permission hoặc evidence. |
| BA/BAS | Cung cấp quy tắc nghiệp vụ, UI/UX, field specification, Acceptance Criteria và điểm chưa chốt. | Xác nhận wording, empty/error/success state, required/optional field, enum/status, formal sign-off. |
| BE1/BE2 | Cung cấp endpoint, payload, validation, error code, permission, dữ liệu mẫu. | Khóa API contract, permission catalog, idempotency, sample response; xử lý mismatch được FE ghi nhận. |
| DevOps | Cung cấp cấu hình build/environment/deploy nếu có dependency. | Xác nhận env variables, dist artifact, health artifact, preview/deploy path, CI/CD command. |
| QA | Kiểm chứng UI, responsive, RBAC, API error, regression, evidence. | Dùng checklist trong tài liệu này để chạy test và đối chiếu pass/fail theo build/version cụ thể. |

Nguyên tắc phối hợp: FE1 phản hồi ngay khi thiếu contract, thiếu UI state hoặc có
khác biệt giữa code, API, UI và data. FE1 không tự suy diễn nghiệp vụ tồn kho,
không tự sửa API contract, không hard-code dữ liệu để thay cho sample được duyệt.

## 5. Source & Traceability

| Field Jira | Giá trị giữ nguyên |
| --- | --- |
| Parent Temp Key | HN-HO-001 |
| Epic Temp Key | HN-EPIC-10 |
| Dependency | HN-HO-001-ST01 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Output name | Frontend handover |

Traceability theo artifact:

| Artifact | Vai trò trace | Điều kiện được coi là hợp lệ |
| --- | --- | --- |
| File này | Tài liệu build/component FE cho WWHN-311 | Có đủ mục Jira yêu cầu, mapping AC, DoD, blocker/disposition và verification commands. |
| `README.md` | Hướng dẫn chạy nhanh repo | Phải đồng bộ nếu script/env/build output thay đổi. |
| `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` | Baseline architecture | Phải đồng bộ nếu đổi structure, API pattern, RBAC, CI/CD. |
| `src/shared/components/README.md` | Baseline shared components | Phải đồng bộ nếu thêm/sửa shared component hoặc convention import. |
| `src/modules/component-catalog/ComponentCatalogPage.tsx` | Evidence UI states | Phải render được các state foundation cho BA/QA kiểm tra. |
| `docs/Task_docs_Jira/HN-INT-001-FE-SIGN-OFF.md` | Conditional FE sign-off | Phải giữ rõ ranh giới FE readiness vs final production integration sign-off. |
| `docs/Task_docs_Jira/HN-TEC-001-FE-CONTRACT-FEEDBACK.md` | Contract feedback | Phải ghi rõ mismatch endpoint/payload/RBAC và owner/disposition. |

## 6. Build handover

### 6.1 Toolchain baseline

| Hạng mục | Baseline hiện tại |
| --- | --- |
| Runtime | Node.js 18+ |
| Package manager | npm hoặc yarn; repo hiện có cả `package-lock.json` và `yarn.lock`, nhưng scripts trong tài liệu evidence dùng `npm.cmd` trên Windows. |
| Framework | React `19.2.6` + TypeScript `~6.0.2` + Vite `8.x` SPA theo `package.json`. |
| UI library | Ant Design `6.4.5`, `@ant-design/icons` `6.2.5`, `sonner` toast. |
| Server state | TanStack Query `5.101.0`. |
| Client state | Zustand `5.0.14` cho auth/session. |
| Form/validation | React Hook Form `7.80.0` + Zod `4.4.3`. |
| Routing | React Router DOM `7.18.0`. |
| Unit test | Vitest `4.1.10` + Testing Library. |
| E2E/evidence | Playwright `1.61.1`, e2e specs trong `e2e/` và các script capture trong `scripts/`. |

### 6.1.1 Đối chiếu nguồn sự thật build/runtime

Khi có khác biệt giữa tài liệu mô tả và repo, thứ tự ưu tiên để build/review là:

| Nhóm | Source truth | Ghi chú kiểm soát |
| --- | --- | --- |
| Version package/toolchain | `package.json`, `package-lock.json`, `yarn.lock` | `package.json` đang là nguồn chính để xác định React/AntD/Router/Vite thực tế. |
| Script có thể chạy | `package.json` | README chỉ là hướng dẫn nhanh; nếu README nhắc script chưa tồn tại thì không coi là build gate hợp lệ. |
| Env template | `.env.example`, `src/shared/config/env.ts` | `.env` local không dùng làm nguồn handover vì có thể chứa cấu hình máy cá nhân. |
| Build artifact | `dist/index.html`, `dist/assets/*`, `dist/health.json` | Được sinh lại bằng `npm.cmd run build`; không sửa tay trong `dist/`. |
| API endpoint FE | `src/shared/api/endpoints.ts`, service từng module | Đối chiếu với `swagger-api.json` và docs `docs/api-evidence/*`; endpoint legacy chỉ dùng khi có ghi chú rõ. |
| RBAC route/action | `src/app/router/access.ts`, `src/shared/components/permission`, `src/lib/permissions` | FE chỉ gate UX; backend/RBAC catalog vẫn là authority cuối. |

Điểm lệch đã xác nhận khi rà soát:

- README ghi Ant Design 5.x và React Router v6, nhưng `package.json` thực tế là Ant Design 6.4.5 và React Router DOM 7.18.0.
- README nhắc `test:e2e` và `test:coverage`, nhưng `package.json` chưa khai báo hai script này.
- `npm.cmd` được dùng cho verification trên Windows để khớp môi trường bàn giao hiện tại; `yarn` vẫn có lockfile nhưng không phải command evidence chính trong lần xác minh này.

### 6.2 Environment

| Biến | Bắt buộc | Ý nghĩa | Giá trị mặc định / ghi chú |
| --- | --- | --- | --- |
| `VITE_APP_ENV` | Có | Environment name: local/dev/uat/prod | `local` |
| `VITE_API_BASE_URL` | Có | API base URL | `http://localhost:8000/api/v1` trong README/.env.example |
| `VITE_API_TIMEOUT_MS` | Không | API timeout milliseconds | `10000` |
| `VITE_API_WITH_CREDENTIALS` | Không | Gửi credentials/cookie với request | `false` |
| `VITE_STORAGE_URL` | Không | Storage/static file base URL | Tùy môi trường |
| `VITE_API_HEALTH_PATH` | Không | API health path nếu cần | `/health` theo tech guide |

Không commit secret/token/API key vào repo. `.env.example` là template; `.env` là
cấu hình local và không dùng làm nguồn truth cho handover.

### 6.3 Commands chuẩn

| Mục đích | Command |
| --- | --- |
| Cài dependency | `npm.cmd install` hoặc `yarn install` |
| Chạy dev | `npm.cmd run dev` hoặc `yarn dev` |
| Lint | `npm.cmd run lint` |
| Format | `npm.cmd run format` |
| Format check | `npm.cmd run format:check` |
| Unit test | `npm.cmd run test` |
| Build production | `npm.cmd run build` |
| Preview production bundle | `npm.cmd run preview` |
| Health artifact check | `npm.cmd run health:check` |
| API mapping check | `npm.cmd run check:api-mapping` |

Lưu ý: `package.json` chưa khai báo `test:e2e` và `test:coverage` mặc dù README có
nhắc. E2E hiện chạy trực tiếp qua Playwright config hoặc các script trong `e2e/`
và `scripts/`. Nếu CI yêu cầu command chính thức, cần bổ sung script hoặc cập nhật
README để tránh lệch handover.

### 6.4 Build output

| Output | Ý nghĩa | Điều kiện kiểm tra |
| --- | --- | --- |
| `dist/index.html` | Entry HTML của production SPA | Tồn tại sau `npm.cmd run build`. |
| `dist/assets/*` | JS/CSS chunks của Vite | Tồn tại sau build, không lỗi TypeScript. |
| `dist/health.json` | Static health artifact cho deploy verification | Kiểm bằng `npm.cmd run health:check`. |

Artifact `dist/` là output build, không phải source truth. Source truth vẫn là code,
config, package lock và tài liệu trace trong repo.

### 6.5 CI/CD handover gate

Một build đủ điều kiện bàn giao cho QA/DevOps nên có tối thiểu:

| Gate | Expected |
| --- | --- |
| Lint | Pass, không có error. Warning phải có disposition nếu còn tồn tại. |
| Unit test | Pass với test count/build version cụ thể. |
| Build | Pass `tsc -b && vite build`. |
| Health check | Pass và xác nhận `dist/health.json`. |
| API mapping | Pass hoặc warning có owner/disposition. |
| E2E/visual evidence | Chạy theo scope thay đổi UI; có screenshot/video khi AC yêu cầu responsive/RBAC/UI state. |

## 7. Component handover

### 7.1 Nguyên tắc tổ chức component

| Rule | Yêu cầu |
| --- | --- |
| Module ownership | UI/logic chỉ dùng một module đặt trong `src/modules/<module>/`. |
| Shared ownership | Component/hook dùng từ 2 module trở lên đặt trong `src/shared/`. |
| App shell | Router, layout, provider, theme đặt trong `src/app/`. |
| Import | Dùng barrel `@/shared/components` hoặc `@/shared/components/forms` khi tiêu thụ shared components. |
| API | Component không gọi API trực tiếp; page/hook/service điều phối data. |
| Permission | Route dùng `RequirePermission`; action dùng `PermissionGuard`, `ActionButton`, `ActionDropdown` theo public barrel. |
| Error | API error hiển thị qua `ApiErrorAlert`, `getApiErrorMessage`, field errors từ shared parser. |

### 7.2 Taxonomy shared components

| Nhóm | Component chính | Mục đích handover |
| --- | --- | --- |
| Layout | `AppShell`, `Sidebar`, `Header`, `Breadcrumb`, `PageHeader` | Khung trang, navigation, breadcrumb, title/action area. |
| Forms | `FormInput`, `TextField`, `FormSelect`, `SelectField`, `FormDatePicker`, `DateField`, `FormNumber`, `FormSwitch`, `FormTextarea`, `SubmitButton`, `FieldError`, `FormError` | Form field nhất quán, validation display, disabled/loading form state. |
| Data display | `TableContainer`, `DataTable`, `TableToolbar`, `StatusBadge`, `StatusTag`, `EmptyState`, `LoadingState`, `TopPagination`, `PageSizeSelector`, `SearchInput`, `FilterBar` | Table/list/search/filter/pagination/status pattern. |
| Feedback | `Modal`, `FormModal`, `FormDrawer`, `FormPage`, `ConfirmButton`, `ConfirmDialog`, `Alert`, `ApiErrorAlert`, `ErrorBoundary`, `Loading`, `DelayedRender`, `AdaptiveDelayedRender`, `ActionDropdown` | Loading/error/success/confirm/modal/drawer/action feedback. |
| Permission | `PermissionGuard`, `ActionButton`, `NoPermissionState` | Action visibility/disabled và permission denied UX. |
| Navigation | `Tabs`, `Pagination`, `MenuItem` | Tab/pagination/menu item reusable. |
| Cards | `StatCard`, `InfoCard` | KPI và thông tin tóm tắt. |
| UI states | `PageSkeleton`, `PlaceholderPage`, `ErrorState` | Page-level loading/placeholder/error. |

### 7.3 Component catalog cho BA/QA

Route nội bộ `src/modules/component-catalog/ComponentCatalogPage.tsx` là evidence
surface cho shared UI. BA/QA dùng route này để kiểm nhanh các trạng thái:

| UI state | Evidence trong catalog | AC liên quan |
| --- | --- | --- |
| Table + pagination | `DataTable` với server pagination props | Field/table layout, empty handling, responsive column. |
| Scan states | `ScanInput` normal, duplicate message, disabled state | Scan UI, disabled, recent code behavior. |
| Loading | `LoadingState`, `PageSkeleton` | Loading state. |
| Empty | `EmptyState` | Empty state. |
| Error | `ErrorState`, `ApiErrorAlert` | Error state và API error envelope. |
| Permission denied | `NoPermissionState` | RBAC/no permission UX. |
| Confirm | `ConfirmButton`, `ConfirmDialog` | Destructive/critical action confirm. |
| Success/error toast | `sonner` toast buttons | Success/error feedback. |
| Modal form | `FormModal` | Form dialog baseline. |

### 7.4 Table/list pattern

Table/list page chuẩn nên đi theo pattern:

- `useTablePattern` giữ search, filters, page, pageSize và sinh API params.
- `TableContainer` chứa title, toolbar, filters, actions, empty state.
- `DataTable` nhận columns, dataSource, loading, pagination, row selection nếu có.
- Pagination/filter phải truyền đúng query backend, không tự lọc dữ liệu lớn ở client
  nếu contract đã là server-side pagination.
- Empty state cần phân biệt danh sách thật sự trống và kết quả trống do filter.

### 7.5 Form pattern

Form chuẩn:

- Dùng React Hook Form + Zod cho validation phía FE khi field spec đã được BA/BE duyệt.
- Dùng `FormInput`, `FormSelect`, `FormDatePicker`, `FormNumber`, `FormSwitch`,
  `FormTextarea` để giữ layout và error nhất quán.
- Field-level errors từ API `errors` phải được map về đúng field nếu backend trả.
- Submit button/action phải disabled khi form invalid, đang submit hoặc thiếu permission.
- Mutation success phải invalidate query liên quan và hiển thị toast/message phù hợp.
- Không tự thêm required/enum/range trái với field specification.

### 7.6 Permission/RBAC component pattern

RBAC trong FE là UX gate, không phải security boundary. Backend vẫn là authority.

| Layer | Pattern |
| --- | --- |
| Route-level | `ROUTE_PERMISSIONS` trong `src/app/router/access.ts` + `RequirePermission`. |
| Action-level | `PermissionGuard`, `ActionButton`, `ActionDropdown`. |
| Permission source | `permission_codes` từ `/auth/me` hoặc catalog BE/RBAC đã duyệt. |
| Scope | Dùng helper từ `@/lib/permissions` hoặc public permission barrel; không tự match theo prefix/heuristic. |
| Missing permission | Hiển thị `NoPermissionState` hoặc disable/hide action theo UX đã chốt. |

Các mã quyền WMS như `scan.classify`, `inventory.trace`, `inbound.post`,
`outbound.post`, `stocktake.count`, `warranty.manage`, `inventory.reversal.post`,
`report.view` chỉ được coi là final khi BE2/RBAC owner hoặc BA/BE mapping đã duyệt.

### 7.7 API/error component pattern

| Contract | FE handling |
| --- | --- |
| Success envelope | `{ success, message, data, meta }` được xử lý qua shared HTTP wrapper. |
| Error envelope | `{ success:false, message, error_code, errors, meta }` được parse qua `api-error.ts`. |
| Query error | Hiển thị `ApiErrorAlert` hoặc `ErrorState` với retry nếu phù hợp. |
| Mutation error | Toast/error message qua `getApiErrorMessage`; field errors map vào form. |
| 401 | Refresh/session flow qua axios/http interceptor. |
| 403 | Phân biệt password-change-required và permission denied; hiển thị no-permission UX. |
| 422 | Field-level errors. |
| 409/lock/conflict | Hiển thị conflict từ backend; không tự resolve nghiệp vụ trên FE. |

## 8. Module coverage cho Frontend handover

| Module / surface | Build/component evidence | Trạng thái bàn giao |
| --- | --- | --- |
| Auth/session | `LoginPage`, `ChangePasswordPage`, `ProfilePage`, `auth.service`, auth store, bootstrap auth tests | Foundation pass; phụ thuộc BE auth contract/runtime. |
| App shell/navigation | `MainLayout`, `SideNav`, `AppHeader`, router guards, access tests | Pass trong phạm vi FE UX gate. |
| Dashboard | Dashboard page/service và endpoint constants | Conditional; endpoint/report contract cần BE xác nhận cuối. |
| Master Data | `MasterPage`, master-data service/types/hooks, table/form patterns | Conditional pass; field spec/enums/import response cần source lock. |
| Scan/Physical Codes | `PhysicalCodesPage`, `ScanInput`, scan service/types | FE readiness có; scan classify path/schema/error sample cần contract final. |
| Inbound/Receiving | Receiving page/service/types, disabled risky action khi payload chưa đủ | FE readiness có; post receipt contract/idempotency/error/RBAC cần BE/QA evidence. |
| Outbound/Shipping | Shipping page/service/types, disabled risky action khi payload chưa đủ | FE readiness có; post issue contract/insufficient-stock/RBAC cần BE/QA evidence. |
| Inventory | Inventory page/service/types | Conditional; movement fields/filter/pagination cần BE confirmation. |
| Stocktake | Stocktake page/service/types, apply adjustment service có idempotency | Conditional; apply adjustment payload/error/permission cần contract final. |
| Warranty | Warranty page/service/types, TEMP_ONLY/status types | Conditional; status enum/rules/error/RBAC cần BA/BE confirmation. |
| Reverse | Reversal page/service/types, create reversal service có idempotency | Conditional; payload/reference rules/error/RBAC cần contract final. |
| Reports | Reports page/service/export XNT | Conditional; reports hub/canonical endpoint cần BE confirmation. |
| Audit logs | Audit logs page/service/tests | Pass trong phạm vi endpoint/pagination đã có. |
| Component catalog | `ComponentCatalogPage` | Pass làm evidence shared UI state cho BA/QA. |

## 9. Acceptance Criteria mapping

| Acceptance Criteria từ Jira | Kết quả trong tài liệu này | Trạng thái |
| --- | --- | --- |
| Output “Frontend handover” được rà soát/xác minh, gắn evidence vào HN-HO-001 và không còn blocker thuộc vai trò FE1. | File này là artifact Frontend handover cho WWHN-311; có trace WWHN-83/HN-HO-001/HN-EPIC-10/HN-HO-001-ST01 và danh sách evidence/check commands. | Đạt trong phạm vi tài liệu; việc gắn vào HN-HO-001/Jira cần thao tác quy trình sau. |
| UI đáp ứng quy tắc nghiệp vụ, field specification và responsive; xử lý loading, empty, error, success, disabled và confirm khi phù hợp. | Đã mô tả component taxonomy, component catalog evidence, table/form/feedback patterns và module coverage. | Conditional pass; nghiệp vụ/field spec final phụ thuộc BA/BE lock. |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu hoặc quy tắc trái contract. | Đã nêu rõ RBAC là UX gate, API error parser, không tự suy diễn permission/contract, các blocker external còn mở. | Conditional pass; permission catalog backend cần confirm. |
| Tích hợp đúng endpoint/payload đã duyệt; lint, build và test phù hợp phải pass. | Đã chạy lại `lint`, `test`, `build`, `health:check`, `check:api-mapping` tại workspace `C:\HoaNamFE\Hoa_Nam_Tools` ngày 2026-08-01. Kết quả pass; warning còn lại đã có disposition ở mục 14-15. | Đạt cho FE verification hiện tại; final production sign-off vẫn phụ thuộc BA/BE/RBAC/QA. |
| BA/QA có evidence để kiểm tra; không còn P0/P1 blocker chưa có disposition. | Có checklist BA/QA, component catalog surface, module coverage và blocker/disposition. | Đạt về documentation; P0/P1 external vẫn có owner/disposition, không bị che khuất. |

## 10. Output đầu ra

Output Jira yêu cầu: **Frontend handover**.

Output trong repo:

- `docs/Task_docs_Jira/Hoàn thiện tài liệu build_component FE.md`

Nội dung output bao gồm:

- Build handover: toolchain, env, commands, artifact, CI/CD gates.
- Component handover: taxonomy, import rules, patterns, UI states, RBAC, API error.
- Traceability: Jira WWHN-311, parent WWHN-83, temp keys, dependency, role, owner.
- AC/DoD mapping: trạng thái từng tiêu chí, điều kiện pass/final.
- Blocker/disposition: các mục chưa thể final do dependency BA/BE/RBAC/QA.

## 11. Definition of Done

| DoD từ Jira | Cách xác minh | Trạng thái |
| --- | --- | --- |
| Code, review, lint/build/test, evidence UI và traceability hoàn tất. | Đã chạy `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test`, `npm.cmd run health:check`, `npm.cmd run check:api-mapping`; chụp UI evidence khi có thay đổi UI cụ thể theo checklist. | Đạt cho scope tài liệu/build verification hiện tại; UI evidence runtime chi tiết vẫn chạy theo module khi QA yêu cầu. |
| Contract mismatch đã được xử lý hoặc có disposition; tài liệu component/build được cập nhật khi cần. | Các mismatch endpoint/payload/RBAC được nêu là conditional/external blocker với owner BA/BE/RBAC/QA. | Đạt về disposition. |
| BA/QA có thể kiểm tra theo Acceptance Criteria; không còn blocker chưa có owner và ETA. | Checklist BA/QA và blocker table bên dưới. | Đạt trong phạm vi FE documentation. |

## 12. Phạm vi thực hiện

Trong scope:

- Hoàn thiện tài liệu build/component FE theo WWHN-311.
- Giữ traceability với WWHN-83, HN-HO-001, HN-EPIC-10, HN-HO-001-ST01.
- Tổng hợp baseline build, env, component, API, RBAC, UI states, CI/CD gates.
- Nêu rõ evidence và checklist BA/QA cần dùng.
- Ghi blocker/disposition thay vì che giấu hoặc tự sửa contract.

Ngoài scope:

- Không thay đổi API contract nếu chưa được BA/BE duyệt.
- Không tự đóng final production integration sign-off thay cho BA/QA/BE/DevOps.
- Không thay thế baseline/reference trong task cha.
- Không mở rộng nghiệp vụ WMS hoặc thay đổi UI/runtime chỉ để tài liệu trông đầy đủ.
- Không hard-code sample data/quy tắc để vượt AC.

## 13. Checklist BA/QA kiểm tra

| Nhóm kiểm tra | Checklist |
| --- | --- |
| Build | Chạy install, lint, test, build, health check; xác nhận `dist/index.html` và `dist/health.json`. |
| Env | Kiểm tra `.env.example` đủ biến chính; không có secret trong source. |
| Component catalog | Mở route component catalog, kiểm loading/empty/error/no-permission/API error/confirm/modal/scan/table. |
| Responsive | Kiểm desktop/tablet/mobile cho layout shell, table, drawer/modal, form field, action toolbar. |
| RBAC | Kiểm route denied, menu filtering, disabled/hidden action, 403 API display. |
| API error | Kiểm 401/403/422/409/500 nếu BE/mock server hỗ trợ; field errors map đúng input. |
| Endpoint/payload | Đối chiếu `src/shared/api/endpoints.ts`, services module và OpenAPI/Jira locked contract. |
| Dangerous action | Post receipt, post issue, apply adjustment, reverse, status transition phải có confirm/loading/disabled/error/success và idempotency nếu contract yêu cầu. |
| Evidence | Screenshot/video/log phải gắn build/version, env, account/permission scenario và Jira/source tương ứng. |

## 14. Blocker và disposition

| ID | Mức độ | Nội dung | Owner | Disposition |
| --- | --- | --- | --- | --- |
| WWHN-311-B01 | P1 | Permission catalog WMS cần BE2/RBAC hoặc BA/BE mapping duyệt để final RBAC evidence. | BE2/RBAC owner + BA/BAS | FE giữ UX gate hiện tại, không tự thêm/sửa permission heuristic. |
| WWHN-311-B02 | P1 | Một số endpoint/payload workflow nhạy cảm như scan classify, post receipt, post issue, stocktake apply adjustment, warranty status, reverse cần contract final và sample/error code. | BE1 + BA/BAS | FE ghi conditional readiness; chỉ final khi contract được khóa và QA xác minh. |
| WWHN-311-B03 | P1 | QA evidence cần build/version/env cụ thể, chưa thể thay thế bằng tài liệu. | QA + FE1 hỗ trợ | Dùng checklist ở mục 13; FE cung cấp commands và component catalog surface. |
| WWHN-311-B04 | P2 | README nhắc `test:e2e`/`test:coverage` nhưng `package.json` hiện chưa khai báo scripts này; README cũng đang ghi AntD 5.x/React Router v6 trong khi package thực tế là AntD 6/React Router 7. | FE1/Tech Lead | Cần thêm scripts hoặc cập nhật README trong task riêng nếu CI/CD yêu cầu command thống nhất; trong WWHN-311, source truth dùng `package.json`. |
| WWHN-311-B05 | P2 | Vitest/Vite cảnh báo `__dirname` trong `vitest.config.ts`/`vite.config.ts` không tương thích với `configLoader: native` mặc định tương lai. | FE1/Tech Lead | Không làm fail lint/test/build hiện tại; nên đổi sang `import.meta.dirname` trong task hardening trước khi nâng major Vite/config loader. |
| WWHN-311-B06 | P2 | `check:api-mapping` pass method/path nhưng mapping docs mới cover 45 endpoint rows trên 288 unique swagger routes và permission catalog runtime bị skip do thiếu `VITE_TEST_EMAIL`/`VITE_TEST_PASSWORD`. | FE1 + BE/RBAC owner | Không phải conflict endpoint; cần RBAC runtime account và mở rộng mapping nếu scope handover yêu cầu phủ toàn swagger. |

## 15. Nhật ký xác minh WWHN-311

Đã chạy tại workspace `C:\HoaNamFE\Hoa_Nam_Tools` ngày 2026-08-01, môi trường Windows/PowerShell:

| Command | Kết quả | Ghi chú handover |
| --- | --- | --- |
| `npm.cmd run lint` | Pass | ESLint chạy trên `src/`, không có error. |
| `npm.cmd run test` | Pass | Vitest: 35 test files, 298 tests passed. Có warning Vite native config loader về `__dirname`, xem WWHN-311-B05. |
| `npm.cmd run build` | Pass | `tsc -b && vite build` pass; sinh `dist/index.html` và chunks trong `dist/assets/`. Có cùng warning `__dirname` ở `vite.config.ts`. |
| `npm.cmd run health:check` | Pass | Script xác nhận frontend build exposes `/health.json` và `index.html`. |
| `npm.cmd run check:api-mapping` | Pass có warning | Không có conflict method/path với `swagger-api.json`; warning: permission runtime fetch bị skip do thiếu credential env và mapping docs cover 45/288 swagger routes. |

Nếu có thay đổi UI hoặc cần evidence trực quan, chạy thêm Playwright/screenshot theo
scope module bị ảnh hưởng và lưu evidence kèm Jira/source. Kết quả phải ghi rõ ngày
giờ, branch/commit hoặc build version, environment, command và pass/fail.

Điều kiện khuyến nghị trước khi chuyển Jira sang Done/Ready for Review:

- Nếu không có thay đổi code/UI sau nhật ký trên, có thể dùng kết quả này làm FE build verification cho WWHN-311.
- Nếu có commit mới, đổi dependency, đổi env, đổi endpoint hoặc đổi RBAC sau 2026-08-01, phải chạy lại toàn bộ 5 command trên.
- Nếu QA cần evidence trực quan, mở component catalog và module bị ảnh hưởng để chụp loading, empty, error, success, disabled, confirm, responsive và permission denied.

## 16. Kết luận bàn giao FE1

WWHN-311 đã được hoàn thiện ở mức tài liệu handover: có đủ source, traceability,
build baseline, component baseline, UI state evidence surface, RBAC/API error
rules, AC mapping, DoD mapping, scope và blocker/disposition.

Trạng thái phù hợp hiện tại là **Frontend handover documentation ready**. Final
production integration sign-off chỉ nên thực hiện sau khi các dependency BA/BE/RBAC/QA
được khóa và verification commands/evidence được chạy lại trên build/version cụ thể.
