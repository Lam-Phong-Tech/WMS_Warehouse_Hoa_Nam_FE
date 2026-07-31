# HN-TEC-001 - Phản hồi Hợp đồng FE

## Truy xuất nguồn gốc

| Trường | Giá trị |
| --- | --- |
| Nhiệm vụ Cha | WWHN-31 - [TECH] Kiến trúc, ERD, Từ điển dữ liệu và OpenAPI v1 |
| Khóa tạm Cha | HN-TEC-001 |
| Khóa tạm Epic | HN-EPIC-03 |
| Phụ thuộc | HN-TEC-001-ST01 |
| Vai trò | FE1 |
| Người được gán | HN-FE-01 |
| Chủ sở hữu FE | Quang Nguyen Thanh |
| Đầu ra | Phản hồi hợp đồng FE |
| Ngày đánh giá | 2026-07-29 |
| Nguồn cơ sở | `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`; `swagger-api.json`; `docs/WMS_FRONTEND_STANDARDIZATION.md`; triển khai FE hiện tại |

## Phạm vi Đánh giá

FE1 đã đánh giá bề mặt hợp đồng/UI dựa trên đường cơ sở kỹ thuật:

- Web Admin React/Vite/TypeScript phải tiêu thụ các hợp đồng API đã được phê duyệt thông qua lớp API dùng chung.
- UI phải bao gồm các trạng thái loading, empty, error, success, disabled, confirm và permission denied khi thích hợp.
- RBAC route/action trong FE chỉ là cổng UX; backend vẫn là cơ quan có thẩm quyền về quyền và phạm vi dữ liệu.
- FE không được hard-code dữ liệu sản xuất hoặc suy luận quy tắc tồn kho/nghiệp vụ ngoài hợp đồng.
- Không khớp hợp đồng phải được báo lên với chủ sở hữu/ETA thay vì thay đổi UI hoặc đường dẫn API một cách im lặng.

## Trạng thái Điều hành

| Khu vực | Trạng thái FE | Xử lý |
| --- | --- | --- |
| Xử lý envelope/lỗi API dùng chung | Đã xác minh | `src/shared/api/http.ts`, `src/shared/api/axios.ts` và `ApiEnvelopeError` giữ nguyên `message`, `error_code`, field `errors`, pagination `meta`, phân loại 403 và ngữ cảnh yêu cầu. |
| RBAC cấp route | Đã xác minh với lưu ý | `src/app/router/access.ts` ánh xạ các route WMS đến mã quyền chỉ như cổng UX. Danh mục quyền backend cho mã WMS vẫn cần xác nhận BE. |
| UI/API Dữ liệu Danh mục | Tích hợp một phần | Danh sách SKU/item/physical-code và tạo/cập nhật trạng thái/import SKU sử dụng dịch vụ dùng chung. Cần xác nhận OpenAPI vì ảnh chụp `swagger-api.json` không hiển thị `/skus`, `/items`, `/physical-codes`. |
| UI/API Dashboard | Không khớp hợp đồng | FE gọi `/dashboard/kpi`, `/dashboard/recent-documents`, `/dashboard/reconcile-health`, `/dashboard/alerts`; ảnh chụp OpenAPI hiển thị `/reports/dashboard-quick`. Cần xử lý BE/BA. |
| UI/API Inbound/Outbound | Không khớp hợp đồng và UI mock | Hằng số/dịch vụ FE sử dụng `/inbound/documents` và `/outbound/documents`, trong khi OpenAPI hiển thị `/inbound-documents` và `/outbound-documents` cộng với các hành động workflow. Các trang route hiện tại sử dụng dữ liệu mock. |
| Inventory/Stocktake/Warranty/Reverse/Scan/Reports/Putaway | Chưa tích hợp sản xuất | Một số trang là bề mặt visual/mock. Chúng nên bị chặn khỏi "Đã hoàn thành" như "UI đã tích hợp" cho đến khi endpoint, payload, xác thực, RBAC và dữ liệu mẫu đã được phê duyệt được bàn giao. |

## Đánh giá Ánh xạ Hợp đồng

