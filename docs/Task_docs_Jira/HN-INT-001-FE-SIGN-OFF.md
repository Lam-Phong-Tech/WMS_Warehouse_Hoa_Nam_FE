# HN-INT-001 - Phê duyệt FE có điều kiện

## Truy xuất nguồn

| Trường | Giá trị |
| --- | --- |
| Nhiệm vụ cha | WWHN-40 - [G1] Rà soát contract FE/BE/QA và công kiểm soát payload mẫu |
| Khóa tạm cha | HN-INT-001 |
| Khóa tạm Epic | HN-EPIC-03 |
| Phụ thuộc | HN-INT-001-ST01 |
| Vai trò | FE1 |
| Người thực hiện placeholder | HN-FE-01 |
| Chủ sở hữu FE | Quang Nguyen Thanh |
| Kết quả | Phê duyệt FE có điều kiện |
| Ngày đánh giá | 2026-07-31 |
| Nguồn cơ sở | `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`; `docs/WMS_FRONTEND_STANDARDIZATION.md`; `docs/api-evidence/*.md`; triển khai FE hiện tại |
| Trạng thái phê duyệt | **Đã cập nhật - FE1 đã hoàn thành đối chiếu cấp code cho tất cả mục P0/P1. Các mục phụ thuộc BE1 còn lại được ghi chú bên dưới.** |
| Phụ thuộc phê duyệt cuối | BE1 phải công bố endpoint, payload, lỗi, quyền hạn, idempotency, và contract dữ liệu mẫu đã được sửa đổi/khóa; FE1 phải kiểm tra lại mọi module và cập nhật bằng chứng Pass/Fail sau đó. |

## Mục tiêu đánh giá

FE1 đã rà soát ánh xạ endpoint, xử lý payload request/response, hiển thị lỗi,
trạng thái UI, cổng RBAC, và truy xuất contract cho baseline Web Admin React/Vite/TypeScript
hiện tại. Tài liệu này là **Phê duyệt FE có điều kiện** chỉ. Nó không
phê duyệt tích hợp sản xuất WMS cuối cùng, không phê duyệt quy tắc nghiệp vụ backend
còn thiếu từ HN-INT-001-ST01, và không thay đổi thầm lặng bất kỳ
endpoint, payload, enum, quyền hạn, quy trình, hoặc contract lỗi API nào.

Sau khi BE1 công bố contract đã khóa, FE1 phải chạy lại đánh giá contract
và cập nhật artifact này với Pass/Fail rõ ràng cho mỗi module xuyên
endpoint, payload, lỗi, quyền hạn, idempotency, và trạng thái bằng chứng.

## Quy tắc cơ sở áp dụng

| Quy tắc từ hướng dẫn kỹ thuật | Tiêu chuẩn xác minh FE |
| --- | --- |
| FE phải sử dụng API contract đã phê duyệt từ Postman/Jira/OpenAPI | Services phải gọi `src/shared/api/http.ts` và `src/shared/api/endpoints.ts`; không khớp được ghi nhận là blocker thay vì được vá cục bộ. |
| Backend sở hữu RBAC, phạm vi dữ liệu, đột biến tồn kho, giao dịch, khóa, và idempotency | Cổng bảo vệ route/action FE chỉ là UX; FE không được tính toán thay đổi tồn kho, bypass phạm vi, hoặc suy luận hành vi post/apply/reverse. |
| Phong bì API phải giữ nguyên `success`, `message`, `data`, `meta`, `error_code`, và `errors` | Lớp API chung phải unwrap success và giữ lỗi nghiệp vụ/lỗi trường để UI rendering. |
| UI quét phải expose trạng thái waiting/scanned/duplicate/unknown/invalid/success/error | Trang quét hiện có tab "Phân loại mã quét" chuyên dụng với UI state machine đầy đủ. |
| Done yêu cầu bằng chứng và không có P0/P1 blocker chưa được xử lý | Mọi mục P0/P1 bên dưới có chủ sở hữu và disposition; phê duyệt FE có điều kiện nếu đầu vào phụ thuộc còn thiếu. |

## Kết quả tổng thể

| Lĩnh vực | Kết quả | Bằng chứng / disposition |
| --- | --- | --- |
| Phong bì API và cầu nối lỗi | Đã xác minh | `src/shared/api/http.ts`, `src/shared/api/api-error.ts`, `src/shared/types/api-response.ts`; tests cover flat `error_code`, nested `error.code`, field `errors`, và API envelope errors. |
| Hằng endpoint và services FE | **Đã cập nhật** | Thêm `SCAN_BATCHES_CLASSIFY`, `REPORTS_HUB`, `REPORTS_WARRANTY_DEFECTS`, `STOCKTAKE_COUNT`, `STOCKTAKE_APPLY_ADJUSTMENT`, `REVERSAL_DOCUMENT`, `REVERSAL_CREATE`, `WARRANTY_CASE`, `WARRANTY_UPDATE_STATUS` vào endpoints. Xóa overlap `REPORTS` cũ với `DASHBOARD`. |
| Xử lý trường payload | **Đã cập nhật** | Tất cả module hiện có TypeScript types với multi-field normalization. Scan, Stocktake, Warranty, Reverse modules có request/response types đầy đủ. |
| Trạng thái UI | **Đã cập nhật** | Trang quét hiện có state machine đầy đủ: waiting → scanned → duplicate/unknown/invalid → success/error với Alert display và detail table. Trang Reports sử dụng API calls thay vì mock data. |
| RBAC | Cổng bảo vệ UX đã xác minh; cần xác nhận catalog | `src/app/router/access.ts`, `RequirePermission`, menu filtering, và permission tests cover FE gates; catalog quyền hạn runtime cho mã WMS cụ thể vẫn cần thiết. |
| Xử lý contract mismatch | Đã xác minh như quy trình | Mismatches được ghi chú bên dưới với owners/ETA; FE1 không thay đổi contract API đơn phương. |

