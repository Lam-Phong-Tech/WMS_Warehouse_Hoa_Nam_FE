# WWHN-29 Danh mục Component

Trạng thái: đường cơ sở triển khai
Chủ sở hữu: FE Module 1
Phạm vi bằng chứng: app shell dùng chung, RBAC, trạng thái dùng chung, đường cơ sở form/table/scan/status/audit

| Component | Mục đích | Đường dẫn | API/props | Trạng thái hỗ trợ | Khả năng tiếp cận | Hành vi responsive | Mục tiêu tái sử dụng | Kiểm thử/bằng chứng |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `MainLayout` | App shell đã xác thực | `src/app/layouts/MainLayout.tsx` | route outlet | loading thông qua route suspense | landmarks qua Ant Layout | sidebar thu gọn/drawer xử lý bởi layout styles | tất cả các trang đã xác thực | `src/app/layouts/SideNav.test.tsx` |
| `SideNav` | Điều hướng được lọc theo RBAC | `src/app/layouts/SideNav.tsx`, `src/app/layouts/menu.tsx` | cấu hình menu và trạng thái quyền | mở rộng, thu gọn, đã lọc | hành vi bàn phím kế thừa từ Ant Menu | desktop sidebar, mobile drawer pattern | tất cả module | `src/app/layouts/SideNav.test.tsx` |
| `RequirePermission` | Bảo vệ route | `src/app/router/RequirePermission.tsx` | `permission?: string \| string[]` | đang tải profile, được phép, bị chặn | chuyển hướng đến trang hướng dẫn 403 | ổn định khi refresh/URL trực tiếp | các route được bảo vệ | `src/app/router/RequirePermission.test.tsx` |
| `PermissionGuard` | Bao bọc nội dung/hành động có điều kiện | `src/shared/components/permission/PermissionGuard.tsx` | module/action/permissionCode, fallback | ẩn, fallback, được phép | tránh các điều khiển không thể truy cập | inline, table action, toolbar action | tất cả khu vực hành động | `src/shared/components/permission/**` tests |
| `ActionButton` | Nút nhận biết quyền | `src/shared/components/permission/ActionButton.tsx` | module/action/permissionCode, hide/disable | ẩn, vô hiệu hóa, đang tải | title vô hiệu giải thích lý do | toolbar/table row an toàn | hành động create/edit/delete/bulk | `ActionButton.test.tsx` |
| `NoPermissionState` | Trạng thái hướng dẫn 403 | `src/shared/components/feedback/NoPermissionState.tsx` | title, description, action, nút home | bị chặn, hành động back/home | văn bản rõ ràng và nút có thể hành động | page/card centering | UX route/API 403 | `NoPermissionPage.tsx`, router tests |
| `ApiErrorAlert` | Trạng thái lỗi API dùng chung | `src/shared/components/feedback/ApiErrorAlert.tsx` | error, title, retry | lỗi, chi tiết xác thực, thử lại | ngữ nghĩa cảnh báo từ Ant Alert | full-width trong trang table/form | tất cả lỗi query/mutation | API error tests |
| `Loading`, `LoadingState`, `PageSkeleton` | Đường cơ sở tải | feedback/data-display/ui-states | tip/minHeight | route, block, table skeleton | trạng thái trực quan bận | chiều cao tối thiểu cố định ngăn nhảy | routes/tables/cards | shared tests và usage |
| `EmptyState` | Trạng thái dữ liệu rỗng | `src/shared/components/data-display/EmptyState.tsx` | title, description, children | mặc định, đã lọc, hành động | hướng dẫn rỗng dễ đọc | căn giữa trong container | tất cả trang list/table | shared tests |
| `confirmDialog`, `ConfirmButton` | Đường cơ sở xác nhận | `src/shared/components/feedback` | title/content/onConfirm/loading | xác nhận, đang chờ, đã hủy | bẫy focus Ant Modal | chiều rộng modal responsive | hành động hủy/lưu | component tests |
| `FormModal`, `FormDrawer`, `FormPage`, `FormSection`, `FormActions` | Bao bọc form dùng chung | `src/shared/components/feedback` và `forms` | open/title/loading/actions/fields | loading, validation, disabled, submit | bẫy focus trong modal/drawer, nhãn qua Form.Item | drawer/modal thích ứng viewport | workflow create/edit/detail | form component tests |
| `FormInput`, `FormSelect`, `FormDatePicker`, `FormNumber`, `FormSwitch`, `FormTextarea` | Điều khiển trường | `src/shared/components/forms` | react-hook-form control/name/label | validation, disabled, required, IME an toàn | điều khiển có nhãn và lỗi trường | full-width theo container | tất cả form nghiệp vụ | `useFormPattern.test.tsx` |
| `TableContainer`, `DataTable`, `TableToolbar`, `TopPagination`, `PageSizeSelector` | Đường cơ sở bảng | `src/shared/components/data-display` | toolbar/loading/error/empty/pagination/sort | loading, empty, filtered empty, error, retry | Bàn phím/nhãn Ant Table | tràn ngang thuộc table container | trang danh sách | `TableContainer.test.tsx`, table hook tests |
| `ScanInput` | Đường cơ sở scan Barcode/QR/thủ công | `src/shared/components/forms/ScanInput.tsx` | value, recentCodes, error, onScan | tự động focus, lỗi rỗng, lỗi trùng lặp, vô hiệu | `aria-label`, thông báo cảnh báo, giữ focus | chiều rộng kế thừa từ parent/toolbars | scan inbound/outbound/stocktake/physical code | `shared-components.test.tsx` |
| `StatusBadge`, `StatusTag` | Đường cơ sở trạng thái/chip | `src/shared/components/data-display` | active/status/map props | active/inactive/ngữ nghĩa tùy chỉnh | văn bản và màu sắc ghép đôi | inline an toàn cho bảng | mọi cột trạng thái | shared tests |
| `AuditLogsTable`, `AuditLogDetailDrawer` | Đường cơ sở kiểm toán | `src/modules/audit-logs/components` | data/loading/page/sort/view | loading, empty, detail drawer | ngữ nghĩa bảng và đóng drawer | tràn bảng cộng drawer | mẫu hiển thị audit trail | audit page usage |

