# HN-FE-002 - Bằng chứng Master/SKU FE

## Truy xuất nguồn gốc

| Trường                | Giá trị                            |
| -------------------- | -------------------------------- |
| Mục Hợp đồng        | PL01-04                          |
| Nhiệm vụ Cha          | [FE] Màn hình dùng lại cho dữ liệu danh mục và SKU/item/code |
| Khóa tạm Cha      | HN-FE-002 / HN-UX-002            |
| Khóa tạm Epic        | HN-EPIC-04                       |
| BA Pin               | HN-PIN-04                        |
| Vai trò                 | FE1                              |
| Người được gán | HN-FE-01                         |
| Phụ thuộc         | HN-UX-002, HN-FND-002, HN-MC-001 |
| Nguồn              | 08_DATA_API_UI_TECHNICAL_HANDOFF, HoaNam_Handoff_v3_9, WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide |
| Ảnh hưởng Tồn kho         | Không                             |
| Đầu ra               | Màn hình Master/SKU, Import UI, Bằng chứng Responsive/RBAC |

## Phạm vi Đã bàn giao

- Đã thay thế màn hình Dữ liệu Danh mục chỉ dùng mock trước đó bằng một bảng điều khiển thực thể cấu hình-driven tái sử dụng cho SKU, Item và Physical Code.
- Đã thêm tham số truy vấn phía máy chủ cho tìm kiếm, bộ lọc, sắp xếp, phân trang và kích thước trang trên tất cả các tab thực thể.
- Đã thêm drawer chi tiết được tái sử dụng bởi SKU/item/code, với khả năng hiển thị trường được điều khiển bởi cấu hình thực thể.
- Đã thêm modal tạo SKU sử dụng tên trường payload backend và ánh xạ lỗi trường 422 nội dòng.
- Đã thêm hành động xác nhận trạng thái SKU, RBAC vô hiệu hóa cấp hành động và khả năng tương thích RBAC cấp route.
- Đã thêm luồng tải lên import SKU với modal kết quả, số liệu tổng hợp và bảng lỗi cấp hàng.
- Đã thêm tạo mẫu import CSV cục bộ mà không thay đổi hợp đồng API.
- Đã thêm các trạng thái loading, empty, 403, hiển thị lỗi 409/422/mạng, success, disabled và confirm.

## Hợp đồng API Đã sử dụng

| Tính năng         | Endpoint                  |
| ------------------ | ------------------------- |
| Danh sách/tạo SKU    | `GET/POST /skus`          |
| Cập nhật trạng thái SKU  | `PATCH /skus/:id`         |
| Import SKU         | `POST /skus/import-excel` |
| Danh sách Item          | `GET /items`              |
| Danh sách Physical code | `GET /physical-codes`     |

Tất cả các cuộc gọi sử dụng `src/shared/api/http.ts` và giữ nguyên xử lý envelope/lỗi API.

Kết quả import chấp nhận `row_errors`/`errors` và các trường tổng hợp do backend cung cấp. FE không quyết định hành vi ghi một phần; nó chỉ hiển thị kết quả hợp đồng backend để điểm chấp nhận "không ghi một phần ngoài quy tắc" vẫn thuộc sở hữu của HN-MC-001.

## Bằng chứng Trạng thái

| Trạng thái         | Triển khai                                                                      |
| ------------- | ----------------------------------------------------------------------------------- |
| Loading       | `Table.loading` của Ant Design từ trạng thái fetching của TanStack Query                       |
| Empty         | `locale.emptyText` của Table theo từng tab                                                    |
| Error         | Cảnh báo lỗi API với trạng thái HTTP, mã lỗi và id yêu cầu khi có sẵn          |
| Success       | Thông báo Ant Design sau khi tạo/import cộng với modal kết quả import                     |
| Disabled/RBAC | Các hành động Tạo, Import và trạng thái bị vô hiệu hóa nếu không có `sku.manage` hoặc `master.manage` |
| Confirm       | Thay đổi trạng thái sử dụng `ConfirmButton` dùng chung                                           |
| Responsive    | Hàng bộ lọc sử dụng lưới responsive Ant Design và cuộn ngang bảng              |
| Detail        | Drawer được tái sử dụng cho xem xét trường SKU/item/code                                        |
| Import        | Tải lên, mẫu, số liệu tổng hợp và bảng lỗi cấp hàng                        |

## Xác minh

- `cmd /c npm run lint` đã qua.
- `cmd /c npm run build` đã qua.
- `cmd /c npm run test` đã qua: 32 file kiểm thử, 276 bài kiểm tra.

## Các File Đã Thay đổi

- `src/modules/master-data/pages/MasterPage.tsx`
- `src/modules/master-data/services/master-data.service.ts`
- `src/modules/master-data/types/master-data.types.ts`
- `docs/evidence/HN-FE-002-MASTER-SKU-FE.md`

## Mục Hợp đồng Mở

- Xác nhận với chủ sở hữu BE liệu endpoint import SKU có chính xác là `POST /skus/import-excel` hay không; triển khai FE tuân theo quy ước đặt tên import của repository hiện có.
- Xác nhận đặc tả trường SKU cuối cùng, giá trị enum và liệu endpoint tải mẫu chính thức sẽ được cung cấp bởi HN-MC-001 hay không.
- Xác nhận tên trường phản hồi import cuối cùng cho lỗi cấp hàng. FE hỗ trợ `row_errors` và `errors` như một cầu nối tương thích.