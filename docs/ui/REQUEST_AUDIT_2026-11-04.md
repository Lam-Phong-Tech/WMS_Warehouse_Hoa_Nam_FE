# Rà soát các yêu cầu giao diện — 04/11/2026

Đối chiếu bản `dev` trước rà soát: `5e96be0`. Đây là biên bản kiểm chứng, không phải một tài liệu thiết kế song song với `DESIGN_FOUNDATIONS.md`.

## Các điểm đã báo hoàn tất nhưng còn thiếu

| Yêu cầu                                                              | Thực tế trước rà soát                                                                 | Sửa trong đợt rà soát này                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Nút đóng/mở tình trạng xuất kho bên trái nút tiếp nhận, icon như SKU | Vẫn ở bên phải, icon chevron; kiểm thử chỉ khóa chức năng đóng/mở                     | Đổi thứ tự DOM, dùng cùng `BarChartOutlined` với SKU, cùng khung 40px; giữ `aria-expanded`/`aria-controls`.                          |
| Bộ lọc xuất kho cùng lề bảng                                         | Form có padding ngang 16px, mobile 12px                                               | Bỏ padding ngang ở cả desktop/mobile; giữ khoảng cách dọc.                                                                           |
| Nhập Excel bằng tiếng Việt, nhãn nghiệp vụ và bố cục hợp lý          | `dev` còn file input mặc định và hướng dẫn tên cột kỹ thuật; bản sửa chỉ nằm ở local  | Tích hợp custom picker, tên tệp, hướng dẫn nhãn nghiệp vụ, hai vùng nội dung; tên cột tích hợp đặt trong phần mở rộng mặc định đóng. |
| Xóa dòng SKU cùng hàng hai input                                     | Nút dùng `margin-top: 8px`, không theo hàng input                                     | Grid đặt nút đúng hàng control; mobile đặt số lượng/xóa cùng hàng dưới SKU.                                                          |
| Toast theo HTML cung cấp                                             | Mobile có thể rộng hơn 390px; breakpoint lệch 640px; reduced motion làm mất countdown | Giữ max 390px, breakpoint 640px và top 74px; không trượt khi reduced motion, giữ thanh countdown 3 giây.                             |
| Phân trang tồn kho theo `.md`                                        | Chỉ hiện tổng số bản ghi                                                              | Hiển thị khoảng dòng thực tế `from–to / total`, dịch VI/EN/ZH.                                                                       |

Kiểm tra trực quan còn phát hiện CSS chung làm chữ nút **Tiếp nhận yêu cầu xuất** có thể xanh trên nền xanh. Đã tăng độ ưu tiên selector của CTA, giữ chữ trắng và bổ sung kiểm tra màu chữ.

## Những phần đã hiện diện trên `dev` trước rà soát

| Yêu cầu                                                  | Bằng chứng trong mã và phạm vi                                                                                                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chi tiết phiếu xuất mở bên phải, nội dung chia bước      | `AlignedOutboundDetailModal`: drawer 820px, 5 tab; tóm tắt chính và thông tin bổ sung thu gọn.                                                                                                        |
| Danh sách/sản phẩm NFC và chi tiết bên phải              | Chi tiết độc lập drawer 640px; khi xem từ phiếu dùng nội dung trong cùng panel, có quay lại, tránh chồng drawer.                                                                                      |
| Sửa lỗi tải lịch sử NFC                                  | Backend commit `476cf784` ép UUID sang VARCHAR khi nối với `audit_log.object_id` dạng TEXT. Có 2 kiểm thử SQLite / 32 assertions. Chưa kiểm tra trực tiếp request được xác thực trên PostgreSQL thật. |
| WAR-04 gom menu vào một chi tiết                         | Nút chi tiết mở `ComponentIssueModal` dạng drawer 820px; có kho, ghi chú, lý do hủy nếu có, nút xem hồ sơ bảo hành.                                                                                   |
| Tiếp nhận bảo hành chọn kho không cần xác nhận           | Không còn `confirmedWarehouseId` hoặc nút xác nhận; payload dùng kho đã chọn, đổi kho xóa kết quả quét cũ.                                                                                            |
| Ghi chú ghi sổ thu về icon `i`                           | `ComponentIssueOverview`: button trợ giúp có tooltip khi hover/focus; không còn banner ghi chú ngoài tổng quan.                                                                                       |
| Tồn kho: chuyển sổ cái/chênh lệch vào chi tiết           | Không có hai cột trong danh sách; `BalanceDetailModal` giữ hai giá trị.                                                                                                                               |
| Tồn kho: bỏ copy SKU ngoài bảng                          | Không còn nút copy ở danh sách; copy trong chi tiết được giữ theo yêu cầu.                                                                                                                            |
| Tồn kho: bỏ tiêu đề/tổng dòng lặp phía trên bảng         | Đã bỏ; số lượng còn ở vùng phân trang.                                                                                                                                                                |
| Tồn kho: bỏ nút Làm mới ở đầu trang                      | Đã bỏ; các cơ chế tải dữ liệu hiện hành vẫn có.                                                                                                                                                       |
| Hai tab tồn kho theo quy cách bảng SKU                   | Có bộ lọc 48px, gap 12px, cùng lề bảng, header 16px/800, body 14px/22px và padding 12px/18px.                                                                                                         |
| Trạng thái Đã hủy màu đỏ                                 | Có mapping `CANCELLED → error`, `POSTED → success`, `SCANNING → info`, `DRAFT → neutral`; kiểm thử cả 4 trạng thái.                                                                                   |
| Nút chi tiết dạng mũi tên, cột không có tiêu đề hiển thị | `RowActionButton view/detail` hiển thị mũi tên; bảng chung mặc định ẩn header điều khiển, cột tự khai dùng `isAction`; bảng riêng đã được rà. Các thao tác truy vết/sửa/xóa/in giữ ý nghĩa riêng.     |
| Hợp nhất tài liệu thiết kế                               | `DESIGN_FOUNDATIONS.md` là chuẩn chính; hai tài liệu layout/governance cũ là chuyển tiếp; giữ ngoại lệ không dùng phần Data table/filters/pagination của UI Kit.                                      |

