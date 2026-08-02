# HN-TEC-001 - FE Contract Feedback

## Truy xuất nguồn

| Trường | Giá trị |
| --- | --- |
| Nhiệm vụ cha | WWHN-31 - [TECH] Kien truc, ERD, Tu dien du lieu va OpenAPI v1 |
| Khóa tạm thời cha | HN-TEC-001 |
| Khóa tạm thời Epic | HN-EPIC-03 |
| Phụ thuộc | HN-TEC-001-ST01 |
| Vai trò | FE1 |
| Người nhận placeholder | HN-FE-01 |
| Chủ sở hữu FE | Quang Nguyen Thanh |
| Đầu ra | FE contract feedback |
| Ngày đánh giá | 2026-07-29 |
| Nguồn baseline | `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`; `swagger-api.json`; `docs/WMS_FRONTEND_STANDARDIZATION.md`; cài đặt FE hiện tại |

## Phạm vi đánh giá

FE1 đã đánh giá hợp đồng/giao diện người dùng (UI surface) so với baseline kỹ thuật:

- Ứng dụng Web Admin React/Vite/TypeScript phải tiêu thụ các hợp đồng API đã được phê duyệt thông qua lớp API chung.
- Giao diện người dùng phải hỗ trợ các trạng thái: đang tải (loading), trống (empty), lỗi (error), thành công (success), vô hiệu hóa (disabled), xác nhận (confirm), và bị từ chối quyền truy cập (permission denied) khi có áp dụng.
- RBAC trên tuyến đường/hành động ở phía FE chỉ là cổng người dùng (UX gate); backend vẫn là nguồn quyền lực duyệt định cho quyền và phạm vi dữ liệu.
- FE không được mã hóa cứng dữ liệu sản phẩm hoặc suy diễn quy tắc tồn kho/kinh doanh ngoài hợp đồng.
- Bất kỳ bất đối xứng nào giữa hợp đồng và cài đặt FE phải được báo cho chủ sở hữu/kèm thời gian thực hiện thay vì thay đổi im lặng giao diện hoặc đường dẫn API.

## Trạng thái điều hành

| Lĩnh vực | Trạng thái FE | Xử lý |
| --- | --- | --- |
| Bọc đệm API chung/lỗi | Đã xác minh | `src/shared/api/http.ts`, `src/shared/api/axios.ts`, và `ApiEnvelopeError` bảo toàn `message`, `error_code`, trường `errors`, phân trang `meta`, phân loại lỗi 403, và ngữ cảnh yêu cầu. |
| RBAC cấp tuyến đường | Đã xác minh có lưu ý | `src/app/router/access.ts` ánh xạ các tuyến đường WMS tới mã quyền như cổng người dùng. Danh mục quyền WMS vẫn cần BE xác nhận. |
| Giao diện/nhật ký Master Data | Tích hợp một phần | Danh sách SKU/item/mã vật lý và tạo/trạng thái/nhập khẩu SKU sử dụng dịch vụ chung. Cần xác nhận OpenAPI vì bản chụp `swagger-api.json` không phơi bày `/skus`, `/items`, `/physical-codes`. |
| Giao diện/nhật ký Dashboard | Bất đối xứng hợp đồng | FE gọi `/dashboard/kpi`, `/dashboard/recent-documents`, `/dashboard/reconcile-health`, `/dashboard/alerts`; bản chụp OpenAPI phơi bày `/reports/dashboard-quick`. Cần xử lý từ BE/BA. |
| Giao diện/nhật ký Nhập/Xuất | Bất đối xứng hợp đồng và giao diện mẫu | Hằng số/dịch vụ FE sử dụng `/inbound/documents` và `/outbound/documents`, trong khi OpenAPI phơi bày `/inbound-documents` và `/outbound-documents` cùng các hành động quy trình. Các trang tuyến đường hiện tại sử dụng dữ liệu mẫu. |
| Tồn kho/Stocktake/Bảo hành/Đảo ngược/Quét/Báo cáo/Đặt hàng | Chưa tích hợp sản phẩm | Nhiều trang là bề mặt trực quan/mẫu. Chúng phải ở trạng thái chặn (blocked) khỏi Done như "giao diện tích hợp" cho đến khi endpoint, payload, xác thực, RBAC, và dữ liệu mẫu được phê duyệt. |

