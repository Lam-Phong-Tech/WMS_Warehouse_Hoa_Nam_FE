# WWHN-292 - Khắc phục lỗi UI/responsive/RBAC

## 1. Thông tin Jira và traceability

| Trường | Giá trị |
| --- | --- |
| Jira task | WWHN-292 |
| Tiêu đề | [FE1] Khắc phục lỗi UI/responsive/RBAC |
| Loại issue | Subtask |
| Project | WMS_Warehouse__Hoa_Nam |
| Trạng thái khi đọc | To Do |
| Priority | Medium |
| Labels | Contingency, FE1, HoaNam, Wave-4 |
| Assignee | FE1 - Quang Nguyễn Thanh |
| Task cha | WWHN-78 - [FIX][FE] Khắc phục lỗi UAT UI/responsive |
| Dependency | HN-UAT-003 |
| Parent Temp Key | HN-FIX-FE-001 |
| Epic Temp Key | HN-EPIC-10 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Output đầu ra | FE lỗi đã khắc phục |
| Link nguồn | https://tan0110.atlassian.net/browse/WWHN-292 |
| Ngày cập nhật tài liệu | 2026-08-01 ICT |

Tài liệu này là artifact bám theo Description của WWHN-292. Phạm vi chính là rà soát và
định nghĩa đầy đủ hướng khắc phục lỗi FE liên quan UI, responsive và RBAC trong đợt UAT.
Mọi kết luận dưới đây giữ nguyên traceability của task cha WWHN-78/HN-FIX-FE-001 và
không tự mở rộng sang thay đổi nghiệp vụ hoặc API contract khi chưa có BA/BE phê duyệt.

## 2. Mục tiêu

Mục tiêu của WWHN-292 là đưa các lỗi UI/responsive/RBAC thuộc vai trò FE1 về trạng thái
đã khắc phục, có evidence đủ để BA/QA kiểm tra, và không còn blocker P0/P1 chưa có
disposition.

Mục tiêu cần được hiểu ở 6 lớp, không chỉ là sửa style bề mặt:

| Lớp kiểm | Câu hỏi phải trả lời | Kết quả cần đạt |
| --- | --- | --- |
| UI nghiệp vụ | Màn hình có bám đúng rule, field specification, wording, required/optional, enum/status đã duyệt không? | Không tự suy diễn rule; mọi khác biệt phải trace về BA/BAS hoặc task cha. |
| UI state | Mỗi workflow có loading, empty, error, success, disabled và confirm khi phù hợp không? | Không để người dùng bấm lặp, hiểu sai trạng thái, hoặc mất feedback sau mutation. |
| Responsive | Layout desktop/tablet/mobile có đọc được, thao tác được, không tràn/che nút/action không? | Bảng, form, modal/drawer, toolbar, sidebar/header phải có breakpoint hợp lý. |
| RBAC route/action | User thiếu quyền có bị chặn đúng route/action không? | Route guard, menu/action visibility hoặc disabled state phải dùng permission source đã duyệt. |
| API error/RBAC error | 401/403/422/409/500 có hiển thị đúng ngữ cảnh không? | 403 permission denied không bị lẫn với password-change-required hoặc validation error. |
| Evidence bàn giao | BA/QA có đủ log, screenshot/video, account/role scenario, build/version để verify không? | Evidence có nguồn, ngày giờ, môi trường, command và outcome rõ ràng. |

## 3. Input đầu vào đã đọc từ Jira

| Input | Ý nghĩa trong WWHN-292 | Cách sử dụng khi thực hiện |
| --- | --- | --- |
| Task cha WWHN-78 | Nguồn tổng hợp lỗi UAT UI/responsive cần FE xử lý. | Mọi lỗi con phải trace về danh sách UAT hoặc evidence trong task cha; không tạo scope mới ngoài WWHN-78. |
| Dependency HN-UAT-003 | Nguồn dependency UAT, baseline hoặc evidence cần hoàn tất trước nghiệm thu. | Nếu thiếu dữ liệu UAT, account/role test, expected UI hoặc screenshot lỗi gốc thì ghi blocker kèm owner/ETA. |
| Baseline nghiệp vụ | Quy tắc nghiệp vụ, field specification, Acceptance Criteria do BA/BAS cung cấp. | FE chỉ triển khai/điều chỉnh UI theo baseline đã duyệt; không hard-code rule tồn kho hoặc workflow. |
| API/UI specification | Endpoint, payload, validation, error code, permission, dữ liệu mẫu từ BE1/BE2 và BA. | Đối chiếu service/types/error parser/RBAC trước khi sửa UI; mismatch phải phản hồi ngay. |
| Evidence tham chiếu | Screenshot/video/log trong task cha hoặc Source & Traceability. | Dùng làm before/after evidence, không xóa hoặc thay thế bằng nhận định không có bằng chứng. |