## Đường cơ sở Trạng thái UI Dùng chung

| Trạng thái | Trừu tượng dùng chung | Hành vi yêu cầu |
| --- | --- | --- |
| Loading | `Loading`, `LoadingState`, `PageSkeleton`, `TableContainer.loading` | tiến trình hiển thị, chiều cao ổn định, không trang trống |
| Empty | `EmptyState`, `FilteredEmptyState`, `TableContainer.emptyState` | giải thích trạng thái trống/đã lọc và hành động tùy chọn |
| Error | `ApiErrorAlert`, `ErrorBoundary`, `ErrorState` | hiển thị lý do, thử lại khi có thể, giữ nguyên shell trang |
| Confirm | `confirmDialog`, `ConfirmButton` | xác nhận người dùng rõ ràng trước hành động hủy/lưu rủi ro |
| Success/toast | `sonner` được mount trong `App.tsx` | thành công mutation được hiển thị qua toaster dùng chung |
| Disabled | Ant disabled props, `ActionButton` disabled mode | hành động không khả dụng giải thích lý do qua title/tooltip |
| 403 | `RequirePermission`, `NoPermissionPage`, `NoPermissionState` | URL trực tiếp bị chặn, hướng dẫn back/home, không vòng lặp |

## Kết luận

Scan và audit được bao gồm trong đường cơ sở này. `ScanInput` là hợp đồng tái sử dụng cho nhập liệu scan; các trang module nên di chuyển các instance `Input.Search` cục bộ sang nó khi chúng vượt qua dữ liệu prototype. Audit có mẫu bảng/detail drawer cụ thể trong `modules/audit-logs`.