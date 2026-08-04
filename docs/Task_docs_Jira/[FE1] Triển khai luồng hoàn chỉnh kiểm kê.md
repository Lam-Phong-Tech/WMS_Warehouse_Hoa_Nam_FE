# WWHN-242 - [FE1] Triển khai luồng hoàn chỉnh kiểm kê/đảo giao dịch

## 1. Thông tin Jira và traceability

| Trường | Giá trị |
| --- | --- |
| Jira task | WWHN-242 |
| Link nguồn | https://tan0110.atlassian.net/browse/WWHN-242 |
| Tiêu đề | [FE1] Triển khai luồng hoàn chỉnh kiểm kê/đảo giao dịch |
| Issue type | Subtask |
| Trạng thái khi đọc | In Progress |
| Priority | Medium |
| Assignee | Quang Nguyễn Thanh |
| Reporter | Wuangg |
| Created | 2026-07-19 21:28:24 +0700 |
| Updated trên Jira | 2026-08-01 20:56:12 +0700 |
| Task cha | WWHN-62 - [FE][STOCKTAKE] UI phiên kiểm kê, đếm, đối soát, phê duyệt và đảo giao dịch |
| Dependency | HN-STK-001; HN-STK-002; HN-STK-003; HN-REV-001 |
| Parent Temp Key | HN-FE-006 |
| Epic Temp Key | HN-EPIC-07 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Output đầu ra | kiểm kê FE |
| Ngày cập nhật tài liệu | 2026-08-01 ICT |

Tài liệu này là artifact phân rã và bàn giao cho WWHN-242. Description Jira ghi mục tiêu ngắn là "Triển khai luồng hoàn chỉnh kiểm kê/đảo giao dịch", nhưng Acceptance Criteria yêu cầu FE1 không chỉ dựng UI danh sách: phải bám baseline nghiệp vụ, API/UI specification, RBAC, responsive, trạng thái UI, evidence, lint/build/test và disposition cho mọi contract mismatch còn lại.

## 2. Diễn giải sâu mục tiêu

Mục tiêu của WWHN-242 cần được hiểu là hoàn thiện bề mặt frontend cho luồng stocktake end-to-end và reversal liên quan, từ lúc tạo phiên kiểm kê đến đếm, đối soát chênh lệch, phê duyệt/apply adjustment và xử lý đảo giao dịch khi cần. Đây là luồng ảnh hưởng tồn kho, nên FE chỉ được hiển thị, thu thập input, gửi payload đúng contract và bảo vệ trải nghiệm; backend vẫn là authority cho tồn kho, khóa giao dịch, idempotency, version, RBAC và audit.

| Lớp mục tiêu | FE1 phải đạt | Không được làm |
| --- | --- | --- |
| Phiên kiểm kê | Hiển thị danh sách phiên, scope, owner, snapshot time, tiến độ đếm, variance, movement warning, trạng thái và action theo permission/state. | Không tạo rule trạng thái riêng ở FE, không coi session list là đủ cho luồng kiểm kê hoàn chỉnh. |
| Tạo phiên | Form tạo phiên có scope toàn kho/theo SKU/theo nhóm nếu contract hỗ trợ; khi tạo phải hiểu hệ thống chụp snapshot và `stocktake_started_at`. | Không tự lock toàn kho ở FE, không tự suy diễn snapshot qty hoặc cutoff khi BE chưa trả. |
| Đếm tồn | Màn count line cho từng SKU/location/serial-scan nếu baseline yêu cầu; có expected/snapshot, actual, note, counted_by/count_time, trạng thái pending/counted/re-count/verified. | Không tự update balance sau khi nhập số đếm; không hard-code actual hoặc bỏ qua SKU không khớp. |
| Đối soát variance | Hiển thị formula baseline: `expected_at_count = snapshot_qty + net_movement_after_snapshot_to_count_cutoff`; `variance_to_apply = actual_qty - expected_at_count`; cảnh báo movement sau snapshot. | Không tự tính canonical variance thay BE nếu BE đã trả field; formula chỉ để hiển thị/đối chiếu và cảnh báo. |
| Phê duyệt/apply adjustment | Action apply chỉ bật khi session đủ điều kiện, có confirm rõ stock effect, idempotency key, request_id/error handling và kết quả từng line. | Không cho click lặp gây double adjustment; không apply khi session stale, đã adjusted hoặc thiếu quyền. |
| Đảo giao dịch/reversal | Tra cứu movement/chứng từ có thể đảo, hiển thị original/reversed/reversible/dependency guard, tạo reversal append-only với reason và idempotency. | Không sửa/xóa movement gốc; không đảo vượt số còn reversible; không bỏ qua downstream dependency. |
| UI states/RBAC/API error | Loading, empty, error, success, disabled, confirm, no permission, 403/409/412/422/428 phải rõ và giữ input hợp lệ khi retry. | Không nuốt lỗi thành empty; không dùng việc ẩn nút làm bảo mật cuối cùng. |
| Evidence | Có screenshot desktop/tablet/mobile, role/RBAC matrix, request/response hoặc mock contract có nguồn, log lint/build/test và blocker disposition. | Không sign-off khi còn P0/P1 blocker FE1 chưa có owner/ETA. |

