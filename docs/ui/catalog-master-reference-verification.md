# MST-CAT-01 — đối chiếu giao diện và kiểm tra

Ngày kiểm tra: 23/09/2026. Nhánh làm việc: `dev`.

Dự án: `C:\LAM_PHONG_TECH\HoaNam_FE\WMS_Warehouse_Hoa_Nam_FE`.

Màn hình: http://localhost:5173/master-data/catalog?screen=MST-CAT-01

Nguồn ảnh: https://duc-nguyen98.github.io/SystemHNWeb/drive-gallery.html?v=9ff2914

## Phạm vi và điểm chưa thể đối chiếu 1:1

Đã đọc 40 ảnh gốc của nhóm `danh_muc_san_pham`: P01–P20 cho desktop và tablet. Manifest và ảnh dùng kiểm tra nằm trong thư mục bỏ qua bởi Git `test-results/catalog-reference/`.

Ảnh tham chiếu thể hiện danh sách sản phẩm gốc, số SKU, nhóm, đơn vị tính và ngày cập nhật. Route MST-CAT-01 hiện tại quản lý năm loại danh mục BRAND, CATEGORY, MODEL, POWER_SOURCE, PACKAGE. Hợp đồng API hiện có không cung cấp các KPI sản phẩm gốc/số SKU/đơn vị/ngày cập nhật theo hàng của ảnh. Vì yêu cầu chỉ thay đổi UI và giữ nguyên nghiệp vụ, bản sửa giữ năm tab, trường nhập, quyền, API, phân trang và luồng tạo/sửa hiện tại. Tổng số và thời điểm tải dữ liệu dùng giá trị thật từ truy vấn. Không tạo số liệu giả, không đổi nghĩa trường để ép khớp ảnh.

Do khác biệt trên, đây chưa phải bản khớp 100% nội dung hoặc từng pixel. Việc thay màn này thành danh sách sản phẩm gốc cần xác nhận phạm vi và hợp đồng dữ liệu; câu hỏi làm rõ đã được gửi trong cuộc hội thoại.

## Đối chiếu các trạng thái

| Ảnh (desktop + tablet) | Nội dung ảnh | Áp dụng trong phạm vi hiện tại |
| --- | --- | --- |
| P01 | Danh sách mặc định | Màu, font, khoảng cách, filter, table, badge, phân trang; giữ năm danh mục và cột thật. Không có KPI sản phẩm gốc. |
| P02 | Tải lần đầu | Skeleton danh sách thật trong lúc query đang tải; không dựng KPI chưa có dữ liệu. |
| P03 | Đang làm mới | Thanh tiến trình, spinner nút, giữ hàng đang hiển thị. |
| P04 | Chưa có dữ liệu | Minh họa hộp, nội dung rỗng; nút tạo hiện theo quyền ở đầu trang. |
| P05 | Tìm không thấy | Thông báo riêng, nút xóa tìm kiếm và chip bộ lọc. |
| P06 | Lỗi tải | Vùng lỗi, thử lại bằng refetch, liên kết Tổng quan. Khi đang lọc vẫn giữ điều khiển để phục hồi. |
| P07 | Mất mạng | Trạng thái offline và thao tác thử lại dùng kết nối thực. |
| P08 | Dữ liệu lưu còn hiển thị khi lỗi làm mới | Cảnh báo, ngày giờ lấy từ dataUpdatedAt thật, thử cập nhật, đóng cảnh báo; cảnh báo xuất hiện lại ở đợt offline mới. |
| P09 | Có bộ lọc | Keyword/status chip; từng chip xóa riêng và đặt lại toàn bộ. |
| P10 | Chỉ xem | Nhãn chỉ xem, ẩn tạo/sửa theo quyền hiện có. |
| P11 | Đang mở tạo mới | Giữ hộp thoại tạo đồng bộ của ứng dụng. Không thêm độ trễ giả hoặc điều hướng sản phẩm gốc. |
| P12 | Tạo thành công | Banner thành công có đóng; invalidate danh sách thật. Không mô phỏng hàng sản phẩm gốc được tô sáng. |
| P13 | Trùng mã | Giữ thông báo/field error của máy chủ trong form và giá trị người dùng nhập. Không tự chuyển sang luồng tìm sản phẩm gốc của ảnh. |
| P14 | Lưu thất bại | Giữ form và lỗi; người dùng sửa hoặc lưu lại; nút pending không gửi lặp. |
| P15 | Kết quả lưu chưa xác định | Không thêm một nhánh nghiệp vụ suy đoán; giữ cơ chế xử lý lỗi/save hiện có của ứng dụng. |
| P16 | Hết phiên | Giữ xử lý đăng nhập toàn cục; feedback phân biệt 401 cả khi còn hàng cũ. |
| P17 | Không có quyền | Feedback phân biệt 403/no-permission cả khi còn hàng cũ, không gọi đó là dữ liệu cũ. |
| P18 | Không tìm thấy | Hiển thị lỗi 404 và liên kết Tổng quan khi query trả về trạng thái tương ứng. |
| P19 | Lỗi hệ thống | Hiển thị lỗi máy chủ và thử lại. |
| P20 | Bảo trì | Hiển thị 503 và thử lại. |

