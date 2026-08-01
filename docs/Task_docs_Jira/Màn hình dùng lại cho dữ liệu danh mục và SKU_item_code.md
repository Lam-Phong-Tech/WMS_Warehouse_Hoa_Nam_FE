# WWHN-39 - Màn hình dùng lại cho dữ liệu danh mục và SKU/item/code

## 1. Traceability Jira

| Trường | Giá trị |
| --- | --- |
| Jira | WWHN-39 |
| Tiêu đề | [FE] Màn hình dùng lại cho dữ liệu danh mục và SKU/item/code |
| Loại issue | Story |
| Trạng thái Jira lúc đọc | In Progress |
| Priority | High |
| Assignee | Quang Nguyễn Thanh |
| Owner role | FE1 |
| Contract Item | PL01-04 |
| Epic Temp Key | HN-EPIC-04 |
| BA Pin | HN-PIN-04 |
| Sources | 08_DATA_API_UI_TECHNICAL_HANDOFF; HoaNam_Handoff_v3_9 |
| Dependencies | HN-UX-002; HN-FND-002; HN-MC-001 |
| Output | Master/SKU màn hình; Import UI; Responsive/RBAC evidence |
| Task con triển khai liên quan | WWHN-178 - [FE1] Triển khai UI dữ liệu danh mục/SKU/import |
| Task QA liên quan | WWHN-179 - [QA2] UI/validation/responsive tests |

## 2. Diễn giải yêu cầu từ Jira

Jira yêu cầu FE triển khai một màn hình dùng lại cho nhóm dữ liệu master và SKU/item/code. Phạm vi không chỉ là render bảng danh sách; màn hình phải xử lý đủ vòng đời thao tác thường gặp của dữ liệu danh mục: danh sách, tìm kiếm, bộ lọc, phân trang, chi tiết, tạo/sửa hoặc bật/tắt theo quyền, trạng thái import, trạng thái lỗi API, và evidence để BA/QA nghiệm thu.

Các phần quan trọng trong Description cần được hiểu như sau:

| Mục Jira | Diễn giải triển khai FE |
| --- | --- |
| CRUD/danh sách/bộ lọc/chi tiết | Cần có cùng một pattern UI cho category, SKU/product, item và physical code, trong đó mỗi entity cấu hình cột, filter, detail fields, endpoint note và permission note riêng. |
| Master và SKU/item/code bằng component dùng lại | Không copy/paste từng màn hình rời; phải có cấu trúc config-driven để tái sử dụng table, search, filter, pagination, detail drawer và state error. |
| Input: HN-UX-002 | UI phải bám pattern UX của hệ thống: table thao tác được, form rõ field bắt buộc, modal/drawer cho create/detail, responsive không vỡ layout. |
| Input: HN-FND-002/HN-MC-001 APIs | FE chỉ gọi endpoint/payload đã duyệt. Nếu OpenAPI thiếu endpoint thì phải khóa hoặc ghi blocker, không tự suy diễn contract. |
| Input: Import template | FE cần có hành vi tải template/import UI; riêng import chỉ được bật khi BE publish endpoint/payload/response chính thức. |
| Acceptance Criteria 1 | Field visibility/editability/validation phải theo spec và RBAC. FE không được hard-code rule trái contract. |
| Acceptance Criteria 2 | Search/filter/pagination/detail/active-inactive phải usable trên màn hình thật. |
| Acceptance Criteria 3 | Import phải hiển thị row-level error và không quyết định partial write ngoài rule backend. |
| Acceptance Criteria 4 | Loading/empty/403/409/422/network phải có trạng thái UI rõ ràng. |

## 3. Phạm vi triển khai hiện tại trong repo

Màn hình chính nằm tại `src/modules/master-data/pages/MasterPage.tsx`. Code hiện tại đã đi theo hướng config-driven bằng `MasterEntityConfig`, dùng chung `MasterEntityPanel` cho các tab và dùng chung `useTablePattern` để chuẩn hóa page, page size, search, filters và sort.