## 3. Input đầu vào từ Jira và cách sử dụng

| Input từ Jira | Ý nghĩa | Cách FE1 sử dụng |
| --- | --- | --- |
| Task cha WWHN-62 | Nguồn scope trực tiếp cho "[FE][STOCKTAKE] UI phiên kiểm kê, đếm, đối soát, phê duyệt và đảo giao dịch". | Trace mọi màn stocktake/reversal về WWHN-62/HN-FE-006; không tách reversal ra ngoài nếu nó là một phần AC của parent. |
| Dependency HN-STK-001 | Baseline nghiệp vụ kiểm kê: session, scope, snapshot, count, variance, workflow state. | Khóa UI fields, state machine và formula hiển thị; thiếu rule thì comment blocker cho BA/BAS. |
| Dependency HN-STK-002 | API/UI specification cho count/reconcile/apply adjustment, validation, error code, permission. | Dùng để tạo service/type/payload và mapping lỗi; mismatch với code phải được raise trước khi sign-off. |
| Dependency HN-STK-003 | Evidence/sample data hoặc phần mở rộng kiểm kê như movement warning/cutoff/approval. | Dùng làm bộ case QA: có movement sau snapshot, variance +/-, counted 0, re-count, adjusted/cancelled. |
| Dependency HN-REV-001 | Baseline đảo giao dịch: append-only reversal, reference movement/document, idempotency, dependency guard. | Dùng cho surface reversal: tra cứu reversible movement, form tạo reversal, confirm, audit và error behavior. |
| Baseline nghiệp vụ, API/UI specification, dữ liệu mẫu/evidence | Nguồn kiểm chứng cho field, enum, status, permission, sample response và hình ảnh bàn giao. | Ghi rõ nguồn trong PR/evidence; không dùng mock local như bằng chứng tích hợp production nếu BE chưa sẵn sàng. |

## 4. Vai trò và phối hợp

| Bên | Trách nhiệm | Điểm phối hợp bắt buộc |
| --- | --- | --- |
| FE1 - Quang Nguyễn Thanh | Chủ trì UI stocktake/reversal, wiring service/type, responsive, UI states, RBAC UX, evidence và tài liệu bàn giao. | Chỉ triển khai phần frontend; không tự chốt business rule về snapshot, variance, apply adjustment, reversible qty hoặc downstream guard. |
| BA/BAS | Cung cấp rule nghiệp vụ, UI/UX, field specification, Acceptance Criteria và open point đã chốt. | Chốt status workflow, scope kiểm kê, formula hiển thị, copy warning, điều kiện được apply/reverse và evidence bắt buộc. |
| BE1/BE2 | Cung cấp endpoint, payload, validation, error code, permission, sample data, version/idempotency behavior. | Khóa canonical path cho stocktake/reversal; xác nhận `Idempotency-Key`, `If-Match` nếu có, 403/409/412/422/428 và request_id. |
| DevOps | Cấu hình build/environment nếu API base, auth, proxy, mock server hoặc deploy target ảnh hưởng module. | Xác nhận env runtime, CORS/cookie/token và dữ liệu UAT cho capture evidence. |
| BA/QA | Nghiệm thu theo AC, responsive, RBAC, UI states và evidence. | Test đủ session lifecycle, count/re-count, variance, apply adjustment, reversal, no permission và lỗi API. |

## 5. Baseline nghiệp vụ đã đọc