## 4. Vai trò và phối hợp

| Bên | Trách nhiệm | Điểm phối hợp bắt buộc |
| --- | --- | --- |
| FE1 - Quang Nguyễn Thanh | Chủ sở hữu chính của phần khắc phục UI/responsive/RBAC và evidence FE. | Sửa đúng surface FE, cập nhật tài liệu/evidence, chạy lint/build/test phù hợp, báo mismatch ngay. |
| BA/BAS | Cung cấp rule nghiệp vụ, UI/UX, field spec, Acceptance Criteria và điểm chưa chốt. | Xác nhận expected wording/state/field/enum trước khi FE chốt nghiệm thu. |
| BE1/BE2 | Cung cấp endpoint, payload, validation, error code, permission và dữ liệu mẫu. | Là source of truth cho API contract, RBAC enforcement và error payload. |
| DevOps | Cung cấp build/environment nếu lỗi chỉ xuất hiện ở UAT/runtime cụ thể. | Xác nhận env, base URL, cookie/CORS, deployed build/version khi cần capture UAT evidence. |
| QA | Kiểm tra lại scenario UAT, responsive, RBAC, API error và regression. | Dùng checklist trong tài liệu này để đánh dấu pass/fail, attach evidence và mở blocker nếu còn lỗi. |

Nguyên tắc phối hợp: FE1 được quyền sửa layout, state handling, component wiring, guard UX
và cách hiển thị lỗi ở frontend. FE1 không được tự sửa API contract, tự thêm permission code
không có nguồn, hoặc hard-code dữ liệu mẫu để làm xanh một scenario UAT.

## 5. Baseline kỹ thuật trong repo cần đối chiếu

| Nhóm | Nguồn repo | Vai trò trong WWHN-292 |
| --- | --- | --- |
| Router/RBAC | `src/app/router/access.ts`, `src/app/router/RequirePermission.tsx`, `src/app/router/ProtectedRoute.tsx` | Route-level permission, anonymous redirect, no-permission redirect. |
| Permission helpers | `src/lib/permissions`, `src/shared/components/permission`, `src/modules/auth/components/Can.tsx` | Action-level guard, disabled/hidden action và permission scope. |
| Auth/session | `src/shared/store/auth.store.ts`, `src/modules/auth/services/auth.service.ts`, `src/shared/api/axios.ts` | Active context permission, token/session, 401/403 handling. |
| API error | `src/shared/api/api-error.ts`, `src/shared/components/feedback/ApiErrorAlert.tsx`, `src/shared/components/feedback/NoPermissionState.tsx` | Chuẩn hóa hiển thị API error, permission denied và field errors. |
| UI state foundation | `src/shared/components/data-display`, `src/shared/components/feedback`, `src/shared/components/forms` | Loading, empty, error, success, disabled, confirm, modal/drawer/form/table. |
| Component catalog | `src/modules/component-catalog/ComponentCatalogPage.tsx` | Surface kiểm tra nhanh UI state dùng chung cho BA/QA. |
| Layout/navigation | `src/app/layouts/*`, `src/index.css`, `src/shared/design-tokens.ts` | Responsive shell, sidebar, header, breadcrumb, page spacing. |
| Module pages | `src/modules/*/pages/*Page.tsx` | Nơi lỗi UAT thực tế thường xuất hiện: table, form, toolbar, action, empty/error/RBAC. |
| Test/evidence scripts | `e2e/*.spec.ts`, `scripts/capture-*.mjs`, `scripts/visual-regression-layout.mjs` | Capture screenshot/video, role navigation, permission 403, responsive evidence. |

## 6. Phạm vi khắc phục chi tiết

### 6.1 UI state bắt buộc