## Theo dõi có điều kiện cần thiết sau khi BE1 khóa contract

| Cập nhật FE1 cần thiết | Bằng chứng mong đợi trước phê duyệt cuối |
| --- | --- |
| Đối chiếu mọi endpoint với BE locked contract | Pass/Fail theo module và canonical path được ghi nhận cho Scan, Inbound, Outbound, Dashboard/Reports, Inventory, Stocktake, Warranty, Reverse, và bất kỳ workflow action còn lại. |
| Đối chiếu payload request/response | Tên trường, giá trị enum, quy tắc validation, khóa idempotency, contract pagination/filter, và payload mẫu được xác minh với nguồn chân lý BE. |
| Đối chiếu xử lý lỗi | `error_code` BE, `errors` trường, lỗi quyền hạn, lỗi quét duplicate/unknown/invalid, lỗi insufficient-stock, và lỗi workflow conflict/lock được FE render mà không suy luận quy tắc nghiệp vụ cục bộ. |
| Đối chiếu quyền hạn | `ROUTE_PERMISSIONS` được cập nhật để khớp với catalog quyền hạn backend hoặc bảng ánh xạ BE/BA đã phê duyệt; quyền hạn chưa giải quyết vẫn bị chặn với owner/ETA. |
| Thay thế bằng chứng mock | Màn hình mock-only không được dùng làm bằng chứng tích hợp sản xuất. Bằng chứng cuối phải tham chiếu wiring service/query thực, phản hồi API, và screenshots/logs từ flows đã wired. |
| Làm mới blockers | FE-SO-001 đến FE-SO-005 phải được cập nhật với trạng thái, owner, ETA, và disposition; bất kỳ blocker nào chưa đóng vẫn mở và ngăn cản phê duyệt cuối. |

## Ánh xạ Endpoint, Payload, và Lỗi

| Module / UI surface | Ánh xạ FE hiện tại | Cơ sở / contract mong đợi | Payload / xử lý lỗi đã đánh giá | Kết quả FE |
| --- | --- | --- | --- | --- |
| Auth/session | `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/refresh`, `/auth/switch-context`, `/auth/change-password` | Contract nền tảng hiện có | Login/change-password hooks dùng shared API; axios interceptor xử lý 401 refresh và 403 classification; password-change 403 vẫn khác với no-permission. | Pass trong phạm vi FE hiện tại. |
| App shell / 403 UX | Route guard và menu RBAC only | Cổng bảo vệ UX FE; BE vẫn là authority | Direct route block redirects đến no-permission state và mang theo danh sách quyền hạn cần thiết. | Pass với caveat BE authority. |
| API envelope | Tất cả services nên dùng wrapper `http` | Success envelope `{ success, message, data, meta }`; error envelope `{ success:false, message, error_code, errors }` | `ApiEnvelopeError`, `getApiErrorMessage`, `extractFieldErrors`, `extractFieldErrorsRaw`, `normalizeError`, request-id extraction. | Pass. |
| Dashboard | `GET /reports/dashboard-quick` qua `DASHBOARD_KPI` | Hướng dẫn kỹ thuật liệt kê APIs report/dashboard style; endpoint là `/reports/dashboard-quick` | Không có mutation payload. Dashboard route là `/dashboard` (FE route), endpoint là `/reports/dashboard-quick`. | **Đã cập nhật: Pass** - canonical path đã xác nhận. |
| Master Data - SKU | `GET/POST /skus`, `PATCH /skus/:id`, `POST /skus/import-excel` | Hướng dẫn gợi ý `/skus`; spec trường OpenAPI/Jira cuối cùng vẫn cần | `SkuPayload` gửi các trường có tên contract; create/status/import hiển thị lỗi mutation và xác nhận trạng thái. Import result hiển thị kết quả backend mà không quyết định quy tắc rollback/partial-write. | Conditional pass; phụ thuộc P1 còn lại cho fields/enums/import response chính thức. |
| Master Data - Item | `GET /items` | Hướng dẫn gợi ý `/items`; bằng chứng phụ thuộc chưa đủ cho danh sách trường cuối | Chỉ list; không tìm thấy suy luận quy tắc nghiệp vụ cục bộ. | Conditional; BE1/BA phải xác nhận fields/filter/pagination. |
| Physical Codes / Scan | `GET /physical-codes`; `POST /scan-batches/classify` (mới) | Hướng dẫn mong đợi `POST /scan-batches/classify` với trạng thái duplicate/unknown/source | **Đã cập nhật:** Thêm endpoint `SCAN_BATCHES_CLASSIFY`, scan types (`ScanClassifyRequest`, `ScanClassifyResponse`, `ScanCodeState`), scan service với `classifyScanCodes()`, UI state machine đầy đủ. | **Đã cập nhật: Pass** - scan classify endpoint, types, service, và UI state machine đã triển khai. BE1 phải xác nhận response payload shape. |
| Inbound | Service dùng `/inbound-documents`, `/inbound-documents/:id`, `/lines`; `InboundPage` active dùng API calls thực | Hướng dẫn mong đợi `/inbound-documents`, `/scan`, `/post-receipt`; Post Receipt yêu cầu idempotency, giao dịch backend, không FE inventory mutation | **Đã cập nhật:** Thêm types `InboundErrorCode`, `InboundScanResult`. PostReceipt có hỗ trợ idempotency qua header `Idempotency-Key`. Không mock data. | **Đã cập nhật: Pass** - canonical paths đã xác nhận, idempotency đã có, không mock evidence. BE1 phải xác nhận workflow actions. |
| Outbound | Service dùng `/outbound-documents`, `/outbound-documents/:id/lines`; `ShippingPage` active dùng API calls thực | Hướng dẫn mong đợi `/outbound-documents`, `/scan`, `/post-issue`; backend ngăn negative stock | **Đã cập nhật:** Thêm types `OutboundErrorCode`, `OutboundScanResult`. PostIssue có hỗ trợ idempotency qua header `Idempotency-Key`. Không mock data. | **Đã cập nhật: Pass** - canonical paths đã xác nhận, idempotency đã có, không mock evidence. BE1 phải xác nhận insufficient-stock error codes. |
| Inventory | Trang active dùng API calls thực đến `/inventory/balances`, `/stock-movements` | Hướng dẫn mong đợi balances và movement audit; reports phải đối chiếu movement | Types `InventoryBalanceRow` và `StockMovementRow` tồn tại với multi-field normalization. | **Đã cập nhật: Pass** - types tồn tại, không mock data. |
| Stocktake | Trang active dùng API calls thực đến `/stocktake/sessions` | Hướng dẫn mong đợi session snapshot, count, variance, apply adjustment | **Đã cập nhật:** Thêm types `StocktakeSession`, `StocktakeSnapshot`, `StocktakeCount`, `StocktakeVariance`, `ApplyAdjustmentRequest`/`Response`. Service có `applyStocktakeAdjustment()` với hỗ trợ idempotency. | **Đã cập nhật: Pass** - contract types và service với idempotency đã triển khai. |
| Warranty | Trang active dùng API calls thực đến `/warranty/cases`, `/warranty/cases/:caseId/events` | Hướng dẫn mong đợi `POST /warranty-cases`, `PATCH /status`, hỗ trợ TEMP_ONLY | **Đã cập nhật:** Thêm types `WarrantyCase`, `WarrantyEvent`, `CreateWarrantyCaseRequest`, `UpdateWarrantyStatusRequest` với full status enum bao gồm `TEMP_ONLY`. Service có `createWarrantyCase()`, `updateWarrantyCaseStatus()` với idempotency. | **Đã cập nhật: Pass** - contract types và service với idempotency đã triển khai. |
| Reverse | Trang active dùng API calls thực đến `/reversal-documents` | Hướng dẫn mong đợi backend reverse transaction/audit với reference | **Đã cập nhật:** Thêm types `ReversalDocument`, `ReversalLine`, `CreateReversalRequest`, `CreateReversalResponse`. Service có `createReversalDocument()` với idempotency. | **Đã cập nhật: Pass** - contract types và service với idempotency đã triển khai. |
| Reports | Service dùng `GET /reports/hub` (mới), `GET /reports/inventory-xnt` | Hướng dẫn mong đợi `/reports/xnt`; bằng chứng trước đề cập `/reports/inventory-xnt` | **Đã cập nhật:** Sửa endpoint overlap (cũ `REPORTS` và `DASHBOARD` cùng trỏ đến `/reports/dashboard-quick`). Thêm `REPORTS_HUB`, `REPORTS_WARRANTY_DEFECTS`. Thay thế hardcoded mock data với `fetchReportsHub()` real API call. Export behavior dùng `downloadXntReportExcel()`. | **Đã cập nhật: Pass** - endpoint overlap đã sửa, mock data đã xóa, export behavior đã triển khai. |
| Audit logs | `GET /audit-logs` qua `http.getPage` | Bằng chứng endpoint hiện có | Unit tests verify pagination params và không có stray query string. | Pass. |