| Nguồn | Baseline rút ra | Tác động FE |
| --- | --- | --- |
| WWHN-242 Description | Output "kiểm kê FE" phải được rà soát/xác minh, tích hợp đúng endpoint/payload đã duyệt, không còn blocker FE1. | Tài liệu phải chỉ rõ trạng thái hiện tại, gap, blocker và checklist evidence trước sign-off. |
| Wireframe P0 SCR-STK-01 | Stocktake list gồm `/stocktake-sessions`, `/counts`, `/variances`, `/apply-adjustment`; không khóa toàn kho; có scope, trạng thái, owner, action, movement warning. | UI hiện tại cần tiến từ list/snapshot sang detail count, variance review và apply adjustment. |
| Wireframe formula STK | `expected_at_count = snapshot_qty + net_movement_after_snapshot_to_count_cutoff`; `variance_to_apply = actual_qty - expected_at_count`. | FE cần hiển thị expected/snapshot/net movement/actual/variance rõ, nhưng không tự thay BE làm nguồn tính canonical. |
| Wireframe P0 SCR-REV-01 | Reversal tra cứu movement có thể đảo; append-only; original movement giữ nguyên; idempotency + If-Match; có original qty, reversed, reversible, dependency guard. | UI reversal không chỉ list reversal document; cần surface tra cứu movement, guard, form reverse và confirm. |
| Wireframe permission matrix | Kiểm kê: "NV đếm, QL apply", permissions `stocktake.count`, `stocktake.apply`; Reversal: QL kho, `inventory.reversal.post`. | Route/action guard cần tách count/apply nếu BE catalog xác nhận; hiện route mới có `stocktake.count`. |
| HTTP/error behavior P1 | 403 ẩn dữ liệu/action; 409 không làm lại stock effect; 412 giữ input, reload version; 422 inline rule; 428 yêu cầu precondition. | Apply adjustment và create reversal bắt buộc có confirm, disabled/loading, idempotency handling, retry không gây double mutation. |
| Architecture guide | Module `stocktake` quản lý sessions/counts/adjustments; module `reverse` quản lý reversal documents/adjustments; route permissions là UX gates. | Giữ boundary module hiện tại; không nhập reversal vào inventory page nếu task yêu cầu surface riêng. |

## 6. Đối chiếu repo hiện tại

| Surface | File/nguồn | Đã có | Khoảng trống với WWHN-242 |
| --- | --- | --- | --- |
| Route/RBAC | `src/app/router/access.ts` | `ROUTES.STOCKTAKE` yêu cầu `stocktake.count`; `ROUTES.REVERSE` yêu cầu `inventory.reversal.post`; comment nhắc FE chỉ là UX gate. | Chưa có action permission riêng cho `stocktake.apply`; chưa thấy phân quyền NV đếm vs QL apply trong UI. |
| Endpoint constants | `src/shared/api/endpoints.ts` | Có `STOCKTAKE_SESSIONS`, `INVENTORY_SNAPSHOTS`, `STOCKTAKE_COUNT`, `STOCKTAKE_APPLY_ADJUSTMENT`, `REVERSAL_DOCUMENTS`, `REVERSAL_DOCUMENT`, `REVERSAL_CREATE`. | Path đang là `/stocktake/sessions`, trong wireframe là `/stocktake-sessions`; cần BE xác nhận canonical. Chưa có endpoint tra cứu reversible movement riêng. |
| Stocktake types | `src/modules/stocktake/types/index.ts` | Có `StocktakeSession`, `StocktakeSnapshot`, `StocktakeCount`, `StocktakeVariance`, `ApplyAdjustmentRequest/Response`, error codes. | Type chưa có `net_movement_after_snapshot`, `expected_at_count`, `movement_warning_count`, `version/etag`, approval fields nếu HN-STK yêu cầu. |
| Stocktake service | `src/modules/stocktake/services/stocktakeService.ts` | Có fetch sessions/snapshots/counts/variances, submit count, apply adjustment với `Idempotency-Key`. Có normalization nhiều alias field. | UI chưa gọi `submitStocktakeCount`, `fetchStocktakeCounts`, `fetchStocktakeVariances`, `applyStocktakeAdjustment`. Apply chưa gửi `If-Match` nếu contract yêu cầu. |
| Stocktake page | `src/modules/stocktake/pages/StocktakePage.tsx` | Có tabs list/snapshots, table session/snapshot, search input và nút tạo phiên dạng visual. | Chưa có create modal, session detail, count entry, variance review, movement warning, apply confirm, API error alert, empty state riêng, success state, disabled/action guard. Nhiều label đang mojibake. |
| Reversal types | `src/modules/reverse/types/index.ts` | Có `ReversalDocument`, `ReversalLine`, `CreateReversalRequest/Response`, error codes. | Type chưa mô tả movement lookup: original movement, source, original_qty, reversed_qty, reversible_qty, dependency guard, version. |
| Reversal service | `src/modules/reverse/services/reversalService.ts` | Có fetch list/detail/lines và create reversal với `Idempotency-Key`. | Chưa có service tra cứu movement có thể đảo; `createReversalDocument()` luôn gửi idempotency header nhưng chưa có If-Match/version. |
| Reversal page | `src/modules/reverse/pages/ReversalPage.tsx` | Có list reversal documents, search input và nút tạo hoàn đảo dạng visual. | Chưa có movement lookup, filter loại gốc/reversible, guard downstream, detail trace chain, form create reversal, confirm/reason/version, UI error/empty/success. Nhiều label đang mojibake. |
| Shared UI states | `src/shared/components/feedback`, `src/shared/components/data-display`, `src/shared/components/permission` | Repo có pattern `ApiErrorAlert`, `NoPermissionState`, confirm/permission helpers theo architecture/docs. | Stocktake/Reversal pages hiện dùng AntD raw table và catch lỗi thành `[]`, chưa dùng pattern error/no permission/request_id. |

