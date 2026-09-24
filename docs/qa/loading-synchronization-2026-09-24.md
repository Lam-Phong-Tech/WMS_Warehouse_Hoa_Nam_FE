# Đồng bộ loading trang và modal — 24/09/2026

## Phạm vi

Repository `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`, nhánh `dev`.
Mốc bắt đầu: `2824b19edd73f0ae1a4d43af266c3217746ad813`.
Yêu cầu lần này là tất cả trang, bao gồm báo cáo. Không thay endpoint, mapping dữ liệu, quyền, trạng thái nghiệp vụ hoặc tạo dữ liệu kho.

## Thay đổi

- `withPageLoader` bao toàn bộ route nội dung bằng `CoordinatedLoadingBoundary`, bên ngoài Suspense. MainLayout giữ nguyên shell: chỉ chờ chunk của shell, không ẩn sidebar/header theo dữ liệu trang. MFA và các trang công khai/trạng thái cũng dùng loader chung.
- Tải ban đầu: nội dung vẫn mount và có kích thước để mọi query/effect/biểu đồ khởi tạo bình thường, nhưng ẩn khỏi hình ảnh và cây trợ năng, tạm inert. Khi các lần đọc đang hoạt động đã kết thúc, nội dung mới xuất hiện đồng thời. Không unmount cây để chờ chính query trong cây đó.
- Controller theo dõi active query qua QueryCache. Các nguồn được gọi song song như trước; không đổi cơ chế request. Query không có observer, bị disabled hoặc được đánh dấu `meta.loading = 'background'` không giữ barrier. Query lỗi đã kết thúc không bị chờ vô hạn: trạng thái lỗi hiện có của trang được giữ.
- Mỗi đợt chờ kết thúc qua hai cơ hội render để thông báo Query và các query phụ thuộc kịp đăng ký; không đặt minimum-duration timeout, phần trăm giả hoặc delay giả.
- Dữ liệu đã có trong cache không bị che lại bởi polling/refetch nền sau lần hiển thị đầu. Query bộ lọc mới chưa có dữ liệu tạo một đợt chờ chung.
- Nút chuẩn có `data-action-kind=refresh/search/filter/reset` hoặc `data-loading-batch` đăng ký đợt đọc chủ động trước handler. Hook `useBeginLoadingBatch` được cung cấp cho control tùy biến. Không tự gửi lại thao tác ghi.
- `UiDialog` và `UiDrawer` có barrier riêng ở thân. Tiêu đề, footer, hành động đóng và focus trap hiện có giữ nguyên; footer không bị chuyển thành một lớp disabled mới. Overlay lồng nhau được ưu tiên theo độ sâu, không theo thứ tự chạy effect. Trang đã hiển thị không bị che vì modal mở phía trên đang đọc dữ liệu.
- `PageSkeleton`, `LoadingState`, `Loading`, `UiStateSurface(kind=loading)` dùng cùng `UnifiedLoading` và đăng ký tác vụ chuẩn bị với barrier gần nhất. Spinner 28 px từ UiSpinner, màu ocean blue `var(--ops-primary, #004e74)`, nhãn i18n có sẵn, aria-live polite. Không dùng màu tím cho loading mới.
- Offline thiếu dữ liệu: hiển thị trạng thái ngoại tuyến, không giả thành rỗng hoặc spinner vĩnh viễn. Snapshot cache đầy đủ vẫn dùng được khi query bị pause. Retry chỉ thực hiện read.
- Khi trang keep-alive bị ẩn, subscription/callback của barrier được dọn. Nội dung hiện có và vị trí cuộn không bị thay bằng bản sao dữ liệu.

## Kiểm tra thực sự đã chạy trước khi publish

Hai module thuần `loading-controller.ts` và `loading-stack.ts` đã được strict-compile bằng TypeScript và chạy 19 test bằng Node test runner: **19 đạt, 0 lỗi**. Các test tương đương được đưa vào bộ Vitest của repo.

Bao gồm: API nhanh/chậm; query phụ thuộc; disabled/prefetch; cached background refresh; làm mới nhiều nguồn; click bị validation không có request; đổi bộ lọc; lỗi API; pause offline/resume; snapshot cache offline; Suspense participant; modal che trang; nesting depth và modal cùng cấp; hủy khi trang ẩn; snapshot identity ổn định; query tạm vắng không làm hiển thị sớm.

Đã bổ sung 7 test React/TanStack cho nhiều nguồn, query phụ thuộc, lỗi, disabled query, cache, lazy chunk → API và trang ẩn. Chưa có kết quả thực thi của 7 test này tại thời điểm lập tài liệu. Môi trường cục bộ không có các dependency React của repo; 19 test thuần KHÔNG thay cho full application typecheck, Vitest integration, lint hoặc production build.

Workflow `loading-sync-verification.yml` chỉ đọc mã đã commit, cài theo lockfile và chạy test loading, typecheck, build; không sửa source, không ghi dữ liệu kho, không bỏ qua mã lỗi của test/build.

## Giới hạn kiểm chứng

Chưa kiểm thử đăng nhập/API thật trên mọi trang và thiết bị. Không ghi nhận deployment hoặc tuyên bố tất cả luồng đã PASS.

Barrier dùng các query đang active trong QueryClient dùng chung, không gán quyền sở hữu riêng tới từng hook. Query shell đang tải lần đầu có thể được đợi cùng trang. Những control tự viết không dùng metadata/hook batch vẫn cần kiểm thử warm-cache refresh riêng. Raw HTTP/effect không qua Query cần đăng ký `useLoadingParticipant` hoặc dùng loading component chung. Overlay không dùng UiDialog/UiDrawer chưa có cam kết được tách nhóm riêng. Việc giải mã ảnh/video/font không được coi là một query dữ liệu.

Các hạn chế trên không được che bằng delay giả hay bằng việc sửa dữ liệu API. Đây là thay đổi đồng bộ lớp hiển thị tải ban đầu dùng chung; không phải chứng nhận mọi modal legacy hoặc mọi đợt background refresh của toàn ứng dụng đã được chạy nghiệm thu.
