# WWHN-211 - [FE1] Triển khai danh sách/chi tiết/trace tồn kho

## 1. Thông tin Jira và traceability

| Trường | Giá trị |
| --- | --- |
| Jira task | WWHN-211 |
| Link nguồn | https://tan0110.atlassian.net/browse/WWHN-211 |
| Tiêu đề | [FE1] Triển khai danh sách/chi tiết/trace tồn kho |
| Issue type | Subtask |
| Trạng thái khi đọc | To Do |
| Priority | Medium |
| Assignee | Quang Nguyễn Thanh |
| Reporter | Wuangg |
| Created | 2026-07-19 21:28:24 +0700 |
| Updated trên Jira | 2026-07-28 15:16:30 +0700 |
| Task cha | WWHN-51 - [FE][INVENTORY] UI số dư, movement và traceability |
| Dependency | HN-INV-001 |
| Parent Temp Key | HN-FE-005 |
| Epic Temp Key | HN-EPIC-07 |
| Role | FE1 |
| Assignee Placeholder | HN-FE-01 |
| Output đầu ra | tồn kho FE |
| Ngày cập nhật tài liệu | 2026-08-01 ICT |

Tài liệu này là artifact phân rã và bàn giao cho WWHN-211. Jira mô tả mục tiêu rất ngắn: "Triển khai danh sách/chi tiết/trace tồn kho", nhưng Acceptance Criteria yêu cầu FE1 phải đi hết bề mặt nghiệp vụ tồn kho: danh sách số dư, chi tiết SKU/lô/kho, lịch sử movement, trace nguồn chứng từ, responsive, RBAC, API error states, evidence và disposition cho mọi mismatch contract.

## 2. Diễn giải sâu mục tiêu

WWHN-211 cần được hiểu là hoàn thiện frontend read surface cho tồn kho. Đây không phải màn dashboard tổng hợp đơn giản, mà là nơi người vận hành kiểm tra số dư khả dụng, đối chiếu số lượng, lần theo movement phát sinh và truy vết chứng từ gốc khi có sai lệch. FE chỉ được hiển thị dữ liệu đã được backend xác nhận; backend vẫn là authority cho số dư, movement, transaction, idempotency, RBAC, data scope và audit.

| Lớp mục tiêu | FE1 phải đạt | Không được làm |
| --- | --- | --- |
| Danh sách tồn kho | Hiển thị số dư theo SKU/kho/lô hoặc scope đã duyệt; có search/filter/sort/pagination, trạng thái đối soát, thời điểm cập nhật và action mở chi tiết/trace. | Không hard-code số dư, không tự suy diễn tồn khả dụng nếu BE không trả, không biến API error thành dữ liệu rỗng. |
| Chi tiết tồn kho | Cho một balance/SKU, hiển thị identity, warehouse/scope, available/reserved/in-transit/on-hand nếu có, serial/box/lot/location hint và reconciliation note. | Không lộ dữ liệu ngoài data scope; không coi vị trí gợi ý/khay là bucket tồn riêng nếu baseline không nói vậy. |
| Movement history | Hiển thị timeline movement đã POSTED/ADJUSTED/REVERSED theo chứng từ, SKU, quantity change, actor, timestamp và chain/reference. | Không sửa/xóa movement gốc; không tạo movement từ FE; không tính lại lịch sử thay BE. |
| Traceability | Từ balance hoặc movement mở được trace chain đến chứng từ nguồn: inbound/outbound/stocktake/reversal/scan nếu contract hỗ trợ. | Không tự dựng chain bằng string nếu thiếu endpoint; mismatch nguồn phải raise cho BA/BE. |
| UI states | Loading, empty, error, success, disabled, confirm khi phù hợp; request_id hiển thị cho API error. | Không dùng empty state để che 403/500; không cho action có vẻ chạy được khi thiếu quyền/contract. |
| RBAC/data scope | Route/action guard theo `inventory.view` và `inventory.trace` nếu trace cần quyền riêng; backend vẫn enforce dữ liệu. | Không dùng ẩn nút như bảo mật cuối cùng; không fetch dữ liệu trace nếu user không có quyền. |
| Evidence | Screenshot desktop/tablet/mobile, role/RBAC, API error, empty, trace detail, lint/build/test log. | Không sign-off khi còn P0/P1 blocker FE1 chưa có owner/ETA. |

