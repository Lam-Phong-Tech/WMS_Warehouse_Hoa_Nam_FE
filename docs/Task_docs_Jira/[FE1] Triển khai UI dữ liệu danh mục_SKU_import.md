# HN-FE-002 - Master/SKU FE P1 Bằng chứng hoàn thành

## 1. Theo dõi (Trace)

| Trường | Giá trị |
| --- | --- |
| Jira | WWHN-178 |
| Task QA liên quan | WWHN-179 |
| Phụ thuộc hợp đồng / baseline | HN-MC-001, BE OpenAPI |
| Chủ sở hữu FE | FE1 |
| Ngày lưu bằng chứng | 2026-08-01 |
| Commit repo đã kiểm tra | `22014d8d3c5fbaa53e61f4eb7fc90de6a105e35d` |
| Bằng chứng build cục bộ | `yarn.cmd lint` PASS; `yarn.cmd test` PASS; `yarn.cmd build` PASS |
| Nguồn OpenAPI | `swagger-api.json`, OpenAPI `3.0.0`, `220` paths |

> Ghi chú: tài liệu này chỉ khẳng định các bằng chứng về FE/source/build có thể kiểm chứng trong repository này. Ảnh chụp màn hình trình duyệt QA2, bằng chứng phân quyền BE, và chữ ký duyệt baseline BA vẫn là bằng chứng thuộc trách nhiệm từng bên và phải được các bên đó đính kèm trước khi task Jira được đánh dấu chấp nhận hoàn toàn.

## 2. Ma trận sửa lỗi bắt buộc P1

| Mức | Vấn đề review | Sửa lỗi bắt buộc | Quyết định hiện tại | Bằng chứng FE | Chủ sở hữu / bằng chứng còn thiếu |
| --- | --- | --- | --- | --- | --- |
| P1 | Import SKU vẫn gọi `POST /skus/import-excel` trong khi endpoint không có trong OpenAPI | BE1/BE2 xác nhận endpoint chính thức hoặc FE ẩn Import khỏi phạm vi Done | FE đã gỡ lời gọi API lúc runtime và vô hiệu hóa nút Import. Import nằm ngoài phạm vi Done cho đến khi BE công bố hợp đồng. | `MasterPage.tsx` vô hiệu hóa nút kèm tooltip; `importSkus()` ném lỗi cục bộ và không bao giờ gửi request. Kiểm tra OpenAPI: `/skus/import-excel` MISSING. | BE1/BE2 phải công bố hợp đồng endpoint/payload/response/error nếu Import được đưa vào phạm vi. |
| P1 | Item / Physical Code vẫn gọi `/items`, `/physical-codes` mà không có hợp đồng | Baseline OpenAPI hoặc chuyển thành read-only/mock rõ ràng ngoài phạm vi | FE hiện ngăn Master Data yêu cầu các endpoint này. Các tab được đánh dấu ngoài phạm vi/read-only cho đến khi có hợp đồng BE. | `useItems(..., enabled=false)`, `usePhysicalCodes(..., enabled=false)` mặc định; hàm service ném lỗi hợp đồng cục bộ; nhãn UI ghi rõ endpoint không có trong OpenAPI. Kiểm tra OpenAPI: `/items`, `/physical-codes` MISSING. | BE + BA phải công bố hợp đồng list/detail/filter/RBAC chính thức trước khi FE có thể nhận trách nhiệm Item/Physical Code có API hỗ trợ. |
| P1 | QA2 WWHN-179 chưa được kiểm thử | QA2 kiểm thử UI/validation/responsive/RBAC/error trên build/env/browser thực và đính kèm bằng chứng | FE cung cấp checklist chạy được và build artifact. FE không thể tự nhận QA2 sign-off. | Lint/test/build pass cục bộ. Checklist QA bắt buộc liệt kê trong Mục 6. | QA2 phải thực thi WWHN-179 trên build/env/browser đã chỉ định và đính kèm bằng chứng screenshot/network/error. |
| P1 | BA pin HN-MC-001 chưa được baseline | BA/BAS/QA2 review WWHN-14/WWHN-100/WWHN-101 và chốt field/enum/spec | FE chỉ khớp với OpenAPI hiện tại cho product fields/enums. Các quy tắc import/item/code chưa rõ không được nhận trách nhiệm. | Product payload dùng `product_code`, `name`, `uom_id`, `list_price_net`, `vat_rate`, `status`; VAT enum 0/5/8/10; status active/inactive/discontinued. | BA/BAS + QA2 phải baseline HN-MC-001 về fields, quy tắc import, ngữ nghĩa item/code, phân loại duplicate/unknown. |
| P1 | Không có bằng chứng phân quyền Backend | BE/API chứng minh 403/từ chối quyền/phạm vi dữ liệu độc lập với UI bị vô hiệu hóa | FE xem RBAC chỉ là lớp bảo vệ UX và hiển thị bằng chứng 403 từ backend khi nhận được. | `useHasPermission()` vô hiệu hóa các thao tác create/status; cảnh báo lỗi API giữ nguyên HTTP status, error code, request id. | BE + QA phải cung cấp bằng chứng 403/data-scope cấp API bằng request trực tiếp, không chỉ ảnh chụp UI bị vô hiệu hóa. |
| P1 | Trace PR/commit/build không đầy đủ | Thêm link PR, commit SHA truy cập được, build ID/env, log lint/build/test | Trace cục bộ FE được ghi tại đây. PR/build-system IDs không có sẵn từ workspace cục bộ. | Commit `22014d8d3c5fbaa53e61f4eb7fc90de6a105e35d`; log lint/test/build trong Mục 7. | FE1 phải dán URL PR và build ID CI sau khi push/mở PR. |

