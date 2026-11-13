---
title: Hoa Nam WMS — Chuẩn giao diện Web thống nhất
status: active
version: 2.5
updated: 2026-11-13
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

Tên icon phải khớp bộ đang render: `UiIcon` nhận slug Flaticon có trong CSS/font đang nạp; tên trong `VUEXY_NAV_ICONS` chỉ dùng với `VuexyNavIcon`. Không lấy tên SVG của bộ này đưa vào font của bộ khác. Ví dụ mục Hồ sơ cá nhân ở nhóm Hệ thống dùng `user` qua `UiIcon`; kiểm tra glyph thực tế sau khi thêm menu để tránh icon trống.

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

Tiêu đề trang/vùng/drawer và nhãn đầu bảng dùng `--ops-heading` (`--wms-text-strong`), không dùng màu muted/disabled hoặc giảm opacity. `--ops-muted` dành cho thông tin phụ. Áp dụng quy tắc tương phản dưới đây cho cả light và dark.

### Độ tương phản và đường chia — phòng lỗi ngày 04/11/2026

- Chọn **cặp chữ + nền theo cùng theme**: đầu bảng dùng `--ops-table-header` + `--ops-heading`; nút mũi tên dùng `--ops-link` trên nền trong suốt, hover/focus dùng `--ops-pale`. Không gán trực tiếp `#d2edf7`/`#dff0f7` vào CSS trang hoặc inline style: màu sáng chỉ được khai trong token light.
- Chữ thường/nhãn bảng tối thiểu **4.5:1** trên nền thực; tiêu đề drawer đặt mục tiêu **7:1**; icon tương tác tối thiểu **3:1** ở trạng thái thường/hover/focus. Không dùng màu chữ phụ để làm tiêu đề dịu đi.
- **Tiêu đề bảng ở giao diện sáng:** dùng `--ops-heading` = **`#003B63`**, nền `--ops-table-header` = `#D2EDF7`, cỡ **16/24px, đậm 800**. Áp dụng cả STT, cột thường và chữ trong nút sắp xếp; không dùng `--ops-muted`, màu xám hoặc opacity thấp. Chữ nhãn giữ màu heading khi hover/focus/đang sắp xếp; icon sắp xếp có thể đổi màu để báo chiều sort nhưng không làm nhãn mờ đi. Cặp màu đầu bảng này phải đạt **≥7:1**; dark dùng cặp semantic tương ứng, không ghi trực tiếp hex vào CSS trang. Bộ hồi quy kiểm từng nhãn thay vì chỉ đo một ô `<th>` đại diện.
- **Menu trung tính khi hover/focus/được chọn:** nền `--ops-pale` (`--wms-bg-subtle`), chữ `--ops-heading` (`--wms-text-strong`), icon và dấu ✓ kế thừa màu chữ. Dark: nền **`#223D50`**, chữ/icon sáng **`#DAECF6`**; light: nền `#EAF5F8`, chữ `#003B63`. Giữ chữ sáng khi di chuột qua mục đã chọn; nhận biết lựa chọn bằng nền + dấu ✓/`aria-checked`, không đổi chữ sang xanh thương hiệu. Không dùng `primary`, `primary-dark` hoặc giảm opacity cho chữ/icon menu trung tính; màu thương hiệu không phải token chữ trên nền hover. Áp dụng menu tài khoản, giao diện, ngôn ngữ, kết quả tìm kiếm và menu chọn dùng chung. Hành động nguy hiểm như Đăng xuất vẫn dùng màu ngữ nghĩa riêng. Kiểm tra cả hover, focus bàn phím, selected và selected+hover; `npm run test:ui-contrast` có ca topbar desktop/mobile ở hai theme.
- `--ops-line` dành cho viền nhẹ/trang trí. Đường chia cần nhận biết giữa header/body, nhóm thông tin và footer của drawer dùng **`1px solid --ops-divider`**, tối thiểu **3:1** với surface. `UiDrawer` áp dụng token này ở header/footer; `--wms-divider`/palette `divider` giữ viền nhẹ hiện hành cho bảng và thành phần khác. Không xóa đường chia để làm giao diện phẳng; không tăng độ đậm toàn bộ viền trang trí.
- Drawer dùng surface đặc `--ops-surface`, chữ semantic và **`background-image: none`** tại theme MUI dùng chung. Lớp phủ trắng theo elevation của MUI làm nền dark bị bạc màu và thay đổi tương phản; chỉ backdrop ngoài drawer được làm tối, không giảm opacity cả drawer hoặc tiêu đề.
- Kiểm tra **computed style trong trình duyệt**, gồm CSS biến, inline style, selector theo trang, portal và hover/focus. Kiểm tra CSS nguồn hoặc palette riêng lẻ chưa chứng minh màu cuối cùng đúng. Chạy `npm run test:ui-contrast` khi sửa theme, bảng, mũi tên hoặc drawer; bộ hồi quy render màn SKU thật và nút mũi tên dùng chung ở light/dark, `1440/1024/768/390/320px`, đo tương phản và giữ ảnh ở `test-results/ui-contrast/`.
- `npm run ui:tokens` cấm hai màu light cũ `#d2edf7`/`#dff0f7` ngoài thư mục token **kể cả khi baseline cũ còn cho phép hex trong file**. Chạy thêm `node scripts/check-ui-tokens.mjs --self-test` khi thay guard. Không tăng baseline để bỏ qua lỗi mới.

Lỗi gốc đã ghi nhận: bảng/hover dùng màu light cố định trong khi chữ đổi sang dark; tiêu đề dùng màu phụ; divider quá nhạt; MUI Drawer elevation thêm gradient trắng. Khi gặp lỗi tương tự, kiểm tra token và cascade tại component dùng chung trước, rồi sửa các override cùng mẫu trong module. Phạm vi kiểm chứng từng màn phải được báo riêng, không suy ra toàn bộ hệ thống đã đạt chỉ từ bộ hồi quy SKU.

