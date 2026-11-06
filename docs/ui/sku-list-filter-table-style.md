# Quy cách bộ lọc và bảng danh sách theo MST-01 (SKU)

Nguồn chuẩn: `src/modules/master-data/pages/sku-list.css` và `ApiMasterScreens.tsx` trên trang Danh sách SKU. Áp dụng cho vùng bộ lọc và bảng của `CatalogMasterScreen` (cả 5 tab); giữ nguyên tên cột, nội dung, API và quyền thao tác riêng của Danh mục sản phẩm.

## Bộ lọc

- Một hàng điều khiển nằm trực tiếp trên bảng, khoảng cách giữa các ô `12px`; không có thẻ bao có viền, tiêu đề bộ lọc hoặc dải chip nhắc lại điều kiện đã chọn.
- Ô tìm kiếm rộng hơn ô chọn, tự lọc khi nhập. Ô chọn hiển thị tên trường và giá trị ngay trong ô, ví dụ `Trạng thái: Tất cả`; không đặt nhãn ở hàng phía trên.
- **Không lặp lựa chọn trong menu:** khi đóng, ô lọc vẫn hiển thị `Tên bộ lọc: Tất cả`. Khi mở, chỉ có **một** mục tương ứng; không thêm dòng placeholder trùng với lựa chọn đã có trong `options` (kể cả khi giá trị là `""` hoặc sentinel như `ALL`). Placeholder dùng để hiển thị khi chưa chọn, không phải lý do để sinh thêm một lựa chọn trùng.
- Khi sửa bộ lọc dùng chung, kiểm tra dropdown thường và dropdown có tìm kiếm, giao diện sáng/tối; chọn một giá trị rồi chọn lại `Tất cả` phải trả đúng giá trị bỏ lọc của màn hình. Không để mất khả năng bỏ lọc hoặc tạo hai mục cùng giá trị rỗng.
- Điều khiển cao `48px`, nền `--ops-surface`, viền `--ops-line`, bo `--ops-radius-control` (`6px`); focus dùng `--ops-link` với quầng màu link 13%. Mọi thay đổi bộ lọc được áp dụng tự động; không cần nút `Áp dụng`. Nút `Xóa lọc` chỉ xuất hiện khi có điều kiện lọc.
- Khi container hẹp, các ô xuống hàng; ô tìm kiếm chiếm trọn hàng đầu. Không làm trang tràn ngang vì bộ lọc.
- Riêng Danh sách SKU: khi ghim mở sidebar trên desktop, chuyển ô `Thông tin` vào vùng mở bằng nút `Bộ lọc`; hàng chính giữ tìm kiếm, loại hàng, trạng thái và các nút lọc. Khi thu sidebar hoặc dùng menu dạng lớp phủ trên mobile, giữ `Thông tin` ở hàng chính. Chuyển trạng thái sidebar phải giữ nguyên giá trị lọc, chỉ render một ô `Thông tin`.

## Bảng