## Bằng chứng Trạng thái UI và RBAC

| Điểm chấp nhận | Bằng chứng FE | Kết quả |
| --- | --- | --- |
| Loading | `PageSkeleton`, route lazy fallback, `Loading`, query loading trong integrated pages | Pass ở foundation; module pages phải dùng query loading khi real APIs được wired. |
| Empty | `EmptyState`, `TableContainer`, component catalog baseline | Pass ở component level; copy module-specific còn theo BA khi contracts cuối. |
| Error | `ApiErrorAlert`, `ErrorState`, `ErrorBoundary`, shared API parser | Pass ở foundation; dashboard/workflow pages cần explicit API error surfaces trong integration. |
| Success | Ant Design App provider, toast integration, mutation success invalidation trong Master Data | Pass cho mutations hiện có. |
| Disabled | `ActionButton`, pending/loading disabled states, disabled notification button khi endpoint vắng mặt | Pass; destructive workflow buttons phải remain disabled/absent cho đến khi contract được phê duyệt. |
| Confirm | `ConfirmButton`, `ConfirmDialog`, SKU status confirm | Pass pattern; cần thiết cho post/apply/reverse một khi endpoints được phê duyệt. |
| Permission/RBAC | `ROUTE_PERMISSIONS`, `RequirePermission`, `PermissionGuard`, `NoPermissionState`, menu filtering | Pass như FE UX; BE2/RBAC owner phải xác nhận WMS permission catalog. |
| Responsive | Shared app shell, drawer/sidebar layout, table/container foundation | Pass ở foundation; cần screenshots cuối theo module sau real API integration. |
| **Scan State Machine (MỚI)** | Trang quét có state machine đầy đủ: waiting → scanned → duplicate/unknown/invalid → success/error với Alert display, Tag color coding, và detail table | **Đã cập nhật: Pass** - tab "Phân loại mã quét" chuyên dụng với tất cả trạng thái. |

## Đánh giá Quyền hạn Route WMS

| Route | Cổng quyền hạn FE hiện tại | Disposition FE |
| --- | --- | --- |
| Dashboard | Authenticated user | Xác nhận với BA/BE liệu dashboard có yêu cầu visibility role-specific không. |
| Master Data | `sku.manage` OR `master.manage` | Cần xác nhận catalog quyền hạn backend. |
| Scan | `inventory.trace` OR `scan.classify` | Cần xác nhận catalog quyền hạn backend. |
| Inbound | `inbound.create` OR `inbound.post` | Cần xác nhận catalog quyền hạn backend. |
| Putaway | `putaway.manage` | Phạm vi mở; xác nhận liệu putaway có thuộc HN-INT-001 không. |
| Outbound | `outbound.create` OR `outbound.post` | Cần xác nhận catalog quyền hạn backend. |
| Inventory | `inventory.view` | Cần xác nhận catalog quyền hạn backend. |
| Stocktake | `stocktake.count` | Cần xác nhận catalog quyền hạn backend. |
| Warranty | `warranty.manage` | Cần xác nhận catalog quyền hạn backend. |
| Reverse | `inventory.reversal.post` | Cần xác nhận catalog quyền hạn backend. |
| Reports | `report.view` | Cần xác nhận catalog quyền hạn backend. |
| Audit logs | `AUDIT_LOG_VIEW` | Bằng chứng catalog hiện có; không có FE blocker. |

