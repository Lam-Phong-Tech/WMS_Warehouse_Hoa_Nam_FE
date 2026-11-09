# Chứng từ đính kèm + sửa phiếu xuất nháp trong tiếp nhận yêu cầu xuất

Ngày: 09/11/2026. Màn: OUT-01 → drawer "Phiếu Toa hàng (Phiếu yêu cầu xuất)"
và drawer "Chi tiết phiếu xuất".

## Ý định và lý do

Hai nhu cầu liên tiếp của người dùng:

1. Khi tiếp nhận yêu cầu xuất, muốn đính kèm ảnh chụp/PDF chứng từ ngay trong
   form, giống khối "Chứng từ đính kèm" của form Tạo phiếu nhập.
2. Khi phiếu xuất đã tạo còn ở trạng thái **Nháp**, muốn sửa thông tin đầu phiếu
   và bổ sung/xoá chứng từ giống trang phiếu nhập.

Hiện form tiếp nhận chỉ tạo phiếu xuất nháp rồi đóng; muốn bổ sung chứng từ phải
mở tab "Chứng từ đính kèm" ở màn chi tiết. Phiếu xuất cũng chưa có chức năng sửa
thông tin. Backend đã có `POST /outbound-documents/{id}/attachments` (ảnh/PDF
≤ 15MB, stock-neutral) nhưng **chưa có endpoint sửa phiếu xuất**.

## Mục tiêu

### 1. Chứng từ khi tiếp nhận

- Thêm khối **"Chứng từ đính kèm"** vào drawer tiếp nhận, dùng được ở cả hai
  chế độ **Nhập tay** và **Nhập từ Excel**.
- Chọn nhiều tệp JPG/PNG/WEBP/PDF, mỗi tệp ≤ 15MB; kiểm tra loại/dung lượng
  phía client bằng `FILE_RULES.documentAttachment` như form nhập.
- Tệp được giữ ở local với trạng thái `selected → uploading → uploaded/failed`;
  **chỉ tải lên sau khi xác nhận tạo phiếu thành công**.
- Chứng từ gắn vào **phiếu xuất đầu tiên của lô** (`outboundDocumentIds[0]`) —
  phương án người dùng đã chọn. Các phiếu còn lại bổ sung riêng ở tab chi tiết.
- Nếu tải chứng từ lỗi: giữ drawer mở, hiện lỗi theo từng tệp và nút **thử lại**
  chỉ tải lại các tệp chưa xong. Tuyệt đối **không gọi consume lần hai**.
- Khi phiếu đã tạo nhưng còn tệp chưa tải, đóng drawer sẽ bỏ các tệp đó và đưa
  người dùng về danh sách/chi tiết phiếu vừa tạo.

### 2. Sửa phiếu xuất nháp

- Trong drawer chi tiết phiếu xuất, khi trạng thái **DRAFT** và người dùng có
  quyền, hiện nút **"Sửa thông tin"** ở footer — cùng vị trí/hành vi với nút
  "Sửa thông tin" ở drawer quét phiếu nhập.
- Mở form sửa gồm:
  - Người/nơi nhận, địa chỉ, SĐT liên hệ, đại lý/nơi nhận, ngày yêu cầu, ghi chú.
  - Danh sách SKU/số lượng **chỉ đọc** (chốt từ toa).
  - Khối chứng từ đính kèm hiện có (thêm/xoá như trang phiếu nhập).
- Lưu bằng endpoint mới `PATCH /api/v1/outbound-documents/{id}` với `If-Match`.
  Chỉ chấp nhận khi phiếu **DRAFT**, chưa hết hạn nháp, chưa có scan evidence.
- Cập nhật đồng thời header phiếu xuất và header toa nguồn để hai bản ghi không
  lệch nhau; **không sửa dòng SKU/số lượng**.
- Sau khi lưu: đóng form sửa, làm mới drawer chi tiết và danh sách.

## Không nằm trong phạm vi

- Không sửa SKU/số lượng dòng hàng. Quy tắc hiện hành "dòng sinh từ toa không
  được sửa" (`SOURCE_REQUEST_IMMUTABLE`) giữ nguyên; muốn đổi hàng phải huỷ
  phiếu và tạo lại.
- Không sửa kho xuất, mã phiếu, ngày chứng từ.
- Không sửa phiếu ở trạng thái SCANNING/POSTED/CANCELLED.
- Không sửa API tạo phiếu trực tiếp; phiếu vẫn chỉ sinh từ Confirm toa.
- Chứng từ là tuỳ chọn, không bắt buộc (BE outbound trả
  `requires_evidence = false`).

