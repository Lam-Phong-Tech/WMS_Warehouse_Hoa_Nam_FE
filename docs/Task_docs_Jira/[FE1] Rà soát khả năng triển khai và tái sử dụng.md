# WWHN-148 - [FE1] Rà soát khả năng triển khai và tái sử dụng

## 1. Thông tin Jira và traceability

| Trường | Giá trị |
| --- | --- |
| Jira task | `WWHN-148` |
| Tiêu đề | `[FE1] Rà soát khả năng triển khai và tái sử dụng` |
| Loại issue | Subtask |
| Trạng thái khi đọc | `In Progress` |
| Priority | Medium |
| Assignee | Quang Nguyễn Thanh |
| Reporter | Wuangg |
| Task cha | `WWHN-30` - `[UX] Đặc tả field và trạng thái UI cho luồng core` |
| Dependency | `HN-UX-002-ST01` |
| Parent Temp Key | `HN-UX-002` |
| Epic Temp Key | `HN-EPIC-02` |
| Role | `FE1` |
| Assignee Placeholder | `HN-FE-01` |
| Output đầu ra | `FE Rà soát` |
| Link nguồn | https://tan0110.atlassian.net/browse/WWHN-148 |
| Ngày cập nhật tài liệu | 2026-08-01 ICT |

Tài liệu này là artifact `FE Rà soát` cho `WWHN-148`. Phạm vi không phải chỉ ghi nhận "có thể làm được"
hay "có component dùng lại", mà phải xác định rõ khả năng triển khai, mức độ tái sử dụng, điểm cần khóa
contract, evidence cần bàn giao cho BA/QA, và blocker còn lại theo đúng vai trò FE1. FE không tự suy diễn
quy tắc nghiệp vụ, không đổi API contract, không hard-code dữ liệu/rule trái baseline.

## 2. Đọc kỹ yêu cầu Jira

### 2.1 Mục tiêu

Jira yêu cầu: **Rà soát khả năng triển khai và tái sử dụng**. Với task cha `WWHN-30`, mục tiêu này cần được
hiểu ở 7 lớp:

| Lớp rà soát | Câu hỏi cần trả lời | Kết quả cần đạt |
| --- | --- | --- |
| Baseline nghiệp vụ | UI hiện tại có bám field specification, trạng thái, rule và luồng core từ BA/BAS không? | Có bảng trace; điểm thiếu phải ghi blocker với owner. |
| API/payload | Endpoint, payload, validation, error code và dữ liệu mẫu đã đủ để FE tích hợp chưa? | Xác định phần có thể triển khai ngay, phần chỉ pass có điều kiện. |
| UI state | Có loading, empty, error, success, disabled và confirm cho từng workflow không? | Dùng shared pattern; không để page trắng, nút bấm lặp hoặc lỗi bị nuốt. |
| RBAC/permission | Route/action/API 403 có guard và hiển thị đúng không? | FE UX gate có bằng chứng; BE vẫn là authority. |
| Responsive | Layout có đủ khả năng chạy desktop/tablet/mobile cho BA/QA kiểm thử không? | Có checklist viewport và script/evidence cần capture. |
| Reuse | Component/hook/service/type nào dùng lại được, điều kiện dùng lại là gì? | Tránh copy-paste; dùng lại đúng abstraction hiện có. |
| Evidence/DoD | BA/QA có đủ log, command, screenshot, role scenario, contract disposition không? | Không còn P0/P1 blocker thiếu owner/ETA thuộc FE1. |

### 2.2 Input đầu vào

| Input từ Jira | Cách FE1 sử dụng |
| --- | --- |
| Task cha `WWHN-30` | Nguồn field specification và trạng thái UI cho luồng core. Mọi kết luận phải trace về task cha hoặc baseline BA/API/UI. |
| Dependency `HN-UX-002-ST01` | Dependency cần có để chốt field/state/UI behavior. Nếu thiếu, ghi blocker thay vì tự chế rule. |
| Baseline nghiệp vụ | Dùng để xác định rule tồn kho, scan, post, kiểm kê, bảo hành, reversal, PV/report. FE không sở hữu rule đột biến tồn. |
| API/UI specification | Dùng để đối chiếu `src/shared/api/endpoints.ts`, service functions, TypeScript types, error handling và permission guard. |
| Dữ liệu mẫu/evidence | Dùng để BA/QA reproduce và nghiệm thu. Mock/wireframe chỉ là baseline UX, không phải bằng chứng tích hợp production. |

