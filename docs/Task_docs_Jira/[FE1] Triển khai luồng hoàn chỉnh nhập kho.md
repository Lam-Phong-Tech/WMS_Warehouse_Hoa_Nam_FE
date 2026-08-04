# [FE1] Triển khai luồng hoàn chỉnh nhập kho

## 1. Jira scope và kết luận hiện tại

| Hạng mục | Nội dung |
| --- | --- |
| Jira task | `WWHN-207` - `[FE1] Triển khai luồng hoàn chỉnh nhập kho` |
| Task cha | `WWHN-49` - `[FE][INBOUND] UI chứng từ, quét mã, ghi nhận nhập kho và putaway` |
| Epic / trace | `HN-EPIC-05`, `HN-FE-003`, Contract Item `PL01-05`, BA Pin `HN-PIN-05` |
| Dependency | `HN-IN-001`, `HN-IN-002`, `HN-IN-003`, `HN-FE-001` |
| Owner role | FE1 - Quang Nguyễn Thanh |
| Output đầu ra | Inbound FE, inbound responsive màn hình, idempotent submit behavior, UI evidence |
| Trạng thái Jira tham chiếu lúc rà soát | `WWHN-207`: To Do; `WWHN-49`: Blocked/Pending; `WWHN-180`: In Progress; `WWHN-181`: In Review; `WWHN-182`: To Do |

Kết luận: FE đã có nền tảng tích hợp thật cho danh sách/chi tiết phiếu nhập, endpoint constants, service Post Receipt có `Idempotency-Key` và `If-Match`, route RBAC UX gate, trạng thái inbound và màn putaway. Tuy nhiên chưa thể ký final production sign-off cho toàn bộ luồng nhập kho vì parent `WWHN-49` còn `Blocked/Pending`, BE contract `WWHN-180` vẫn có P0/P1 về canonical Scan/Post Receipt/permission/evidence, và QA2 `WWHN-182` chưa chạy happy/negative/RBAC/idempotency/retry trên build cụ thể.

Tài liệu này vì vậy đóng vai trò **FE implementation readiness + handoff checklist có điều kiện**, không thay thế phê duyệt BE/BA/QA cuối cùng.

## 2. Đọc kỹ yêu cầu từ Jira

### 2.1 Mục tiêu của `WWHN-207`

`WWHN-207` yêu cầu triển khai luồng hoàn chỉnh nhập kho. Khi đối chiếu task cha `WWHN-49`, phạm vi không chỉ là mở một màn danh sách mà bao gồm:

| Nhánh nghiệp vụ | FE cần đáp ứng |
| --- | --- |
| List/Create/Detail | Hiển thị danh sách phiếu nhập, lọc/tìm kiếm, xem detail line, tạo phiếu khi contract đủ payload. |
| Quét/Ghi nhận | Có vùng quét, giữ focus, phản hồi duplicate/invalid/unknown nhanh, không submit trùng. |
| Post Receipt | Có confirm trước khi ghi nhận tồn; gửi đúng payload đã duyệt; dùng `Idempotency-Key`; xử lý replay/409/422. |
| Movement/receipt evidence | Sau post phải có bằng chứng receipt/movement hoặc thông tin trace do BE trả về để BA/QA kiểm chứng. |
| Putaway | Sau nhập kho, hiển thị trạng thái/chờ xếp khay; putaway chỉ cập nhật mapping/location, không tự sinh inventory movement ở FE. |
| UI states | Loading, empty, error, success, disabled, confirm, retry và responsive phải rõ. |
| RBAC | Route/action visibility theo permission; backend vẫn là authority cho 403/data scope. |

### 2.2 Input đầu vào phải bám

| Input | Cách dùng trong FE |
| --- | --- |
| Inbound field spec | Là nguồn tên field, trạng thái, nhãn, validation và form/table columns; FE không tự thêm field bắt buộc. |
| HN-IN APIs | Là nguồn endpoint/payload/error/permission/idempotency; nếu mismatch với code hiện tại phải ghi blocker, không tự sửa contract. |
| Component dùng chung `HN-FE-001` | Dùng shared API wrapper, error parser, permission guard, table/form/modal/loading/error patterns. |
| Baseline BA/API/UI/evidence task cha | Dùng để nghiệm thu flow DRAFT -> SCANNING -> PARTIALLY_POSTED/POSTED/CLOSED/CANCELLED và ranh giới scan vs stock movement. |