### Hover thống nhất ở giao diện tối — ngày 13/11/2026

**Một quy tắc chung cho tương tác trung tính:** hover dùng nền đặc `var(--ops-pale)` (**`#223D50`**) và chữ/icon tương tác `var(--ops-heading)` (**`#DAECF6`**). Alias tương đương là `--wms-bg-subtle` và `--wms-text-strong`. Đây là màu Operations đang có, không tạo thêm palette riêng hoặc dùng bảng màu Vuexy nền tím làm chuẩn cho màn Operations. Màu chỉ được khai báo trong token; CSS màn hình và `sx` phải tham chiếu biến semantic.

Mục tiêu: di chuột chỉ làm vùng tương tác sáng lên nhẹ trong cùng tông xanh tối, không xuất hiện mảng trắng, không làm mất chữ/icon, không thay đổi kích thước hoặc gây giật bố cục. Cặp chữ chính/nền hover trên có tương phản khoảng **9.4:1**. Nội dung phụ, liên kết và badge phải được kiểm tra riêng trên nền hover; con số này không đại diện cho mọi phần tử con.

| Thành phần | Quy tắc hover/focus ở dark mode |
| ---------- | ------------------------------ |
| Nút phụ, nút text trung tính, nút icon, nút đóng, hành động xem chi tiết | Nền `--ops-pale`, chữ/icon `--ops-heading`; icon kế thừa `currentColor`. Chỉ áp dụng khi nút tương tác được. |
| Menu tài khoản, ngôn ngữ, giao diện, Select/Autocomplete/combobox, kết quả tìm kiếm | Cùng cặp màu trên cho hover, focus bàn phím, selected và selected+hover. Dùng dấu ✓, `aria-selected`/`aria-checked` để giữ dấu hiệu chọn; không chuyển chữ sang primary. |
| Hàng bảng, danh sách, card có thể bấm | Nền hover `--ops-pale`; giữ màu chữ semantic và badge nghiệp vụ. Ô có nền riêng, cột sticky và ô hành động phải cùng nền với hàng, không để lại ô trắng. Không thêm hover giả lên card chỉ để hiển thị thông tin. |
| Tab, phân trang, điều hướng chưa chọn | Dùng cặp hover trung tính. Tab/trang/menu đang chọn giữ dấu hiệu active hiện hành (indicator, nền primary hoặc marker) khi hover; hover không được xóa trạng thái chọn. |
| Input, ô tìm kiếm, bộ lọc | Giữ nền surface tối hiện hành; hover làm rõ viền bằng token semantic. Focus dùng focus ring; không đổi cả ô sang nền trắng hoặc giả trạng thái đã chọn. |
| Liên kết và mã bấm được trong bảng | Giữ quy cách mã ở mục Thang chữ: chữ `--ops-link` trên nền tối, không thêm gạch chân hay đổi độ đậm/kích thước. Nếu có vùng bấm riêng, nền hover dùng `--ops-pale`; đo tương phản trên nền hàng thực tế. |

**Ngoại lệ mang ý nghĩa hành động:** nút chính đang có nền primary dùng `--ops-primary-hover` + `--ops-on-primary`; hành động xóa/hủy/đăng xuất giữ cặp màu danger semantic đủ tương phản. Không ép mọi nút thành trung tính làm mất phân cấp hoặc ý nghĩa nghiệp vụ. Disabled/loading không nhận hiệu ứng hover làm người dùng tưởng có thể bấm; selected+hover và danger+hover phải được kiểm tra như trạng thái riêng.

**Hành vi chung:** chuyển màu nền/chữ/viền theo `--wms-motion-fast` (140ms) và `--wms-ease-standard`; không nâng card, phóng to nút hoặc thêm bóng trắng khi hover. Tôn trọng `prefers-reduced-motion`. `:focus-visible` dùng cùng cặp màu trung tính và giữ focus ring hiện hành, không xóa outline mà không thay thế. Với hover thuần trang trí, chỉ kích hoạt trên thiết bị hỗ trợ hover; trên cảm ứng không dựa vào hover để lộ hành động hoặc thông tin cần thiết.

**Thực thi dùng chung:** cấu hình trong theme adapter MUI/AntD và component chung trước, sau đó thay override tại module. Popup/portal gắn ở `body` phải đọc token từ `:root[data-theme="dark"]`, không phụ thuộc việc nằm trong `.hn-system-shell`. Không thêm một selector toàn cục `*:hover` hoặc `button:hover !important`: cách này ghi đè cả primary, danger, disabled và trạng thái đã chọn. Không dùng nền `white`, `#fff`, màu xám sáng cố định, overlay trắng đậm hoặc công thức pha riêng theo từng màn cho hover trung tính. Không dùng `--ops-primary` làm màu chữ menu trung tính trên nền `--ops-pale`.

**Những khác biệt đã thấy khi đọc mã nguồn (chưa phải kết luận render):**

- Quét tĩnh ngày 13/11/2026 trên toàn bộ `src/**/*.css`: **103 file CSS, 473 lần xuất hiện `:hover`** (app 21, module 408, shared 9, styles 31, index 4). Đây là số lần xuất hiện trong mã, không phải số component hay số lỗi; chưa bao gồm đầy đủ hover viết trong TS/TSX, mặc định thư viện và computed style runtime.
- `src/modules/reports/io-history/rpt08/base.css`: `summary:hover` của menu kho dùng nền light cố định `#f9fdff`; cần chuyển về token và kiểm tra cả trạng thái `[open]` khi triển khai.
- `src/modules/dashboard/dashboard-overview.css` và `src/app/layouts/system-shell.css`: có hover pha `--map-white` với nền trong suốt. Có thể là lớp phủ nhẹ có chủ đích, không được kết luận thành lỗi nền trắng chỉ từ tìm kiếm; cần đo màu sau pha và kiểm tra dark override/cascade.
- `src/modules/reports/components/report-filter-combobox.css`: option hover dùng `--ops-primary`; selected+hover chuyển sang nền primary, khác hợp đồng menu trung tính.
- `src/modules/putaway/pages/putaway-queue.css`: menu chọn có chữ primary khi selected+hover; hover hàng dùng nhiều tỷ lệ pha màu khác nhau.
- `src/modules/inventory/pages/inventory-page.css` và `src/modules/master-data/components/agency-list.css`: hover hàng pha pale/surface 55%, khác nền đặc thống nhất; kiểm tra cả ô sticky/ô hành động khi chuyển đổi.
- `src/app/layouts/system-shell.css`: sidebar có quy tắc hover và active riêng; khi chuẩn hóa cần giữ marker/gradient active, đối chiếu cả drawer điều hướng mobile.

