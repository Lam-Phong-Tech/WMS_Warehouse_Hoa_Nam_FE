# OUT-01 — Bố cục kết quả xem trước không cuộn ngang

**Ngày:** 2026-11-09
**Phạm vi:** `OutboundIntakeModal` — khối “Kết quả xem trước” trong drawer tiếp nhận yêu cầu xuất.

## Vấn đề

Drawer rộng 860px, vùng nội dung sau padding khoảng 780px. Bảng xem trước có 8 cột
với tổng bề rộng tối thiểu vượt 1.100px, nên phải kéo ngang để đọc hết dữ liệu.
`ResponsiveDataTable` chỉ chuyển sang card theo viewport dưới 768px, không theo bề
rộng vùng chứa, nên bảng vẫn ở dạng bảng bên trong drawer.

## Quyết định

Thay riêng bảng xem trước bằng danh sách khối theo từng dòng:

- Đầu khối: số dòng, mã yêu cầu.
- Lưới hai cột: Người nhận (chiếm cả hàng), SKU, Gán lại SKU, SL yêu cầu,
  Khả dụng hiện tại, Kết quả kiểm tra (chiếm cả hàng).
- Dưới 620px chuyển về một cột.
- Giữ nguyên dữ liệu, ô chọn lại SKU, ô số lượng, badge trạng thái và phân trang.
- Viền trái của khối dùng màu ngữ nghĩa (thành công/cảnh báo/lỗi) để quét nhanh.

Cách này theo `docs/ui/DESIGN_FOUNDATIONS.md` §6: không bê bảng rộng vào drawer rồi
buộc người dùng kéo ngang; danh sách nhiều trường trong drawer dùng bố cục khối mở
rộng theo chiều dọc. Bảng ngoài drawer không thay đổi.

## Kiểm chứng

- Test component xác nhận khối xem trước không còn `table`, hiển thị đủ nhãn và giá
  trị của từng trường.
- `npm run typecheck`, ESLint, Prettier và các test liên quan của OUT-01.