| Entity/tab | Trạng thái FE | Endpoint contract hiện tại | Ghi chú |
| --- | --- | --- | --- |
| Danh mục sản phẩm | Đã có list, search, status filter, detail drawer, create modal | `GET/POST /product-categories` | Dùng thêm category options cho form SKU. |
| Sản phẩm / SKU | Đã có list, search, status filter, sort, pagination, detail drawer, create modal, active/inactive action | `GET/POST/PATCH /products`; `PATCH /products/:id/enable`; `PATCH /products/:id/disable` | Đây là canonical contract thay cho legacy `/skus`. |
| Item | UI tab có cấu hình cột/detail/filter nhưng query mặc định bị khóa | `/items` không có trong OpenAPI 3.0.0 | Không gọi API để tránh contract mismatch. |
| Mã vật lý | UI tab có cấu hình cột/detail/filter nhưng query mặc định bị khóa | `/physical-codes` không có trong OpenAPI 3.0.0 | Không gọi API để tránh contract mismatch. |
| Import SKU | Có tải template CSV; nút import bị disable kèm tooltip | `/skus/import-excel` không có trong OpenAPI 3.0.0 | Không gửi request import cho đến khi BE publish contract. |

## 4. Component dùng lại

Pattern dùng lại chính:

| Thành phần | Vai trò |
| --- | --- |
| `MasterEntityConfig<T>` | Khai báo metadata cho từng entity: key, label, endpoint note, permission note, columns, query, filters, detail fields, empty text và action phụ. |
| `MasterEntityPanel<T>` | Render search, filters, reset filter, page size selector, table, pagination, loading, empty, API error và action xem chi tiết bằng cùng một layout. |
| `DetailField<T>` | Chuẩn hóa detail drawer theo từng entity mà không tạo drawer riêng cho từng loại dữ liệu. |
| `buildParams()` | Chuyển state table dùng chung thành params API: `page`, `per_page`, `search`, `sort_by`, `sort_direction`, filters. |
| `errorAlert()` | Chuẩn hóa trạng thái 403/error: message, HTTP status, error code, request id nếu backend trả về. |
| `ImportResultModal` | Chuẩn hóa hiển thị tổng import, số dòng hợp lệ/lỗi, inserted/updated, partial write và row-level error. Hiện chưa bật runtime vì thiếu endpoint import chính thức. |

Điểm quan trọng: component dùng lại không được làm mất ranh giới contract. Với entity có contract thật, query/mutation được bật. Với entity chưa có contract, UI ghi rõ trạng thái chờ BE và service ném lỗi cục bộ thay vì gửi request.

## 5. API contract và ranh giới không suy diễn

OpenAPI hiện tại được các tài liệu P1 trong repo xác nhận là OpenAPI `3.0.0`, `220` paths. Mapping đang dùng:

| Nhu cầu | Endpoint | Trạng thái | Quyết định FE |
| --- | --- | --- | --- |
| Danh sách/tạo Product/SKU | `/products` | Có contract | Dùng làm source of truth cho tab Sản phẩm/SKU. |
| Bật/tắt Product/SKU | `/products/:id/enable`, `/products/:id/disable` | Có contract | Action active/inactive gửi qua mutation `updateProductStatus`. |
| Danh mục sản phẩm | `/product-categories` | Có contract | Dùng cho list/create category và dropdown category. |
| Đơn vị tính | `/uoms` | Có contract | Dùng dropdown tham chiếu, query `per_page=100`, `status=1`. |
| Nhà cung cấp | `/suppliers` | Có contract | Dùng dropdown tham chiếu, query `per_page=100`, `status=1`. |
| Legacy SKU | `/skus` | Chưa có trong OpenAPI hiện tại | Không dùng trong production path. |
| Import SKU | `/skus/import-excel` | Chưa có trong OpenAPI hiện tại | Disable UI import, service `importSkus()` ném lỗi cục bộ. |
| Item | `/items` | Chưa có trong OpenAPI hiện tại | `useItems(..., enabled=false)` mặc định, service không gửi HTTP. |
| Physical code | `/physical-codes` | Chưa có trong OpenAPI hiện tại | `usePhysicalCodes(..., enabled=false)` mặc định, service không gửi HTTP. |