| UI/module | Bằng chứng FE hiện tại | Kỳ vọng OpenAPI / đường cơ sở | Trạng thái | Xử lý yêu cầu |
| --- | --- | --- | --- | --- |
| App shell, route được bảo vệ, UX 403 | `src/app/router/index.tsx`; `src/app/router/access.ts`; `NoPermissionPage` | Bảo vệ route FE được phép như hỗ trợ UX; BE thực thi RBAC/phạm vi dữ liệu | OK | Không có blocker cho nền tảng FE. |
| Envelope API và lỗi trường | `src/shared/api/http.ts`; `src/shared/api/api-error.ts`; `src/shared/types/api-response.ts` | Envelope thành công/lỗi chuẩn với `success`, `message`, `data`, `meta`, `error_code`, `errors` | OK | Giữ tất cả dịch vụ trên `http`; không bỏ qua wrapper axios. |
| Dashboard | `src/modules/dashboard/services/dashboardService.ts`; endpoint trong `src/shared/api/endpoints.ts` | Ảnh chụp OpenAPI có `GET /reports/dashboard-quick`, không phải bốn endpoint `/dashboard/*` của FE | P1 không khớp | BE1/BA xác nhận liệu hợp đồng Dashboard là endpoint riêng lẻ hay endpoint báo cáo nhanh. ETA: trước khi FE tích hợp xong. |
| Dữ liệu Danh mục - SKU | `getSkus`, `createSku`, `updateSkuStatus`, `importSkus` trong `master-data.service.ts` | Hướng dẫn gợi ý `GET/POST /skus`; ảnh chụp OpenAPI không bao gồm `/skus` | P1 phụ thuộc | BE1 cung cấp OpenAPI route/payload/status enum/import response đã được phê duyệt. FE không nên đổi tên trường cho đến khi được xác nhận. |
| Dữ liệu Danh mục - Item | `getItems` gọi `/items` | Hướng dẫn gợi ý `/items`; ảnh chụp OpenAPI chỉ hiển thị route item price-list, không phải danh sách item master | P1 phụ thuộc | BE1/BA xác nhận endpoint Item và trường. |
| Dữ liệu Danh mục - Physical Code | `getPhysicalCodes` gọi `/physical-codes` | Hướng dẫn gợi ý `/physical-codes`; ảnh chụp OpenAPI không hiển thị nó | P1 phụ thuộc | BE1 xác nhận endpoint danh sách/phân loại code, trường trùng lặp/không xác định và mã quyền. |
| Phân loại Scan | `PhysicalCodesPage.tsx` sử dụng `mockPhysicalCodes` và `mockScanResults` | Hướng dẫn mong đợi `POST /scan-batches/classify` và các trạng thái waiting/scanned/duplicate/unknown/invalid/success/error | P0 blocker cho scan tích hợp | BE1 cung cấp endpoint/payload/mã lỗi. FE1 kết nối state machine thực tế sau khi ký hợp đồng. |
| Danh sách/chi tiết/dòng Inbound | Dịch vụ FE tồn tại dưới `src/modules/receiving`, nhưng route hoạt động `src/modules/inbound/pages/InboundPage.tsx` sử dụng `mockInboundDocs/mockInboundLines`; endpoint là `/inbound/documents` | OpenAPI hiển thị `/inbound-documents`, `/{id}`, submit/approve/post-receipt/reject/cancel | P0 blocker cho inbound tích hợp | BE1/BA quyết định đặt tên đường dẫn và payload workflow; FE1 phải thay thế trang mock bằng service/query chỉ sau khi được phê duyệt. |
| Post receipt Inbound | Không có mutation FE nào được kết nối trong trang hoạt động | Đường cơ sở yêu cầu post receipt không đổi, transaction, không mutation tồn cục bộ | P0 phụ thuộc | BE1 cung cấp hợp đồng `idempotency_key` và mã lỗi; FE1 chỉ hiển thị confirm/loading/success/error, không tính toán tồn kho trong FE. |
| Danh sách/chi tiết/dòng Outbound | Dịch vụ FE tồn tại dưới `src/modules/shipping`, nhưng route hoạt động `src/modules/outbound/pages/OutboundPage.tsx` sử dụng `mockOutboundDocs/mockOutboundLines`; endpoint là `/outbound/documents` | OpenAPI hiển thị `/outbound-documents`, `/{id}`, submit/approve/post-issue/reject/cancel | P0 blocker cho outbound tích hợp | BE1/BA quyết định đặt tên đường dẫn và payload workflow; FE1 kết nối API thực tế sau khi ký hợp đồng. |
| Post issue Outbound | Không có mutation FE nào được kết nối trong trang hoạt động | Đường cơ sở yêu cầu lock/kiểm tra lại backend để ngăn tồn kho âm | P0 phụ thuộc | FE phải hiển thị `WMS_INSUFFICIENT_STOCK` của backend hoặc tương đương; không được tính toán tồn kho cuối cùng cục bộ. |
| Putaway | Dịch vụ gọi `/putaway/tasks`, `/putaway/history`; trang hoạt động sử dụng dữ liệu mock | Kiến trúc hướng dẫn đề cập putaway chỉ gián tiếp; ảnh chụp OpenAPI không có route putaway | P2/phạm vi mở | BA/BE xác nhận liệu putaway có trong phạm vi WWHN-31 hay không. Giữ làm demo cho đến khi có hợp đồng. |
| Số dư/biến động tồn kho | `InventoryPage.tsx` sử dụng `mockInventory/mockMovements`; không có service nào được ràng buộc | OpenAPI hiển thị `/inventory/balances`; hướng dẫn cũng mong đợi biến động tồn kho | P1 blocker | BE1 xác nhận endpoint biến động, bộ lọc, phân trang, trường trạng thái đối soát. |
| Stocktake | `StocktakePage.tsx` sử dụng `mockStocktakeSessions/mockCountLines` | Hướng dẫn mong đợi sessions/count/apply-adjustment, snapshot + variance | P1 blocker | BE1/BA cung cấp endpoint, enum trạng thái, payload variance, mã lỗi/không đổi apply-adjustment. |
| Warranty | `WarrantyPage.tsx` sử dụng dữ liệu mock | Hướng dẫn mong đợi `POST /warranty-cases`, `PATCH /status`, hỗ trợ TEMP_ONLY | P1 blocker | BE1/BA cung cấp enum trạng thái, mã lỗi, quy tắc trường TEMP_ONLY, quyền. |
| Reverse | `ReversalPage.tsx` sử dụng dữ liệu mock | Hướng dẫn nói reverse thay đổi tồn kho thông qua transaction/audit backend | P1 blocker | BE1 cung cấp endpoint reverse, quy tắc tài liệu tham chiếu, không đổi, mã lỗi. |
| Reports | Dịch vụ gọi `/reports` và `/reports/xnt`; trang hoạt động sử dụng báo cáo mock | OpenAPI hiển thị `/reports/inventory-xnt`, `/reports/inventory-xnt/export-excel`, `/reports/revenue` | P1 không khớp | BE1/BA căn chỉnh report hub so với đường dẫn inventory-xnt và hành vi export. |
| Audit logs | `audit-logs.service.ts` sử dụng `http.getPage('/audit-logs')` | OpenAPI hiển thị `/audit-logs` | OK | Giữ nguyên hành vi pagination meta; đã được bao phủ bởi kiểm thử đơn vị. |

