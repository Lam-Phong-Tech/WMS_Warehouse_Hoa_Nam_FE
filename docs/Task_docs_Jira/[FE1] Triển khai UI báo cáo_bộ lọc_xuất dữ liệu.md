# [FE1] Triển khai UI báo cáo/bộ lọc/xuất dữ liệu

## 1. Truy xuất Jira và phạm vi

| Thuộc tính | Giá trị |
| --- | --- |
| Jira | WWHN-258 |
| Tiêu đề | [FE1] Triển khai UI báo cáo/bộ lọc/xuất dữ liệu |
| Issue type | Subtask |
| Parent | WWHN-68 - [FE][REPORT] UI dashboard tối thiểu, bộ lọc và xuất dữ liệu |
| Dependency | HN-RPT-001 |
| Parent Temp Key | HN-FE-009 |
| Epic Temp Key | HN-EPIC-10 |
| Role | FE1 |
| Assignee | Quang Nguyễn Thanh |
| Output đầu ra | báo cáo FE |
| Nguồn đọc | Jira WWHN-258, wireframe P0 section 11/12, code hiện tại module reports |

WWHN-258 yêu cầu FE1 triển khai UI báo cáo, bộ lọc và xuất dữ liệu ở mức đủ để BA/QA xác minh. Phạm vi không chỉ là dựng màn hình, mà gồm đối chiếu contract API, trạng thái UI, RBAC, responsive, export behavior, evidence và disposition cho mọi blocker còn lại.

## 2. Diễn giải sâu Mục tiêu

Mục tiêu "Triển khai UI báo cáo/bộ lọc/xuất dữ liệu" được tách thành 6 lớp kiểm soát:

| Lớp | Yêu cầu cần đạt | Không được làm |
| --- | --- | --- |
| Report hub | Hiển thị danh sách báo cáo theo backend hoặc contract đã duyệt; không dùng mock cứng làm bằng chứng production. | Không tự đặt thêm loại báo cáo ngoài HN-RPT-001/WWHN-68 nếu chưa có baseline. |
| Bộ lọc | Filter phải gửi đúng payload/query params, giữ state khi reload/error, phản ánh data scope và timezone Asia/Ho_Chi_Minh. | Không lọc client-side để thay thế scope/permission từ BE nếu contract yêu cầu server-side. |
| Báo cáo XNT | Hiển thị opening, receipt, issue, adjustment, reversal, closing, partial remaining và reconcile theo formula baseline. | Không tự tính closing nếu BE đã trả field canonical; chỉ hiển thị/đối chiếu cảnh báo. |
| Xuất dữ liệu | Export phải dùng cùng filter và data scope với dữ liệu đang xem; có loading/disabled/error; tên file trace được kỳ báo cáo. | Không export dữ liệu vượt quyền hoặc bỏ qua filter hiện tại. |
| RBAC/API error | Route/action gate theo permission; 403/422/409/412/428 hiển thị đúng pattern và không nuốt request_id. | Không coi việc ẩn nút ở FE là bảo mật cuối cùng; BE vẫn là authority. |
| Evidence bàn giao | Có evidence cho responsive, RBAC, loading/empty/error/success/export và log test/lint/build. | Không sign-off khi còn P0/P1 blocker chưa có owner, ETA hoặc disposition. |

## 3. Input đầu vào cần khóa

| Input từ Jira | Cách FE1 sử dụng | Trạng thái hiện tại |
| --- | --- | --- |
| Task cha WWHN-68 | Là nguồn scope chính cho dashboard/report/filter/export. | Cần BE/BA xác nhận endpoint canonical cuối cho `/reports/hub` nếu HN-RPT-001 khác. |
| Dependency HN-RPT-001 | Là nguồn nghiệp vụ/API báo cáo: field, filter, export, data quality, permission. | Chưa thấy file local riêng HN-RPT-001; tạm đối chiếu với wireframe P0 và architecture docs. |
| Baseline nghiệp vụ | Formula XNT, danh sách report P0, privacy warranty, data quality warning. | Có trong `BA_HOA_NAM/WMS_HoaNam_Wireframe_P0.html` section 11/12. |
| API/UI specification | Endpoint, payload, validation, error code, permission. | FE đang có endpoints trong `src/shared/api/endpoints.ts`; cần BE lock cho response shape. |
| Dữ liệu mẫu/evidence | Dùng để chứng minh UI states, export và RBAC. | Chưa có evidence mới gắn trực tiếp WWHN-258 trong docs này. |

