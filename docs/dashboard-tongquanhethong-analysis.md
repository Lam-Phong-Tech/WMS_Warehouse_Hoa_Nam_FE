# Đối chiếu bộ ảnh Tổng quan hệ thống

Nguồn tham chiếu: `Hoa_Nam_UIUX_V2/tongquanhethong/`, gồm 8 ảnh Desktop và 8 ảnh Tablet cùng tên. Các con số trong ảnh là dữ liệu minh hoạ, không phải dữ liệu mặc định của ứng dụng.

## 1. Bản đồ màn và trạng thái

| Ảnh                        | Nội dung cần giữ                                                                                              | Màn hoặc nguồn hiện có                                                                           | Quyết định                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 01 Tổng quan               | KPI tồn khả dụng, luồng trong ngày, việc cần chú ý, bảng/biểu đồ 7 ngày, cảnh báo định mức, giao dịch gần đây | MAP-01; báo cáo XNT; dashboard overview/quick; lịch sử chứng từ                                  | Cập nhật MAP-01 theo thứ bậc ảnh, dùng chung bộ lọc cho bảng/biểu đồ.                                                 |
| 02 Việc cần xử lý          | Danh sách theo nhóm, số lượng, chi tiết dòng đang chọn                                                        | Đối soát tồn, nhập lỗi, in nhãn, putaway, bảo hành đã có các trang chuyên trách                  | Chỉ tạo lớp điều hướng/tóm tắt chung khi có mã định danh và nguồn danh sách thật; không sao chép màn xử lý nghiệp vụ. |
| 03 Giải thích tồn          | Tồn hiện có/khả dụng/không khả dụng, phương trình XNT có reversal, ghi chú nghiệp vụ                          | `inventory-balance`, `inventory-reconciliation`, `inventory-xnt-enhanced`, `inventory-xnt-daily` | Tận dụng báo cáo tồn và đối soát; giữ phương trình với **tồn hiện có**, không thay bằng tồn khả dụng.                 |
| 04 Chi tiết giao dịch      | Số chứng từ, trạng thái, đối tác, người ghi sổ, dòng SKU, dòng thời gian, movement                            | Lịch sử nhập xuất và `InboundReportDetail`/`FlowDocumentDetailModal`                             | Tạo lớp đọc nhanh từ adapter báo cáo, liên kết sang màn nghiệp vụ đầy đủ; không tạo chứng từ mẫu.                    |
| 05 Cảnh báo định mức       | SKU đã/chưa đặt ngưỡng, danh sách thấp/cao, chi tiết ngưỡng                                                   | Danh mục SKU, snapshot đối soát, dashboard quick                                                 | Bảng chi tiết chỉ dùng các SKU có min hoặc max. `0` là một giá trị ngưỡng hợp lệ.                                     |
| 06 Không phát sinh         | Luồng và giao dịch bằng 0; tồn hiện tại và việc đang mở vẫn có thể có                                         | MAP-01                                                                                           | Empty state theo từng khối; không xoá tồn hiện tại do kỳ lọc rỗng.                                                    |
| 07 Dữ liệu cũ/lỗi một phần | Mốc dữ liệu riêng từng khối; một nguồn lỗi không làm trắng khối khác                                          | React Query giữ dữ liệu cũ; dashboard có cờ partial                                              | Gắn dấu dữ liệu cũ/không tải được đúng khối, có thử lại; không đổi lỗi thành 0.                                       |
| 08 Lỗi toàn trang          | Bộ lọc giữ nguyên, thông báo và thử lại                                                                       | MAP-01 có `failed`/`forbidden`                                                                   | Hiển thị trạng thái lỗi tập trung sau bộ lọc.                                                                         |

Tablet không phải bản desktop co tỷ lệ: KPI thành lưới 2 cột; danh sách và thẻ chi tiết xếp dọc; bảng cho cuộn ngang khi cần; khối cảnh báo, giao dịch, liên kết nhanh đi theo một cột. Dùng cùng dữ liệu và DOM có thứ tự đọc hợp lý, CSS thay đổi bố cục theo breakpoint.