## Đánh giá Trạng thái UI

| Yêu cầu trạng thái | Bằng chứng hiện tại | Kết luận FE |
| --- | --- | --- |
| Loading | Fallback route lười sử dụng `PageSkeleton`; bảng Dữ liệu Danh mục sử dụng query loading; `Loading`/`PageSkeleton` dùng chung tồn tại | Nền tảng OK; trang mock cần query loading khi API thực được kết nối. |
| Empty | `EmptyState` dùng chung; mặc định trống `Table` Ant Design; danh mục component trình diễn trạng thái trống | OK ở cấp component; nội dung empty cụ thể module nên được thêm trong quá trình tích hợp API. |
| Error | `ErrorState`, `ApiErrorAlert`, `ErrorBoundary`, trình phân tích lỗi API dùng chung | OK ở nền tảng; Dashboard hiện thiếu hiển thị lỗi query rõ ràng và nên thêm nó với hợp đồng thực tế. |
| Success | Toast/App provider và mutation success invalidation tồn tại trong Dữ liệu Danh mục | OK khi mutation tồn tại; hành động workflow cần thông báo thành công sau khi endpoint được phê duyệt. |
| Disabled | `ActionButton` dùng chung hỗ trợ ẩn/vô hiệu theo quyền/phạm vi; nút hành động Dữ liệu Danh mục bị vô hiệu khi đang chờ/loading | OK mẫu; trang mock không được hiển thị hành động workflow hủy đã được kích hoạt trước hợp đồng. |
| Confirm | `ConfirmButton`/`ConfirmDialog` dùng chung; thay đổi trạng thái Dữ liệu Danh mục sử dụng confirm | OK cho mutation hiện tại; hành động post/apply/reverse phải sử dụng confirm sau khi hợp đồng được phê duyệt. |
| Từ chối quyền | `RequirePermission`, lọc menu, `NoPermissionPage`, `NoPermissionState`, phân loại 403 axios | OK như UX FE; backend vẫn là cơ quan có thẩm quyền. |
| Trạng thái Scan | `PhysicalCodesPage` hiển thị trực quan các trạng thái giống duplicate/unknown/invalid/success thông qua mocks | Chưa xong cho tích hợp; phải ràng buộc với `POST /scan-batches/classify` hoặc tương đương đã được phê duyệt. |

