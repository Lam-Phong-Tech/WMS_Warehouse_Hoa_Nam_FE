# Quy tắc giao diện Hoa Nam V2 — Xem trước → Chi tiết và bảo toàn chức năng

> Tài liệu thiết kế và đối chiếu để nâng cấp giao diện WMS hiện tại. Trạng thái: quy tắc triển khai; các quyết định còn mở được ghi ở mục 10. Tài liệu này không thay đổi mã nguồn, API hay dữ liệu.

> Phân tích mã nguồn V1/backend, quan hệ sản phẩm gốc–SKU và khoảng thiếu API: [HOA_NAM_V1_BACKEND_V2_GAP_ANALYSIS.md](HOA_NAM_V1_BACKEND_V2_GAP_ANALYSIS.md).

## 1. Mục tiêu và thứ tự ưu tiên

1. Dùng **bố cục, thứ bậc thông tin và trạng thái hiển thị của ảnh V2** cho phần nội dung các màn quản trị: danh sách → xem nhanh → chi tiết → thao tác. Ảnh V2 có ít trường hơn sản phẩm hiện tại nên ảnh **không phải** danh sách đầy đủ các trường hay chức năng được phép giữ.
2. Từ V1 **giữ sidebar và luồng đăng nhập** theo yêu cầu người dùng. Giữ kiểu sidebar, cấu trúc nhóm, mọi mục/route/deep link hiện có, khả năng mở/thu gọn và quyền; bổ sung mục cần thiết cho “Danh mục sản phẩm” và “Danh mục thuộc tính” mà không làm mất mục cũ. Giữ luồng xác thực hiện hành (đăng nhập, phiên, đổi/khôi phục mật khẩu, MFA, hết phiên, lỗi và chuyển hướng); ảnh `hoanam_authen` chỉ giúp đối chiếu cách trình bày trạng thái. Phần nội dung khác có thể đổi giao diện theo V2.
3. Mọi **trường dữ liệu, thao tác, quyền, điều kiện nghiệp vụ, xác thực nhập liệu, đồng bộ API, trạng thái và thông báo lỗi đang hoạt động** phải còn truy cập được ở bản mới. Có thể chuyển trường phụ vào Chi tiết, tab hoặc phần mở rộng; không được làm mất hoặc biến đổi ý nghĩa.
4. Dữ liệu trong PNG, kể cả số KPI, mã, người, thời gian, trạng thái và hình sản phẩm, là **dữ liệu minh họa**. Chỉ hiển thị số liệu thật từ API; không dùng ảnh làm nguồn dữ liệu hoặc suy ra API mới.
5. `Tài liệu của khách` là **tư liệu luồng nghiệp vụ và mẫu chứng từ**, không phải chỉ thị thay thế yêu cầu ở trên. Khi mẫu chứng từ chứa giá, chiết khấu, công nợ, bút toán hoặc chữ ký kế toán mà WMS hiện tại không có hợp đồng tương ứng, không tự thêm vào UI. Khi tài liệu cũ và hợp đồng SRS/FE hiện hành khác nhau, ghi rõ chỗ cần quyết định.

### Nguồn đã đối chiếu

- `Hoa_Nam_UIUX_V2/`: **516 PNG**, gồm 258 ảnh Desktop và 258 ảnh Tablet, chia **23 nhóm màn**. Mỗi nhóm có các biến thể danh sách, chi tiết, thao tác và tình huống lỗi/rỗng tương ứng.
- Mã đang dùng: `src/shared/constants/routes.ts`, `src/app/layouts/nav-data.ts`, `src/app/router/index.tsx`, `src/app/router/access.ts` và các type/service/page trong `src/modules/`. Các tài liệu `docs/ui/*-reference-verification.md` và `docs/HN_SRS_FRD_v1.12_FULL.md` giúp giải thích hợp đồng hiện hành; cần kiểm tra lại mã/API thật trước từng đợt lập trình vì repo có thể thay đổi.
- Tư liệu khách: `Tài liệu của khách/Anh đã xem bảng câu hỏi và trả lời lần lượt như sau.docx`, `(Tóm tắt audio record) Bien Ban Tong Hop Yeu Cau.pdf`, `Checllist đáp ứng tính năng yêu cầu.docx` và các biểu mẫu Excel năm 2026. Tư liệu nêu quét Barcode/QR, RFID ở xuất kho, nhãn kiện, bảo hành, người nhận, đối soát và báo cáo. Các tài liệu chiến lược/RFID còn có phương án đề xuất khác nhau; không mặc định tất cả là phạm vi MVP.

## 2. Mẫu bố cục chung

```text
Sidebar V1 │ Header V2: breadcrumb, tìm kiếm/chức năng thật, ngôn ngữ, thông báo, tài khoản
           │ Tiêu đề + mô tả ngắn + kho/phạm vi + thao tác chính theo quyền
           │ KPI (nếu có API đáng tin cậy; tùy màn)
           │ Bộ lọc / tìm kiếm / sắp xếp / đặt lại / xuất dữ liệu
           │ ┌─────────────────────────────┬───────────────────┐
           │ │ Danh sách, bảng, phân trang   │ Xem nhanh hàng chọn│
           │ └─────────────────────────────┴───────────────────┘
           │ Chi tiết đầy đủ: thông tin, dòng hàng, lịch sử, chứng cứ, thao tác hợp lệ
```

**Luồng chuẩn.** Người dùng tìm/lọc trong danh sách, chọn một bản ghi để xem nhanh, rồi mở Chi tiết để đọc đủ trường và thực hiện thao tác. Xem nhanh giúp xác nhận đúng bản ghi; không thay thế Chi tiết, form tạo/sửa, hoặc các bước kiểm tra/xác nhận nghiệp vụ. Những trang tổng quan và báo cáo có thể dùng KPI + bảng + preview phù hợp ngữ cảnh; trang cấu hình ít bản ghi có thể dùng thẻ thay bảng nhưng vẫn giữ thứ bậc này.