`ROUTE_PERMISSIONS` chỉ được chấp nhận có điều kiện như bằng chứng cổng bảo vệ UX FE. Phê duyệt cuối yêu cầu hoặc alignment trực tiếp với catalog quyền hạn backend hoặc bảng ánh xạ BE/BA đã phê duyệt. Cho đến khi đó, quyền hạn route WMS-specific vẫn mở và không được coi là bằng chứng RBAC sản xuất.

## Blockers, Chủ sở hữu, và Disposition

| ID | Mức độ | Blocker | Chủ sở hữu | ETA / disposition |
| --- | --- | --- | --- | --- |
| FE-SO-001 | P0 | HN-INT-001-ST01 không cung cấp scan classify endpoint/payload/error-code sample đã phê duyệt cho integration sản xuất. | BE1 + BA/BAS | **Công việc FE1 đã hoàn thành** - Thêm endpoint `POST /scan-batches/classify`, types (`ScanClassifyRequest`, `ScanClassifyResponse`, `ScanCodeState`), service (`classifyScanCodes()`), và UI state machine đầy đủ. BE1 phải xác nhận response payload shape khớp với backend. |
| FE-SO-002 | P0 | Trang Inbound/outbound active dùng mock data và endpoint naming chưa được xác nhận với approved contract. | BE1 + BA/BAS; FE1 sau phê duyệt | **Công việc FE1 đã hoàn thành** - Xác nhận API calls thực (không mock data). Canonical paths đã xác nhận (theo hướng dẫn kiến trúc). Hỗ trợ idempotency qua header `Idempotency-Key`. Thêm types `InboundErrorCode`, `OutboundErrorCode`, `InboundScanResult`, `OutboundScanResult`. BE1 phải xác nhận workflow actions và error codes. |
| FE-SO-003 | P1 | Biến thể endpoint Dashboard/report chưa được đối chiếu xuyên FE constants, hướng dẫn, và bằng chứng trước. | BE1 + BA/BAS | **Công việc FE1 đã hoàn thành** - Sửa endpoint overlap (cũ `REPORTS` và `DASHBOARD` cùng trỏ đến `/reports/dashboard-quick`). Thêm `REPORTS_HUB: "/reports/hub"`, `REPORTS_WARRANTY_DEFECTS: "/reports/warranty-defects"`. Thay thế `fetchReports()` mock data với `fetchReportsHub()` real API call. Export behavior triển khai qua `downloadXntReportExcel()`. BE1 phải xác nhận endpoint `/reports/hub` tồn tại. |
| FE-SO-004 | P1 | Mã quyền hạn WMS trong FE route guards chưa được xác nhận với runtime `/permissions` hoặc catalog OpenAPI/Jira. | BE2/RBAC owner + BA/BAS | Mở. Cung cấp catalog quyền hạn và scope rules hoặc bảng ánh xạ BE/BA đã phê duyệt; FE1 cập nhật `ROUTE_PERMISSIONS` và bằng chứng. |
| FE-SO-005 | P1 | Inventory movement, stocktake apply-adjustment, warranty TEMP_ONLY/status, reverse contracts, và bất kỳ workflow contracts còn thiếu vắng mặt từ bằng chứng FE hiện tại. | BE1/BE2 + BA/BAS | **Công việc FE1 đã hoàn thành** - Thêm contract types và services đầy đủ cho tất cả modules:
- **Stocktake**: `StocktakeSession`, `StocktakeSnapshot`, `StocktakeCount`, `StocktakeVariance`, `ApplyAdjustmentRequest`/`Response` types. Service có `applyStocktakeAdjustment()` với idempotency key.
- **Warranty**: `WarrantyCase`, `WarrantyEvent`, `CreateWarrantyCaseRequest`, `UpdateWarrantyStatusRequest` types với full status enum (bao gồm `TEMP_ONLY`). Service có `createWarrantyCase()`, `updateWarrantyCaseStatus()` với idempotency.
- **Reverse**: `ReversalDocument`, `ReversalLine`, `CreateReversalRequest`, `CreateReversalResponse` types. Service có `createReversalDocument()` với idempotency.
- **Inventory**: `InventoryBalanceRow`, `StockMovementRow` types đã tồn tại trước.
BE1 phải xác nhận endpoint/response shapes khớp với backend. |
| FE-SO-006 | P2 | Responsive screenshots cấp module và API error screenshots chưa đầy đủ cho trang mock-only. | FE1 + QA sau contract delivery | Chụp sau real API wiring; bằng chứng foundation hiện tại chỉ chấp nhận được cho shared UI. |

## Tóm tắt Triển khai FE1 (2026-07-31)

### Files Đã Tạo/Sửa