**Điều kiện nghiệm thu:** kiểm tra computed style trong trình duyệt ở light và dark cho normal → hover → focus-visible → selected → selected+hover → disabled, gồm dropdown mở bằng portal, ô sticky, nút nằm trong hàng đang hover và drawer/dialog. Chữ thường ≥4.5:1, icon tương tác ≥3:1. Chạy `npm run test:ui-contrast` và `npm run ui:foundation` khi triển khai; bổ sung ca còn thiếu thay vì xem kết quả SKU/topbar là bằng chứng cho mọi module.

Phạm vi rà soát phải bao gồm shell/topbar/sidebar; dashboard; nhập/xuất/đảo phiếu; tồn kho/xếp khay/sơ đồ; danh mục; bảo hành; báo cáo; tài khoản/phân quyền/cài đặt; thông báo/audit; các popup, drawer, dialog và component chung. Ghi riêng từng màn/trạng thái đã kiểm chứng. **Mục này xác lập chuẩn cần áp dụng; chưa chứng minh toàn bộ giao diện hiện hành đã được sửa hoặc kiểm thử trực quan.**

### Thang chữ

| Vai trò                        | Cỡ / dòng         | Độ đậm                                     |
| ------------------------------ | ----------------- | ------------------------------------------ |
| Tiêu đề trang desktop / mobile | 24/32px · 20/28px | 700                                        |
| Tiêu đề vùng, drawer           | 18/26px           | 600–700                                    |
| Nội dung chính                 | 14/22px           | 400                                        |
| Label và nội dung phụ          | 13/20px           | 400–600                                    |
| Nút                            | 14/20px           | 600                                        |
| Mã phiếu/SKU chính             | 15/22px           | 600, theo chữ mã SKU đang render thực tế   |
| **Đầu bảng**                   | **16/24px**       | **800**, chỉ viết hoa chữ cái đầu, letter spacing `normal` |
| **Ô dữ liệu bảng**             | **14/22px**       | 400; mã chính 15/22px, đậm 600             |

Hai hàng cuối là quy cách riêng của bảng SKU và có ưu tiên hơn tỷ lệ chữ bảng mặc định của kit hoặc tài liệu cũ. Không thu nhỏ chữ để nhồi thêm cột. Số liệu dùng tabular numerals; số trong cột dữ liệu được căn theo ý nghĩa (số lượng thường căn phải). Mã dài phải ngắt dòng hoặc rút gọn có cách xem/copy đầy đủ.

**Mã chính trong bảng — chốt theo SKU thực tế ngày 04/11/2026:** dùng cùng **Inter / 15px / cao dòng 22px / đậm 600** như `SKU-DEMO-003` ở Danh sách SKU; áp dụng cả mã phiếu bảo hành `WC-*`, bảng desktop và card mobile. Kiểm tra chữ thực sự chứa mã, không chỉ phần tử bao: `.hn-sku-cell-text > :first-child` đặt cỡ 15px, còn `SkuLink` đặt đậm 600; chữ bên trong mới là mẫu đối chiếu. Quy tắc cũ 14/22px, đậm 700 cho mã chính đã không khớp runtime và được thay bằng số đo này; nội dung bảng thường vẫn 14/22px, đậm 400. Không lồng `<strong>`/`<b>` có `bolder` vào nút mã đã đặt font-weight vì có thể nâng chữ lên 900; để mã kế thừa đúng một mức đậm. Mã bấm được **không gạch chân khi hover/focus**, không đổi cỡ/độ đậm theo trạng thái; vẫn giữ focus bàn phím dễ thấy và hành vi mở chi tiết. Màu thường dùng `--ops-heading`, mã tương tác khi hover dùng `--ops-link` theo theme và đạt tương phản chữ tối thiểu 4.5:1 trên nền hàng; không lấy màu để bù độ đậm sai.

