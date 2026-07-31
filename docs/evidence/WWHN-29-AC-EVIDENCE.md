# WWHN-29 Bằng chứng Chấp nhận

Trạng thái: bằng chứng phía repo đã được làm mới cho PL01-02, chuyển đổi/ký duyệt Jira bên ngoài đang chờ
Ngày: 2026-07-29

## Truy xuất nguồn gốc

| Jira | Bằng chứng |
| --- | --- |
| Mục Hợp đồng PL01-02 | Bằng chứng UX design system, khung ứng dụng responsive và điều hướng RBAC |
| Khóa tạm Epic HN-EPIC-02 | Epic cha cho chuẩn hóa FE WMS |
| BA Pin HN-PIN-02 | Dấu vết BA cơ sở từ `08_DATA_API_UI_TECHNICAL_HANDOFF`, `HoaNam_Handoff_v3_9`, BRD v3.9 |
| WWHN-12 | Đầu vào đặc tả cho Module 1 app shell và RBAC |
| WWHN-29 | Gói chấp nhận triển khai cha |
| HN-UX-001 | Khóa tạm Cha cho khung ứng dụng FE tái sử dụng và điều hướng RBAC |
| HN-UX-001-ST01 | Đường cơ sở phụ thuộc cho chuẩn hóa design-system/component |
| WWHN-144 | Triển khai FE: app shell, điều hướng, component dùng chung, bảo vệ route/action, tài liệu design-system |
| WWHN-145 | QA smoke: ma trận viewport responsive, ma trận RBAC, kết quả Playwright/unit/build |

## Ma trận Tiêu chí Chấp nhận

| AC | Triển khai/bằng chứng | Kết quả |
| --- | --- | --- |
| Design tokens/danh mục component | `docs/design-system/DESIGN_TOKENS.md`, `docs/design-system/COMPONENT_INVENTORY.md`, `src/app/theme.ts`, `src/shared/design-tokens.ts` | Đạt chờ đính kèm Jira |
| App shell responsive | Bố cục ứng dụng/component cộng với danh sách kiểm tra viewport bên dưới | Đạt chờ artifact ảnh chụp màn hình |
| Menu theo RBAC | Trường quyền `MENU`, `filterMenu`, kiểm thử `SideNav`, `access.test.ts` kiểm tra route/menu | Đạt |
| Bảo vệ route và xử lý 403 | `RequirePermission`, `NoPermissionPage`, `NoPermissionState`, đánh dấu 403 axios, kiểm thử | Đạt |
| Trạng thái UI dùng chung | Bảng trạng thái dùng chung trong danh mục component | Đạt |
| Tái sử dụng component Wave 2-3 | Đường cơ sở form/table/scan/status/audit trong danh mục component | Đạt |
| Kiểm thử/CI | Kết quả lint/build/API mapping/unit mục tiêu/Playwright bên dưới | Đạt với nợ full-suite/mock hiện có |
| Đánh giá/truy xuất/ký duyệt | Mẫu bình luận Jira bên dưới | Đang chờ cập nhật Jira bên ngoài |

## HN-UX-001 Cập nhật Khung Tái sử dụng FE1

Ngày triển khai: 2026-07-29
Vai trò: FE1 - Quang Nguyen Thanh
Đầu ra: Khung FE tái sử dụng

| Khu vực | Bằng chứng | Kết quả |
| --- | --- | --- |
| Khung ứng dụng tái sử dụng | `src/shared/components/layout/AppShell.tsx` hiện hiển thị các slot `sider`, `header`, `breadcrumb`, `footer`, nội dung và body tái sử dụng mà không có logic nghiệp vụ | Đạt |
| Tích hợp bố cục ứng dụng | `src/app/layouts/MainLayout.tsx` kết hợp shell đã xác thực thông qua `AppShell` trong khi giữ việc tải profile, drawer responsive, preload và RBAC bên ngoài component dùng chung | Đạt |
| Metadata điều hướng | `src/app/layouts/menu.tsx` vẫn là nguồn duy nhất cho sidebar, selected key, open keys và breadcrumb; metadata route profile đã được thêm | Đạt |
| Hợp đồng route RBAC | `src/app/router/access.ts` đánh dấu rõ ràng `ROUTES.PROFILE` là đã xác thực/không có quyền bổ sung; các quyền WMS khác không thay đổi | Đạt |
| Trạng thái UI vô hiệu hóa | `src/app/layouts/AppHeader.tsx` nút thông báo bị vô hiệu hóa với tooltip vì không có endpoint thông báo backend nào được phê duyệt | Đạt |
| Phạm vi kiểm thử | `src/app/layouts/SideNav.test.tsx`, `src/shared/components/shared-components.test.tsx` bao gồm lọc RBAC, metadata điều hướng và slot `AppShell` | Đạt |
| Không khớp hợp đồng | Không có endpoint/payload API nào bị thay đổi. Thông báo vẫn bị vô hiệu hóa vì hợp đồng backend không có | Xử lý: không có blocker FE |

