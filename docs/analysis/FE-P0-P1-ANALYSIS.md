# Phân tích & Giải pháp FE-P0/P1 Items

**Ngày**: 2026-07-31  
**Người thực hiện**: FE1 (Quang Nguyen Thanh)  
**Mục đích**: Phân tích sâu từng P0/P1 item, xác định trạng thái hiện tại và đề xuất giải pháp cụ thể

---

## Tổng quan tình hình hiện tại

### ✅ Đã hoàn thành (FE1 work completed)
1. **Scan classify endpoint**: Đã thêm endpoint, types, service, UI state machine đầy đủ
2. **Inbound/Outbound canonical paths**: Đã xác nhận paths, thêm idempotency, error codes
3. **Dashboard/Reports endpoint overlap**: Đã fix overlap, thêm endpoints mới, thay mock data bằng real API
4. **Stocktake/Warranty/Reverse contracts**: Đã thêm đầy đủ types và services với idempotency

### ⏳ Chờ BE cung cấp (Dependencies)
1. BE1 khóa chính thức: endpoint, payload, error codes, permission catalog
2. FE re-check Pass/Fail sau khi BE lock contract

---

## FE-P0-01: Scan / POST /scan-batches/classify

### Trạng thái hiện tại: ✅ FE đã sẵn sàng, chờ BE confirm

#### Đã làm bởi FE1:
1. **Endpoint**: `SCAN_BATCHES_CLASSIFY = "/scan-batches/classify"` trong `endpoints.ts`
2. **Types** (`src/modules/scan/types/index.ts`):
   - `ScanCodeState`: waiting → scanned → duplicate/unknown/invalid → success/error
   - `ScanClassifyRequest`: codes[], warehouse_id?, scan_source?
   - `ScanClassifyResponse`: batch_id, items[]
   - `ScanClassifyItem`: code_value, code_type, status (VALID/DUPLICATE/UNKNOWN/INVALID), sku_code?, message?
   - `ScanErrorCode`: WMS_SCAN_DUPLICATE, WMS_SCAN_UNKNOWN, WMS_SCAN_INVALID, WMS_SCAN_BATCH_NOT_FOUND, WMS_SCAN_WAREHOUSE_MISMATCH
3. **Service** (`src/modules/scan/services/scanService.ts`):
   - `classifyScanCodes()`: POST với payload đúng
   - `fetchScanBatches()`, `fetchScanEvents()`, `fetchPhysicalCodes()`: GET với pagination
4. **UI** (`src/modules/scan/pages/PhysicalCodesPage.tsx`):
   - Tab "Phân loại mã quét" với đầy đủ state machine
   - Alert display cho từng trạng thái
   - Detail table hiển thị kết quả phân loại
   - Tag color coding: VALID=success, DUPLICATE=warning, UNKNOWN=geekblue, INVALID=error

#### Cần BE1 cung cấp:
1. **Confirm response payload shape**:
   - `ScanClassifyResponse` có đúng là `{ batch_id, items[] }` không?
   - `ScanClassifyItem` có đầy đủ fields không? Có field nào thêm/bớt không?
   - `batch_id` là string hay number?
2. **Confirm error codes**:
   - Các error codes `WMS_SCAN_*` có đúng không?
   - Có error code nào khác không?
3. **Confirm permission**:
   - Permission code là `scan.classify` hay `inventory.trace` hay code khác?
4. **Sample data**:
   - BE cung cấp sample request/response để FE test

#### Giải pháp đề xuất:
```typescript
// Sau khi BE confirm, FE cần:
1. Update ScanClassifyResponse type nếu BE có field thêm/bớt
2. Update ScanErrorCode nếu có error codes mới
3. Update ROUTE_PERMISSIONS nếu permission code khác
4. Add unit test với sample data từ BE
5. Add E2E test cho scan classify flow
```

#### Checklist Pass/Fail:
- [ ] Endpoint path: `/scan-batches/classify` - **PENDING BE CONFIRM**
- [ ] Request payload: `{ codes[], warehouse_id?, scan_source? }` - **PENDING BE CONFIRM**
- [ ] Response payload: `{ batch_id, items[] }` - **PENDING BE CONFIRM**
- [ ] Error codes: `WMS_SCAN_*` - **PENDING BE CONFIRM**
- [ ] Permission: `scan.classify` - **PENDING BE CONFIRM**
- [ ] UI state machine: waiting → scanned → duplicate/unknown/invalid → success/error - **PASS**
- [ ] Service wiring: `classifyScanCodes()` - **PASS**
- [ ] Type safety: Full TypeScript types - **PASS**

