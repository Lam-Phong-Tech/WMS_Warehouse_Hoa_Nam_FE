# Thao tác hàng loạt trên lệnh xếp khay — thiết kế

Ngày: 09/11/2026. Màn: `PTW-00`, tab "Lệnh xếp khay".

## Ý định và lý do

Tab "Lệnh xếp khay" hiện chỉ cho xác nhận/hủy từng lệnh qua menu ba chấm của
dòng. Khi nhân viên đã chọn nhiều BOX, họ cần xác nhận hoặc hủy cả nhóm trong
một lần thao tác thay vì mở từng menu.

## Mục tiêu

- Khi chọn từ hai lệnh trở lên trong tab "Lệnh xếp khay", thanh chọn hiện thêm
  hai nút: **Xác nhận xếp khay** và **Hủy lệnh nháp**, nằm trước "Bỏ chọn".
- Mỗi nút mở hộp thoại xác nhận dùng chung, có số lượng lệnh.
- Xác nhận/hủy tuần tự từng DRAFT qua API hiện có (`draft_id`,
  `draft_version`).
- Nếu một lệnh lỗi, vẫn tiếp tục xử lý các lệnh còn lại và báo tổng kết
  thành công/thất bại.

## Không nằm trong phạm vi

- Không đổi API/BE, không gộp nhiều DRAFT thành một request.
- Không đổi menu thao tác từng dòng.
- Không đổi luồng chọn nhiều BOX ở tab "Hàng chờ".

## Ràng buộc

- `confirmPutawayTask`/`cancelPutawayTask` nhận một `id` và `version` mỗi lần.
- Mỗi lệnh vẫn stock-neutral; kiểm tra `stock_effect === "NONE"` và
  `movement_created === false` sau mỗi lần gọi.
- Chỉ người có `putaway.manage`/`container.manage` mới thấy nút hoạt động.

## Phương án

1. **Gọi tuần tự từng DRAFT** (chọn): không đổi BE, xử lý lỗi riêng từng
   lệnh, phù hợp mô hình dữ liệu hiện tại.
2. **Thêm endpoint bulk**: giảm số request nhưng phải sửa BE/contract; ngoài
   phạm vi.
3. **Chỉ thao tác dòng đầu tiên**: không đáp ứng yêu cầu chọn nhiều — loại.

## Thiết kế

### Thanh chọn

- `PutawayQueue` nhận thêm `onConfirmMany(rows)` và `onCancelMany(rows)`.
- Khi `orders` và `selectedRows.length >= 2`:
  - Nút "Xác nhận xếp khay" (tái dùng nhãn `putaway.queue.confirm`).
  - Nút "Hủy lệnh nháp" (tái dùng nhãn `putaway.queue.cancelDraft`, màu
    danger).
  - Cả hai đứng trước "Bỏ chọn"; disabled khi không có quyền.

### Hộp thoại xác nhận

- Dùng `confirmPrompt` hiện có.
- Tiêu đề/nội dung mới có `{count}`:
  - Xác nhận: "Xác nhận xếp khay cho {count} BOX?"
  - Hủy: "Hủy {count} lệnh xếp khay nháp?"
- Nút xác nhận giữ nhãn "Xác nhận" / "Hủy lệnh".

### Xử lý

- Lặp tuần tự danh sách đã chọn; bỏ qua dòng thiếu `draft_id`/`draft_version`
  và tính là thất bại.
- Thành công toàn bộ: toast "Đã xác nhận xếp khay cho {count} BOX." hoặc
  "Đã hủy {count} lệnh xếp khay nháp."
- Thành công một phần: "Đã xác nhận/hủy {success}/{total}..." và giữ danh sách
  được làm mới để người dùng thử lại các lệnh còn lại.
- Tất cả lỗi: toast lỗi đầu tiên (thông điệp API).

## i18n

Thêm VI/EN/ZH cho 4 khoá tiêu đề/nội dung hộp thoại và 4 khoá toast tổng kết.

## Kiểm chứng

- `PutawayQueue.test`: chọn 2 lệnh, thấy 2 nút, gọi đúng callback với danh
  sách; chọn 1 lệnh không hiện 2 nút.
- `MvpPutawayPage.interactions.test`: xác nhận 2 DRAFT đúng id/version; hủy 2
  DRAFT; lỗi một phần vẫn gọi các lệnh còn lại.
- `npm run typecheck`, test liên quan, eslint các file sửa.