**Danh sách.** Giữ mã, tên, trạng thái, nhóm/phân loại, mốc thời gian và thông tin quyết định thao tác. Giữ filter, sort, phân trang, tổng số, kích thước trang và reset hiện có. Tổng KPI phải dùng tổng từ server/truy vấn đúng phạm vi; không lấy số dòng của trang hiện tại. Phân biệt danh sách rỗng với tìm kiếm không có kết quả. Nếu bộ lọc thay đổi, làm mới tổng, trang và lựa chọn theo đúng dữ liệu mới.

**Xem nhanh.** Hiển thị 4–8 thông tin nhận diện/nghiệp vụ quan trọng, trạng thái, cảnh báo và một lối mở Chi tiết rõ ràng. Trên desktop, hàng được chọn và panel phải thể hiện cùng bản ghi; khi bản ghi biến mất khỏi bộ lọc/trang thì bỏ lựa chọn hoặc chọn lại theo quy tắc rõ ràng, không giữ preview sai. Không tự thực hiện mutation khi chọn hàng. Nút chỉnh sửa, đăng, hủy, in, ghi sổ… chỉ xuất hiện/khả dụng theo quyền và trạng thái thật.

**Chi tiết.** Có URL/deep link hoặc cơ chế quay lại ổn định nếu route hiện tại hỗ trợ. Hiển thị toàn bộ trường đang có, kể cả trường không xuất hiện trong ảnh, trong các nhóm: thông tin chung, thuộc tính, dòng hàng/liên kết, chứng cứ, lịch sử/audit, thao tác. Có thể dùng tab/accordion cho dữ liệu dài; nội dung quan trọng và lỗi chặn thao tác phải nhìn thấy trước hành động. Giữ filter/vị trí danh sách khi quay lại nếu luồng hiện tại làm vậy.

**Form và xác nhận.** Tạo/sửa có thể ở dialog hoặc trang riêng theo độ dài, nhưng phải giữ đầy đủ field, giá trị mặc định, required/conditional, validation, lỗi server theo trường, trạng thái chưa lưu, quyền, version/If-Match, idempotency và chặn gửi lặp. Các bước ghi sổ, ngừng sử dụng, hủy, trả máy, công bố, in lại cần xác nhận theo điều kiện hiện có. Kết quả mạng không rõ phải cho phép **kiểm tra trạng thái trước khi thử lại** khi thao tác có thể đã được thực thi.

## 3. Quy tắc thị giác và responsive

| Thành phần | Quy tắc |
| --- | --- |
| Khung trang | Sidebar V1 giữ nguyên nhận diện/điều hướng. Nội dung V2 dùng canvas xanh rất nhạt, card trắng, viền xanh nhạt, khoảng trắng rõ; hạn chế đổ bóng nặng. Header V2 có thể thay bố cục nhưng mọi chức năng header hiện có vẫn phải tìm được. |
| Phân cấp chữ | Tiêu đề trang đậm, xanh đậm; tiêu đề khối 18–22 px; chữ dữ liệu 14–16 px; nhãn phụ 12–14 px; không dùng cỡ quá nhỏ để bù cho số trường tăng. Dùng font ứng dụng hiện hành và hệ token chung. |
| Màu | Palette tham chiếu từ màn danh mục V2: canvas gần `#F4FAFE`, card `#FFFFFF`, viền gần `#D0E8F2`, tiêu đề xanh đậm, nút chính xanh dương gần `#007FC6`. Đây là **điểm khởi đầu**, cần đo/kiểm tra contrast khi triển khai; các ảnh V2 khác có biến thể teal, không tạo bảng màu riêng cho từng màn. Xanh lá = thành công/đang dùng, vàng = chờ/cảnh báo, đỏ = lỗi/nguy hiểm, xám = ngừng/không khả dụng; luôn kèm chữ/biểu tượng. |
| Điều khiển | Ô tìm kiếm, select, date range, nút và chip cùng hệ chiều cao khoảng 38–44 px; focus rõ, label hiện hữu, tooltip cho icon, keyboard/Tab/Escape hợp lý. Tối đa một hành động chính nổi bật trong một vùng. |
| Bảng | Tiêu đề cột rõ, hàng chọn có nền sáng + vạch/viền, trạng thái là badge có chữ, số căn phải, mã và liên kết dễ sao chép. Bảng nhiều cột được cuộn trong card hoặc chuyển thẻ; không tạo cuộn ngang toàn trang. |
| Desktop | Khi **vùng nội dung còn đủ rộng**, danh sách và Xem nhanh song song; preview khoảng 1/3 vùng nội dung, bảng giữ phần còn lại. Không ép tỷ lệ này nếu sidebar V1 làm vùng nội dung hẹp. |
| Tablet | Sidebar V1 dùng cơ chế responsive đang có. Xếp danh sách trước, Xem nhanh sau; Chi tiết chiếm toàn bộ vùng nội dung. Filter/nút có thể xuống hàng, vẫn đủ nhãn và thao tác. |
| Điện thoại | Danh sách chuyển card hoặc bảng cuộn nội bộ theo nhu cầu; preview mở trong vùng riêng/drawer, Chi tiết là trang toàn chiều rộng. Dialog cuộn trong viewport; nút xác nhận không bị che bởi bàn phím hoặc thanh điều hướng. |
| Truy cập | Không chỉ dùng màu để báo trạng thái; độ tương phản và vùng bấm đạt chuẩn nội bộ; hỗ trợ screen reader/aria, bàn phím, phóng to chữ và `prefers-reduced-motion`. |