## 4. Baseline UI/Business từ wireframe P0

| Màn hình | Baseline bắt buộc | Field/UI chính |
| --- | --- | --- |
| 11A - Report hub | `GET /reports/*`, export qua contract báo cáo, timezone Asia/Ho_Chi_Minh, export cùng filter/data scope. | RPT-INV-01, RPT-XNT-01, RPT-MOV-01, RPT-STK-01, RPT-WAR-01, RPT-IO-01. |
| 11B - Báo cáo XNT | Formula: `closing = opening + receipt - issue + adjust_in - adjust_out + reversal_net`; chỉ quantity POSTED ảnh hưởng XNT; remainder hiển thị riêng. | from, to, SKU/category, movement type, export PDF/XLSX, opening, receipt, issue, adjust in/out, reversal net, closing, partial remaining, reconcile. |
| 11C - Bảo hành theo bệnh | Báo cáo mặc định không lộ tên/SĐT; TEMP_ONLY tách riêng; export PII cần quyền riêng và audit. | from, to, model, defect, total case, processing, returned, TEMP_ONLY. |
| 11D - Data quality warning | Không cho sign-off báo cáo final nếu Ledger/Balance/Subledger lệch; mở reconciliation trước khi export final. | Cảnh báo SKU lệch và CTA mở Tồn & truy vết. |
| 12C - UI states chung | Loading disable action chống submit lặp; empty có giải thích; error/retry giữ filter hợp lệ; no permission ẩn/disable action. | Skeleton/spinner, empty, retry, request_id, no-permission state. |
| 12D - Action permission | Reports/export: Admin A, QL kho A, NV kho V* nếu được gán quyền, NV bảo hành D, Lãnh đạo V. | Route `report.view`, action export cần `report.export` hoặc catalog BE xác nhận. |
| 12E - HTTP/error behavior | 403, 409, 412, 422, 428 phải có UI behavior rõ. | 403 out-of-scope, conflict, stale version, business rule, missing precondition. |

## 5. Đối chiếu implementation hiện tại

| Surface | File | Đã có | Cần kiểm soát thêm |
| --- | --- | --- | --- |
| Route RBAC | `src/app/router/access.ts` | `ROUTES.REPORTS` yêu cầu `report.view`; comment xác nhận FE chỉ là UX gate. | Action export chưa thấy guard riêng `report.export` trong `ReportsPage`; cần thêm hoặc nhận sign-off nếu route view đủ cho export. |
| API endpoints | `src/shared/api/endpoints.ts` | `REPORTS_HUB`, `REPORTS_XNT`, `REPORTS_XNT_EXPORT_EXCEL`, `REPORTS_WARRANTY_DEFECTS`. | `/reports/hub` cần BE xác nhận canonical nếu dependency HN-RPT-001 quy định endpoint khác. |
| Service hub | `src/modules/reports/services/reportsService.ts` | `fetchReportsHub()` gọi API thật và normalize `id/code/title/description`. | Cần UI error/empty rõ thay vì catch rỗng rồi set empty. |
| Service XNT | `src/modules/reports/services/reportsService.ts` | `fetchXntReport(params)` map nhiều alias field; `downloadXntReportExcel(params)` tải blob cùng params. | Param hiện có `from/to/scope/warehouse_id`; chưa có SKU/category/movement type như wireframe. |
| Page UI | `src/modules/reports/pages/ReportsPage.tsx` | Tabs hub/XNT/warranty; date filter; scope filter; XNT XLSX export; table loading. | Text đang bị mojibake ở nhiều label; chưa có error alert, empty copy, disabled state riêng cho invalid date, responsive evidence, success feedback sau export. |
| Warranty report | `src/modules/reports/pages/ReportsPage.tsx` | Tạo aggregate đơn giản từ `fetchWarrantyCases()`. | Có service `fetchWarrantyDefectsReport()` nhưng page chưa dùng; cần BE/BA xác nhận nên aggregate FE hay dùng endpoint report canonical. |
| Shared export | `src/shared/utils/export-xlsx.ts` | Có utility export XLSX client-side cho dữ liệu table. | Reports XNT hiện dùng server export blob; nếu BE yêu cầu server export thì không dùng client utility cho production. |

## 6. Yêu cầu chi tiết cho UI báo cáo

### 6.1 Report hub

