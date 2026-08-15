# WWHN-211 — FE1 Triển khai danh sách/chi tiết/trace tồn kho

## 1. Trạng thái tổng quan

| Trường | Giá trị |
| --- | --- |
| Task | `WWHN-211` |
| Parent Temp Key | `HN-FE-005` (task cha `WWHN-51`) |
| Epic Temp Key | `HN-EPIC-07` |
| Dependency | `HN-INV-001` |
| Role | FE1 |
| Branch | `m1` |
| Base commit | `83c94c3e2e09e2b1e193cb51166fe4d0623a0eb0` (uncommitted changes on top — xem mục 4 "File thay đổi") |
| Điểm đánh giá trước | 61/100 — Chưa đạt yêu cầu, 5 blocker mở (DEV211-P0-01, P1-01..04, P2-01) |
| Trạng thái sau vòng khắc phục này | Code + test + evidence FE1 đã hoàn thiện đầy đủ theo AC; 2/5 blocker đóng dứt điểm (P1-01, P1-02), 1/5 đã làm rõ chờ BA (P2-01), 2/5 còn lại ngoài vai trò FE1, chỉ ghi nhận owner/ETA đề xuất (P1-03, P1-04). Blocker kế thừa P0-01 (WWHN-108) không thuộc thẩm quyền đóng của FE1. |

## 2. Đã hoàn thành (không đổi so với bản rà soát trước)

### 2.1 Danh sách tồn kho (INV-01)

`src/modules/inventory/pages/InventoryPage.tsx`:

- Tab "Tồn kho hiện tại": bảng balance với SKU, tên hàng, kho, lô, Available/On-hand/Reserved/In-transit, Item/Box subledger, vị trí gợi ý, trạng thái đối soát (MATCH/MISMATCH), cập nhật gần nhất.
- Search debounce 250ms, filter theo trạng thái tồn (normal/low_stock/overflow), phân trang qua `resolveApiPagination` + `MvpPageSizeSelector`.
- Tab "Lịch sử dịch chuyển": bảng movement với mã dịch chuyển, thời gian, loại (RECEIPT/ISSUE/COMPONENT_ISSUE/REVERSAL), SKU, kho, số lượng thay đổi (màu theo dấu), nguồn chứng từ, người thao tác, nút Trace.
- Xử lý loading (`isLoading || isFetching`), error (`ApiErrorAlert` + retry), empty state riêng cho từng bảng.
- Đồng bộ qua query param `?screen=TRACE-01&id=...` để mở modal trace trực tiếp từ nơi khác (điều hướng liên module).
- RBAC: nút Trace và "Truy vết mã" chỉ hiện/enable khi có quyền `inventory.trace` (`useCanAny`), tooltip giải thích lý do disable khi thiếu quyền.

### 2.2 Chi tiết tồn kho — `BalanceDetailModal`

`src/modules/inventory/components/BalanceDetailModal.tsx`:

- Descriptions: SKU, tên hàng, kho, lô, đối soát (kèm ghi chú mismatch), cập nhật, vị trí gợi ý, movement gần nhất.
- Statistic: Available/On-hand/Reserved/In-transit/Blocked-Hold/Serial qty/Box qty.
- Item Subledger + Container Subledger (bảng riêng, gọi `GET /inventory/balances/:id/subledger`), có loading/error/empty riêng.
- Movement liên quan (lấy theo SKU, `per_page=10`), có nút Trace mở thẳng `TraceModal`.

### 2.3 Truy vết — `TraceModal` (TRACE-01)

`src/modules/inventory/components/TraceModal.tsx`:

- Truy vết theo `movementId`: gọi song song `GET /stock-movements/:id`, `GET /stock-movements/:id/trace-source`; hiển thị chi tiết movement, chứng từ nguồn (loại, mã, trạng thái, actor, request_id), dòng chứng từ, Timeline chuỗi trạng thái.
- Tra cứu độc lập theo mã vật lý (barcode/QR/RFID) qua `GET /stock-movements/trace-by-code`: resolve **ITEM/CONTAINER/SKU** riêng biệt (không phải SKU approximation — xác nhận qua test `TraceModal.test.tsx` với 3 kịch bản `resolved_type` khác nhau), hiển thị container items và lịch sử movement liên quan.
- Loading/error/empty đầy đủ cho từng phần (`ApiErrorAlert` + retry, "Backend chưa trả timeline/chain" khi timeline rỗng).