Ảnh tĩnh không xác định được chính xác thời lượng/chuyển động của mọi hiệu ứng. CSS có hover/focus/pending/loading và hỗ trợ reduced-motion; không tuyên bố đo được chuyển động từ PNG.

## Màu và tỉ lệ

Màu được lấy mẫu từ PNG P01: chữ chính `#073f78`, chữ phụ `#66839c`, viền `#d0e8f2`, header bảng `#edf7fc`, canvas `#f6fbfe`, trạng thái hoạt động `#087a60` trên `#e8f8f3`, chấm trạng thái `#0aac7f`, link `#0786c7`, gradient nút `#0876b3` → `#0793cf`.

Token màu và CSS giới hạn trong Catalog/dialog/menu. Dark mode dùng token nền/chữ của hệ thống. Không thêm `!important`. Focus ô nhập dùng viền và halo ngoài, đã loại bỏ viền vuông kép bên trong; menu trạng thái chỉ có một mục “Tất cả”.

Tiêu đề 24/32px, chữ chính 14px, chữ phụ/header bảng 12–13px, điều khiển 40px; card bo 12px. Form giữ trường và validation của dự án.

## Kiểm tra responsive và thao tác

Đã kiểm tra DOM tại các chiều rộng: 1920, 1440, 1366, 1280, 1024, 820, 768, 600, 390, 360, 320px. Ở các kích thước này `document.documentElement.scrollWidth` không vượt `innerWidth`.

- Desktop và tablet 1024px: kiểm tra bằng ảnh chụp, bảng hiển thị đủ cột và hành động, font tiêu đề giữ 24px.
- Tablet 768px: bảng rộng được cuộn ngang trong vùng bảng; không kéo tràn trang. Tab cuộn khi thiếu chỗ.
- Mobile: dữ liệu chuyển sang card theo ResponsiveDataTable hiện có; filter/nút xếp lại theo chiều rộng.
- Hộp thoại 390×844: rộng 366px, nằm trong viewport. Tại 320×640: rộng 296px, cao 486px, không tràn trang.
- Đã mở/đóng form, thử validation rỗng, menu trạng thái, menu hãng của MODEL, đổi tab, tìm kiếm không kết quả và xóa chip phục hồi dữ liệu.
- Không tạo hoặc sửa dữ liệu thật qua trình duyệt khi kiểm tra. Mutation success/failure được kiểm tra bằng service mock trong test.
- Viewport thử nghiệm đã được trả về kích thước cửa sổ bình thường.

Các đo đạc này xác nhận những viewport đã thử, không chứng minh mọi thiết bị hoặc mọi tổ hợp dữ liệu đều không có lỗi.

## Kiểm thử mã

Các lần chạy cuối theo nhóm: 33 ca đạt (2 CatalogMasterScreen + 9 interactions + 13 CatalogFeedback + 9 flow01-system-catalog-contract). Lần chạy kết hợp trước hai ca auth/permission bổ sung đạt 31/31; sau thay đổi cuối, interactions đạt 9/9 và CatalogFeedback đạt 13/13. ESLint các file Catalog và test đạt.

Nội dung regression gồm query/filter/page reset, duy nhất một lựa chọn Tất cả, bỏ lọc trạng thái, dữ liệu form và version, quyền chỉ xem, validation, lỗi máy chủ, ngăn đóng/gửi lại khi lưu, invalidate sau thành công, thông báo offline có đóng và phục hồi, giữ bộ lọc để thoát lỗi tìm kiếm, phân biệt 401/403 khi còn dữ liệu.

`npx vite build` đạt, 3.098 modules. Đây là kiểm tra bundling Vite, không thay cho lệnh `npm run build` có TypeScript gate.

Lần kiểm tra UI guard cuối: `ui:styles` báo 12 vấn đề ngoài Catalog (manifest CSS của shell, CSS/report allowlist và các `!important`); `ui:tokens` báo 14 vấn đề ngoài Catalog (auth, reports và stylesheet chung). Không tự cập nhật baseline cho các màn khác để bỏ qua lỗi. Allowlist chỉ bổ sung hai CSS Catalog và 13 literal màu tham chiếu của Catalog; giữ nguyên các thay đổi đồng thời của tác vụ khác.

TypeScript toàn dự án: kết quả cuối được ghi bổ sung bên dưới.

Lần chạy cuối `npm run typecheck` không đạt do 5 lỗi ngoài phạm vi Catalog, đều ở `src/modules/reports/packing-label/PackingLabelPrintReport.tsx`: bốn truy cập `LabelSnapshotRecord.version` (194, 201, 234, 241) và kiểu giá trị `boolean | "pdf" | "xlsx"` tại dòng 301. Không có lỗi TypeScript báo cho các file Catalog. Không sửa file PackingLabel của tác vụ khác.