## 3. Input đầu vào từ Jira và cách sử dụng

| Input từ Jira | Ý nghĩa | Cách FE1 sử dụng |
| --- | --- | --- |
| Task cha WWHN-51 | Nguồn scope trực tiếp cho UI số dư, movement và traceability. | Mọi phần list/detail/trace phải trace về WWHN-51/HN-FE-005; không tách riêng thành báo cáo XNT hoặc stocktake. |
| Dependency HN-INV-001 | Baseline nghiệp vụ/API/UI cho inventory read surface. | Dùng để khóa field, endpoint, filter, permission, error code, sample data và Acceptance Criteria. |
| Baseline nghiệp vụ | Quy định số dư nào là canonical, movement nào ảnh hưởng tồn, cách đọc location hint/serial/box/lot. | FE render theo field BE trả, chỉ format/normalize alias khi đã được duyệt; không tự tính số dư làm nguồn đúng. |
| API/UI specification | Endpoint, payload/params, response shape, validation, error code và UI state. | Cập nhật service/type/page theo contract; mismatch phải comment blocker cho BE1/BE2/BA. |
| Dữ liệu mẫu và evidence | Bộ case QA cho tồn bình thường, tồn âm/cảnh báo, không có dữ liệu, 403, lỗi API, movement có trace chain. | Capture evidence cùng sample request/response hoặc mock contract chính thức nếu BE chưa sẵn sàng. |

## 4. Vai trò và phối hợp

| Bên | Trách nhiệm | Điểm phối hợp bắt buộc |
| --- | --- | --- |
| FE1 - Quang Nguyễn Thanh | Chủ trì UI inventory list/detail/trace, service/type wiring, responsive, UI states, RBAC UX, evidence và tài liệu bàn giao. | Chỉ triển khai frontend; không tự chốt business rule về số dư, movement net, trace source hoặc quyền dữ liệu. |
| BA/BAS | Cung cấp baseline nghiệp vụ, UI/UX, field specification, Acceptance Criteria và open point đã xử lý. | Chốt cột danh sách, layout detail, trace chain cần hiển thị, wording cảnh báo và trường nào cần formal sign-off. |
| BE1/BE2 | Cung cấp endpoint, params, payload, validation, error code, permission, sample data và contract trace-source. | Xác nhận `/inventory/balances`, `/stock-movements`, `/stock-movements/:id`, `/stock-movements/:id/trace-source`, field aliases và request_id. |
| DevOps | Cấu hình build/environment nếu API base, auth, proxy, CORS hoặc UAT data ảnh hưởng evidence. | Xác nhận env dùng để capture screenshot/API log và health/build. |
| BA/QA | Nghiệm thu theo AC, responsive, RBAC, UI states và evidence. | Test đủ list/detail/trace, filter, no permission, out-of-scope, API error và mobile/tablet/desktop. |

## 5. Baseline nghiệp vụ đã đọc

| Nguồn | Baseline rút ra | Tác động FE |
| --- | --- | --- |
| WWHN-211 Description | Output "tồn kho FE" phải được rà soát/xác minh, tích hợp đúng endpoint/payload, không còn blocker FE1. | Tài liệu phải nêu rõ trạng thái hiện tại, gap, blocker, owner và checklist evidence trước sign-off. |
| Architecture guide | Module `inventory` quản lý inventory balances và movements; route inventory yêu cầu `inventory.view`; scan có `inventory.trace`. | Giữ boundary module inventory; trace action có thể cần action guard `inventory.trace` nếu BA/BE xác nhận. |
| Endpoint constants | Có `INVENTORY_BALANCES`, `STOCK_MOVEMENTS`, `STOCK_MOVEMENT`, `STOCK_MOVEMENT_TRACE_SOURCE`, `SAFE_STOCK_ALERTS`, `SAFE_STOCK_CONFIGS`. | Foundation service đã có; page cần wire detail/trace và error states sâu hơn. |
| Inventory service | `fetchInventoryBalances()`, `fetchStockMovements()`, `fetchStockMovement()`, `traceStockMovementSource()` dùng shared `http` và normalize nhiều alias field. | Không mock data; cần bổ sung type chi tiết/trace rõ hơn và dùng API error handling thay vì catch thành `[]`. |
| Inventory page | Có hai tab: tồn hiện tại và lịch sử dịch chuyển; có search/filter cơ bản, table, action icon chi tiết/trace. | UI mới dừng ở list. Chưa có drawer/detail, trace chain, empty/error/success/no-permission states đầy đủ; nhiều label đang mojibake. |
| HTTP/error guide | API envelope có `success`, `message`, `error_code`, `errors`, `meta.request_id`; 403/422/409/500 cần hiển thị đúng. | Inventory page phải dùng shared error utilities hoặc `ApiErrorAlert`; không nuốt lỗi thành bảng trống. |