### 2.3 Vai trò và phối hợp

| Bên | Trách nhiệm trong WWHN-148 | Điểm phối hợp bắt buộc |
| --- | --- | --- |
| FE1 - Quang Nguyễn Thanh | Rà soát khả năng triển khai, reuse FE, evidence UI/RBAC/build/test, cập nhật artifact này. | Không tự sửa contract; phản hồi mismatch ngay. |
| BA/BAS | Cung cấp rule nghiệp vụ, UI/UX, field specification, Acceptance Criteria, open point đã xử lý. | Chốt field/enum/status/copy/rule trước final sign-off. |
| BE1/BE2 | Cung cấp endpoint, payload, validation, error code, permission, dữ liệu mẫu. | Khóa contract và permission catalog; cung cấp sample 403/409/422/idempotency. |
| DevOps | Cung cấp build/environment nếu evidence phụ thuộc runtime/UAT. | Base URL, env, cookie/CORS, build version và health check. |
| QA | Dùng checklist/evidence để verify theo Acceptance Criteria. | Ghi pass/fail theo module, viewport, role và API error scenario. |

## 3. Baseline repo đã rà soát

| Nhóm | Nguồn trong repo | Nhận định FE1 |
| --- | --- | --- |
| Kiến trúc FE | `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`, `src/app`, `src/modules`, `src/shared` | React/Vite/TypeScript SPA theo module; phù hợp để triển khai luồng core theo bounded context. |
| Wireframe BA | `BA_HOA_NAM/WMS_HoaNam_Wireframe_P0.html` | Có baseline màn Dashboard, SKU, Scan, Inbound, Outbound, Inventory, Stocktake, Warranty, Reverse, Reports, state và permission. |
| API contract local | `swagger-api.json`, `src/shared/api/endpoints.ts`, module services | FE có endpoint constants và service layer tập trung; một số endpoint vẫn conditional vì cần BE lock/samples. |
| RBAC | `src/app/router/access.ts`, `src/app/router/RequirePermission.tsx`, `src/shared/components/permission/*`, `src/app/layouts/menu.tsx` | Có route guard, menu filtering, action guard; cần BE2 xác nhận catalog permission final. |
| API error | `src/shared/api/http.ts`, `src/shared/api/api-error.ts`, `src/shared/types/api-response.ts`, `ApiErrorAlert` | Có parser envelope/error/field errors; targeted tests pass. |
| UI state/reuse | `src/shared/components/ui-states`, `src/shared/components/feedback`, `src/shared/hooks/useTablePattern.ts`, component catalog | Có foundation cho loading/empty/error/no-permission/confirm/form/table. |
| Evidence scripts | `scripts/capture-*.mjs`, `scripts/visual-regression-layout.mjs`, `e2e/*.spec.ts` | Có nền để capture responsive/RBAC/permission; API mapping script cần file evidence còn thiếu. |

## 4. Kết luận tổng thể

| Hạng mục | Kết quả FE rà soát | Disposition |
| --- | --- | --- |
| Khả năng triển khai | **Có thể triển khai theo hướng incremental, không cần thay kiến trúc lớn** | Module boundaries, endpoint constants, service layer và shared UI/RBAC đủ để tiếp tục. |
| Khả năng tái sử dụng | **Tốt ở foundation; cần kỷ luật dùng lại khi triển khai module** | Dùng lại `http`, `API_ENDPOINTS`, permission guards, table/form/state patterns; tránh tạo pattern riêng cho từng page. |
| API/payload readiness | **Conditional pass** | Nhiều service đã có idempotency/type normalization, nhưng final production pass phụ thuộc BE lock endpoint/payload/error/permission. |
| UI state readiness | **Pass ở foundation, conditional ở module workflow action** | List/detail/loading/error đã có ở nhiều module; action rủi ro như post/apply/reverse cần confirm/evidence theo contract final. |
| RBAC readiness | **Conditional pass** | FE route/menu/action gate đã có; permission catalog runtime từ BE2/BA vẫn cần sign-off. |
| Responsive readiness | **Conditional pass** | Layout foundation và scripts sẵn; cần capture đầy đủ viewport sau khi có build/evidence cụ thể. |
| Build/test readiness | **Pass cho lint/build/targeted tests đã chạy; API mapping blocked do thiếu evidence file** | Chi tiết ở mục 11. |