## Đánh giá ánh xạ hợp đồng

| Giao diện/mô-đun | Bằng chứng FE hiện tại | Kỳ vọng OpenAPI / baseline | Trạng thái | Xử lý yêu cầu |
| --- | --- | --- | --- | --- |
| Vỏ ứng dụng, tuyến đường bảo vệ, trải nghiệm 403 | `src/app/router/index.tsx`; `src/app/router/access.ts`; `NoPermissionPage` | Cổng bảo vệ tuyến đường FE được chấp nhận như công cụ UX; BE thực thi RBAC/phạm vi dữ liệu | OK | Không có chặn trở nào cho nền tảng FE. |
| Bọc đệm API và lỗi trường | `src/shared/api/http.ts`; `src/shared/api/api-error.ts`; `src/shared/types/api-response.ts` | Bọc đệm thành công/lỗi chuẩn với `success`, `message`, `data`, `meta`, `error_code`, `errors` | OK | Giữ tất cả dịch vụ trên `http`; không bỏ qua bọc axios. |
| Dashboard | `src/modules/dashboard/services/dashboardService.ts`; các endpoint trong `src/shared/api/endpoints.ts` | Bản chụp OpenAPI có `GET /reports/dashboard-quick`, không phải bốn endpoint `/dashboard/*` của FE | P1 bất đối xứng | BE1/BA xác nhận liệu Dashboard contract là các endpoint tách rời hay endpoint báo cáo nhanh. Thời gian thực hiện: trước khi FE tích hợp Done. |
| Master Data - SKU | `getSkus`, `createSku`, `updateSkuStatus`, `importSkus` trong `master-data.service.ts` | Hướng dẫn đề xuất `GET/POST /skus`; bản chụp OpenAPI không bao gồm `/skus` | P1 phụ thuộc | BE1 cung cấp route/payload/status enum/import response OpenAPI đã phê duyệt. FE không được đổi tên trường cho đến khi được xác nhận. |
| Master Data - Item | `getItems` gọi `/items` | Hướng dẫn đề xuất `/items`; bản chụp OpenAPI chỉ hiển thị các route danh sách mặt hàng của bảng giá, không phải danh sách mặt hàng chính | P1 phụ thuộc | BE1/BA xác nhận endpoint và trường của Item. |
| Master Data - Mã vật lý | `getPhysicalCodes` gọi `/physical-codes` | Hướng dẫn đề xuất `/physical-codes`; bản chụp OpenAPI không phơi bày | P1 phụ thuộc | BE1 xác nhận endpoint danh sách/phan loai mã, trường trùng lặp/không xác định, và mã quyền. |
| Phân loại quét | `PhysicalCodesPage.tsx` sử dụng `mockPhysicalCodes` và `mockScanResults` | Hướng dẫn mong đợi `POST /scan-batches/classify` và các trạng thái chờ/quét/trùng lặp/không xác định/lỗi/thành công | P0 chặn trở cho quét tích hợp | BE1 cung cấp endpoint/payload/mã lỗi. FE1 kết nối máy trạng thái thực sau khi ký hợp đồng. |
| Danh sách/chi tiết/dòng nhập hàng | Dịch vụ FE tồn tại dưới `src/modules/receiving`, nhưng tuyến đường hoạt động `src/modules/inbound/pages/InboundPage.tsx` sử dụng `mockInboundDocs/mockInboundLines`; các endpoint là `/inbound/documents` | OpenAPI phơi bày `/inbound-documents`, `/{id}`, submit/approve/post-receipt/reject/cancel | P0 chặn trở cho nhập hàng tích hợp | BE1/BA quyết định đặt tên đường dẫn và payload quy trình; FE1 phải thay thế trang mẫu bằng dịch vụ/truy vấn chỉ sau khi được phê duyệt. |
| Gửi hàng nhập (post receipt) | Không có mutation FE nào được kết nối trong trang hoạt động | Baseline yêu cầu post receipt mang tính nguyên độc, giao dịch, không gây thay đổi tồn kho địa phương | P0 phụ thuộc | BE1 cung cấp hợp đồng `idempotency_key` và mã lỗi; FE1 chỉ hiển thị xác nhận/tải/xong/lỗi, không tính toán tồn kho trong FE. |
| Danh sách/chi tiết/dòng xuất hàng | Dịch vụ FE tồn tại dưới `src/modules/shipping`, nhưng tuyến đường hoạt động `src/modules/outbound/pages/OutboundPage.tsx` sử dụng `mockOutboundDocs/mockOutboundLines`; các endpoint là `/outbound/documents` | OpenAPI phơi bày `/outbound-documents`, `/{id}`, submit/approve/post-issue/reject/cancel | P0 chặn trở cho xuất hàng tích hợp | BE1/BA quyết định đặt tên đường dẫn và payload quy trình; FE1 kết nối API thực sau khi ký hợp đồng. |
| Gửi hàng xuất (post issue) | Không có mutation FE nào được kết nối trong trang hoạt động | Baseline yêu cầu backend khóa/lại kiểm tra để ngăn tồn kho âm | P0 phụ thuộc | FE phải hiển thị `WMS_INSUFFICIENT_STOCK` hoặc tương đương từ backend; không được tính toán tồn kho cuối cùng trong FE. |
| Đặt hàng (Putaway) | Dịch vụ gọi `/putaway/tasks`, `/putaway/history`; trang hoạt động sử dụng dữ liệu mẫu | Kiến trúc hướng dẫn chỉ đề cập gián tiếp tới putaway; bản chụp OpenAPI không có route putaway nào | P2/phạm vi mở | BA/BE xác nhận liệu putaway có nằm trong phạm vi WWHN-31 không. Giữ làm demo cho đến khi có hợp đồng. |
| Số dư tồn kho/di chuyển | `InventoryPage.tsx` sử dụng `mockInventory/mockMovements`; chưa có dịch vụ kết nối | OpenAPI phơi bày `/inventory/balances`; hướng dẫn cũng mong đợi di chuyển tồn kho | P1 chặn trở | BE1 xác nhận endpoint di chuyển, bộ lọc, phân trang, trường trạng thái kiểm soát. |
| Stocktake | `StocktakePage.tsx` sử dụng `mockStocktakeSessions/mockCountLines` | Hướng dẫn mong đợi sessions/count/apply-adjustment, bản chụp + phương sai | P1 chặn trở | BE1/BA cung cấp endpoint, status enum, payload phương sai, mã lỗi/idempotency của apply-adjustment. |
| Bảo hành | `WarrantyPage.tsx` sử dụng dữ liệu mẫu | Hướng dẫn mong đợi `POST /warranty-cases`, `PATCH /status`, hỗ trợ TEMP_ONLY | P1 chặn trở | BE1/BA cung cấp status enum, mã lỗi, quy tắc trường TEMP_ONLY, mã quyền. |
| Đảo ngược | `ReversalPage.tsx` sử dụng dữ liệu mẫu | Hướng dẫn nói rằng đảo ngược thay đổi tồn kho thông qua giao dịch/phản ánh backend | P1 chặn trở | BE1 cung cấp endpoint đảo ngược, quy tắc tài liệu tham chiếu, idempotency, mã lỗi. |
| Báo cáo | Dịch vụ gọi `/reports` và `/reports/xnt`; trang hoạt động sử dụng báo cáo mẫu | OpenAPI phơi bày `/reports/inventory-xnt`, `/reports/inventory-xnt/export-excel`, `/reports/revenue` | P1 bất đối xứng | BE1/BA căn chỉnh hub báo cáo vs đường dẫn inventory-xnt và hành vi xuất khẩu. |
| Nhật ký kiểm toán | `audit-logs.service.ts` sử dụng `http.getPage('/audit-logs')` | OpenAPI phơi bày `/audit-logs` | OK | Giữ hành vi phân trang meta; đã được kiểm thử đơn vị. |