Ràng buộc từ Jira: nếu thiếu input/dependency phải comment blocker kèm owner và ETA. Vì vậy phần Item, Physical Code và Import không nên được đánh dấu Done hoàn toàn nếu BA/BE chưa publish baseline contract. FE đã xử lý đúng hướng an toàn: không tự mở rộng scope và không gọi API ngoài hợp đồng.

## 6. Field specification Product/SKU đang nhận trách nhiệm

| UI field | API field | Validation FE hiện tại | Ghi chú nghiệm thu |
| --- | --- | --- | --- |
| Mã SP | `product_code` | Bắt buộc | Cần kiểm tra duplicate/409 từ backend. |
| Barcode | `barcode` | Tùy chọn | Placeholder cho phép bỏ trống nếu hệ thống tự sinh. |
| Tên sản phẩm | `name` | Bắt buộc | Hiển thị đậm ở bảng và detail. |
| Mô tả | `description` | Tùy chọn | TextArea 2 dòng. |
| Nhà cung cấp | `supplier_id` | Tùy chọn | Dropdown lấy từ `/suppliers`. |
| Danh mục | `category_id` | Tùy chọn | Dropdown lấy từ `/product-categories`. |
| Đơn vị tính | `uom_id` | Bắt buộc | Dropdown lấy từ `/uoms`. |
| Giá niêm yết chưa VAT | `list_price_net` | Bắt buộc, số nguyên, min 0 | Format hàng nghìn trên input. |
| Thuế VAT | `vat_rate` | Bắt buộc, enum `0`, `5`, `8`, `10` | Default `8`. |
| Trạng thái | `status` | Bắt buộc, enum `active`, `inactive`, `discontinued` | Default `active`; action hiện chuyển active/inactive. |

Field category đang nhận trách nhiệm:

| UI field | API field | Validation FE hiện tại |
| --- | --- | --- |
| Mã danh mục | `code` | Bắt buộc |
| Tên danh mục | `name` | Bắt buộc |
| Danh mục cha | `parent_id` | Tùy chọn |
| Thứ tự | `sort_order` | Tùy chọn, min 0, default 0 |
| Trạng thái | `status` | Default `1`, enum `1/0` |

## 7. RBAC và quyền thao tác

FE dùng `useHasPermission()` để xác định `canManageMasterData`. Người dùng được thao tác create/status khi có ít nhất một quyền:

| Permission | Ảnh hưởng UI |
| --- | --- |
| `sku.manage` | Cho phép tạo SKU/product và bật/tắt trạng thái. |
| `master.manage` | Cho phép tạo SKU/product, tạo category và bật/tắt trạng thái. |

Các hành vi cần QA xác nhận:

| Trường hợp | Kỳ vọng |
| --- | --- |
| User thiếu cả `sku.manage` và `master.manage` | Nút tạo sản phẩm, tạo danh mục và action active/inactive bị disable. |
| Backend trả 403 dù UI cho phép | Hiển thị warning "Không có quyền truy cập dữ liệu" và giữ HTTP status/error code/request id nếu có. |
| Backend trả lỗi khác | Hiển thị error message từ `getApiErrorMessage()`, không nuốt lỗi. |

Lưu ý nghiệm thu: UI disabled không thay thế bằng chứng RBAC backend. QA/BE vẫn cần evidence request API trực tiếp trả 403 đúng permission/data-scope.

## 8. Search, filter, pagination, detail

| Chức năng | Hiện trạng | Cần kiểm QA |
| --- | --- | --- |
| Search | `Input.Search` cập nhật `table.search` và được map vào params `search`. | Network request gửi đúng `search`, không reset sai page/page size. |
| Filter | Select filter theo config từng tab, ví dụ status/category/code type/duplicate flag. | Filter được map vào query params, clear filter hoạt động. |
| Sort | Table sorter map thành `sort_by`/`sort_direction`, riêng product service đổi thành `sort=-field` khi desc. | Backend nhận đúng format canonical cho `/products`. |
| Page size | Cho phép `15`, `20`, `50`, `100`; nếu state ngoài range thì reset về `15`. | Không vỡ layout, total hiển thị đúng. |
| Pagination | Ant Design Table dùng `current`, `pageSize`, `total` từ query meta. | Chuyển trang gửi đúng `page` và `per_page`. |
| Detail | Drawer 520px, field theo config từng entity. | Drawer hiển thị đủ field quan trọng và đóng/mở ổn ở mobile/tablet. |
| Empty | Empty text riêng theo entity. | Khi data rỗng không hiển thị lỗi giả. |
| Loading | Table loading theo `isLoading || isFetching`. | Không có layout shift nặng khi refresh. |

