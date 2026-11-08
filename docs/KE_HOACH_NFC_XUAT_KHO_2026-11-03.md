# Kế hoạch tích hợp NFC vào Phiếu xuất kho

## 1. Mục tiêu và phạm vi

- Gỡ màn NFC độc lập khỏi menu. URL cũ `/nfc` chuyển đến `/outbound?tab=products`.
- Trong Xuất kho, giữ danh sách phiếu hiện có và thêm tab **Sản phẩm & NFC**. Chi tiết một phiếu cũng có tab này để chỉ xem sản phẩm của phiếu.
- Người dùng xem mã hiện vật, SKU, phiếu, UID chip đang hoạt động, trạng thái, người/ngày gắn và lịch sử gắn/thu hồi. Gắn, thay, thu hồi chip tiếp tục thực hiện trong App Scanner.
- Không sửa quy trình tiếp nhận, quét, Post Issue, in nhãn hoặc hủy phiếu. Các API mới chỉ đọc và không tạo biến động tồn kho.

## 2. Quy tắc nghiệp vụ

| Ngữ cảnh | Tập sản phẩm được hiển thị |
| --- | --- |
| Tab tổng hợp Xuất kho | Item của các phiếu `POSTED`, đối chiếu còn hiệu lực |
| Chi tiết phiếu `DRAFT` | Chưa có item thì hiện trạng thái trống |
| Chi tiết phiếu `SCANNING` | Chỉ item đã đối chiếu và đồng bộ |
| Chi tiết phiếu `POSTED` | Item đã xuất của phiếu |
| Phiếu `CANCELLED` | Không phân loại như sản phẩm đã xuất |

- `ASSIGNED`: đọc thành công và có chip NFC `ACTIVE` gắn đúng item, đúng kho.
- `UNASSIGNED`: đọc thành công nhưng không có chip NFC `ACTIVE`.
- `UNKNOWN`: trạng thái giao diện khi đọc NFC lỗi; không ghi nó xuống backend và không biến lỗi thành `UNASSIGNED`.
- Tổng số trên ba bộ lọc được backend tính trên toàn bộ kết quả tìm kiếm trước khi lọc trạng thái và phân trang.
- Lịch sử item gom các chip NFC từng liên kết; chip đã thu hồi vẫn xuất hiện cùng lý do và người thực hiện.

## 3. Hợp đồng backend

1. `GET /api/v1/outbound-documents/nfc-items`
   - Bộ lọc: `document_id` (tùy chọn), `keyword` (mã item, serial, SKU, UID), `nfc_status=ALL|ASSIGNED|UNASSIGNED`, `page`, `per_page` (tối đa 100).
   - Trả từng item cùng mã phiếu, SKU, trạng thái phiếu, trạng thái NFC, UID/ngày/người gắn nếu có.
   - `meta.tab_totals` có `ALL`, `ASSIGNED`, `UNASSIGNED` trên cùng tập tìm kiếm.
2. `GET /api/v1/outbound-documents/{id}/items/{itemId}/nfc-history`
   - Chỉ cho item thuộc phiếu và kho được phép xem; trả các sự kiện gắn/thu hồi theo trang.
3. Quyền: `outbound.view` cộng phạm vi kho của người dùng. Không buộc người tra cứu có quyền ghi `physical_code.assign_rfid`; không mở API ghi NFC mới.
4. Tài liệu OpenAPI và kiểm thử HTTP đi cùng hai endpoint.

## 4. Kế hoạch triển khai giao diện

1. Thêm client TypeScript có kiểu dữ liệu riêng cho danh sách sản phẩm và lịch sử.
2. Thêm tab **Sản phẩm & NFC** tại trang Xuất kho; hiển thị ba bộ đếm, tìm mã/SKU/UID, bảng phân trang, liên kết về phiếu và chi tiết sản phẩm.
3. Trong modal chi tiết phiếu, thêm tab cùng tên dùng lại thành phần trên với `document_id`; giữ các thao tác nghiệp vụ ở tab Tổng quan.
4. Chi tiết sản phẩm hiển thị chip hiện tại và dòng thời gian sự kiện; có trạng thái đang tải, trống và lỗi với thao tác thử lại.
5. Gỡ nhóm menu NFC, route component, màn và các thành phần chỉ phục vụ màn cũ. Giữ chuyển hướng URL cũ để bookmark không hỏng.
6. Dùng biến màu, khoảng cách và thành phần UI hiện có; hiển thị thích ứng khi bảng hẹp.

## 5. Thứ tự đưa vào hệ thống

1. Kiểm tra migration/schema, quyền và API bằng test backend; cập nhật tài liệu API.
2. Đưa backend lên trước để endpoint đọc sẵn sàng.
3. Đưa frontend lên sau; xác nhận route cũ chuyển hướng và các tab hoạt động với tài khoản chỉ có `outbound.view`.
4. Kiểm tra thực tế trên dữ liệu một phiếu đang quét, một phiếu đã xuất và một item từng thay chip. Đối chiếu số đếm với dữ liệu backend.

## 6. Tiêu chí nghiệm thu

- Không còn mục NFC riêng trên sidebar; `/nfc` mở tab sản phẩm trong Xuất kho.
- Chọn phiếu từ tab sản phẩm mở đúng chi tiết; tab trong chi tiết chỉ hiển thị item thuộc phiếu đó.
- Lọc theo mã/SKU/UID và ba trạng thái trả đúng số đếm khi nhiều trang.
- Chip bị thu hồi làm item thành `UNASSIGNED`, nhưng lịch sử vẫn hiện chip cũ và chip mới.
- Khi API lỗi, giao diện hiện lỗi/`UNKNOWN`, không ghi sai là “Chưa gắn”.
- Người ngoài phạm vi kho không đọc được UID/lịch sử; người có `outbound.view` xem được mà không cần quyền gắn chip.
- Các lệnh đọc không thay đổi tồn kho, số lượng đối chiếu hoặc trạng thái phiếu.

## 7. Kiểm chứng và giới hạn môi trường

- Chạy PHPUnit cho hợp đồng mới và các luồng outbound/NFC hiện có; chạy Vitest, TypeScript typecheck và build frontend.
- Soát diff của hai kho mã, kiểm tra không có API ghi mới.
- Giao diện mới cần được thử với backend đã triển khai; bản frontend cũ kết nối backend cũ sẽ nhận 404 ở tab sản phẩm cho đến khi triển khai theo thứ tự trên.