## Đánh giá trạng thái giao diện

| Yêu cầu trạng thái | Bằng chứng hiện tại | Kết luận FE |
| --- | --- | --- |
| Đang tải (Loading) | Fallback lazy route sử dụng `PageSkeleton`; bảng Master Data sử dụng query loading; tồn tại `Loading`/`PageSkeleton` chung | Nền tảng ổn định; các trang mẫu cần query loading khi kết nối API thực. |
| Trống (Empty) | `EmptyState` chung; mặc định `Table` của Ant Design empty; danh mục thành phần trình diễn trạng thái trống | Ổn định ở cấp thành phần; bản sao trống riêng cho từng mô-đun nên thêm khi tích hợp API. |
| Lỗi (Error) | `ErrorState`, `ApiErrorAlert`, `ErrorBoundary`, parser lỗi API chung | Ổn định ở nền tảng; Dashboard hiện thiếu render lỗi query rõ ràng và nên thêm khi có hợp đồng thực. |
| Thành công (Success) | Toast/App provider và mutation success invalidation tồn tại trong Master Data | Ổn định nơi có mutation; các hành động quy trình cần thông báo thành công sau khi endpoint được phê duyệt. |
| Vô hiệu hóa (Disabled) | `ActionButton` chung hỗ trợ ẩn/vô hiệu hóa theo quyền/phạm vi; nút hành động Master Data vô hiệu hóa trong khi đang chờ/tải | Mẫu ổn định; các trang mẫu không được hiển thị hành động phá hoại bật trước khi có hợp đồng. |
| Xác nhận (Confirm) | `ConfirmButton`/`ConfirmDialog` chung; thay đổi trạng thái Master Data sử dụng confirm | Ổn định cho mutation hiện tại; các hành động post/apply/reverse phải dùng confirm sau khi hợp đồng được phê duyệt. |
| Bị từ chối quyền truy cập | `RequirePermission`, lọc menu, `NoPermissionPage`, `NoPermissionState`, phân loại lỗi 403 axios | Ổn định như cổng UX FE; backend vẫn là nguồn quyền lực. |
| Trạng thái quét | `PhysicalCodesPage` hiển thị trực quan trùng lặp/không xác định/lỗi/thành công thông qua dữ liệu mẫu | Chưa hoàn thành tích hợp; phải kết nối tới `POST /scan-batches/classify` hoặc endpoint đã phê duyệt. |