Không sao chép nguyên tọa độ/pixel của PNG 1672×941 sang trình duyệt. Breakpoint phải dựa vào **độ rộng thực còn lại sau sidebar**, chiều dài nội dung tiếng Việt và số cột/trường thật.

## 4. Hợp đồng bảo toàn trước khi sửa từng màn

Mỗi màn cần có một bảng kiểm kê với các cột sau trước khi đổi component:

| Mục kiểm kê | Cần ghi |
| --- | --- |
| Điều hướng | Route, query/deep link, breadcrumb, sidebar, back, trạng thái tab/filter/page khi quay lại. |
| Dữ liệu | Mỗi field đọc/ghi và nguồn API, required/optional/conditional, format, giá trị cũ, đơn vị, tính nhạy cảm. |
| Hành động | Tạo, xem, sửa, xóa/ngừng, scan, ghi sổ, hủy, xuất, nhập, in, đăng, đối soát; điều kiện hiện/khóa, confirmation, tác động tồn. |
| Quyền | Quyền route, quyền xem field, quyền từng action, kho/phạm vi và masking. Ẩn nút không thay thế kiểm tra quyền ở service/server. |
| Tải và lỗi | Loading lần đầu, refresh, dữ liệu cũ, rỗng, không kết quả, mất mạng, 401/403/404/5xx, xung đột version, kết quả mutation chưa xác định. |
| Đối chiếu | Trường/hành động hiện ở danh sách, Xem nhanh, Chi tiết, form hay phần mở rộng. Mỗi mục V1 phải có ít nhất một vị trí V2 hợp lý. |

**Tiêu chuẩn chặn mất chức năng:** không được xóa route/action/field chỉ vì PNG không thể hiện; không thay API payload hoặc tạo giá trị giả để khớp ảnh; không dùng “chỉ xem” cho luồng đang có mutation; không cho phép thao tác khi backend không cho; không tăng/giảm tồn ở bước chỉ di chuyển, in, gắn RFID hoặc xem báo cáo. Sửa UI phải đi kèm regression theo luồng hiện hữu, không chỉ snapshot hình ảnh.

## 5. Quy tắc dữ liệu, trạng thái và phản hồi

- **Loading lần đầu:** skeleton/placeholder ở đúng vùng; không hiện KPI bằng 0. **Đang làm mới:** giữ dữ liệu cũ có nhãn thời điểm và trạng thái đang tải. Lỗi refresh không được trình bày như dữ liệu mới.
- **Rỗng thật** khác **không tìm thấy theo bộ lọc**; trạng thái không có quyền, không tìm thấy bản ghi, hết phiên, mất mạng, lỗi hệ thống và bảo trì phải có thông điệp/hướng xử lý riêng.
- **Lỗi ghi:** giữ dữ liệu form và lỗi của server. Khi mất kết nối sau một lệnh có thể đã thành công, không tự gửi lại; kiểm tra kết quả bằng mã phiếu/idempotency hoặc làm mới trước.
- **KPI/báo cáo:** chỉ hiển thị khi query thành công và đúng kho/khoảng ngày/quyền. Báo cáo xuất file phải giữ phạm vi, bộ lọc, định dạng, tên file, quyền và trạng thái lỗi; không xuất âm thầm dữ liệu rộng hơn màn đang xem.
- **Quyền và riêng tư:** tên/SĐT/địa chỉ khách bảo hành theo cơ chế masking hiện có; App PV công khai chỉ dùng dữ liệu public contract, không lộ item, container, movement, giá vốn hoặc kho nội bộ. Khi quyền chỉ xem, giữ khả năng đọc theo quyền nhưng không hiện thao tác ghi.
- **Tính nhất quán tồn:** nhập/xuất chỉ đổi tồn tại bước Post hợp lệ, đủ điều kiện và đúng một lần. Phiếu đảo ghi movement đối ứng; xếp khay, in/in lại, RFID, xem báo cáo không tự thay tồn.

## 6. Vị trí trường và chức năng cần giữ theo miền

Các danh sách dưới đây là **mốc kiểm tra tối thiểu từ code hiện tại**, không phải lý do để bỏ trường khác. Khi lập trình, dùng bảng kiểm kê mục 4 để đối chiếu từng field/action thực tế một lần nữa.

### 6.1 Danh mục và App PV