## Đánh giá RBAC

Quyền route FE hiện tại:

| Route | Cổng quyền FE | Trạng thái |
| --- | --- | --- |
| Dashboard | Người dùng đã xác thực | Cần xác nhận BA/BE nếu dashboard có hạn chế vai trò. |
| Dữ liệu Danh mục | `sku.manage` OR `master.manage` | Cần xác nhận danh mục quyền BE. |
| Scan | `inventory.trace` OR `scan.classify` | Cần xác nhận danh mục quyền BE. |
| Inbound | `inbound.create` OR `inbound.post` | Cần xác nhận danh mục quyền BE. |
| Putaway | `putaway.manage` | Cần xác nhận danh mục quyền BE hoặc loại bỏ phạm vi. |
| Outbound | `outbound.create` OR `outbound.post` | Cần xác nhận danh mục quyền BE. |
| Inventory | `inventory.view` | Cần xác nhận danh mục quyền BE. |
| Stocktake | `stocktake.count` | Cần xác nhận danh mục quyền BE. |
| Warranty | `warranty.manage` | Cần xác nhận danh mục quyền BE. |
| Reverse | `inventory.reversal.post` | Cần xác nhận danh mục quyền BE. |
| Reports | `report.view` | Cần xác nhận danh mục quyền BE. |
| Audit logs | `AUDIT_LOG_VIEW` | Bằng chứng danh mục hiện có từ nhiệm vụ trước; OK. |

Xử lý: Bảo vệ route FE có thể chấp nhận cho UX, nhưng các mã quyền WMS trên không thể được coi là đã xác minh hợp đồng cho đến khi BE trả về chúng từ `/permissions` hoặc bao gồm chúng trong đặc tả trường OpenAPI/Jira.

## Blockers và Chủ sở hữu

| ID | Mức độ | Blocker | Chủ sở hữu | ETA / Xử lý |
| --- | --- | --- | --- | --- |
| FE-CF-001 | P0 | Các trang workflow inbound/outbound/scan hoạt động sử dụng dữ liệu mock và không được kết nối với endpoint/payload workflow đã được phê duyệt. | BE1 + BA/BAS cho hợp đồng; FE1 sau khi ký duyệt | Trước khi đánh dấu tích hợp FE WWHN-31 Đã hoàn thành. |
| FE-CF-002 | P1 | Không khớp đường dẫn endpoint: hằng số FE sử dụng `/inbound/documents`, `/outbound/documents`, `/reports/xnt`, `/dashboard/*`; ảnh chụp OpenAPI sử dụng `/inbound-documents`, `/outbound-documents`, `/reports/inventory-xnt`, `/reports/dashboard-quick`. | BE1 + BA/BAS | Xác nhận đường dẫn OpenAPI v1 chuẩn; FE1 sẽ cập nhật hằng số/dịch vụ chỉ sau khi xử lý. |
| FE-CF-003 | P1 | Mã quyền WMS trong bảo vệ route không được xác nhận dựa trên danh mục quyền runtime trong bằng chứng hiện tại. | BE2/RBAC owner | Cung cấp danh mục hoặc đặc tả trường Jira; FE1 cập nhật ánh xạ/bằng chứng. |
| FE-CF-004 | P1 | Hợp đồng biến động tồn kho, apply adjustment stocktake, warranty, reverse và export báo cáo bị thiếu hoặc không được đại diện trong dịch vụ FE hiện tại. | BE1/BE2 + BA/BAS | Cung cấp endpoint, payload, xác thực, mã lỗi, dữ liệu mẫu. |
| FE-CF-005 | P2 | Trạng thái lỗi/trống query Dashboard nên được hiển thị rõ ràng khi hợp đồng cuối cùng được chọn. | FE1 | Cùng PR với tích hợp hợp đồng dashboard. |

