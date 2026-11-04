# Kiểm chứng lỗi nhập tệp SKU — 04/11/2026

## Phạm vi và nguyên nhân

Hộp **Nhập danh sách SKU từ Excel**, bước chọn/kiểm tra tệp và lỗi khi nhập. Không thay đổi backend hoặc dữ liệu thật.

- Lỗi tệp `SKU_IMPORT_FILE_INVALID` không có kết quả từng dòng nhưng trước đây bị ép đọc `import.row_errors`, làm mất lý do thiếu cột/tệp hỏng.
- Callback lỗi vừa đặt cảnh báo trong hộp vừa gọi toast, dẫn tới hai thông báo cùng nội dung.
- Hạn mức dung lượng cần lấy từ KB chính xác; cấu hình bất đồng bộ phải hoàn tất trước khi đọc/tính mã kiểm tra/gửi tệp.

## Kết quả thay đổi

- Chặn tệp vượt giới hạn ngay trên máy, dùng chung kiểm tra ở component và service. Thông báo **“File quá lớn. Tối đa X MB”** lấy X từ hạn mức đang áp dụng, kể cả giới hạn MB lẻ.
- Chờ hạn mức, kiểm tra lại tệp khi cấu hình về; lỗi tải hạn mức có cảnh báo và nút thử lại. Tệp quá lớn không được đọc hoặc gửi lên.
- Tách lỗi cấp tệp khỏi kết quả từng dòng; giải thích thiếu Mã SKU/Tên SKU, sai định dạng, tệp hỏng, cột lặp/không hỗ trợ và quá số dòng bằng ngôn ngữ đang chọn. Phản hồi thiếu dữ liệu có thông báo riêng, không lộ đường dẫn trường API.
- Lỗi kiểm tra/nhập hiển thị một cảnh báo tại chỗ; bỏ toast lỗi trùng. Giữ thông báo thành công và cơ chế chặn nhập trùng khi chưa xác định kết quả ghi.
- Sau timeout của bước kiểm tra, kết thúc trạng thái chờ và cho phép thử lại; không tự gửi lại lần ghi chưa xác định.
- Quy tắc dùng lại nằm trong tài liệu chuẩn duy nhất: [DESIGN_FOUNDATIONS.md](../ui/DESIGN_FOUNDATIONS.md), phiên bản 2.4, phần “Tệp nhập liệu và thông báo lỗi” và mục 9.

## Bằng chứng kiểm thử

- Vitest: **64/64 đạt** ở `SkuImportModal.test.tsx`, `sku-import.service.test.ts`, `sku-import-upload.test.ts`, chạy một worker. Bao gồm hạn mức trả chậm, lỗi tải cấu hình, giới hạn KB khác MB làm tròn, lỗi kết quả thiếu trường, timeout/cạnh tranh và bảo vệ kết quả ghi chưa xác định. Node 26 cần `NODE_OPTIONS=--no-experimental-webstorage` cho môi trường jsdom hiện có.
- Sau khi đồng bộ `origin/dev` tại `b7e7673c`, chạy lại ba file trên cùng `nav-data.test.ts`: **69/69 đạt**. `npm run build` đạt (TypeScript, Vite và build manifest); chỉ có cảnh báo kích thước bundle hiện hành. Đã sửa tùy chọn truy vấn không hợp lệ trong mã test mà TypeScript phát hiện.
- Playwright Chromium: **6/6 đạt**, đã chạy lại sau khi đồng bộ `origin/dev`, qua `npm run test:sku-import-errors`. Dùng modal/service/digest và QueryClient production cùng Sonner Toaster thật; chỉ thay HTTP transport bằng phản hồi kiểm soát. Mỗi tình huống kiểm tra đúng một `alert`, không có toast lỗi, số yêu cầu gửi đúng và trạng thái nút phục hồi phù hợp.
- Sáu tình huống trình duyệt: tệp quá lớn, đuôi tệp không hỗ trợ, thiếu Mã SKU, tệp Excel hỏng, phản hồi 413 và timeout. Hai lỗi cục bộ gửi **0** yêu cầu tải lên. Timeout cho thử lại thủ công và vẫn chỉ một cảnh báo.
- Đã xem ảnh chụp lỗi quá dung lượng và thiếu Mã SKU ở kích thước 1440 × 900; nội dung rõ, cảnh báo không che nút hành động. Ảnh được sinh lại dưới `test-results/sku-import-errors/` (artifact cục bộ, không commit).
- Rà soát mã độc lập không còn phát hiện cần xử lý sau khi sửa trường hợp metadata không công bố giới hạn dòng vật lý, tránh báo sai “tối đa 0 dòng”.
- ESLint trên toàn bộ file nguồn/test đã sửa: đạt. `git diff --check`: đạt.

## Bổ sung icon Hồ sơ cá nhân

Theo ảnh bổ sung của người dùng, mục Hệ thống → Hồ sơ cá nhân bị trống vì `NavItemData.icon` là `user-circle` (tên SVG sidebar) nhưng `renderSystemItem` render bằng `UiIcon` (font Flaticon). Đổi thành slug **`user`** có thật trong CSS/font đang nạp; kiểm tra tên cũ không tồn tại, tên mới tồn tại và các icon hệ thống còn lại vẫn hợp lệ. Không đổi component hoặc bộ icon. Quy tắc phân biệt hai renderer được bổ sung vào tài liệu chuẩn UI. Kiểm tra này đối chiếu dữ liệu/asset, không phải xác nhận màn hình production sau triển khai.

Guard toàn dự án `node scripts/check-ui-icons.mjs` còn báo 5 lỗi emoji tại `HoaNamAuthShell.tsx` (2), `ForgotPasswordPage.tsx` (2), `IamRoleMatrix.tsx` (1). Cả ba file không có khác biệt so với `origin/dev` tại `b7e7673c`; không nằm trong bản sửa này. Không coi guard toàn dự án đã đạt.

## Giới hạn kiểm chứng

Không upload tệp vào hệ thống production, không xác nhận triển khai máy chủ. Các phản hồi lỗi trình duyệt được mô phỏng ở transport; không kiểm chứng proxy production hoặc thời gian timeout thực tế của mạng. Không khẳng định toàn bộ module nhập tệp khác đã áp dụng chuẩn. Chi tiết lỗi dữ liệu từng dòng từ backend giữ nguyên hợp đồng hiện hành; thay đổi này tập trung vào lý do từ chối tệp và thông báo chính. Không chạy lại toàn bộ test suite: các lỗi ngoài phạm vi đã được ghi riêng trong [báo cáo UI trước đó](./ui-contrast-2026-11-04.md).
