---
title: Hoa Nam WMS — Chuẩn giao diện Web thống nhất
status: active
version: 2.0
updated: 2026-11-04
owner: Frontend
applies_to: Web Admin (desktop, tablet, mobile)
---

# Chuẩn giao diện Hoa Nam WMS

Đây là **một tài liệu thiết kế chuẩn** cho màn hình Web mới và các màn hình được chỉnh sửa. Đọc mục liên quan trước khi làm giao diện; khi thay đổi quy cách chung, cập nhật tài liệu này trong cùng thay đổi mã nguồn. Các ghi chép kiểm chứng và thiết kế cũ trong `docs/ui/` là tư liệu nguồn, không tạo thêm một bộ quy tắc song song.

Mục tiêu là giao diện vận hành rõ thứ tự công việc, đọc nhanh, dùng hợp lý diện tích và nhất quán giữa các module. Tiếng Việt là ngôn ngữ mặc định; dữ liệu và quyền vẫn lấy từ ứng dụng thật.

Tài liệu chốt **chuẩn cần áp dụng**, không chứng minh toàn bộ giao diện cũ đã được chuyển đổi. Việc hợp nhất Markdown không tự thay font, bảng hoặc modal trong mã nguồn. Khi báo hoàn thành, phải nêu những màn hình/thành phần đã sửa, kiểm thử và đối chiếu thực tế; phần chưa kiểm tra không được coi là đã đạt chỉ vì tài liệu có trạng thái `active`.

## 1. Thứ tự áp dụng khi các nguồn khác nhau

| Ưu tiên | Nguồn                                                                                           | Phạm vi quyết định                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1       | Yêu cầu cụ thể của người dùng và nghiệp vụ/API hiện hành                                        | Kết quả cần đạt, trường dữ liệu, quyền, luồng xử lý.                                                                        |
| 2       | [`sku-list-filter-table-style.md`](./sku-list-filter-table-style.md) và Danh sách SKU hiện hành | **Toàn bộ quy cách bộ lọc, bảng, phân trang** ở mục 5 của tài liệu này.                                                     |
| 3       | `TOAST_REFERENCE_LOCKED_1.html` do người dùng cung cấp ngày 04/11/2026                          | Hình thức và hành vi thông báo nổi ở mục 9.                                                                                 |
| 4       | Token, theme và component đang chạy trong `src/shared/ui/`                                      | Cách thực thi màu, font, icon, responsive và accessibility.                                                                 |
| 5       | Hoa Nam Unified UI Kit v3.0.1, đặc biệt `docs/DEV_GUIDE.md` và `docs/COMPONENT_CONTRACTS.md`    | Bổ sung nguyên tắc về hierarchy, density, overlay, form, trạng thái. Kit còn là bản đề xuất, không tự thay toàn bộ runtime. |
| 6       | Tài liệu Vuexy, audit và ảnh tham khảo cũ                                                       | Bối cảnh lịch sử, không làm chuẩn cho màn hình mới.                                                                         |

**Ngoại lệ được chốt:** không áp dụng trang/mục **“10. Data table, filters & pagination”** của UI Kit. Mọi quyết định cho ba thành phần này phải theo quy cách bảng SKU ở ưu tiên 2, kể cả khi bản kit hoặc bản kiểm chứng cũ ghi số đo khác. `docs/DEV_GUIDE.md` của kit có cách đánh số mục khác; ngoại lệ ở đây chỉ nói về phần Data table, filters & pagination của bộ kit trực quan.

Không chép nguyên `dist/hn-components.css` từ UI Kit vào sản phẩm: file đó chứa cả bố cục catalog. Không đổi brand, token, font hoặc icon toàn hệ thống chỉ để một màn hình giống ảnh mẫu. Nếu chủ sản phẩm chốt chuyển sang token kit, thực hiện một đợt migration riêng và cập nhật tài liệu này.