### 2.4 Service & hook layer

- `src/modules/inventory/services/inventoryService.ts`: normalize dữ liệu balance/movement/trace-source/trace-by-code từ nhiều biến thể field BE có thể trả (fallback chain theo từng field — ví dụ `available_qty ?? qty_available ?? available`), tránh hard-code một contract duy nhất.
- `src/modules/inventory/hooks/use-inventory.ts`: React Query hooks cho balances, movements, movement detail, trace-source, subledger, trace-by-code, key theo params để cache đúng.
- Endpoint đã khai báo trong `src/shared/api/endpoints.ts`: `INVENTORY_BALANCES`, `INVENTORY_BALANCE_SUBLEDGER`, `STOCK_MOVEMENTS`, `STOCK_MOVEMENT`, `STOCK_MOVEMENT_TRACE_SOURCE`, `STOCK_MOVEMENT_TRACE_BY_CODE`.

### 2.5 Routing & permission

- Route `ROUTES.INVENTORY` (`/inventory`) lazy-load `InventoryPage`, gate bằng `P.INVENTORY_VIEW` (`inventory.view`) ở `src/app/router/access.ts`.
- Menu điều hướng (`SideNav`/`menu.tsx`) đã có mục tồn kho, mapping `screen = INV-01`.
- Quyền `inventory.trace` dùng để gate hành động Trace ở tầng UI; đúng pattern permission hiện có trong `wms-permissions.ts`.
- **Đã sửa trong vòng khắc phục này**: `InventoryPage.tsx:48` trước đây gọi `useCanAny(["inventory.trace", "INVENTORY_TRACE"])` — chuỗi thứ hai là hằng số bị gõ nhầm thành literal string, không map qua alias nào. Không gây sai chức năng (do `.some()` OR logic và phần tử đầu đã đúng) nhưng là code rác. Đã sửa thành `useCanAny([P.INVENTORY_TRACE])`, import `WMS_PERMISSION_CATALOG as P` từ `wms-permissions.ts`.

## 3. Công việc khắc phục trong vòng review này

### 3.1 Test coverage — 33 unit/component test + 9 E2E test (mới, tất cả PASS)

| File | Số test | Nội dung |
| --- | --- | --- |
| `src/modules/inventory/services/inventoryService.test.ts` | 9 | Normalize field-mapping (contract chính + fallback chain), cả 6 endpoint tồn kho/trace, phân biệt rõ `resolved_type` ITEM/CONTAINER/SKU khi trace theo mã vật lý (không phải SKU approximation), Safe-stock/Scan helper vẫn đúng contract dù chưa dùng UI. |
| `src/modules/inventory/pages/InventoryPage.test.tsx` | 9 | Hiển thị danh sách, chuyển tab, mở BalanceDetailModal, RBAC disable/enable nút Trace, ApiErrorAlert + retry, empty state, filter gọi lại API đúng tham số, deep-link `?screen=TRACE-01&id=...`. |
| `src/modules/inventory/components/BalanceDetailModal.test.tsx` | 6 | Hiển thị chi tiết + subledger + movement liên quan, tham số hook đúng (subledger theo `balance.id`, movement theo SKU), empty state, ApiErrorAlert, RBAC ẩn nút Trace khi không có `onTraceMovement`. |
| `src/modules/inventory/components/TraceModal.test.tsx` | 9 | Hướng dẫn ban đầu, trace theo movementId (chi tiết + chứng từ nguồn + timeline), trace theo mã vật lý (ITEM/CONTAINER/SKU riêng biệt), ApiErrorAlert cho cả 2 luồng, timeline rỗng, disable nút khi input trống, Enter kích hoạt lookup. |
| `e2e/wwhn-211-inventory-list-detail-trace.spec.ts` | 9 | Responsive 3 viewport (1440×900/768×1024/375×812), loading/empty state, lỗi 403 hiển thị đúng no-permission state, mở BalanceDetailModal, luồng trace đầy đủ (tab → Trace → TraceModal), route RBAC redirect `/errors/403`, disable nút Trace khi thiếu `inventory.trace`. Theo đúng pattern evidence của `wwhn-178-master-sku-qa2.spec.ts` (screenshot + metadata JSON gắn `sourceSha`, `videoPolicy`, `tracePolicy` cho từng kịch bản). |