| Màn | Bố trí V2 | Phải giữ từ ứng dụng hiện tại |
| --- | --- | --- |
| Danh sách SKU `/master-data/skus` | Danh sách có bộ lọc + Xem nhanh, Chi tiết chia “Nhận diện”, “Thuộc tính”, “Tồn/hiển thị”, “Lịch sử”; form tạo Sản phẩm/Linh kiện theo ảnh. | `code`, `name`, loại `PRODUCT/COMPONENT`, đơn vị, hãng, nhóm, model, nguồn điện, quy cách/phiên bản, theo dõi serial, trạng thái, công bố App PV, **min_stock/max_stock**, ảnh khi có; khóa trường nhận diện theo tồn và version/If-Match; phân trang/filter/sort, quyền và thông báo lỗi. Các field không có trong PNG đặt ở Chi tiết và form, không giấu khỏi khả năng chỉnh sửa hợp lệ. |
| **Nhập SKU từ Excel** | Nút **“Nhập từ Excel” chỉ ở màn Danh sách SKU**, cạnh nhóm thao tác tạo/tải mẫu; không thêm nút này vào Danh mục sản phẩm gốc. Đây là quyết định người dùng đã xác nhận. | Giữ `.xlsx`, tải mẫu, chọn file, kiểm tra/dry run, bảng xem trước, lỗi từng dòng và file lỗi, lựa chọn cập nhật mã đã tồn tại, checksum/hash, xác nhận commit, idempotency, quyền `SKU_MANAGE`, kết quả và làm mới danh sách/KPI. Không rút thành upload một bước. Nguồn: `SkuImportModal.tsx`, `sku-import.service.ts`. |
| Danh mục sản phẩm gốc V2 | Màn **riêng** theo ảnh: sản phẩm gốc, SKU liên kết, nhóm, đơn vị, trạng thái, Xem nhanh → Chi tiết → SKU liên kết, tạo/sửa/ngừng. | Backend `dev` có `family_name`/`variant_label` trên từng SKU để suy ra nhóm ở storefront, nhưng **không có thực thể/mã/trạng thái/API sản phẩm gốc**. `ProductMaster` là 5 danh mục thuộc tính. Chỉ xây CRUD và KPI khi có contract sản phẩm gốc, quyền, liên kết SKU và quy tắc chuyển dữ liệu; không lấy SKU đầu tiên hoặc đếm giả. |
| **Danh mục thuộc tính** | Một màn riêng chứa 5 tab V1: Hãng, Nhóm hàng, Model, Nguồn điện, Quy cách. Áp dụng cùng mẫu danh sách → preview → chi tiết/form. | Giữ nguyên 5 bộ dữ liệu, mã, tên, mô tả, thứ tự, trạng thái, liên kết Model–Hãng, tạo/sửa/ngừng, filter, phân trang, quyền. Người dùng đã quyết định tách 5 tab khỏi Danh mục sản phẩm gốc. Giữ deep link cũ `/master-data/catalog` hoặc có alias an toàn khi đổi route; cập nhật nhãn/sidebar V1 theo cấu trúc mới mà không làm mất mục. |
| Đại lý & Nơi nhận `/master-data/agencies` | Danh sách → Xem nhanh → Chi tiết, form theo hai loại người nhận. | Mã, tên, `recipient_type`, **market (thị trường)**, vùng, người liên hệ, SĐT, địa chỉ, trạng thái; tạo/sửa/ngừng, lọc loại, quyền và version. V2 ít nhấn mạnh `market`; chuyển vào Chi tiết/form nếu cần. Không biến người nhận thành kho hoặc tạo tồn riêng. |
| Bệnh lỗi `/master-data/defects` | Danh sách → Xem nhanh → Chi tiết, tạo/sửa/ngừng. | Mã, tên, mô tả, trạng thái, xác thực trùng/required, version và liên kết hồ sơ bảo hành. |
| Sản phẩm trên App PV `/master-data/pv-products` và quản trị `/pv-admin` | Danh sách/ảnh → Xem nhanh → Chi tiết; tạo/sửa hồ sơ và xác nhận hiện/ẩn theo V2. | SKU nguồn, tên hiển thị, mô tả, thứ tự, ảnh chính/thứ tự ảnh, ngành nghề, tag, quy tắc gợi ý và quyền công bố riêng; trạng thái ảnh lỗi, dữ liệu chưa đồng bộ và version. Không đồng nhất thao tác “lưu nội dung” với “hiện trên App”. Các màn quản trị không có ảnh V2 riêng vẫn giữ chức năng. |
| App PV công khai `/pv` | Giao diện công khai riêng, không dùng sidebar quản trị; danh sách/thẻ, tìm/lọc, trạng thái tồn, freshness và **trang Chi tiết theo ảnh V2**. | Người dùng đã xác nhận thêm Chi tiết. Chỉ đọc; chỉ công bố hồ sơ được phép. Giữ `sku_code`, tên hiển thị, mô tả, hình, hãng/nhóm/model/nguồn điện, ngành/tag, thông số và tồn khả dụng theo API public. Backend `GET /api/v1/pv/products/{skuId}` đã có cho chi tiết SKU công khai; route chi tiết frontend hiện đã gỡ, cần phục hồi và dùng DTO public, xử lý 404/freshness. |

**Hợp đồng còn thiếu cho sản phẩm gốc:** ảnh V2 có mã dạng `SP-HN-001`, tên sản phẩm gốc và nhiều SKU liên kết, trong khi SKU hiện có mã và type riêng. Backend hiện chỉ cho mỗi SKU một `family_name` nullable; storefront suy ra nhóm theo hãng + nhóm hàng + family, nên **mỗi SKU thuộc tối đa một family suy diễn tại một thời điểm**. Đây chưa phải quan hệ sản phẩm gốc có ID ổn định. Khi thiết kế mới, mô hình một sản phẩm gốc → nhiều SKU là phương án kỹ thuật phù hợp hiện trạng; cần chốt mã, nguồn nhóm/đơn vị/trạng thái, quy tắc liên kết/ngừng, quyền và API. Một SKU thuộc nhiều sản phẩm gốc là thay đổi nghiệp vụ/schema riêng nếu khách yêu cầu. Chi tiết xem [phân tích backend](HOA_NAM_V1_BACKEND_V2_GAP_ANALYSIS.md).

### 6.2 Nhập, xếp khay, xuất, RFID và nhãn