## Đánh giá RBAC

Quyền truy cập tuyến đường FE hiện tại:

| Tuyến đường | Cổng quyền FE | Trạng thái |
| --- | --- | --- |
| Dashboard | Người dùng đã xác thực | Cần xác nhận từ BA/BE nếu dashboard có hạn chế vai trò. |
| Master Data | `sku.manage` HOẶC `master.manage` | Cần xác nhận danh mục quyền BE. |
| Quét | `inventory.trace` HOẶC `scan.classify` | Cần xác nhận danh mục quyền BE. |
| Nhập hàng | `inbound.create` HOẶC `inbound.post` | Cần xác nhận danh mục quyền BE. |
| Đặt hàng | `putaway.manage` | Cần xác nhận danh mục quyền BE hoặc xóa phạm vi. |
| Xuất hàng | `outbound.create` HOẶC `outbound.post` | Cần xác nhận danh mục quyền BE. |
| Tồn kho | `inventory.view` | Cần xác nhận danh mục quyền BE. |
| Stocktake | `stocktake.count` | Cần xác nhận danh mục quyền BE. |
| Bảo hành | `warranty.manage` | Cần xác nhận danh mục quyền BE. |
| Đảo ngược | `inventory.reversal.post` | Cần xác nhận danh mục quyền BE. |
| Báo cáo | `report.view` | Cần xác nhận danh mục quyền BE. |
| Nhật ký kiểm toán | `AUDIT_LOG_VIEW` | Bằng chứng từ nhiệm vụ trước; OK. |

