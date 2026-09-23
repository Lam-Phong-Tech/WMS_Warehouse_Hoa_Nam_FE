# WAR-04 — đối chiếu giao diện và kiểm chứng

Ngày kiểm tra: 23/09/2026. Thư mục: `C:\LAM_PHONG_TECH\HoaNam_FE\WMS_Warehouse_Hoa_Nam_FE`. Nhánh: `dev`.

## Nguồn tham chiếu

- [Gallery được chỉ định](https://duc-nguyen98.github.io/SystemHNWeb/drive-gallery.html?v=9ff2914).
- [WAR-04 desktop 1920×1080](https://duc-nguyen98.github.io/SystemHNWeb/previews/drive-screens/originals/business-v1/hn-bao-hanh-phieu-xuat-linh-kien-p01-default-desktop-1920x1080-business-v1-review-0505b1c0ac.png).
- [WAR-04 tablet 1600×2560](https://duc-nguyen98.github.io/SystemHNWeb/previews/drive-screens/originals/business-v1/hn-bao-hanh-phieu-xuat-linh-kien-p01-default-tablet-1600x2560-business-v1-review-80fee064ea.png).

Nhóm màn hình này có hai ảnh mặc định đã tìm thấy trong gallery. Không có ảnh trạng thái modal, lỗi, tải hoặc mobile trong nhóm để xác nhận pixel tuyệt đối cho các trạng thái đó. Không coi ảnh tĩnh là bằng chứng về thời gian chuyển động hay nghiệp vụ. Các trạng thái chưa có ảnh sử dụng luồng sẵn có và hệ thống UI của ứng dụng.

## Phạm vi thực hiện

- Bố cục đầu trang, kho, tổng quan ghi sổ, thông báo tồn kho, bộ lọc, bảng, trạng thái, hành động và phân trang theo ảnh.
- Font Public Sans theo token chung; tiêu đề 24px, tiêu đề khối 18px, điều khiển 40px. CSS giới hạn trong WAR-04 và dialog/menu có class riêng. Không sửa sidebar/topbar toàn hệ thống trong công việc này.
- Desktop có 7 cột. Khi vùng nội dung thu hẹp, thông tin linh kiện và theo dõi được gộp vào 5 cột. Mobile chuyển thành thẻ với nội dung có thể xuống dòng.
- Thống kê, bảng, kho, hồ sơ, linh kiện, tracking đều từ API. Không thay dữ liệu thật bằng số liệu mẫu trong ảnh.
- Tìm kiếm giữ debounce; trạng thái/phân trang giữ API hiện có. API không có bộ lọc tracking nên lấy đủ các trang khớp điều kiện, xác định tracking từ SKU đúng ID rồi lọc/phân trang hiển thị. Không dùng dữ liệu của một trang để báo tổng toàn bộ.
- Bổ sung giới hạn đồng thời 5 lượt đọc metadata; dùng cache query hiện có. Lỗi hoặc dữ liệu chưa đủ không được hiển thị thành tổng 0 giả.
- Nút tạo chọn hồ sơ thật rồi mở ComponentIssueModal hiện có. Luồng tạo/quét/ghi sổ/hủy, quyền, che PII, kiểm tra tồn, If-Match và idempotency giữ nguyên. File modal chỉ thêm className tùy chọn vào các dialog.
- Có tải lần đầu, đang làm mới, rỗng, lỗi/thử lại, mất mạng, dữ liệu bổ sung chưa tải được, thiếu quyền và các trạng thái phiếu.
- Ảnh WAR-04 và màn cũ không có bộ lọc ngày có thể chỉnh; không tự thêm bộ chọn ngày. Ngày trên bảng giữ dữ liệu thật, định dạng thống nhất DD/MM/YYYY · HH:mm.

## Kiểm tra trình duyệt với dữ liệu thật

Dùng browser Codex và trang QA iframe cùng origin để kiểm tra viewport thực tế. Override viewport của browser không thay đổi kích thước thực nên số đo bên dưới lấy trực tiếp từ DOM trong iframe. File QA nằm trong `test-results/war04/` (bị git ignore), không thuộc sản phẩm.

| Viewport  | Bề rộng trang | Vùng WAR-04 / scrollWidth | Bố cục |
| --------- | ------------: | ------------------------: | ------ |
| 1920×1080 |          1920 |               1564 / 1564 | 7 cột  |
| 1600×2560 |          1600 |               1252 / 1252 | 5 cột  |
| 1440×900  |          1440 |               1084 / 1084 | Bảng   |
| 1024×1366 |          1024 |                 668 / 668 | Bảng   |
| 820×1180  |           820 |                 764 / 764 | Bảng   |
| 768×1024  |           768 |                 712 / 712 | Bảng   |
| 390×844   |           390 |                 334 / 334 | Thẻ    |
| 320×720   |           320 |                 264 / 264 | Thẻ    |

Không ghi nhận tràn ngang của WAR-04 ở các kích thước đã đo. Đã xem ảnh render ở desktop, tablet và mobile; các ô lọc cao 40px.

Đã thử trên UI:

- Mở phiếu nháp từ nút hàng và xem biểu mẫu quét; ghi sổ bị khóa khi chưa đủ điều kiện.
- Nút tạo → chọn hồ sơ đang hoạt động → đúng biểu mẫu tạo hiện có; hồ sơ kết thúc bị vô hiệu hóa theo quy tắc sẵn có.
- Lọc Nháp; kết hợp Nháp + Serial trả về dữ liệu tương ứng.
- Tìm một từ không khớp → thông báo rỗng → Xóa bộ lọc phục hồi danh sách.
- Menu thao tác có mở phiếu, xem hồ sơ, kho và ghi chú; có thể đóng bằng Escape.
- Dropdown mobile nằm trong viewport; bảng chuyển thành thẻ tại 390px và 320px.

Không tạo, ghi sổ, quét hoặc hủy dữ liệu thật để kiểm tra giao diện. Các thao tác ghi được kiểm chứng bằng test hiện có.

## Kiểm thử và giới hạn xác nhận

- Helper dữ liệu: 16/16; tổng quan: 12/12; chọn hồ sơ: 4/4; modal hiện có: 7/7; service hiện có: 12/12. Tổng 51 test của 5 suite này đạt.
- Trang danh sách: 16/16 test đạt. Tổng cộng 67/67 test của 6 suite liên quan đạt. Bao gồm bộ lọc/reset, phân trang, SKU/tracking, hành động, rỗng/lỗi, PII, sao chép không mở phiếu, tổng chưa xác định, ngày hiển thị/sắp xếp và server giới hạn số dòng.
- Sửa race của debounce: chỉ đặt lại trang khi từ khóa thực sự thay đổi; chuyển trang nhanh sau mount không bị timer cũ đưa về trang 1.
- Prettier của các file sản phẩm WAR-04 đạt. ESLint không lỗi; ComponentIssueModal có hai cảnh báo setState trong effect từ mã cũ không thay đổi.
- git diff --check trong phạm vi file chỉnh sửa đạt.
- `npm run build` chưa đạt: PackingLabelPrintReport.tsx có bốn lỗi trường version (dòng 194, 201, 234, 241) và kiểu boolean ở dòng 300. Không có lỗi WAR-04 trong kết quả build này. File báo cáo nằm ngoài phạm vi.
- `npm run ui:guards`: architecture, dependencies và các self-test đạt; tokens/styles/icons còn lỗi ngoài WAR-04. Kết quả không nêu vi phạm ở các file WAR-04. Không thay allowlist hoặc sửa báo cáo khác để che các lỗi này.

Đây là bằng chứng cho các kích thước và luồng đã kiểm tra, không phải khẳng định khớp 100% mọi pixel hoặc mọi trạng thái chưa có ảnh tham chiếu. Số dòng mỗi trang và số liệu giữ theo hệ thống thật thay vì dữ liệu minh họa trong ảnh.