| Màn | Bố trí V2 | Phải giữ từ ứng dụng hiện tại |
| --- | --- | --- |
| Nhập kho `/inbound` | Danh sách phiếu + Xem nhanh; Chi tiết có thông tin phiếu, dòng quét, thiếu thông tin SKU, lịch sử và hành động theo trạng thái. | Số/ngày phiếu, kho đích, tham chiếu nguồn, ghi chú, nguồn/người tạo, trạng thái `DRAFT/SCANNING/POSTED/CANCELLED`, số quét/ghi sổ/còn lại, version; quét qua App Scanner, bổ sung tên/đơn vị và master liên quan cho SKU chưa đủ thông tin, điều kiện chặn Post, kiểm tra trước Post, ghi sổ đủ phiếu, hủy và xử lý dữ liệu cũ. Form tạo GĐ1 là **header-only**; không tự thêm dòng nhập tay từ mẫu Excel. |
| Xếp linh kiện vào khay `/putaway` | Hàng chờ BOX → Chi tiết BOX → tạo lệnh → chọn khay → xác nhận/hủy → lịch sử. | Mã BOX/TRAY, SKU/số lượng, vị trí, trạng thái, version, nguồn phiếu; chặn tạo trùng, không có khay, chỉ xem, lỗi/kết quả chưa rõ. Xếp khay **không tạo biến động tồn**. Giữ màn tổng quan khay `/putaway/trays` dù không có ảnh V2 tương ứng. |
| Phiếu xuất `/outbound` | Danh sách/preview theo V2; Chi tiết có tab tổng quan, hàng hóa, NFC và lịch sử. Các ảnh V2 tập trung vào tra cứu sau xuất, nên phải có vùng thao tác vận hành của bản hiện hành cho phiếu chưa hoàn tất. | **Tiếp nhận Phiếu toa từ Excel `.xlsx` hoặc nhập tay có kiểm soát**, preview/map/confirm để tạo DRAFT; người nhận, tham chiếu toa, địa chỉ/SĐT khi có, tìm/lọc/sort, quét/match bằng camera/phần cứng/nhập tay, số kế hoạch/đã quét/thiếu, tồn đủ, xác nhận/hủy và quyền. Giữ `DRAFT/SCANNING/POSTED/CANCELLED`, deep link, kiểm tra version/idempotency và full-post. |
| Nhãn đóng gói trước xuất | Trong Chi tiết phiếu xuất sau match đủ: tổng hợp dữ liệu → xem trước → chọn mẫu/khổ → Ready → in/thử lại → xác nhận đã dán → Hoàn tất xuất. Lịch sử/in lại dùng báo cáo nhãn. | Một nhãn theo phiếu, snapshot bất biến, trạng thái in, máy in, mã QR/Barcode đúng từ payload, dữ liệu người nhận/sản phẩm, thất bại máy in. **Chỉ Post Issue hợp lệ mới trừ tồn**; in lại sau Post không đổi tồn. Không thay nhãn kiện bằng nhãn theo từng Item. |
| NFC/RFID | Tab liên kết NFC và chi tiết sản phẩm theo ảnh; giữ route `/nfc` độc lập nếu hiện có. | UID/tag, mã hàng/serial, phiếu xuất, trạng thái và lịch sử liên kết; RFID tùy chọn ở outbound, Barcode/QR là đường thay thế hợp lệ, **không** thành điều kiện Post. Chỉ hiển thị thao tác gắn/kiểm tra khi quyền, trạng thái và API cho phép. |
| Phiếu đảo `/reverse` | Danh sách → chọn chứng từ gốc → nhập lý do/dòng → kiểm tra/ghi sổ → chi tiết tác động tồn/truy vết; trường hợp chờ hàng trả vật lý. | Loại/số chứng từ gốc, kho, người/lý do, SKU/serial/số lượng, tình trạng hàng trả, trạng thái vật lý, chặn giao dịch phụ thuộc, version, idempotency, hủy. Tạo movement đối ứng; không sửa trực tiếp số tồn hoặc xóa movement gốc. |

**Phân biệt hai luồng Excel:** “Nhập từ Excel” ở **Danh sách SKU** là import danh mục mã hàng; “Tiếp nhận Phiếu toa Excel” ở **Xuất kho** tạo phiếu xuất DRAFT. Các nút “Xuất Excel” ở báo cáo chỉ đọc/xuất dữ liệu. Ba luồng này có quyền, payload và hậu quả khác nhau; không dùng chung một nút/logic chỉ vì cùng định dạng `.xlsx`.

### 6.3 Tồn, bảo hành, báo cáo, hệ thống

