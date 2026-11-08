# Danh sách NCC — kiểm chứng giao diện

Ngày: 08/11/2026. Route: `/master-data/suppliers`.

## Phạm vi

- Trang con **Danh mục → Danh sách NCC**, breadcrumb và tiêu đề tương ứng;
  lazy route/preload cùng cơ chế điều hướng hiện có.
- Bố cục theo Danh sách SKU và hai tài liệu được người dùng cung cấp:
  `DESIGN_FOUNDATIONS.md`, `sku-list-filter-table-style.md`.
- Lọc tìm mã/tên theo API, phân trang server, lựa chọn ACTIVE/INACTIVE.
  Mặc định Đang sử dụng. Không hiển thị “Tất cả” vì API hiện không có trạng thái ALL.
- Bảng: STT, Mã NCC, Tên nhà cung cấp, Trạng thái, Cập nhật cuối, Sửa.
  Header xanh, control lọc 48px, trạng thái dạng pill, footer theo SKU.
- Form thêm/sửa: tên tối đa 200 ký tự, trạng thái, mã chỉ đọc/tự cấp từ server.
  POST không gửi mã; PATCH gửi UUID và If-Match theo phiên bản thực.
- Quyền vào trang `supplier.view`; nút thêm cần `supplier.create`, nút sửa cần `supplier.update`.
  Backend vẫn là nơi quyết định quyền cuối cùng.
- Có loading/empty/error/offline, lỗi trường dữ liệu, giữ nội dung khi 412,
  chặn gửi thêm lần nữa khi chưa xác nhận được kết quả tạo để tránh trùng.
- Nhãn VI/EN/ZH; màu semantic cho light/dark, bảng cuộn trong khung ở mobile.

## Kết quả kiểm tra

- Vitest tính năng/service/menu/breadcrumb/route/preload: **31/31 đạt**.
  Chạy với `NODE_OPTIONS=--no-experimental-webstorage` để tránh localStorage
  thử nghiệm của Node 26 che localStorage của môi trường jsdom.
- Playwright Chromium: **1/1 đạt**, đi qua shell và xác nhận phiên, kiểm tra
  danh sách, form thêm, phản hồi thêm, sửa với If-Match, theme tối và form mobile.
  Kiểm tra 1440/1024/768/390/320px, document không tràn ngang, bảng cuộn riêng;
  kiểm tra control lọc tối thiểu 48px.
- Transport/API dùng đúng endpoint và body; kiểm thử trình duyệt sử dụng
  phản hồi API mô phỏng có cùng contract, không ghi dữ liệu vào server thật.
- ESLint các file mới: đạt. Prettier các file mới: đạt. Diff check phạm vi: đạt.
- Typecheck và production build cuối: **đạt** sau các chỉnh sửa cuối, bao gồm CSS.
- Rà soát độc lập: đã sửa trạng thái phân trang hiện số 0 khi chưa có kết quả;
  không còn phát hiện lỗi chức năng chặn bàn giao.

## Giới hạn kiểm tra chung của workspace

- `npm run ui:tokens` không chạy được vì baseline
  `docs/ui/vuexy-sync/allowlists/hardcoded-hex-baseline.json` đang bị xóa từ
  trước tác vụ. Không khôi phục/sửa các tài liệu đang được người dùng thay đổi.
- Bộ sidebar hồi quy: sau khi xử lý localStorage môi trường, 10/11 đạt;
  test `removes the profile header chips and footer only on the profile route`
  vẫn kỳ vọng `contentinfo` ở SKU dù MainLayout hiện có (kể cả HEAD trước thay
  đổi này) không render footer. Thay đổi MainLayout của tác vụ chỉ thêm SUPPLIERS
  vào danh sách các route tự sở hữu tiêu đề.
- Chưa chạy toàn bộ Vitest của repository. Không suy rộng kết quả tập trung
  thành kết luận toàn bộ dự án đều đạt.

## Ảnh xem trước

Ảnh desktop/mobile/light/dark và form được sao chép sang
`D:/laragon/www/Hoa_Nam/outputs/supplier-directory-ui-20261108/`.
Dữ liệu trên ảnh là fixture trình duyệt, không phải dữ liệu server thật.

Người dùng đã yêu cầu push phần NCC lên dev ở cả frontend/backend. Backend
`7377dd101eba6bf0b76360556fb33ffa7c919488` đã deploy DEV thành công sau khi
người dùng cho phép áp dụng migration phân quyền riêng. Health DEV đã xác nhận SHA.

## Bổ sung phân quyền 08/11/2026

Nhóm Nhà cung cấp (NCC) xuất hiện trong ma trận vai trò với ba quyền Xem/Thêm/Sửa
riêng. Danh mục quyền dùng chung cho cấp theo vai trò và cấp riêng tài khoản được
tải đủ các trang. Backend giữ inbound.view cho lookup nhập kho, còn quyền ghi NCC
không còn dùng catalog.manage. Migration dữ liệu mới chuyển các cấp quyền cũ tương
ứng sang quyền NCC, không sửa cấu trúc bảng. Migration đã áp dụng trên DEV sau
khi backup PostgreSQL và xác minh đúng tập migration/hash. Kiểm tra hậu migration
xác nhận đủ ba quyền ACTIVE, cấp quyền vai trò/trực tiếp đúng, các cấp quyền cũ
và dữ liệu NCC không thay đổi; biên nhận root hợp lệ được tạo sau kiểm tra.

## Kiểm tra bản ghép với origin/dev

Bản phát hành ghép trên `ec316c8` để giữ các thay đổi mới của dev và không đưa
các commit/chỉnh sửa cục bộ không liên quan vào bản push. 46/46 kiểm thử tập
trung đạt, gồm các kiểm thử IAM hiện tại. Production build và ESLint các file
TypeScript thay đổi đạt. Fixture IAM bổ sung QueryClient cho màn hình IAM mới.

### Kiểm thử trình duyệt bản ghép

- Playwright Chromium: **1/1 đạt** trên bản ghép, đi qua shell, xác nhận phiên,
  danh sách, tạo mới, sửa với `If-Match`, đổi giao diện tối và form mobile
  320px.
- Fixture bổ sung hợp đồng `GET/PATCH /auth/preferences` (theme, locale, phiên
  bản). Trước khi bổ sung, catch-all trả `data: []` khiến
  `AccountPreferencesProvider` áp dụng theme `undefined`, MUI ném lỗi
  `Cannot use 'in' operator to search for '$$material' in undefined` và trang
  trắng. Đây là thiếu sót của fixture kiểm thử; mã ứng dụng không thay đổi.
  Ứng dụng hiện vẫn giả định payload preference đúng hợp đồng.
- Ảnh 1440/1024/768/390/320, form tạo, dark mode và form mobile đã được làm mới
  trong `outputs/supplier-directory-ui-20261108/` từ chính lần chạy này.