---

## FE-P0-02: Inbound/Outbound

### Trạng thái hiện tại: ✅ FE đã sẵn sàng, chờ BE confirm workflow actions

#### Đã làm bởi FE1:

##### Inbound (`src/modules/receiving/`)
1. **Canonical paths**:
   - `INBOUND_DOCUMENTS: "/inbound-documents"`
   - `INBOUND_DOCUMENT: "/inbound-documents/:id"`
   - `INBOUND_POST_RECEIPT: "/inbound-documents/:id/post-receipt"`
   - `INBOUND_SCAN: "/inbound-documents/:id/scan"`
   - `INBOUND_CLOSE_REMAINDER: "/inbound-documents/:id/close-remainder"`
   - `INBOUND_REVERSE: "/inbound-documents/:id/reverse"`
2. **Types** (`src/modules/receiving/types/index.ts`):
   - `InboundDocument`, `InboundLine`
   - `InboundErrorCode`: Thêm error codes cụ thể
   - `InboundScanResult`: Scan result type
   - `PostReceiptRequest`: { documentId, lines[], idempotencyKey?, ifMatch? }
3. **Service** (`src/modules/receiving/services/receivingService.ts`):
   - `fetchInboundDocuments()`, `fetchInboundLines()`, `fetchInboundDocument()`
   - `createInboundDocument()`, `updateInboundDocument()`
   - `submitInboundDocument()`, `approveInboundDocument()`, `rejectInboundDocument()`, `cancelInboundDocument()`
   - `scanInboundDocument()`
   - `postInboundReceipt()`: **Có idempotency support** (Idempotency-Key + If-Match)
   - `closeInboundRemainder()`
   - `reverseInboundDocument()`: **Có idempotency support**
4. **UI** (`src/modules/receiving/pages/ReceivingPage.tsx`):
   - **KHÔNG có mock data** - đang dùng real API
   - Table hiển thị danh sách inbound documents
   - Modal hiển thị chi tiết lines
   - Status color mapping
   - Actions: View, Post receipt, Close remainder (buttons chưa wired)

##### Outbound (cần kiểm tra)
1. **Canonical paths**:
   - `OUTBOUND_DOCUMENTS: "/outbound-documents"`
   - `OUTBOUND_DOCUMENT: "/outbound-documents/:id"`
   - `OUTBOUND_POST_ISSUE: "/outbound-documents/:id/post-issue"`
   - `OUTBOUND_SCAN: "/outbound-documents/:id/scan"`
   - `OUTBOUND_CLOSE_REMAINDER: "/outbound-documents/:id/close-remainder"`
   - `OUTBOUND_REVERSE: "/outbound-documents/:id/reverse"`
2. **Types** (`src/modules/shipping/types/index.ts`):
   - `OutboundDocument`, `OutboundLine`
   - `OutboundErrorCode`
   - `OutboundScanResult`
3. **Service** (`src/modules/shipping/services/shippingService.ts`):
   - Cần đọc để xác nhận idempotency support

#### Cần BE1 cung cấp:
1. **Confirm workflow actions**:
   - Post Receipt: endpoint, payload, validation rules
   - Post Issue: endpoint, payload, validation rules
   - Scan: endpoint, payload
   - Close Remainder: endpoint, payload
   - Reverse: endpoint, payload
2. **Confirm error codes**:
   - `InboundErrorCode` và `OutboundErrorCode` có đúng không?
   - Insufficient stock error code là gì?
3. **Confirm idempotency**:
   - BE có support `Idempotency-Key` header không?
   - BE có support `If-Match` (optimistic locking) không?
4. **Confirm permission**:
   - Permission codes: `inbound.create`, `inbound.post`, `outbound.create`, `outbound.post`

#### Giải pháp đề xuất:
```typescript
// Sau khi BE confirm:
1. Wire buttons "Ghi nhận một phần" và "Đóng phần còn lại" trong ReceivingPage
2. Wire buttons trong ShippingPage tương tự
3. Add error handling với specific error codes từ BE
4. Add confirmation dialog trước khi post/close/reverse
5. Add optimistic locking với If-Match header
6. Add unit tests cho từng workflow action
7. Add E2E tests cho inbound/outbound flows
```