**Chốt màu chữ đầu bảng sáng:** `--ops-heading` (**#003B63**) trên nền `--ops-table-header` (**#D2EDF7**), đậm **800**, 16/24px; tương phản tối thiểu **7:1**. STT và mọi nhãn cột, kể cả chữ bên trong nút sắp xếp, dùng cùng màu đậm. Không dùng màu xám/muted hoặc giảm opacity; hover/focus/sort không làm nhãn nhạt đi. Chỉ icon sắp xếp được đổi màu để báo trạng thái. Khai màu qua token để giữ đúng dark mode.

| Thành phần         | Quy cách từ SKU                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Thẻ bảng           | Viền `--ops-line`, bo `--ops-radius-card` (`8px`), nền `--ops-surface`; không có đệm trong bao quanh đầu bảng.                                                                                         |
| Đầu bảng           | Nền `--ops-table-header` (`#d2edf7` ở light, nền tối semantic ở dark); chữ `--ops-heading`, cỡ `16px`, đậm `800`, cao dòng `24px`, viết hoa, giãn chữ `0.02em`. Không hard-code màu light trong trang. |
| Ô đầu và ô dữ liệu | Đệm dọc `12px`, ngang `18px`; hàng dữ liệu tối thiểu khoảng `68px` khi có biểu tượng `44px`; căn giữa theo chiều dọc; đường chia hàng `1px solid --ops-line`.                                          |
| Chữ dữ liệu        | `--ops-text`, cỡ `14px`, cao dòng `22px`, đậm `400`; mã chính `--ops-heading`, **Inter 15/22px, đậm 600** theo mã SKU render thực tế.                                                                  |
| Biểu tượng mã      | Nền `--ops-pale`, màu `--ops-link`, khung khoảng `44px`, cách mã `12px`.                                                                                                                               |
| Trạng thái         | Viên cao `24px`, bo `20px`, chữ `11px`, chấm `7px`; đang dùng: `--ops-success` trên `--ops-success-soft`; ngừng dùng: `--ops-muted` trên `--ops-pale`.                                                 |
| Rê chuột           | Nền hàng pha `55% --ops-pale` với `--ops-surface`; giữ focus bàn phím dễ thấy.                                                                                                                         |
| Trang hẹp          | Bảng có chiều rộng tối thiểu và được cuộn ngang hoặc chuyển thành card theo component hiện có; không ép chữ thành cột dọc.                                                                             |

**Mã chính — đối chiếu runtime ngày 04/11/2026:** `SKU-DEMO-003` ở Danh sách SKU có computed style **Inter, 15px, cao dòng 22px, đậm 600**. Cỡ 15px đến từ `.hn-sku-cell-text > :first-child`; `SkuLink` bên trong đặt đậm 600, dù phần tử bao có đậm 700. Đây là mẫu áp dụng cho mã SKU/mã phiếu ở các bảng được chỉnh sửa, gồm `WC-*` tại WAR-01, trên desktop và card mobile. Thay quy tắc mã chính 14/22px đậm 700 trước đây bằng số đo của chữ SKU thực tế; không đổi chữ dữ liệu thường 14/22px đậm 400. Tránh `<strong>`/`<b>` lồng trong nút mã có `font-weight` vì `bolder` có thể tạo chữ đậm 900; chữ mã phải kế thừa đúng một mức đậm. Mã có tương tác không gạch chân khi hover hoặc focus, không thay cỡ/độ đậm; giữ viền focus bàn phím rõ và hành vi mở chi tiết. Mã tương tác khi hover dùng `--ops-link` theo theme, đạt tương phản chữ tối thiểu 4.5:1 trên nền hàng. Kiểm tra computed style của chính chữ mã cùng hover/focus ở hai theme; chỉ xem selector hoặc phần tử bao chưa đủ.

Các cột của mỗi bảng phải có kế hoạch chiều rộng đầy đủ, tổng tỷ lệ bằng `100%`. Cột không khai độ rộng sẽ nhận phần dư và tạo khoảng trắng lớn giữa các cột, như trường hợp `Tên hãng` trên tab Hãng.

### Cột có sắp xếp và bảng dùng component chung

- Với `ResponsiveDataTable`, truyền quy cách đầu bảng qua `headerCellStyle` để cả ô thường và `SortableTh` nhận cùng font, màu và nền. Dùng `backgroundColor: "var(--ops-table-header)"` và `backgroundImage: "none"`; lớp gradient mặc định có thể làm riêng cột sắp xếp bị đậm hơn. Không dùng màu light cố định vì sẽ sai tương phản ở dark mode.
- Nút sắp xếp bên trong `th` phải kế thừa `color`, `font`, `text-transform` và `letter-spacing`. CSS `thead th` đơn thuần không ghi đè được style trực tiếp của ô sắp xếp.
- Đối chiếu ô thường, ô sắp xếp và đầu bảng khi cuộn: nền phải liên tục, nhãn cùng màu và độ đậm ở cả hai theme.

Chỉ áp dụng màu và khoảng cách trên cho phần danh sách. Mỗi tab Danh mục sản phẩm vẫn giữ cột Hãng khi cần, mô tả, sắp xếp và nút Sửa hiện có.

## Phân trang

- Chân bảng có viền trên `1px solid --ops-line` và đệm `14px 16px`.
- Thông tin `Hiển thị ...` và ô chọn số dòng/trang nằm trong cùng một nhóm bên trái, cách nhau `14px`; các nút chuyển trang nằm bên phải.
- Nhóm bên trái được phép xuống dòng khi hẹp; điều hướng vẫn tự dồn về phải.

## Nút mở chi tiết — chuẩn chung ngày 04/11/2026

Tuân thủ quy tắc độ tương phản/đường chia trong [chuẩn giao diện thống nhất](./DESIGN_FOUNDATIONS.md). Màu chữ và nền phải đổi cùng theme, kể cả hover/focus; không dùng màu light cố định cho đầu bảng hoặc nền mũi tên. Chạy `npm run test:ui-contrast` để kiểm tra hồi quy SKU trên hai theme.

- Cột cuối dành cho mở bản ghi không hiện tiêu đề “Thao tác”/“Chi tiết”; giữ ô `th` với `aria-label` để truy cập được.
- Nút mở chi tiết chỉ hiện mũi tên phải `→` như Danh sách SKU, không hiện chữ Xem/Mở hoặc icon mắt. Dùng `RowActionButton kind="view"`/`kind="detail"`, có nhãn truy cập và tooltip mô tả bản ghi.
- Nền trong suốt, màu `--ops-link`, hover nền `--ops-pale`; khung nút `40px`, vùng chạm `44px`, focus rõ. Cột chỉ một mũi tên nên gọn khoảng `64–96px`; giữ kế hoạch tổng độ rộng cột `100%`.
- Áp dụng tương tự cho card mobile và bảng trong drawer. Hành động sửa/xóa/in giữ biểu tượng nghiệp vụ riêng; cột dữ liệu nhật ký “Hành động” vẫn có tiêu đề.