## 2. Trường dữ liệu nên hiển thị

### Tổng quan

- Tồn khả dụng hiện tại, đơn vị, số SKU có tồn; phân tách sản phẩm/linh kiện khi nguồn cấp được.
- Nhập đã ghi sổ, xuất sản phẩm đã ghi sổ, xuất linh kiện bảo hành đã ghi sổ **trong ngày**; số chứng từ chỉ xuất hiện khi lịch sử chứng từ và định nghĩa lọc khớp với KPI. Không dùng số phiếu tạo nháp.
- Mốc cập nhật của từng nguồn. Bộ lọc ngày 7/14/30/tùy chọn chỉ chi phối bảng/biểu đồ luồng, không làm đổi KPI “hôm nay” hoặc tồn tức thời.
- Việc cần xử lý: đối soát lệch; lỗi yêu cầu xuất; lỗi in nhãn; BOX chờ xếp khay; bảo hành đang xử lý/quá hạn. Hiển thị rõ số nào không lấy được, không dùng 0 thay cho lỗi/thiếu contract.
- Bảng 7 ngày: ngày, nhập sản phẩm, nhập linh kiện, xuất sản phẩm, xuất linh kiện bảo hành, tổng; biểu đồ là cách xem khác của **cùng tập dữ liệu**. Chỉ thêm tồn cuối ngày khi có một nguồn cùng phạm vi và không gây hiểu lầm giữa tồn hiện có/khả dụng.
- Cảnh báo định mức: số SKU đã cấu hình, chưa cấu hình, dưới min, trên max. Chưa cấu hình không đồng nghĩa “đạt ngưỡng”.
- Giao dịch gần đây: thời điểm ghi sổ, mã chứng từ, loại, đối tác, số lượng có dấu, trạng thái, liên kết chi tiết. Chỉ đưa chứng từ thực sự ghi sổ.

### Chi tiết

- Việc cần xử lý: mã thực thể, loại vấn đề, thời điểm, tuổi, người phụ trách **nếu API có**, trạng thái, hành động mở màn xử lý gốc. Với lệch tồn: SKU, kho, trạng thái tồn, sổ/balance/delta, kiểm tra cần xác minh. `incident_id`, `incident_status` chưa có trong API đối soát; không tạo mã sự cố hoặc tuổi giả.
- Giải thích tồn: tổng hiện có = khả dụng + không khả dụng theo cùng mốc/kho/trạng thái; đầu kỳ + nhập − xuất SP − xuất LK BH + hoàn tác = cuối kỳ. Nếu các nguồn không khớp phạm vi hoặc mốc, hiện sai lệch và nhãn cần kiểm tra, không làm tròn để che chênh lệch.
- Chi tiết giao dịch: mã, trạng thái, loại, đối tác, kho, người tạo/ghi sổ, thời điểm, dòng SKU và lượng, movement liên quan. Timeline chỉ hiện sự kiện thực sự có timestamp.
- Cảnh báo định mức: SKU/tên/loại, tồn khả dụng, min/max, trạng thái, độ thiếu/vượt, điều hướng tới SKU và tồn. Không tự tạo đề nghị mua hàng.

## 3. Nội dung trùng và cách xử lý