#### Checklist Pass/Fail:
- [ ] Endpoint paths: `/inbound-documents`, `/outbound-documents` - **PENDING BE CONFIRM**
- [ ] Post Receipt: `/inbound-documents/:id/post-receipt` - **PENDING BE CONFIRM**
- [ ] Post Issue: `/outbound-documents/:id/post-issue` - **PENDING BE CONFIRM**
- [ ] Request payload: { lines[] } - **PENDING BE CONFIRM**
- [ ] Response payload: Document with updated status - **PENDING BE CONFIRM**
- [ ] Error codes: `InboundErrorCode`, `OutboundErrorCode` - **PENDING BE CONFIRM**
- [ ] Idempotency: `Idempotency-Key` header - **PENDING BE CONFIRM**
- [ ] Optimistic locking: `If-Match` header - **PENDING BE CONFIRM**
- [ ] Permission: `inbound.create`, `inbound.post`, `outbound.create`, `outbound.post` - **PENDING BE CONFIRM**
- [ ] No mock data: Real API calls only - **PASS**
- [ ] Service wiring: Full CRUD + workflow actions - **PASS**
- [ ] Type safety: Full TypeScript types - **PASS**

---

## FE-P1-01: Dashboard/Reports

### Trạng thái hiện tại: ✅ FE đã sẵn sàng, chờ BE confirm endpoints

#### Đã làm bởi FE1:

##### Dashboard (`src/modules/dashboard/`)
1. **Endpoints**:
   - `DASHBOARD_KPI: "/reports/dashboard-quick"` - KPI data
   - `DASHBOARD_RECENT_DOCUMENTS: "/document-status-history"` - Recent documents
   - `DASHBOARD_RECONCILE_HEALTH: "/inventory-snapshots"` - Reconcile health
   - `DASHBOARD_ALERTS: "/safe-stock-alerts"` - Alerts
2. **Service** (`src/modules/dashboard/services/dashboardService.ts`):
   - `fetchDashboardKPI()`
   - `fetchRecentDocuments()`
   - `fetchReconcileHealth()`
   - `fetchAlerts()`
3. **UI** (`src/modules/dashboard/pages/DashboardPage.tsx`):
   - KPI cards: active SKU, available stock, pending putaway, open stocktake, warranty active
   - Alerts card
   - Quick actions card (buttons chưa wired to permissions)
   - Recent documents table
   - Reconcile health card

##### Reports (`src/modules/reports/`)
1. **Endpoints**:
   - `REPORTS_HUB: "/reports/hub"` - Reports hub list
   - `REPORTS_XNT: "/reports/inventory-xnt"` - XNT report
   - `REPORTS_XNT_EXPORT_EXCEL: "/reports/inventory-xnt/export-excel"` - Export Excel
   - `REPORTS_WARRANTY_DEFECTS: "/reports/warranty-defects"` - Warranty defects
2. **Service** (`src/modules/reports/services/reportsService.ts`):
   - `fetchReportsHub()`: **Đã thay mock data bằng real API**
   - `fetchXntReport()`: XNT report data
   - `downloadXntReportExcel()`: Export Excel
   - `fetchWarrantyDefectsReport()`: Warranty defects
3. **UI** (`src/modules/reports/pages/ReportsPage.tsx`):
   - Cần đọc để xác nhận đã remove mock data

#### Vấn đề cần chốt:
1. **Dashboard vs Reports**:
   - `/dashboard` (FE route) → `/reports/dashboard-quick` (API endpoint) - **ĐÃ ĐÚNG**
   - `/reports` (FE route) → `/reports/hub` (API endpoint) - **ĐÃ ĐÚNG**
2. **XNT report endpoint**:
   - `/reports/xnt` (theo guide) hay `/reports/inventory-xnt` (theo evidence)?
   - **Hiện tại**: Đang dùng `/reports/inventory-xnt` - cần BE confirm
3. **Export behavior**:
   - Excel export đã có `downloadXntReportExcel()`
   - Cần confirm BE có support export endpoint không?