## 3. Baseline nghiệp vụ nhập kho

### 3.1 Trạng thái chứng từ

| Status | Ý nghĩa FE | Action hợp lệ ở UI |
| --- | --- | --- |
| `DRAFT` | Phiếu mới, chưa quét hoặc chưa bắt đầu ghi nhận. | Xem/sửa nếu có quyền; cancel trước khi post đầu tiên. |
| `SCANNING` | Đang quét/đối chiếu dòng nhập. | Scan, kiểm tra duplicate/invalid, chuẩn bị Post Receipt. |
| `PARTIALLY_POSTED` | Đã ghi nhận một phần. | Tiếp tục scan/post phần còn lại hoặc Close remainder với reason. Không cancel. |
| `POSTED` | Đã ghi nhận đủ theo chứng từ. | Xem evidence, không sửa trực tiếp; sai lệch xử lý qua reversal/correction. |
| `CLOSED` | Đóng phần còn lại hoặc khóa sau post. | Read-only. |
| `CANCELLED` | Đã hủy trước khi có post. | Read-only. |

Nguyên tắc quan trọng: Scan/classify không được coi là điểm đổi tồn. Chỉ Post Receipt mới là điểm sinh receipt/movement. Close remainder không làm đổi tồn. Putaway chỉ cập nhật mapping/location box/tray, không sinh inventory movement.

### 3.2 Luồng FE cần hoàn chỉnh

1. Người dùng vào route Inbound nếu có `inbound.create` hoặc `inbound.post`.
2. FE tải danh sách `/inbound-documents` với filter `search`, `status`, paging và ngày/kho nếu contract cho phép.
3. Người dùng mở detail, FE tải line của phiếu, hiển thị expected/scanned/posted/remaining.
4. Khi quét, FE gửi codes theo endpoint scan đã được BE/BA khóa; kết quả phải phân biệt `VALID`, `DUPLICATE`, `UNKNOWN`, `INVALID`.
5. Khi Post Receipt, FE bắt buộc confirm, gửi line quantity đã chọn, `Idempotency-Key`, `If-Match`/version nếu contract yêu cầu.
6. FE hiển thị kết quả post, refresh document/lines, giữ evidence request id/error code/movement reference nếu BE trả về.
7. Nếu còn remaining, FE cho phép Close remainder theo đúng status và phải có reason.
8. Sau receipt, màn Putaway đọc `/putaway/tasks` và `/putaway/history` để theo dõi xếp box vào khay.

## 4. Đối chiếu code hiện tại

| Surface | File | Hiện trạng | Đánh giá |
| --- | --- | --- | --- |
| Route Inbound | `src/modules/inbound/pages/InboundPage.tsx` | Re-export `ReceivingPage`. | Pass kỹ thuật; nên giữ một entry route canonical để tránh duplicate page ownership. |
| Receiving page | `src/modules/receiving/pages/ReceivingPage.tsx` | Có list, filter status/search, detail modal, loading/error, line table. Nút Post/Close đang hiển thị nhưng chưa wire action hoàn chỉnh trong UI. | Conditional pass; list/detail ready, action flow cần wire/QA sau khi BE contract final. |
| Inbound service | `src/modules/receiving/services/receivingService.ts` | Có fetch list/detail/lines, create/update, scan, post receipt, close remainder, reverse. `postInboundReceipt()` gửi `Idempotency-Key` và `If-Match`. | FE service readiness pass; submit/approve/reject còn tồn tại trong constants/service nhưng parent BA nói Hoa Nam canonical không dùng submit/approve/reject. |
| Inbound types | `src/modules/receiving/types/index.ts` | Có status canonical, `PostReceiptRequest`, `CloseRemainderRequest`, `InboundErrorCode`, `InboundScanResult`. | Pass ở mức FE type guard; error code cần BE xác nhận final. |
| Endpoint constants | `src/shared/api/endpoints.ts` | Có `/inbound-documents`, `/:id/scan`, `/:id/post-receipt`, `/:id/close-remainder`, putaway, scan classify. | Conditional pass; Jira `WWHN-180` còn P0 về canonical scan path và contract evidence. |
| RBAC route | `src/app/router/access.ts` | `ROUTES.INBOUND`: `["inbound.create", "inbound.post"]`; `ROUTES.PUTAWAY`: `["putaway.manage"]`. | UX gate pass có điều kiện; backend permission catalog chưa sign-off. |
| Putaway page/service | `src/modules/putaway/pages/PutawayPage.tsx`, `src/modules/putaway/services/putawayService.ts` | Có task list/history, API thật `/putaway/tasks`, `/putaway/history`, tag không sinh dịch chuyển tồn. | Readiness pass cho list/history; action confirm putaway nếu có phải chờ contract. |