## 2. Nền tảng thị giác và component

| Vai trò    | Chuẩn Web đang áp dụng                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Font       | **Inter** từ `--wms-font-family` / `TYPOGRAPHY.fontFamily`; bản kit cũng dùng Inter.                                                                             |
| Màu        | Operations/SystemHNWeb: `--ops-*` và các alias semantic `--wms-*`; primary `#004E74`, heading `#003B63` ở light mode.                                            |
| Icon       | Bộ icon dùng trong ứng dụng qua `src/shared/ui/icons/` (Flaticon Uicons ở control hiện hành). Không trộn Lucide của kit vào một màn hình đang dùng bộ hiện hành. |
| Theme      | Một `AppThemeProvider` duy nhất; dùng biến semantic cho light/dark, không hard-code màu theo trang.                                                              |
| Thành phần | Ưu tiên `src/shared/ui`, `src/shared/components`, `ActionButton`/`RowActionButton`, `ResponsiveDataTable` và `sonner` đã có.                                     |

Màu mang ý nghĩa nghiệp vụ phải có chữ hoặc icon đi kèm. Dùng success cho hoàn tất, warning cho cần kiểm tra, danger cho lỗi/hủy, info cho thông tin; không dùng một màu để biểu diễn hai ý nghĩa đối lập. Nút chính dùng primary cho **một hành động quyết định trong mỗi vùng**.

Với trạng thái phiếu xuất: `DRAFT` → `neutral`, `SCANNING` → `info`, `POSTED` → `success`, `CANCELLED` → `error` (đỏ). Khi dùng `UiStatusBadge`, phải truyền `tone` theo mã trạng thái; chỉ truyền nhãn sẽ dùng màu trung tính mặc định và có thể làm sai ý nghĩa nghiệp vụ.

### Chữ và kích thước

| Vai trò                        | Cỡ / dòng         | Độ đậm                                     |
| ------------------------------ | ----------------- | ------------------------------------------ |
| Tiêu đề trang desktop / mobile | 24/32px · 20/28px | 700                                        |
| Tiêu đề vùng, drawer           | 18/26px           | 600–700                                    |
| Nội dung chính                 | 14/22px           | 400                                        |
| Label và nội dung phụ          | 13/20px           | 400–600                                    |
| Nút                            | 14/20px           | 600                                        |
| Mã phiếu/SKU chính             | 14/22px           | 700                                        |
| **Đầu bảng**                   | **16/24px**       | **800**, viết hoa, letter spacing `0.02em` |
| **Ô dữ liệu bảng**             | **14/22px**       | 400; mã chính 700                          |

Hai hàng cuối là quy cách riêng của bảng SKU và có ưu tiên hơn tỷ lệ chữ bảng mặc định của kit hoặc tài liệu cũ. Không thu nhỏ chữ để nhồi thêm cột. Số liệu dùng tabular numerals; số trong cột dữ liệu được căn theo ý nghĩa (số lượng thường căn phải). Mã dài phải ngắt dòng hoặc rút gọn có cách xem/copy đầy đủ.

### Khoảng cách và hình dạng

Thang khoảng cách chính: `4 / 8 / 12 / 16 / 24 / 32px`. Trong nhóm dùng 8–16px; giữa nhóm nghiệp vụ dùng 24px. Label cách control 6–8px; helper/error nằm sát control. Căn các khối cùng cấp theo **cùng mép trái/phải** của vùng chứa; không thêm padding riêng cho bộ lọc khiến nó thụt vào so với bảng. Dùng `min-width: 0` cho con flex/grid và kiểm tra nội dung tiếng Việt dài.

Control thường cao 40px, vùng chạm mobile ít nhất 44px; **control bộ lọc bảng cao 48px** theo mục 5. Radius control 6px, card/bảng 8px, overlay theo component hiện hành. Không tự tạo bóng, màu hay khoảng cách rời rạc trong từng page khi đã có token.