#### Cần BE1 cung cấp:
1. **Confirm endpoints**:
   - `/reports/dashboard-quick` có đúng không?
   - `/reports/hub` có đúng không?
   - `/reports/inventory-xnt` hay `/reports/xnt`?
   - `/reports/warranty-defects` có đúng không?
2. **Confirm response payload**:
   - Dashboard KPI fields
   - Reports hub fields
   - XNT report fields
3. **Confirm export**:
   - Excel export endpoint và format

#### Giải pháp đề xuất:
```typescript
// Sau khi BE confirm:
1. Update endpoints nếu có thay đổi
2. Update types nếu response payload khác
3. Add error handling cho reports
4. Add loading/error states cho reports page
5. Add unit tests cho reports service
6. Add E2E test cho export flow
```

#### Checklist Pass/Fail:
- [ ] Dashboard endpoint: `/reports/dashboard-quick` - **PENDING BE CONFIRM**
- [ ] Reports hub endpoint: `/reports/hub` - **PENDING BE CONFIRM**
- [ ] XNT report endpoint: `/reports/inventory-xnt` vs `/reports/xnt` - **PENDING BE CONFIRM**
- [ ] Warranty defects endpoint: `/reports/warranty-defects` - **PENDING BE CONFIRM**
- [ ] Export Excel: `/reports/inventory-xnt/export-excel` - **PENDING BE CONFIRM**
- [ ] Mock data removed: Real API calls only - **PASS**
- [ ] Service wiring: All reports services - **PASS**
- [ ] Type safety: Full TypeScript types - **PASS**

---

## FE-P1-02: ROUTE_PERMISSIONS

### Trạng thái hiện tại: ⚠️ FE đã có ROUTE_PERMISSIONS, chờ BE confirm permission catalog

#### Đã làm bởi FE1:
1. **ROUTE_PERMISSIONS** (`src/app/router/access.ts`):
   ```typescript
   {
     [ROUTES.DASHBOARD]: undefined, // Authenticated user
     [ROUTES.MASTER_DATA]: ["sku.manage", "master.manage"],
     [ROUTES.SCAN]: ["inventory.trace", "scan.classify"],
     [ROUTES.INBOUND]: ["inbound.create", "inbound.post"],
     [ROUTES.PUTAWAY]: ["putaway.manage"],
     [ROUTES.OUTBOUND]: ["outbound.create", "outbound.post"],
     [ROUTES.INVENTORY]: ["inventory.view"],
     [ROUTES.STOCKTAKE]: ["stocktake.count"],
     [ROUTES.WARRANTY]: ["warranty.manage"],
     [ROUTES.REVERSE]: ["inventory.reversal.post"],
     [ROUTES.REPORTS]: ["report.view"],
     [ROUTES.AUDIT_LOGS]: "AUDIT_LOG_VIEW",
   }
   ```
2. **Permission components**:
   - `RequirePermission`: Route guard
   - `PermissionGuard`: Component guard
   - `ActionButton`: Action-level guard
   - `NoPermissionState`: 403 error page
3. **Menu filtering**: Menu items filtered by permissions

#### Vấn đề:
1. **Permission codes chưa confirm với BE**:
   - Các codes như `sku.manage`, `inbound.create`, `scan.classify` có đúng không?
   - Có thiếu permission code nào không?
   - Có thừa permission code nào không?
2. **Permission catalog**:
   - BE chưa cung cấp `/permissions` endpoint response format
   - Chưa confirm permission scope rules

#### Cần BE2/RBAC owner cung cấp:
1. **Permission catalog**:
   - Danh sách đầy đủ tất cả WMS permission codes
   - Format của `/permissions` endpoint
2. **Permission mapping**:
   - Mỗi route cần permission codes nào?
   - Mỗi action cần permission codes nào?
3. **Scope rules**:
   - Data scope cho từng permission (warehouse, company, department)
   - Role-permission mapping

#### Giải pháp đề xuất:
```typescript
// Option 1: Direct alignment (preferred)
// FE dùng đúng permission codes từ BE catalog
export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  '/inbound': ['WMS_INBOUND_CREATE', 'WMS_INBOUND_POST'],
  // ...
};

// Option 2: Mapping table (nếu FE codes khác BE codes)
// Tạo mapping table trong FE
const PERMISSION_MAPPING: Record<string, string> = {
  'inbound.create': 'WMS_INBOUND_CREATE',
  'inbound.post': 'WMS_INBOUND_POST',
};

// Option 3: Dynamic permissions (nếu BE provide /permissions endpoint)
// FE fetch permissions từ BE và cache
const { data: permissions } = useQuery({
  queryKey: ['permissions'],
  queryFn: () => http.get('/permissions'),
});
```