## 9. Import UI và row-level error

Jira yêu cầu import hiển thị row-level error và không ghi partial ngoài rule. Code hiện có `ImportResultModal` đã chuẩn bị đúng shape UX:

| Nhóm dữ liệu import | Field hiển thị |
| --- | --- |
| Summary | `total_rows`, `valid_rows`, `error_rows`, `inserted_rows`, `updated_rows`, `partial_write` |
| Row-level error | `row`, `field`, `code`, `value`, `message` |
| Contract note | UI chỉ hiển thị kết quả backend; rule partial write/rollback thuộc backend HN-MC-001. |

Tuy nhiên endpoint `/skus/import-excel` chưa có trong OpenAPI hiện tại, nên import runtime đang bị khóa. Đây là quyết định đúng với Description: "không tự suy diễn quy tắc nghiệp vụ hay sửa API contract".

Điều kiện để bật import:

| Dependency | Chủ sở hữu | Nội dung cần chốt |
| --- | --- | --- |
| Endpoint import chính thức | BE1/BE2 | Path, method, content type, file field name, auth/RBAC. |
| Payload/response | BE1/BE2 | Summary fields, row error shape, request id, import id. |
| Rule partial write | BA/BAS + BE | Dry-run/commit, rollback toàn bộ hay ghi một phần, xử lý duplicate. |
| Template | BA/BAS + BE | Header bắt buộc, enum hợp lệ, sample rows, version template. |
| Error mapping | BE + QA | 400/403/409/422/network, field-level errors và row-level errors. |

## 10. Acceptance Criteria mapping

| AC từ Jira | Trạng thái FE | Evidence cần có |
| --- | --- | --- |
| Field visibility/editability/validation đúng spec và RBAC | Product/category đã có validation cơ bản và RBAC UI; Item/code/import chờ contract | Screenshot form validation, role thiếu quyền, backend 403. |
| Search/bộ lọc/pagination/detail/active-inactive usable | Đã có pattern dùng chung trên Product/category; active/inactive cho Product | Screenshot + network capture query params và mutation status. |
| Import hiển thị row-level error và không ghi partial ngoài rule | Modal đã chuẩn bị; runtime import bị disable vì thiếu endpoint | Screenshot nút import disable; khi BE có endpoint cần evidence import lỗi dòng. |
| Loading/empty/403/409/422/network trạng thái pass | Table loading/empty và `errorAlert()` đã có; form set field errors từ API | Evidence mock/API thật cho 403, 409, 422, network. |
| Không hard-code dữ liệu hoặc rule trái contract | FE chuyển sang canonical `/products`; khóa endpoint thiếu contract | Evidence OpenAPI và source mapping. |
| Lint/build/test phù hợp pass | Tài liệu P1 liên quan ghi nhận `yarn lint/test/build` pass ngày 2026-08-01 | Cần rerun nếu có thay đổi code sau tài liệu này. |

## 11. Checklist QA/BA cần chạy cho WWHN-39

