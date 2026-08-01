# WWHN-209 - [FE1] Triển khai luồng hoàn chỉnh xuất kho

## 1. Thông tin Jira và traceability

| Trường | Giá trị |
| --- | --- |
| Jira task | WWHN-209 |
| Link nguồn | https://tan0110.atlassian.net/browse/WWHN-209 |
| Tiêu đề | [FE1] Triển khai luồng hoàn chỉnh xuất kho |
| Issue type | Subtask |
| Trạng thái khi đọc | In Progress |
| Priority | Medium |
| Assignee | Quang Nguyễn Thanh |
| Reporter | Wuangg |
| Created | 2026-07-19 21:28:24 +0700 |
| Updated trên Jira | 2026-08-01 21:13:02 +0700 |
| Task cha | WWHN-50 - [FE][OUTBOUND] UI chứng từ, lấy/quét hàng và ghi nhận xuất kho |
| Dependency | HN-OUT-001; HN-OUT-002; HN-OUT-003; HN-FE-001 |
| Parent Temp Key | HN-FE-004 |
| Epic Temp Key | HN-EPIC-06 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Output đầu ra | Outbound FE |
| Ngày cập nhật tài liệu | 2026-08-01 ICT |

Tài liệu này là artifact phân rã và bàn giao cho WWHN-209. Jira mô tả mục tiêu ngắn là "Triển khai luồng hoàn chỉnh xuất kho", nhưng Acceptance Criteria yêu cầu sâu hơn nhiều: FE1 phải chứng minh UI bám nghiệp vụ, field specification, endpoint/payload đã duyệt, RBAC, responsive, trạng thái loading/empty/error/success/disabled/confirm, lint/build/test và evidence để BA/QA nghiệm thu. Vì đây là luồng ảnh hưởng tồn kho, FE không được tự suy diễn stock effect hoặc sửa API contract; mọi mismatch phải có owner và disposition.

## 2. Diễn giải sâu mục tiêu

WWHN-209 cần được hiểu là hoàn thiện bề mặt frontend cho outbound end-to-end: tạo/hiển thị chứng từ xuất, lấy hoặc quét hàng, validate subset, post issue một phần hoặc toàn phần, đóng phần còn lại khi phù hợp, xử lý trạng thái workflow, quyền hạn, lỗi API và evidence. "Luồng hoàn chỉnh" không dừng ở màn danh sách phiếu xuất.

| Lớp mục tiêu | FE1 phải đạt | Không được làm |
| --- | --- | --- |
| Chứng từ xuất | Hiển thị danh sách, chi tiết, receiver, planned/issued/remaining, trạng thái, version và action theo state. | Không coi list-only là đủ luồng xuất kho; không tự map trạng thái trái contract đã duyệt. |
| Lấy/quét hàng | Có UI nhập/quét code/SKU/line, phản hồi valid/duplicate/unknown/invalid, số lượng subset mới và lỗi theo từng line. | Không tự xác nhận hàng hợp lệ nếu BE chưa trả validation; không dùng mock scan làm evidence tích hợp production. |
| Post issue | Gửi payload đúng contract, kèm `Idempotency-Key` và `If-Match` nếu contract yêu cầu; confirm rõ stock effect Available giảm. | Không tự giảm tồn ở FE; không cho double submit gây double stock movement. |
| Close remainder | Chỉ cho đóng phần còn lại khi trạng thái hợp lệ, có reason/confirm, không tạo stock effect mới. | Không đóng phần còn lại bằng update local hoặc suy diễn rule khi BE chưa xác nhận. |
| Receiver/agency | Hiển thị nơi nhận là agency/customer theo contract; lưu `agency_id` trên phiếu nếu baseline yêu cầu. | Không tạo balance/movement tăng tồn cho đại lý trong MVP nếu baseline nói agency không có stock riêng. |
| UI states | Loading, empty, API error, success, disabled, confirm, stale/version conflict và no-permission rõ ràng. | Không nuốt lỗi thành bảng rỗng; không chỉ ẩn button như bảo mật cuối cùng. |
| RBAC | Route/action guard theo permission catalog, có evidence user đủ quyền/thiếu quyền/out-of-scope. | Không hard-code quyền theo role name; không tự thêm permission nếu chưa có catalog BE/BA. |
| Evidence | Screenshot desktop/tablet/mobile, API request/response, RBAC, error states, command logs và blocker disposition. | Không sign-off khi còn P0/P1 blocker không có owner/ETA. |