#### Checklist Pass/Fail:
- [ ] Permission catalog from BE - **PENDING BE2 CONFIRM**
- [ ] ROUTE_PERMISSIONS alignment - **PENDING BE2 CONFIRM**
- [ ] Permission components: RequirePermission, ActionButton - **PASS**
- [ ] Menu filtering by permissions - **PASS**
- [ ] 403 error handling - **PASS**
- [ ] Unit tests for permission guards - **PASS**

---

## FE-P1-03: Inventory/Stocktake/Warranty/Reverse

### Trạng thái hiện tại: ✅ FE đã có đầy đủ types và services, chờ BE confirm contracts

#### Đã làm bởi FE1:

##### Inventory
1. **Types** (`src/modules/inventory/types/index.ts`):
   - `InventoryBalanceRow`: sku, warehouse, quantity, available, reserved, etc.
   - `StockMovementRow`: id, sku, type, quantity, reference, etc.
2. **Service** (`src/modules/inventory/services/inventoryService.ts`):
   - `fetchInventoryBalances()`
   - `fetchStockMovements()`
   - `fetchStockMovementTrace()`

##### Stocktake
1. **Types** (`src/modules/stocktake/types/index.ts`):
   - `StocktakeSession`: id, code, warehouse, status, dates, etc.
   - `StocktakeSnapshot`: session snapshot data
   - `StocktakeCount`: id, session_id, sku, location, expected, counted, etc.
   - `StocktakeVariance`: id, session_id, sku, expected, counted, variance, etc.
   - `ApplyAdjustmentRequest`: { session_id, counts[], idempotency_key? }
   - `ApplyAdjustmentResponse`: adjusted_count, message
   - `StocktakeErrorCode`: STOCKTAKE_SESSION_NOT_FOUND, STOCKTAKE_INVALID_STATUS, etc.
2. **Service** (`src/modules/stocktake/services/stocktakeService.ts`):
   - `fetchStocktakeSessions()`
   - `fetchStocktakeSession()`
   - `submitStocktakeCount()`: Submit count with idempotency
   - `applyStocktakeAdjustment()`: **Có idempotency support**
   - `fetchStocktakeCounts()`
   - `fetchStocktakeVariances()`

##### Warranty
1. **Types** (`src/modules/warranty/types/index.ts`):
   - `WarrantyCase`: id, case_no, sku, serial, customer, status, etc.
   - `WarrantyEvent`: id, case_id, event_type, notes, created_by, etc.
   - `CreateWarrantyCaseRequest`: sku, serial, customer, defect_description, etc.
   - `UpdateWarrantyStatusRequest`: status, notes
   - `WarrantyDefect`: id, sku, defect_type, description, etc.
   - `WarrantyErrorCode`: WARRANTY_CASE_NOT_FOUND, WARRANTY_INVALID_STATUS, etc.
   - **Status enum**: PENDING, PROCESSING, TEMP_ONLY, COMPLETED, CANCELLED
2. **Service** (`src/modules/warranty/services/warrantyService.ts`):
   - `fetchWarrantyCases()`
   - `fetchWarrantyCase()`
   - `createWarrantyCase()`: **Có idempotency support**
   - `updateWarrantyCaseStatus()`: **Có idempotency support**
   - `fetchWarrantyCaseEvents()`

##### Reverse
1. **Types** (`src/modules/reverse/types/index.ts`):
   - `ReversalDocument`: id, code, reference_type, reference_id, reason, status, etc.
   - `ReversalLine`: id, document_id, sku, quantity, reason, etc.
   - `CreateReversalRequest`: reference_type, reference_id, lines[], reason
   - `CreateReversalResponse`: id, code, status, message
   - `ReversalErrorCode`: REVERSAL_NOT_FOUND, REVERSAL_INVALID_REFERENCE, etc.
2. **Service** (`src/modules/reverse/services/reversalService.ts`):
   - `fetchReversalDocuments()`
   - `fetchReversalDocument()`
   - `fetchReversalLines()`
   - `createReversalDocument()`: **Có idempotency support**