**Ghi chú kỹ thuật quan trọng**: hạ tầng mock `antd` dùng chung cho toàn bộ test suite (`src/test/setup.ts`) trước đây stub `Tabs`/`Descriptions`/`Timeline` bằng `stub` rỗng (chỉ render `children`, không hỗ trợ API `items` mà antd v5 và toàn bộ codebase dùng) và thiếu `HistoryOutlined` trong allowlist icon — khiến **bất kỳ trang nào dùng `Tabs`/`Descriptions`/`Timeline` với prop `items` đều render rỗng trong test, không riêng module inventory** (xác nhận: `MvpPutawayPage.tsx`, `AlignedReportsPage.tsx`, `PhysicalCodesPage.tsx`, `StocktakePage.tsx` cũng dùng `Tabs items=` và trước đây không có test nào). Đã nâng cấp 3 mock này để render đúng cấu trúc DOM tối thiểu (tablist/tabpanel, label/content, timeline items) — thay đổi này mang lại lợi ích cho toàn bộ test suite, không riêng WWHN-211, và đã xác nhận **không gây regression** (xem mục 3.2).

### 3.2 Full verification suite — evidence thật, gắn với SHA thật

Chạy tại `HEAD = 83c94c3e2e09e2b1e193cb51166fe4d0623a0eb0` (working tree có các thay đổi chưa commit liệt kê ở mục 4), lúc `2026-08-15`:

```bash
$ npx tsc -p tsconfig.json --noEmit
# PASS — exit 0, không lỗi

$ npx eslint src/modules/inventory --max-warnings=0
# PASS — exit 0, không lỗi/cảnh báo

$ npx eslint --config eslint.config.js --no-error-on-unmatched-pattern src/
# PASS — exit 0 (toàn repo, bao gồm src/test/setup.ts đã sửa)

$ npx vitest run
# Test Files  3 failed | 55 passed (58)
# Tests  4 failed | 436 passed (440)
# 4 test fail là baseline pre-existing, KHÔNG liên quan tới thay đổi của vòng này:
#   - IamUserScreen.test.tsx > renders backend users and opens create inside IAM-01
#   - MvpMasterScreens.test.tsx > keeps SKU create/edit inside the list modal
#   - MvpMasterScreens.test.tsx > loads agency data and opens add/edit modal
#   - WarrantyPage.test.tsx > hiển thị danh sách case với tag TEMP_ONLY...
#   Xác nhận bằng `git stash` về baseline sạch trước khi sửa: 4 test này fail y hệt,
#   không phải do thay đổi antd mock hay module inventory.
# 33/33 test mới của module inventory: PASS.

$ npm run build
# tsc -b && vite build && node scripts/write-build-manifest.mjs
# PASS — dist/assets/InventoryPage-1Ez_qCqS.js (30.29 kB, gzip 8.50 kB) build thành công
# build-manifest.json ghi nhận sourceSha=local-uncommitted (không có CI SHA vì chạy local)

$ npm run check:api-mapping
# [api-mapping] M1: 24 rows, M2: 3 rows, M3: 8 rows
# [api-mapping] WARNING: swagger-api.json unavailable — chỉ chạy FE constant/baseline
#   validation, KHÔNG phải BE OpenAPI sign-off (giới hạn môi trường, không phải lỗi FE)
# [api-mapping] PASS: 35 documented rows checked (4 explicitly fail-closed)

$ npx playwright test e2e/wwhn-211-inventory-list-detail-trace.spec.ts
# 9 passed (20.9s) — evidence (screenshot + JSON metadata) ghi tại
# test-results/wwhn-211/<sourceSha>/
```

