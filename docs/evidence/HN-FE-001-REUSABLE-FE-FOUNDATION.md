# HN-FE-001 - Bằng chứng Nền tảng FE Tái sử dụng

## Truy xuất nguồn gốc

| Trường | Giá trị |
| --- | --- |
| Nhiệm vụ Cha | WWHN-38 - [FE] Khung ứng dụng, đăng nhập, điều hướng và trạng thái UI dùng chung |
| Khóa tạm Cha | HN-FE-001 |
| Mục Hợp đồng | PL01-02 |
| Khóa tạm Epic | HN-EPIC-02 |
| BA Pin | HN-PIN-02 |
| Vai trò | FE1 |
| Người được gán | HN-FE-01 |
| Phụ thuộc | HN-UX-001; HN-FND-001 |
| Nguồn | 08_DATA_API_UI_TECHNICAL_HANDOFF; HoaNam_Handoff_v3_9 |
| Ảnh hưởng Tồn kho | Không |
| Đầu ra | Shell Next.js tương đương trên đường cơ sở React/Vite đã được phê duyệt; thư viện component tái sử dụng; danh mục component; bằng chứng DEV |

## Phạm vi Đã xác minh

- App shell React/Vite/TypeScript vẫn phù hợp với hướng dẫn kỹ thuật.
- Các provider runtime được tập trung trong `src/app/providers/AppProviders.tsx`.
- Khởi tạo phiên chạy trước các quyết định route thông qua `bootstrapAuth()` và `ProtectedRoute`.
- RBAC cấp route được xử lý bởi `RequirePermission`; trạng thái không có quyền được chuyển hướng đến trang/trạng thái không có quyền dùng chung.
- Các cuộc gọi API sử dụng wrapper `http` dùng chung và interceptor `axios` để bóc envelope, xử lý refresh, lỗi xác thực trường, lỗi quyền và ID yêu cầu.
- Các component dùng chung được xuất qua `src/shared/components/index.ts`, bao gồm layout, forms, data display, feedback, điều khiển quyền, điều hướng, thẻ và trạng thái UI cấp trang.
- Danh mục component có sẵn tại `/component-catalog` cho người dùng BA/QA đã xác thực và trình diễn các trạng thái bảng dùng chung, form, modal, trạng thái, scan, toast, loading, empty, error, no-permission, disabled và confirm.
- Xử lý không khớp hợp đồng: từ ngữ nhiệm vụ nói "Shell Next.js", nhưng `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` đã phê duyệt rõ ràng React + Vite + TypeScript cho Web Admin và nói rằng Next.js không nên được chọn nếu không có nhu cầu SEO/public-catalog thực sự. Do đó, triển khai vẫn giữ đường cơ sở React/Vite đã được phê duyệt thay vì thay đổi framework.

## Ánh xạ Tiêu chí Chấp nhận

| Tiêu chí Chấp nhận | Bằng chứng |
| --- | --- |
| Nền tảng FE Tái sử dụng đã được đánh giá/xác minh | `AppProviders`, router/layout/session store, API wrapper, barrel component dùng chung |
| Trạng thái loading/empty/error/success/disabled/confirm | `Loading`, `PageSkeleton`, `EmptyState`, `ErrorState`, `ApiErrorAlert`, `ConfirmButton`, `ConfirmDialog`, `ActionButton` |
| Bảng/form/modal/status/scan/toast dùng chung đã được ghi lại | `src/modules/component-catalog/ComponentCatalogPage.tsx`, `src/shared/components/README.md`, `docs/WMS_FRONTEND_STANDARDIZATION.md` |
| Hiển thị RBAC/lỗi API | `RequirePermission`, `PermissionGuard`, `NoPermissionState`, `ApiErrorAlert`, `api-error.ts`, `axios.ts` |
| Không có quy tắc nghiệp vụ hard-code ngoài hợp đồng | FE giữ RBAC chỉ là hỗ trợ UX; xác thực API/nghiệp vụ vẫn thuộc backend |
| Lint/build/test phù hợp cho bàn giao | Kết quả chạy sẽ được thêm bên dưới khi được thực thi trong nhánh |
| Truy xuất nguồn gốc BA/QA | File bằng chứng này cộng với `docs/WMS_FRONTEND_STANDARDIZATION.md` |

## Blockers / Xử lý

- Không có blocker P0/P1 FE1 nào được xác định trong phạm vi nền tảng tái sử dụng.
- Từ ngữ PL01-02 đề cập đến Next.js, trong khi đường cơ sở kiến trúc yêu cầu React/Vite cho Web Admin. Xử lý: giữ đường cơ sở, triển khai shell và bảo vệ route trong ứng dụng React/Vite hiện có và ghi lại sự không khớp này ở đây để BA/Tech Lead xem xét.
- Các khoảng trống endpoint/payload/quy tắc nghiệp vụ ngoài hợp đồng đã được phê duyệt hiện tại phải được báo lên BE/BA với chủ sở hữu và ETA trước khi hành vi UI bị thay đổi.

## Nhật ký Xác minh

Đã thực thi vào ngày 2026-07-29 trong `C:\ERP_HOA_NAM\Hoa_Nam_Tools`:

```text
npm.cmd run test
Kết quả: ĐẠT - 32 file kiểm thử, 276 bài kiểm tra

npm.cmd run lint
Kết quả: ĐẠT

npm.cmd run build
Kết quả: ĐẠT - tsc -b và vite build đã hoàn thành