Kết luận đối chiếu: FE foundation đã có service/type đủ hơn mức UI, nhưng chưa đạt "luồng hoàn chỉnh". WWHN-242 chưa thể sign-off ở mức sâu nếu chỉ dựa vào màn list hiện tại; cần hoàn thiện workflow screens/actions hoặc ít nhất ghi rõ blocker external và phần FE còn thiếu.

## 7. Luồng kiểm kê FE cần triển khai

### 7.1 Danh sách phiên kiểm kê

Danh sách phiên là cửa vào nghiệp vụ. Mỗi row cần đủ thông tin để QL kho biết phiên nào đang cần đếm, phiên nào cần review variance và phiên nào đã apply.

| Field/UI | Expected |
| --- | --- |
| Mã phiên | `code/session_code/doc_no`, link mở detail. |
| Scope | Toàn kho/theo SKU/theo nhóm/theo location nếu contract hỗ trợ. |
| Thời điểm snapshot | `snapshot_at` hoặc `stocktake_started_at`, hiển thị timezone nhất quán. |
| Tiến độ | `counted_sku / total_sku`, phần trăm, không chỉ số SKU đã đếm rời rạc. |
| Variance | Số dòng variance, phân biệt shortage/surplus/match nếu có. |
| Movement warning | Số movement phát sinh sau snapshot đến cutoff; mở panel chi tiết nếu BE trả. |
| Status | DRAFT/COUNTING/REVIEWING/COMPLETED/APPLIED/CANCELLED hoặc enum canonical từ HN-STK. |
| Owner/action | Owner, "Tiếp tục đếm", "Review", "Apply", "Chi tiết" theo status và permission. |

State bắt buộc: loading skeleton/table spinner không nhảy layout; empty có giải thích theo filter; error có retry và request_id; search/filter giữ state khi lỗi; no permission không lộ session ngoài scope.

### 7.2 Tạo phiên kiểm kê

Form tạo phiên cần tối thiểu có tên phiên, warehouse/scope, mode toàn kho/theo SKU/theo nhóm, optional note và danh sách SKU/group nếu scope không phải toàn kho. Khi submit thành công, UI cần đưa user vào phiên mới hoặc refresh list với success feedback.

Điểm kiểm soát bắt buộc:

| Nhóm | Expected |
| --- | --- |
| Validation | Required field rõ, không submit khi thiếu scope/tên/warehouse hoặc SKU list invalid. |
| Snapshot behavior | Copy nêu rõ BE sẽ chụp snapshot tại thời điểm tạo/bắt đầu; FE không tự tính snapshot. |
| Concurrent operation | Hiển thị warning "không khóa toàn kho" nếu baseline giữ nhập/xuất hoạt động. |
| Permission | Nút tạo chỉ mở theo quyền tạo/manage stocktake nếu BE catalog xác nhận; nếu chỉ có `stocktake.count`, cần BA/BE disposition. |
| Error | 403/422/409/412/428 xử lý theo shared pattern, không tạo phiên local giả. |

### 7.3 Nhập số đếm

Màn count detail phải là nơi NV kho nhập actual count. Nên có table theo SKU/location với expected/snapshot/counted actual/note/status và action save từng dòng hoặc batch theo contract.

| Trường | Expected |
| --- | --- |
| SKU identity | SKU, tên SKU, UOM, location hint, barcode/serial mode nếu baseline yêu cầu. |
| Expected/snapshot | `snapshot_qty`, `expected_qty` hoặc `expected_at_count` rõ nguồn. |
| Actual count | Numeric input không âm, precision theo UOM, hỗ trợ 0 thật khác blank. |
| Count metadata | `counted_by`, `counted_at`, note/reason nếu re-count. |
| Save behavior | Gọi `submitStocktakeCount(sessionId, payload)`, loading theo row/batch, chống double submit. |
| Re-count/verify | Nếu status `RE_COUNT`/`VERIFIED` có rule khóa input hoặc yêu cầu reason. |

Hiện service đã có `submitStocktakeCount()`, nhưng page chưa wire. Đây là gap FE trực tiếp.

### 7.4 Review variance và movement warning

