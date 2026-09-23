# REV-00 — đồng bộ giao diện với Danh sách SKU

Ngày: 23/09/2026. Thực hiện trên nhánh dev, tại C:\LAM_PHONG_TECH\HoaNam_FE\WMS_Warehouse_Hoa_Nam_FE.

## Nguồn và phạm vi

Theo yêu cầu bổ sung của người dùng, dùng giao diện Danh sách SKU hiện có (sku-list.css / MST-01) làm chuẩn màu và tỷ lệ. Không tuyên bố khớp bộ ảnh REV-00 vì gallery được cung cấp chưa có nhóm này.

- Palette xanh đậm/xanh nhạt, border, focus, hover, disabled, menu, phân trang và badge đồng bộ SKU.
- Giữ header hiện tại cùng phạm vi dữ liệu/vai trò thật; chữ tiêu đề 24px/38px, mô tả 14px/21px, bảng 13px, tiêu đề cột 12px, nút 14px/cao 38px. Đo thực tế input/select 15px theo đúng màn SKU đang chạy (theme input của SKU ghi đè cỡ root 14px).
- Bộ lọc có nhãn rõ ràng, tự xếp hàng theo bề rộng nội dung. Bảng cuộn trong khung, nút Mở ghim bên phải; điện thoại tiếp tục dùng card của ResponsiveDataTable, lý do dài được xuống dòng.
- Hộp tạo, chi tiết, xác nhận và portal xem/xóa chứng từ có hook CSS riêng. Trường rộng 320px được co theo điện thoại; mã dài, trạng thái và nút dài xuống dòng.
- CANCELLED/error và chờ hàng/warning giữ đúng ngữ nghĩa. Không bổ sung KPI, ngày lọc hoặc API mới. Màn này hiện không có date picker.

CSS giới hạn trong hn-reversal-screen/dialog/menu và shell chỉ khi màn đang hiện. Không thay đổi CSS SKU/global. Có hai prop giao diện tùy chọn ở thành phần chung: ResponsiveDataTable.headerCellStyle và DocumentAttachmentsPanel.dialogClassName; caller khác giữ mặc định.

## Bảo toàn nghiệp vụ

Giữ nguyên service, types, hooks, tìm kiếm debounce 250ms, lọc trạng thái phía server, phân trang, quyền tạo/xem, sort cột, deep link REV-01/REV-02, tạo→chi tiết→đính kèm→hoàn tất, xác nhận hàng về, lý do hủy, If-Match/version, idempotency, evidence gate và invalidation. Browser chỉ đọc/lọc/mở/đóng; không tạo, ghi sổ, hủy hoặc tải chứng từ thật.

## Xác minh

- 60/60 test đạt, 9 file: toàn bộ reverse và 3 suite ResponsiveDataTable cùng DocumentAttachmentsPanel. Thêm 8 test cho tìm kiếm/lọc/trang/quyền/deep link/tạo→mở chi tiết/lỗi→thử lại. Một số test chi tiết sẵn có phát cảnh báo React act nhưng đều đạt.
- Vite production bundle cuối đạt (exit code 0).
- ESLint file đã sửa, Prettier và git diff --check đạt. ui:architecture đạt.
- Typecheck toàn dự án chỉ còn 5 lỗi có sẵn ở PackingLabelPrintReport.tsx: bốn truy cập version và một prop boolean. Không có lỗi ở file thay đổi của REV.
- ui:styles/ui:tokens toàn dự án còn vi phạm sẵn có ở shell/auth/report; stylesheet REV đăng ký đúng allowlist, không thêm !important.
- Browser kiểm tra 10 chiều rộng:320,390,600,768,820,992,1024,1280,1440,1920px. Document.scrollWidth bằng viewport; ô lọc/nút không tràn ngang. Bảng nhiều cột dùng cuộn ngang nội bộ.
- Xem trực quan danh sách điện thoại 390/320, tablet 820/1024, menu trạng thái, loading/modal, kết quả rỗng. Lọc Nháp trả 13 phiếu từ tổng 41; trạng thái ban đầu và tìm kiếm đã khôi phục.
- Hộp tạo/chi tiết ở 320px rộng 296px, từ x12 đến 308; scrollWidth bằng clientWidth 294px, không có input/button/combobox vượt viewport. Đã kiểm tra phiếu chờ xác nhận hàng về và dropdown tình trạng hàng.
- Console browser không ghi nhận lỗi trong tab kiểm tra. Viewport đã khôi phục mặc định.

Không sửa/ghi mã nguồn tại OneDrive; không tạo nhánh/commit/push.
