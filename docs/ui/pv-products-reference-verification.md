# MST-PV-01 — đối chiếu giao diện

Ngày kiểm tra: 2026-09-22. Làm trực tiếp trên nhánh dev tại C:/LAM_PHONG_TECH/HoaNam_FE/WMS_Warehouse_Hoa_Nam_FE.

## Nguồn tham chiếu

Gallery: https://duc-nguyen98.github.io/SystemHNWeb/drive-gallery.html?v=9ff2914

Nhóm Sản phẩm App PV hiện cung cấp hai ảnh default:

- Desktop 1672×941: https://duc-nguyen98.github.io/SystemHNWeb/previews/drive-screens/originals/san-pham-app-pv/desktop/hn-san-pham-app-pv-p01-default-desktop-1672x941-review-91d8c68321.png
- Tablet 992×1586: https://duc-nguyen98.github.io/SystemHNWeb/previews/drive-screens/originals/san-pham-app-pv/tablet/hn-san-pham-app-pv-p01-default-tablet-992x1586-review-1a2e6a6f33.png

Không có ảnh tham chiếu riêng cho modal, hover, loading, lỗi hay các thao tác trong nhóm này. Những trạng thái đó tiếp tục dùng luồng hiện có, áp dụng cùng kiểu giao diện. Chưa thể chứng nhận khớp pixel 100% mọi trạng thái từ hai ảnh tĩnh.

## Phạm vi

- Header, thông tin phạm vi kho, App Preview, thêm sản phẩm.
- Tổng quan, bộ lọc, bảng/thẻ, trạng thái hiển thị, menu dòng, phân trang, biểu mẫu và dropdown.
- Màu và nhịp chữ sử dụng token chung của Tổng quan vận hành; tiêu đề 24px, tiêu đề khối 17px, nội dung 13–14px, giảm phù hợp trên điện thoại.
- CSS riêng PV; MainLayout chỉ bổ sung own-header, kích thước sidebar và quyền mở/thu gọn sidebar cho route PV. Những thay đổi khác trong MainLayout thuộc phiên phối hợp.
- Hai nút Xem trước App PV và cấu hình kho dùng router nội bộ, tránh tải lại toàn trang; nút cấu hình kho giữ kiểm tra quyền.
- Không sửa API, service, payload, quyền quản lý/publish, kiểm soát phiên bản hoặc quy trình tải ảnh.

## Dữ liệu thực

Tổng sản phẩm lấy từ meta API. Đếm hiển thị/ẩn/thiếu ảnh lấy từ các hàng của trang đang thấy, có nhãn chỉ rõ phạm vi. Bộ lọc nhóm vẫn lọc trang hiện tại như trước. Không giả lập tổng trạng thái toàn hệ thống.

API hiện chưa có hợp đồng updated_at cho hồ sơ PV; cột Cập nhật chỉ hiển thị thời gian khi bản ghi thực sự có giá trị hợp lệ, còn lại là dấu gạch. Không dùng thời gian tải trang thay cho thời gian cập nhật bản ghi.

## Kiểm tra

- PV: 30/30 kiểm thử đạt, gồm 9 ca tương tác mới và 21 ca sẵn có về danh mục, trường ảnh, upload và hợp đồng publish If-Match.
- ESLint các file PV đạt. MainLayout không có lỗi ESLint, còn một cảnh báo useEffect đã có.
- Vite production bundle đạt. TypeScript toàn dự án còn 5 lỗi ngoài phạm vi ở PackingLabelPrintReport.tsx (version và busy); không có diagnostic PV/MainLayout.
- UiAppShell 5/5 đạt; SideNav 11/12 đạt. Ca lỗi còn lại kỳ vọng tên thương hiệu cũ Hoa Nam WMS trong khi component hiện hiển thị HOA NAM SCANNER; test này không render MainLayout.
- Các guard CSS/token toàn dự án vẫn có lỗi ở file ngoài PV; không tăng whitelist màu để che lỗi đó.
- Browser: menu sửa, dữ liệu form, validation thiếu trường, dropdown, hủy form, tìm kiếm không kết quả, reset, đổi bảng/thẻ, liên kết xem trước và mở/thu gọn sidebar. Không lưu/publish thử vào dữ liệu thật.
- Console PV không có error trong lượt kiểm tra cuối.

Đã đo viewport thực tại 1672×941, 1366×768, 1280×800, 1024×1366, 992×1586, 768×1024, 600×960, 390×844, 320×740: document không tràn ngang, các panel/ô nhập/nút header/phân trang không vượt viewport. Đã sửa bó chữ tablet, kiểm tra lại ảnh desktop/tablet, giữ cuộn nội bộ bảng ở khổ hẹp và thẻ trên điện thoại. Kiểm tra bổ sung sidebar tại 1280px mở 242px và thu gọn 86px hoạt động.

Trong kiểm tra hard reload đã gặp phiên chuyển về /login; reload /login khôi phục đăng nhập tự động theo cấu hình dev sẵn có. Không thay đổi auth, token hay môi trường. Điều hướng mới của PV đã chuyển sang router nội bộ để không chủ động khởi động lại phiên.

Sau sửa điều hướng: đã mở /pv, thấy danh mục công khai có dữ liệu thật, quay lại /master-data/pv-products bằng Back và vẫn giữ phiên; sidebar đúng86px tại viewport1280px. Ca kiểm thử MemoryRouter xác minh Preview và cấu hình kho điều hướng nội bộ, giữ authentication và quyền warehouse.view.