## 6. Đối chiếu repo hiện tại

| Surface | File/nguồn | Đã có | Khoảng trống với WWHN-211 |
| --- | --- | --- | --- |
| Route/RBAC | `src/app/router/access.ts` | `ROUTES.INVENTORY` yêu cầu `inventory.view`; `ROUTES.SCAN` có `inventory.trace` hoặc `scan.classify`. | Chưa có action guard riêng cho trace trong InventoryPage; chưa có no-permission state ở cấp action/detail nếu trace bị 403. |
| Endpoint constants | `src/shared/api/endpoints.ts` | `/inventory/balances`, `/stock-movements`, `/stock-movements/:id`, `/stock-movements/:id/trace-source`. | Cần BE xác nhận canonical params cho warehouse/product/lot/date/status và shape trace-source. |
| Inventory service | `src/modules/inventory/services/inventoryService.ts` | Có filters, row types, normalizer alias, fetch balance list, fetch movement list/detail, trace source, safe stock APIs. | Types list còn mỏng: thiếu on_hand/reserved/in_transit/uom/warehouse/lot/data_as_of; trace source vẫn `RawRecord`, chưa typed. |
| Inventory page | `src/modules/inventory/pages/InventoryPage.tsx` | Có tab "Tồn kho hiện tại" và "Lịch sử dịch chuyển", table loading, search, filter movement type, action icons. | Chưa có detail drawer/modal, trace drawer, movement detail, retry/error alert/request_id, empty state rõ, pagination server-side, responsive toolbar, disabled/action guard, success state. |
| Shared components | `src/shared/components/feedback`, `src/shared/components/data-display`, `src/shared/components/permission` | Có `ApiErrorAlert`, `NoPermissionState`, table/state/pagination/permission patterns. | Inventory page đang dùng AntD raw table và local state; chưa tận dụng pattern để thống nhất evidence. |
| Reports relation | `src/modules/reports/services/reportsService.ts` | XNT report dùng `/reports/inventory-xnt` và export. | WWHN-211 không thay thế report XNT; inventory page cần trace operational detail, report là surface đối soát/tổng hợp. |
| Encoding | `InventoryPage.tsx`, comments docs cũ | Một số file docs hiển thị đúng; inventory page có label bị mojibake. | Trước khi capture evidence UI, cần sửa encoding/copy để BA/QA không nghiệm thu ảnh lỗi chữ. |

Kết luận đối chiếu: FE foundation cho API thật đã tồn tại, nhưng WWHN-211 chưa đạt mức "danh sách/chi tiết/trace" hoàn chỉnh. Hiện tại mới đủ list sơ bộ; phần chi tiết tồn, trace movement/source, xử lý lỗi và evidence còn là gap trực tiếp của FE1.

## 7. Danh sách tồn kho cần triển khai

Danh sách tồn kho là màn entry point cho QL kho/NV kho tra cứu số dư. Mỗi row cần đủ thông tin để biết SKU nào đang có hàng, hàng nằm trong scope nào, trạng thái đối soát ra sao và có thể drill-down vào chi tiết hay trace.