## 3. Khung trang và nhịp nội dung

Sử dụng shell hiện hành, không dựng sidebar/topbar riêng. Trình tự trang danh sách: breadcrumb → tiêu đề và hành động chính → tab/tóm tắt nếu có → bộ lọc → bảng → phân trang. Tiêu đề và mô tả cùng một vùng; hành động chính ở bên phải khi đủ chỗ, xuống dòng có trật tự trên màn hẹp.

Trang chi tiết: tóm tắt đối tượng và trạng thái trước, tiếp đến việc người dùng cần làm, rồi dữ liệu hỗ trợ/lịch sử. Thông tin quyết định thao tác phải thấy được trước khi xác nhận. Không thêm card/viền cho từng dòng thông tin; card chỉ giúp phân biệt nhóm có ý nghĩa. Không để vùng trống lớn chỉ vì một nhóm bốn cột chứa một giá trị dài.

| Bề rộng      | Bố cục thường dùng                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `≥1280px`    | Sidebar cố định; trang có padding khoảng 24px; nhóm dữ liệu có thể 2–4 cột khi nội dung đủ ngắn.            |
| `980–1279px` | Sidebar theo shell hiện hành; giảm số cột theo **bề rộng vùng nội dung thực**, không chỉ viewport.          |
| `768–979px`  | Điều hướng dạng drawer; các nhóm dài chuyển 1–2 cột.                                                        |
| `<768px`     | Một cột cho form và bộ lọc; thao tác có vùng chạm phù hợp; bảng dùng card hoặc cuộn trong chính khung bảng. |

Kiểm tra ở `1440`, `1024`, `768`, `390` và `320px`; kiểm tra cả `document.scrollWidth` **và** vùng bảng. Không che lỗi bằng `overflow-x: hidden` ở cấp trang. Tooltip, menu, drawer và bàn phím mobile không được làm mất hành động chính.

## 4. Tác vụ dài: chia thành bước có mục tiêu

Khi form/chi tiết có hơn hai nhóm nghiệp vụ hoặc người dùng phải xử lý tuần tự, dùng **các bước hoặc tab có nhãn hành động**. Mỗi lần tập trung vào một phần việc; giữ tóm tắt đối tượng, trạng thái và tiến độ ở đầu để người dùng không mất ngữ cảnh. Cho phép quay lại xem bước trước nếu nghiệp vụ cho phép, giữ dữ liệu đã nhập, và hiển thị rõ vì sao bước tiếp theo chưa thể làm. Chuyển bước không tự phát sinh mutation.

Thứ tự điển hình của phiếu xuất: **quét và đối chiếu → ghi nhận xuất kho → xem/in nhãn**. Lịch sử, chứng từ đính kèm và thông tin ít dùng có thể ở nhóm mở rộng riêng; không chen vào luồng quyết định chính. Nếu một bước vẫn rất dài, tách danh sách và bộ điều khiển bằng tiêu đề phụ có ý nghĩa; chỉ một vùng cuộn chính trong drawer. Không khóa hay ẩn trạng thái lỗi quan trọng ở một bước khác.

## 5. Bộ lọc, bảng và phân trang — theo bảng SKU

Nguồn quyết định: [`sku-list-filter-table-style.md`](./sku-list-filter-table-style.md) và `src/modules/master-data/pages/sku-list.css`. Không sử dụng mục Data table, filters & pagination của UI Kit để thay các số đo dưới đây.

### Bộ lọc