| State | Yêu cầu | Dấu hiệu pass |
| --- | --- | --- |
| Loading | Query/mutation/table/form/action phải có loading rõ ràng. | Không hiển thị dữ liệu cũ như dữ liệu mới; action đang chạy bị khóa hoặc hiển thị progress. |
| Empty | Phân biệt dữ liệu thật sự rỗng và kết quả rỗng do filter/search. | Có message/action phù hợp, không để bảng trắng hoặc layout nhảy khó hiểu. |
| Error | API/network/error nghiệp vụ hiển thị được message có ích. | `ApiErrorAlert`/`ErrorState`/toast dùng parser chung, không nuốt lỗi. |
| Success | Mutation thành công có feedback và refresh dữ liệu liên quan. | Toast/message đúng ngữ cảnh; query invalidate/refetch hoặc update cache rõ ràng. |
| Disabled | Action không hợp lệ, thiếu quyền, đang submit hoặc thiếu dữ liệu phải bị khóa. | Không gọi API khi action chưa đủ điều kiện; tooltip/message nếu UX cần giải thích. |
| Confirm | Action rủi ro như post/apply/reverse/delete/status transition phải confirm nếu phù hợp. | Confirm text bám nghiệp vụ, cancel không tạo side effect, confirm có loading/error. |

### 6.2 Responsive bắt buộc

| Surface | Điểm cần kiểm | Expected |
| --- | --- | --- |
| App shell | Sidebar/header/breadcrumb/content ở desktop/tablet/mobile. | Không che nội dung, không mất navigation chính, scroll hợp lý. |
| Table/list | Search/filter/pagination/action toolbar/columns. | Mobile không tràn action quan trọng; cột có ưu tiên hiển thị hoặc scroll ngang có kiểm soát. |
| Form | Label/input/error/help text/submit action. | Input không tràn, error không đè field tiếp theo, action sticky/visible nếu form dài. |
| Modal/drawer | Kích thước, scroll nội dung, footer action. | Mobile có chiều rộng phù hợp, footer không bị che, focus/close hoạt động. |
| State panels | Empty/error/no-permission/loading. | Nội dung vừa container, không dùng hero text quá lớn trong panel nhỏ. |
| Dangerous actions | Confirm dialog và dropdown actions. | Action không bị cắt chữ, menu không ra ngoài viewport, confirm đọc được trên mobile. |

Breakpoint evidence tối thiểu nên capture: desktop 1440x900, tablet 768x1024, mobile
390x844. Với bảng hoặc form phức tạp, cần thêm viewport 1366x768 để kiểm tra chiều cao
thực tế trên laptop phổ biến.

### 6.3 RBAC và permission bắt buộc

| Layer | Yêu cầu | Dấu hiệu pass |
| --- | --- | --- |
| Anonymous user | Không được thấy protected UI hoặc `/errors/403` trực tiếp trước khi xác thực. | Redirect về login, giữ `state.from` nếu cần quay lại sau login. |
| Authenticated thiếu route permission | Không vào được route cần quyền. | Route guard chuyển sang no-permission state/page nhất quán. |
| Menu/sidebar | Menu không tạo đường tắt sai quyền. | Menu item bị ẩn/disable theo permission source; không dựa vào text label hoặc route heuristic. |
| Action-level permission | Button/dropdown/form submit theo quyền và scope. | Thiếu quyền thì hide/disable hoặc render no-permission UX theo spec. |
| API 403 | Backend deny vẫn được hiển thị đúng dù FE action guard bị bypass. | `ApiErrorAlert` hoặc no-permission state, không crash và không coi là validation error. |
| Active context | Đổi công ty/chi nhánh/kho phải refresh permission set. | Permission dùng active context, không dùng union quyền cũ sau context switch. |

Ghi chú bảo mật: RBAC trên FE chỉ là UX gate. BE vẫn là authority cho security, data scope và
permission enforcement. FE không được coi việc ẩn button là đủ để bảo vệ dữ liệu.

### 6.4 API/error contract bắt buộc

| Nhóm lỗi | Cách FE phải xử lý |
| --- | --- |
| 401/session expired | Thử refresh/retry theo interceptor; thất bại mới logout/redirect. |
| 403 permission denied | Hiển thị no-permission UX, không lẫn với route anonymous hoặc password-change-required. |
| `PASSWORD_CHANGE_REQUIRED` | Đi theo flow đổi mật khẩu riêng, không render 403 generic. |
| 422 validation | Map field errors vào đúng input nếu backend trả field-level errors. |
| 409 conflict/lock | Hiển thị conflict theo message backend; không tự resolve nghiệp vụ trên FE. |
| 500/network | Có error state/toast có retry nếu phù hợp; không mất dữ liệu form đang nhập nếu có thể. |

## 7. Checklist module cần rà soát trong đợt UAT UI/responsive/RBAC