## 3. Input đầu vào từ Jira và cách sử dụng

| Input từ Jira | Ý nghĩa | Cách FE1 sử dụng |
| --- | --- | --- |
| Task cha WWHN-50 | Scope trực tiếp: UI chứng từ, lấy/quét hàng và ghi nhận xuất kho. | Trace mọi màn hình/action outbound về WWHN-50/HN-FE-004; không tách scan/post ra ngoài nếu là AC của parent. |
| HN-OUT-001 | Baseline nghiệp vụ outbound: chứng từ xuất, receiver, planned/subset/remaining, stock effect. | Khóa field, state machine, agency rule và confirm copy; thiếu rule phải raise BA/BAS. |
| HN-OUT-002 | API/UI specification: endpoints, payload, validation, error code, permission. | Dùng để type service, form payload, mapping lỗi; mismatch với code phải được ghi blocker. |
| HN-OUT-003 | Dữ liệu mẫu/evidence: case happy path, partial post, close remainder, insufficient stock, stale version. | Là bộ case QA/evidence cho screenshots và request/response logs. |
| HN-FE-001 | FE foundation: auth/session/RBAC/API error/shared UI state/build conventions. | Reuse `http`, `API_ENDPOINTS`, `ROUTE_PERMISSIONS`, shared permission/error components; không tạo cơ chế riêng. |
| Baseline nghiệp vụ, API/UI specification, dữ liệu mẫu/evidence | Nguồn chân lý cho field, enum, RBAC, sample và sign-off. | PR/evidence phải link nguồn; mock local chỉ dùng prototype, không thay contract. |

## 4. Vai trò và phối hợp

| Bên | Trách nhiệm | Điểm phối hợp bắt buộc |
| --- | --- | --- |
| FE1 - Quang Nguyễn Thanh | Chủ trì UI outbound, service/type wiring, responsive, UI states, RBAC UX, evidence và tài liệu bàn giao. | Không tự chốt rule xuất kho, inventory transaction, idempotency, version hoặc RBAC backend. |
| BA/BAS | Cung cấp rule nghiệp vụ, UI/UX, field specification, AC và open point đã xử lý. | Chốt trạng thái phiếu, điều kiện post/close/cancel, copy cảnh báo stock effect, agency rule và evidence cần nghiệm thu. |
| BE1/BE2 | Cung cấp endpoint, payload, validation, error code, permission, dữ liệu mẫu, transaction/idempotency/version behavior. | Khóa canonical path `/outbound-documents`, scan/post/close payload, error code 403/409/412/422/428 và request_id. |
| DevOps | Cấu hình build/environment nếu API base, auth, proxy, cookie/CORS hoặc deploy target ảnh hưởng evidence. | Xác nhận env UAT/build version và dữ liệu test để capture screenshots/logs. |
| BA/QA | Nghiệm thu AC, responsive, RBAC, UI states, happy/negative/idempotency/retry. | Test theo role, viewport, request/response và blocker disposition, không chỉ nhìn giao diện tĩnh. |

## 5. Baseline nghiệp vụ đã đọc