## 5. API, payload và error contract cần khóa

### 5.1 Endpoint FE đang tham chiếu

| Nghiệp vụ | Endpoint FE | Ghi chú contract |
| --- | --- | --- |
| List phiếu nhập | `GET /inbound-documents` | Cần xác nhận filter chính thức: `search`, `status`, `warehouse_id`, `from_date`, `to_date`, paging. |
| Detail phiếu nhập | `GET /inbound-documents/:id` | Cần thống nhất response có `lines/items` hay cần endpoint line riêng. |
| Create phiếu nhập | `POST /inbound-documents` | Chỉ enable khi có field spec/payload bắt buộc đã duyệt. |
| Scan trong phiếu | `POST /inbound-documents/:id/scan` | Cần chốt với baseline Scan classify; scan không đổi tồn. |
| Post Receipt | `POST /inbound-documents/:id/post-receipt` | Bắt buộc idempotency, concurrency/version, validation và receipt/movement evidence. |
| Close remainder | `POST /inbound-documents/:id/close-remainder` | Không đổi tồn; bắt buộc reason; chỉ hợp lệ khi partial. |
| Reverse/correction | `POST /inbound-documents/:id/reverse` | Nếu ngoài scope WWHN-207 thì chỉ hiển thị trace/link, không tự implement rule. |
| Putaway tasks/history | `GET /putaway/tasks`, `GET /putaway/history` | Putaway không sinh movement; chỉ mapping/location. |

### 5.2 Payload tối thiểu Post Receipt

```ts
type PostReceiptRequest = {
  documentId: string;
  lines: { lineId: string; quantity: number }[];
  idempotencyKey: string;
  ifMatch: number;
};
```

FE phải tạo `Idempotency-Key` duy nhất cho mỗi intent người dùng, không tạo lại khi retry cùng intent. `If-Match` phải lấy từ `document.version` hoặc contract concurrency token tương đương. Nếu BE đổi field, FE chỉ cập nhật sau khi có contract duyệt.

### 5.3 Error cần hiển thị rõ

| Error | UI expected |
| --- | --- |
| 403 / thiếu quyền | Hiển thị no-permission hoặc API error 403; không làm lộ dữ liệu. |
| 409 / version conflict | Báo phiếu đã thay đổi, yêu cầu refresh trước khi post lại. |
| 422 / validation | Gắn lỗi vào line/field tương ứng nếu BE trả pointer; nếu không có pointer thì hiển thị alert tổng. |
| Idempotency replay | Hiển thị kết quả trước đó nếu BE trả replay response; không double submit. |
| Duplicate scan | Báo ngay tại vùng scan, giữ focus để nhập mã tiếp theo. |
| Unknown/invalid code | Báo trạng thái rõ, không tự thêm vào line hợp lệ. |
| Network/5xx | Cho retry có kiểm soát; không đổi local stock state. |

## 6. UI state và responsive checklist

| State | Yêu cầu nghiệm thu |
| --- | --- |
| Loading list | Table loading/skeleton không làm nhảy layout; filter bị hạn chế spam nếu đang tải. |
| Empty list | Empty state phân biệt chưa có dữ liệu với lỗi API. |
| Error list/detail | Hiển thị message từ shared API error; giữ request id/error code nếu có. |
| Detail loading | Modal/drawer detail có loading riêng, không che toàn bộ page. |
| Scan focus | Sau mỗi scan thành công/lỗi, input vẫn focus; Enter không gửi trùng khi request pending. |
| Duplicate/invalid | Mã lỗi hiển thị gần input hoặc line; không cộng số lượng vào `scanned` hợp lệ. |
| Post disabled | Disable khi không có line hợp lệ, quantity <= 0, đang pending, thiếu quyền, status không hợp lệ hoặc thiếu version/idempotency. |
| Confirm Post Receipt | Modal confirm nêu số dòng, tổng qty, phiếu, hậu quả đổi tồn, và idempotency retry behavior. |
| Success result | Refresh list/detail; hiển thị receipt/movement reference nếu có. |
| Close remainder | Chỉ mở khi `PARTIALLY_POSTED`, bắt buộc reason, confirm rõ không đổi tồn. |
| Responsive | Desktop/tablet/mobile không vỡ table/action; mobile cần ưu tiên code, status, remaining, action mở detail. |

