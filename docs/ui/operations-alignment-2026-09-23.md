# Đồng bộ giao diện theo Tổng quan vận hành

Chuẩn giao diện hiện tại là **Tổng quan vận hành**, thay cho các bảng màu riêng của từng trang hoặc chuẩn SKU trước đó.

## Quy ước dùng chung

- Palette: `src/shared/ui/tokens/operations.ts` và `operations.css`; hai bản được kiểm tra bằng `operations-palette.test.ts`.
- MUI và Ant Design dùng cùng palette. Các trang và portal đọc biến `--ops-*`; không thêm ThemeProvider cục bộ.
- Nền trang sáng `#F5FAFC`, thẻ trắng, chữ chính `#12344B`, tiêu đề `#003B63`, nút chính `#004E74`, viền `#D9E8EF`.
- Tiêu đề trang 24/38px; tiêu đề thẻ/modal 18/26px; nội dung 14px; chú thích 12px. Nút và ô nhập chính cao 40px; thao tác trong bảng giữ mật độ gọn.
- Bo góc control 6px, thẻ 8px, modal 12px. Các màu cảnh báo, lỗi và thành công vẫn phân biệt theo nghiệp vụ. Màu chuỗi biểu đồ và CSS in được giữ riêng.
- Nút chính dùng màu đặc; hover/focus đổi màu, không nhấc hoặc co nút. Chuyển trang dùng opacity nhẹ, tôn trọng reduced motion.

Phạm vi gồm danh mục SKU/sản phẩm/PV/đại lý/bệnh lỗi; nhập/xếp khay/xuất kho; bảo hành/xuất linh kiện; tồn kho/phiếu đảo; các báo cáo vận hành; cấu hình kho/nhật ký/hồ sơ và người dùng/phân quyền.

## Cache và chuyển trang

- Cache IndexedDB chỉ phục hồi sau khi xác thực danh tính. Namespace gắn với người dùng, phạm vi, quyền và bản build.
- Công việc lưu/đọc bất đồng bộ kiểm tra phiên hiện tại; dữ liệu của phiên hoặc kho cũ không được phục hồi vào phiên mới.
- Đổi ngữ cảnh hủy request cũ và xóa query phụ thuộc phạm vi trước khi mở giao diện mới.
- IndexedDB chỉ báo thành công khi transaction commit. Lỗi/quota vẫn cho phép ứng dụng hoạt động bằng mạng.
- Không ghi lại toàn bộ cache chỉ vì query không được lưu xuống đĩa thay đổi. Giữ các giới hạn dung lượng, TTL và quy tắc revalidate hiện có.
- `rpt-coverage` dùng chính sách report và tham gia invalidation, nhưng bị chặn lưu xuống đĩa vì chứa payload bảo hành/người nhận.
- Tải trước route tuần tự khi rảnh, nhường API đang chạy, dừng khi tab ẩn/mất mạng và tôn trọng Save-Data/2G. Hủy timer khi shell unmount.

## Kiểm tra

- TypeScript và Vite production build đạt.
- Bộ UI/cache gồm 276 kiểm thử: 274 đạt ở lượt đầy đủ; hai lỗi parity do thiếu biến CSS đã sửa và chạy lại đạt. Các kiểm thử cấu hình kho/nhật ký hệ thống trước đó đạt 30/30.
- Cache policy guard đạt cho toàn bộ query root.
- Đã kiểm tra giao diện chạy thật của các nhóm trang trên desktop; kiểm tra modal tạo hãng/xuất kho, kích thước điện thoại và giao diện tối. Sửa tràn ngang bộ lọc báo cáo đại lý.
- Các guard CSS/token toàn dự án vẫn ghi nhận những khai báo `!important` và màu biểu đồ/trạng thái có từ trước; đợt này không tăng ngân sách ngoại lệ để che các cảnh báo đó. Hai fixture ProtectedRoute cũ thiếu user cũng thất bại tương tự khi chạy với bản cache gốc.

Các chỉnh sửa chỉ áp dụng vào mã nguồn cục bộ, chưa triển khai lên máy chủ.