Report hub phải là trang điều hướng nghiệp vụ, không chỉ table rỗng. Mỗi item cần tối thiểu `code`, `title`, `description`, trạng thái khả dụng nếu backend trả, và action mở báo cáo phù hợp quyền. Nếu API hub lỗi, UI phải hiển thị error state có retry và không biến lỗi thành "không có dữ liệu".

Danh sách P0 cần bám baseline: RPT-INV-01 tồn hiện tại, RPT-XNT-01 xuất nhập tồn, RPT-MOV-01 movement history, RPT-STK-01 kiểm kê, RPT-WAR-01 bảo hành theo bệnh, RPT-IO-01 phiếu nhập/xuất. Nếu `/reports/hub` chưa trả đủ danh sách này, cần comment blocker cho BE1/BA thay vì tự hard-code.

### 6.2 Bộ lọc XNT

Filter tối thiểu theo wireframe gồm khoảng ngày, SKU/category, movement type và scope/data scope. Implementation hiện tại mới có `from`, `to`, `scope`; vì vậy còn thiếu filter SKU/category và movement type. Ngày cần validate `from <= to`, disable export khi invalid, và giữ filter khi API fail để user có thể retry.

Scope `system`/`warehouse` chỉ là tham số UI nếu contract BE xác nhận. Nếu user không có quyền xem toàn hệ thống, option system phải bị ẩn/disable theo data scope runtime thay vì cho chọn rồi chờ 403.

### 6.3 Báo cáo XNT

Các cột bắt buộc: SKU, opening, receipt, issue, adjust in, adjust out, reversal net, closing, partial remaining, reconcile. FE không tự thay đổi nghiệp vụ tồn kho; formula chỉ dùng để hiển thị baseline/đối chiếu cảnh báo, còn dữ liệu canonical phải đến từ BE. Reconcile `FAIL/WARN` cần màu và thông điệp rõ, đồng thời export final phải bị chặn hoặc yêu cầu disposition nếu baseline data quality warning chưa xử lý.

### 6.4 Export dữ liệu

Export XLSX hiện gọi `GET /reports/inventory-xnt/export-excel` qua `downloadBlob()` cùng params đang xem. Cần bảo đảm:

| Điều kiện | Expected |
| --- | --- |
| Đang tải export | Button loading và disable để chống click lặp. |
| Filter invalid | Không gọi API, hiển thị lỗi filter. |
| 403 | Hiển thị no-permission/export denied; không tạo file rỗng. |
| 422 | Hiển thị lỗi field/filter inline. |
| 409/412/428 | Giữ filter, yêu cầu reload/retry theo shared error policy. |
| Thành công | Tải file tên trace được kỳ báo cáo, ví dụ `xnt-report-YYYYMMDD-YYYYMMDD.xlsx`. |
| Data quality fail | Không sign-off export final nếu ledger/balance/subledger lệch chưa có disposition. |

### 6.5 Bảo hành theo bệnh

Baseline yêu cầu không lộ PII mặc định. UI hiện aggregate từ danh sách warranty case, không hiển thị tên/SĐT nên phù hợp privacy surface ban đầu. Tuy nhiên endpoint report canonical `REPORTS_WARRANTY_DEFECTS` đã có trong service nhưng chưa được page dùng; cần BE/BA xác nhận endpoint nào là source of truth cho report production. Nếu dùng `fetchWarrantyCases()` để aggregate, evidence phải ghi rõ đây là fallback FE view, không phải report contract cuối.

## 7. Acceptance Criteria mapping

| Acceptance Criteria từ Jira | Đánh giá FE1 | Evidence/cần bổ sung |
| --- | --- | --- |
| Output "báo cáo FE" được rà soát/xác minh, gắn evidence vào HN-FE-009 và không còn blocker FE1. | Tài liệu này là báo cáo FE nền; chưa có evidence screenshot/log mới. | Cần gắn screenshot hub/XNT/warranty, export log, test log vào HN-FE-009/WWHN-258. |
| UI đáp ứng nghiệp vụ, field specification, responsive; xử lý loading, empty, error, success, disabled, confirm khi phù hợp. | Partial. Loading có; empty/error/success/disabled chưa đủ rõ; filter thiếu SKU/category/movement type. | Cần test responsive desktop/mobile và bổ sung UI states. |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu/rule trái contract. | Route `report.view` có; export action permission và API error presentation cần bổ sung/verify. | Cần role account evidence: report.view only, report.export, no permission. |
| Tích hợp đúng endpoint/payload đã duyệt; lint/build/test phù hợp pass. | Endpoints đã wired nhưng `/reports/hub` và warranty report source cần BE confirmation. | Chạy `npm run lint`, `npm run build`, test reports/API nếu có. |
| BA/QA có evidence để kiểm tra; không còn P0/P1 blocker chưa có disposition. | Chưa đủ để final sign-off. | Xem bảng blocker bên dưới. |