Variance review là phần lõi của kiểm kê, vì nó quyết định adjustment. UI cần hiển thị đủ công thức và dữ liệu để QL kho kiểm tra trước khi apply:

`expected_at_count = snapshot_qty + net_movement_after_snapshot_to_count_cutoff`

`variance_to_apply = actual_qty - expected_at_count`

| Thành phần | Expected |
| --- | --- |
| Snapshot qty | Tồn tại thời điểm bắt đầu kiểm kê. |
| Net movement sau snapshot | Tổng nhập/xuất/adjust/reversal trong khoảng từ snapshot đến count cutoff. |
| Expected at count | Số lượng kỳ vọng tại thời điểm chốt đếm. |
| Actual qty | Số lượng thực đếm. |
| Variance | +/-/0, type surplus/shortage/match, reconcile status. |
| Movement warning | Link mở movement liên quan, cảnh báo chưa ack hoặc cần review. |
| Disposition | Approve/reject/re-count/reason nếu HN-STK yêu cầu. |

Hiện service có `fetchStocktakeVariances()`, nhưng type chỉ có expected/actual/variance và page chưa hiển thị. Nếu BE chưa trả net movement/cutoff, đây là blocker contract.

### 7.5 Apply adjustment

Apply adjustment là mutation ảnh hưởng tồn kho. UI phải có confirm mạnh, idempotency và trạng thái kết quả rõ từng dòng.

| Điều kiện | Expected |
| --- | --- |
| Enable action | Chỉ bật khi session ở trạng thái review/complete hợp lệ, có variance approved, không stale, user có quyền apply. |
| Confirm | Modal nêu session, số dòng apply, tổng chênh lệch, stock effect +/- và idempotency key. |
| Payload | Gọi `applyStocktakeAdjustment({ session_id, lines, idempotency_key })`; nếu contract yêu cầu version, gửi `If-Match`. |
| Loading | Disable nút trong lúc submit, không cho double click. |
| Success | Hiển thị adjusted lines, total variance, status ADJUSTED/PARTIALLY_ADJUSTED/FAILED và refresh session/variance. |
| Partial fail | Hiển thị lỗi từng SKU, không che giấu line fail. |
| Error | 409 idempotency/state conflict tải state hiện tại; 412 stale giữ review input và reload version; 422 inline rule; 428 yêu cầu precondition. |

Hiện service đã có idempotency support, nhưng UI chưa gọi và chưa có confirm/action guard.

## 8. Luồng đảo giao dịch FE cần triển khai

### 8.1 Tra cứu movement có thể đảo

Reversal không nên bắt đầu bằng danh sách reversal document đã tạo. User cần tra cứu movement/chứng từ gốc để biết còn phần nào reversible.

| Field/UI | Expected |
| --- | --- |
| Movement/source | Movement ID, source document code/type, posted_at. |
| Movement type | RECEIPT_POSTED, ISSUE_POSTED, ADJUST_IN/OUT, STOCKTAKE_ADJUSTMENT hoặc enum BE. |
| SKU/qty | SKU, original_qty, reversed_qty, reversible_qty, remaining_qty. |
| Dependency guard | Không downstream, chờ hàng quay lại, đã xuất downstream, đã reverse một phần. |
| Action | Reverse, tạo request, xem guard, disabled nếu không reversible. |
| Filter | Search movement/chứng từ, loại gốc, reversible status, date/warehouse nếu contract hỗ trợ. |

Hiện `ReversalPage` chỉ fetch `/reversal-documents`, chưa có endpoint/service cho movement lookup. Cần BE/BA xác nhận HN-REV-001 cung cấp endpoint nào.

### 8.2 Form tạo reversal

Form reversal phải append-only và không sửa movement gốc. Tối thiểu cần reference document/movement, reversal type, reason, lines SKU/reversal_qty và idempotency key.

| Nhóm | Expected |
| --- | --- |
| Reference | Movement/document gốc rõ, version/etag nếu contract dùng `If-Match`. |
| Lines | Mỗi line không vượt `reversible_qty`; phải có reason nếu baseline yêu cầu. |
| Guard | Downstream dependency hiển thị trước khi submit; disabled line không đủ điều kiện. |
| Confirm | Modal nhấn mạnh original movement giữ nguyên, tạo correction chain, stock effect +/- rõ. |
| Submit | Gọi `createReversalDocument()` với `Idempotency-Key`; nếu có version thì gửi `If-Match`. |
| Result | Hiển thị reversal_code, status, reversed_lines, errors từng SKU và link detail/trace. |

### 8.3 Trace chain và audit

Sau khi tạo hoặc mở reversal detail, FE cần giúp QA/QL kho nhìn được correction chain:

