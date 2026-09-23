# OUT-01 — đối chiếu giao diện và kiểm tra hồi quy

Ngày kiểm tra: 23/09/2026.

## Phạm vi

- Làm trực tiếp trên nhánh `dev` tại `C:\LAM_PHONG_TECH\HoaNam_FE\WMS_Warehouse_Hoa_Nam_FE`.
- Chỉ thay giao diện danh sách phiếu xuất, bổ sung bộ lọc người nhận bằng API đọc hiện có, đồng bộ giao diện hộp tiếp nhận/chi tiết và lịch chọn ngày. Không đổi API ghi, quyền, payload nghiệp vụ hoặc điều kiện quét/xuất/hủy/in.
- Giữ shell và điều hướng chung của ứng dụng; CSS mới được giới hạn bằng lớp OUT-01 và hộp thoại outbound.
- Các thay đổi đang có ở màn khác trong working tree không thuộc đợt triển khai này.

## Nguồn đối chiếu

Gallery: https://duc-nguyen98.github.io/SystemHNWeb/drive-gallery.html?v=9ff2914

Nhóm `Xuất kho · Phiếu xuất kho` thực tế có **2 ảnh trạng thái mặc định**:

- Desktop 1920 × 1080: https://duc-nguyen98.github.io/SystemHNWeb/previews/drive-screens/originals/xuat-kho/desktop/hn-xuatkho-phieuxuatkho-p01-default-desktop-1920x1080-locked-v1-0-98f30bd216.png
  - SHA256: `98F30BD216BFBFA91A31B23E38477997DE9392D30A16D7F9E3BB0F8DDB79E902`
- Tablet 1600 × 2560: https://duc-nguyen98.github.io/SystemHNWeb/previews/drive-screens/originals/xuat-kho/tablet/hn-xuatkho-phieuxuatkho-p01-default-tablet-1600x2560-locked-v1-0-e79d5f7d2c.png
  - SHA256: `E79D5F7D2C2B395C1BF58781FB6947518203BBDB08AA7F32EA26D60FE31B1BD4`

Bản ảnh tải để đối chiếu nằm trong `.agent-cache/out01-reference/`. Nguồn không có ảnh riêng cho hộp tiếp nhận/chi tiết, loading, lỗi, rỗng, hover, lịch hoặc hoạt ảnh OUT-01. Những trạng thái đó giữ luồng sẵn có và áp dụng hệ màu/kích thước của màn; không thể chứng nhận trùng 100% một trạng thái chưa được cung cấp. Số liệu và nội dung phiếu lấy từ hệ thống thật, không sao chép số liệu mẫu trên ảnh.

## Giao diện đã thực hiện

- Tiêu đề, mô tả, thông tin kho thật, nút tiếp nhận theo quyền.
- Tổng phiếu và bốn trạng thái lấy từ tổng phân trang của API, không lấy số hàng đang hiển thị để giả làm tổng. Loading/lỗi dùng dấu chưa có dữ liệu, số 0 chỉ dành cho tổng rỗng hợp lệ, có thử lại.
- Khối tìm kiếm, chọn trạng thái/người nhận, sắp xếp, áp dụng, đặt lại, phân trang; trạng thái focus/hover/disabled.
- Tooltip sắp xếp giữ đủ ba trạng thái bằng prop `tooltipLabel` tùy chọn của `SortableTh`; các nơi không truyền prop giữ hành vi cũ. Có kiểm thử tooltip và thứ tự hàng sau từng lần bấm.
- Bảng desktop đủ tám cột; tablet gom thành năm nhóm; điện thoại chuyển từng phiếu thành thẻ với đầy đủ dữ liệu và thao tác.
- Thanh đối chiếu, màu trạng thái, biểu tượng và các cảnh báo mã toa thiếu giữ dữ liệu thực tế.
- Cỡ chữ theo dashboard snapshot: tiêu đề `clamp(21px, 1.7vw, 28px)`, tiêu đề khối 20/18px, mô tả/ô nhập 14px, trường nhập cao 40px; điện thoại rất hẹp giảm tiêu đề xuống 20px. Đối chiếu với `dashboard-overview.css` các lớp `.snapshot-heading` và `.snapshot-card`.
- Lịch ngày yêu cầu dùng bộ chọn ngày chung, màu chọn xanh/trắng, hiển thị Việt Nam; payload vẫn `YYYY-MM-DD`, có thể bỏ trống/xóa, không chọn ngày tương lai.
- Hộp thoại tự cuộn và co theo màn hình; trường SKU, mã quét, máy in không đẩy hộp thoại ra ngoài.