### 3.3 API mapping evidence — 6/6 endpoint tồn kho/trace đã vào evidence (trước đây 2/6)

Bổ sung `docs/api-evidence/M3_DEPENDENCY_LIST.md`: 4 endpoint còn thiếu (`GET /inventory/balances`, `GET /inventory/balances/{id}/subledger`, `GET /stock-movements`, `GET /stock-movements/trace-by-code`) đã được thêm vào bảng "Contract-Ready Rows", mỗi dòng trỏ tới hàm FE cụ thể và file test bao phủ. Dòng `trace-by-code` ghi rõ: *"resolves `resolved_type` ITEM/CONTAINER/SKU per BE `StockMovementController::traceByPhysicalCode` — not a SKU-only approximation"* để đóng dứt điểm nghi vấn "chỉ SKU approximation" trong blocker gốc.

### 3.4 Safe-stock/Scan scope — đã làm rõ, chờ BA disposition

Bổ sung `docs/api-evidence/M2_DEPENDENCY_LIST.md` mục "WWHN-211 scope note (DEV211-P2-01)": xác nhận bằng code (`grep` toàn `src/`) rằng `fetchSafeStockAlerts`, `fetchSafeStockConfigs`, `createSafeStockConfig`, `fetchScanBatches`, `createScanBatch`, `fetchScanEvents` trong `inventoryService.ts` **không được gọi bởi bất kỳ component/page nào** trong module inventory — orphan code, chưa từng thuộc phạm vi deliverable list/detail/trace của WWHN-211. Scan batch functionality đã có chủ sở hữu riêng (`src/modules/scan/services/scanService.ts`), nên các hàm scan trong `inventoryService.ts` trùng lặp trách nhiệm chứ không mở rộng nó. Đã đề xuất 2 hướng cho BA quyết định: (a) xóa các hàm không dùng, hoặc (b) xác nhận ticket tương lai sẽ dùng Safe-stock alerts/config UI và dọn trùng lặp scan helper. **FE1 không tự ý xóa code khi chưa có disposition từ BA**, theo đúng "Lưu ý cho DEV" của task.

## 4. File thay đổi trong vòng khắc phục này

Mới:
- `src/modules/inventory/services/inventoryService.test.ts`
- `src/modules/inventory/pages/InventoryPage.test.tsx`
- `src/modules/inventory/components/BalanceDetailModal.test.tsx`
- `src/modules/inventory/components/TraceModal.test.tsx`
- `e2e/wwhn-211-inventory-list-detail-trace.spec.ts`

Sửa:
- `src/modules/inventory/pages/InventoryPage.tsx` — sửa permission literal sai (mục 2.5)
- `src/test/setup.ts` — nâng cấp mock `Tabs`/`Descriptions`/`Timeline`, bổ sung `HistoryOutlined` icon (mục 3.1)
- `docs/api-evidence/M3_DEPENDENCY_LIST.md` — bổ sung 4 endpoint tồn kho/trace (mục 3.3)
- `docs/api-evidence/M2_DEPENDENCY_LIST.md` — ghi chú scope Safe-stock/Scan (mục 3.4)

## 5. Disposition từng blocker (đối chiếu với bảng đánh giá 61/100)