| Nguồn | Baseline rút ra | Tác động FE |
| --- | --- | --- |
| WWHN-209 Description | Output "Outbound FE" phải được rà soát/xác minh, tích hợp đúng endpoint/payload, không còn blocker FE1. | Tài liệu phải ghi rõ trạng thái hiện tại, gap, blocker và checklist evidence trước sign-off. |
| Wireframe P0 SCR-OUT-01 | Outbound dùng `/outbound-documents`, `/post-issue`, `/close-remainder`; trạng thái DRAFT/SCANNING/PARTIALLY_POSTED/POSTED/CLOSED/CANCELLED. | UI phải có list/detail, scan/subset, post confirm, close remainder, status tag và action theo state. |
| Wireframe stock effect | Sau Post chỉ giảm tồn kho tổng; không sinh balance/movement tăng cho đại lý. | Confirm post phải nêu rõ Available giảm; FE không tự tạo agency stock. |
| Wireframe permission matrix | Xuất kho cho QL/NV kho; permissions `outbound.create`, `outbound.post`, `outbound.close_remainder`. | Route hiện có create/post; action close remainder cần permission riêng nếu BE catalog xác nhận. |
| HTTP/error behavior P1 | 403 hide/disable/no-permission; 409 không lặp stock effect; 412 stale If-Match; 422 inline rule; 428 missing precondition. | Post/close phải có confirm, disabled/loading, idempotency, stale handling và retry an toàn. |
| Architecture/sign-off docs | FE route/action guard chỉ là UX; backend sở hữu RBAC, data scope, tồn kho, transaction và audit. | FE chỉ gửi đúng payload và render kết quả/lỗi, không tự tính tồn hoặc bypass BE authority. |

## 6. Đối chiếu repo hiện tại

| Surface | File/nguồn | Đã có | Khoảng trống với WWHN-209 |
| --- | --- | --- | --- |
| Route/RBAC | `src/app/router/access.ts` | `ROUTES.OUTBOUND` yêu cầu `outbound.create` hoặc `outbound.post`; comment nêu rõ FE chỉ là UX gate. | Chưa có action guard riêng cho `outbound.close_remainder`; chưa có evidence khớp backend permission catalog. |
| Route component | `src/modules/outbound/pages/OutboundPage.tsx` | Export sang `ShippingPage`, nghĩa là route outbound dùng page shipping hiện tại. | Tên module/page gây nhiễu evidence nếu BA/QA cần "Outbound"; cần ghi rõ hoặc đổi alias UI nếu scope yêu cầu. |
| Endpoint constants | `src/shared/api/endpoints.ts` | Có `OUTBOUND_DOCUMENTS`, `OUTBOUND_DOCUMENT`, `OUTBOUND_LINES`, `OUTBOUND_SUBMIT`, `OUTBOUND_APPROVE`, `OUTBOUND_REJECT`, `OUTBOUND_CANCEL`, `OUTBOUND_POST_ISSUE`, `OUTBOUND_SCAN`, `OUTBOUND_CLOSE_REMAINDER`, `OUTBOUND_REVERSE`. | `OUTBOUND_LINES` đang trỏ cùng `/outbound-documents/:id`; nếu BE có `/lines` riêng phải sửa theo contract. Need confirm scan/post/close payload và version header. |
| Outbound types | `src/modules/shipping/types/index.ts` | Có `OutboundDocument`, `OutboundLine`, `PostIssueRequest`, `OutboundErrorCode`, `OutboundScanResult`. | Types còn thiếu close remainder request/response, workflow action result, field-level errors, line validation detail, idempotency replay metadata. |
| Outbound service | `src/modules/shipping/services/shippingService.ts` | Fetch list/detail/lines; create/update/submit/approve/reject/cancel; scan; post issue với `Idempotency-Key` và `If-Match`; close remainder; reverse. Có normalization nhiều alias field. | UI chưa gọi scan/post/close/reverse mutations. `closeOutboundRemainder()` chưa gửi `Idempotency-Key`/`If-Match` nếu contract yêu cầu. Error chưa được normalize lên UI bằng shared alert. |
| Outbound page | `src/modules/shipping/pages/ShippingPage.tsx` | Có list phiếu xuất, search/status filter, detail modal, line table, loading/error cho list/lines, warning stock effect, nút post/close trong modal. | Chưa có create form, scan input, chọn line/subset, post confirm thực, close reason/confirm thực, success toast, action disabled theo status/permission, empty state riêng. Nhiều label tiếng Việt đang mojibake. |
| Shared API/error | `src/shared/api/http.ts`, `src/shared/api/api-error.ts`, `src/shared/components/feedback/ApiErrorAlert.tsx` | Repo có parser/error component chung, giữ `error_code`, `errors`, request marker và 403 classification. | `ShippingPage` hiện catch lỗi thành message string, chưa hiển thị request_id/field errors/403/no-permission theo shared pattern. |
| Shared permission | `src/shared/components/permission`, `src/lib/permissions` | Có `PermissionGuard`, `ActionButton`, `useHasPermission`, route guard/menu filtering. | Outbound action buttons chưa dùng action-level permission và scope-aware disabled/hide. |