| Module / surface | UI/responsive cần kiểm | RBAC/API error cần kiểm | Trạng thái tài liệu |
| --- | --- | --- | --- |
| Auth/session | Login, change password, profile, loading bootstrap. | 401 refresh, 403 password change, logout clear cache. | Có baseline từ auth/session docs; cần capture lại nếu UAT báo lỗi mới. |
| Dashboard | KPI/card/filter responsive, loading/error. | Quyền xem dashboard/report summary. | Cần QA xác định scenario lỗi từ WWHN-78. |
| Master Data | Table, filter, form modal/drawer, import/export, empty/error. | Quyền tạo/sửa/xóa/import/export, validation 422. | Cần đối chiếu field spec và screenshot UAT. |
| Scan/Physical Codes | Scan input, duplicate/recent code, mobile scanning flow. | `scan.classify`, API error khi mã không hợp lệ/thiếu quyền. | Cần evidence mobile và role thiếu quyền. |
| Inbound/Receiving | Receiving table/form/post action, confirm và disabled state. | Permission post receipt, validation/error payload. | Cần BE/QA sample cho post/lock/conflict. |
| Putaway | Task list, action state, responsive toolbar. | Permission thao tác putaway và 403 từ API. | Cần scenario UAT cụ thể. |
| Outbound/Shipping | Shipping table/action/post issue, insufficient stock state. | Permission post issue, 409/422/403. | Cần contract/error sample đã duyệt. |
| Inventory | Trace/search/filter/pagination responsive. | Quyền xem movement/stock và data-scope. | Cần kiểm role theo active context. |
| Stocktake | Count/apply adjustment form, confirm, disabled. | Permission apply adjustment, idempotency/conflict/error. | Cần QA evidence cho action rủi ro. |
| Warranty | Status/rule display, form/table responsive. | Permission manage warranty, enum/status errors. | Cần BA xác nhận status/rule final. |
| Reverse/Reversal | Create reversal form, reference validation, confirm. | Permission reversal, conflict/error display. | Cần sample payload/error từ BE. |
| Reports | Report filters/export responsive. | Quyền xem/export report, API error. | Cần role matrix và report endpoint final. |
| Audit logs | Table/detail drawer/filter responsive. | Quyền xem audit logs, no-permission/API error. | Có service/test baseline; cần screenshot nếu UAT yêu cầu. |
| Component catalog | Shared UI state review. | No-permission/API error demo. | Nên dùng làm evidence foundation cho BA/QA. |

## 8. Quy trình xử lý từng lỗi UAT

Mỗi lỗi UI/responsive/RBAC trong WWHN-78 nên được xử lý theo checklist sau:

| Bước | Việc cần làm | Evidence bắt buộc |
| --- | --- | --- |
| 1. Nhận lỗi | Ghi lại link/screenshot/video, module, route, role/account, viewport, environment, build version. | Before evidence từ UAT hoặc task cha. |
| 2. Phân loại | UI state, responsive, RBAC route, RBAC action, API error, contract mismatch hoặc data issue. | Nhãn phân loại trong note/PR/evidence. |
| 3. Đối chiếu baseline | So với BA spec, API contract, permission catalog, component pattern và task dependency. | Nguồn đối chiếu rõ: Jira/doc/code path. |
| 4. Sửa đúng scope | Chỉ sửa FE surface thuộc lỗi; không đổi contract hoặc rule nếu chưa duyệt. | File thay đổi, lý do thay đổi, affected module. |
| 5. Kiểm thử local | Chạy test phù hợp, lint/build nếu ảnh hưởng shared hoặc routing/RBAC. | Command, ngày giờ, pass/fail. |
| 6. Capture after evidence | Chụp cùng scenario với before, đủ viewport/role/error state. | Screenshot/video sau sửa, account/role, viewport. |
| 7. Ghi disposition | Nếu pass: mark fixed. Nếu chưa pass do external: ghi blocker owner/ETA. | Bảng blocker/disposition cập nhật. |

## 9. Acceptance Criteria mapping