| Field/UI | Expected |
| --- | --- |
| SKU identity | SKU/model, tên hàng, loại/category, UOM nếu BE trả. |
| Scope tồn | Warehouse, lot/batch, location hint, data scope hiện tại; nếu chỉ system scope thì ghi rõ. |
| Số lượng | `available_qty`, `on_hand_qty`, `reserved_qty`, `in_transit_qty`, serial qty, box qty nếu contract trả. |
| Reconcile | PASS/WARNING/FAIL hoặc enum canonical; màu và tooltip giải thích. |
| Timestamp | `updated_at`, `last_movement_at`, `data_as_of` hoặc `last_inventory_sync_at` để biết độ mới dữ liệu. |
| Filter/search | Search SKU/tên/chứng từ nếu được duyệt; filter warehouse, product/category, lot, status, reconcile. |
| Sort/pagination | Server-side page/limit/sort khi dataset lớn; giữ filter khi retry. |
| Action | Chi tiết balance, truy vết movement/source, mở XNT liên quan nếu scope cho phép. |

State bắt buộc: loading không làm nhảy layout; empty phân biệt "không có dữ liệu" và "filter không match"; error có retry/request_id; 403 hiển thị no permission; filter invalid phải disabled action/export nếu có.

## 8. Chi tiết tồn kho cần triển khai

Chi tiết tồn kho cần trả lời câu hỏi "số dư này là gì, thuộc scope nào, vì sao đang ở trạng thái này và movement gần nhất nào tạo ra nó". Khuyến nghị dùng drawer hoặc route detail để không mất context list.

| Nhóm | Expected |
| --- | --- |
| Header detail | SKU, tên hàng, warehouse/scope, status, last updated/data_as_of, reconcile tag. |
| Balance summary | Available, on hand, reserved, in transit, blocked/hold nếu BE trả; format số theo UOM. |
| Physical hints | Serial qty, box qty, lot/batch, location hint/tray/kệ nếu chỉ là gợi ý tìm hàng. |
| Recent movements | 5-10 movement gần nhất liên quan balance/SKU; mở được movement detail. |
| Reconcile note | Lý do WARNING/FAIL, request_id hoặc snapshot nếu BE trả. |
| Audit metadata | created_at/updated_at, last_movement_id, actor cuối nếu contract có. |

Điểm kiểm soát quan trọng: "Vị trí gợi ý/khay" chỉ hỗ trợ tìm hàng, không tạo bucket tồn riêng nếu HN-INV-001 không định nghĩa bucket. FE phải tránh wording làm người dùng hiểu rằng tồn được tính theo khay độc lập.

## 9. Movement history cần triển khai

Movement history là lớp audit nghiệp vụ. Danh sách movement phải đủ để đối chiếu biến động tồn theo thời gian, đặc biệt khi QA truy một số dư nghi ngờ.

| Field/UI | Expected |
| --- | --- |
| Movement ID | `movement_no/code/id`, link mở detail. |
| Timestamp | `occurred_at/performed_at/created_at`, timezone thống nhất Asia/Ho_Chi_Minh. |
| Movement type | RECEIPT/ISSUE/TRANSFER/ADJUST/STOCKTAKE/REVERSAL hoặc enum BE. |
| SKU/scope | SKU, warehouse, lot/location nếu contract trả. |
| Quantity change | +/- rõ màu, không làm tròn sai precision UOM. |
| Source document | inbound/outbound/stocktake/reversal/document code, source type. |
| Actor | Người thao tác/post, system actor nếu tự động. |
| Chain/reference | Original/reversal/adjustment chain; trace action mở nguồn. |

Filter cần tối thiểu: search movement/chứng từ/SKU, movement type, date range, warehouse, product/lot nếu BE hỗ trợ. Date range phải validate `from <= to`; khi invalid, disable search/export action liên quan.

## 10. Traceability cần triển khai

Traceability là phần cốt lõi của task. User phải lần được một movement hoặc balance về nguồn phát sinh, bao gồm chứng từ nhập/xuất, scan event, stocktake adjustment, reversal hoặc tài liệu liên quan nếu có.

