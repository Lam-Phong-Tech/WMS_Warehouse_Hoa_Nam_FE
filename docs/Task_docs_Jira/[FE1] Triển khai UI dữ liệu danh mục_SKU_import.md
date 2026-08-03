# [FE1] Triển khai UI dữ liệu danh mục / SKU / Import

## 1. Trace thực thi

| Trường | Giá trị |
| --- | --- |
| Jira FE | WWHN-178 |
| Jira QA2 | WWHN-179 |
| Baseline liên quan | WWHN-14, WWHN-100, WWHN-101, HN-MC-001 |
| Branch | `m1` |
| Baseline trước đợt sửa | `d2a8cdc7587fc2728f92fcc8a1eb6ccade303add` |
| Repository | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` |
| Ngày cập nhật | 2026-08-03 |

## 2. Kết luận theo severity

| Severity | Kết quả FE | Trạng thái đóng |
| --- | --- | --- |
| P0 | Endpoint chưa có contract tiếp tục bị chặn theo fail-closed; không phát request runtime đến `/skus/import-excel`, `/items`, `/physical-codes`. | Đã xử lý bằng code + unit test + CI gate. |
| P1 - QA2 WWHN-179 | Đã chuẩn bị checklist, trạng thái UI, E2E nền tảng và trace build. | Chờ QA2 chạy trên build/env/browser thật và attach evidence. Không tự nhận QA2 sign-off. |
| P1 - HN-MC-001 | FE chỉ nhận các field/enum có trong OpenAPI hiện hành; import/item/code giữ khóa. | Chờ BA/BAS/QA2 ký baseline field, enum, import rule, item/code semantics. |
| P1 - Backend authorization | FE có UI guard và hiển thị 403/request-id, nhưng không coi UI disabled là bằng chứng BE. | Chờ BE/API cung cấp direct request 403, permission deny và data-scope. Không tự nhận BE authorization sign-off. |
| P1 - PR/CI trace | Đã bổ sung quality gate chuyên biệt vào script và workflow. | CI run/build ID phải được lấy từ GitHub Actions sau push. |
| P2 - UI evidence | Đã xác định đủ ma trận loading/empty/error/success/disabled/responsive/accessibility. | QA2 attach screenshot/video thực tế theo ma trận bên dưới. |

## 3. Phần FE đã sửa chắc chắn

### 3.1 Fail-closed cho endpoint chưa có contract

- Nút **Import SKU cũ** bị disabled và có tooltip giải thích `/skus/import-excel` chưa có trong OpenAPI.
- `importSkus()` ném lỗi cục bộ, không gọi HTTP.
- `getItems()` và `getPhysicalCodes()` ném lỗi cục bộ.
- Query Item và Physical Code mặc định không được bật.
- UI ghi rõ hai tab này là out of scope/read-only cho đến khi BE/BA công bố contract.

### 3.2 Contract Product/SKU đang áp dụng

| UI | API field | Quy tắc FE |
| --- | --- | --- |
| Mã SP | `product_code` | Required |
| Tên sản phẩm | `name` | Required |
| Đơn vị tính | `uom_id` | Required |
| Giá chưa VAT | `list_price_net` | Required, min 0, integer |
| VAT | `vat_rate` | Required, enum 0/5/8/10 |
| Trạng thái | `status` | Required, active/inactive/discontinued |
| Barcode | `barcode` | Optional |
| Nhà cung cấp | `supplier_id` | Optional reference |
| Danh mục | `category_id` | Optional reference |
| Mô tả | `description` | Optional |

Canonical endpoints phía FE:

- `GET /products`
- `POST /products`
- `PATCH /products/:id/enable`
- `PATCH /products/:id/disable`
- `GET/POST /product-categories`
- `GET /uoms`
- `GET /suppliers`

### 3.3 RBAC và error handling

- Thao tác tạo/cập nhật trạng thái yêu cầu `sku.manage` hoặc `master.manage`.
- Người thiếu quyền thấy control disabled.
- HTTP 403 có state cảnh báo riêng.
- Error UI hiển thị HTTP status, error code và request ID khi backend trả về.
- UI guard chỉ là lớp UX; backend vẫn phải tự enforce authorization và data-scope.

## 4. Quality gates bổ sung

Đã thêm `scripts/verify-master-sku-closure.mjs` và lệnh:

```bash
npm run master-sku:verify
```

Gate này fail CI khi xảy ra một trong các trường hợp:

- Import SKU không còn disabled.
- Service bắt đầu gọi endpoint chưa có contract.
- Canonical `/products` bị thay đổi sai.
- Guard `sku.manage` / `master.manage` bị gỡ.
- Dedicated 403 state hoặc request ID bị gỡ.
- Bộ field SKU bắt buộc bị mất.
- Unit test fail-closed bị mất.
- File evidence không còn đủ trace P1/P2 hoặc ghi nhận sign-off giả.

## 5. QA2 checklist bắt buộc cho WWHN-179

QA2 ghi rõ build ID, commit SHA, base URL, API environment, browser/version, account/role và viewport.

| Nhóm | Test | Evidence bắt buộc |
| --- | --- | --- |
| loading | Throttle hoặc delay `/products`; skeleton/spinner không làm vỡ layout. | Screenshot/video + network timing. |
| empty | API trả danh sách rỗng. | Screenshot empty state và pagination total 0. |
| error | Kiểm tra 403, 409 duplicate, 422 validation, 500/network timeout. | Screenshot + request/response + request ID. |
| success | Load list, search/filter/sort/page, tạo SKU, đổi trạng thái. | Video ngắn + network request/response. |
| disabled | User thiếu permission; Import/Item/Code chưa contract. | Screenshot role fixture + disabled control + network không có endpoint bị chặn. |
| responsive | 1920, 1366, 1024, 768 px; table scroll, modal, drawer, filter, action. | Screenshot mỗi viewport. |
| accessibility | Keyboard tab order, visible focus, label form, button accessible name, modal focus trap. | Video/ảnh + browser accessibility inspection. |
| validation | Submit rỗng và dữ liệu không hợp lệ cho toàn bộ field required. | Before/after screenshots. |
| RBAC UI | Không có `sku.manage`/`master.manage`; action không thao tác được. | Screenshot permission fixture và UI. |
| backend authorization | Gọi API trực tiếp bằng token thiếu quyền và token ngoài scope. | cURL/Postman + status/body/log correlation. |

## 6. Bằng chứng BE/API cần nộp

BE/API phải cung cấp ít nhất:

1. `POST /products` với actor thiếu quyền trả `403`.
2. Enable/disable product với actor thiếu quyền trả `403`.
3. Actor ngoài data-scope không đọc/sửa được record ngoài phạm vi.
4. Request URL/method, actor hoặc role fixture, headers đã che secret, response status/body, request ID và backend log correlation.
5. Không dùng ảnh UI disabled để thay thế direct API evidence.

## 7. Quyết định HN-MC-001 cần BA/BAS/QA2 ký

- Tên và semantics chính thức giữa Product, SKU, Item và Physical Code.
- Field required/optional, max length, format, enum và default.
- Import file type, column mapping, template version và encoding.
- Duplicate key; create/update/upsert; dry-run; partial write hay rollback toàn bộ.
- Row error schema; giới hạn file/row; timeout và idempotency.
- Serial/lot tracking; item lifecycle; code type/carrier; duplicate/unknown classification.
- Permission catalog và data-scope áp dụng cho từng action.

Trước khi quyết định này được ký, FE giữ Import/Item/Physical Code ở trạng thái khóa an toàn.

## 8. PR/CI trace

| Trường | Giá trị |
| --- | --- |
| Branch | `m1` |
| Commit đầu đợt | `d2a8cdc7587fc2728f92fcc8a1eb6ccade303add` |
| Commit thêm closure gate | `6f56bd0387085bd2615973e80b9a7e79ed2ae6ff` |
| Commit package script | `7c52dbba9e0020a394cbb9af0869c88b0ef45a23` |
| Commit sửa gate | `12e8269fd9ecdf7ca5d3c72cccf7ccc77e6d85ac` |
| PR URL | Chờ tạo PR từ `m1` sang nhánh đích được PO/Lead chỉ định. |
| CI build ID/env | Chờ GitHub Actions tạo run trên HEAD sau commit tài liệu/workflow. |
| Quality gates | format:check, lint, test, env:verify, uat:p0p1:verify, master-sku:verify, build, health:check, check:api-mapping. |

## 9. Tiêu chí để đạt 100%

Phần FE/code được coi hoàn thành khi toàn bộ CI gate pass trên đúng HEAD. Điểm tổng chỉ được nâng 100% khi đồng thời có:

- QA2 WWHN-179 PASS với evidence thật.
- BA/BAS/QA2 ký HN-MC-001.
- BE/API direct authorization/data-scope evidence PASS.
- PR URL, commit HEAD, CI run/build ID và log truy cập được.
- Screenshot/video P2 đủ loading, empty, error, success, disabled, responsive và accessibility.

Không đánh dấu các mục phụ thuộc bên ngoài là Done trước khi có bằng chứng truy xuất được.