## 8. Blocker, rủi ro và disposition

| ID | Mức | Nội dung | Owner | Disposition cần có |
| --- | --- | --- | --- | --- |
| WWHN-258-BE-01 | P1 | Xác nhận canonical endpoint/response cho `/reports/hub` và danh sách report P0. | BE1 + BA/BAS | Cung cấp OpenAPI/sample hoặc xác nhận endpoint hiện tại. |
| WWHN-258-BE-02 | P1 | Xác nhận filter XNT đầy đủ: SKU/category, movement type, warehouse/data scope, timezone và enum reconcile. | BE1 + BA/BAS | Cập nhật contract và sample request/response/export. |
| WWHN-258-FE-01 | P1 | UI reports page thiếu error/empty/success/disabled states rõ ràng; đang catch lỗi thành empty ở một số nơi. | FE1 | Bổ sung shared `ApiErrorAlert`/empty/retry/toast hoặc pattern tương đương. |
| WWHN-258-FE-02 | P1 | Export action chưa có guard riêng `report.export`; route mới guard `report.view`. | FE1 + BE2/RBAC owner | Áp dụng `PermissionGuard`/`ActionButton` hoặc nhận catalog xác nhận. |
| WWHN-258-FE-03 | P2 | Label tiếng Việt trong `ReportsPage.tsx` đang mojibake, ảnh hưởng QA/UI polish. | FE1 | Sửa encoding/text label trước khi capture evidence. |
| WWHN-258-BA-01 | P1 | Data quality warning: rule chặn sign-off/export final khi Ledger/Balance/Subledger lệch chưa có payload/flag UI. | BA/BAS + BE1 | Chốt field cảnh báo và expected UI behavior. |
| WWHN-258-QA-01 | P1 | Chưa có evidence responsive/RBAC/export gắn task. | QA + FE1 | Capture desktop/mobile, role matrix, request log và file export sample. |

## 9. Checklist bàn giao FE1

| Nhóm | Checklist |
| --- | --- |
| Contract | Đối chiếu HN-RPT-001, WWHN-68, endpoints, params, response fields, error codes, permission catalog. |
| UI hub | Search/filter hub, empty/error/retry, đủ report P0 hoặc blocker rõ. |
| UI XNT | Date range, SKU/category, movement type, scope, table columns, reconcile warning, invalid filter disabled. |
| Export | XLSX dùng cùng filter/scope, loading/disabled/success/error, 403/422/409 handling, filename traceable. |
| Warranty report | Không lộ PII, TEMP_ONLY riêng, source of truth endpoint được xác nhận. |
| RBAC | Route `report.view`, action `report.export`, no-permission state, backend 403 display. |
| Responsive | Desktop 1366, tablet, mobile; table scroll không vỡ layout; toolbar wrap hợp lý. |
| Test/build | `npm run lint`, `npm run build`, targeted tests cho service/page nếu được bổ sung. |
| Evidence | Screenshot states, request/response hoặc mock contract rõ nguồn, export file sample, test log. |
| Traceability | Ghi rõ Jira WWHN-258, parent WWHN-68, dependency HN-RPT-001, HN-FE-009 trong PR/evidence. |

## 10. Kết luận FE report

FE reports foundation đã có wiring ban đầu cho route RBAC, endpoints hub/XNT/export/warranty defects, service normalize dữ liệu và UI tab hub/XNT/warranty. Tuy nhiên chưa đủ điều kiện sign-off production cho WWHN-258 vì còn thiếu xác nhận contract HN-RPT-001, thiếu một số filter baseline, thiếu action-level `report.export`, thiếu UI error/empty/success/disabled đầy đủ và chưa có evidence responsive/RBAC/export gắn task.

Trạng thái đề xuất: **FE partially implemented / conditional handoff**. FE1 có thể tiếp tục hoàn thiện phần UI-state/RBAC/export evidence trong code; BE1/BA/BAS cần khóa contract báo cáo và data quality signal; QA cần chạy evidence theo checklist trên trước khi đóng blocker.