**Nội dung dài trong ô bảng:** mọi cột phải có một trong hai cách xử lý, không để chữ tràn sang cột bên cạnh. Cột định danh/ngắn (mã phiếu, SKU, mã lỗi, số điện thoại, ngày giờ, số lượng, trạng thái, loại, hành động) dùng **một dòng + “…” + tooltip** để giữ hàng gọn và dễ so khớp. Cột chữ người đọc (tên sản phẩm/đại lý/nhà cung cấp/khách hàng, mô tả, ghi chú, địa chỉ, lý do, nội dung lỗi) được **xuống tối đa hai dòng** rồi cắt “…” và giữ đủ nội dung ở tooltip. Dùng `TruncatedText` (`lines={1}` hoặc `lines={2}`) hoặc class `.hn-truncate`/`.hn-truncate-2`; không cắt chuỗi bằng JavaScript. `ResponsiveDataTable` tự chọn 1/2 dòng theo loại cột, màn có thể override bằng `truncate`.

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
- Sidebar mở làm giảm vùng nội dung thực; chỉ xuống hàng khi các control không còn đủ chỗ đọc. Không dùng breakpoint rộng khiến một hàng vừa đủ bị tách thành nhiều hàng. Ô tìm kiếm co giãn, hai ô chọn có tỷ lệ hợp lý, nút Bộ lọc/Xóa lọc rộng theo nội dung; kiểm tra cả lúc có và không có nút Xóa lọc. Nhãn chọn dài có thể xuống hai dòng trong ô cao 48px khi cần; không giảm cỡ chữ để ép vừa.
- Ô tìm kiếm rộng hơn ô chọn và lọc khi nhập. Ô chọn hiển thị tên trường cùng giá trị trong ô, ví dụ `Trạng thái: Tất cả`; không thêm hàng label phía trên.
- Icon tìm kiếm cách chữ/placeholder `8–12px`, giữ khoảng cách cả khi đã nhập nội dung. Với `UiTextField`, bọc icon trong `InputAdornment position="start"` (import qua `@/shared/ui`); không truyền icon trần rồi trông chờ CSS của `.MuiInputAdornment-root`. Ô tự dựng dùng gap hoặc margin tương đương, không cộng cả hai làm khoảng cách bị nhân đôi.
- Điều khiển cao `48px`, nền `--ops-surface`, viền `--ops-line`, radius `--ops-radius-control` (`6px`); focus dùng `--ops-link` và quầng màu link 13%.
- Mọi thay đổi bộ lọc áp dụng tự động, không cần nút `Áp dụng`. Nút `Xóa lọc` chỉ xuất hiện khi có điều kiện lọc, theo bản quy cách SKU người dùng chỉ định. Khi hẹp, các ô xuống hàng, ô tìm kiếm chiếm trọn hàng đầu; vùng lọc không làm trang tràn ngang.
- Menu dropdown mở ra **rộng bằng đúng ô chọn**, giống hành vi popper của ô gõ-để-tìm; nhãn dài hơn ô thì xuống dòng trong lòng menu.

### Bảng

| Thành phần         | Quy cách bắt buộc                                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bao bảng           | Nền `--ops-surface`, viền `--ops-line`, radius `--ops-radius-card` (`8px`); đầu bảng chạm mép bao, không có padding bao quanh.                                                                       |
| Đầu bảng           | Nền `--ops-table-header` (**`#d2edf7`** ở light, nền semantic tối ở dark), chữ `--ops-heading`, **16/24px, weight 800**, chỉ viết hoa chữ cái đầu, letter spacing `normal`. Không gán màu sáng trực tiếp tại trang. |
| Ô đầu và ô dữ liệu | Padding dọc `12px`, ngang `18px`; ngoại lệ cột STT/hành động theo bảng SKU khi cần; căn giữa theo chiều dọc, đường chia `1px solid --ops-line`.                                                      |
| Hàng dữ liệu       | Tối thiểu khoảng `68px` khi có biểu tượng `44px`; nội dung có thể cao hơn khi xuống dòng.                                                                                                            |
| Chữ                | `--ops-text`, **14/22px**, đậm 400; mã chính `--ops-heading`, **Inter 15/22px, đậm 600** theo chữ SKU thực tế; hover/focus không gạch chân, giữ focus bàn phím rõ.                                   |
| Biểu tượng mã      | Khung khoảng `44px`, nền `--ops-pale`, màu `--ops-link`, cách mã `12px`.                                                                                                                             |
| Trạng thái         | Pill cao `24px`, radius `20px`, chữ `11px`, chấm `7px`; dùng token semantic tương ứng.                                                                                                               |
| Hover/focus        | Hover pha `55% --ops-pale` với `--ops-surface`; focus bàn phím nhìn thấy rõ.                                                                                                                         |

Mỗi bảng phải có **kế hoạch độ rộng cho mọi cột**, tổng tỷ lệ `100%`. Cột bỏ trống độ rộng có thể hút toàn bộ phần dư và tạo khoảng trắng sai nhịp. Tên cột, thứ tự và nghiệp vụ của từng màn được giữ theo API, không sao chép tên cột SKU sang module khác.

Cột số thứ tự hiển thị tiêu đề **`#`** trên toàn hệ thống (thay cho nhãn `STT` cũ), căn giữa; số thứ tự tính theo trang hiện tại và đi theo đúng dòng dữ liệu khi sắp xếp. Đây là quy ước chung, không đặt lại nhãn riêng theo module.

### Mở chi tiết trong bảng — chuẩn mũi tên SKU (04/11/2026)

- Mọi nút **Xem / Mở / Chi tiết** dùng để mở bản ghi từ bảng hoặc card mobile hiển thị **một mũi tên phải `→`** theo mẫu Danh sách SKU. Dùng `RowActionButton kind="view"` hoặc `kind="detail"`; nhãn được giữ trong `aria-label` và tooltip, không hiển thị chữ hay icon mắt bên cạnh mũi tên.
- Cột điều khiển nằm cuối bảng, **không có tiêu đề hiển thị** như “Thao tác”, “Chi tiết”, “Xem”. Giữ ô `<th aria-label="Thao tác">` trống cho công nghệ hỗ trợ. Với `ResponsiveDataTable`, `renderRowActions` mặc định ẩn tiêu đề; cột nút tự khai trong `columns` phải có `isAction: true`. Trên card mobile không lặp nhãn cột điều khiển.
- Mũi tên dùng `--ops-link`, nền mặc định trong suốt, hover nền `--ops-pale`, focus có viền rõ. Nút khoảng `40×40px`, vùng chạm `44×44px`; cột một mũi tên thường rộng `64–96px`, căn gọn ở bên phải. Phân bổ lại phần rộng dư cho cột dữ liệu.
- Mũi tên luôn có thể thấy và dùng bằng bàn phím/chạm. Giữ nguyên quyền, hành vi mở, trạng thái khóa/loading; khi xử lý dùng spinner trong cùng khung nút.
- Các hành động sửa, xóa, in, tải file vẫn dùng icon đúng nghĩa. Cột “Hành động” chứa **dữ liệu sự kiện** trong nhật ký vẫn có tiêu đề; chỉ cột chứa nút điều khiển áp dụng quy tắc header trống.