| Trùng trong MAP-01 hoặc với màn hiện có                                                                       | Xử lý                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Thẻ “Tổng tồn khả dụng” và lát “Khả dụng” trong donut tồn đều in cùng một số                                  | Giữ một số nổi bật ở KPI. Nếu giữ donut, nó phải phục vụ câu hỏi **cơ cấu trạng thái**, không lặp tóm tắt tồn ở phần đầu.   |
| Thẻ “SKU đang có hàng” và dòng phụ “số SKU” của KPI tồn trong ảnh                                             | Gộp vào KPI tồn; bỏ thẻ SKU riêng khi theo ảnh 01.                                                                          |
| “Cần chú ý”, “Công việc cần ưu tiên”, “Tín hiệu cảnh báo”, “Cảnh báo tồn” lặp cùng đối soát/bảo hành/định mức | Một danh sách việc có thể thao tác; một tóm tắt định mức ngắn với liên kết tới bảng. Không thêm danh sách cảnh báo thứ hai. |
| Bảng nhập xuất 7 ngày và biểu đồ nhập xuất 7 ngày                                                             | Một card với nút chuyển cách xem; chung bộ lọc và tổng.                                                                     |
| “Giao dịch gần đây” và “Hoạt động gần đây” cùng ý nhưng một khối đang là placeholder                          | Dùng bảng chứng từ đã ghi sổ làm nguồn chính; nhật ký hệ thống chỉ mở qua liên kết nếu cần kiểm toán.                       |
| “Giải thích tồn”, trang Tồn kho, báo cáo XNT/Đối soát                                                         | Tổng quan chỉ tóm tắt và mở trang chuyên sâu; không tạo bản sao bảng nghiệp vụ.                                             |
| Chi tiết giao dịch ảnh 04 và modal chi tiết phiếu nhập/xuất đã có                                             | Màn dashboard chỉ đọc dữ liệu báo cáo và mở màn nghiệp vụ đầy đủ; không có thao tác ghi sổ thứ hai.                       |

## 4. Nguồn và khoảng trống contract

| Nội dung                                      | Nguồn có thể dùng                                                 | Giới hạn                                                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tồn khả dụng, nhập/xuất, việc đối soát/in lỗi | `/reports/dashboard-overview`                                     | `kpi.on_hand` thực chất là tồn **khả dụng** theo chú thích type, không phải tồn hiện có. `issues` không có `outbound_request_error`, `pending_putaway`. |
| Xu hướng ngày và hoàn tác                     | `/reports/dashboard-overview`, `/reports/inventory-xnt-daily`     | `reversal_net` lấy từ XNT daily; không suy ngược từ số cuối ngày.                                                                                       |
| Tồn hiện có và sổ đối soát                    | `/reports/inventory-balance`, `/reports/inventory-reconciliation` | Lệch sổ là dấu hiệu cần xác minh, không mặc nhiên là thiếu hàng thực tế.                                                                                |
| Định mức                                      | `/skus/lookup`, `/reports/dashboard-quick`, `/safe-stock-alerts`  | Có thể xác định số cấu hình từ danh mục; cảnh báo cần so trên **khả dụng** cùng phạm vi.                                                                |
| Giao dịch gần đây                             | `/reports/document-history` và movement ledger                    | Dùng adapter lịch sử hiện có để giữ số lượng có dấu và liên kết chứng từ.                                                                               |
| Putaway                                       | `/putaway-tasks`                                                  | Cần xác nhận trạng thái nào là “chờ xếp khay” và BOX duy nhất hay dòng nhiệm vụ.                                                                        |
| Yêu cầu xuất lỗi                              | Luồng outbound/import hiện có                                     | Chưa có metric tổng thống nhất trong dashboard contract; không đồng nhất bừa với `import_error` vì đây là nhóm nhập lỗi.                                |

## 5. Quy tắc trình bày

Giữ vỏ ứng dụng hiện tại (sidebar, topbar, màu xanh đậm/xanh lam, card trắng viền xanh nhạt, font và icon hiện dùng). Tránh lặp các hàng thẻ/bảng chỉ để lấp diện tích. Desktop ưu tiên luồng đọc KPI → việc cần chú ý → xu hướng → định mức → giao dịch; tablet giữ thứ tự đọc và chuyển sang một cột khi bảng/chi tiết cần chiều rộng. Mỗi khối có loading, empty, partial error và retry riêng theo khả năng API. Không dùng bất kỳ con số trong ảnh làm fallback sản xuất.