## Xung đột tài liệu và phạm vi chưa được chứng minh

- Bản `.md` người dùng chỉ định trong repo local cho phép **Xóa lọc khi có điều kiện**; bản trước rà soát trên `dev` ghi không có nút này. Đã đồng bộ hướng dẫn theo bản người dùng chỉ định và giữ hành vi xóa lọc hiện hành. Đây là xung đột phiên bản tài liệu, không phải một yêu cầu gốc bị bỏ sót.
- README đã được sửa để chỉ dẫn một chuẩn chính. `AGENTS.md` mới dẫn tác vụ UI về chuẩn đó. Đây là hướng dẫn tái sử dụng trong dự án, không phải bằng chứng một custom skill đã được cài vào môi trường người dùng.
- Hợp nhất tài liệu không tự di chuyển mọi giao diện cũ. Bảng chung vẫn có một số mặc định typography cũ; các module có thể dùng override riêng. Không khẳng định toàn bộ bảng trong dự án đã được kiểm tra giống nhau về mọi số đo.
- Các drawer đã xác minh nằm trong phạm vi phiếu xuất, NFC và xuất linh kiện bảo hành. Một số modal cũ, gồm chi tiết tồn kho, vẫn dùng `UiDialog`. Yêu cầu tồn kho ở phiên này chỉ chuyển thông tin vào chi tiết; chưa thực hiện một đợt chuyển mọi modal của ứng dụng sang drawer.
- Kiểm tra trình duyệt dùng component thật và GET fixtures xác định, không thay thế kiểm thử tài khoản/dữ liệu thật trên website. Các giới hạn API/PostgreSQL phải được nêu riêng.
- Manifest không có tham số chống cache từng trả `b54c8c7`; đọc lại bằng URL mới và `Cache-Control: no-cache` xác nhận website đã chạy `5e96be0`. Không kết luận chưa deploy chỉ từ phản hồi cache cũ.

## Vì sao bị bỏ sót

Một số bản sửa Excel, căn dòng và nút tổng quan có trong working tree local nhưng không được đưa đầy đủ vào worktree tích hợp dùng để push. Kiểm thử ban đầu của nút tổng quan chỉ kiểm tra đóng/mở và chung container, không kiểm tra thứ tự, icon hoặc tọa độ. Việc hoàn tất tài liệu và kiểm tra một component dùng chung cũng đã bị mô tả quá rộng thành hoàn tất giao diện.

Đợt rà soát bổ sung kiểm tra cụ thể cho vị trí/icon, căn lề, trạng thái tệp Excel, căn hàng SKU, khoảng dòng phân trang và toast ở màn hẹp/reduced motion. Khi báo hoàn thành phải phân biệt mã đã push, component đã kiểm tra và kết quả trên môi trường triển khai.

## Bằng chứng kiểm tra trong đợt rà soát

- Kiểm thử nút tổng quan được chạy RED trước sửa: thất bại vì nút vẫn là phần tử cuối và không có icon thống kê. Sau sửa, ca đóng/mở + thứ tự/icon đạt.
- Intake: 6 kiểm thử đạt; trình duyệt 1440px đo SKU/số lượng/xóa cùng tọa độ top và cao 40px. Ở 390px, số lượng/xóa cùng hàng, SKU ở hàng trên; không có page error hoặc tràn ngang.
- Bảo hành/tồn kho: 8 ca kiểm tra hành vi đã yêu cầu đạt. Ca phân trang mới đạt sau khi giữ nguyên logic xóa lọc gốc.
- Trình duyệt: 5 ca riêng biệt đạt. Hai ca 1440/390 kiểm tra nút biểu đồ bên trái, CTA chữ trắng, hai nút cao 40px, đóng/mở, lề bộ lọc, bốn control cao 48px và không tràn. Hai ca 500/620 kiểm tra toast rộng tối đa 390px, top 74px, mô tả 12px. Ca reduced motion kiểm tra không trượt nhưng countdown vẫn chạy 3 giây.
- TypeScript, build production, ESLint các file thay đổi và `git diff --check` đạt. Các kiểm tra này không biến giới hạn PostgreSQL/tài khoản thật ở trên thành đã kiểm chứng.

Ảnh/số đo cục bộ nằm trong `test-results/outbound-audit/` và `test-results/intake-audit/` (không commit dữ liệu kiểm tra vào source sản phẩm).