| Màn | Bố trí V2 | Phải giữ từ ứng dụng hiện tại |
| --- | --- | --- |
| Tra cứu tồn `/inventory` | Danh sách/tổng SKU → Xem nhanh → Chi tiết phân bổ BOX/TRAY, biến động, đối soát hiện tại/lịch sử. | Phạm vi kho, SKU/serial/mã vật lý, tồn khả dụng, nguồn nhập/xuất/đảo, vị trí, thời điểm, số lượng, lịch sử, trạng thái reconcile và quyền. Không có thao tác sửa tồn trực tiếp. |
| Hồ sơ bảo hành `/warranty` | Danh sách + Xem nhanh; Chi tiết gồm tiếp nhận, nhận diện, khách hàng, bệnh lỗi, xử lý/linh kiện, ảnh/video, lịch sử và trả máy. | Nhận bằng serial/mã vật lý **hoặc TEMP_ONLY**, lý do thiếu mã/mô tả sản phẩm, SKU, khách tên/SĐT/địa chỉ, ngày mua, đại lý, bệnh lỗi báo/đã xác nhận và nhiều bệnh lỗi, phụ kiện/tình trạng lúc nhận, độ ưu tiên, dự kiến hoàn tất/trả, ghi chú, file ảnh/video, trạng thái và từng bước chuyển, version, PII masking; tạo/cập nhật/hủy/trả máy theo quyền. |
| Xuất linh kiện bảo hành `/warranty/component-issues` | Danh sách + Xem nhanh → Chi tiết phiếu/dòng BOX hoặc Serial → hồ sơ bảo hành liên kết. | Chỉ dùng cho hồ sơ bảo hành còn hợp lệ; SKU, nguồn BOX/serial, số lượng, chứng cứ quét, ghi sổ/hủy và liên kết case; không biến thành xuất kho thông thường. |
| 9 báo cáo `/reports/*` | Mỗi báo cáo có route riêng: bộ lọc → KPI đúng phạm vi → danh sách + preview → chi tiết/đối chiếu → dialog xuất. | Giữ đúng bộ lọc ngày/kho/SKU/trạng thái/người nhận/mã tùy báo cáo, sắp xếp, phân trang, drill-down tới phiếu/mã gốc, lịch sử, nguồn dữ liệu, export format/scope/file name, quyền và xử lý lỗi. Các báo cáo nhãn có xem trước, in lại và kết quả in chưa rõ; báo cáo nhập chất lượng có nguồn Excel/lỗi dòng; báo cáo tồn giải thích chênh lệch, không tạo điều chỉnh tồn. |
| Tổng quan `/dashboard` | KPI + việc cần xử lý + giải thích tồn + chi tiết giao dịch/cảnh báo định mức. | Số liệu theo quyền/kho/thời điểm, định mức SKU (`min_stock/max_stock`), liên kết đến việc cần xử lý, trạng thái lỗi một phần/toàn trang và freshness. Không dùng số mẫu trong ảnh. |
| Hệ thống không có ảnh V2 | Áp dụng khung V2 cho phần nội dung khi nâng cấp sau; không xóa màn chỉ vì bộ ảnh không có. | Người dùng/vai trò/phạm vi, cấu hình kho, thông báo, audit, hồ sơ cá nhân/MFA, scan, NFC độc lập, các mục PV admin, tổng quan khay và các route/deep link có thật. Sidebar và luồng đăng nhập V1 tiếp tục giữ. |

## 7. Bản đồ toàn bộ 23 nhóm ảnh V2

Mỗi dòng gồm cả Desktop và Tablet. Tên thư mục là tên thật dưới `Hoa_Nam_UIUX_V2/`; số ảnh trong ngoặc cho phép kiểm lại phạm vi. Cột route là vị trí **hiện hành** hoặc được đánh dấu đề xuất, không tự tạo API/route chỉ từ ảnh.

