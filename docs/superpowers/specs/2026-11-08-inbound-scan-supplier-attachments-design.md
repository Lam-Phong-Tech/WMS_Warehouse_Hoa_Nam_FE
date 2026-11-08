# Hiển thị nhà cung cấp và chứng từ đính kèm trong drawer quét nhập kho

Ngày: 08/11/2026. Màn: IN-01 → drawer "Quét & hoàn tất nhập kho".

## Ý định và lý do

Người dùng đối soát phiếu nhập ngay trong drawer quét nhưng hiện chỉ thấy mã
chứng từ, trạng thái, người tạo, phiên bản, ngày tạo, kho, ghi chú. Hai thông
tin đã có trên phiếu nhưng không hiển thị:

- **Nhà cung cấp** — dữ liệu đã có ở `InboundDetail.supplier` (mã + tên).
- **Chứng từ đính kèm** — đã có panel dùng chung `DocumentAttachmentsPanel`
  (đang dùng ở modal "Thông tin phiếu nhập").

## Mục tiêu

- Thêm mục "Nhà cung cấp" vào lưới thông tin phiếu, định dạng `MÃ - Tên`,
  trống thì "—".
- Hiển thị khối "Chứng từ đính kèm" ngay dưới khối thông tin, **chỉ khi phiếu
  có ít nhất một tệp**.
- Chỉ xem và tải chứng từ trong drawer quét; không đính kèm/xoá.

## Không nằm trong phạm vi

- Không đổi modal "Thông tin phiếu nhập" (đã có NCC + đính kèm).
- Không đổi API/BE.
- Không thêm quyền mới.

## Phương án

1. **Dùng lại `DocumentAttachmentsPanel` + prop `hideWhenEmpty`** (chọn):
   giữ một nguồn logic tải/xem/tải tệp, không lặp service; panel tự quyết định
   ẩn khi rỗng.
2. Tự fetch `fetchDocumentAttachments` trong drawer rồi tự render: lặp logic
   tải blob/thumbnail/xem lớn — loại.
3. Luôn render panel ở chế độ `disabled`: hiện khối rỗng "Chưa có chứng từ"
   khi phiếu không có tệp — trái yêu cầu — loại.

## Thiết kế

- `DocumentAttachmentsPanel` nhận thêm `hideWhenEmpty?: boolean`. Khi
  `query.isSuccess` và danh sách rỗng thì trả `null` (mọi hook vẫn chạy trước
  đó).
- Drawer quét:
  - Thêm ô "Nhà cung cấp" (`inbound.detail.fieldSupplier`) vào lưới thông tin,
    sau "Kho"; "Ghi chú" chuyển thành một hàng đầy đủ.
  - Thêm `<DocumentAttachmentsPanel documentType="INBOUND" documentId={...}
    disabled hideWhenEmpty />` bọc trong khối có class riêng, đặt ngay dưới
    khối thông tin và trên phần "Ghi nhận mã vạch / QR / hộp".
- i18n: thêm `fieldSupplier` cho vi/en/zh.