Kết luận đối chiếu: nền service/type outbound đã có khá nhiều phần đúng hướng, nhưng UI active mới đạt list/detail ở mức cơ bản. WWHN-209 chưa thể coi là "luồng hoàn chỉnh xuất kho" nếu không có scan/subset/post/close mutation, confirm, RBAC action, error states và evidence tương ứng.

## 7. Luồng Outbound FE cần triển khai

### 7.1 Danh sách chứng từ xuất

Danh sách là điểm vào vận hành nên mỗi row cần giúp QL/NV kho biết phiếu nào đang nháp, đang quét, đã xuất một phần, đã post xong hoặc đã đóng phần còn lại.

| Field/UI | Expected |
| --- | --- |
| Mã phiếu | `code/doc_no/document_no`, mở detail. |
| Nơi nhận | `receiver_type`, `receiver_id`, `receiver_name`; agency/customer hiển thị theo contract. |
| Ngày | `doc_date/date/created_at`, format timezone nhất quán. |
| Planned/Issued/Remaining | Số lượng dự kiến, đã xuất, còn lại; remaining không âm ở UI, nhưng BE là authority. |
| Status | DRAFT/SCANNING/PARTIALLY_POSTED/POSTED/CLOSED/CANCELLED hoặc enum canonical. |
| Version | `version/lock_version` để xử lý stale/If-Match khi post/close. |
| Action | Xem chi tiết, tiếp tục quét, post subset, close remainder, cancel theo status và permission. |

State bắt buộc: loading table không nhảy layout; empty khác với error; search/filter giữ state khi lỗi; retry có request_id; no-permission không lộ data ngoài scope.

### 7.2 Tạo chứng từ xuất

Form tạo phiếu xuất cần có receiver, warehouse/source, ngày chứng từ, lines SKU/qty, note/reference nếu contract yêu cầu. Nếu WWHN-50 giao phần tạo ở task khác, WWHN-209 vẫn phải trace rõ surface nào đã có và blocker nào ngoài scope.

| Nhóm | Expected |
| --- | --- |
| Validation | Required receiver, warehouse, ít nhất một line, qty > 0, SKU hợp lệ, duplicate line xử lý theo contract. |
| Submit | Gọi `createOutboundDocument(payload)`; không tạo local-only document. |
| Success | Refresh list/detail, hiển thị mã phiếu từ BE. |
| Error | 403/422/409 hiển thị rõ; field errors map vào form. |
| Permission | Nút tạo theo `outbound.create` hoặc permission catalog backend đã duyệt. |

Hiện page mới có nút "Tạo phiếu xuất" dạng visual, chưa mở modal/form.

### 7.3 Lấy/quét hàng và validate subset

Đây là lõi của luồng outbound. Người dùng cần quét code hoặc nhập SKU/line để gom subset xuất kho, thấy validation ngay và biết dòng nào có thể post.