| Nhóm ảnh (số PNG) | Route/miền đối chiếu | Điều V2 cung cấp và điểm bảo toàn cần chú ý |
| --- | --- | --- |
| `tongquanhethong` (16) | `/dashboard` | Tổng quan, việc cần làm, giải thích tồn, chi tiết giao dịch, cảnh báo định mức; trạng thái không phát sinh, lỗi một phần/toàn trang. Giữ KPI từ API thật và đường tới tác vụ. |
| `danhmuc_danhsachSKU` (20) | `/master-data/skus` | Danh sách/preview/chi tiết, tạo PRODUCT/COMPONENT, sửa, validation, ngừng, lịch sử, rỗng/lỗi. **Giữ nhập SKU Excel và định mức tồn dù ảnh thiếu.** |
| `danhmuc_danhsachsanpham` (18) | Màn sản phẩm gốc mới; `/master-data/catalog` hiện là 5 master | Danh sách sản phẩm gốc, SKU liên kết, tạo/sửa/ngừng, lỗi. Không thể đồng nhất với 5 master hoặc SKU khi chưa có mô hình dữ liệu. Theo quyết định người dùng, 5 master chuyển thành màn Danh mục thuộc tính riêng. |
| `danhmuc_dailynoinhan` (20) | `/master-data/agencies` | Danh sách/preview/chi tiết cho đại lý và nơi nhận, tạo/sửa/ngừng, validation/rỗng/lỗi. Giữ `market`, contact và address. |
| `danhmuc_benhloi` (16) | `/master-data/defects` | Danh sách/preview/chi tiết, tạo/sửa/ngừng, validation/rỗng/lỗi. Giữ mô tả và liên kết bảo hành. |
| `danhmuc_appPV` (28) | `/master-data/pv-products`, `/pv`, `/pv-admin` | Nội bộ: ảnh, hồ sơ, hiện/ẩn, lỗi tải ảnh; công khai: danh sách/**chi tiết được yêu cầu thêm**, rỗng/lỗi/đã ẩn. Giữ quyền công bố, freshness và ranh giới dữ liệu public; phục hồi route chi tiết theo contract. |
| `hoanam_authen` (58) | `/login`, `/forgot-password`, `/change-password`, `/profile/mfa`, guard | Đủ trạng thái đăng nhập, xác nhận phiên, hết phiên, mất mạng, recovery OTP, lỗi/chưa rõ. **Giữ luồng V1**; chỉ tham khảo hình thức và thông điệp từ V2. |
| `nhapkho.phieunhapkho` (24) | `/inbound` | Danh sách/preview, tạo header, hướng dẫn App Scanner, kiểm tra trước Post, ghi sổ, handoff xếp khay, hủy, rỗng/lỗi/dữ liệu cũ. Giữ scan-driven và điều kiện thiếu thông tin SKU. |
| `nhapkho.linhkienxepkhay` (32) | `/putaway`, `/putaway/trays` | Hàng chờ, BOX, tạo lệnh, chọn TRAY, xác nhận/hủy, trùng, kết quả chưa rõ, rỗng/lỗi/chỉ xem. Giữ khay và stock-neutral. |
| `xuatkho.phieuxuatNFC` (36) | `/outbound`, `/nfc` | Phiếu, hàng đã xuất, NFC đã/chưa gắn, UID, lịch sử và các trạng thái rỗng/lỗi. Ảnh nghiêng về tra cứu; **giữ toàn bộ tiếp nhận Phiếu toa, quét/match, nhãn, Post và hủy của hiện tại.** |
| `tonkho_tracuu.doisoat` (32) | `/inventory` | SKU tổng, BOX/TRAY, lịch sử biến động, đối soát hiện tại/lịch sử, loading/empty/no-result/error/403/404. Giữ truy vết và quyền; không thêm chỉnh tồn trực tiếp. |
| `tonkho_phieudao` (24) | `/reverse` | Chọn chứng từ, sửa dòng/lý do, kiểm tra và ghi sổ, chờ trả vật lý, hủy, tác động tồn, chặn giao dịch liên quan, kết quả chưa rõ. Giữ reversal-only. |
| `baohanh.linhkien_hosobaohanh` (24) | `/warranty` | Danh sách/preview, tiếp nhận có/chưa có mã, sửa xử lý, trả máy, lịch sử, rỗng/lỗi/chỉ xem/chưa rõ. Giữ đầy đủ PII, bệnh lỗi, ngày dự kiến, ảnh/video. |
| `baohanh.linhkien_phieuxuatlinhkien` (20) | `/warranty/component-issues` | Danh sách/preview, chi tiết phiếu, BOX/số lượng hoặc serial, hồ sơ liên kết, rỗng/lỗi/dữ liệu cũ. Giữ điều kiện case bảo hành và thao tác ghi sổ hiện có. |
| `baocao_nhapkho` (14) | `/reports/inventory-flow` | Tổng hợp SKU, mã ghi nhận/lịch sử, phiếu nhập, xuất Excel, rỗng/lỗi. Giữ filter và đối chiếu về nguồn phiếu. |
| `baocao_xuatkho` (16) | `/reports/outbound-flow` | Tổng hợp SKU, lịch sử mã, đang quét/chưa ghi sổ, đã xuất/lỗi nhãn, xuất Excel, rỗng/lỗi. Phân biệt số đang quét với số đã Post. |
| `baocao_tonkho.doisoat` (16) | `/reports/stock-reconcile` | Đối soát, nhập–xuất–tồn, lệch số lượng/mã, phát sinh SKU, xuất Excel, rỗng/lỗi. Giữ nguồn số liệu và quyền. |
| `baocao_truyvethanghoa` (18) | `/reports/traceability` | Timeline serial/mã, BOX–TRAY, sự kiện, xuất Excel, mã chưa có sự kiện/không thấy/lịch sử thiếu/lỗi. Không biến “chưa có sự kiện” thành “không tồn tại”. |
| `baocao_doichieudulieu` (16) | `/reports/import-quality` | Đợt nhập dữ liệu, dòng cần kiểm tra, thiếu SKU, chênh lệch, tải kết quả, rỗng/lỗi. Giữ file nguồn/dòng lỗi và liên kết sửa nguồn theo quyền. |
| `baocao_nhan.donggoi.inlai` (18) | `/reports/packing-label` | Lượt in, chi tiết nhãn, preview, xác nhận in lại, kết quả chưa rõ, chặn thiếu dữ liệu, xuất báo cáo, rỗng/lỗi. In lại không đổi tồn. |
| `baocao_baohanhlinhkien` (18) | `/reports/warranty` | Tổng quan, hồ sơ, linh kiện, lịch sử xử lý, ảnh/video, cảnh báo ngày, xuất báo cáo, rỗng/lỗi. Giữ masking và liên kết case. |
| `baocao_xuattheodaily` (16) | `/reports/recipient` | Người nhận, phiếu xuất, hoàn trả, chưa xác định người nhận, xuất báo cáo, rỗng/lỗi. Giữ người nhận từ nguồn phiếu và phạm vi kho/ngày. |
| `baocao_lichsunhapxuat` (16) | `/reports/pending-evidence` | Lịch sử giao dịch nhập/xuất, phiếu đảo, định danh hàng hóa, xuất báo cáo, rỗng/lỗi. Giữ liên kết tới chứng từ/movement gốc và phân biệt nhập, xuất, đảo. |

Tổng: **516 PNG = 258 cặp Desktop/Tablet, 23 nhóm**. Các route V1 không có nhóm ảnh trong bảng vẫn thuộc phạm vi bảo toàn của mục 6.3.

## 8. Quy trình triển khai an toàn cho từng màn

1. **Chốt baseline:** lưu route, permission, API request/response, danh sách field và action hiện hành; chạy kiểm thử luồng đang có trước khi sửa.
2. **Lập ma trận vị trí:** ánh xạ từng field/action vào Danh sách, Xem nhanh, Chi tiết, form, tab hoặc dialog. Trường ở form phải giữ đường mở theo quyền; trường chỉ đọc phải có nơi xem. Đánh dấu rõ trường/ảnh V2 thiếu.
3. **Dựng khung dùng chung:** token, header, filter, table/card, preview, detail, feedback. Không viết lại business service để đổi layout; cập nhật component theo từng màn và giữ contract.
4. **Đưa từng luồng qua V2:** bắt đầu màn rủi ro thấp, sau đó các luồng có tác động tồn/PII/in. Giữ trạng thái của toàn bộ ảnh V2 liên quan và bổ sung trạng thái thực tế mà ảnh chưa có.
5. **Đối chiếu bằng dữ liệu thật hoặc fixture hợp đồng:** kiểm tra field thiếu, action bị khóa/sai quyền, deep link, keyboard, tablet/mobile, dữ liệu cũ, lỗi server và tải lại. Không commit mutation thật trên môi trường sản xuất để thử giao diện.
6. **Gate hồi quy:** trước khi coi một màn xong, xác nhận cùng một kịch bản V1 vẫn hoàn thành được trên V2 với cùng payload, trạng thái cuối, tác động tồn và audit; kiểm tra thêm layout/visual. Nếu BE chưa có contract cho màn mới, giữ màn đó ở trạng thái kế hoạch và nêu khoảng trống rõ ràng.

### Bộ ca kiểm tra bắt buộc

- SKU: tạo PRODUCT/COMPONENT, sửa đủ master và định mức, khóa nhận diện khi đã có tồn; nhập Excel qua tải mẫu → dry run/lỗi dòng → confirm và refresh; quyền chỉ xem.
- Danh mục thuộc tính/đại lý/bệnh lỗi: mở đúng 5 tab và liên kết Model–Hãng; tạo/sửa/ngừng, required/trùng, xung đột version, market, liên hệ.
- Nhập/xếp khay: phiếu header-only, quét, SKU thiếu thông tin, chặn Post, Post đủ một lần, hủy; tạo/chọn/xác nhận/hủy lệnh xếp khay mà tồn không đổi.
- Xuất: Excel Phiếu toa **và** nhập tay, một toa–một người nhận, scan/match đủ, nhãn Preview→Ready→Print→đã dán, in lỗi chặn Post, RFID tùy chọn, Post đủ một lần; hủy và in lại không làm sai tồn.
- Bảo hành: nhận có serial/không có mã, PII masking, nhiều bệnh lỗi, ảnh/video, cập nhật xử lý, xuất linh kiện theo case, trả máy và lịch sử.
- Tồn/đảo/báo cáo: đối soát BOX/TRAY/serial, chứng từ gốc, phụ thuộc chặn đảo, movement đối ứng, drill-down, xuất đúng phạm vi và quyền; dữ liệu cũ/lỗi từng phần.
- Mọi màn: loading, rỗng, không kết quả, 401/403/404/5xx, mất mạng, stale, xung đột và kết quả mutation chưa xác định; desktop, tablet và điện thoại nhỏ; không tràn ngang toàn trang, có keyboard/focus.

## 9. Điều kiện chấp nhận tài liệu và triển khai

Một màn được coi là đạt **giao diện** khi bố cục V2 và trạng thái của nhóm ảnh tương ứng được áp dụng nhất quán, có preview → detail hợp lý và responsive. Một màn được coi là đạt **nghiệp vụ** khi toàn bộ mục kiểm kê V1 có vị trí/đường thao tác mới, dữ liệu API/payload/quyền/audit/tác động tồn giữ nguyên và các ca mục 8 qua kiểm thử. Hai điều kiện phải cùng đạt; ảnh giống nhưng thiếu chức năng là chưa đạt.

Tài liệu này là bộ quy tắc để chuẩn bị nâng cấp, **chưa phải bằng chứng rằng toàn bộ giao diện hiện tại đã được chuyển sang V2 hoặc đã chạy regression**.

## 10. Quyết định đã rõ và điểm cần xác nhận

| Chủ đề | Quyết định/tình trạng | Tác động khi triển khai |
| --- | --- | --- |
| V1 giữ gì? | Người dùng: **sidebar và luồng đăng nhập**. | Nội dung các màn theo V2; mọi chức năng header/sidebar/auth hiện có vẫn truy cập được. |
| Excel SKU ở đâu? | Người dùng: **chỉ Danh sách SKU như hiện tại**. | Không đặt nút import SKU ở Danh mục sản phẩm gốc; giữ nguyên dry run/commit. |
| 5 tab master ở đâu? | Người dùng: **màn Danh mục thuộc tính riêng**. | Giữ đủ 5 tab/field/action. Không xóa `/master-data/catalog` deep link; đề xuất dùng route này cho màn thuộc tính và route mới cho sản phẩm gốc, sau khi xác nhận cấu trúc dữ liệu/route. |
| Sản phẩm gốc V2 | Phân tích backend `dev`: **chưa có thực thể/API sản phẩm gốc**; `ProductMaster` là 5 thuộc tính, `family_name` là nhóm suy diễn trên SKU. Mỗi SKU hiện ở tối đa một family suy diễn; đây không phải quyết định cardinality cho sản phẩm gốc mới. | Khuyến nghị thiết kế một sản phẩm gốc → nhiều SKU với FK nullable để không phá SKU cũ, rồi chốt contract mã/trạng thái/đơn vị/quyền/API/KPI/backfill. Chỉ dùng nhiều–nhiều nếu có yêu cầu nghiệp vụ cụ thể. Chi tiết ở [phân tích backend](HOA_NAM_V1_BACKEND_V2_GAP_ANALYSIS.md). |
| Chi tiết sản phẩm App PV công khai | Người dùng: **có, thêm trang Chi tiết theo ảnh V2**. FE route hiện chú thích đã gỡ ngày 07/09/2026; BE `GET /api/v1/pv/products/{skuId}` đã có. | Phục hồi **FE route và màn chi tiết**, dùng API public hiện có; kiểm tra quyền công bố, trường public, freshness, 404 và đường quay lại danh sách. |
| Kiểm kê thực địa | Tư liệu khách cũ có nhắc; SRS/route MVP hiện không có stocktake session/điều chỉnh tồn trực tiếp. | Không suy diễn thêm màn kiểm kê từ lời nhắc trong tư liệu; nếu muốn đưa vào phạm vi cần quyết định nghiệp vụ/API riêng. |
| Đơn giá, chiết khấu, công nợ | Xuất hiện ở mẫu chứng từ kế toán Excel, chưa phải field WMS mặc định. | Không tự thêm vào form/báo cáo WMS vì chỉ có mẫu tham chiếu. |