## 3. Xác minh hợp đồng OpenAPI

Lệnh đã dùng:

```bash
node -e "const s=require('./swagger-api.json'); const paths=Object.keys(s.paths||{}); for (const p of ['/products','/product-categories','/uoms','/suppliers','/skus/import-excel','/items','/physical-codes']) console.log(p, paths.includes(p)?'FOUND':'MISSING'); console.log('openapi',s.openapi||s.swagger,'paths',paths.length);"
```

Kết quả:

| Endpoint | Kết quả | Hành động FE |
| --- | --- | --- |
| `/products` | FOUND | Dùng cho SKU/Product list/create/status. |
| `/product-categories` | FOUND | Dùng cho category list/create. |
| `/uoms` | FOUND | Dùng cho dropdown tham chiếu UOM. |
| `/suppliers` | FOUND | Dùng cho dropdown tham chiếu supplier. |
| `/skus/import-excel` | MISSING | Đã vô hiệu hóa và chặn cục bộ. |
| `/items` | MISSING | Master Data không kích hoạt query; service chặn lời gọi cục bộ. |
| `/physical-codes` | MISSING | Master Data không kích hoạt query; service chặn lời gọi cục bộ. |

## 4. Các thay đổi FE đã hoàn tất

| File | Thay đổi |
| --- | --- |
| `src/modules/master-data/pages/MasterPage.tsx` | Nút Import SKU bị vô hiệu hóa kèm tooltip hợp đồng. Tab SKU quảng bá `GET/POST/PATCH /products`. Tab Item và Physical Code được dán nhãn rõ ràng ngoài phạm vi/read-only vì endpoint của chúng không có trong OpenAPI. |
| `src/modules/master-data/hooks/use-master-data.ts` | `useItems` và `usePhysicalCodes` mặc định `enabled=false`, nên chỉ render Master Data không thể kích hoạt `/items` hoặc `/physical-codes`. |
| `src/modules/master-data/services/master-data.service.ts` | `importSkus`, `getItems`, và `getPhysicalCodes` ném lỗi hợp đồng cục bộ thay vì gửi các HTTP request chưa được duyệt. |
| `src/modules/master-data/types/master-data.types.ts` | Các type Product/SKU được tài liệu hóa là khớp với OpenAPI; các endpoint cũ `/skus`, `/items`, `/physical-codes` và endpoint import được đánh dấu không có trong hợp đồng BE. |

## 5. Baseline field Product/SKU hiện FE đang nhận trách nhiệm

FE chỉ nhận trách nhiệm các field Product/SKU tồn tại trong OpenAPI hiện tại.

| Field UI | Field API | Validation / enum |
| --- | --- | --- |
| Mã SP | `product_code` | Bắt buộc |
| Tên sản phẩm | `name` | Bắt buộc |
| Đơn vị tính | `uom_id` | Bắt buộc |
| Giá niêm yết chưa VAT | `list_price_net` | Bắt buộc, số nguyên, tối thiểu 0 |
| Thuế VAT | `vat_rate` | Bắt buộc, một trong `0`, `5`, `8`, `10` |
| Trạng thái | `status` | Bắt buộc, một trong `active`, `inactive`, `discontinued` |
| Barcode | `barcode` | Tùy chọn |
| Nhà cung cấp | `supplier_id` | Tùy chọn/tham chiếu |
| Danh mục | `category_id` | Tùy chọn/tham chiếu |
| Mô tả | `description` | Tùy chọn |

Không được FE nhận trách nhiệm cho đến khi BA/BE baseline: hành vi import dry-run/commit, ghi một phần so với rollback, đặt tên endpoint SKU cũ, vòng đời inventory Item, phân loại duplicate/unknown của Physical Code, quy tắc bắt buộc serial/lot.

## 6. Checklist thực thi QA2 WWHN-179

QA2 phải chạy checklist này trên đúng build đã nộp và đính kèm bằng chứng.