| Acceptance Criteria từ Jira | Mapping trong tài liệu này | Trạng thái hiện tại |
| --- | --- | --- |
| Output “FE lỗi đã khắc phục” được rà soát/xác minh, gắn evidence vào HN-Khắc phục-FE-001 và không còn blocker thuộc FE1. | Tài liệu này định nghĩa artifact output, trace WWHN-292/WWHN-78/HN-FIX-FE-001 và checklist evidence. | Documentation ready; cần chạy/capture evidence thực tế theo từng lỗi trong WWHN-78 trước khi đóng hoàn toàn. |
| UI đáp ứng quy tắc nghiệp vụ, field specification và responsive; xử lý loading, empty, error, success, disabled và confirm khi phù hợp. | Mục 6.1, 6.2 và 7 phân rã state/responsive/module checklist. | Có checklist đầy đủ; pass cuối phụ thuộc screenshot UAT và BA/QA verify từng module. |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu hoặc quy tắc trái contract. | Mục 6.3 và 6.4 nêu rõ route/action/API 403/error contract và nguyên tắc không hard-code. | Có baseline kỹ thuật; cần role/account evidence từ UAT để xác nhận từng quyền. |
| Tích hợp đúng endpoint/payload đã duyệt; lint, build và test phù hợp phải pass. | Mục 5, 6.4 và 12 liệt kê nguồn code/commands cần chạy. | Pending verification mới nhất cho WWHN-292; không ghi pass nếu chưa chạy lại sau sửa lỗi. |
| BA/QA có evidence để kiểm tra; không còn P0/P1 blocker chưa có disposition. | Mục 8, 10, 11 và 13 cung cấp workflow evidence, blocker table, checklist BA/QA. | Đạt về mặt tài liệu; blocker còn lại phải được cập nhật khi có lỗi cụ thể từ WWHN-78. |

## 10. Definition of Done đánh giá

| DoD từ Jira | Điều kiện đóng | Trạng thái |
| --- | --- | --- |
| Code, review, lint/build/test, evidence UI và traceability hoàn tất. | Có danh sách file sửa, PR/review hoặc note review, command pass, screenshot/video before-after. | Pending theo từng lỗi UAT cụ thể; tài liệu traceability đã tạo. |
| Contract mismatch đã được xử lý hoặc có disposition; tài liệu component/build được cập nhật khi cần. | Mismatch endpoint/payload/permission/error có owner BA/BE/DevOps và ETA; docs liên quan được cập nhật nếu đổi pattern. | Có cơ chế disposition; chưa có mismatch cụ thể trong WWHN-292 được cung cấp ngoài dependency HN-UAT-003. |
| BA/QA có thể kiểm tra theo Acceptance Criteria; không còn blocker chưa có owner và ETA. | Checklist BA/QA rõ, evidence đủ viewport/role/module, blocker table không có dòng thiếu owner. | Documentation ready; cần BA/QA dùng checklist để nghiệm thu. |

## 11. Blocker, risk và disposition

| Mã | Loại | Mô tả | Owner đề xuất | Điều kiện đóng | Severity |
| --- | --- | --- | --- | --- | --- |
| WWHN-292-B01 | Input/evidence | WWHN-292 chưa chứa danh sách lỗi UI/responsive/RBAC cụ thể; Jira chỉ tham chiếu task cha WWHN-78 và dependency HN-UAT-003. | BA/QA + FE1 | Gắn danh sách lỗi hoặc evidence từ WWHN-78/HN-UAT-003 vào artifact, mỗi lỗi có module/route/viewport/role. | P1 cho nghiệm thu đầy đủ |
| WWHN-292-B02 | RBAC evidence | Cần account/role/permission matrix UAT để xác nhận route/action/API 403 đúng theo dữ liệu thực tế. | BE2/RBAC owner + QA | Có account test, expected permission, actual evidence pass/fail theo từng route/action. | P1 |
| WWHN-292-B03 | Contract/API error | Một số lỗi API/error state chỉ xác minh được khi có sample payload/error code từ BE hoặc môi trường UAT. | BE1/BE2 | BE cung cấp sample hoặc UAT API trả lỗi có thể reproduce; FE capture display sau sửa. | P1 nếu đang chặn lỗi UAT |
| WWHN-292-R01 | Responsive visual evidence | Checklist responsive chỉ đủ đóng khi có screenshot/video sau sửa ở các viewport mục tiêu. | FE1 + QA | Có after evidence desktop/tablet/mobile cho module bị ảnh hưởng. | P1 nếu lỗi UAT là responsive |
| WWHN-292-R02 | Regression shared component | Sửa shared component có thể ảnh hưởng nhiều module. | FE1 | Chạy test shared/module liên quan, lint/build, và capture ít nhất module đại diện. | P2/P1 tùy blast radius |
| WWHN-292-R03 | Documentation encoding | Một số tài liệu cũ trong thư mục hiển thị lỗi encoding khi đọc bằng shell. | FE1/Tech Lead | Chuẩn hóa UTF-8 trong đợt docs cleanup nếu BA/QA gặp khó đọc. | P2 |