**Xử lý:** Cổng bảo vệ tuyến đường FE là chấp nhận được cho UX, nhưng các mã quyền WMS ở trên không thể coi là đã xác minh hợp đồng cho đến khi BE trả về chúng từ `/permissions` hoặc đưa vào OpenAPI/Jira field specification.

## Chặn trở và người chịu trách nhiệm

| Mã | Mức độ | Chặn trở | Người chịu trách nhiệm | ETA / Xử lý |
| --- | --- | --- | --- | --- |
| FE-CF-001 | P0 | Các trang quy trình nhập/xuất/quét hoạt động sử dụng dữ liệu mẫu và chưa kết nối tới endpoint/payload quy trình đã phê duyệt. | BE1 + BA/BAS cho hợp đồng; FE1 sau khi ký | Trước khi đánh dấu WWHN-31 tích hợp FE Done. |
| FE-CF-002 | P1 | Bất đối xứng đường dẫn endpoint: hằng số FE sử dụng `/inbound/documents`, `/outbound/documents`, `/reports/xnt`, `/dashboard/*`; bản chụp OpenAPI sử dụng `/inbound-documents`, `/outbound-documents`, `/reports/inventory-xnt`, `/reports/dashboard-quick`. | BE1 + BA/BAS | Xác nhận đường dẫn OpenAPI v1 chuẩn; FE1 sẽ cập nhật hằng số/dịch vụ chỉ sau khi có xử lý. |
| FE-CF-003 | P1 | Các mã quyền WMS trong cổng bảo vệ chưa được xác nhận chống lại danh mục quyền thời gian chạy trong bằng chứng hiện tại. | BE2/Chủ sở hữu RBAC | Cung cấp danh mục hoặc Jira field spec; FE1 cập nhật ánh xạ/bằng chứng. |
| FE-CF-004 | P1 | Hợp đồng cho di chuyển tồn kho, áp dụng điều chỉnh stocktake, bảo hành, đảo ngược, và xuất khẩu báo cáo bị thiếu hoặc chưa có trong dịch vụ FE hiện tại. | BE1/BE2 + BA/BAS | Cung cấp endpoint, payload, xác thực, mã lỗi, dữ liệu mẫu. |
| FE-CF-005 | P2 | Trạng thái lỗi/trống của Dashboard query nên được render rõ ràng khi hợp đồng cuối cùng được chọn. | FE1 | Cùng PR với tích hợp hợp đồng Dashboard. |

## Ánh xạ tiêu chí chấp nhận

| Tiêu chí chấp nhận | Kết quả đánh giá |
| --- | --- |
| Đầu ra "FE contract feedback" được đánh giá/xác minh và đính kèm vào HN-TEC-001 | Tệp này chính là artifact phản hồi hợp đồng FE cho HN-TEC-001. |
| Giao diện tuân theo quy tắc kinh doanh, field specification, responsive, và xử lý trạng thái | Nền tảng chung hỗ trợ các trạng thái yêu cầu; Master Data đã tích hợp một phần tuân thủ; các trang WMS mẫu vẫn bị chặn cho đến khi hợp đồng được phê duyệt. |
| Quyền/RBAC và lỗi API hiển thị đúng | Nền tảng đã xác minh; mã quyền tuyến đường WMS cần xác nhận danh mục BE. |
| Không có dữ liệu/quy tắc mã hóa cứng trái với hợp đồng | Dữ liệu mẫu mã hóa cứng tồn tại trong các trang WMS hoạt động; được phân loại là chặn trở và không được coi là tích hợp sản phẩm. |
| Tích hợp endpoint/payload đã phê duyệt; lint/build/test đạt | Tích hợp endpoint là một phần; các bất đối xứng liệt kê ở trên. Lint/build/test đã vượt qua cho nhánh hiện tại. |
| BA/QA có bằng chứng; không có chặn trở P0/P1 ngoài xử lý | Tất cả chặn trở P0/P1 đã có người chịu trách nhiệm và xử lý ở trên. |

