# Quy cách bộ lọc và bảng danh sách theo MST-01 (SKU)

Nguồn chuẩn: `src/modules/master-data/pages/sku-list.css` và `ApiMasterScreens.tsx` trên trang Danh sách SKU. Áp dụng cho vùng bộ lọc và bảng của `CatalogMasterScreen` (cả 5 tab); giữ nguyên tên cột, nội dung, API và quyền thao tác riêng của Danh mục sản phẩm.

## Bộ lọc

- Một hàng điều khiển nằm trực tiếp trên bảng, khoảng cách giữa các ô `12px`; không có thẻ bao có viền, tiêu đề bộ lọc hoặc dải chip nhắc lại điều kiện đã chọn.
- Ô tìm kiếm rộng hơn ô chọn, tự lọc khi nhập. Ô chọn hiển thị tên trường và giá trị ngay trong ô, ví dụ `Trạng thái: Tất cả`; không đặt nhãn ở hàng phía trên.
- Điều khiển cao `48px`, nền `--ops-surface`, viền `--ops-line`, bo `--ops-radius-control` (`6px`); focus dùng `--ops-link` với quầng màu link 13%. Mọi thay đổi bộ lọc được áp dụng tự động; không cần nút `Áp dụng`. Nút `Xóa lọc` chỉ xuất hiện khi có điều kiện lọc.
- Khi container hẹp, các ô xuống hàng; ô tìm kiếm chiếm trọn hàng đầu. Không làm trang tràn ngang vì bộ lọc.

## Bảng

| Thành phần         | Quy cách từ SKU                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thẻ bảng           | Viền `--ops-line`, bo `--ops-radius-card` (`8px`), nền `--ops-surface`; không có đệm trong bao quanh đầu bảng.                                                |
| Đầu bảng           | Nền `--ops-table-header` (`#d2edf7` ở light, nền tối semantic ở dark); chữ `--ops-heading`, cỡ `16px`, đậm `800`, cao dòng `24px`, viết hoa, giãn chữ `0.02em`. Không hard-code màu light trong trang. |
| Ô đầu và ô dữ liệu | Đệm dọc `12px`, ngang `18px`; hàng dữ liệu tối thiểu khoảng `68px` khi có biểu tượng `44px`; căn giữa theo chiều dọc; đường chia hàng `1px solid --ops-line`. |
| Chữ dữ liệu        | `--ops-text`, cỡ `14px`, cao dòng `22px`; mã chính `--ops-heading`, đậm `700`.                                                                                |
| Biểu tượng mã      | Nền `--ops-pale`, màu `--ops-link`, khung khoảng `44px`, cách mã `12px`.                                                                                      |
| Trạng thái         | Viên cao `24px`, bo `20px`, chữ `11px`, chấm `7px`; đang dùng: `--ops-success` trên `--ops-success-soft`; ngừng dùng: `--ops-muted` trên `--ops-pale`.        |
| Rê chuột           | Nền hàng pha `55% --ops-pale` với `--ops-surface`; giữ focus bàn phím dễ thấy.                                                                                |
| Trang hẹp          | Bảng có chiều rộng tối thiểu và được cuộn ngang hoặc chuyển thành card theo component hiện có; không ép chữ thành cột dọc.                                    |

Các cột của mỗi bảng phải có kế hoạch chiều rộng đầy đủ, tổng tỷ lệ bằng `100%`. Cột không khai độ rộng sẽ nhận phần dư và tạo khoảng trắng lớn giữa các cột, như trường hợp `Tên hãng` trên tab Hãng.

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