Kết luận: `WWHN-148` có thể bàn giao dưới dạng **FE readiness + reuse review có điều kiện**. Không còn blocker
thuộc phạm vi tài liệu/rà soát FE1 chưa có disposition. Tuy nhiên không nên coi đây là final production
sign-off cho mọi luồng core nếu BE/BA chưa khóa đầy đủ contract và QA chưa gắn evidence runtime.

## 5. Đánh giá khả năng tái sử dụng

### 5.1 Component và hook dùng lại được ngay

| Nhu cầu | Reuse source | Điều kiện dùng lại |
| --- | --- | --- |
| Loading page/route | `PageSkeleton`, Suspense fallback trong `src/app/router/index.tsx` | Dùng cho route lazy và detail loading; không tạo spinner riêng nếu không cần. |
| Empty/error/no-permission | `EmptyState`, `ErrorState`, `ApiErrorAlert`, `NoPermissionState` | Message phải bám module, error dùng parser chung. |
| Confirm/disabled action | `ConfirmButton`, `ConfirmDialog`, `ActionButton` | Dùng cho post receipt, post issue, apply adjustment, reverse, status transition. |
| Table/list state | `useTablePattern`, data-display components | Dùng cho list có search/filter/pagination/export. |
| Form field | `FormInput`, `FormSelect`, `FormNumber`, `FormDatePicker`, `FormTextarea`, `useApiFormErrors` | Field name/validation phải từ spec BA/BE; không tự thêm rule trái contract. |
| Permission check | `RequirePermission`, `PermissionGuard`, `ActionButton`, `usePermission` | Code permission phải từ catalog đã duyệt hoặc ghi conditional. |
| API service | `http`, `API_ENDPOINTS`, `getApiErrorMessage`, `extractFieldErrors` | Tất cả API calls đi qua shared wrapper; không gọi axios trực tiếp ở module. |
| Export | `src/shared/utils/export-xlsx.ts`, report services | Chỉ dùng khi BE contract/export payload đã xác nhận. |

### 5.2 Module patterns nên tiếp tục tái sử dụng

| Pattern | Module đã có ví dụ | Áp dụng cho |
| --- | --- | --- |
| List + filter + detail modal | Receiving/Inbound, Outbound/Shipping, Inventory, Audit logs | Danh sách chứng từ, tồn, trace, bảo hành, kiểm kê. |
| Service normalization nhiều biến thể field | Receiving, Shipping, Stocktake, Warranty, Reverse | Giai đoạn contract chưa ổn định, nhưng phải xóa dần khi BE lock. |
| Idempotency header | Receiving `postInboundReceipt`, Shipping `postOutboundIssue`, Stocktake `applyStocktakeAdjustment`, Warranty status, Reverse create | Mọi mutation có tác động tồn/trạng thái/hồ sơ cần chống double submit. |
| Route permission map dùng chung với menu | `ROUTE_PERMISSIONS` + `menu.tsx` | Mọi route WMS mới; tránh menu và route guard lệch nhau. |
| Component catalog làm evidence foundation | `src/modules/component-catalog/ComponentCatalogPage.tsx` | BA/QA kiểm tra nhanh shared state trước khi đi từng module. |

### 5.3 Anti-pattern cần tránh

| Anti-pattern | Rủi ro | Cách xử lý |
| --- | --- | --- |
| Copy một table/form riêng cho từng page | Khó đồng bộ loading/empty/error/responsive | Dùng shared table/form hooks và component catalog baseline. |
| Tự suy diễn status/action hợp lệ ở FE | Sai rule nghiệp vụ, double stock effect | Chỉ disable/hide theo contract; BE là authority. |
| Hard-code sample data làm evidence | BA/QA hiểu nhầm là integration pass | Ghi rõ mock/prototype; evidence cuối phải từ API hoặc scripted scenario. |
| Gọi endpoint string trực tiếp | Mismatch và khó audit | Thêm/sửa `API_ENDPOINTS` có trace trước khi dùng. |
| Bỏ qua 403 API vì đã có button guard | Bypass FE vẫn lỗi xấu | Luôn render API 403 bằng parser/no-permission UX. |