## Nhật ký quyết định FE

- FE1 không thay đổi đường dẫn API để khớp với `swagger-api.json` trong lần đánh giá này vì nhiệm vụ này cấm thay đổi hợp đồng API một cách đơn phương.
- FE1 không xóa các trang mẫu vì chúng có thể phục vụ như bằng chứng trực quan/UX, nhưng chúng được đánh dấu là chưa tích hợp sản phẩm.
- FE1 coi React/Vite/TypeScript là baseline đã phê duyệt theo hướng dẫn kỹ thuật; không yêu cầu chuyển đổi Next.js cho nhiệm vụ này.
- FE1 chỉ kết nối mutation post/apply/reverse sau khi BE cung cấp hợp đồng idempotency, xác thực, mã lỗi, và quyền.

## Nhật ký xác minh

Thực hiện vào ngày 2026-07-29 tại `C:\ERP_HOA_NAM\Hoa_Nam_Tools`:

```text
npm.cmd run lint
Kết quả: PASS

npm.cmd run build
Kết quả: PASS - tsc -b và vite build hoàn tất

npm.cmd run test
Kết quả: PASS - 32 tệp test, 276 test

npm.cmd run check:api-mapping -- --no-live
Kết quả: PASS với cảnh báo - tài liệu mapping hiện chỉ hiển thị 0 hàng endpoint trong khi `swagger-api.json` có 288 route duy nhất; bằng chứng ánh xạ endpoint cấp độ chưa hoàn chỉnh và phải hoàn thành trước khi đóng truy xuất hợp đồng.
```

Vì nhiệm vụ này chủ yếu là artifact đánh giá hợp đồng và các chặn trở hiện tại là ở cấp hợp đồng, việc vượt qua lint/build/test không đơn thuần đóng FE-CF-001 đến FE-CF-004.

## Phụ lục xử lý review mới nhất - 2026-08-01

Nguồn Jira đã kiểm tra:

- Jira task: WWHN-153 - `[FE1] Rà soát ánh xạ contract/UI`
- Trạng thái Jira khi kiểm tra: `In Progress`
- Assignee: Quang Nguyễn Thanh
- Cập nhật Jira mới nhất được Atlassian trả về: `2026-08-01T18:43:55.935+0700`

### Kết luận P0/P1 sau rà soát sâu