| Khu vực | Test cases | Bằng chứng cần thiết |
| --- | --- | --- |
| Trace browser/env | Ghi lại browser/version, base URL, môi trường API, vai trò/bộ quyền người dùng, build ID/commit. | Screenshot hoặc header báo cáo test. |
| Responsive | 1920, 1366, 1024, 768 px. Kiểm tra cuộn bảng, bộ lọc, nút bấm, layout modal, layout drawer. | Screenshot cho từng viewport. |
| Danh sách SKU | Tìm kiếm, lọc trạng thái, sắp xếp, phân trang 15/20/50/100. | Network capture hiển thị query params gửi tới `/products`. |
| Validation tạo SKU | Submit form trống; kiểm tra lỗi bắt buộc cho `product_code`, `name`, `uom_id`, `list_price_net`, `vat_rate`, `status`. | Screenshot trước/sau khi submit. |
| Lỗi API tạo SKU | Lỗi field 422, duplicate `product_code` 409, lỗi mạng/timeout chung. | Screenshot + response body/request id khi có. |
| UI RBAC | Người dùng không có `sku.manage` và `master.manage` không thể dùng thao tác create/status. | Screenshot các điều khiển bị vô hiệu hóa và fixture role/permission. |
| Hiển thị 403 backend | Ép buộc API trả 403 và kiểm tra cảnh báo bao gồm HTTP status, error code, request id nếu backend trả về. | Screenshot + network response. |
| Import | Kiểm tra nút Import SKU bị vô hiệu hóa và không có request tới `/skus/import-excel`. | Screenshot + network tab filter. |
| Item/Physical Code | Kiểm tra các tab hiển thị rõ ngoài phạm vi/read-only và không có request tới `/items` hoặc `/physical-codes` từ Master Data. | Screenshot + network tab filter. |

## 7. Bằng chứng Build / Test

Các lệnh đã thực thi ngày 2026-08-01:

| Lệnh | Kết quả |
| --- | --- |
| `yarn.cmd lint` | PASS: ESLint hoàn tất thành công. |
| `yarn.cmd test` | PASS: `35` file test, `297` test đã pass. |
| `yarn.cmd build` | PASS: TypeScript build và Vite production build hoàn tất. Bundle Master chính được sinh ra: `dist/assets/MasterPage-QNwrwWZm.js`. |

Cảnh báo đã biết không chặn:

| Nguồn | Cảnh báo |
| --- | --- |
| Vite/Vitest | `__dirname` trong `vite.config.ts` / `vitest.config.ts` không được hỗ trợ bởi native config loader trong tương lai. Cảnh báo này không làm fail lint/test/build hiện tại. |

## 8. Ranh giới bằng chứng phân quyền

Bằng chứng FE:

- UI khóa các thao tác create/status bằng `sku.manage` hoặc `master.manage`.
- Cảnh báo lỗi coi HTTP 403 là warning và hiển thị status/code/request id.
- FE không coi UI bị vô hiệu hóa là bằng chứng phân quyền backend.

Bằng chứng BE/QA bắt buộc trước khi đóng:

- Request API trực tiếp với người dùng thiếu quyền trả về 403 cho các endpoint create/status.
- Request API trực tiếp với người dùng ngoài phạm vi dữ liệu không thể đọc/sửa dữ liệu product/category bị giới hạn.
- Bằng chứng bao gồm URL request, actor/user id hoặc fixture vai trò, response status, response body, request id, và tham chiếu log backend.

## 9. Trace PR / CI để điền sau khi push

| Trường | Giá trị |
| --- | --- |
| Branch | TODO: FE1 điền |
| URL PR | TODO: FE1 điền sau khi PR tồn tại |
| Commit SHA | `22014d8d3c5fbaa53e61f4eb7fc90de6a105e35d` cộng thêm commit sau khi có các thay đổi doc/code này |
| CI build ID | TODO: FE1 điền từ CI |
| CI env | TODO: FE1 điền |
| CI lint/test/build | TODO: dán link job hoặc link artifact |

## 10. Trạng thái cuối

Các sửa lỗi P1 phía FE đã hoàn tất cho an toàn hợp đồng: Import SKU, Item, và Physical Code không còn gửi các request thiếu trong OpenAPI chưa được duyệt từ Master Data, và UI không còn khẳng định các bề mặt đó có API hỗ trợ. Product/SKU chỉ được hỗ trợ bởi hợp đồng `/products` đã xác nhận với validation bắt buộc và xử lý UX lỗi/RBAC.

Task Jira chỉ nên được đánh dấu chấp nhận hoàn toàn sau khi QA2 đính kèm bằng chứng trình duyệt WWHN-179, BE/QA đính kèm bằng chứng 403/data-scope backend, BA/BAS baseline HN-MC-001, và FE1 bổ sung trace PR/CI sau khi PR tồn tại.