- Một hàng điều khiển nằm **trực tiếp trên bảng**, cùng lề trái/phải với bao bảng; gap `12px`. Không có card viền quanh bộ lọc, tiêu đề bộ lọc hoặc dải chip lặp lại điều kiện.
- Ô tìm kiếm rộng hơn ô chọn và lọc khi nhập. Ô chọn hiển thị tên trường cùng giá trị trong ô, ví dụ `Trạng thái: Tất cả`; không thêm hàng label phía trên.
- Điều khiển cao `48px`, nền `--ops-surface`, viền `--ops-line`, radius `--ops-radius-control` (`6px`); focus dùng `--ops-link` và quầng màu link 13%.
- Mọi thay đổi bộ lọc áp dụng tự động, không cần nút `Áp dụng`. Nút `Xóa lọc` chỉ xuất hiện khi có điều kiện lọc, theo bản quy cách SKU người dùng chỉ định. Khi hẹp, các ô xuống hàng, ô tìm kiếm chiếm trọn hàng đầu; vùng lọc không làm trang tràn ngang.

### Bảng

| Thành phần         | Quy cách bắt buộc                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bao bảng           | Nền `--ops-surface`, viền `--ops-line`, radius `--ops-radius-card` (`8px`); đầu bảng chạm mép bao, không có padding bao quanh.                                   |
| Đầu bảng           | Nền **`#d2edf7`**, chữ `--ops-muted`, **16/24px, weight 800**, uppercase, letter spacing `0.02em`. Nếu thêm token riêng cho nền này, giữ nguyên giá trị đã chốt. |
| Ô đầu và ô dữ liệu | Padding dọc `12px`, ngang `18px`; ngoại lệ cột STT/hành động theo bảng SKU khi cần; căn giữa theo chiều dọc, đường chia `1px solid --ops-line`.                  |
| Hàng dữ liệu       | Tối thiểu khoảng `68px` khi có biểu tượng `44px`; nội dung có thể cao hơn khi xuống dòng.                                                                        |
| Chữ                | `--ops-text`, **14/22px**; mã chính `--ops-heading`, weight 700.                                                                                                 |
| Biểu tượng mã      | Khung khoảng `44px`, nền `--ops-pale`, màu `--ops-link`, cách mã `12px`.                                                                                         |
| Trạng thái         | Pill cao `24px`, radius `20px`, chữ `11px`, chấm `7px`; dùng token semantic tương ứng.                                                                           |
| Hover/focus        | Hover pha `55% --ops-pale` với `--ops-surface`; focus bàn phím nhìn thấy rõ.                                                                                     |

Mỗi bảng phải có **kế hoạch độ rộng cho mọi cột**, tổng tỷ lệ `100%`. Cột bỏ trống độ rộng có thể hút toàn bộ phần dư và tạo khoảng trắng sai nhịp. Tên cột, thứ tự và nghiệp vụ của từng màn được giữ theo API, không sao chép tên cột SKU sang module khác.

### Mở chi tiết trong bảng — chuẩn mũi tên SKU (04/11/2026)

- Mọi nút **Xem / Mở / Chi tiết** dùng để mở bản ghi từ bảng hoặc card mobile hiển thị **một mũi tên phải `→`** theo mẫu Danh sách SKU. Dùng `RowActionButton kind="view"` hoặc `kind="detail"`; nhãn được giữ trong `aria-label` và tooltip, không hiển thị chữ hay icon mắt bên cạnh mũi tên.
- Cột điều khiển nằm cuối bảng, **không có tiêu đề hiển thị** như “Thao tác”, “Chi tiết”, “Xem”. Giữ ô `<th aria-label="Thao tác">` trống cho công nghệ hỗ trợ. Với `ResponsiveDataTable`, `renderRowActions` mặc định ẩn tiêu đề; cột nút tự khai trong `columns` phải có `isAction: true`. Trên card mobile không lặp nhãn cột điều khiển.
- Mũi tên dùng `--ops-link`, nền mặc định trong suốt, hover nền `--ops-pale`, focus có viền rõ. Nút khoảng `40×40px`, vùng chạm `44×44px`; cột một mũi tên thường rộng `64–96px`, căn gọn ở bên phải. Phân bổ lại phần rộng dư cho cột dữ liệu.
- Mũi tên luôn có thể thấy và dùng bằng bàn phím/chạm. Giữ nguyên quyền, hành vi mở, trạng thái khóa/loading; khi xử lý dùng spinner trong cùng khung nút.
- Các hành động sửa, xóa, in, tải file vẫn dùng icon đúng nghĩa. Cột “Hành động” chứa **dữ liệu sự kiện** trong nhật ký vẫn có tiêu đề; chỉ cột chứa nút điều khiển áp dụng quy tắc header trống.