Khi khung hẹp, dùng `ResponsiveDataTable` chuyển card **hoặc** đặt chiều rộng tối thiểu và cuộn ngang có chủ đích trong khung bảng. Không ép chữ thành các cột dọc; không làm tràn cấp trang. Với bảng rộng trên tablet, ưu tiên cột nhận diện + thông tin quyết định; nếu cuộn, người dùng phải nhận ra vùng có thể cuộn. Sort có trạng thái và `aria-sort`; loading, rỗng, không có kết quả và lỗi tải là các trạng thái khác nhau.

### Phân trang

Ô chọn số dòng theo mẫu SKU: hiển thị `N / trang` trong ô (tiếng Anh `N / page`), không có nhãn `Số dòng/trang` bên ngoài. Dùng `UiSelect`, bản dịch `shared.table.perPage` và tên truy cập `shared.table.rowsPerPageAria`; giữ các mức số dòng và hành vi phân trang riêng của từng màn. Quy cách đầy đủ nằm trong tài liệu SKU ở ưu tiên 2.

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

**Truy vết chứng từ:** chia **Tổng quan / Dữ liệu liên quan / Lịch sử & điều chỉnh**; dùng danh sách mở rộng dọc cho dòng chứng từ, vật chứa, biến động và chuỗi điều chỉnh. Nhóm metadata dùng nền surface thường, ngăn nhóm bằng khoảng cách/đường chia nhẹ; không phủ nền xanh cho mọi khối hay đóng khung từng mã. Nhấn đậm mã nhận diện và số liệu cần đọc; dùng màu thành công/nguy hiểm cho biến động tăng/giảm, số 0 và dữ liệu thiếu giữ màu thường. Chỉ trạng thái có ý nghĩa nghiệp vụ dùng pill màu; loại giao dịch, loại mã và loại nguồn là chữ thường. Nhãn trạng thái phải theo đúng loại chứng từ (phiếu xuất `POSTED` là **Đã xuất kho**, không dùng nhãn nhập kho). Lỗi và nút thử lại luôn nằm trên vùng tab.

### Xuất báo cáo dùng chung

Mọi nút **Xuất báo cáo** dùng ReportExportButton / ReportExportAction: cùng màu primary từ token, icon tải xuống, cao tối thiểu 44px, font 14/20px và trạng thái loading/disabled. Không thêm màu/kiểu riêng theo module. Khi nhấn, mở ReportExportDrawer bên phải rộng 560px, tối đa 100vw; header và footer cố định, thân có một vùng cuộn.

Drawer hiển thị điều kiện đang áp dụng, phạm vi toàn bộ kết quả/trang hiện tại (và SKU cần kiểm tra khi đối soát), các nội dung thực sự được nguồn dữ liệu hỗ trợ, tóm tắt và tên tệp có thể sửa. Các lựa chọn phải ảnh hưởng đến file thực tế. Với Excel từ máy chủ, giữ luồng kiểm quyền/audit/job/mask và tùy biến workbook sau khi tải thành công; phạm vi chọn theo định danh để giữ đủ dòng hàng của phiếu. PDF chỉ hiện lựa chọn toàn bộ chi tiết khi API hỗ trợ. Báo lỗi trong drawer, giữ lựa chọn để thử lại, khóa gửi lặp và đóng khi đang xuất. Không tự tải file ngay khi mở drawer.

## 7. Form và hành động

Với form nhiều dòng trong drawer (ví dụ tạo phiếu đảo), tách bước **chọn giao dịch → nhập điều chỉnh**; dùng từng khối SKU gồm số lượng gốc/đã điều chỉnh/còn lại và các ô nhập liên quan, thay cho bảng rộng phải kéo ngang. Chuyển bước phải giữ dữ liệu đang nhập. Đặt tổng và nút tạo/lưu qua `actions` của `UiDrawer` để chân drawer nằm ngoài vùng cuộn chính. Chú thích giải thích chung có thể thu vào icon **i** có tooltip khi hover/focus; lỗi, điều kiện chặn và ảnh hưởng tồn kho cần ra quyết định vẫn hiện trực tiếp.

Form dùng label phía trên control; placeholder chỉ gợi ý. Nhãn bắt buộc có `*`, lỗi nằm dưới đúng field và giữ dữ liệu đã nhập. Nhóm field theo mục tiêu nghiệp vụ; hai cột chỉ khi mỗi field còn đủ chỗ đọc. Hàng SKU động đặt **SKU, số lượng và Xóa dòng cùng một hàng điều khiển** ở desktop; căn nút theo thân input, không theo đỉnh label hoặc dòng helper. Trên mobile xếp dọc theo thứ tự nhập, nút xóa vẫn gắn rõ với dòng tương ứng.

Chỉ một primary cho quyết định chính của vùng. Nút đang xử lý giữ kích thước, có spinner/nhãn phù hợp và chặn gửi lặp. Hành động nguy hiểm tách khỏi hành động chính và cần confirm. Nếu nút disabled, lý do phải đọc được ở gần đó. Giữ hành động quan trọng hiển thị bằng chữ; icon-only chỉ dùng khi ý nghĩa đã quen thuộc và có `aria-label`.

Nút/chữ **Hủy** dùng `--wms-error-text` (đỏ) ở cả light và dark, kể cả trong dialog, drawer, bộ chọn ngày và bảng. Giữ bề mặt tonal trung tính cho nút Hủy để không tranh vai với hành động phá huỷ; không dùng màu link/neutral cho chữ Hủy.

### Tệp nhập liệu và thông báo lỗi