| Surface | Expected |
| --- | --- |
| Original | Movement/chứng từ gốc, original qty, posted by/time. |
| Reversal history | Các reversal trước đó, partial qty, status. |
| Remaining reversible | Số còn được đảo và lý do phần không đảo được. |
| Audit | Created/approved/reversed by/time, reason, request_id nếu API trả. |
| Report relation | Nhắc XNT/movement history tính net effect, không sửa/xóa movement gốc. |

Hiện service có `fetchReversalDocument()` và `fetchReversalLines()`, nhưng page chưa có detail/trace UI.

## 9. API, payload, error và RBAC cần khóa

| Nhóm contract | Cần BE/BA xác nhận | Gợi ý FE type/service |
| --- | --- | --- |
| Stocktake sessions | Canonical path `/stocktake/sessions` hay `/stocktake-sessions`, params search/scope/status, fields owner/progress/movement_warning/version. | `StocktakeSession`, `StocktakeSessionParams`, `CreateStocktakeSessionRequest`. |
| Create session | Endpoint tạo phiên, payload scope/warehouse/SKU group, snapshot behavior, duplicate/open-session rule. | `createStocktakeSession()` với validation mapping. |
| Count lines | Endpoint count list/detail/submit, payload actual_qty/note, row status, re-count/verify rule. | `StocktakeCount`, `SubmitStocktakeCountRequest`. |
| Variance | Endpoint `/variances`, formula fields, movement after snapshot, cutoff, approval/disposition fields. | `StocktakeVariance`, `StocktakeMovementWarning`, `VarianceDispositionRequest`. |
| Apply adjustment | Endpoint/payload, idempotency, If-Match/version, partial fail, generated movement IDs. | `ApplyAdjustmentRequest/Response` mở rộng `version`, `movement_ids`, `line_errors`. |
| Reversible movement lookup | Endpoint search movement/chứng từ có thể đảo, filters, reversible qty, dependency guard. | `ReversibleMovement`, `ReversalLookupParams`. |
| Create reversal | Endpoint/payload, reversal type enum, reason required, line qty rule, idempotency, If-Match. | `CreateReversalRequest/Response` mở rộng `reference_version`, `dependency_guard`. |
| Error code | 403, 404, 409, 412, 422, 428, already adjusted/reversed, insufficient stock, exceeds original, stale session. | Reuse `ApiErrorAlert`, inline field mapping, request_id display. |
| RBAC | `stocktake.count`, `stocktake.apply`, create/manage session, `inventory.reversal.post`, data scope warehouse. | Route/action guard via existing permission helpers; no permission state cho action quan trọng. |

Open blocker hiện tại: frontend đã có constants và services một phần, nhưng chưa có evidence BE locked contract cho các phần create session, movement lookup, version/If-Match, permission split `stocktake.apply`.

## 10. UI states bắt buộc

| State | Stocktake expected | Reversal expected |
| --- | --- | --- |
| Loading | Skeleton/table loading cho list, detail, count, variance; row loading khi save count/apply. | Loading cho movement lookup, reversal list/detail, create submit. |
| Empty | Không có phiên theo filter, không có line cần đếm, không có variance; có clear filter hoặc hướng dẫn tạo phiên nếu đủ quyền. | Không có movement reversible theo filter khác với API error; không có document reversal. |
| Error | Alert có retry, request_id; không catch lỗi thành `[]`. | Alert có retry, request_id; giữ search/filter/reference đang nhập. |
| Success | Toast/banner sau create session, save count, apply adjustment; refresh data. | Toast/banner sau create reversal, hiển thị reversal_code và link detail. |
| Disabled | Disable action khi invalid input, thiếu quyền, stale version, status không hợp lệ, đang submit. | Disable line/action khi dependency guard, qty vượt reversible, thiếu reason/idempotency. |
| Confirm | Create session nếu snapshot ngay; apply adjustment phải confirm stock effect. | Create reversal phải confirm append-only và stock effect. |
| No permission | Route/action no-permission không lộ data ngoài scope; phân biệt count vs apply nếu có quyền khác nhau. | Chặn create reversal khi thiếu `inventory.reversal.post`. |

## 11. Responsive và UX evidence

| Viewport | Kỳ vọng |
| --- | --- |
| 390x844 mobile | Session list/card không tràn; search/filter wrap hoặc drawer; count input dễ thao tác; confirm modal không mất nút chính; table có horizontal scroll có kiểm soát nếu dữ liệu quá rộng. |
| 768x1024 tablet | List + filter ổn định; detail/variance chia nhóm rõ; action sticky hoặc đủ dễ tìm; không che input bởi modal. |
| 1366/1440 desktop | Table đủ cột nghiệp vụ; detail có panels session summary/count/variance/movement/reversal; action theo trạng thái rõ. |

