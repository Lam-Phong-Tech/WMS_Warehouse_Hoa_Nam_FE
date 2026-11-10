---
title: Đưa nhóm "Chứng từ đính kèm / Sản phẩm & NFC" + nút đóng lên cùng hàng với tiêu đề drawer, góc trên phải
date: 2026-11-10
status: approved-2026-11-10
size: small
---

# Header drawer phiếu xuất: tab phụ và nút đóng cùng hàng với tiêu đề

## Hiện trạng (kiểm chứng)

- Ảnh chụp màn `khohoanamfe.lptech.info.vn/outbound?screen=OUT-01`: tiêu đề "Chi tiết phiếu xuất" nằm một hàng, nhóm tab + nút X nằm hàng dưới (lệch trái), trong khi vị trí khoanh đỏ bên phải hàng tiêu đề đang trống.
- Code local: `AlignedOutboundDetailModal` đã truyền tab qua `headerEnd` của `UiDrawer` (commit `3813516e`), nhưng commit `2d47662f` thêm vào `src/index.css` quy tắc `.ui-drawer-header .MuiTypography-root { width: 100%; min-width: 0 }`. Hàng header dùng flex + `flexWrap: wrap`, nên tiêu đề chiếm trọn hàng 1, `headerEnd` (tab + nút đóng) bắt buộc xuống hàng 2.
- Trang live không mở được (redirect `/login`), nên đối chiếu trực tiếp trên bản deploy chưa thực hiện; kết luận dựa trên ảnh chụp và code trong repo.

## Mục tiêu

Nhóm "Chứng từ đính kèm / Sản phẩm & NFC" và nút đóng nằm **cùng một hàng** với tiêu đề "Chi tiết phiếu xuất", dạt về **góc trên phải** của drawer (vị trí khoanh đỏ bên phải trong ảnh). Không đổi nghiệp vụ, không đổi nội dung/nhãn, không đổi hành vi đóng.

## Approaches đã cân nhắc

1. **CSS flex thay width 100% (chọn):** đổi quy tắc trong `src/index.css` để title Typography dùng `flex: 1 1 auto; min-width: 0` thay vì `width: 100%`, giữ nguyên `width: 100%` cho `span/div` con bên trong title (ý đồ gốc của `2d47662f`: hành động trong title của reversal-create vẫn ghim phải). Thêm `margin-left: auto` cho hộp `headerEnd` trong `UiDrawer` để ghim phải kể cả khi drawer không có title. Không đụng markup, không đụng nghiệp vụ.
2. Xóa hẳn quy tắc `width: 100%`: làm hỏng fix của `2d47662f` — drawer tạo bút toán đảo (`ReversalCreateModal`) có nút hành động nằm trong title sẽ bị dạt theo chữ thay vì ghim phải. Loại.
3. Bỏ `flexWrap: wrap` ở header: header tràn ngang trên màn hẹp, vi phạm quy tắc responsive drawer. Loại.

## Thiết kế (ngắn)

- `src/index.css`: `.ui-drawer-header .MuiTypography-root` → `flex: 1 1 auto; min-width: 0` (bỏ `width: 100%`); giữ nguyên hai quy tắc con `> span, > div { width: 100%; min-width: 0 }`.
- `src/shared/ui/components/UiDialog.tsx`: hộp bao `headerEnd` thêm `marginLeft: "auto"` (ghim phải khi không có title; vô hại khi có title vì title đã giãn).
- Giữ `flexWrap: wrap` cho màn hẹp: khi tiêu đề + tab + nút đóng không đủ chỗ, `headerEnd` xuống hàng dưới như hiện hành.
- Không thay `hn-step-utility*` CSS, không đổi a11y/nhãn/hành vi.

## Kiểm chứng dự kiến

- Chạy test liên quan (`AlignedOutboundDetailModal*.test.tsx`) và typecheck/lint phần thay đổi.
- Kiểm chứng trực quan: mở drawer chi tiết phiếu xuất trên bản chạy local nếu truy cập được; nếu không, nêu rõ giới hạn và để người dùng xác nhận trên bản deploy sau khi build.
- Xác nhận không hồi quy drawer bút toán đảo (nút trong title vẫn ghim phải — đảm bảo bởi quy tắc `span/div` con giữ `width: 100%` + `flex` title).

## Non-goals

Không redesign nhóm tab, không đổi kích thước drawer 820px, không đổi vị trí footer "Hủy phiếu", không sửa các màn khác.