- Kiểm tra định dạng/dung lượng ngay khi chọn tệp, trước khi đọc nội dung, tính mã kiểm tra hoặc tạo yêu cầu tải lên. Đợi hạn mức bất đồng bộ và kiểm tra lại khi hạn mức thay đổi; trước lần gửi thật cũng kiểm tra lại. Dùng giới hạn byte/KB chính xác do máy chủ công bố, không lấy số MB đã làm tròn để chặn tệp. Thông báo quá dung lượng: **“File quá lớn. Tối đa X MB”**, X lấy từ cùng giới hạn đang áp dụng.
- Phân biệt **lỗi tệp** (sai định dạng, thiếu/lặp/cột không hỗ trợ, tệp hỏng, quá dung lượng/số dòng) và **lỗi dữ liệu từng dòng**. Lỗi tệp có thể không có danh sách dòng lỗi hay số liệu kết quả; không ép đọc `row_errors` từ loại phản hồi này. Với phản hồi thiếu/hỏng dữ liệu, không tự điền số 0 hay giả kết quả hợp lệ; hiển thị rõ chưa nhận đủ kết quả từ máy chủ.
- Nêu lý do và cách sửa bằng ngôn ngữ đang chọn. Tiếng Việt không để lộ đường dẫn trường API, mã lỗi nội bộ, “legacy”, “dry-run”, “rollback” hoặc lỗi thư viện tiếng Anh trong thông báo. Chỉ tên cột do người dùng nhập hoặc hướng dẫn định dạng tệp mới cần giữ nguyên để họ tìm đúng cột.
- **Một lỗi, một nơi hiển thị:** lỗi cần sửa/thử lại ngay trong hộp nhập dùng một cảnh báo tại chỗ, không bật thêm toast cùng nội dung. Kết quả kiểm tra có dòng lỗi dùng cảnh báo cùng bảng chi tiết; không lặp lại bằng toast. Lỗi hành động không có vùng hiển thị tại chỗ mới dùng toast. Chọn tệp/lựa chọn mới phải xóa lỗi cũ; kiểm tra lại thay thế thông báo hiện có.
- Sau lỗi hoặc hết thời gian chờ, kết thúc trạng thái đang xử lý để người dùng sửa tệp/thử lại; không treo nút hoặc tự gửi lặp. Chỉ mở nhập dữ liệu sau kết quả kiểm tra hợp lệ khớp đúng tệp/lựa chọn hiện tại. Nếu kết quả lần ghi chưa xác định, giữ cơ chế kiểm tra lịch sử/chặn gửi trùng, không khẳng định dữ liệu chưa được ghi chỉ để hiển thị câu dễ hiểu.
- Kiểm thử dưới/đúng/vượt giới hạn, hạn mức trả chậm, tệp sai/hỏng/thiếu cột, máy chủ từ chối dung lượng và timeout; tệp quá lớn không được đọc/gửi, không có thông báo trùng, không mở nhầm nút nhập. Với SKU: `npm run test:sku-import-errors` kiểm tra component/service production và Toaster thật qua transport kiểm soát.

## 8. Trạng thái màn hình và nội dung

**Ngôn ngữ giao diện và lỗi (13/11/2026):** dịch cả placeholder tìm trong dropdown, mô tả KPI, tooltip/`aria-label`, loading/empty state, lỗi dưới trường, banner và toast. Component dùng `useT`; option/nhãn có `useMemo` phải cập nhật theo hàm dịch. Không đóng băng bản dịch ở hằng module hoặc spread bảng nhãn song ngữ ra hằng; `tStatic` chỉ dùng khi tạo thông điệp tại thời điểm xử lý ngoài React. Schema form nhận hàm dịch hiện hành; khi đổi ngôn ngữ, cập nhật lỗi đã hiện mà giữ giá trị nhập, không tự làm lộ lỗi ở trường chưa tương tác. Lỗi API đi qua `getApiErrorMessage`/`resolveFormErrors`; chi tiết của alert dùng `getApiErrorDetails`, không render thẳng metadata trong `normalizeError.errors`. Mẫu dịch lỗi phải có phần chữ cố định, không dùng mẫu chỉ chứa biến như `{title}` để khớp mọi câu. Giữ nguyên tên, mã và nội dung người dùng; thông điệp máy chủ chưa có mẫu dịch phải được ghi nhận để bổ sung, không thay bằng câu chung làm mất chi tiết. Chạy hồi quy catalog tiếng Anh/Trung để chặn khóa thiếu và biến nội suy lệch. Phạm vi rà soát/giới hạn được ghi trong [audit tiếng Anh](./audits/2026-11-13-english-localization.md).

Loading giữ khung ổn định; rỗng đưa bước tiếp theo; không có kết quả lọc thì gợi ý chỉnh điều kiện đang chọn; lỗi API có cách thử lại; thiếu quyền giải thích rõ; dữ liệu một phần ghi rõ phần còn thiếu. Không dùng toast ba giây để thay cho lỗi cần người dùng sửa hoặc lỗi làm chặn tác vụ. Không hiển thị số `0` giả khi query còn tải.

Nhãn giao diện dịch qua i18n. **Không đưa tên cột SQL/API thô ra UI**: ví dụ `sku_code` → `Mã SKU`, `required_qty` → `Số lượng yêu cầu`, `recipient_name` → `Người nhận`. Tên cột kỹ thuật chỉ nằm trong hướng dẫn định dạng file nâng cao hoặc tài liệu tích hợp. Ngày hiển thị theo `dd/MM/yyyy` khi phù hợp nghiệp vụ; số theo locale người dùng. Kiểm tra nhãn tiếng Việt/Anh/Trung trước khi chốt độ rộng. Bản tiếng Trung phải được kiểm tra trên cây message **sau khi ghép supplement**, đủ khóa và biến nội suy như bản Việt; thêm test để chặn chữ Việt/Anh bị giữ lại ngoài tên ngôn ngữ gốc, mã kỹ thuật và dữ liệu. Kiểm tra cả nhãn nghiệp vụ, breadcrumb, lỗi form/API và thông báo, không chỉ khóa trong từ điển. Phạm vi kiểm chứng nằm trong [audit tiếng Trung](./audits/2026-11-13-chinese-localization.md).

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
| Truy cập    | Thông báo thường dùng `status`/live polite; lỗi cần chú ý có `alert` phù hợp. Lỗi chặn tác vụ hiển thị trong form/banner, không lặp bằng toast.                 |