## 7. RBAC và visibility

RBAC trong FE chỉ là UX gate. Backend vẫn là source of truth cho permission, data scope và audit.

| Surface | Permission FE hiện tại | Expected behavior |
| --- | --- | --- |
| Inbound route | `inbound.create` hoặc `inbound.post` | Có một trong hai quyền được vào màn; thiếu quyền chuyển no-permission. |
| Create/edit | Cần mapping BE/BA final | Không enable nếu chưa có permission code và payload contract. |
| Scan/Post Receipt | `inbound.post` dự kiến | Thiếu quyền thì disable action; nếu BE trả 403 vẫn hiển thị đúng. |
| Close remainder | `inbound.post` hoặc permission riêng nếu BE định nghĩa | Không tự suy diễn nếu backend tách quyền. |
| Putaway | `putaway.manage` | Có quyền mới vào màn putaway; BE vẫn phải chặn API. |

Open point: `WWHN-180` còn yêu cầu đồng bộ backend permission catalog với FE `ROUTE_PERMISSIONS`. Vì vậy các permission trên chỉ là mapping FE hiện tại, chưa phải final RBAC sign-off.

## 8. Evidence BA/QA cần có

| Evidence | Người chạy | Bắt buộc gồm |
| --- | --- | --- |
| Lint/build/test | FE1 | Command, thời gian, commit/build hash, pass/fail log. |
| UI responsive | FE1/QA2 | Screenshot desktop/tablet/mobile cho list, detail, scan, confirm, result, empty/error. |
| RBAC | QA2/BE2 | User đủ quyền, thiếu quyền, API 403 trực tiếp, route no-permission. |
| Happy path | QA2 | Create/open phiếu, scan valid, Post Receipt, thấy receipt/movement evidence, putaway task xuất hiện. |
| Negative scan | QA2 | Duplicate, unknown, invalid, scan pending không double submit. |
| Idempotency | QA2/BE1 | Retry cùng key không double receipt; replay/409 hiển thị đúng. |
| 422 validation | QA2/BE1 | Quantity vượt expected, line mismatch, invalid status transition. |
| Putaway | QA2 | Task/history hiển thị, confirm mapping nếu có, chứng minh không sinh movement. |

## 9. Ma trận blocker/disposition

| ID | Severity | Vấn đề | Owner | Disposition |
| --- | --- | --- | --- | --- |
| WWHN-207-BE-01 | P0 | BE contract `WWHN-180` chưa được approved thật; còn P0 về Scan/Post Receipt/Post Issue/Apply Adjustment endpoint, payload, error, permission, idempotency, sample. | BE1 + BA | Open external blocker. FE chỉ giữ readiness layer, không ký final. |
| WWHN-207-BE-02 | P0 | Canonical scan path chưa khóa giữa `POST /api/v1/scan/classify`, `POST /scan-batches/classify` và scan trong inbound document. | BE1 + BA + FE1 | Open. Cần một path/schema duy nhất và rule `stock_effect=NONE`. |
| WWHN-207-FE-01 | P1 | UI action Post Receipt/Close remainder ở page hiện tại chưa wire end-to-end trong `ReceivingPage`. | FE1 | Cần implement action UI sau khi BE contract final; service đã có hàm. |
| WWHN-207-FE-02 | P1 | Service/constants còn submit/approve/reject, trong khi BA review nói inbound Hoa Nam không có submit/approve/reject canonical. | FE1 + BA | Không dùng làm canonical flow; cần cleanup/disable hoặc ghi legacy ngoài scope khi contract final. |
| WWHN-207-RBAC-01 | P1 | Permission catalog backend chưa sign-off với FE `ROUTE_PERMISSIONS`. | BE2/RBAC owner + BA + FE1 | Open. FE route guard là UX evidence có điều kiện. |
| WWHN-207-QA-01 | P1 | QA2 `WWHN-182` chưa chạy happy/negative/RBAC/idempotency/retry trên build cụ thể. | QA2 | Open external blocker; cần attach evidence trước nghiệm thu. |
| WWHN-207-EVD-01 | P2 | Chưa có đủ screenshot/network evidence cho responsive/API state thật. | FE1 + QA2 | Cần capture sau khi build/deploy có API contract đúng. |

