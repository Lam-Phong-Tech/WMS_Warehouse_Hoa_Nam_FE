# Xếp nhiều hộp vào một khay — thiết kế

Ngày: 09/11/2026. Màn: `PTW-00` (`/putaway`, `MvpPutawayPage`).

## Ý định và lý do

Nhân viên kho cần gom nhiều BOX đang chờ vào cùng một khay trong một lần thao
tác thay vì mở drawer cho từng BOX. Hiện thanh "Đã chọn N BOX" chỉ có thao tác
tạo lệnh khi chọn đúng một BOX; chọn từ hai BOX trở lên không có hành động nào.

## Mục tiêu

- Thêm nút **"Xếp nhiều hộp vào 1 khay"** trong thanh chọn (vị trí ngay trước
  "Bỏ chọn") khi chọn từ hai BOX trở lên.
- Bấm nút mở drawer tạo lệnh xếp khay cho toàn bộ BOX đang chọn; chọn một khay
  đích dùng chung; giữ nguyên luồng chọn khay/quét mã hiện có.
- Tiêu đề drawer ở chế độ nhiều hộp: **"Xếp Hộp 1, Hộp 2... vào khay"**.
- Khối thông tin phía trên drawer ở chế độ nhiều hộp: dãy ngang
  `[Hộp 1] → [Hộp 2] → ... → [Khay đích]`, mỗi hộp một card gọn gồm mã BOX,
  SKU, số lượng, phiếu nhập; mũi tên nối các card và card khay đích cập nhật
  theo khay đang chọn.
- Giữ nguyên hành vi một hộp: nút "Tạo lệnh cho BOX đã chọn", tiêu đề
  "Xếp {code} vào khay", card thông tin một hộp.

## Không nằm trong phạm vi

- Không đổi API/BE. Mỗi BOX vẫn sinh một DRAFT riêng (`putaway_events`).
- Không gộp nhiều BOX vào một bản ghi lệnh duy nhất.
- Không đổi màn "Lệnh xếp khay", "Danh sách khay" hay "Lịch sử".

## Ràng buộc

- API `POST /putaway-tasks` chỉ nhận `box_container_id` đơn lẻ và từ chối BOX
  đã có DRAFT (`PUTAWAY_DRAFT_EXISTS`).
- Vì vậy thao tác nhiều hộp gọi tuần tự API cho từng BOX, cùng `to_tray_id`,
  `location_hint`, `note`; mỗi lần gọi vẫn stock-neutral.
- Nếu một lần gọi lỗi giữa chừng, các BOX đã tạo được giữ nguyên; drawer chỉ
  giữ lại các BOX chưa tạo để tránh gửi lại và nhận 409.

## Phương án

1. **Gọi tuần tự N DRAFT cùng một khay** (chọn): không đổi BE, khớp mô hình dữ
   liệu hiện tại, tổng dung lượng thay đổi nhỏ. Đánh đổi: danh sách "Lệnh xếp
   khay" sẽ có N dòng cho N hộp.
2. **Thêm endpoint bulk ở BE**: một request tạo N DRAFT trong một transaction.
   Sạch hơn về hiệu năng nhưng phải sửa BE, contract, test và triển khai thêm;
   ngoài phạm vi được duyệt.
3. **Chỉ frontend gộp hiển thị, không tạo thật**: không đáp ứng nghiệp vụ vì
   không gán được hộp vào khay — loại.

Người dùng đã chốt phương án 1 và bố cục dãy ngang trong trao đổi ngày
09/11/2026.

## Thiết kế

### Thanh chọn

- Thêm nhóm hành động bên phải, ngay trước "Bỏ chọn".
- Chọn đúng 1 BOX: giữ nút hiện có "Tạo lệnh cho BOX đã chọn".
- Chọn từ 2 BOX trở lên: hiện nút "Xếp nhiều hộp vào 1 khay"; chỉ bật khi
  người dùng có quyền `putaway.manage`/`container.manage`.
- Chỉ những BOX ở trạng thái `RECEIVED_PENDING_PUTAWAY` mới được đưa vào lệnh.

### Drawer nhiều hộp

- State chọn chuyển từ một BOX sang danh sách BOX; drawer mở khi danh sách
  không rỗng.
- Tiêu đề: `Xếp {danh sách "Hộp N"} vào khay`.
- Khối đầu drawer là `BoxChain`: các card hộp theo thứ tự chọn, mũi tên
  `angle-small-right`, card cuối "Khay đích" hiển thị mã khay đang chọn hoặc
  "Chưa chọn".
- Card hộp: nhãn "Hộp N", mã BOX, SKU, số lượng, phiếu nhập, badge trạng thái.
- Chọn khay, quét mã, vị trí gợi ý, ghi chú giữ nguyên như luồng một hộp.
- Số lượng hiển thị ở panel khay là tổng số lượng các hộp đang chọn.

### Tạo lệnh

- Kiểm tra tất cả BOX còn `RECEIVED_PENDING_PUTAWAY` và khay đích còn khả dụng.
- Gọi `createPutawayTask` tuần tự cho từng BOX với cùng khay/vị trí/ghi chú.
- Thành công toàn bộ: toast "Đã tạo N lệnh xếp khay nháp...", đóng drawer.
- Lỗi giữa chừng: báo số lệnh đã tạo, giữ drawer với các BOX còn lại và giữ
  khay đã chọn để thử lại.

## i18n

Thêm khoá VI/EN/ZH: nút nhiều hộp, tiêu đề nhiều hộp, nhãn "Hộp N", nhãn khay
đích, aria-label dãy hộp, toast tạo nhiều lệnh và toast tạo một phần.

## Kiểm chứng

- Unit test `PutawayQueue`: chọn 2 BOX hiện nút mới, gọi `onCreateMany` với
  đúng danh sách; chọn 1 BOX vẫn giữ nút cũ.
- Unit test `BoxChain`: render đủ "Hộp 1", "Hộp 2", mã/SKU/số lượng/phiếu và
  khay đích.
- Test `MvpPutawayPage`: mở drawer nhiều hộp, tiêu đề đúng, tạo 2 DRAFT cùng
  khay, đóng drawer.
- `npm run typecheck`, test các file liên quan, lint file sửa, `npm run ui:tokens`
  và `git diff --check`.