## Khóa Phạm vi PL01-02

| Đầu ra yêu cầu | Artifact repo | Ghi chú |
| --- | --- | --- |
| Danh sách design token/component | `docs/design-system/DESIGN_TOKENS.md`, `docs/design-system/COMPONENT_INVENTORY.md` | Đường cơ sở token và component tối thiểu cho một FE; nguồn tham chiếu vẫn ở `src/app/theme.ts` và `src/shared/design-tokens.ts` |
| Khung ứng dụng responsive | `src/shared/components/layout/AppShell.tsx`, `src/app/layouts/MainLayout.tsx`, `layout.styles.ts` | Desktop fixed sider; tablet/mobile drawer; đệm nội dung ổn định và body trang |
| Bằng chứng điều hướng theo RBAC | `src/app/router/access.ts`, `src/app/layouts/menu.tsx`, `src/app/router/access.test.ts`, `SideNav.test.tsx`, `RequirePermission.test.tsx` | Ẩn menu và chặn route trực tiếp chia sẻ cùng bản đồ quyền route |
| Trạng thái UI dùng chung | `Loading`, `PageSkeleton`, `EmptyState`, `ApiErrorAlert`, `NoPermissionState`, `ConfirmButton`, `confirmDialog`, `sonner` toaster | Đường cơ sở loading, empty, error, confirm, success/toast, disabled và 403 đã được định nghĩa |
| Đường cơ sở tái sử dụng Wave2-3 | `Form*`, `TableContainer`, `DataTable`, `ScanInput`, `StatusTag`, `AuditLogsTable`, `AuditLogDetailDrawer` | Đường dẫn tái sử dụng form/table/scan/status/audit đã được ghi lại |

Không có endpoint, payload, quy tắc xác thực, mutation tồn kho, phụ thuộc CI/CD hoặc quy tắc nghiệp vụ nào bị thay đổi cho PL01-02.

## Chạy Xác thực

Xác thực cục bộ vào ngày 2026-07-28 cộng với làm mới HN-UX-001 FE1 vào ngày 2026-07-29:

| Lệnh | Kết quả | Ghi chú |
| --- | --- | --- |
| `npm.cmd run lint` | Đạt | ESLint hoàn thành với mã thoát 0 |
| `npm.cmd run format:check` | Đạt | Tất cả các file `src` phù hợp sử dụng kiểu Prettier |
| `npm.cmd run build` | Đạt | TypeScript và Vite production build đã hoàn thành |
| `npm.cmd run check:api-mapping` | Đạt | 0 lỗi; 1 cảnh báo vì WWHN-29 không có hàng endpoint và Swagger có 288 route |
| `npm.cmd run test -- src/shared/components/shared-components.test.tsx src/app/router/RequirePermission.test.tsx src/app/layouts/SideNav.test.tsx src/shared/components/permission/ActionButton.test.tsx src/shared/components/data-display/TableContainer.test.tsx` | Đạt | 34 bài kiểm tra đã qua, bao gồm trạng thái dùng chung, ScanInput, route 403, RBAC SideNav, bảo vệ hành động và đường cơ sở bảng |
| `npm.cmd run test -- src/app/router/access.test.ts` | Đạt | Khóa ma trận quyền route WMS PL01-02 và kiểm tra menu/route |
| `npm.cmd run test -- src\app\layouts\SideNav.test.tsx src\shared\components\shared-components.test.tsx` | Đạt | 11 bài kiểm tra đã qua vào ngày 2026-07-29; bao gồm slot khung tái sử dụng, lọc RBAC, selected/open key và breadcrumb profile |
| `npm.cmd run lint` | Đạt | Chạy lại vào ngày 2026-07-29 sau khi cập nhật khung FE tái sử dụng |
| `npm.cmd run build` | Đạt | Chạy lại vào ngày 2026-07-29 sau khi `MainLayout` chuyển sang kết hợp `AppShell` |
| `npx.cmd playwright test` | Đạt | 4 đã qua, 1 bị bỏ qua; kiểm thử bị bỏ qua yêu cầu `QA_ADMIN_EMAIL`/`QA_ADMIN_PASSWORD` dựa trên backend QA thực tế |
| `npm.cmd run test` | Lỗi hiện có | Chạy lại vào ngày 2026-07-29: 25 file đã qua / 5 file lỗi; 245 đã qua / 28 lỗi. Lỗi vẫn còn trong bộ kiểm thử API/auth harness (`shared/api/axios*`, `shared/api/http`, `ContextSwitcher`, `LoginPage`) ngoài phạm vi cập nhật khung FE tái sử dụng |