## Ánh xạ Tiêu chí Chấp nhận

| Tiêu chí Chấp nhận | Kết quả đánh giá |
| --- | --- |
| Đầu ra "Phản hồi hợp đồng FE" đã được đánh giá/xác minh và đính kèm vào HN-TEC-001 | File này là artifact phản hồi hợp đồng FE cho HN-TEC-001. |
| UI tuân theo quy tắc nghiệp vụ, đặc tả trường, responsive và xử lý trạng thái | Nền tảng dùng chung hỗ trợ các trạng thái yêu cầu; Dữ liệu Danh mục tích hợp hiện tại tuân thủ một phần; các trang WMS mock vẫn bị chặn cho đến khi hợp đồng được phê duyệt. |
| Hiển thị quyền/RBAC và lỗi API chính xác | Nền tảng đã xác minh; mã quyền route WMS cần xác nhận danh mục BE. |
| Không có dữ liệu/quy tắc hard-code trái ngược hợp đồng | Dữ liệu mock hard-code tồn tại trong các trang WMS hoạt động; được phân loại là blocker và không được coi là tích hợp sản xuất. |
| Tích hợp endpoint/payload đã được phê duyệt; lint/build/test đạt | Tích hợp endpoint là một phần; các không khớp được liệt kê ở trên. Lint/build/test đã qua cho nhánh hiện tại. |
| BA/QA có bằng chứng; không có blocker P0/P1 nào không có xử lý | Tất cả các blocker P0/P1 đã xác định có chủ sở hữu và xử lý ở trên. |

## Nhật ký Quyết định FE

- FE1 đã không thay đổi đường dẫn API để khớp với `swagger-api.json` trong đánh giá này vì nhiệm vụ rõ ràng cấm thay đổi hợp đồng API đơn phương.
- FE1 đã không xóa các trang mock vì chúng có thể phục vụ như bằng chứng visual/UX, nhưng chúng được đánh dấu là chưa tích hợp sản xuất.
- FE1 coi React/Vite/TypeScript là đường cơ sở đã được phê duyệt theo hướng dẫn kỹ thuật; không cần di chuyển Next.js cho nhiệm vụ này.
- FE1 sẽ chỉ kết nối mutation post/apply/reverse sau khi BE cung cấp hợp đồng không đổi, xác thực, mã lỗi và quyền.

## Nhật ký Xác minh

Đã thực thi vào ngày 2026-07-29 trong `C:\ERP_HOA_NAM\Hoa_Nam_Tools`:

```text
npm.cmd run lint
Kết quả: ĐẠT

npm.cmd run build
Kết quả: ĐẠT - tsc -b và vite build đã hoàn thành

npm.cmd run test
Kết quả: ĐẠT - 32 file kiểm thử, 276 bài kiểm tra

npm.cmd run check:api-mapping -- --no-live
Kết quả: ĐẠT với cảnh báo - tài liệu ánh xạ hiện hiển thị 0 hàng endpoint trong khi `swagger-api.json` có 288 route duy nhất; bằng chứng ánh xạ cấp endpoint không đầy đủ và phải được hoàn thành trước khi đóng truy xuất hợp đồng.
```

Vì nhiệm vụ này chủ yếu là artifact đánh giá hợp đồng và các blocker hiện tại ở cấp hợp đồng, việc vượt qua lint/build/test một mình không đóng FE-CF-001 đến FE-CF-004.