| Thành phần | Expected |
| --- | --- |
| Scan input | Nhập/quét một hoặc nhiều code, debounce hoặc submit rõ; giữ focus cho vận hành kho. |
| Response state | VALID/DUPLICATE/UNKNOWN/INVALID theo `OutboundScanResult`; duplicate không cộng thêm qty. |
| Line mapping | Code/SKU phải map vào line phiếu; line mismatch hiển thị lỗi `WMS_OUTBOUND_LINE_SKU_MISMATCH`. |
| Quantity subset | `subsetNew` hoặc qty chọn phải không vượt remaining/planned và không vượt available theo BE validation. |
| Error | Insufficient/negative stock hiển thị theo error code, không tự sửa số lượng im lặng. |
| Selection | Chọn line/qty post; disabled nếu status không hợp lệ hoặc thiếu quyền. |

Service đã có `scanOutboundDocument(id, codes, extra)`, nhưng UI chưa gọi.

### 7.4 Post issue

Post issue là mutation ảnh hưởng tồn kho nên phải có confirm, idempotency, version/precondition và refresh state.

| Điều kiện | Expected |
| --- | --- |
| Enable action | Chỉ bật khi có line valid/subset > 0, status hợp lệ, user có `outbound.post`, không đang submit. |
| Confirm | Modal nêu mã phiếu, số line, tổng qty, stock effect "Available giảm", không tạo stock đại lý, idempotency key. |
| Payload | Gọi `postOutboundIssue({ documentId, lines, idempotencyKey, ifMatch })`. |
| Header | `Idempotency-Key` bắt buộc; `If-Match` dùng `selectedDoc.version` nếu contract yêu cầu. |
| Success | Refresh document/lines/list; hiển thị qty posted, remaining, status mới và request id nếu có. |
| Error | 409 idempotency/state conflict không retry mù; 412 stale giữ input và reload version; 422 inline line errors; 428 yêu cầu reload/precondition. |

Service đã hỗ trợ `Idempotency-Key` và `If-Match`; UI modal hiện có nút post nhưng chưa nối mutation/confirm thực.

### 7.5 Close remainder

Close remainder không phải post tồn mới. Đây là quyết định nghiệp vụ đóng phần chưa xuất, cần reason và confirm.

| Điều kiện | Expected |
| --- | --- |
| Enable action | Chỉ bật khi phiếu còn remaining, đã hoặc đang trong trạng thái cho phép close, user có quyền close remainder. |
| Form | Reason bắt buộc nếu baseline yêu cầu; hiển thị remaining qty sẽ bị đóng. |
| Confirm | Nêu rõ "không đổi tồn", chỉ đóng phần còn lại. |
| Submit | Gọi `closeOutboundRemainder(documentId, reason)`; thêm idempotency/If-Match nếu BE contract yêu cầu. |
| Success | Status CLOSED hoặc trạng thái canonical; refresh list/detail. |
| Error | 409/412/422/428 theo shared pattern, không đóng local state. |

Service đã có `closeOutboundRemainder()`, nhưng UI chưa nhập reason/submit.

### 7.6 Cancel/reject/approve/submit nếu thuộc scope parent

Service đang có submit/approve/reject/cancel, nhưng Jira WWHN-209 nhấn mạnh lấy/quét/post issue. Nếu WWHN-50 yêu cầu full workflow trước post, FE cần xác định rõ action nào thuộc WWHN-209 và action nào thuộc task khác.

| Action | Cần xác nhận | FE behavior |
| --- | --- | --- |
| Submit | Có trạng thái draft -> pending/scanning không? | Form confirm/validation, refresh state. |
| Approve/reject | Có bước duyệt trước khi quét/post không? | Action theo permission, reason reject, error handling. |
| Cancel | Cancel chỉ trước lần post đầu theo wireframe. | Disable sau partial post; reason và confirm. |

Không được tự bật action này nếu BA/BE chưa xác nhận workflow.

## 8. API, payload, error và RBAC cần khóa

