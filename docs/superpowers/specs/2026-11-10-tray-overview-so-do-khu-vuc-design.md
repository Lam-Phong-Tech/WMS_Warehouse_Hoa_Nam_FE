---
title: Dựng lại trang Tổng quan khay (/putaway/trays) theo mockup "Sơ đồ khu vực khay"
date: 2026-11-10
status: approved-2026-11-10
size: medium
---

# Tổng quan khay — port mockup so-do-khu-vuc-khay.html

## Hiện trạng (đã kiểm tra)

Trang `/putaway/trays` (`TrayOverviewPage.tsx` + `tray-overview.css`, nháp ở `20bcca1b`) render sai: thao tác scene không ra hình, vùng canvas gần như trống, chỉ còn 2 khối hố và các biển ZONE ở đáy. Dữ liệu thật vẫn đủ (API `fetchAllPutawayTrays`: 11 khay, 4 khu + khay chưa gán). Người dùng yêu cầu dựng lại "theo giao diện file html" — file `Hoa_Nam_UIUX_V2/so-do-khu-vuc-khay.html` (mặt bằng SVG, rack A–D × 5 ngăn, lối đi, lọc/zoom/dialog).

## Mục tiêu

Port đầy đủ mockup sang React với **dữ liệu thật**, đúng bố cục/tương tác:

- Shell giữ nguyên (breadcrumb + h1 "Tổng quan tình trạng khay" + nút "Về xếp khay"). Phần nội dung thành **một panel duy nhất** (không tách lớp): bản header trong panel (icon + "Sơ đồ khu vực khay" + subtitle "N khay · M khu vực" + nút **Toàn màn hình** icon-only bên phải).
- Toolbar 2 hàng theo mockup: hàng 1 = ô tìm kiếm + chọn khu vực + nút "Đặt lại bộ lọc"; hàng 2 = chips trạng thái (chấm màu + nhãn + số lượng: Tất cả / Cần chú ý / Đang chứa / Trống; ấn để lọc, chế độ pressed nổi) + bên phải "Hiển thị x/y khay".
- Topline dải mỏng: trái "Mặt bằng kho · Bố trí minh họa", phải "Cuộn dọc để xem các khu vực · Bấm khay để xem thông tin".
- **Scene SVG** dựng từ dữ liệu thật (bản dịch logic `buildWarehouseSvg`): mỗi khu = một rack chứa **5 ngăn**; khay theo `zone_code` (giữ thứ tự API), ngăn trống để trống có nhãn "Vị trí NN" (dạng dashed/mờ). Khay có `status` theo bucket hiện hành (EMPTY=trống/xanh viền, PARTIAL=Đang chứa/xanh, còn lại = Cần chú ý/vàng — giữ ngữ nghĩa bucket hiện có; badge/biểu tượng theo mockup). Lối đi giữa các rack (2 đường nét đứt + nhãn LỐI ĐI) như mockup.
- Sàn làm **gradient CSS + lưới CSS** — KHÔNG bọc ảnh base64 200KB của mockup (gói mỏng hơn, đủ độ thật). Ghi nhận là call của tôi.
- **Zoom**: nút −, %, +, nút "vừa khung" ở góc phải dưới (scrollbar dọc để xem các rack; không chiếm quyền cuộn chuột).
- **Dialog "Thông tin khay"** khi bấm khay: preview minh họa, `container_code` (user-select text), badge trạng thái, dòng "Khu vực" và "Vị trí / mô tả", nút [Sao chép mã] (copy → toast thông báo) và [Tìm trên sơ đồ] (đóng dialog, cuộn/focus đúng khay; ẩn khi khay chưa gán). Dùng `UiDialog` của dự án.
- **Dải "Chưa gán khu vực"** dưới map: mỗi khay chưa gán là một nút (mini-tray + mã + gợi ý vị trí + badge) — bấm mở dialog. Không gán zone thì không tính vào tổng khu vực.
- Footer gợi ý trong panel: trái "Bố trí các dãy và lối đi mang tính minh họa.", phải "Ô chưa gán không tính vào tổng khay · Bấm khay để xem chi tiết".
- Phím tắt `/` focus ô tìm; Esc trong ô tìm thì xóa từ khóa.
- Toàn màn hình qua `requestFullscreen` trên panel, fallback toast nếu trình duyệt không hỗ trợ.
- i18n vi/en/zh; màu theo token Hoa Nam (không dùng `#195cfa`/Roboto của bản demo); mọi trạng thái (loading/lỗi/rỗng/rỗng-do-lọc) giữ như test hiện hành; không backend.

## Non-goals

Không đổi API/backend; không kéo-thả/xếp khay; vùng dữ liệu không thêm trường; khu vực không cố định A–D — rack dựng theo đúng các zone có trong dữ liệu (thứ tự locale), ngăn >5 khay thì rải sang rack thứ hai cùng nhãn khu; không in ấn riêng ngoài mặc định của mockup (ẩn toolbar/zoom khi in).

## Approaches

1. **Port đầy đủ (chọn, người dùng duyệt rồi):** trải nghiệm đúng file HTML; chi phí lớn nhất nhưng đúng yêu cầu.
2. Bố cục + hình ảnh, bỏ zoom/dialog/phím tắt: nhẹ hơn ~30% nhưng thiếu hẳn tương tác của mẫu.
3. Giữ skeleton hiện tại, chỉ tô màu: không giải quyết lỗi gốc. Loại.

## Verification

- `vitest` module: giữ các ca hiện có (đếm bucket, lọc trạng thái, tìm kiếm, empty vs no-trays, loading không lộ số, lỗi + retry), cập nhật selector; thêm ca: bấm khay → dialog mở + copy mã (mock `navigator.clipboard`), khay chưa gán hiện ở dải, nút zoom đổi mức hiển thị.
- `npm run typecheck`, eslint phạm vi, `git diff --check`.
- Kiểm chứng trực quan trên bản dev nếu vào được; nếu không, nêu rõ giới hạn (màn live redirect /login trong phiên này).