Khi nhiều thông báo realtime dồn trong một cửa sổ ngắn (ví dụ 50 sự kiện), gom batch khoảng 400ms: hiển thị tối đa 3 toast cá nhân theo mức ưu tiên và một toast tổng hợp cho phần còn lại; không xếp hàng hàng chục toast. Tab đang ẩn chỉ cập nhật badge, không tạo toast chờ.

Chỉ báo thành công **sau** phản hồi thành công; mỗi sự kiện chỉ có một thông báo chính. Lỗi đã có cảnh báo tại chỗ không lặp bằng toast; không gọi toast cả ở service và nơi dùng service. Nội dung ngắn, nêu kết quả và bước tiếp theo nếu cần, không lộ mã lỗi kỹ thuật. Khi drawer/dialog đang mở, kiểm tra toast không che CTA, nút đóng hoặc field quan trọng; nếu va chạm, điều chỉnh vị trí/giới hạn hiển thị của overlay đó. Kiểm tra cả light/dark và mobile.

## 10. Cách thực hiện và kiểm tra màn hình mới

1. Xác định công việc chính, đối tượng, quyền, dữ liệu quyết định, trạng thái lỗi và bề rộng nội dung thực. Chọn mẫu trang, bảng, drawer hoặc dialog theo mục 3–9.
2. Dùng token và component hiện có. Nếu thiếu biến thể, mở rộng component chung có chủ đích; không tạo theme thứ hai, CSS toàn cục riêng cho module, hoặc thư viện icon/UI song song.
3. Kiểm tra từng bước nghiệp vụ, loading/empty/error/no-permission, keyboard, focus, đóng overlay, nội dung dài, tiếng Việt/Anh, light/dark.
4. Kiểm tra `1440 / 1024 / 768 / 390 / 320px`: mép lọc và bảng, bảng cuộn trong khung, drawer không tràn, footer không che input khi hiện bàn phím, toast không che CTA.
5. Chạy kiểm tra phù hợp với phạm vi: `npm run typecheck`, kiểm thử liên quan, `npm run lint`, `npm run ui:tokens`, `npm run ui:components`, `git diff --check`. Chỉ báo đạt những kiểm tra đã thực sự chạy; nếu gate chung lỗi vì file ngoài phạm vi, nêu rõ nguyên nhân.

**Nguồn triển khai hiện hành:** `src/shared/ui/tokens/operations.css`, `src/shared/ui/tokens/primitives.ts`, `src/shared/ui/theme/`, `src/shared/ui/components/UiDialog.tsx`, `src/shared/components/data-display/ResponsiveDataTable.tsx`, `src/modules/master-data/pages/sku-list.css`, `src/app/providers/AppProviders.tsx`, `src/index.css`. Các nguồn này giúp tìm đúng nơi sửa code; tài liệu này chốt quy tắc thiết kế. Khi code và quy tắc lệch nhau, sửa cùng một thay đổi và ghi rõ quyết định thay thế.

## 11. Người dùng, phân quyền và nhật ký hệ thống

Mẫu tham chiếu: `Hoa_Nam_UIUX_V2/nhatkyhethong_RBAC` (Desktop và Tablet, bộ 01–17). Áp dụng cấu trúc nội dung và thứ bậc của mẫu vào shell hiện có; không sao chép dữ liệu minh họa, thương hiệu hoặc gộp tuyến điều hướng. **Nhật ký hệ thống luôn là mục sidebar/trang riêng**, không thêm vào tab Người dùng & phân quyền.

- Người dùng: tiêu đề, mô tả ngắn và tạo tài khoản ở cùng vùng đầu; ba chế độ Người dùng / Vai trò & quyền / Quyền hiệu lực. Nhận diện tài khoản bằng avatar chữ viết tắt, tên và tài khoản; phòng ban có thể nằm dưới danh tính để giảm số cột. Nhóm trạng thái và số tài khoản lấy từ dữ liệu thật, không gán số mẫu. Bộ lọc gọn, thẳng mép với bảng, cỡ trang ở footer. Vùng nội dung hẹp chuyển thành thẻ có nhãn rõ thay vì ép bảng rộng phải kéo ngang.
- Tạo/sửa tài khoản dùng drawer bên phải 720px, chia Thông tin tài khoản / Vai trò & phạm vi / Xem lại & lưu. Giữ nội dung khi đổi bước; lỗi thuộc bước nào đưa về bước đó. Nút lưu nằm ngoài vùng cuộn. Cảnh báo ngừng hoạt động phải nêu tài khoản và hậu quả; có xác nhận trước khi áp dụng. Thoát khi còn thay đổi phải cho tiếp tục sửa hoặc bỏ thay đổi.
- Chi tiết tài khoản: phần nhận diện chung và Tổng quan / Quyền hiệu lực; nhóm thông tin tài khoản, vai trò/phạm vi/thời hạn. Quyền hiển thị tên dễ đọc, nguồn từ vai trò hoặc cấp riêng. Cấp riêng chỉ cộng thêm, không dùng để gỡ quyền thừa kế. Bản xem trước loại vai trò chưa tới hạn, hết hạn hoặc ngừng hoạt động; kiểm tra quyền theo phạm vi vẫn do máy chủ quyết định. Lỗi tải nguồn quyền không được hiển thị như không có quyền.
- Vai trò & quyền: theo yêu cầu ngày 04/11/2026, giao diện chính trở về mẫu trước `4c71d1d`: **thẻ vai trò, phân trang ở phía trên và các ô quyền chia nhóm**, giữ mã quyền nhìn thấy được. Không ép thành danh sách vai trò hẹp bên trái/ma trận bên phải. Giữ các chặn chỉ đọc, xung đột phiên bản, phạm vi ủy quyền và quyền không được phép thay đổi khi chọn/bỏ chọn cả nhóm. Thay đổi chưa lưu phải thấy số lượng, có hoàn tác và bước xem lại chênh lệch/lý do trước khi lưu. Form thông tin vai trò và xem lại thay đổi tiếp tục dùng drawer bên phải; lịch sử dùng drawer hiện hành, không thêm trường mà API chưa hỗ trợ.
- Nhật ký: chỉ đọc; thời gian, người thực hiện, hành động/đối tượng, phân hệ, kết quả và mũi tên chi tiết. Kết quả chưa biết giữ màu trung tính, không mặc định thành công. Drawer chia thông tin sự kiện, đối chiếu trước/sau và thông tin tra soát; giữ đầy đủ số 0, giá trị rỗng, các phần tử mảng và mã dài. Không giới thiệu bộ lọc hoặc xuất toàn bộ lịch sử khi dịch vụ hiện tại chỉ hỗ trợ tìm kiếm/điều kiện hoặc xuất các dòng được chọn.