| Trace surface | Expected |
| --- | --- |
| Balance -> Movement | Từ balance mở danh sách movement liên quan theo SKU/scope/date; không tự ghép local nếu BE chưa trả quan hệ. |
| Movement -> Source | Gọi `traceStockMovementSource(id)` hoặc endpoint canonical để hiển thị chứng từ nguồn. |
| Source summary | Source type, source code, status, posted_at, actor, related lines, request_id/audit key nếu có. |
| Chain timeline | Original movement, adjustment/reversal liên quan, current effect và links xem chi tiết. |
| Permission | Trace action có thể cần `inventory.trace`; nếu user chỉ có `inventory.view`, hiển thị disabled/no permission theo contract. |
| Error | 404 source missing, 403 no permission, 409/412 stale chain, 500 server error có retry/request_id. |

Nếu HN-INV-001 chưa khóa shape của `/stock-movements/:id/trace-source`, FE phải giữ `traceStockMovementSource()` ở dạng read-only raw/debug hoặc đánh blocker contract, không tự quy đổi source bằng heuristics từ `document_code`.

## 11. API, params, error và RBAC cần khóa

| Nhóm contract | Cần BE/BA xác nhận | Gợi ý FE type/service |
| --- | --- | --- |
| Inventory balance list | Canonical params `page`, `limit`, `warehouse_id`, `product_id`, `lot_no`, `status`, `search`, sort; fields available/on_hand/reserved/in_transit/uom/warehouse/data_as_of. | Mở rộng `InventoryBalanceFilters`, `InventoryBalanceRow`, normalizer alias có test. |
| Balance detail | Endpoint detail theo balance/SKU/warehouse/lot hay dùng list + movement relation. | `fetchInventoryBalance(id)` hoặc `fetchInventoryBalanceDetail(params)` nếu BE có. |
| Movement list | Params date range, movement_type, warehouse/product/lot/document_type/document_code, pagination meta. | `StockMovementFilters` đã có nền; cần server pagination và typed meta nếu UI cần. |
| Movement detail | Response fields source, actor, before/after balance, request_id, posted status. | Mở rộng `StockMovementRow` hoặc `StockMovementDetail`. |
| Trace source | Shape trace-source: source document, lines, scan events, reversal/stocktake relation, audit timeline. | `StockMovementTraceSource` typed thay vì `RawRecord`. |
| Safe stock | Alert/config scope có thuộc WWHN-211 hay task riêng. | Nếu thuộc scope, thêm tab/section safe-stock; nếu không, giữ service không expose UI. |
| Error code | 403, 404, 409, 412, 422, 428, 500 và `meta.request_id`. | Reuse `ApiErrorAlert`, field error extraction, retry. |
| RBAC | `inventory.view` cho route; `inventory.trace` cho trace hay không; data scope warehouse/branch. | Route/action guard qua permission helpers; no permission state không lộ dữ liệu. |

## 12. UI states bắt buộc

| State | Expected |
| --- | --- |
| Loading | Table spinner/skeleton cho list; drawer skeleton cho detail/trace; giữ chiều cao tránh layout shift. |
| Empty | Không có balance/movement theo filter khác với lỗi API; có clear filter hoặc CTA phù hợp nếu đủ quyền. |
| Error | Alert có message, error_code/request_id nếu có, retry; không catch lỗi thành `[]`. |
| Success | Với read-only surface, success chủ yếu là refresh/trace loaded; nếu có export/config thì toast/banner rõ. |
| Disabled | Disable search khi filter invalid; disable trace khi thiếu quyền, thiếu movement id hoặc đang loading. |
| Confirm | Không bắt buộc cho read-only detail/trace; chỉ cần confirm nếu scope mở action ảnh hưởng dữ liệu như safe-stock config/export nhạy cảm. |
| No permission | 403 route/action hiển thị `NoPermissionState`; không hiển thị data ngoài scope. |

## 13. Responsive và UX evidence

| Viewport | Kỳ vọng |
| --- | --- |
| 390x844 mobile | Toolbar filter wrap hoặc chuyển drawer; table có horizontal scroll kiểm soát; detail/trace drawer không che nút đóng; số lượng không tràn. |
| 768x1024 tablet | List và filter ổn định; detail summary + movement recent chia nhóm rõ; tab không đè nội dung. |
| 1366/1440 desktop | Table đủ cột nghiệp vụ; drawer/detail đủ rộng cho summary, timeline và source chain; action icon có tooltip. |

