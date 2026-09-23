# INV-01 — đồng bộ giao diện với Danh sách SKU

Ngày kiểm tra: 23/09/2026. Nhánh: dev.
Thư mục: C:\LAM_PHONG_TECH\HoaNam_FE\WMS_Warehouse_Hoa_Nam_FE.

## Phạm vi

Đồng bộ phần trình bày của InventoryPage, BalanceDetailModal và TraceModal với sku-list.css đang chạy tại MST-01. Giữ nguyên API, bộ lọc, phân trang, quyền truy vết, số liệu đối soát và các handler nghiệp vụ. Không sửa component dùng chung trong lần đồng bộ INV-01 này. Bảo toàn các thay đổi đang có trước khi bắt đầu.

- Tiêu đề #10477e, nội dung #365d80, chữ phụ #5d7f9e.
- Viền #c9e3f2, nền nhạt #eaf6fc, nút chính #005477, liên kết #008fc6.
- Màu tương ứng cho giao diện tối lấy từ SKU; kiểm tra trình duyệt thực hiện ở giao diện sáng.
- Tiêu đề trang 24/38 px; nút 14 px và cao 38 px; bảng 13 px; tiêu đề cột 12/18 px, padding 10px 9px; badge 11 px, cao tối thiểu 24 px; tiêu đề dialog 18/26 px.
- Panel bo 10 px, điều khiển 6 px, dialog 12 px. Màu cảnh báo/lỗi và ý nghĩa trạng thái giữ nguyên.
- Menu qua portal có palette riêng để không rơi về màu mặc định. CSS đều giới hạn trong INV-01 và portal của nó.

## Kiểm chứng

Đối chiếu DOM computed styles trực tiếp giữa SKU và INV-01: tiêu đề, input, nút chính, panel lọc, viền, header/body bảng và badge. Cỡ chữ input thực tế của cả hai màn là 15 px theo nền tảng hiện tại.

- Trang tồn kho: kiểm tra các chiều rộng 320, 390, 600, 768, 820, 1024, 1280, 1440, 1920 px; document và root không tràn ngang.
- Lịch sử biến động: 320, 390, 768, 820, 1024, 1440, 1920 px; document và root không tràn ngang.
- Dialog chi tiết: 320, 390, 600, 768, 1024, 1440, 1920 px; dialog nằm trong viewport và content không tràn ngang.
- Dialog truy vết: 320, 390, 820, 1440 px; content không tràn ngang. Bảng rộng cuộn bên trong; màn hẹp dùng card, giữ các trường đối soát.
- Kiểm tra thực tế: hai tab, menu lọc, đặt lại, tìm không có dữ liệu, loading, thay đổi 10/20 dòng, sắp xếp thời gian, mở/đóng chi tiết, chuyển chi tiết sang truy vết, lookup mã vật lý có dữ liệu.
- 43/43 kiểm thử có sẵn của module inventory qua (5 file): trang, hai dialog, service và trace net-effect. Các kiểm thử bao gồm quyền, lỗi/rỗng và tham số nghiệp vụ.
- ESLint, Prettier của các file sửa: qua. ui:architecture: qua. Vite production bundle: qua.

## Giới hạn kiểm tra toàn dự án

Typecheck còn 5 lỗi có sẵn trong PackingLabelPrintReport.tsx: 4 lỗi thuộc tính version của LabelSnapshotRecord và 1 lỗi kiểu disabled.
ui:styles còn 12 vi phạm có sẵn; ui:tokens còn 14 vi phạm có sẵn ngoài inventory. Chỉ đăng ký số lượng màu chính xác của hai CSS inventory trong allowlist; không tăng định mức các file khác.

Không tạo nhánh, commit hoặc push. Không thay đổi dữ liệu kho trong quá trình kiểm tra trình duyệt.