Evidence tối thiểu cần capture: list session, create session modal, count entry, variance review có movement warning, apply confirm, apply success/partial fail, reversal movement lookup, reversal form, no permission, API error, empty state.

## 12. Acceptance Criteria mapping

| Acceptance Criteria từ Jira | Đánh giá FE1 | Evidence/cần bổ sung |
| --- | --- | --- |
| Output "kiểm kê FE" được rà soát/xác minh, gắn evidence vào HN-FE-006 và không còn blocker FE1. | Tài liệu này phân rã scope và gap. Repo hiện có foundation service/type, nhưng UI chưa đủ luồng hoàn chỉnh. | Cần gắn tài liệu, screenshots, API samples, lint/build/test logs vào HN-FE-006/WWHN-242. |
| UI đáp ứng quy tắc nghiệp vụ, field specification và responsive; xử lý loading, empty, error, success, disabled và confirm khi phù hợp. | Partial. List/snapshot có loading; chưa có empty/error/success/confirm/action disabled đầy đủ; labels còn mojibake. | Cần implement/capture create/count/variance/apply/reversal và state matrix. |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu hoặc quy tắc trái contract. | Route permission có `stocktake.count` và `inventory.reversal.post`; action permission `stocktake.apply` chưa có. API errors đang bị catch thành empty ở page. | Cần role evidence: NV đếm, QL apply, QL reversal, no permission và data scope. |
| Tích hợp đúng endpoint/payload đã duyệt; lint, build và test phù hợp phải pass. | Services đã có endpoint/payload cho count/apply/reversal create, nhưng canonical path và missing lookup/create session cần BE lock. | Cần BE sample/OpenAPI, targeted service/page tests, `npm run lint`, `npm run test -- --run`, `npm run build`. |
| BA/QA có evidence để kiểm tra; không còn P0/P1 blocker chưa có disposition. | Chưa đủ để final sign-off; blocker table bên dưới đã nêu owner/disposition. | Cần đóng P1 hoặc có ETA chính thức trước nghiệm thu. |

## 13. Blocker, rủi ro và disposition

| ID | Mức | Nội dung | Owner | Disposition cần có |
| --- | --- | --- | --- | --- |
| WWHN-242-BE-01 | P1 | Chưa khóa canonical endpoint cho stocktake: `/stocktake/sessions` trong FE vs `/stocktake-sessions` trong wireframe; counts/variances/apply-adjustment path cũng cần xác nhận. | BE1/BE2 + BA/BAS | Cung cấp OpenAPI/sample hoặc xác nhận constants hiện tại; FE cập nhật endpoint nếu khác. |
| WWHN-242-BE-02 | P1 | Chưa thấy contract create stocktake session trong FE: payload scope/warehouse/SKU group, snapshot behavior, duplicate/open-session validation. | BE1/BE2 + BA/BAS | Cung cấp endpoint/payload/error codes; FE thêm service + modal create. |
| WWHN-242-BE-03 | P1 | Variance contract hiện thiếu `net_movement_after_snapshot_to_count_cutoff`, movement warning detail, cutoff/version nếu baseline yêu cầu. | BE1/BE2 + BA/BAS | Bổ sung fields/sample; nếu BE tính canonical variance, FE chỉ render và không tự tính. |
| WWHN-242-FE-01 | P1 | `StocktakePage.tsx` chưa wire count entry, variance review, apply adjustment confirm dù service đã có. | FE1 | Implement detail/count/variance/apply flow hoặc tạo disposition rõ nếu tách ticket khác. |
| WWHN-242-FE-02 | P1 | `ReversalPage.tsx` chưa có movement lookup, dependency guard, form create reversal, detail trace chain. | FE1 + BE | Implement khi HN-REV-001 cung cấp endpoint lookup; nếu chưa có BE, ghi blocker external. |
| WWHN-242-RBAC-01 | P1 | Permission split chưa rõ: route có `stocktake.count`, wireframe yêu cầu `stocktake.apply`; create/manage session cũng chưa có catalog. | BE/RBAC owner + BA | Chốt permission catalog và role matrix NV đếm/QL apply/QL reversal; FE thêm action guard. |
| WWHN-242-FE-03 | P1 | Pages đang catch API error thành dữ liệu rỗng và chưa hiển thị request_id/inline error. | FE1 | Dùng shared `ApiErrorAlert`/empty/retry/no-permission pattern; không nuốt lỗi thành empty. |
| WWHN-242-FE-04 | P2 | Label tiếng Việt trong `StocktakePage.tsx`, `ReversalPage.tsx`, `endpoints.ts` comments đang mojibake, ảnh hưởng evidence UI. | FE1 | Sửa encoding/label trước khi chụp evidence và bàn giao BA/QA. |
| WWHN-242-BE-04 | P1 | Apply adjustment/create reversal cần xác nhận `If-Match`/version ngoài `Idempotency-Key`; hiện service mới gửi idempotency. | BE1/BE2 | Chốt precondition/version behavior; FE thêm header và stale handling nếu contract yêu cầu. |
| WWHN-242-QA-01 | P1 | Chưa có evidence responsive/RBAC/API states gắn WWHN-242/HN-FE-006. | QA + FE1 | Capture đủ desktop/tablet/mobile, role accounts, API logs, command logs và blocker disposition. |