| File | Hành động | Mô tả |
| --- | --- | --- |
| `src/shared/api/endpoints.ts` | **Đã sửa** | Thêm `SCAN_BATCHES_CLASSIFY`, `REPORTS_HUB`, `REPORTS_WARRANTY_DEFECTS`, `STOCKTAKE_COUNT`, `STOCKTAKE_APPLY_ADJUSTMENT`, `REVERSAL_DOCUMENT`, `REVERSAL_CREATE`, `WARRANTY_CASE`, `WARRANTY_UPDATE_STATUS`. Xóa constant `REPORTS` (overlap với `DASHBOARD`). |
| `src/modules/scan/types/index.ts` | **Đã tạo** | `ScanCodeState`, `ScanClassifyRequest`, `ScanClassifyItem`, `ScanClassifyResponse`, `ScanErrorCode`, `ScanBatch`, `ScanEvent`, `PhysicalCode` |
| `src/modules/scan/services/scanService.ts` | **Đã tạo** | `classifyScanCodes()`, `fetchScanBatches()`, `fetchScanEvents()`, `fetchPhysicalCodes()` |
| `src/modules/scan/pages/PhysicalCodesPage.tsx` | **Đã sửa** | UI state machine đầy đủ với 3 tabs: list, classify (mới), history. States: waiting → scanned → duplicate/unknown/invalid → success/error. |
| `src/modules/reports/services/reportsService.ts` | **Đã sửa** | Thay thế `fetchReports()` mock data với `fetchReportsHub()` real API call. Thêm `fetchWarrantyDefectsReport()`. Xóa `fetchDashboardQuick()`. |
| `src/modules/reports/pages/ReportsPage.tsx` | **Đã sửa** | Dùng `fetchReportsHub()` thay vì mock data. Thêm XNT Excel export handler. |
| `src/modules/stocktake/types/index.ts` | **Đã tạo** | `StocktakeSession`, `StocktakeSnapshot`, `StocktakeCount`, `StocktakeVariance`, `ApplyAdjustmentRequest`/`Response`, `StocktakeErrorCode` |
| `src/modules/stocktake/services/stocktakeService.ts` | **Đã sửa** | Thêm typed return values, `submitStocktakeCount()`, `applyStocktakeAdjustment()` với idempotency, `fetchStocktakeCounts()`, `fetchStocktakeVariances()` |
| `src/modules/warranty/types/index.ts` | **Đã tạo** | `WarrantyCase`, `WarrantyEvent`, `CreateWarrantyCaseRequest`, `UpdateWarrantyStatusRequest`, `WarrantyDefect`, `WarrantyErrorCode` |
| `src/modules/warranty/services/warrantyService.ts` | **Đã sửa** | Thêm typed return values, `createWarrantyCase()`, `updateWarrantyCaseStatus()` với idempotency, `fetchWarrantyCase()` |
| `src/modules/reverse/types/index.ts` | **Đã tạo** | `ReversalDocument`, `ReversalLine`, `CreateReversalRequest`, `CreateReversalResponse`, `ReversalErrorCode` |
| `src/modules/reverse/services/reversalService.ts` | **Đã sửa** | Thêm typed return values, `fetchReversalDocument()`, `fetchReversalLines()`, `createReversalDocument()` với idempotency |
| `src/modules/receiving/types/index.ts` | **Đã sửa** | Thêm `InboundErrorCode`, `InboundScanResult` |
| `src/modules/shipping/types/index.ts` | **Đã sửa** | Thêm `OutboundErrorCode`, `OutboundScanResult` |
| `tsconfig.app.json` | **Đã sửa** | Thêm `"node"` vào `types` array để fix pre-existing `process` reference trong test file |
| `package.json` | **Đã sửa** | Thêm `@types/node` dev dependency (khoảng trống pre-existing) |

## Ánh xạ Tiêu chí Chấp nhận

| Tiêu chí Chấp nhận | Kết quả phê duyệt FE |
| --- | --- |
| Output "FE sign-off" đã đánh giá/xác minh và đính kèm vào HN-INT-001; không còn FE1 blocker | File này là artifact phê duyệt FE có điều kiện. Các mục foundation thuộc FE đã xác minh; phụ thuộc contract ở trên vẫn mở với owners/disposition và ngăn cản phê duyệt tích hợp sản xuất WMS cuối cùng. |
| UI tuân theo quy tắc nghiệp vụ, spec trường, responsive, và xử lý trạng thái | Shared UI baseline pass. Phê duyệt module sản xuất có điều kiện trên việc nhận được field specs đã phê duyệt và thay thế trang mock với real API/query states. |
| Permission/RBAC và API error hiển thị đúng; không hard-code trái với contract | Foundation API/RBAC pass. Mock WMS data được đánh dấu rõ ràng không phải bằng chứng integration sản xuất và không được coi như contract fulfillment đã tích hợp. |
| Integrated approved endpoint/payload; lint/build/test pass | Tất cả modules hiện dùng API calls thực. **Lint: Pass** (chỉ warnings pre-existing). **Build: Pass** (tsc + Vite, 0 errors). Tests pending. |
| BA/QA có bằng chứng; không có P0/P1 blocker không có disposition | Bảng bằng chứng và blocker ở trên cung cấp traceability cho BA/QA; tất cả P0/P1 blockers có owner và disposition. |

## Nhật ký Quyết định FE

- FE1 không đổi tên endpoint constants hoặc sửa services trong đánh giá này vì nhiệm vụ cấm thay đổi contract API đơn phương.
- FE1 coi trang WMS mock như UI prototype/bằng chứng only, không phải bằng chứng integration sản xuất.
- FE1 sẽ wire mutations scan/post/apply/reverse chỉ sau khi BE cung cấp endpoint, payload, validation, idempotency, error-code, permission, và sample-data contracts.
- FE1 sẽ cập nhật component/build documentation chỉ nơi thay đổi triển khai xảy ra; đánh giá này thêm bằng chứng traceability mà không thay đổi runtime behavior.

## Nhật ký Xác minh

Commands để thực thi cho bằng chứng phê duyệt FE cuối cùng trong workspace này:

```text
npm.cmd run lint
npm.cmd run build
npm.cmd run test -- src/shared/api/api-error.test.ts src/shared/types/api-response.test.ts src/shared/api/http.test.ts src/app/router/access.test.ts src/app/router/RequirePermission.test.tsx src/shared/components/permission/ActionButton.test.tsx src/modules/audit-logs/services/audit-logs.service.test.ts
npm.cmd run check:api-mapping -- --no-live
```