## Ma trận Smoke Responsive

Chụp ảnh màn hình với HEAD SHA và dấu thời gian cho các hàng này trước khi chuyển WWHN-145 sang Đã hoàn thành.

| Viewport | Route | Vai trò | Kịch bản | Mong đợi | Kết quả |
| --- | --- | --- | --- | --- | --- |
| 1440x900 | `/dashboard` | Admin | sidebar mở rộng/thu gọn | nội dung vẫn hiển thị, không chồng lấn | Được bao phủ bởi triển khai app shell; đính kèm ảnh chụp màn hình vẫn được khuyến nghị cho Jira |
| 768x1024 | `/inbound` | Admin | tràn bảng và thanh công cụ scan | tràn ngang nằm trong khu vực nội dung | Được bao phủ bởi đường cơ sở app shell/table; đính kèm ảnh chụp màn hình vẫn được khuyến nghị cho Jira |
| 375x812 | `/inbound` | Admin | mobile drawer mở/đóng | menu có thể sử dụng, nội dung không bị ẩn sau drawer | Được bao phủ bởi đường cơ sở shell responsive; đính kèm ảnh chụp màn hình vẫn được khuyến nghị cho Jira |
| 375x812 | `/errors/403` | vai trò giới hạn | route trực tiếp bị chặn | hướng dẫn 403 hiển thị hành động back/home | Được bao phủ bởi kiểm thử `RequirePermission` và trang 403 |
| 768x1024 | route form/modal | Admin | nhãn dài, lỗi xác thực | nhãn/lỗi xuống dòng không chồng lấn | Được bao phủ bởi wrapper form và kiểm thử đường cơ sở xác thực |
| 1440x900 | audit logs | Admin | loading/empty/error/detail drawer | trạng thái dùng chung hiển thị nhất quán | Được bao phủ bởi triển khai trang audit/table/detail drawer |

## Ma trận RBAC

| Vai trò | Hiển thị Menu | URL trực tiếp | Hiển thị Hành động | Kết quả API | UX mong đợi |
| --- | --- | --- | --- | --- | --- |
| Super admin | hiển thị | được phép | hiển thị | 2xx | mở màn hình |
| Vai trò giới hạn với quyền route | hiển thị cho các module được phép | được phép cho quyền phù hợp | hành động được phép hiển thị/vô hiệu theo phạm vi | 2xx hoặc 403 có phạm vi | mở màn hình được phép, từ chối có phạm vi giải thích hành động |
| Vai trò giới hạn không có quyền route | ẩn | bị chặn bởi `RequirePermission` | ẩn/vô hiệu bởi `ActionButton`/`PermissionGuard` | 403 được đánh dấu `_isNoPermission` | Hướng dẫn `/errors/403` với back/home |
| Không có quyền | ẩn | bị chặn | ẩn | 403 | không trang trống, không vòng lặp chuyển hướng |

## Mẫu Bình luận Jira

HEAD triển khai: `<HEAD_SHA>`
PR: `<PR_URL>`
Chạy CI: `npm.cmd run lint` ĐẠT; `npm.cmd run format:check` ĐẠT; `npm.cmd run build` ĐẠT; `npm.cmd run check:api-mapping` ĐẠT; kiểm thử component/RBAC WWHN-29 mục tiêu ĐẠT
Chạy Playwright: `npx.cmd playwright test` ĐẠT, 4 đã qua / 1 bị bỏ qua vì thiếu thông tin xác thực QA
Artifact design token: `docs/design-system/DESIGN_TOKENS.md`
Danh mục component: `docs/design-system/COMPONENT_INVENTORY.md`
Bằng chứng responsive: đính kèm ảnh chụp màn hình/báo cáo cho 1440x900, 768x1024, 375x812
Bằng chứng RBAC: đính kèm ma trận trên và đầu ra kiểm thử
Bằng chứng 403: `RequirePermission.test.tsx`, `NoPermissionPage.tsx`, ảnh chụp màn hình `/errors/403`
Hạn chế đã biết: chuyển đổi trạng thái/subtask Jira yêu cầu quyền dự án; `npm.cmd run test` đầy đủ vẫn hiển thị nợ mock/test-harness cấp repo ngoài lát cắt chấp nhận WWHN-29 mục tiêu
Xử lý P0/P1: bằng chứng P0 phía repo đã được thêm; trạng thái/ký duyệt Jira bên ngoài đang chờ
Người đánh giá/ký duyệt: FE, QA, BA