## 6. Đánh giá triển khai theo module core

| Module / surface | Hiện trạng triển khai | Khả năng reuse | Kết luận FE |
| --- | --- | --- | --- |
| Dashboard | Service gọi `DASHBOARD_KPI`, recent docs, reconcile health, alerts. | Reuse API wrapper, KPI/list state. | Conditional pass; cần BE xác nhận endpoint reports/dashboard final và data sample. |
| Master Data / SKU | Có module master-data, services, types, OpenAPI note chuyển sang `products/product-categories/uoms/suppliers`. | Reuse form/table/validation/import/export patterns. | Conditional pass; field spec SKU/product cần BA/BE khóa để tránh legacy `/skus`. |
| Scan / Physical codes | Có scan classify service/types/UI state machine và route permission `inventory.trace`/`scan.classify`. | Reuse scan state pattern cho inbound/outbound. | Readiness pass; final pass cần response sample duplicate/unknown/invalid/permission. |
| Inbound / Receiving | Có list/detail/lines, scan, post receipt, close remainder, reverse service; idempotency + `If-Match`. | Reuse cho outbound và các workflow chứng từ. | Conditional pass; action UI final cần BE contract và QA happy/negative evidence. |
| Putaway | Có tasks/history service và page riêng. | Reuse list/history state. | Conditional pass; cần xác nhận rule putaway không sinh movement và action permission final. |
| Outbound / Shipping | Có list/detail/lines, scan, post issue, close remainder, reverse service; idempotency + `If-Match`. | Reuse inbound pattern. | Conditional pass; cần BE sample insufficient-stock/409/422. |
| Inventory / Trace | Có balances, stock movements, trace source endpoints. | Reuse table/filter/detail state. | Conditional pass; cần data scope/RBAC và reconciliation evidence. |
| Stocktake | Có sessions, snapshots, counts, variances, apply adjustment service với idempotency. | Reuse mutation confirm/idempotency pattern. | Conditional pass; action apply adjustment cần confirm/evidence và BE error sample. |
| Warranty | Có cases/events/create/status service; status enum bao gồm `TEMP_ONLY`. | Reuse status transition, PII/RBAC patterns. | Conditional pass; cần BA final rule/status/PII/export. |
| Reverse / Reversal | Có documents/lines/create service với idempotency. | Reuse risky action confirm + API error. | Conditional pass; cần BE confirm reversible_qty/conflict/audit response. |
| Reports | Có reports hub, XNT, export Excel, warranty defects endpoint. | Reuse filters/export/error state. | Conditional pass; endpoint export và permission `report.view`/export cần xác nhận. |
| Audit logs | Có service/test baseline. | Reuse detail drawer/filter/pagination. | Pass ở baseline; cần screenshot nếu BA/QA dùng làm evidence UAT. |

## 7. RBAC và API error review

| Layer | Nguồn FE hiện tại | Kết quả | Open point |
| --- | --- | --- | --- |
| Route guard | `src/app/router/access.ts`, `RequirePermission` | Routes WMS đã map permission theo OR logic khi cần. | BE2/BA cần xác nhận catalog permission final. |
| Menu filtering | `src/app/layouts/menu.tsx` dùng `ROUTE_PERMISSIONS` | Menu và route dùng cùng source, giảm lệch quyền. | Cần role/account evidence runtime. |
| Action-level guard | `ActionButton`, `PermissionGuard`, `usePermission` | Có pattern reusable cho hide/disable/action confirm. | Các action post/apply/reverse cần gắn permission cụ thể theo contract. |
| API 403 | `ApiEnvelopeError`, `getApiErrorMessage`, `NoPermissionState`, `ApiErrorAlert` | Có parser và component hiển thị. | Cần sample API 403 cho từng module trọng yếu. |
| Field errors | `extractFieldErrors`, `useApiFormErrors` | Có khả năng map 422 vào form. | BE phải trả `errors`/field pointer ổn định. |
| Session/password | Auth guard/interceptor/tests trong repo | Có phân biệt auth/session và permission ở foundation. | Cần UAT account để capture evidence cuối. |