Evidence tối thiểu cần capture: inventory list normal, list empty, API error/request_id, balance detail, movement history filter, movement detail, trace source chain, no permission, mobile/tablet/desktop.

## 14. Acceptance Criteria mapping

| Acceptance Criteria từ Jira | Đánh giá FE1 | Evidence/cần bổ sung |
| --- | --- | --- |
| Output "tồn kho FE" được rà soát/xác minh, gắn evidence vào HN-FE-005 và không còn blocker FE1. | Tài liệu này phân rã scope và gap. Repo hiện có foundation API thật nhưng UI chưa đủ chi tiết/trace. | Gắn tài liệu, screenshots, API samples, lint/build/test logs vào HN-FE-005/WWHN-211. |
| UI đáp ứng quy tắc nghiệp vụ, field specification và responsive; xử lý loading, empty, error, success, disabled và confirm khi phù hợp. | Partial. Loading có; list có search/filter cơ bản; chưa có detail/trace state sâu, empty/error/success/no-permission đầy đủ. | Cần implement/capture list/detail/trace và state matrix. |
| Permission/RBAC và API error hiển thị đúng; không hard-code dữ liệu hoặc quy tắc trái contract. | Route `inventory.view` đã có; API thật qua service; page đang catch error thành `[]`, chưa hiển thị request_id; trace permission chưa rõ. | Cần role evidence cho `inventory.view`, `inventory.trace` nếu áp dụng, 403/out-of-scope và API error. |
| Tích hợp đúng endpoint/payload đã duyệt; lint, build và test phù hợp phải pass. | Constants/service đã có endpoint chính; trace-source có service nhưng chưa typed/UI; canonical params/shape cần HN-INV-001 xác nhận. | Cần BE sample/OpenAPI, service mapper tests, page state tests, `yarn lint`, `yarn test --run`, `yarn build`. |
| BA/QA có evidence để kiểm tra; không còn P0/P1 blocker chưa có disposition. | Chưa đủ final sign-off; blocker table bên dưới đã nêu owner/disposition. | Cần đóng P1 hoặc có ETA chính thức trước nghiệm thu. |

## 15. Blocker, rủi ro và disposition

| ID | Mức | Nội dung | Owner | Disposition cần có |
| --- | --- | --- | --- | --- |
| WWHN-211-BE-01 | P1 | Cần xác nhận HN-INV-001 cho response balance: available/on_hand/reserved/in_transit/uom/warehouse/lot/data_as_of và reconcile enum. | BE1/BE2 + BA/BAS | Cung cấp OpenAPI/sample; FE cập nhật type/columns theo contract. |
| WWHN-211-BE-02 | P1 | Shape `/stock-movements/:id/trace-source` chưa được typed trong FE; chưa rõ source document/timeline/line fields. | BE1/BE2 | Cung cấp sample trace-source cho inbound/outbound/stocktake/reversal; FE thêm `StockMovementTraceSource`. |
| WWHN-211-RBAC-01 | P1 | Chưa rõ trace action dùng `inventory.view` hay cần `inventory.trace`; route scan có `inventory.trace` nhưng inventory route chỉ có `inventory.view`. | BA/BAS + RBAC owner | Chốt permission catalog và data-scope behavior; FE thêm action guard/no-permission evidence. |
| WWHN-211-FE-01 | P1 | `InventoryPage.tsx` chưa có balance detail drawer/modal và movement detail drawer. | FE1 | Implement detail surfaces hoặc ghi disposition nếu tách ticket. |
| WWHN-211-FE-02 | P1 | Trace action icon hiện chưa gọi `traceStockMovementSource()` và chưa có trace chain UI. | FE1 | Wire trace drawer, loading/error/empty states, typed response khi contract khóa. |
| WWHN-211-FE-03 | P1 | Page đang catch API error thành dữ liệu rỗng, không hiển thị `ApiErrorAlert`/request_id/retry. | FE1 | Refactor state/error handling, phân biệt empty với error. |
| WWHN-211-FE-04 | P2 | Label tiếng Việt trong `InventoryPage.tsx` đang mojibake, ảnh hưởng evidence UI. | FE1 | Sửa encoding/copy trước khi capture evidence. |
| WWHN-211-QA-01 | P1 | Chưa có evidence responsive/RBAC/API states gắn HN-FE-005/WWHN-211. | QA + FE1 | Capture đủ viewport, role account, API logs, command logs và blocker disposition. |

