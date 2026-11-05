# Báo cáo nhãn đóng gói – kiểm chứng 05/11/2026

Hoàn thiện RPT-05 theo ảnh Desktop/Tablet trong baocao_nhan.donggoi.inlai và chuẩn DESIGN_FOUNDATIONS.md, sku-list-filter-table-style.md.

- Hai tab Nhãn/Lượt in; nhãn chưa in vẫn xuất hiện. Tổng nhãn duy nhất độc lập số lượt in.
- Tìm kiếm, khoảng ngày tự áp dụng, kết quả, máy in, người in, loại lượt; bảng, độ rộng cột, phân trang theo SKU. Điều khiển lọc cao 48px.
- Drawer chi tiết và lịch sử, xem bản lưu bất biến, sản phẩm/SKU/số lượng/toa nguồn, phóng to và mở phiếu xuất.
- Xác nhận máy in/lý do in lại; đọc lại trạng thái và version theo ID trước khi gửi; If-Match và Idempotency-Key. Lượt lỗi cũ không quyết định loại lệnh mới.
- Khóa gửi tiếp khi có PENDING/SENT hoặc lỗi mạng/gateway chưa rõ kết quả; chỉ đối chiếu một sự kiện mới có kết quả cuối. Thiếu dữ liệu bản lưu khóa in/xem trước và giải thích trường thiếu.
- Loading, rỗng, không khớp tìm kiếm, lỗi tải có thử lại, thiếu quyền lượt in và giới hạn 2.000 sự kiện được phân biệt.

## Dữ liệu dev

Backend commit a96a292b tạo bộ PLRPT-20261105: 10 nhãn, 13 lượt (7 thành công, 4 lỗi, 1 PENDING, 1 SENT), 2 máy in giả lập. Có nhãn chưa in và bản lưu thiếu dữ liệu. Tạo chứng từ qua dịch vụ kho cho SKU riêng; các hàng dữ liệu có trước được đối chiếu hash không thay đổi; chạy lại cùng ngày không tạo trùng. Xem docs/packing-label-report-fixtures.md của backend.

## Kiểm chứng

- 30 kiểm tra frontend của màn nhãn và 9 kiểm tra xuất báo cáo dùng chung qua Vitest.
- 21 kiểm tra backend / 92 assertions qua PHPUnit, chạy lại độc lập bởi agent chính.
- 3 bài kiểm tra Chromium: danh sách/chi tiết/xem trước/xác nhận tại 1440, 1024, 768, 390, 320px; không tràn ngang cấp trang/drawer; bảng cuộn riêng; tình huống chưa xác định, thiếu dữ liệu, rỗng và lỗi tải; drawer xuất báo cáo được kiểm tra ở cả năm kích thước.
- TypeScript và lint đạt; build Vite cùng manifest được kiểm tra trong container Node 22 tách biệt.
- Ảnh kiểm chứng tại evidence/packing-label-20261105/.

## Khác biệt với ảnh và giới hạn

Theo chuẩn hiện hành, chi tiết dùng drawer bên phải. Export giữ API được kiểm toán hiện tại: XLSX/PDF tổng hợp theo nhãn (20 cột), không xuất từng lượt/CSV như bản minh họa; drawer xuất báo cáo dùng chung giải thích rõ phạm vi, chọn tất cả/trang hiện tại, tóm tắt/chi tiết, đổi tên file và gửi đầy đủ bộ lọc. Mỗi lần xác nhận gửi một lượt, theo API hiện hành. Barcode trong xem trước là minh họa có nhãn cảnh báo, không dùng quét. Chưa kiểm thử với máy in vật lý; kiểm thử giao diện dùng fixture, không gửi lệnh tới thiết bị. Không chạy xong toàn bộ suite backend ngoài phạm vi thay đổi.
