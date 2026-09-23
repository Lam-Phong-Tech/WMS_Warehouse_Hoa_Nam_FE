# PTW-00 — đối chiếu giao diện hàng chờ xếp khay

Ngày kiểm tra: 2026-09-23. Nhánh làm việc: `dev`.

## Nguồn và phạm vi

- Gallery: https://duc-nguyen98.github.io/SystemHNWeb/drive-gallery.html?v=9ff2914
- Nhóm được đối chiếu: **Nhập kho · Hàng chờ xếp khay**, gồm hai ảnh mặc định desktop và tablet.
- Desktop 1672 × 941: https://duc-nguyen98.github.io/SystemHNWeb/previews/drive-screens/originals/nhap-kho-linh-kien-cho-xep-khay-hang-cho/desktop/hn-nhap-kho-hang-cho-xep-khay-p01-default-desktop-1672x941-review-8289f69e83.png
- Tablet 992 × 1586: https://duc-nguyen98.github.io/SystemHNWeb/previews/drive-screens/originals/nhap-kho-linh-kien-cho-xep-khay-hang-cho/tablet/hn-nhap-kho-hang-cho-xep-khay-p01-default-tablet-992x1586-review-883eb560cb.png
- Màn chạy thực: http://localhost:5173/putaway?screen=PTW-00

Thay đổi tập trung vào tiêu đề, nhãn kho thực, bốn mục điều hướng, bộ lọc, ba chỉ số, bảng BOX, phân trang, trạng thái tải/rỗng/lỗi/quyền và trình bày hộp thoại. CSS được giới hạn bởi `.hn-putaway-page`, `.ptw-dialog` và portal của màn này. Không sửa shell, dịch vụ nghiệp vụ hoặc API xếp khay.

## Hành vi được giữ và kiểm tra

- Tìm kiếm debounce hiện có; Áp dụng chạy tìm kiếm ngay; Đặt lại xóa tìm kiếm và bộ lọc.
- Bộ lọc trạng thái/phiếu nhập dùng dữ liệu trả về; số liệu tổng hợp được tính từ danh sách đang hiển thị.
- Sắp xếp toàn bộ kết quả trước phân trang; chọn BOX, bỏ chọn, phân trang và đổi số dòng.
- Điều hướng Hàng chờ, Lệnh xếp khay, Danh sách khay và Lịch sử.
- Mở chi tiết, chọn/quét khay, tạo nháp, xác nhận và hủy tiếp tục gọi callback/service cũ, giữ quyền, phiên bản, idempotency và cập nhật cache hiện có.
- Tạo/xác nhận/hủy kiểm tra bằng unit/integration tests và fixture cục bộ; không tạo lệnh thật trong lúc kiểm tra trình duyệt.
- Kiểm tra trên dữ liệu thật: màn tải được, thông tin kho thật, tìm kiếm không có kết quả và Đặt lại phục hồi danh sách.
- Khi API không cung cấp `updated_at`, cột Cập nhật hiện dấu gạch ngang; không tự tạo thời điểm. Hai ảnh nguồn không có bộ lọc ngày, nên không bổ sung luồng chọn ngày mới.
- Nhãn giao diện mới có tiếng Việt/Anh.

## Responsive và hình ảnh

Đã quan sát desktop 1672 × 941, tablet 992 × 1586 với sidebar mở/thu gọn, điện thoại 390 × 844; kiểm tra chiều rộng 320, 390, 600, 768, 992, 1024, 1366, 1672 và 1920 px không có tràn ngang toàn trang. Bảng cuộn trong khung riêng khi hẹp. Trường lọc tự xuống hàng theo chiều rộng nội dung; bốn mục điều hướng hiển thị hai hàng trên điện thoại. Hộp thoại có nền đặc, cuộn nội dung, focus và dropdown cùng tông màu.

Đã đối chiếu ảnh nguồn bằng mắt, không thực hiện pixel-diff tự động. Shell chung hiện tại có kích thước/sidebar khác ảnh mẫu và được giữ nguyên để tránh ảnh hưởng màn khác. Ảnh tĩnh không mô tả đủ chuyển động hay mọi trạng thái; các trạng thái không có ảnh được trình bày theo cùng màu sắc và thành phần, giữ hành vi của dự án. Vì vậy không coi báo cáo này là chứng nhận khớp tuyệt đối 100% mọi pixel/hiệu ứng.

## Kết quả kiểm tra

- Putaway và i18n: **52/52 tests**, 6 file, PASS.
- ESLint phạm vi putaway: **0 lỗi**, 2 warning có sẵn.
- Vite production bundle: PASS.
- UI architecture: PASS.
- TypeScript toàn dự án: còn 5 lỗi ngoài phạm vi tại `src/modules/reports/packing-label/PackingLabelPrintReport.tsx` (trường version và kiểu boolean); không có lỗi putaway.
- Guard toàn dự án còn 12 vi phạm styles, 14 tokens, 5 icons trong các tệp ngoài phạm vi. Không có mục putaway trong các báo cáo này.

Log và fixture kiểm tra nằm trong thư mục gitignored `.agent-cache/ptw00-reference` của chính repository; fixture không được import vào ứng dụng production. Không làm việc tại OneDrive, không tạo nhánh mới, không commit/push.