| ID | Mức | Trạng thái sau vòng này | Chi tiết |
| --- | --- | --- | --- |
| DEV211-P0-01 | P0 kế thừa | **Không đổi — vẫn mở, ngoài thẩm quyền FE1** | WWHN-108 (Inventory/Stocktake/Reversal SoT) vẫn In Progress theo thông tin task gốc; đây là quyết định baseline nghiệp vụ thuộc **BA Main + Tech Lead**, FE1 không có căn cứ hoặc thẩm quyền để tự đóng. Đề xuất owner/ETA: BA Main + Tech Lead xác nhận trạng thái WWHN-108 và publish baseline field/state/reconciliation sạch; FE1 sẵn sàng điều chỉnh ngay khi có baseline mới. |
| DEV211-P1-01 | P1 | **Đã đóng** | 6/6 endpoint tồn kho/trace đã vào `M3_DEPENDENCY_LIST.md` với disposition, permission (`inventory.view`/`inventory.trace`), và file test bao phủ. Trace theo item/container đã xác nhận qua `TraceModal.test.tsx` và `inventoryService.test.ts` (3 kịch bản `resolved_type` riêng biệt: ITEM/CONTAINER/SKU) — không còn là "SKU approximation". Response mẫu đã đối chiếu với BE `InventoryBalanceController`/`StockMovementController` (repo `Hoa_Nam_Backend`, `Modules/Warehouse/routes/api.php:85-91`). |
| DEV211-P1-02 | P1 | **Đã đóng** | Raw evidence đầy đủ gắn tại `HEAD 83c94c3e2e09e2b1e193cb51166fe4d0623a0eb0` (mục 3.2): typecheck/lint/test/build/check:api-mapping đều chạy thật và PASS; 33 unit/component test mới + 9 E2E test mới, tất cả PASS; xác nhận không regress trên toàn bộ 440 test hiện có (436 pass, 4 fail là baseline pre-existing không liên quan). **Lưu ý**: SHA `54b11e7` nhắc trong blocker gốc không tồn tại trong repo FE hiện tại (`git cat-file -t` không tìm thấy tại thời điểm review) — evidence vòng này dùng SHA HEAD thật thay thế; cần đối chiếu lại nếu `54b11e7` có nguồn gốc từ nhánh/repo khác. |
| DEV211-P1-03 | P1 | **Chưa đóng — thuộc QA2 (WWHN-212), ngoài vai trò FE1** | FE1 đã chuẩn bị sẵn hạ tầng: E2E harness (`e2e/wwhn-211-inventory-list-detail-trace.spec.ts`) đã bao phủ filter, responsive 3 viewport, route/RBAC guard, 401/403 error state theo đúng pattern `wwhn-178-master-sku-qa2.spec.ts` mà QA2 đã dùng trước đây — QA2 có thể chạy trực tiếp hoặc dùng làm baseline mở rộng. Việc QA2 tự thực hiện test độc lập trên build định danh và mở blocker riêng tại WWHN-212 vẫn là bước bắt buộc, FE1 không thể thay thế. Đề xuất owner/ETA: QA2, trong sprint hiện tại sau khi FE1 bàn giao evidence này. |
| DEV211-P1-04 | P1 | **Chưa đóng — thuộc BE + QA1, ngoài vai trò FE1** | FE1 chỉ có thể enforce hide/disable ở tầng UI (đã làm — xem RBAC ở mục 2.1, 2.2, có test xác nhận). FE1 không có khả năng xác nhận backend authorization/data scope hay tạo API error thật (403 với `error_code`/`request_id` từ BE) — đây là evidence phải đến từ BE + QA1. UI hide/disable **không thay thế** API guard, đúng như blocker gốc nêu. Đề xuất owner/ETA: BE + QA1, cần trước khi WWHN-212 sign-off cuối. |
| DEV211-P2-01 | P2 | **Đã làm rõ, chờ BA quyết định (không tự đóng)** | Xem mục 3.4. FE1 đã xác nhận bằng code rằng Safe-stock/Scan helper trong `inventoryService.ts` là orphan, không thuộc scope WWHN-211, và trùng lặp trách nhiệm với `scanService.ts`. Cần BA chọn 1 trong 2 hướng disposition đã đề xuất trước khi FE1 xóa hoặc giữ code này. |

## 6. Ghi chú

File task này trước đó trống (không có nội dung mô tả nào được lưu). Nội dung phiên bản đầu được viết lại từ bản mô tả task gốc (mục tiêu, input, AC, DoD, phạm vi) kết hợp kết quả rà soát code thực tế tại thời điểm `2026-08-14`. Bản cập nhật này (`2026-08-15`) phản ánh vòng khắc phục 5 blocker sau khi task bị đánh giá 61/100 — xem mục 5 để biết disposition từng blocker; các mục 2.1–2.5 (mô tả implementation) giữ nguyên vì code hiện có không đổi ngoài 1 chỗ sửa nhỏ đã ghi ở mục 2.5.