Khi khung hẹp, dùng `ResponsiveDataTable` chuyển card **hoặc** đặt chiều rộng tối thiểu và cuộn ngang có chủ đích trong khung bảng. Không ép chữ thành các cột dọc; không làm tràn cấp trang. Với bảng rộng trên tablet, ưu tiên cột nhận diện + thông tin quyết định; nếu cuộn, người dùng phải nhận ra vùng có thể cuộn. Sort có trạng thái và `aria-sort`; loading, rỗng, không có kết quả và lỗi tải là các trạng thái khác nhau.

### Phân trang

Chân bảng có viền trên `1px solid --ops-line`, padding `14px 16px`. Nhóm `Hiển thị ...` và chọn số dòng/trang ở bên trái, gap `14px`; nút chuyển trang ở bên phải. Khi hẹp, nhóm trái được xuống dòng và điều hướng vẫn nằm về phía phải. Giữ điều kiện lọc/sắp xếp khi vào chi tiết rồi quay lại nếu luồng hiện hành hỗ trợ.

## 6. Drawer bên phải, dialog và bố cục chi tiết

Dùng **drawer bên phải** cho xem chi tiết, chỉnh sửa hoặc quy trình nhiều phần cần giữ ngữ cảnh trang danh sách. Dùng dialog ở giữa cho quyết định ngắn, xác nhận thao tác nguy hiểm hoặc form thật sự ngắn. Drawer điều hướng mobile là một thành phần khác, không áp kích thước drawer nghiệp vụ cho menu.

| Phần        | Quy tắc                                                                                                                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chiều rộng  | Edit thường khoảng `480px`, detail thường khoảng `640px` theo kit; tác vụ nhiều bước/bảng có thể mở đến khoảng `800–820px` khi có lý do. Luôn `max-width: 100vw`; trên điện thoại chiếm đủ bề ngang.                                                                  |
| Header      | Tiêu đề, định danh/trạng thái cần thiết và nút đóng có nhãn; header giữ nguyên vị trí khi cuộn.                                                                                                                                                                       |
| Nội dung    | **Một vùng cuộn dọc chính**; padding ngang cùng lề giữa header/body/footer, khoảng cách nhóm 16–24px; metadata mặc định 2 cột, dài hoặc mobile 1 cột. Nhóm đúng 3 trường ngắn có thể dùng 3 cột khi vùng chứa đủ rộng, tránh một trường lẻ hàng và khoảng trống thừa. |
| Footer      | Chỉ đặt hành động cấp drawer nếu cần; giữ thấy được mà không che nội dung, tính cả safe area/bàn phím mobile. Action riêng của bước ở gần nội dung bước.                                                                                                              |
| Dữ liệu dài | Mã, địa chỉ, tên người nhận có `min-width: 0`, wrap/copy được; không đẩy cột bên cạnh hoặc làm tràn drawer.                                                                                                                                                           |
| Trạng thái  | Có loading, lỗi kèm thử lại khi thích hợp, rỗng và quyền truy cập; không để drawer trắng.                                                                                                                                                                             |

Drawer/modal phải có tên truy cập, focus vào nội dung phù hợp khi mở, trap focus nếu modal, Escape/backdrop theo tình trạng thay đổi chưa lưu, trả focus về nút mở khi đóng. Confirm nêu **đối tượng + hành động + hậu quả**, nút xác nhận có động từ cụ thể. Không lồng nhiều drawer cùng lúc; những dialog xác nhận ngắn mở từ drawer chỉ dùng khi nghiệp vụ cần. Không để toast che nút xác nhận trong overlay.