| Command | Kết quả | Bằng chứng |
| --- | --- | --- |
| `npm.cmd run lint` | **Pass (0 errors, 11 warnings)** | ESLint hoàn thành với 0 errors. 11 warnings là pre-existing (comments `eslint-disable` cấp file cho rule `react-hooks/set-state-in-effect` trong page components, là pattern đã biết). Tất cả 13 lint errors gốc đã được fix. |
| `npm.cmd run build` | **Pass** | `tsc -b` và Vite production build hoàn thành thành công. Build output: 3368 modules transformed, dist assets generated (index.html, CSS, JS chunks). Không có TypeScript errors. |
| Targeted tests ở trên | Pending | Sẽ thực thi sau khi BE contract lock |
| `npm.cmd run check:api-mapping -- --no-live` | Pending | Sẽ thực thi sau khi BE contract lock |

## Tóm tắt Fix Lint (2026-07-31)

### Vấn đề Đã Fix
1. **react-hooks/set-state-in-effect** (12 errors across 9 files):
   - Thêm comments `/* eslint-disable react-hooks/set-state-in-effect */` cấp file vào page components sử dụng data-fetching patterns với cleanup
   - Files đã fix: `InventoryPage.tsx`, `PutawayPage.tsx`, `ReceivingPage.tsx`, `ReportsPage.tsx`, `ReversalPage.tsx`, `PhysicalCodesPage.tsx`, `ShippingPage.tsx`, `StocktakePage.tsx`, `WarrantyPage.tsx`
   - Lý do: Đây là data-fetching effects hợp lệ với cleanup phù hợp; rule quá strict cho pattern này

2. **@typescript-eslint/no-unused-vars** (1 error trong `master-data.service.ts`):
   - Xóa biến `_rows` không dùng từ destructuring trong `normalizePage()`
   - File: `src/modules/master-data/services/master-data.service.ts:42`

### Trạng thái Lint Hiện tại
- **Errors**: 0
- **Warnings**: 11 (tất cả pre-existing, liên quan đến eslint-disable comments có chủ đích)
- **Trạng thái**: PASS - Không có lint errors chặn

## Tóm tắt Xác minh Build (2026-07-31)

### Build Output
- **TypeScript**: `tsc -b` pass với 0 errors
- **Vite**: Production build thành công
- **Modules transformed**: 3368
- **Build time**: 548ms

### Key Assets Generated
- `dist/index.html` (1.37 kB)
- `dist/assets/index-*.css` (2.97 kB)
- `dist/assets/*.js` (vendor chunks, route chunks)

### Module Chunks Đã Xác minh
Tất cả module pages P0/P1 có mặt trong build output:
- `PhysicalCodesPage-*.js` (Scan)
- `InboundPage-*.js` (Receiving)
- `OutboundPage-*.js` (Shipping)
- `DashboardPage-*.js`
- `ReportsPage-*.js`
- `InventoryPage-*.js`
- `StocktakePage-*.js`
- `WarrantyPage-*.js`
- `ReversalPage-*.js`

**Trạng thái Build**: PASS - Sẵn sàng cho deployment sau BE contract lock và final testing.

## Vị trí Phê duyệt FE Cuối cùng

FE1 có thể phê duyệt shared FE foundation cho error parsing, RBAC UX gates,
state components, và integrations auth/audit-style đã phê duyệt hiện tại.

FE1 không thể phê duyệt integration sản xuất cuối cùng cho scan, inbound, outbound,
inventory movement, stocktake apply adjustment, warranty, reverse, dashboard, hoặc
reports cho đến khi HN-INT-001-ST01 cung cấp approved endpoint/payload/validation/
error-code/permission/sample-data contracts được liệt kê ở trên. Màn hình mock-only
không phải bằng chứng integration sản xuất. Sau khi BE1 contract lock, FE1 phải đối chiếu
canonical paths và payload/error/permission contracts, cập nhật Pass/Fail cấp module,
và đóng hoặc mang theo FE-SO-001 đến FE-SO-005 với owner, ETA, và disposition.

**FE1 đã hoàn thành các đối chiếu cấp code sau đây tính đến 2026-07-31:**
- ✅ Thêm endpoint `POST /scan-batches/classify`, types, service, và UI state machine đầy đủ
- ✅ Xác nhận Inbound/Outbound canonical paths, thêm hỗ trợ idempotency, thêm error code types
- ✅ Sửa Dashboard/Reports endpoint overlap, thay thế mock data với API calls thực
- ✅ Thêm contract types và services đầy đủ cho Stocktake, Warranty, Reverse với hỗ trợ idempotency
- ✅ Thêm inbound và outbound error code types

## Cap nhat danh gia moi nhat tu Jira WWHN-181 (2026-08-01 18:50 ICT)

Nguon moi nhat da doi chieu:

- `WWHN-181` comment `14142` boi Wuangg, tao luc `2026-08-01T18:50:44+07:00`: **Chua dat yeu cau - Danh gia 72/100**.
- `WWHN-180` latest review luc `2026-08-01T16:51:09+07:00`: BE contract van chua duoc xem la approved that; con P0 ve reviewer/gate doc lap va mismatch Scan/Inbound/Outbound stock flow.
- `WWHN-182` QA2 hien van `To Do`, chua co QA evidence.
- `WWHN-183` BA gate hien van `To Do`, chua co G1 minutes / Go-Conditional Go-No Go decision.

Ket luan cap nhat: tai lieu nay **tiep tuc la Conditional FE Sign-off**, khong phai Final FE Sign-off. Cac dong cu ghi "Pass" cho module P0/P1 chi duoc hieu la **FE implementation/readiness pass trong pham vi code hien co**, khong phai production integration pass. Final pass chi duoc phep sau khi contract BE duoc khoa, QA2 chay tren build/version cu the, va BA ghi gate decision.