Nguyên tắc nghiệm thu: FE guard chỉ là UX. Nếu user bypass UI và BE trả 403, UI vẫn phải hiển thị lỗi có ích,
không crash, không coi đó là validation lỗi thường, và không lộ dữ liệu ngoài quyền.

## 8. UI state và responsive review

| State / surface | Tiêu chuẩn FE | Evidence/source hiện có | Kết luận |
| --- | --- | --- | --- |
| Loading | Route, list, detail, mutation phải có loading riêng. | `PageSkeleton`, page-level `loading`, Ant Design table loading. | Pass foundation; module evidence cần capture. |
| Empty | Phân biệt empty data và empty do filter. | `EmptyState`, component catalog, table patterns. | Pass foundation. |
| Error | API/network/business error render bằng parser chung. | `ApiErrorAlert`, `ErrorState`, `api-error` tests. | Pass foundation. |
| Success | Mutation thành công có feedback và refresh. | Existing module service/action patterns; cần UI final theo flow. | Conditional. |
| Disabled | Disable khi pending/invalid/missing permission/wrong status. | `ActionButton`, page buttons `disabled/loading`. | Pass foundation; action rule cần contract final. |
| Confirm | Action rủi ro cần confirm trước side effect. | `ConfirmButton`, `ConfirmDialog`, component catalog. | Pass foundation; cần áp dụng cho post/apply/reverse. |
| Responsive shell | Sidebar/header/content hoạt động desktop/tablet/mobile. | Layout components + visual scripts. | Conditional; cần screenshot 1440x900, 1366x768, 768x1024, 390x844. |
| Tables/forms/modals | Không tràn, không che action, error text không đè field. | Shared patterns và BA wireframe. | Conditional; cần module screenshots. |

## 9. Checklist triển khai sâu cho từng phần

| Bước | Việc FE1 cần làm | Không được làm |
| --- | --- | --- |
| 1. Khóa input | Đọc task cha, dependency, field spec, OpenAPI/Jira, sample data. | Không tự thêm field/status/rule để "cho chạy được". |
| 2. Map endpoint | Đối chiếu `API_ENDPOINTS` với BE contract; ghi mismatch. | Không gọi string endpoint trực tiếp trong page. |
| 3. Map payload/type | Tạo hoặc cập nhật TypeScript types theo contract; dùng parser chung. | Không để `any` lan rộng trong form/action quan trọng nếu contract đã rõ. |
| 4. Build UI state | Dùng shared loading/empty/error/success/disabled/confirm. | Không để state trắng, toast chung chung, double submit. |
| 5. Gắn RBAC | Route/menu/action/API 403 theo permission catalog. | Không dựa vào role name hoặc text label. |
| 6. Kiểm thử | Chạy lint/build/test targeted, API mapping, E2E nếu có env. | Không ghi pass nếu command chưa chạy hoặc bị blocked. |
| 7. Capture evidence | Screenshot/video/log theo viewport/role/error/success. | Không dùng mock screenshot như bằng chứng integration final. |
| 8. Bàn giao | Cập nhật blocker owner/ETA/disposition cho BA/QA. | Không để P0/P1 blocker thiếu owner. |

## 10. Acceptance Criteria mapping

| Acceptance Criteria từ Jira | Mapping trong tài liệu này | Trạng thái |
| --- | --- | --- |
| Output `FE Rà soát` được rà soát/xác minh, gắn evidence vào `HN-UX-002` và không còn blocker thuộc vai trò FE1. | Artifact này ghi trace WWHN-148/WWHN-30/HN-UX-002/HN-UX-002-ST01, kết luận readiness/reuse và blocker/disposition. | **Đạt ở phạm vi tài liệu FE rà soát**; evidence runtime cần attach vào `HN-UX-002`/Jira theo quy trình dự án. |
| UI đáp ứng quy tắc nghiệp vụ, field specification và responsive; xử lý loading, empty, error, success, disabled và confirm khi phù hợp. | Mục 6, 8, 9 phân rã theo module/state/responsive/action. | **Conditional pass**; foundation pass, module final cần field spec/contract và screenshots. |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu hoặc quy tắc trái contract. | Mục 7 nêu route/menu/action/API 403/field error/session. | **Conditional pass**; FE UX gate pass, BE permission catalog/sample 403 cần sign-off. |
| Tích hợp đúng endpoint/payload đã duyệt; lint, build và test phù hợp phải pass. | Mục 6 và 11 ghi endpoint/services/types và command thực tế. | **Lint/build/targeted tests pass**; API mapping script blocked do thiếu evidence file. |
| BA/QA có evidence để kiểm tra; không còn P0/P1 blocker chưa có disposition. | Mục 12 và 13 cung cấp checklist evidence và blocker owner/ETA. | **Đạt về disposition**; cần BA/QA/BE attach runtime evidence còn thiếu. |