**Danh sách nhiều trường trong drawer:** không bê nguyên bảng rộng ở trang danh sách vào drawer rồi bắt kéo ngang. Với chi tiết tồn kho, dùng tab **Tổng quan / Sản phẩm / Vật chứa / Biến động**; giữ SKU, tên hàng, kho và trạng thái ở phần nhận diện chung. Mỗi bản ghi sản phẩm hiện mã và trạng thái trước, các trường sê-ri, mã vật lý, NFC, vị trí và thời điểm nhận mở rộng dọc ngay trong dòng. Giữ đủ dữ liệu gốc, cho mã dài xuống dòng; metadata 2 cột khi đủ rộng và 1 cột trên mobile. Danh sách dài phân trang trong tab, cuộn theo vùng nội dung chính của drawer, không tạo thêm khung cuộn lồng nhau. Cách này là lựa chọn bố cục cho vùng hẹp; bảng thực sự vẫn theo quy cách mục 5.

## 7. Form và hành động

Form dùng label phía trên control; placeholder chỉ gợi ý. Nhãn bắt buộc có `*`, lỗi nằm dưới đúng field và giữ dữ liệu đã nhập. Nhóm field theo mục tiêu nghiệp vụ; hai cột chỉ khi mỗi field còn đủ chỗ đọc. Hàng SKU động đặt **SKU, số lượng và Xóa dòng cùng một hàng điều khiển** ở desktop; căn nút theo thân input, không theo đỉnh label hoặc dòng helper. Trên mobile xếp dọc theo thứ tự nhập, nút xóa vẫn gắn rõ với dòng tương ứng.

Chỉ một primary cho quyết định chính của vùng. Nút đang xử lý giữ kích thước, có spinner/nhãn phù hợp và chặn gửi lặp. Hành động nguy hiểm tách khỏi hành động chính và cần confirm. Nếu nút disabled, lý do phải đọc được ở gần đó. Giữ hành động quan trọng hiển thị bằng chữ; icon-only chỉ dùng khi ý nghĩa đã quen thuộc và có `aria-label`.

## 8. Trạng thái màn hình và nội dung

Loading giữ khung ổn định; rỗng đưa bước tiếp theo; không có kết quả lọc thì gợi ý chỉnh điều kiện đang chọn; lỗi API có cách thử lại; thiếu quyền giải thích rõ; dữ liệu một phần ghi rõ phần còn thiếu. Không dùng toast ba giây để thay cho lỗi cần người dùng sửa hoặc lỗi làm chặn tác vụ. Không hiển thị số `0` giả khi query còn tải.

Nhãn giao diện dịch qua i18n. **Không đưa tên cột SQL/API thô ra UI**: ví dụ `sku_code` → `Mã SKU`, `required_qty` → `Số lượng yêu cầu`, `recipient_name` → `Người nhận`. Tên cột kỹ thuật chỉ nằm trong hướng dẫn định dạng file nâng cao hoặc tài liệu tích hợp. Ngày hiển thị theo `dd/MM/yyyy` khi phù hợp nghiệp vụ; số theo locale người dùng. Kiểm tra nhãn tiếng Việt/Anh dài trước khi chốt độ rộng.

## 9. Thông báo nổi toàn cục — theo HTML người dùng cung cấp

Sử dụng **một** `<Toaster>` Sonner toàn ứng dụng trong `src/app/providers/AppProviders.tsx`, style ở `src/index.css`. Mẫu `TOAST_REFERENCE_LOCKED_1.html` chốt hình thức/hành vi; mã demo độc lập trong HTML không được chép nguyên vào React (đặc biệt không dùng `innerHTML` với dữ liệu thông báo).