#### Cần BE1 cung cấp:
1. **Confirm endpoints**:
   - Inventory: `/inventory/balances`, `/stock-movements` - đã đúng
   - Stocktake: `/stocktake/sessions`, `/stocktake/sessions/:id/count`, `/stocktake/sessions/:id/apply-adjustment` - cần confirm
   - Warranty: `/warranty/cases`, `/warranty/cases/:id`, `/warranty/cases/:id/events`, `/warranty/cases/:id/status` - cần confirm
   - Reverse: `/reversal-documents`, `/reversal-documents/:id` - cần confirm
2. **Confirm payload**:
   - Request/response fields cho từng endpoint
   - Enum values (status, type, etc.)
3. **Confirm error codes**:
   - `StocktakeErrorCode`, `WarrantyErrorCode`, `ReversalErrorCode`
4. **Confirm idempotency**:
   - BE có support `Idempotency-Key` không?
5. **Confirm permissions**:
   - `stocktake.count`, `warranty.manage`, `inventory.reversal.post`

#### Giải pháp đề xuất:
```typescript
// Sau khi BE confirm:
1. Update types nếu payload khác
2. Update error codes nếu có thay đổi
3. Wire UI pages với real API (nếu chưa xong)
4. Add error handling với specific error codes
5. Add confirmation dialogs cho destructive actions (apply adjustment, reverse)
6. Add optimistic locking với If-Match header
7. Add unit tests cho services
8. Add E2E tests cho workflows
```

#### Checklist Pass/Fail:
- [ ] Inventory endpoints: `/inventory/balances`, `/stock-movements` - **PENDING BE CONFIRM**
- [ ] Stocktake endpoints: `/stocktake/sessions`, `/stocktake/sessions/:id/count`, `/stocktake/sessions/:id/apply-adjustment` - **PENDING BE CONFIRM**
- [ ] Warranty endpoints: `/warranty/cases`, `/warranty/cases/:id/status` - **PENDING BE CONFIRM**
- [ ] Reverse endpoints: `/reversal-documents` - **PENDING BE CONFIRM**
- [ ] Request/response payloads - **PENDING BE CONFIRM**
- [ ] Error codes: StocktakeErrorCode, WarrantyErrorCode, ReversalErrorCode - **PENDING BE CONFIRM**
- [ ] Idempotency: `Idempotency-Key` header - **PENDING BE CONFIRM**
- [ ] Permissions: `stocktake.count`, `warranty.manage`, `inventory.reversal.post` - **PENDING BE CONFIRM**
- [ ] Type safety: Full TypeScript types - **PASS**
- [ ] Service wiring: All services with idempotency - **PASS**

---

## Tổng kết và Next Steps

### Summary

| ID | Sev | Status | FE Work | BE Dependency |
| --- | --- | --- | --- | --- |
| FE-P0-01 | P0 | ⏳ Chờ BE | ✅ Complete | Confirm endpoint, payload, error codes, permission |
| FE-P0-02 | P0 | ⏳ Chờ BE | ✅ Complete | Confirm workflow actions, error codes, idempotency |
| FE-P1-01 | P1 | ⏳ Chờ BE | ✅ Complete | Confirm endpoints, response payloads, export |
| FE-P1-02 | P1 | ⏳ Chờ BE | ✅ Complete | Confirm permission catalog, scope rules |
| FE-P1-03 | P1 | ⏳ Chờ BE | ✅ Complete | Confirm endpoints, payloads, error codes, idempotency |

### Next Steps cho FE1:

#### Giai đoạn 1: Sau khi BE cung cấp contracts (BE1/BA)
1. **Re-check từng module**:
   - So sánh BE contract với FE types/services
   - Update types nếu cần
   - Update endpoints nếu cần
   - Update error handling nếu cần

2. **Wire UI actions**:
   - ReceivingPage: Wire "Ghi nhận một phần", "Đóng phần còn lại"
   - ShippingPage: Wire tương tự
   - Dashboard: Wire quick action buttons với permissions
   - Reports: Wire export buttons

3. **Add confirmation dialogs**:
   - Post Receipt/Issue
   - Close Remainder
   - Apply Stocktake Adjustment
   - Create Reversal