## 11. Nhật ký xác minh local

Thời điểm chạy: 2026-08-01 ICT, workspace `C:\HoaNamFE\Hoa_Nam_Tools`.

| Command | Kết quả | Ghi chú |
| --- | --- | --- |
| `npm.cmd run lint` | **Pass** | ESLint hoàn thành 0 errors. |
| `npm.cmd run build` | **Pass** | `tsc -b` và Vite build thành công; 3368 modules transformed. Vite cảnh báo future `configLoader: native` liên quan `__dirname` trong `vite.config.ts`, không chặn build. |
| `npm.cmd run test -- src/shared/types/api-response.test.ts src/shared/types/permission.test.ts src/app/router/access.test.ts src/app/router/RequirePermission.test.tsx src/shared/components/permission/ActionButton.test.tsx src/shared/hooks/useTablePattern.test.ts` | **Pass** | 6 test files pass, 94 tests pass. Vitest có cảnh báo future `configLoader: native` liên quan `__dirname` trong `vitest.config.ts`, không chặn test. |
| `npm.cmd run check:api-mapping -- --no-live` | **Blocked / Fail do thiếu input evidence** | Script dừng vì thiếu `docs/api-evidence/M1_API_MAPPING.md`; chưa kết luận mapping mismatch. Cần tạo/cung cấp file evidence hoặc chỉnh script xử lý thiếu file nếu được phê duyệt. |

## 12. Evidence BA/QA cần attach để đóng hoàn toàn

| Evidence | Người phụ trách | Nội dung tối thiểu |
| --- | --- | --- |
| Jira/trace evidence | FE1 + BA/QA | Link artifact này vào `HN-UX-002`/task cha; ghi commit/build hash nếu có. |
| API contract evidence | BE1/BE2 + FE1 | Endpoint/payload/error/permission/sample data cho Dashboard, SKU/Product, Scan, Inbound, Outbound, Inventory, Stocktake, Warranty, Reverse, Reports. |
| Responsive screenshots | FE1 + QA | Desktop 1440x900, laptop 1366x768, tablet 768x1024, mobile 390x844 cho list/detail/form/error/no-permission/action confirm. |
| RBAC evidence | BE2 + QA | User đủ quyền, thiếu route permission, thiếu action permission, API 403 trực tiếp, context switch nếu có. |
| API error evidence | BE1 + QA | 401, 403, 409, 422 field errors, 500/network, idempotency replay/conflict theo module rủi ro. |
| Build/test evidence | FE1 | Lint/build/test logs, API mapping sau khi có `M1_API_MAPPING.md`, E2E nếu env sẵn. |
| UAT sign-off checklist | BA/QA | Pass/fail theo Acceptance Criteria, blocker còn lại có owner/ETA. |

## 13. Blocker, risk và disposition