## 10. Checklist triển khai sâu cho FE1

| Bước | Việc cần làm | Điều kiện pass |
| --- | --- | --- |
| 1 | Đối chiếu lại contract inbound với BE/BA sau khi `WWHN-180` cập nhật. | Có endpoint/payload/error/permission/sample/version rõ cho list/detail/scan/post/close/putaway. |
| 2 | Cleanup canonical flow trong FE: không expose submit/approve/reject nếu Hoa Nam không dùng. | UI không hiển thị action trái baseline; code legacy nếu giữ phải có comment ngoài scope. |
| 3 | Wire scan UI: input focus, pending guard, duplicate/invalid/unknown display. | Không double submit; line state đúng; lỗi không bị nuốt thành empty. |
| 4 | Wire Post Receipt action bằng `postInboundReceipt()`. | Confirm trước post; gửi `Idempotency-Key` và `If-Match`; xử lý 409/422/replay. |
| 5 | Wire Close remainder. | Chỉ enable đúng status; bắt buộc reason; refresh state sau success. |
| 6 | Bổ sung receipt/movement evidence display. | BA/QA nhìn được receipt id, movement ref, request id hoặc trace source theo response BE. |
| 7 | Kiểm tra RBAC action-level. | Thiếu quyền disable/ẩn action; API 403 vẫn hiển thị bằng shared error. |
| 8 | Kiểm responsive. | Không vỡ layout ở 1366px, tablet và mobile; action detail vẫn dùng được. |
| 9 | Chạy lint/build/test phù hợp. | Log pass/fail được ghi vào evidence. |
| 10 | Bàn giao BA/QA. | Có checklist evidence, blocker còn lại có owner/ETA/disposition. |

## 11. Acceptance Criteria mapping

| Acceptance Criteria Jira | Mapping trong tài liệu/code | Trạng thái |
| --- | --- | --- |
| Output “Inbound FE” được rà soát/xác minh, gắn evidence vào `HN-FE-003` và không còn blocker FE1. | Tài liệu này phân rã output và blocker; code có page/service/types/RBAC. | Conditional; cần wire action UI và attach evidence. |
| UI đáp ứng business rule, field spec, responsive; xử lý loading/empty/error/success/disabled/confirm. | Checklist mục 6 và 10; page hiện có loading/error/list/detail; confirm/action cần hoàn thiện sau contract. | Partial pass. |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu/rule trái contract. | `ROUTE_PERMISSIONS`, service API thật, không mock list/detail; permission catalog final còn mở. | Conditional pass. |
| Tích hợp đúng endpoint/payload đã duyệt; lint/build/test phù hợp pass. | Endpoint/service đã có; contract BE chưa approved thật. | Blocked bởi `WWHN-180`; cần chạy lại sau final contract. |
| BA/QA có evidence; không còn P0/P1 blocker chưa disposition. | Mục 8 và 9 liệt kê evidence/blocker. | Chưa đạt final vì QA2/BE blocker còn mở. |

## 12. Definition of Done cho WWHN-207

WWHN-207 chỉ nên chuyển khỏi To Do/In Progress khi đạt đủ:

1. BE/BA khóa contract inbound/scan/post receipt/putaway và đóng P0 liên quan ở `WWHN-180`.
2. FE route/page/action dùng đúng canonical flow Hoa Nam, không còn action submit/approve/reject trong UI sản xuất nếu BA xác nhận không thuộc scope.
3. Post Receipt chạy qua service thật, có confirm, idempotency, version guard, success/error state và evidence receipt/movement.
4. Scan duplicate/invalid/unknown có phản hồi nhanh, giữ focus và chống double submit.
5. Putaway list/history hoạt động với API thật và không làm sai stock-effect.
6. RBAC route/action và API 403 được QA/BE chứng minh.
7. Lint/build/test phù hợp pass trên commit/build cụ thể.
8. QA2 attach happy/negative/RBAC/idempotency/retry evidence; blocker còn lại có owner, ETA và disposition.

## 13. Change log

| Thời điểm | Nội dung |
| --- | --- |
| 2026-08-01 | Tạo tài liệu WWHN-207 từ Jira `WWHN-207`, task cha `WWHN-49`, tình trạng `WWHN-180/181/182`, và đối chiếu repo hiện tại. Ghi rõ FE readiness, checklist triển khai sâu, evidence cần có và blocker final sign-off. |