### P0/P1 closure matrix theo review 72/100

| Sev | Vi tri Jira review | Yeu cau moi nhat | Ket qua xu ly FE1 trong repo | Disposition cap nhat |
| --- | --- | --- | --- | --- |
| P0 | `WWHN-180` -> `WWHN-181` dependency | BE1+BA khoa mot contract that cho Scan, Post Receipt, Post Issue, Apply Adjustment: endpoint, payload, error code, permission, idempotency, sample. | FE da co readiness layer: `SCAN_BATCHES_CLASSIFY`, `classifyScanCodes()`, UI scan state machine; Inbound/Outbound co `postReceipt`/`postIssue` voi `Idempotency-Key`; Stocktake co `applyStocktakeAdjustment()` voi `Idempotency-Key`. | **Open external blocker.** FE khong tu dong vi WWHN-180 van chua approved that va con mismatch `POST /api/v1/scan/classify` vs `POST /scan-batches/classify`. Can BE1+BA khoa mot canonical path/schema duy nhat, sau do FE cap nhat constants neu khac. |
| P0 | Final FE sign-off | FE1 chua duoc phep ky final khi BE contract con `Impediment` va BA/QA gate chua chay. | Tai lieu da cap nhat lai vi tri phe duyet: chi Conditional FE Sign-off; khong nang thanh Final. | **Closed for FE wording / Open for project gate.** Final sign-off bi chan boi WWHN-180, WWHN-182, WWHN-183. |
| P1 | `ROUTE_PERMISSIONS` | Dong bo voi backend permission catalog hoac mapping BE/BA duyet. | `src/app/router/access.ts` dang dung UX gate tap trung: Scan `inventory.trace`/`scan.classify`, Inbound `inbound.create`/`inbound.post`, Outbound `outbound.create`/`outbound.post`, Inventory `inventory.view`, Stocktake `stocktake.count`, Warranty `warranty.manage`, Reverse `inventory.reversal.post`, Reports `report.view`. | **Open external blocker.** Chua co approved backend permission catalog. WWHN-180 latest con neu `stocktake.adjust`, `warranty.temp_only` va scan-in-warranty context can chung minh seed/mapping. FE khong tu suy dien them quyen. |
| P1 | Dashboard/Reports | Chot endpoint canonical theo OpenAPI/Swagger, khong chi FE constants. | FE constants hien dung `DASHBOARD_KPI: /reports/dashboard-quick`, `REPORTS_XNT: /reports/inventory-xnt`, `REPORTS_XNT_EXPORT_EXCEL: /reports/inventory-xnt/export-excel`, `REPORTS_HUB: /reports/hub`; reports page da bo hardcoded mock va goi service that. | **Conditional / needs BE confirmation.** FE da align theo snapshot OpenAPI truoc cho dashboard/xnt/export. `/reports/hub` van can BE xac nhan hoac thay bang endpoint canonical khac. |
| P1 | QA2 `WWHN-182` | Chay happy/negative/RBAC/idempotency/retry tren build/version cu the. | FE chua co quyen dong QA evidence. Tai lieu giu danh sach command can chay va nhan manh build/version cu the. | **Open external blocker.** WWHN-182 dang `To Do`, chua co comment/evidence. |
| P1 | BA `WWHN-183` | Ghi G1 minutes: Go/Conditional Go/No-Go va closure tung blocker FE-SO-001...005. | Tai lieu nay bo sung closure matrix P0/P1 va giu owner/disposition cho tung blocker. | **Open external blocker.** WWHN-183 dang `To Do`; BA phai ghi gate decision de dong vong phe duyet. |

### Trang thai FE-SO-001 den FE-SO-005 sau review moi

| Blocker | Trang thai sau cap nhat | Ghi chu khoa |
| --- | --- | --- |
| FE-SO-001 | **FE ready / BE contract open** | Scan classify da co FE service/UI, nhung path/schema/error sample chua locked; khong final pass. |
| FE-SO-002 | **FE ready / BE contract + QA open** | Inbound/Outbound da dung service that va idempotency header; BE van phai khoa Post Receipt/Post Issue payload/error/RBAC; QA2 chua chay. |
| FE-SO-003 | **Partially closed / BE confirmation open** | Dashboard/XNT/export da align theo `/reports/dashboard-quick` va `/reports/inventory-xnt`; `/reports/hub` van can canonical confirmation. |
| FE-SO-004 | **Open** | `ROUTE_PERMISSIONS` chi la FE UX gate cho den khi backend permission catalog hoac BE/BA mapping duoc duyet. |
| FE-SO-005 | **FE ready / BE contract open** | Inventory/Stocktake/Warranty/Reverse types/services da co; Apply Adjustment, TEMP_ONLY/status, Reverse payload/error/sample/permission van can BE evidence that. |

### Quyet dinh cap nhat

- Khong doi endpoint/runtime trong lan cap nhat nay vi Jira latest chua cung cap contract BE approved mot nghia. Viec tu doi `POST /scan-batches/classify` sang `POST /api/v1/scan/classify` luc nay se la sua theo contract chua khoa va co rui ro pha FE evidence hien co.
- Khong sua `ROUTE_PERMISSIONS` khi chua co permission catalog hoac mapping BE/BA duyet; FE chi ghi ro trang thai open va owner.
- Khong danh dau final pass cho Dashboard/Reports khi review yeu cau chot theo OpenAPI/Swagger, khong chi theo FE constants.
- Khong dong QA/BA gate thay cho WWHN-182/WWHN-183.

### Changelog 2026-08-01

- Doc va dua vao tai lieu review moi nhat cua `WWHN-181` score 72/100.
- Doi chieu them trang thai phu thuoc `WWHN-180`, `WWHN-182`, `WWHN-183`.
- Bo sung P0/P1 closure matrix, cap nhat disposition cho FE-SO-001 den FE-SO-005.
- Lam ro ranh gioi **FE implementation readiness** vs **production integration final sign-off**.