## Bảo toàn hành vi và dữ liệu

- Quyền tiếp nhận, quét, xem và các điều kiện DRAFT/SCANNING/POSTED/CANCELLED giữ nguyên.
- Search debounce 250ms; API search/status/sort, trang và kích thước trang giữ hành vi hiện có.
- Các deep link OUT-REQ-01, OUT-02, OUT-03, LBL-01, RFID-01; nút Back, đóng modal; tiếp nhận xong mở phiếu đầu tiên và làm mới dữ liệu liên quan vẫn hoạt động.
- API chưa có tham số người nhận. Chỉ khi mở bộ lọc mới tải các trang được API cho phép (100 dòng/trang), kiểm tra bộ dữ liệu đầy đủ rồi lọc đúng tên trước khi chia trang. Có hủy tác vụ và báo lỗi/thử lại khi tổng/trang thay đổi, thiếu dòng hoặc quá 1.000 trang; không trả kết quả thành công bị thiếu phiếu.
- Không thực hiện tạo phiếu, quét, xuất, hủy hay xóa dữ liệu thật trong kiểm tra trình duyệt.

## Kiểm tra

- Bộ outbound + hợp đồng flow06: **8 file, 74/74 test đạt (lượt cuối chạy tuần tự)**. Bao gồm quyền, tìm kiếm/lọc, bộ lọc người nhận ở trang sau, phân trang, lỗi/thử lại, deep link/Back, tiếp nhận → chi tiết, tổng trạng thái, ngày gửi lên, nhãn đóng gói và service QR.
- Kiểm tra trực tiếp với dữ liệu API thật: 211 phiếu; lọc một người nhận cho đủ 10 phiếu; đặt lại; trạng thái đang quét có tỷ lệ 1/2 và mở đúng hộp chi tiết.
- Đo DOM ở các chiều rộng **320, 360, 390, 600, 768, 820, 992, 1024, 1280, 1366, 1600, 1920px**: chiều rộng tài liệu bằng viewport; các ô/nút của OUT-01 không vượt hai cạnh. Đã sửa ghi chú bị kế thừa `nowrap` và thông tin kho tràn ở breakpoint 600px.
- Đã xem bố cục tablet 992px với sidebar mở và thu gọn, điện thoại 390px; modal chi tiết 320px rộng 300px (x=10..310), không có input/button vượt khung.
- Lịch ở 320 × 740: popup rộng 272px, nằm trọn trong màn; ngày chọn 22/09 có nền `rgb(0,123,255)`, chữ trắng; các ngày sau hôm nay bị khóa; Escape đóng popup.
- Vite bundle cuối đã đạt sau khi các file đang được bổ sung đồng thời ở màn bảo hành xuất hiện đầy đủ (10,52 giây). Chạy toàn bộ `npm run build` vẫn bị chặn bởi các lỗi TypeScript đã có tại `PackingLabelPrintReport.tsx` (4 lỗi `version`, 1 lỗi kiểu prop boolean).
- ESLint outbound: 0 lỗi, 6 cảnh báo hook sẵn có; Prettier và `git diff --check` của file liên quan đạt.
- Guard kiến trúc UI đạt. Guard style/token/icon toàn repo còn vi phạm ở các màn khác; OUT-01 đã đăng ký CSS và palette đúng allowlist, không bổ sung ngoại lệ rộng.

Các log cục bộ: `.agent-cache/out01-reference/tests-final.log`, `typecheck-final.log`, `build-final.log`.

Trong một lượt chạy phụ, bài thử retry vượt 20 giây khi máy đang chạy nhiều tác vụ. Chạy riêng rồi chạy toàn bộ tuần tự đều đạt, không nới timeout. Đo trực tiếp trên browser cũng xác nhận dashboard và OUT-01 cùng font Public Sans, tiêu đề desktop 28px và mô tả 14px. Khung viewport thử nghiệm đã được khôi phục, modal đóng và danh sách trả về bộ lọc mặc định.