| Khu vực | Test sâu cần chạy |
| --- | --- |
| Trace build/env | Ghi browser, viewport, base URL, API env, user role, commit/build id. |
| Responsive | Kiểm tra desktop 1920/1366, tablet 1024/768, mobile nếu route hỗ trợ; table scroll không che action/detail. |
| Category list | Search mã/tên, filter status, pagination, empty, loading, detail drawer. |
| Category create | Submit trống, tạo hợp lệ, duplicate/422 nếu backend trả, refresh list sau create. |
| Product/SKU list | Search code/name, filter status, sort code/name/status, pagination 15/20/50/100. |
| Product/SKU create | Validate required fields; dropdown supplier/category/uom load đúng; submit success invalidate query. |
| Product/SKU status | Active -> inactive và inactive -> active có confirm; user thiếu quyền không thao tác được. |
| API errors | 403 warning; 409 duplicate; 422 field-level errors; network timeout/offline; request id hiển thị nếu có. |
| Import disabled | Nút Import SKU bị disable, tooltip nêu rõ thiếu `/skus/import-excel`, network không có request import. |
| Item/code contract boundary | Tab Item/Physical Code không gửi request `/items` hoặc `/physical-codes`; UI ghi rõ chờ BE publish OpenAPI. |
| Evidence | Screenshot, network HAR hoặc ảnh network, response body lỗi, fixture role/permission. |

## 12. Blocker và disposition

| Blocker | Mức ảnh hưởng | Owner đề xuất | Disposition |
| --- | --- | --- | --- |
| `/skus/import-excel` không có trong OpenAPI | Chặn import runtime và row-level error thật | BE1/BE2 + BA/BAS | FE disable import, không gửi request; bật lại sau khi contract được publish. |
| `/items` không có trong OpenAPI | Chặn danh sách/detail/filter item thật | BE1/BE2 + BA/BAS | FE giữ tab read-only/blocked, không gọi API. |
| `/physical-codes` không có trong OpenAPI | Chặn danh sách/detail/filter physical code thật trong Master Data | BE1/BE2 + BA/BAS | FE giữ tab read-only/blocked, không gọi API; luồng scan classify riêng nằm ngoài scope này. |
| BA pin HN-MC-001 chưa baseline đầy đủ rule import/item/code | Chặn nghiệm thu toàn phần cho phần import/item/code | BA/BAS + QA2 | Không tự suy diễn. Cần sign-off field/enum/rule. |
| Evidence QA2 chưa đính kèm từ browser/env thật | Chặn close Jira hoàn toàn | QA2 | Chạy WWHN-179 và đính kèm evidence. |

## 13. Definition of Done đề xuất cho task này

Task WWHN-39 chỉ nên được đóng khi đủ các điều kiện sau:

| Nhóm | Điều kiện Done |
| --- | --- |
| Code FE | Master Data route render ổn; Product/category list/create/detail/filter/pagination/status hoạt động theo contract; endpoint thiếu contract không bị gọi. |
| Contract | Mọi endpoint/payload đang gọi đều có trong OpenAPI/baseline; mọi endpoint thiếu contract có disposition rõ. |
| RBAC | UI disable đúng quyền và backend 403/data-scope có evidence riêng. |
| Error states | Loading, empty, 403, 409, 422, network được kiểm chứng bằng screenshot/network response. |
| Import | Nếu BE chưa có endpoint thì documented blocker được chấp nhận; nếu BE đã có endpoint thì import row-level error phải có evidence thật. |
| QA evidence | WWHN-179 có screenshot responsive, validation, RBAC, network và error states. |
| Build/test | Lint/build/test pass trên commit bàn giao cuối cùng hoặc CI job được link trong PR. |
| Trace | PR URL, commit SHA, build ID/env, Jira key, dependencies và open blockers được cập nhật. |

## 14. Kết luận kỹ thuật

Phần Product/SKU và Product Category đã có nền tảng FE đúng hướng: dùng component/config dùng lại, bám canonical API `/products` và `/product-categories`, có search/filter/pagination/detail, có form create, có action status, có RBAC UI và có error state chuẩn hóa.

Phần Item, Physical Code và Import không được coi là hoàn tất runtime vì thiếu contract trong OpenAPI hiện tại. Trạng thái đúng hiện nay là "blocked by BE/BA contract" với FE đã khóa request ngoài hợp đồng. Đây là điểm cần giữ rõ khi nghiệm thu: không nên biến yêu cầu Jira thành UI giả hoặc request tự chế, vì Description đã yêu cầu phản hồi contract mismatch và không tự suy diễn quy tắc nghiệp vụ.