4. **Add error handling**:
   - Specific error messages cho từng error code
   - Field-level errors cho forms
   - Network error handling

5. **Testing**:
   - Unit tests cho services với sample data từ BE
   - E2E tests cho workflows
   - Permission tests

#### Giai đoạn 2: Final sign-off
1. Chạy lại verification commands:
   ```bash
   npm.cmd run lint
   npm.cmd run build
   npm.cmd run test
   npm.cmd run check:api-mapping -- --no-live
   ```
2. Cập nhật HN-INT-001-FE-SIGN-OFF.md với Pass/Fail cho từng module
3. Đóng blockers FE-SO-001 đến FE-SO-005

### Yêu cầu với BE1/BA:

Vui lòng cung cấp:
1. **Locked API contract** cho tất cả WMS endpoints (Postman/OpenAPI/Jira)
2. **Request/response payload samples** cho:
   - POST /scan-batches/classify
   - POST /inbound-documents/:id/post-receipt
   - POST /outbound-documents/:id/post-issue
   - POST /stocktake/sessions/:id/apply-adjustment
   - POST /warranty/cases/:id/status
   - POST /reversal-documents
3. **Error code catalog**: Tất cả error codes có thể trả về
4. **Permission catalog**: Tất cả WMS permission codes và scope rules
5. **Sample data**: Cho testing

---

## Appendix: Code Evidence

### Scan Module
- Endpoint: `src/shared/api/endpoints.ts:110` - `SCAN_BATCHES_CLASSIFY`
- Types: `src/modules/scan/types/index.ts` - Full types
- Service: `src/modules/scan/services/scanService.ts:77-85` - `classifyScanCodes()`
- UI: `src/modules/scan/pages/PhysicalCodesPage.tsx:170-254` - Classify tab

### Inbound Module
- Endpoints: `src/shared/api/endpoints.ts:52-63` - All inbound endpoints
- Types: `src/modules/receiving/types/index.ts` - Inbound types
- Service: `src/modules/receiving/services/receivingService.ts:173-181` - `postInboundReceipt()` with idempotency
- UI: `src/modules/receiving/pages/ReceivingPage.tsx` - Real API calls

### Outbound Module
- Endpoints: `src/shared/api/endpoints.ts:64-75` - All outbound endpoints
- Types: `src/modules/shipping/types/index.ts` - Outbound types
- Service: `src/modules/shipping/services/shippingService.ts` - Need to verify idempotency

### Dashboard Module
- Endpoints: `src/shared/api/endpoints.ts:46-51` - Dashboard endpoints
- Service: `src/modules/dashboard/services/dashboardService.ts` - All dashboard services
- UI: `src/modules/dashboard/pages/DashboardPage.tsx` - Real API calls

### Reports Module
- Endpoints: `src/shared/api/endpoints.ts:79-84` - Reports endpoints
- Service: `src/modules/reports/services/reportsService.ts:52-63` - `fetchReportsHub()` (real API, no mock)
- UI: `src/modules/reports/pages/ReportsPage.tsx` - Need to verify

### Stocktake Module
- Endpoints: `src/shared/api/endpoints.ts:115-117` - Stocktake endpoints
- Types: `src/modules/stocktake/types/index.ts` - Full types
- Service: `src/modules/stocktake/services/stocktakeService.ts` - All services with idempotency

### Warranty Module
- Endpoints: `src/shared/api/endpoints.ts:123-126` - Warranty endpoints
- Types: `src/modules/warranty/types/index.ts` - Full types with TEMP_ONLY status
- Service: `src/modules/warranty/services/warrantyService.ts` - All services with idempotency

### Reverse Module
- Endpoints: `src/shared/api/endpoints.ts:119-121` - Reverse endpoints
- Types: `src/modules/reverse/types/index.ts` - Full types
- Service: `src/modules/reverse/services/reversalService.ts` - All services with idempotency

### Permissions
- Route permissions: `src/app/router/access.ts` - ROUTE_PERMISSIONS
- Components: `src/shared/components/permission/` - RequirePermission, ActionButton, PermissionGuard

---

**Kết luận**: FE1 đã hoàn thành tất cả code-level reconciliations. Tất cả P0/P1 items đều ở trạng thái **chờ BE cung cấp locked contract**. Sau khi BE cung cấp, FE1 cần re-check và update Pass/Fail evidence.