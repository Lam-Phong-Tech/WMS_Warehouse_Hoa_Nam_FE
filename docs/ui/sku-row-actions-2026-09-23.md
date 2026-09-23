# Cột Thao tác thống nhất theo Danh sách SKU

Ngày cập nhật: 23/09/2026.

Các bảng danh mục, PV, nhập/xuất kho, xếp khay, bảo hành, tồn kho, phiếu đảo, báo cáo và hệ thống dùng chung `RowActionButton` / `RowActionGroup` từ `src/shared/components/actions`. Các thẻ trên điện thoại và bảng chi tiết liên quan dùng cùng mẫu.

- Xem/chi tiết: nhãn kèm dấu `›`, nền trong suốt, màu liên kết theo bảng màu Tổng quan vận hành.
- Các thao tác khác: icon chuẩn từ `ACTION_KINDS`, có tên truy cập và tooltip. Cao 32px, icon 16px, chiều rộng tối thiểu 30px, bo góc 6px, khoảng cách nhóm 4px.
- Menu ba chấm dùng `ActionDropdown row`; giữ nguyên các mục, quyền và trạng thái khóa. Nút đang xử lý bị khóa và hiện spinner.
- Bảng màu nút được cố định bằng token chung ngay tại component để biến màu cũ của từng trang không làm lệch icon. Chế độ tối dùng cùng token tương ứng.
- CSS cũ dành riêng cho nút từng bảng đã được loại bỏ hoặc loại trừ `.hn-row-action`. Các trang không có cột thao tác giữ cấu trúc hiện có.

Kiểm tra:

- TypeScript, Vite production build và kiểm tra thư viện icon (`ui:icons`) đạt; ESLint các TS/TSX thay đổi không có lỗi.
- 304 kiểm thử được chạy: 282 đạt; 22 kiểm thử báo cáo cũ thất bại. Chạy đối chiếu các suite lỗi với nguồn trước thay đổi tái hiện đúng cả 22 tên kiểm thử và thông báo lỗi, không có lỗi mới. Các lỗi này nằm ở kỳ vọng giao diện/fixture cũ của report smoke, packing label, warranty và recipient.
- Nhóm kiểm thử nút dùng chung: 21/21; danh mục/PV/Audit: 76/76; nghiệp vụ kho: 141/141; báo cáo: 44/66.
- Trình duyệt: đối chiếu các nút hiện hữu trên danh mục, PV, nhập/xuất, xếp khay, bảo hành, tồn kho, phiếu đảo, tám báo cáo có nút thao tác, Audit và IAM. Nút Xem nhật ký mở chi tiết; menu PV mở bằng bàn phím.
- Kiểm tra 1440px và 390px, sáng/tối. Nút đo được 32px, icon 16px, nhóm cách 4px; các trang kiểm tra không tràn ngang toàn trang. Không ghi nhận lỗi console trong phiên kiểm tra.

Log, kết quả Vitest và bản đối chiếu được lưu tại workspace `row-actions-20260923/`. Thay đổi được áp dụng có kiểm tra hash để giữ các chỉnh sửa khác đang diễn ra trong dự án.