| Mã | Mức độ | Trạng thái sau xử lý | Bằng chứng / disposition |
| --- | --- | --- | --- |
| FE-CF-001 | P0 | Đã xử lý phần thuộc FE; không còn dùng route mock cho nhập/xuất/quét | `src/modules/inbound/pages/InboundPage.tsx` và `src/modules/outbound/pages/OutboundPage.tsx` đã re-export sang page tích hợp thật `ReceivingPage`/`ShippingPage`; service dùng `GET /inbound-documents`, `GET /outbound-documents`, `POST /scan-batches/classify`. |
| FE-CF-001 | P0 | Đã khóa action nguy hiểm khi chưa đủ payload/idempotency | Nút ghi nhận tiếp trong `ReceivingPage` và `ShippingPage` đã disabled; action post receipt/post issue chỉ tồn tại ở service với `Idempotency-Key`/`If-Match`, không còn bị trình bày như thao tác đã sẵn sàng trên UI. |
| FE-CF-001 | P0 | Đã bổ sung phản hồi lỗi FE cho luồng nhập/xuất | `ReceivingPage` và `ShippingPage` hiển thị `Alert` khi lỗi danh sách hoặc lỗi tải dòng chứng từ, đồng thời giữ loading riêng cho drawer/modal dòng. |
| FE-CF-002 | P1 | Đã căn chỉnh endpoint canonical trong FE | `API_ENDPOINTS` dùng `/inbound-documents`, `/outbound-documents`, `/reports/inventory-xnt`, `/reports/inventory-xnt/export-excel`, `/reports/dashboard-quick`; service tương ứng đã tiêu thụ các constant này. |
| FE-CF-003 | P1 | Có disposition, chưa đóng hoàn toàn vì cần BE/RBAC sign-off | Route-level permission vẫn là UX gate trong `src/app/router/access.ts`; danh mục quyền runtime cần BE2/chủ sở hữu RBAC xác nhận qua `/permissions` hoặc OpenAPI/Jira field spec. Không tự đổi quyền trong FE. |
| FE-CF-004 | P1 | Đã xử lý phần có contract/service; còn dependency ngoại vi cho sign-off cuối | Inventory, stock movements, stocktake, warranty, reversal và reports đã có service thật thay cho mock chính. Các mutation nhạy cảm như apply adjustment/reverse/status transition chỉ được gọi qua service có idempotency khi contract đủ dữ liệu. |

### Điều chỉnh code thực hiện trong lượt này

- `src/modules/receiving/pages/ReceivingPage.tsx`: thêm trạng thái lỗi danh sách/dòng phiếu, loading riêng cho dòng phiếu, và disabled action ghi nhận tiếp khi UI chưa có payload xác nhận hợp lệ.
- `src/modules/shipping/pages/ShippingPage.tsx`: thêm xử lý tương tự cho outbound để tránh nuốt lỗi API và tránh mở thao tác post issue khi contract idempotency chưa được nhập từ luồng nghiệp vụ.

### Kiểm tra lại

Thực hiện tại `C:\HoaNamFE\Hoa_Nam_Tools` ngày 2026-08-01:

```text
npm.cmd run lint
Kết quả: PASS

npm.cmd run build
Kết quả: PASS - tsc -b và vite build hoàn tất
Lưu ý: Vite cảnh báo `configLoader: native` tương lai không hỗ trợ `__dirname` trong vite.config.ts; cảnh báo này không phát sinh từ thay đổi P0/P1.

npm.cmd run test -- --run
Kết quả: PASS - 35 tệp test, 297 test
Lưu ý: Vitest hiển thị cùng cảnh báo `configLoader: native` tại `vitest.config.ts`; không phát sinh từ thay đổi P0/P1.
```

### Trạng thái bàn giao

- Không còn P0/P1 thuộc phạm vi FE mà chỉ có trạng thái "chưa có disposition".
- Các P0/P1 còn phụ thuộc BE/BA/RBAC đã có owner và điều kiện đóng rõ: contract endpoint/payload, idempotency, error code, permission catalog và sample data được phê duyệt.
- FE không tự suy diễn nghiệp vụ tồn kho, không tự tính post receipt/post issue/apply adjustment/reverse trên client, và không thay đổi API contract ngoài các endpoint canonical đã được source hiện tại xác nhận.

## Phụ lục xử lý review mới nhất - 2026-08-02

Nguồn Jira đã kiểm tra:

- Jira task: WWHN-153 - `[FE1] Rà soát ánh xạ contract/UI`
- Review mới nhất: `2026-08-02T00:07:34.903+0700`
- Đánh giá mới nhất: **Chưa đạt yêu cầu - 70/100 (70%)**
- Trạng thái Jira khi kiểm tra: `In Progress`

### P0/P1 disposition theo review 2026-08-02