| Nhóm contract | Cần BE/BA xác nhận | Gợi ý FE type/service |
| --- | --- | --- |
| List/detail | Canonical `GET /outbound-documents`, params search/status/warehouse, response fields receiver/planned/issued/remaining/status/version. | `OutboundDocument`, `OutboundDocumentListParams`. |
| Lines | `GET /outbound-documents/:id` có `lines` hay endpoint `/lines` riêng; fields SKU, available, planned, issued, subset, validation. | `OutboundLine`, `OutboundDocumentDetail`. |
| Create/update | Payload receiver, warehouse, lines, note/reference, validation duplicate SKU/qty. | `CreateOutboundDocumentRequest`, `UpdateOutboundDocumentRequest`. |
| Scan | Endpoint/payload cho codes, response VALID/DUPLICATE/UNKNOWN/INVALID, SKU/line mapping, errors. | `OutboundScanResult`, `OutboundScanRequest/Response`. |
| Post issue | Payload `lines[{ lineId, quantity }]`, idempotency, version/If-Match, response posted movements/status. | `PostIssueRequest`, `PostIssueResponse`. |
| Close remainder | Payload reason, idempotency/version requirement, resulting status. | `CloseRemainderRequest/Response`. |
| Error code | 403, 404, 409, 412, 422, 428, insufficient stock, exceeds planned, negative stock, idempotency replay. | `OutboundErrorCode` mở rộng nếu BE trả thêm code. |
| RBAC | `outbound.create`, `outbound.post`, `outbound.close_remainder`, cancel/approve nếu có, data scope warehouse. | Route/action guard qua permission helpers; backend vẫn enforce. |

Open blocker lớn nhất: repo đã có service readiness cho nhiều endpoint, nhưng chưa có evidence trong task này rằng BE đã khóa chính thức payload/error/permission/sample cho HN-OUT-001/002/003.

## 9. UI states bắt buộc

| State | Expected cho Outbound |
| --- | --- |
| Loading | Spinner/skeleton cho list/detail/lines/scan/post/close; disable action đang submit. |
| Empty | Không có phiếu theo filter khác với API error; có clear filter hoặc tạo phiếu nếu đủ quyền. |
| Error | `ApiErrorAlert` hoặc pattern tương đương, có message/error_code/request_id/retry; không catch thành `[]`. |
| Success | Toast/banner sau create/scan/post/close; refresh state và hiển thị kết quả từ BE. |
| Disabled | Disable action khi thiếu quyền, status không hợp lệ, line invalid, qty <= 0, stale version, đang submit. |
| Confirm | Post issue và close remainder bắt buộc confirm; cancel/reject nếu có cũng cần reason/confirm. |
| No permission | Route/action no-permission không lộ data/action ngoài scope; phân biệt thiếu `outbound.post` với thiếu `outbound.create`. |
| Conflict/stale | 409 không lặp stock effect; 412 giữ input và reload version; 428 yêu cầu precondition. |

## 10. Responsive và UX evidence

| Viewport | Kỳ vọng |
| --- | --- |
| 390x844 mobile | Search/filter wrap hoặc drawer; list dạng card/table scroll có kiểm soát; scan input dễ thao tác; modal post/close không mất nút chính. |
| 768x1024 tablet | List + filter ổn định; detail modal/drawer đủ rộng; line table không che action; confirm đọc được stock effect. |
| 1366/1440 desktop | Table đủ cột nghiệp vụ; detail có summary, lines, scan/subset, action; không overlap text mojibake hoặc button. |

Evidence tối thiểu cần capture: list outbound, detail lines, scan valid/duplicate/invalid, post confirm, post success, close remainder confirm, API 403, API 409/412/422 nếu có sample, empty state, no-permission, desktop/tablet/mobile.

## 11. Acceptance Criteria mapping

