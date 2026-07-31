# WWHN-29 Design Tokens

Trạng thái: đường cơ sở triển khai
Bằng chứng HEAD: chụp từ nhánh hiện tại trước khi cập nhật Jira
Nguồn tham chiếu: `src/app/theme.ts`, `src/shared/design-tokens.ts`

## Danh mục Token

| Nhóm token | Nguồn | Giá trị được đề cập | Cách dùng |
| --- | --- | --- | --- |
| Màu - thương hiệu | `BRAND` trong `src/app/theme.ts` | primary, hover, nền sider, trigger, nền header, làm mờ header | Chủ đề Ant Design và app shell |
| Màu - trung tính | `NEUTRAL_COLORS` trong `src/shared/design-tokens.ts` | canvas, paper, giấy thay thế, ink, văn bản mờ, placeholder, tiêu đề bảng | Bề mặt page/card/table dùng chung |
| Màu - viền | `BORDER_COLORS` | input, divider, divider mềm, đường hàng, connector | Điều khiển form, hàng, đường phân cấp |
| Màu - ngữ nghĩa/trạng thái | `SEMANTIC_COLORS` | thành công, cảnh báo, nguy hiểm, trung tính, quá hạn | Huy hiệu trạng thái, cảnh báo, xác thực và tín hiệu kiểm toán |
| Typography | `DESIGN_TOKENS.typography`, `FONT_FAMILY` | tiêu đề trang, tiêu đề phần, nội dung, chú thích, phông chữ ứng dụng | Tiêu đề, chế độ xem thao tác dày đặc, chú thích |
| Khoảng cách | `DESIGN_TOKENS.spacing` | xs 4, sm 8, md 12, lg 16, xl 24, xxl 32 | Khoảng cách app shell, khoảng cách form/table/card |
| Bo góc | `DESIGN_TOKENS.radius`, `RADIUS` | sm/card/điều khiển 4, md 8, lg 12, pill 10 | Điều khiển, thẻ, chip và popup |
| Đổ bóng | `CARD_SHADOW` | đổ bóng card khung | Các bề mặt khung kế thừa yêu cầu nâng cao thị giác |
| Điểm ngắt | Lưới responsive Ant Design cộng với CSS bố cục | desktop 1440, tablet 768, mobile 375 mục tiêu bằng chứng | Hành vi shell/sidebar/drawer |
| Z-index | Mặc định component Ant Design | modal, drawer, dropdown, phân lớp thông báo | Lớp phủ luôn ở trên shell và bảng |
| Chiều cao điều khiển | `themeConfig.components` | Button/Input/Select 40px, header Layout 64px | Mật độ form và thanh công cụ nhất quán |
| Kích thước bố cục | `themeConfig.components.Layout`, file bố cục ứng dụng | chiều cao header, nền sider, nền body | App shell responsive |

## Ghi chú Chấp nhận

- Token được tiêu thụ thông qua `themeConfig` của Ant Design và các hằng số cục bộ thay vì các giá trị magic trong page.
- Các component dùng chung mới phải sử dụng các token này hoặc giá trị chủ đề Ant Design trước tiên.
- Các giá trị kế thừa hard-code chỉ được phép khi được ghi nhận là nợ di chuyển trong danh mục component.