Không nên chuyển WWHN-292 sang Done nếu còn P0/P1 blocker thực tế chưa có owner/ETA hoặc
chưa có after evidence cho lỗi UAT đã sửa.

## 12. Verification commands đề xuất

Chạy trong workspace `C:\HoaNamFE\Hoa_Nam_Tools`, dùng `npm.cmd` trên Windows để tránh
vướng PowerShell Execution Policy với `npm.ps1`.

| Mục đích | Command |
| --- | --- |
| Lint toàn FE | `npm.cmd run lint` |
| Unit/integration tests | `npm.cmd run test` |
| Build production | `npm.cmd run build` |
| Health artifact sau build | `npm.cmd run health:check` |
| API mapping nếu có đủ docs evidence | `npm.cmd run check:api-mapping -- --no-live` |
| Route/RBAC tests trọng điểm | `npm.cmd test -- --run src/app/router/RequirePermission.test.tsx src/app/router/ProtectedRoute.test.tsx src/app/router/access.test.ts src/shared/store/auth.store.test.ts` |
| API error/session tests trọng điểm | `npm.cmd test -- --run src/shared/api/axios.test.ts src/shared/api/axios.refresh.integration.test.ts src/shared/api/api-error.test.ts src/app/bootstrap-auth.test.ts` |
| Permission action tests | `npm.cmd test -- --run src/shared/components/permission/PermissionGuard.test.tsx src/shared/components/permission/ActionButton.test.tsx` |

Nếu có sửa responsive hoặc UI layout, cần bổ sung screenshot/video bằng Playwright hoặc script
capture phù hợp trong `scripts/`/`e2e/`. Kết quả evidence phải ghi rõ command, ngày giờ,
branch/commit hoặc build version, environment, account/role và viewport.

## 13. Checklist BA/QA nghiệm thu

| Nhóm kiểm | Checklist |
| --- | --- |
| Traceability | Mỗi lỗi có link WWHN-78 hoặc evidence HN-UAT-003, module/route, role/account, viewport và trạng thái fixed/blocker. |
| UI state | Loading, empty, error, success, disabled, confirm xuất hiện đúng ở workflow bị ảnh hưởng. |
| Responsive | Desktop/tablet/mobile không tràn layout, không che action, không mất context, bảng/form/modal/drawer thao tác được. |
| RBAC route | User anonymous, user thiếu quyền, user đủ quyền và super admin/context phù hợp được kiểm theo expected. |
| RBAC action | Button/dropdown/form submit hide/disable/allow đúng quyền; API 403 vẫn hiển thị đúng nếu BE deny. |
| API error | 401/403/422/409/500 có message/field/state đúng, không crash và không mất dữ liệu nhập không cần thiết. |
| Regression | Module không nằm trong lỗi nhưng dùng shared component bị sửa được smoke test lại. |
| Evidence | Có before/after screenshot/video/log, viewport, account/role, env, build/version và command pass/fail. |

## 14. Output đầu ra

Output Jira yêu cầu: **FE lỗi đã khắc phục**.

Output trong repo cho task này:

- `docs/Task_docs_Jira/Khắc phục lỗi UI_responsive_RBAC.md`

Output thực tế cần gắn vào HN-Khắc phục-FE-001/WWHN-292 khi đóng task:

- Danh sách lỗi UAT đã sửa, trace về WWHN-78 hoặc HN-UAT-003.
- Danh sách file/code surface đã thay đổi.
- Evidence before/after cho UI/responsive/RBAC/API error.
- Log lint/build/test phù hợp.
- Blocker còn lại nếu có, mỗi blocker có owner và ETA.

## 15. Kết luận FE1

WWHN-292 đã được phân rã thành checklist thực thi đủ sâu cho UI/responsive/RBAC: có
traceability Jira, input/dependency, baseline kỹ thuật, phạm vi state/responsive/RBAC/API
error, module coverage, quy trình xử lý lỗi UAT, AC mapping, DoD mapping, blocker/disposition
và verification commands.

Trạng thái tài liệu hiện tại: **ready for FE execution and BA/QA verification planning**.
Để đóng task ở mức “FE lỗi đã khắc phục”, cần bổ sung evidence thực tế từ WWHN-78/HN-UAT-003
và chạy lại verification commands sau khi các lỗi cụ thể đã được sửa trong code.