| ID | Loại | Mô tả | Owner | ETA / điều kiện đóng | Severity |
| --- | --- | --- | --- | --- | --- |
| WWHN-148-B01 | Dependency | `HN-UX-002-ST01` cần cung cấp/chốt đầy đủ field specification, UI state, AC và open point đã xử lý từ task cha. | BA/BAS | Attach/chốt baseline vào `HN-UX-002`; FE cập nhật mapping nếu có thay đổi. | P1 |
| WWHN-148-B02 | API contract | Final endpoint/payload/error code/permission/sample data cho các luồng core chưa thể xác nhận 100% chỉ từ FE repo. | BE1/BE2 | Cung cấp contract locked; FE chạy lại API mapping và targeted module review. | P1 |
| WWHN-148-B03 | RBAC | Permission catalog runtime cần sign-off để xác nhận `ROUTE_PERMISSIONS` và action permissions không lệch BE. | BE2/RBAC owner + BA | Cung cấp catalog/bảng mapping; QA chạy role scenarios. | P1 |
| WWHN-148-B04 | Evidence file | `npm.cmd run check:api-mapping -- --no-live` fail vì thiếu `docs/api-evidence/M1_API_MAPPING.md`. | FE1 + BE1/BA nếu file là artifact contract | Tạo/cung cấp file evidence đúng format hoặc cập nhật script theo approval để graceful fallback. | P1 cho sign-off mapping |
| WWHN-148-R01 | Runtime evidence | Chưa có screenshot/video runtime cho toàn bộ viewport/role/action/error trong artifact này. | FE1 + QA | Capture theo mục 12 sau khi có build/env/sample data. | P1 nếu đóng UAT |
| WWHN-148-R02 | Conditional service normalization | Một số service có normalization nhiều biến thể field để chịu contract chưa ổn định. | FE1 + BE1 | Sau BE lock, giảm normalization fallback và cập nhật type/schema chính thức. | P2 |
| WWHN-148-R03 | Vite/Vitest warning | Cảnh báo future `configLoader: native` do dùng `__dirname` trong config. | FE1/Tech Lead | Đổi sang `import.meta.dirname` trong task kỹ thuật riêng nếu project nâng Vite config loader. | P2 |

Không có P0/P1 blocker nào trong phạm vi **tài liệu rà soát FE1** bị bỏ trống owner/disposition. Các blocker còn lại
thuộc dependency/contract/evidence cần BA/BE/QA phối hợp trước final sign-off sản xuất.

## 14. Definition of Done đánh giá

| DoD từ Jira | Điều kiện đóng | Trạng thái |
| --- | --- | --- |
| Code, review, lint/build/test, evidence UI và traceability hoàn tất. | Artifact có traceability; lint/build/targeted tests pass; evidence UI runtime cần attach khi QA chạy. | **Đạt có điều kiện** |
| Contract mismatch đã được xử lý hoặc có disposition; tài liệu component/build được cập nhật khi cần. | Mismatch/open point được ghi ở mục 13; không đổi contract trong tài liệu này. | **Đạt về disposition** |
| BA/QA có thể kiểm tra theo Acceptance Criteria; không còn blocker chưa có owner và ETA. | Mục 10, 12, 13 cung cấp checklist nghiệm thu và owner. | **Đạt trong phạm vi FE rà soát** |

## 15. Bàn giao FE1

`FE Rà soát` cho `WWHN-148` đã hoàn thiện ở mức readiness/reuse review:

- Có traceability đầy đủ theo Jira `WWHN-148`, task cha `WWHN-30`, dependency `HN-UX-002-ST01`, parent `HN-UX-002`, epic `HN-EPIC-02`.
- Đã rà soát sâu các lớp triển khai: baseline, API/payload, UI state, responsive, RBAC, reuse, evidence.
- Đã xác định rõ phần pass, conditional pass, blocker, owner và điều kiện đóng.
- Đã chạy local verification: lint pass, build pass, targeted tests pass; API mapping blocked do thiếu `M1_API_MAPPING.md` và đã ghi disposition.

Khuyến nghị trạng thái: giữ `WWHN-148` ở **In Progress/Ready for BA-BE-QA evidence attachment** cho đến khi `HN-UX-002-ST01`
và contract/evidence runtime được gắn đủ. Sau khi BA/BE/QA attach evidence mục 12 và API mapping chạy pass,
FE1 có thể cập nhật artifact này thành final pass.

## 16. Cap nhat ra soat sau FE1 - API evidence bo sung ngay 2026-08-01 ICT

Sau khi ra soat lai task `WWHN-148`, FE1 da bo sung bo evidence mapping API de phan kiem chung khong con dung o nhan dinh be mat.