## 14. Checklist triển khai FE1

| Nhóm | Checklist |
| --- | --- |
| Contract | Khóa HN-STK-001/002/003 và HN-REV-001: endpoints, params, response fields, error codes, permission, idempotency, version, sample data. |
| Routing/RBAC | Xác nhận permission `stocktake.count`, `stocktake.apply`, create/manage session, `inventory.reversal.post`; thêm action guards. |
| Types/service | Bổ sung create session, movement warning, variance formula fields, reversible movement lookup, version/If-Match nếu cần. |
| Stocktake list | Search/filter scope/status, progress, variance count, movement warning, owner, action theo status. |
| Create session | Modal/form scope + validation + snapshot warning + success/error states. |
| Count detail | Fetch counts, nhập actual_qty/note, save row/batch, re-count/verify state. |
| Variance review | Fetch variances, hiển thị snapshot/net movement/expected/actual/variance, movement warning và disposition. |
| Apply adjustment | Confirm stock effect, idempotency key, disabled/loading, partial fail, refresh state. |
| Reversal lookup | Search/filter movement/chứng từ có thể đảo, original/reversed/reversible/dependency guard. |
| Create reversal | Form reason/lines, qty validation, append-only confirm, idempotency/version, result detail. |
| UI states | Loading, empty, error + request_id, retry, success, disabled, no permission, confirm. |
| Encoding/UI copy | Sửa mojibake tiếng Việt trước evidence; wording nghiệp vụ giữ đúng BA. |
| Responsive | Evidence 390x844, 768x1024, 1366/1440 cho list/detail/forms/confirm. |
| Test/build | Targeted tests cho service mapper, page states, permission gates; `npm run lint`, `npm run test -- --run`, `npm run build`. |
| Evidence | Screenshot states, request/response sample, role/account, viewport, command log, blocker owner/ETA. |
| Traceability | Ghi rõ WWHN-242, WWHN-62, HN-STK-001/002/003, HN-REV-001, HN-FE-006, HN-EPIC-07 trong PR/evidence. |

## 15. Definition of Done đánh giá

| DoD từ Jira | Điều kiện đóng | Trạng thái hiện tại |
| --- | --- | --- |
| Code, review, lint/build/test, evidence UI và traceability hoàn tất. | Có code hoàn chỉnh cho session/create/count/variance/apply/reversal, review/PR, command pass, screenshot/log. | Chưa đủ để sign-off; tài liệu phân rã đã hoàn tất, implementation UI còn thiếu nhiều action end-to-end. |
| Contract mismatch đã được xử lý hoặc có disposition; tài liệu component/build được cập nhật khi cần. | Mọi thiếu endpoint/field/permission/version có owner BA/BE/DevOps và ETA. | Có blocker disposition trong mục 13; cần confirm từ BA/BE. |
| BA/QA có thể kiểm tra theo Acceptance Criteria; không còn blocker chưa có owner và ETA. | Checklist BA/QA rõ, evidence gắn HN-FE-006/WWHN-242. | Chưa có evidence UI mới; cần capture sau implementation và sửa mojibake. |

## 16. Output bàn giao

Output Jira yêu cầu: **kiểm kê FE**.

Output trong repo:

- `docs/Task_docs_Jira/[FE1] Triển khai luồng hoàn chỉnh kiểm kê.md`

Output cần gắn vào HN-FE-006/WWHN-242 khi đóng task:

- Tài liệu này.
- Contract HN-STK-001/002/003 và HN-REV-001 hoặc link OpenAPI/sample payload đã duyệt.
- Screenshot/video stocktake list, create session, count entry, variance review, apply confirm/success/partial fail.
- Screenshot/video reversal lookup, dependency guard, create reversal, trace chain.
- Evidence responsive 390x844, 768x1024, 1366/1440.
- Evidence RBAC: NV đếm, QL apply, QL reversal, no permission/out-of-scope.
- Log lint/build/test và disposition cho mọi P0/P1 blocker.