| Acceptance Criteria từ Jira | Đánh giá FE1 | Evidence/cần bổ sung |
| --- | --- | --- |
| Output "Outbound FE" được rà soát/xác minh, gắn evidence vào HN-FE-004 và không còn blocker FE1. | Tài liệu này đã phân rã scope và gap. Repo hiện có service/type readiness, nhưng UI active chưa đủ scan/post/close end-to-end. | Cần attach tài liệu, screenshots, API samples, lint/build/test logs vào HN-FE-004/WWHN-209. |
| UI đáp ứng quy tắc nghiệp vụ, field specification và responsive; xử lý loading, empty, error, success, disabled và confirm. | Partial. Có list/detail loading/error string và warning stock effect; thiếu scan state, post/close confirm thực, success, empty/no-permission/action disabled đầy đủ. | Implement/capture UI states; sửa label mojibake trước evidence. |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu hoặc quy tắc trái contract. | Route guard có `outbound.create`/`outbound.post`; action guard và `outbound.close_remainder` chưa có. API error chưa dùng shared pattern. | Cần backend permission catalog, action guard và screenshots role thiếu/đủ quyền. |
| Tích hợp đúng endpoint/payload đã duyệt; lint, build và test phù hợp phải pass. | Service đang dùng endpoint constants outbound và post issue có idempotency/version header. UI chưa gọi mutation nên chưa thể chứng minh end-to-end. | Cần BE approved sample, targeted tests, `npm run lint`, `npm run test -- --run`, `npm run build`. |
| BA/QA có evidence để kiểm tra; không còn P0/P1 blocker chưa có disposition. | Bảng blocker bên dưới đã nêu owner/disposition; chưa có evidence UI/runtime cho WWHN-209. | Cần đóng hoặc có ETA chính thức cho các P0/P1 trước nghiệm thu. |

## 12. Blocker, rủi ro và disposition

| ID | Mức | Nội dung | Owner | Disposition cần có |
| --- | --- | --- | --- | --- |
| WWHN-209-BE-01 | P1 | Chưa có contract khóa cho HN-OUT-001/002/003 trong tài liệu task này: list/detail/lines/scan/post/close payload, error code, sample. | BE1/BE2 + BA/BAS | Cung cấp OpenAPI/sample hoặc xác nhận constants hiện tại; FE cập nhật nếu khác. |
| WWHN-209-BE-02 | P1 | `OUTBOUND_LINES` hiện trỏ cùng `/outbound-documents/:id`; cần xác nhận detail response chứa `lines` hay có endpoint `/lines` riêng. | BE1 | Chốt canonical path và response shape; FE sửa service nếu mismatch. |
| WWHN-209-BE-03 | P1 | Close remainder chưa rõ yêu cầu `Idempotency-Key`/`If-Match`, reason bắt buộc và resulting status. | BE1/BA | Cung cấp payload/version/error behavior; FE thêm header/type/UI confirm. |
| WWHN-209-RBAC-01 | P1 | Permission catalog chưa xác nhận `outbound.close_remainder`, cancel/approve/reject và data scope warehouse. | BE/RBAC owner + BA | Chốt permission matrix; FE thêm action guard và evidence role. |
| WWHN-209-FE-01 | P1 | `ShippingPage.tsx` chưa wire scan input, selected subset, post issue mutation và close remainder mutation. | FE1 | Implement hoặc tách ticket rõ; nếu trong WWHN-209 thì đây là gap trực tiếp. |
| WWHN-209-FE-02 | P1 | API errors ở UI đang được render thành message string, chưa có request_id/error_code/field errors/no-permission theo shared pattern. | FE1 | Dùng `ApiErrorAlert`/shared parser, giữ input khi retry. |
| WWHN-209-FE-03 | P1 | Action buttons chưa disabled theo status/permission/line validity; nút post/close trong modal hiện có thể hiển thị dù chưa đủ điều kiện. | FE1 | Thêm action-level permission/state guard và tests. |
| WWHN-209-FE-04 | P2 | Nhiều label tiếng Việt trong `ShippingPage.tsx` và comments endpoint đang mojibake, ảnh hưởng trực tiếp evidence BA/QA. | FE1 | Sửa encoding/copy trước khi chụp evidence. |
| WWHN-209-QA-01 | P1 | Chưa có evidence responsive/RBAC/API/idempotency/retry gắn WWHN-209/HN-FE-004. | QA + FE1 | Capture desktop/tablet/mobile, role accounts, API logs và command logs sau implementation. |