| Thuộc tính  | Chuẩn                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vị trí      | Góc **trên bên phải**; desktop `top: 84px`, `right: clamp(12px, 2.2vw, 32px)` theo vùng hiển thị; mobile `top: 74px`, `right: 12px`.                            |
| Kích thước  | Rộng tối đa `390px`, không vượt `100vw - 24px`; khoảng cách giữa toast `10px`; toast mới ở trên.                                                                |
| Hình thức   | Nền surface, viền nhẹ, radius `13px`, shadow nhẹ; icon trạng thái trong vòng `30px`; title `14px/700`, mô tả `13px` (mobile `12px`), nút đóng rõ và focus được. |
| Trạng thái  | `success`, `error`, `warning`, `info`; màu accent nhất quán với ý nghĩa, đi kèm biểu tượng và chữ.                                                              |
| Chuyển động | Vào từ bên phải `350ms`, hiển thị `3000ms`, ra bên phải `300ms`; thanh tiến độ cao `3px` đếm ngược. `prefers-reduced-motion` bỏ chuyển động vào/ra.             |
| Tương tác   | Có nút đóng thủ công, cho vuốt sang phải khi nền tảng hỗ trợ; toast không chặn thao tác ở vùng ngoài nó. Không tự chuyển focus sang toast.                      |
| Truy cập    | Thông báo thường dùng `status`/live polite; lỗi cần chú ý có `alert` phù hợp. Lỗi chặn tác vụ phải tồn tại thêm trong form/banner.                              |

Chỉ báo thành công **sau** phản hồi thành công; tránh hai toast cho cùng một sự kiện. Nội dung ngắn, nêu kết quả và bước tiếp theo nếu cần, không lộ mã lỗi kỹ thuật. Khi drawer/dialog đang mở, kiểm tra toast không che CTA, nút đóng hoặc field quan trọng; nếu va chạm, điều chỉnh vị trí/giới hạn hiển thị của overlay đó. Kiểm tra cả light/dark và mobile.

## 10. Cách thực hiện và kiểm tra màn hình mới

1. Xác định công việc chính, đối tượng, quyền, dữ liệu quyết định, trạng thái lỗi và bề rộng nội dung thực. Chọn mẫu trang, bảng, drawer hoặc dialog theo mục 3–9.
2. Dùng token và component hiện có. Nếu thiếu biến thể, mở rộng component chung có chủ đích; không tạo theme thứ hai, CSS toàn cục riêng cho module, hoặc thư viện icon/UI song song.
3. Kiểm tra từng bước nghiệp vụ, loading/empty/error/no-permission, keyboard, focus, đóng overlay, nội dung dài, tiếng Việt/Anh, light/dark.
4. Kiểm tra `1440 / 1024 / 768 / 390 / 320px`: mép lọc và bảng, bảng cuộn trong khung, drawer không tràn, footer không che input khi hiện bàn phím, toast không che CTA.
5. Chạy kiểm tra phù hợp với phạm vi: `npm run typecheck`, kiểm thử liên quan, `npm run lint`, `npm run ui:tokens`, `npm run ui:components`, `git diff --check`. Chỉ báo đạt những kiểm tra đã thực sự chạy; nếu gate chung lỗi vì file ngoài phạm vi, nêu rõ nguyên nhân.

**Nguồn triển khai hiện hành:** `src/shared/ui/tokens/operations.css`, `src/shared/ui/tokens/primitives.ts`, `src/shared/ui/theme/`, `src/shared/ui/components/UiDialog.tsx`, `src/shared/components/data-display/ResponsiveDataTable.tsx`, `src/modules/master-data/pages/sku-list.css`, `src/app/providers/AppProviders.tsx`, `src/index.css`. Các nguồn này giúp tìm đúng nơi sửa code; tài liệu này chốt quy tắc thiết kế. Khi code và quy tắc lệch nhau, sửa cùng một thay đổi và ghi rõ quyết định thay thế.