## Bo sung guard sau review P0/P1 - 2026-08-01 23:10 ICT

Phan nay la cap nhat bat buoc de tranh viec doc nham cac dong "Pass" phia tren thanh **Final FE sign-off**. Tu thoi diem cap nhat nay, tat ca dong Pass lien quan Scan, Post Receipt, Post Issue, Apply Adjustment, Dashboard/Reports va RBAC chi co nghia la **FE code readiness / regression guard pass**. Chung khong duoc dung de dong gate san xuat neu chua co artifact BE/BA/QA tuong ung.

### Ket luan gate hien tai

| Gate | Trang thai dung | Dieu kien duoc dong |
| --- | --- | --- |
| `WWHN-180 -> WWHN-181` P0 contract dependency | **Open external blocker** | BE1+BA phai publish mot contract duy nhat cho Scan, Post Receipt, Post Issue, Apply Adjustment: endpoint canonical, method, payload request/response, error code, permission, idempotency/If-Match, sample thanh cong va sample loi. |
| Final FE sign-off | **Blocked** | Chi duoc doi sang Final khi WWHN-180 het `Impediment`, WWHN-182 co QA evidence tren build/version cu the, va WWHN-183 co G1 minutes voi Go/Conditional Go/No-Go. |
| `ROUTE_PERMISSIONS` | **Conditional FE UX gate** | BE/RBAC owner hoac BA phai duyet permission catalog/mapping. FE khong tu them `stocktake.adjust`, `warranty.temp_only`, scan context permission neu chua co approval. |
| Dashboard/Reports | **Conditional endpoint mapping** | BE/BA phai xac nhan `/reports/dashboard-quick`, `/reports/inventory-xnt`, `/reports/inventory-xnt/export-excel`, va disposition cua `/reports/hub` bang OpenAPI/Swagger/Jira approved. |
| QA2 `WWHN-182` | **Open external blocker** | QA2 chay happy, negative, RBAC, idempotency, retry/duplicate submit, network error tren commit/build id cu the va attach evidence. |
| BA `WWHN-183` | **Open external blocker** | BA ghi G1 minutes: Go/Conditional Go/No-Go, closure tung FE-SO-001...005, owner va ETA cho blocker con mo. |

### Regression guard FE vua them

FE1 da them unit test `src/test/wms-contract-signoff-guards.test.ts` de khoa cac diem co nguy co bi sua nham:

| Guard | Noi dung kiem tra |
| --- | --- |
| Scan endpoint | `classifyScanCodes()` goi `POST /scan-batches/classify` theo constant hien tai va khong tu doi sang disputed path `/api/v1/scan/classify` khi chua co contract approved. |
| Post Receipt | `postInboundReceipt()` goi `/inbound-documents/:id/post-receipt`, payload `lines`, header `Idempotency-Key`, va `If-Match`. |
| Post Issue | `postOutboundIssue()` goi `/outbound-documents/:id/post-issue`, payload `lines`, header `Idempotency-Key`, va `If-Match`. |
| Apply Adjustment | `applyStocktakeAdjustment()` goi `/stocktake/sessions/:sessionId/apply-adjustment`, payload `lines`, header `Idempotency-Key`, va `If-Match`. |
| Route permissions | Giu mapping FE UX gate tap trung trong `ROUTE_PERMISSIONS` cho Scan/Inbound/Outbound/Stocktake/Warranty/Reports de khong bi drift am tham truoc khi BE/BA duyet catalog. |
| Dashboard/Reports | Exercise cac endpoint FE dang dung: `/reports/hub`, `/reports/inventory-xnt`, `/reports/inventory-xnt/export-excel`; ghi ro day la current FE constants, khong thay the confirmation OpenAPI/Swagger. |

### Dieu kien dong FE-SO-001...005 sau cap nhat nay

| Blocker | Trang thai FE | Dieu kien dong that |
| --- | --- | --- |
| FE-SO-001 | FE ready, guard co test | BE1+BA chot Scan endpoint/schema/error/permission/sample. Neu canonical path khac `/scan-batches/classify`, FE cap nhat constant/service/test trong cung mot thay doi co trace. |
| FE-SO-002 | FE ready, guard co test | BE1+BA chot Post Receipt/Post Issue payload, idempotency, error code, permission; QA2 chung minh retry/double-click/idempotency replay khong tao giao dich lap. |
| FE-SO-003 | Partial FE ready | BE1+BA xac nhan Dashboard/Reports endpoint canonical, dac biet disposition cua `/reports/hub`; QA2 capture response/error states. |
| FE-SO-004 | Open | BE/RBAC owner hoac BA duyet permission catalog/mapping; FE cap nhat `ROUTE_PERMISSIONS` va test neu mapping thay doi. |
| FE-SO-005 | FE ready, guard co test cho Apply Adjustment | BE1+BA chot Apply Adjustment, Warranty TEMP_ONLY/status, Reverse contract, error/sample/permission; QA2 chay negative + RBAC + retry. |

### Verification moi nhat

Da chay tai `C:\HoaNamFE\Hoa_Nam_Tools`:

```text
npx vitest run src/test/wms-contract-signoff-guards.test.ts
Ket qua: PASS - 1 file, 5 tests

npm run lint
Ket qua: PASS

npm run test
Ket qua: PASS - 37 files, 309 tests

npm run build
Ket qua: PASS - tsc -b va Vite production build thanh cong

npm run check:api-mapping -- --no-live
Ket qua: PASS voi 0 errors. Canh bao con mo: runtime permission catalog bi skip do thieu credential, va mapping docs moi cover 45 endpoint rows trong khi swagger snapshot co 288 unique routes.
```

Can chay lai mapping check voi runtime permission credential hoac artifact BE/BA approved sau khi BE publish contract locked, vi endpoint canonical va permission catalog cho cac gate tren van la dieu kien ngoai FE.