## Phương án

1. **Tách `InboundCreateAttachments` thành component dùng chung**
   `PendingDocumentAttachments` và thêm endpoint PATCH chuyên biệt cho phiếu
   xuất nháp (chọn). Một nguồn UI/trạng thái tệp; endpoint sửa chỉ mở đúng phần
   header, không đụng tới dòng hàng hay luồng tạo phiếu.
2. Sao chép component/UI sửa sang module outbound: nhanh nhưng lặp logic, hai
   bản dễ lệch — loại.
3. Tải tệp ngay khi chọn qua một endpoint tạm, hoặc "sửa" bằng cách huỷ rồi tạo
   lại phiếu: BE không có endpoint nhận chứng từ trước khi phiếu tồn tại; huỷ/tạo
   lại làm đổi mã phiếu, mất lịch sử và không phải là sửa — loại.

## Thiết kế

### Component chứng từ dùng chung

- Chuyển `InboundCreateAttachments.tsx` → `src/shared/components/forms/
  PendingDocumentAttachments.tsx`; đổi type `PendingInboundAttachment` →
  `PendingDocumentAttachment`.
- API: `files`, `busy`, `locked`, `onSelect`, `onRemove`, `hint?: ReactNode`.
- Nhãn chuyển về `shared.attachments`: chọn tệp, gợi ý tệp local, "Đã chọn ·
  Chưa tải lên", "Đã tải lên", "Bỏ tệp {name}". Câu chữ tiếng Việt của form nhập
  giữ nguyên.
- Form nhập chỉ đổi import sang component mới; không đổi giao diện/hành vi.

### Form tiếp nhận yêu cầu xuất

- State `pendingFiles`, `createdResult`, `uploading`.
- Khối chứng từ đặt ở cuối phần thân drawer (sau bảng xem trước, trên footer),
  hiện ở cả hai chế độ. Chỉ hiện khi người dùng có quyền tải chứng từ xuất
  (`outbound.scan` hoặc `outbound.post` — đúng cổng của route BE).
- Gợi ý: tệp chỉ tải lên sau khi xác nhận tạo phiếu; nếu lô tạo nhiều phiếu,
  chứng từ gắn vào phiếu đầu tiên.
- `consumeMutation.onSuccess`:
  - Không có tệp → giữ nguyên hành vi hiện tại.
  - Có tệp → lưu kết quả consume, tải lần lượt từng tệp lên
    `outboundDocumentIds[0]`.
    - Tất cả thành công → toast + `onConsumed(ids)`.
    - Có tệp lỗi → không đóng drawer, hiện cảnh báo "Phiếu đã được tạo..." và
      nút "Thử tải lại chứng từ".
- Thử lại chỉ tải các tệp `status !== "uploaded"` trên đúng kết quả consume, không
  gọi consume lại.
- Trong lúc tải: khoá nút đóng (header + footer), khoá chọn/xoá tệp. Sau khi
  phiếu đã tạo, đóng drawer gọi `onConsumed(ids)` để danh sách/chi tiết phản ánh
  phiếu vừa tạo.
- `resetAll` xoá tệp chờ, kết quả đã tạo và trạng thái tải.

### Endpoint sửa phiếu xuất nháp

`PATCH /api/v1/outbound-documents/{id}` — middleware
`outbound.request.manual_create|outbound.import` +
`EnforceOutboundWarehouseScope`.

- Header bắt buộc `If-Match`; thiếu 428, lệch 412.
- Chỉ `status = DRAFT`; khác trả 409 `STATE_CONFLICT`.
- Draft quá 07 ngày trả 409 `DRAFT_EXPIRED` (dùng `assertDraftNotExpired`).
- Payload cho phép: `recipient_name` (bắt buộc nếu gửi, không rỗng),
  `recipient_address`, `recipient_contact_phone` (rỗng hoặc 10 số bắt đầu 0),
  `agency_id`, `request_date` (YYYY-MM-DD, không tương lai), `note`.
- Có `lines` trong payload → 422 `SOURCE_REQUEST_IMMUTABLE`.
- Cập nhật `stock_documents`: các field trên + `version + 1`, `updated_by/at`.
- Nếu có `outbound_request_id`: cập nhật đồng bộ `outbound_requests`
  (`recipient_name`, `recipient_address`, `customer_name`, `customer_address`,
  `customer_phone`, `agency_id`, `request_date`, `version + 1`, `updated_by/at`).