## 16. Checklist triển khai FE1

| Nhóm | Checklist |
| --- | --- |
| Contract | Khóa HN-INV-001: endpoints, params, response fields, error codes, permission, sample data và trace-source shape. |
| Types/service | Mở rộng balance detail, movement detail, trace-source types; thêm mapper tests cho alias field quan trọng. |
| Inventory list | Search/filter/sort/pagination, columns nghiệp vụ, reconcile tag, updated/data_as_of, row action. |
| Balance detail | Drawer/route detail gồm summary, physical hints, recent movements, reconcile note, audit metadata. |
| Movement history | Filters date/type/SKU/document/warehouse, movement detail, before/after nếu BE trả. |
| Trace chain | Gọi trace-source endpoint, hiển thị source summary, related lines, timeline, reversal/stocktake relation. |
| RBAC | Route `inventory.view`, action `inventory.trace` nếu được duyệt, no-permission state và out-of-scope evidence. |
| UI states | Loading, empty, error + request_id, retry, disabled, success/loaded, no permission. |
| Encoding/UI copy | Sửa mojibake tiếng Việt trước evidence; giữ technical terms API/endpoint/payload/field/enum/RBAC. |
| Responsive | Evidence 390x844, 768x1024, 1366/1440 cho list/detail/trace. |
| Test/build | Targeted tests cho service mapper/page states/permission gates; `yarn lint`, `yarn test --run`, `yarn build`. |
| Evidence | Screenshot states, request/response sample, role/account, viewport, command log, blocker owner/ETA. |
| Traceability | Ghi rõ WWHN-211, WWHN-51, HN-INV-001, HN-FE-005, HN-EPIC-07 trong PR/evidence. |

## 17. Definition of Done đánh giá

| DoD từ Jira | Điều kiện đóng | Trạng thái hiện tại |
| --- | --- | --- |
| Code, review, lint/build/test, evidence UI và traceability hoàn tất. | Có code hoàn chỉnh cho list/detail/movement/trace, review/PR, command pass, screenshot/log. | Chưa đủ để sign-off; tài liệu phân rã đã hoàn tất, implementation UI còn thiếu detail/trace/error states. |
| Contract mismatch đã được xử lý hoặc có disposition; tài liệu component/build được cập nhật khi cần. | Mọi thiếu endpoint/field/permission có owner BA/BE/DevOps và ETA. | Có blocker disposition trong mục 15; cần confirm từ BA/BE. |
| BA/QA có thể kiểm tra theo Acceptance Criteria; không còn blocker chưa có owner và ETA. | Checklist BA/QA rõ, evidence gắn HN-FE-005/WWHN-211. | Chưa có evidence UI mới; cần capture sau implementation và sửa mojibake. |

## 18. Output bàn giao

Output Jira yêu cầu: **tồn kho FE**.

Output trong repo:

- `docs/Task_docs_Jira/[FE1] Triển khai danh sách_chi tiết_trace tồn kho.md`

Output cần gắn vào HN-FE-005/WWHN-211 khi đóng task:

- Tài liệu này.
- Contract HN-INV-001 hoặc link OpenAPI/sample payload đã duyệt.
- Screenshot/video inventory list, balance detail, movement history, movement detail, trace source chain.
- Evidence responsive 390x844, 768x1024, 1366/1440.
- Evidence RBAC: user có `inventory.view`, user có/không có `inventory.trace` nếu áp dụng, no permission/out-of-scope.
- Evidence API error: 403, 404 trace source, 422 filter invalid nếu có, 500/retry với request_id.
- Log lint/build/test và disposition cho mọi P0/P1 blocker.

Trạng thái đề xuất: **Ready for contract lock and implementation, not ready for production sign-off yet**. FE1 có thể triển khai phần UI list/detail/trace ngay trên foundation service hiện có, nhưng sign-off cần HN-INV-001 khóa field/permission/trace-source và cần evidence BA/QA đầy đủ.
