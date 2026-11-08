# Nhà cung cấp trong form Tạo phiếu nhập — kiểm chứng

Ngày: 08/11/2026. Màn hình: `/inbound` (`IN-01`), drawer `Tạo phiếu nhập` / `Sửa phiếu nhập`.

## Phạm vi

- Thêm trường **Nhà cung cấp** bắt buộc vào form tạo/sửa đầu phiếu nhập.
- Tìm NCC phía server theo mã hoặc tên, chỉ lấy NCC `ACTIVE`, tối đa 20 dòng mỗi lần.
- Debounce 300ms; giữ kết quả cũ khi đang tải; giữ NCC đang chọn khi mở phiếu Sửa.
- Lưu `supplier_id` vào header phiếu; API chi tiết trả kèm object `supplier` để form Sửa hiện đúng tên.
- Không tạo NCC mới trong dropdown; chỉ chọn NCC có sẵn.
- UI dùng `UiAutocomplete` full width, khớp các input xung quanh; hỗ trợ dark mode và responsive.

## Thay đổi BE

- Migration `2026_11_08_000200_add_supplier_id_to_stock_documents.php`: thêm cột `supplier_id` (UUID, nullable) + index `idx_sd_supplier_id`.
- `POST/PATCH /api/v1/inbound-documents` nhận `supplier_id`, kiểm tra NCC tồn tại/ACTIVE và lưu vào `stock_documents`.
- Lỗi: `422 SUPPLIER_NOT_AVAILABLE`, `409 SUPPLIER_INACTIVE`.
- `GET /api/v1/inbound-documents/{id}` trả `data.supplier` gồm `id`, `code`, `name`, `display_name`, `status`, `version`; `null` nếu chưa chọn.
- API vẫn nhận `supplier_id = null` để không phá client header-only cũ; UI web bắt buộc chọn.

## Thay đổi FE

- `InboundDocument.supplierId`, `InboundDetail.supplier`, payload create/update `supplier_id`.
- Hook `useInboundSupplierSearch` dùng `listSuppliers` với `status=ACTIVE`, `page=1`, `per_page=20`, debounce 300ms, cache 60s.
- `UiAutocomplete` thêm `filterMode="server"` để không lọc lại kết quả server.
- `InboundDraftModal` validate thiếu NCC, giữ NCC đã chọn khi Sửa, hiển thị loading/rỗng/lỗi.
- Nhãn VI/EN/ZH.

## Kết quả kiểm tra

- BE `InboundSupplierFieldTest`: **8/8 đạt**.
- BE liên quan (`Gd1ScanDrivenInboundContractTest`, `SupplierWriteApiTest`): **28/28 đạt**.
- BE contract (`P04InboundContractTest`, `StockDocumentCanonicalFlowTest`): **38/38 đạt**.
- FE tập trung (`InboundDraftModal`, hook lookup, service, `UiAutocomplete`): **59/59 đạt**.
- FE typecheck: đạt. ESLint toàn bộ `src/`: đạt. Production build: đạt.
- Playwright Chromium: **1/1 đạt** — mở `/inbound`, xác nhận phiên, mở form, kiểm tra lỗi bắt buộc NCC, gõ tìm `Honda`, chọn `NCC-001 - Honda Việt Nam`, lưu và xác nhận payload `supplier_id`.

## Giới hạn

- E2E dùng API mock cùng contract, không ghi dữ liệu vào server thật.
- API vẫn nullable; nếu cần chặn cứng ở BE phải cập nhật toàn bộ client/test header-only.
- Phiếu cũ không có NCC sẽ yêu cầu chọn NCC khi Sửa.
- Chỉ lưu `supplier_id`; tên NCC trong chi tiết là tên hiện hành. Chưa snapshot tên/version vào chứng từ.
- Chưa cập nhật projection báo cáo P12 cho NCC của phiếu web; nếu báo cáo cần hiển thị NCC, làm follow-up.