Các bảng vẫn theo mục 5, đặc biệt tiêu đề 16px/24px, đậm 800, ô dữ liệu 14px/22px và cột mũi tên không có tiêu đề hiển thị. Nền surface thường cho nội dung, nền nhạt chỉ ở trạng thái chọn/nhóm, màu ngữ nghĩa dành cho kết quả hoặc cảnh báo có ý nghĩa.

## 12. Hồ sơ cá nhân, bảo mật và phiên đăng nhập

Tham chiếu `Hoa_Nam_UIUX_V2/phiendangnhap_nguoidung`, bộ U01–U32 Desktop/Tablet. Hồ sơ cá nhân là một mục riêng trong nhóm Hệ thống, dùng shell và token chung. Chia thành Hồ sơ / Bảo mật / Thiết bị & phiên / Thông báo / Giao diện / Tùy chọn khác. Tablet từ 900px trở xuống dùng ô chọn phần thay cho sáu tab bị cắt hoặc phải kéo ngang.

- Trang hồ sơ ưu tiên danh tính, trạng thái và thông tin liên hệ; phòng ban, tài khoản và quyền là thông tin chỉ đọc. Chỉnh sửa, ảnh đại diện, đổi mật khẩu, thiết bị/phiên và xác thực hai bước dùng drawer bên phải, một vùng cuộn nội dung và nút hành động cố định. Đổi email yêu cầu mật khẩu hiện tại. Ảnh có bước cắt/thu phóng và chỉ áp dụng sau khi lưu thành công.
- Thiết bị và phiên trình bày dạng thẻ có nhóm, không ép một bảng rộng vào drawer. Thông tin chưa biết phải ghi rõ, không suy ra thiết bị vật lý từ IP hoặc trình duyệt. Phiên hiện tại được nhận diện và bảo vệ. Số lượng và giới hạn phải lấy từ chính sách thật; không chép giới hạn 3 thiết bị/2 phiên từ dữ liệu minh họa.
- Tùy chọn giao diện có bản xem trước. Thay đổi chưa lưu không tác động đến phần còn lại của ứng dụng; Hủy giữ cấu hình đã lưu. Màu nhấn dùng cho nút chính, liên kết và phần đang chọn; màu trạng thái vẫn giữ đúng ngữ nghĩa. Cỡ chữ/mật độ không thu nhỏ vùng chạm. Tùy chọn ngày và múi giờ không làm lệch ngày chứng từ chỉ có ngày.
- Thông báo phân nhóm và kênh rõ ràng; cảnh báo bảo mật trong ứng dụng là bắt buộc. Thông báo realtime chỉ hiển thị trong ứng dụng dưới dạng toast ở góc trên bên phải theo mục 9; không dùng thông báo hệ điều hành/trình duyệt và không xin quyền thông báo trình duyệt.
- Biểu mẫu giữ bản nháp khi lỗi lưu hoặc xung đột phiên bản; có bước xác nhận khi bỏ thay đổi. Lệnh thu hồi phiên mất phản hồi phải đọc lại trạng thái trước khi gửi lệnh tiếp theo. Không tự coi lỗi tải là danh sách rỗng hay thu hồi thành công.
- Xác thực hai bước hiển thị QR tạo cục bộ; mã khôi phục chỉ nằm trong bộ nhớ của đúng tài khoản/phiên đăng nhập, không ghi vào localStorage, sessionStorage hoặc cache bền vững. Không cho đóng drawer khi đang xác nhận; mã trả về phải còn xem được nếu token làm mới khiến khung bảo vệ tải lại. Đóng sau khi xem mã cần xác nhận đã lưu mã. Đổi mật khẩu tuân theo hậu quả thật của API, kể cả yêu cầu đăng nhập lại.

Kiểm tra tối thiểu desktop, tablet, mobile 320px, sáng/tối, nội dung dài, bàn phím, lỗi tải/lưu, bỏ bản nháp, thay đổi tài khoản khi có yêu cầu đang chạy và phiên bản lưu đồng thời. Các mẫu lỗi và bảo mật này là một phần của thiết kế, không chỉ là bố cục lúc tải thành công.

## 13. Định dạng báo cáo Excel

Tất cả luồng tải báo cáo XLSX trong ứng dụng dùng bộ định dạng chung tại `src/shared/utils/report-excel-style.ts`, sau bước chọn phạm vi/nội dung và kiểm tra quyền hiện có. Nền tài liệu luôn sáng: tiêu đề và đầu bảng xanh đậm `004E74`, chữ trắng; dữ liệu chữ `12344B`, hàng xen kẽ `EAF5F8`, viền nhẹ `D9E8EF`. Calibri 11, tiêu đề 18 đậm, cột đủ rộng, nội dung dài xuống dòng; trạng thái dùng màu ngữ nghĩa. Cố định hàng tiêu đề/cột nhận diện, bật lọc và lặp đầu bảng khi in ngang A4.

Giữ nguyên mã, số 0 đầu, giá trị số, trạng thái nguồn, dữ liệu che và nội dung đã chọn. Ngày thuần giữ ngày chứng từ; timestamp có múi giờ hiển thị theo Việt Nam UTC+7 dưới dạng ngày giờ Excel. Không dịch chuyển ô trong workbook có công thức. Thư viện ghi file chỉ tải khi người dùng xuất báo cáo.