## 13. Checklist triển khai FE1

| Nhóm | Checklist |
| --- | --- |
| Contract | Khóa HN-OUT-001/002/003: endpoints, params, fields, status enum, payload, error codes, permission, idempotency, version, sample data. |
| Routing/RBAC | Xác nhận `outbound.create`, `outbound.post`, `outbound.close_remainder`, cancel/approve/reject nếu có; thêm action guards. |
| Types/service | Bổ sung request/response types cho create, scan, post result, close remainder, workflow action result và field errors. |
| List/detail | Search/filter, status tag, receiver, planned/issued/remaining, version, empty/error/retry. |
| Create document | Modal/form receiver/warehouse/lines/note, validation, submit, success/error. |
| Scan/subset | Scan input, code result state, duplicate/unknown/invalid, qty subset, select lines. |
| Post issue | Confirm stock effect, idempotency key, If-Match, disabled/loading, success/partial fail, refresh state. |
| Close remainder | Reason modal, confirm no stock effect, submit, success/error, refresh state. |
| UI states | Loading, empty, error + request_id, retry, success, disabled, no permission, confirm. |
| Encoding/UI copy | Sửa mojibake tiếng Việt trước evidence; wording nghiệp vụ giữ đúng BA. |
| Responsive | Evidence 390x844, 768x1024, 1366/1440 cho list/detail/scan/post/close. |
| Test/build | Targeted tests cho service mapper, page states, permission gates; `npm run lint`, `npm run test -- --run`, `npm run build`. |
| Evidence | Screenshot states, request/response sample, role/account, viewport, command log, blocker owner/ETA. |
| Traceability | Ghi rõ WWHN-209, WWHN-50, HN-OUT-001/002/003, HN-FE-001, HN-FE-004, HN-EPIC-06 trong PR/evidence. |

## 14. Definition of Done đánh giá

| DoD từ Jira | Điều kiện đóng | Trạng thái hiện tại |
| --- | --- | --- |
| Code, review, lint/build/test, evidence UI và traceability hoàn tất. | Có code hoàn chỉnh cho create/list/detail/scan/post/close, review/PR, command pass, screenshots/logs. | Chưa đủ để final sign-off; tài liệu phân rã đã hoàn tất, implementation UI còn thiếu luồng mutation end-to-end. |
| Contract mismatch đã được xử lý hoặc có disposition; tài liệu component/build được cập nhật khi cần. | Mọi thiếu endpoint/field/permission/version có owner BA/BE/DevOps và ETA. | Có blocker disposition ở mục 12; cần xác nhận từ BA/BE. |
| BA/QA có thể kiểm tra theo Acceptance Criteria; không còn blocker chưa có owner và ETA. | Checklist BA/QA rõ, evidence gắn HN-FE-004/WWHN-209. | Chưa có evidence UI mới; cần capture sau implementation và sửa mojibake. |

## 15. Output bàn giao

Output Jira yêu cầu: **Outbound FE**.

Output trong repo:

- `docs/Task_docs_Jira/[FE1] Triển khai luồng hoàn chỉnh xuất kho.md`

Output cần gắn vào HN-FE-004/WWHN-209 khi đóng task:

- Tài liệu này.
- Contract HN-OUT-001/002/003 và HN-FE-001 hoặc link OpenAPI/sample payload đã duyệt.
- Screenshot/video outbound list, detail lines, scan valid/duplicate/invalid, post confirm/success/partial fail, close remainder confirm/success.
- Evidence responsive 390x844, 768x1024, 1366/1440.
- Evidence RBAC: user có `outbound.create`, user có `outbound.post`, user thiếu quyền, user out-of-scope warehouse.
- API evidence: request/response scan, post issue với `Idempotency-Key`/`If-Match`, close remainder, 403/409/412/422/428 nếu có sample.
- Log lint/build/test và disposition cho mọi P0/P1 blocker.