| ID | Mức | Nội dung review | Xử lý FE1 / disposition |
| --- | --- | --- | --- |
| WWHN-153-P0-20260802-01 | P0 | Contract nguồn WWHN-31 chưa hoàn tất; cần OpenAPI/schema/version/hash chính thức và QA1 review constraints/error/testability. | FE không được tự final. Code hiện chỉ dùng endpoint canonical đã có trong constants/test guard; các endpoint chưa có contract hoặc còn legacy bị chặn/ghi rõ conditional. Điều kiện đóng: BE1/BE2 phát hành OpenAPI v1 có version/hash, QA1 comment pass/fail constraints/error/testability. |
| WWHN-153-P0-20260802-02 | P0 | Final FE sign-off chưa hợp lệ khi chưa có BE contract và BA/QA gate độc lập. | FE1 giữ trạng thái **conditional pass, not final sign-off**. Tài liệu này là feedback/disposition, không phải nghiệm thu cuối. Điều kiện đóng: BE/BA/QA gate có xác nhận độc lập trên Jira hoặc artifact versioned. |
| WWHN-153-P1-20260802-01 | P1 | `ROUTE_PERMISSIONS` vẫn là UX gate tự map; cần đồng bộ backend permission catalog. | `src/app/router/access.ts` giữ mapping rõ ràng và test bảo vệ trong `src/test/wms-contract-signoff-guards.test.ts`. Không tự đổi quyền. Điều kiện đóng: BE/RBAC cung cấp `/permissions` hoặc catalog versioned, BA duyệt mapping. |
| WWHN-153-P1-20260802-02 | P1 | Scan/Post Receipt/Post Issue/Apply Adjustment chưa đủ sign-off endpoint, payload, error code, idempotency, permission, sample response. | FE đã có guard payload/idempotency/If-Match/evidence cho `POST /scan-batches/classify`, post receipt, post issue, apply adjustment. UI không mở action mutation nguy hiểm khi chưa có đủ payload nghiệp vụ. Điều kiện đóng: BE/BA/QA cung cấp sample response/error code/permission chính thức và QA chạy negative/RBAC/idempotency. |
| WWHN-153-P1-20260802-03 | P1 | BE confirmation trên Jira còn yếu, chưa thay cho OpenAPI/Postman/version/hash/reviewer độc lập. | FE ghi nhận comment BE ngày `2026-08-01T18:43:55.935+0700` chỉ là tín hiệu phối hợp, không dùng làm final contract evidence. Điều kiện đóng: BE đính kèm OpenAPI/Postman/version/hash hoặc link artifact được reviewer độc lập xác nhận. |
| WWHN-153-P1-20260802-04 | P1 | QA2/BA gate chưa chạy: WWHN-182 happy/negative/RBAC/idempotency/retry; WWHN-183 G1 minutes Go/No-Go. | FE chưa thể tự đóng gate QA/BA. Điều kiện đóng: QA2/BA comment kết quả hoặc link evidence/gate minutes; FE sẽ cập nhật lại status final theo gate đó. |

### Điều chỉnh code bổ sung trong lượt 2026-08-02

- `src/modules/scan/services/scanService.ts`: chặn `fetchPhysicalCodes()` bằng `WMS_FE_CONTRACT_NOT_APPROVED` thay vì gọi legacy `/physical-codes`. Việc này xử lý phần P1 “endpoint physical-code chưa có OpenAPI/sign-off” bằng cách không để FE tạo network call hoặc evidence giả.
- `src/test/wms-contract-signoff-guards.test.ts`: thêm regression test xác nhận physical-code list bị blocked trước network; giữ scan classify, post receipt, post issue, apply adjustment và route permission dưới contract guard.

### Trạng thái bàn giao sau xử lý P0/P1

- Không còn P0/P1 thuộc phạm vi FE mà bị bỏ trống disposition.
- FE đã loại bỏ hành vi nguy hiểm nhất: gọi legacy physical-code endpoint chưa duyệt, tự mở mutation stock-affecting khi thiếu idempotency/evidence, hoặc coi route permission FE là RBAC source of truth.
- Các mục còn lại là **external sign-off dependency**, không phải code-only fix: OpenAPI/schema/version/hash, permission catalog runtime, sample response/error code, QA2 test pass, BA Go/No-Go.