- Ghi audit `UPDATE_STOCK_DOCUMENT`; bump `stock:version` sau commit để read cache
  danh sách/chi tiết không trả bản cũ.
- Trả envelope chuẩn + `ETag` version mới.
- `GET /outbound-documents/{id}` bổ sung `request_no`, `request_date`,
  `agency_code`, `agency_name` để form sửa hiển thị đủ dữ liệu toa/đại lý.

### Form sửa thông tin

- Component mới `OutboundEditInfoModal` trong `src/modules/outbound/components/`.
- Nạp dữ liệu từ `GET /outbound-documents/{id}`; prefill các field.
- Đại lý: autocomplete gõ-để-lọc như form tiếp nhận (không tạo mới); chọn đại lý
  tự điền người nhận/địa chỉ như form tiếp nhận.
- Dòng SKU/số lượng: bảng chỉ đọc kèm ghi chú "chốt từ toa; muốn đổi hàng hãy
  huỷ phiếu và tạo lại".
- Chứng từ: `DocumentAttachmentsPanel documentType="OUTBOUND"`; chỉ cho
  thêm/xoá khi người dùng có `outbound.scan|outbound.post`.
- Footer: "Đóng" + "Lưu thông tin"; lưu xong toast, đóng form, làm mới chi tiết.
- Nút "Sửa thông tin" ở footer drawer chi tiết chỉ render khi `status = DRAFT`
  và người dùng có quyền sửa.

### Cập nhật contract/route guard

- `routes/api.php`: thêm route PATCH; cập nhật ghi chú "không có update" cũ.
- `OutboundDocumentController`: bỏ ghi chú ghost PATCH, thêm annotation OpenAPI
  cho operation mới (operationId `stock_out_update`) nếu đặt method ở controller
  hiện hành; cập nhật `CurrentBaselineDocumentController`.
- `docs/api-contract/WWHN-195-outbound-openapi.yaml`: thêm PATCH.
- `docs/contracts/HoaNam_Current_Baseline_Contract.json`: cập nhật ghi chú
  operation_count và retired/operation mô tả PATCH (nếu có).
- `docs/testing/WWHN-195-outbound-test-cases.json` và
  `scripts/verify-wwhn-195-outbound-contract.mjs`: đổi kỳ vọng "PATCH không tồn
  tại" thành "PATCH tồn tại đúng handler/permission".
- Test guard: `Wwhn195OutboundContractAlignmentTest`,
  `DocumentationBaselineContractTest`, `SwaggerRouteSyncTest` (nếu bị ảnh hưởng).

### Kiểm thử

Backend:
- PATCH cập nhật đúng header phiếu + toa, version/ETag, audit; dòng SKU không đổi.
- 428 thiếu If-Match; 412 sai version; 409 khi SCANNING/POSTED; 422 phone sai,
  recipient rỗng, có `lines`.
- Quyền: WAREHOUSE_STAFF được sửa; VIEWER bị 403.
- GET chi tiết trả `request_no`, `request_date`, `agency_code/name`.

Frontend:
- `OutboundIntakeModal.test.tsx`: chọn/xoá/từ chối tệp; chưa tạo phiếu chưa
  upload; consume xong mới upload đúng phiếu đầu; lỗi upload giữ drawer mở, thử
  lại chỉ upload tệp lỗi, không consume lại; lô nhiều phiếu chỉ gắn phiếu đầu.
- `OutboundEditInfoModal.test.tsx`: prefill; validate; gọi PATCH đúng payload +
  If-Match; lỗi 412 hiển thị; không cho sửa khi không phải DRAFT (nếu test qua
  detail).
- `AlignedOutboundDetailModal` test: nút sửa chỉ hiện với DRAFT + quyền; mở form
  và refresh sau khi lưu.
- Form nhập: chạy lại bộ test hiện có sau khi tách component.

### Xác minh

- FE: `npm test -- OutboundIntakeModal OutboundEditInfoModal InboundDraftModal
  AlignedOutboundDetailModal`, `npm run typecheck`, `npm run lint`,
  `npm run format:check`, `npm run build`.
- BE: `php artisan test --filter=OutboundDraftUpdate` (hoặc tên test mới), các
  test contract liên quan, `php artisan route:list` kiểm tra route PATCH.
- Kiểm tra thực tế drawer ở chế độ nhập tay và Excel; sửa một phiếu Nháp; mở tab
  chứng từ của phiếu vừa tạo; thử lại khi upload lỗi.