| Artifact bo sung | Noi dung | Ket qua |
| --- | --- | --- |
| `docs/api-evidence/M1_API_MAPPING.md` | Mapping man hinh/action FE voi endpoint contract-ready cho Dashboard, Inventory, Master Data/Product, Inbound, Outbound, Reports. | 38 endpoint rows duoc script doc va doi chieu voi `swagger-api.json`. |
| `docs/api-evidence/M2_DEPENDENCY_LIST.md` | Mapping phu tro cho safe stock, audit logs va danh sach dependency/mismatch cho scan, putaway, safe stock config. | 3 endpoint rows contract-ready pass; cac endpoint chua co trong swagger duoc ghi ro owner/disposition. |
| `docs/api-evidence/M3_DEPENDENCY_LIST.md` | Mapping late-core/high-risk cho stock movement, reports va dependency cua stocktake, warranty, reversal. | 4 endpoint rows contract-ready pass; cac workflow rui ro duoc giu conditional, khong tu sign-off thay BE/BA. |

### 16.1 Ket qua chay lai API mapping

Command da chay:

```bash
npm.cmd run check:api-mapping -- --no-live
```

| Hang muc | Ket qua cap nhat |
| --- | --- |
| Hard error method/path | **0 errors** |
| Endpoint rows script doc duoc | **45 rows** (`M1=38`, `M2=3`, `M3=4`) |
| Doi chieu swagger local | **Pass** cho toan bo rows contract-ready; script in duoc `operationId` va Swagger tag tuong ung. |
| Runtime permission catalog | **Warning co chu dich** vi chay `--no-live` va `.env` khong co `VITE_TEST_EMAIL`/`VITE_TEST_PASSWORD`; script fallback sang FE catalog. |
| Coverage warning | **Warning co chu dich** vi mapping evidence chi cover scope WWHN-148/core WMS, khong cover toan bo 288 unique swagger routes. |

Disposition cap nhat cho blocker `WWHN-148-B04`: **da xu ly phan thieu file evidence**. Khong con fail cung do thieu `docs/api-evidence/M1_API_MAPPING.md`. Trang thai moi la **Pass voi warnings can review**, trong do warnings thuoc pham vi runtime credential/catalog va coverage ngoai scope WWHN-148.

### 16.2 Phan loai contract-ready va conditional sau ra soat sau

| Nhom | Contract-ready trong swagger local | Conditional / can BE-BA khoa |
| --- | --- | --- |
| Dashboard | `/reports/dashboard-quick`, `/document-status-history`, `/inventory-snapshots`, `/safe-stock-alerts` | Dashboard hub/sample payload cuoi van can BE/QA evidence runtime. |
| Master Data/Product | `/products`, `/products/{id}`, `/products/{id}/enable`, `/products/{id}/disable`, `/products/{id}/status`, `/product-categories`, `/uoms`, `/suppliers` | Legacy `/skus`, `/items`, `/physical-codes`, SKU import khong duoc coi la production-ready. |
| Inbound | List/create/detail/update/submit/approve/post-receipt/reject/cancel co trong swagger. | Scan, close remainder, reverse chua co trong swagger local; can BE sample/error/idempotency. |
| Outbound | List/create/detail/update/submit/approve/post-issue/reject/cancel co trong swagger. | Scan, close remainder, reverse chua co trong swagger local; can BE sample insufficient-stock/409/422. |
| Inventory/Trace | Balances, stock movements, movement detail, trace source co trong swagger. | Safe stock config chua co trong swagger local. |
| Reports | Inventory XNT va export Excel co trong swagger. | Reports hub va warranty defects chua co trong swagger local. |
| Audit logs | `/audit-logs` co trong swagger va co targeted service test. | Can screenshot/evidence neu dung trong UAT package. |
| Scan/Putaway/Stocktake/Warranty/Reversal | Chua du contract-ready trong swagger local theo evidence moi. | Giu conditional; da ghi owner/disposition trong `M2_DEPENDENCY_LIST.md` va `M3_DEPENDENCY_LIST.md`. |

### 16.3 Ket luan cap nhat cho WWHN-148

`WWHN-148` hien co the ban giao o muc **FE readiness/reuse review sau co evidence file**, khong con thieu artifact API mapping. Tuy nhien FE1 van khong duoc nang toan bo luong core thanh final production pass cho den khi:

- BE/BA khoa cac endpoint conditional da liet ke trong `docs/api-evidence/M2_DEPENDENCY_LIST.md` va `docs/api-evidence/M3_DEPENDENCY_LIST.md`.
- QA/FE capture runtime evidence cho viewport, role, 403, 409, 422, confirm va success mutation.
- Runtime permission catalog duoc kiem chung bang account test that thay vi fallback FE catalog.
