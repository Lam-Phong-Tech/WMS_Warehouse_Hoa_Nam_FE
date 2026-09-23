# IN-01 — đối chiếu giao diện danh sách phiếu nhập

Ngày kiểm tra: 23/09/2026.

## Phạm vi

- Dự án: `C:\LAM_PHONG_TECH\HoaNam_FE\WMS_Warehouse_Hoa_Nam_FE`, nhánh `dev`.
- Màn: `/inbound?screen=IN-01`, hộp thoại tạo/sửa thông tin phiếu và lịch chọn ngày.
- Giữ API, quyền thao tác, luồng tạo/lưu → quét, xem/theo dõi phiếu, deep link IN-02/IN-03, Back, lọc và phân trang hiện có.
- CSS được giới hạn vào màn IN-01 và hộp thoại nhập kho. Không sửa shell dùng chung hay các màn báo cáo trong công việc này.
- Working tree đã có nhiều thay đổi ở các màn khác; chúng không thuộc phạm vi công việc này.

## Nguồn tham chiếu

[Gallery do người dùng cung cấp](https://duc-nguyen98.github.io/SystemHNWeb/drive-gallery.html?v=9ff2914).

Nhóm `nhap_kho/danh_sach_phieu_nhap_kho` hiện có đúng hai ảnh trạng thái mặc định:

| Thiết bị | Kích thước ảnh thật | SHA-256                                                            |
| -------- | ------------------- | ------------------------------------------------------------------ |
| Desktop  | 1920 × 1080         | `a2b7207a5ea242bd4fcd3c47f0c4ed26acb6c66472f8c745d8a3b6b61e3161b1` |
| Tablet   | 992 × 1586          | `3633194fee12a3e096537d25e2936943f788ac47bbe39c0eb72946abd16733cc` |

Tên file tablet chứa 1600x2560 nhưng manifest và ảnh thực tế là 992x1586. Các ảnh cùng manifest được lưu ở `.agent-cache/in01-reference/` (không đưa vào Git).

Không có ảnh bổ sung của menu, hộp thoại hoặc lỗi trong nhóm này. Vì vậy không khẳng định các trạng thái không có ảnh đạt trùng khớp từng pixel hay từng hiệu ứng; chúng sử dụng các tương tác và quy tắc sẵn có của ứng dụng.

## Phần đã triển khai

- Header, thông tin kho, nút tạo, khối theo dõi nhập kho, tiến độ, thẻ chỉ số và ghi chú Scanner App.
- Màu xanh, đường viền, badge, icon, khoảng cách và kích thước chữ thống nhất trong màn: tiêu đề co giãn 21–28px (20px ở điện thoại), tiêu đề khối 20px/18px, nội dung 14px, trường nhập 40px; dùng cùng thang tiêu đề đang chạy thực tế ở trang tổng quan vận hành.
- Thanh tìm kiếm/lọc/áp dụng/đặt lại/sắp xếp; bảng desktop, bảng gộp thông tin trên tablet và thẻ phiếu trên điện thoại.
- Thao tác theo trạng thái phiếu, menu bổ sung, trạng thái tải/rỗng/lỗi, phân trang và chọn số dòng.
- Lịch chọn ngày đồng bộ màu xanh, giới hạn ngày và kiểm tra ngày ISO giữ nguyên; hỗ trợ kích thước hẹp, bàn phím và chế độ tối bằng màu cục bộ.
- Sửa trạng thái khởi tải chi tiết: hiển thị Đang tải dữ liệu…, không báo phiếu đã kết thúc khi chưa có dữ liệu hoặc khi tải lỗi. Có hai kiểm thử hồi quy riêng.
- Không ghi dữ liệu phiếu khi kiểm tra trình duyệt.

## Dữ liệu thật và khác biệt có chủ đích để giữ luồng

- Tổng phiếu/nháp/đang ghi nhận/đã nhập lấy từ `meta.total` của API; không cộng riêng trang hiện tại rồi gọi đó là tổng toàn hệ thống.
- API không cung cấp tổng số mã quét toàn bộ: ô Mã đã quét hiển thị `—` cùng giải thích khi chưa có số liệu; không dựng số liệu giả.
- API hiện không có bộ lọc nguồn nhập riêng: giữ bộ lọc Thông tin SKU hiện có. Nút Áp dụng và Đặt lại dùng đúng tham số API sẵn có.
- Số SKU chỉ tính từ các dòng thực sự được API gửi về; thiếu dữ liệu dòng không được diễn giải thành 0 SKU.
- Số lượng đã quét hiển thị đúng ý nghĩa dữ liệu hiện có; không đổi nhãn thành số mã nếu backend không cung cấp số mã.
- Giữ shell/sidebar của ứng dụng; không ép thay kích thước toàn bộ ứng dụng theo ảnh của riêng IN-01.

## Kiểm tra

| Kiểm tra                                                        | Kết quả                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Vitest toàn bộ module inbound + date-rules                      | 7 file, 100/100 test đạt                                                                    |
| Tạo → lưu → quét, sửa nháp, theo dõi SCANNING, xem POSTED       | Test tương tác đạt                                                                          |
| Quyền chỉ xem, menu, deep link cũ, Back                         | Test tương tác đạt                                                                          |
| Debounce/tìm kiếm/áp dụng/đặt lại, phân trang, rỗng/lỗi/thử lại | Test tương tác đạt                                                                          |
| Tổng API và trạng thái thiếu/lỗi dữ liệu                        | Test đạt                                                                                    |
| Ngày hợp lệ/không hợp lệ, giới hạn ngày, payload lưu            | Test đạt                                                                                    |
| ESLint module inbound                                           | 0 lỗi, 3 cảnh báo hooks hiện có                                                             |
| Prettier các file IN-01 thay đổi                                | Đạt                                                                                         |
| git diff --check                                                | Đạt                                                                                         |
| ui:architecture                                                 | Đạt                                                                                         |
| Vite build riêng                                                | Đạt; đầu ra `.agent-cache/in01-reference/build`                                             |
| TypeScript toàn dự án                                           | Chưa đạt: 5 lỗi ở PackingLabelPrintReport.tsx ngoài phạm vi                                 |
| ui:styles / ui:tokens / ui:icons toàn dự án                     | Còn 12 / 14 / 5 vi phạm ở các file ngoài phạm vi IN-01; không báo lỗi ở file IN-01 đã chỉnh |

Đã kiểm tra hình trực tiếp ở desktop 1280px, tablet 992px (cả sidebar mở/rút), điện thoại 390px; thực hiện kiểm tra DOM tràn ngang tại 320, 360, 390, 600, 768, 820, 992, 1024, 1280, 1366, 1600 và 1920px. Lần quét DOM nhiều kích thước có thể ghi nhận lúc chuyển động shell chưa kết thúc; nó bổ sung cho đối chiếu hình, không phải chứng nhận pixel-perfect cho mọi kích thước.

Đã thử trực tiếp tìm kiếm không có kết quả và đặt lại, lọc trạng thái, mở luồng theo dõi, mở/đóng form, chọn ngày và xác nhận màu ngày chọn cùng ngày tương lai bị khóa. Không tạo/sửa/xóa phiếu thật để kiểm tra.

Người dùng đã đăng nhập lại sau khi phiên localhost hết hạn. Đã kiểm tra bổ sung bản cuối tại 320px, 820px, 992px và 1920px sau khi bố cục ổn định: không có tràn ngang hoặc điều khiển ra ngoài viewport; desktop 7 cột, tablet gộp 4 cột, điện thoại dạng thẻ. Đã mở menu, chuyển sang trang 2, mở theo dõi SCANNING và sửa DRAFT rồi đóng không lưu. Lịch sáng ở 320px nằm trong khoảng x=27–299px, dialog x=10–310px; lịch tối và dialog đều có nền #192c43, chữ sáng và ngày chọn xanh. Escape đóng lịch đúng. Đã khôi phục chế độ Sáng, bộ lọc Tất cả và sidebar ghim mở. Trang tổng quan vẫn hiển thị sau khi điều hướng qua lại; tiêu đề desktop của IN-01 đã được đối chiếu cùng thang 28px/20px, tablet 21px/18px, điện thoại 20px/18px. Không đọc hoặc lấy thông tin đăng nhập.

### Lỗi TypeScript ngoài phạm vi

`src/modules/reports/packing-label/PackingLabelPrintReport.tsx`:

- Các dòng 194, 201, 234, 241: `LabelSnapshotRecord` không có thuộc tính `version`.
- Dòng 301: `boolean | "pdf" | "xlsx"` không gán được cho `boolean | undefined`.

Log kiểm thử và typecheck nằm tại `.agent-cache/in01-reference/tests-final.log` và `.agent-cache/in01-reference/typecheck-final.log`.
