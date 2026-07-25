# ERP Frontend

Giao diện quản trị ERP xây dựng bằng **React 19 + TypeScript + Vite**.

> Tài liệu kỹ thuật chi tiết (luồng auth/RBAC, phân tích từng layer, danh sách TODOs) nằm ở [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Công Nghệ

| Nhóm            | Thư viện                               |
| --------------- | -------------------------------------- |
| Core            | React 19, TypeScript 6, Vite 8         |
| Routing         | react-router-dom 7, lazy-loaded routes |
| Data fetching   | @tanstack/react-query 5 + axios        |
| State           | zustand 5, persist bằng cookie         |
| Form/Validation | react-hook-form + zod                  |
| UI              | antd 6 + @ant-design/icons + dayjs     |
| Toast           | sonner (`<Toaster>` mount ở `App.tsx`) |
| Testing         | Vitest + Testing Library, jsdom        |
| Tooling         | ESLint, Prettier, Husky + lint-staged  |

---

## Yêu Cầu

- Node.js >= 22
- Yarn 1.x

---

## Bắt Đầu

```bash
# 1. Cài dependencies
yarn

# 2. Tạo file env từ mẫu
cp .env.example .env
# Windows PowerShell:
Copy-Item .env.example .env

# 3. Chạy dev server
yarn dev
```

Mặc định `.env.example` đang trỏ tới backend test:

```env
VITE_API_URL="https://astrodev.test8.io.vn/api/v1"
```

---

## Scripts

| Lệnh                | Mô tả                                       |
| ------------------- | ------------------------------------------- |
| `yarn dev`          | Chạy dev server Vite                        |
| `yarn build`        | Type-check bằng `tsc -b` + build production |
| `yarn preview`      | Xem thử bản build                           |
| `yarn lint`         | Kiểm tra ESLint                             |
| `yarn test`         | Chạy toàn bộ test một lần                   |
| `yarn test:watch`   | Chạy test ở chế độ watch                    |
| `yarn format`       | Format source trong `src/` bằng Prettier    |
| `yarn format:check` | Kiểm tra format trong `src/`                |

---

## Cấu Trúc Dự Án

```text
src/
├─ app/                  # Vỏ ứng dụng: layout, provider, router, theme
│  ├─ layouts/           # MainLayout, SideNav, AppHeader, AppBreadcrumb, AppFooter, menu config
│  ├─ providers/         # React Query provider
│  ├─ router/            # Route, ProtectedRoute, RequirePermission, access.ts
│  └─ theme.ts           # Theme antd tập trung (màu BRAND, bo góc, font)
├─ lib/                  # Facade — điểm import DUY NHẤT cho auth & permissions
│  ├─ auth/              # @/lib/auth  — useAuthStore, useLogin, useLogout, useMe, ProtectedRoute
│  └─ permissions/       # @/lib/permissions — useCan, Can, RequirePermission, useDataScope
├─ modules/              # Tính năng theo nghiệp vụ (co-location)
│  ├─ auth/                    # Login/logout/me, ContextSwitcher, permission helpers
│  ├─ users/                   # Service/hook nội bộ cho user-role-scopes (không có trang riêng)
│  ├─ org-units/               # Đơn vị tổ chức (cây + form)
│  ├─ org-charts/              # Sơ đồ tổ chức (visualize cây đơn vị/phòng ban)
│  ├─ departments/             # Phòng ban
│  ├─ employees/               # Nhân viên
│  ├─ employee-assignments/    # Phân công đơn vị/phòng ban/chức vụ
│  ├─ employee-status/         # Đổi trạng thái nhân sự
│  ├─ positions/                # Chức vụ
│  ├─ roles/                    # Vai trò & quyền (RBAC), gán quyền cho user (user-role-scopes)
│  ├─ permissions/               # Danh mục quyền hệ thống
│  └─ tasks/                     # Giao việc & phê duyệt
├─ shared/               # Dùng chung ≥ 2 module
│  ├─ api/               # axios instance, http (bóc envelope), endpoints, api-error
│  ├─ components/        # 45+ component tái dùng (xem mục Shared Components)
│  ├─ constants/         # ROUTES
│  ├─ lib/               # Adapter hạ tầng (cookie-storage)
│  ├─ store/             # auth.store (zustand + persist)
│  ├─ types/             # Type dùng chung (ApiResponse, User…)
│  └─ utils/             # Helper dùng chung
└─ test/                 # Setup Vitest + helper render có providers
```

Alias `@/` trỏ tới thư mục `src/`.

### Facade `src/lib/`

`src/lib/` **không chứa logic** — chỉ re-export để code nghiệp vụ có một điểm import nhất quán, không cần thò vào nội tại `modules/auth/` hay `app/router/`:

```ts
import {
  useAuthStore,
  useLogin,
  useLogout,
  useMe,
  ProtectedRoute,
} from '@/lib/auth';
import {
  useCan,
  Can,
  RequirePermission,
  useDataScope,
} from '@/lib/permissions';
```

---

## Kiến Trúc Chính

- **Bootstrap**: `main.tsx` → `QueryProvider` → `App` (ConfigProvider + theme + locale vi_VN) → `ErrorBoundary` → `RouterProvider`.
- **Route**: khai báo trong [src/app/router/index.tsx](src/app/router/index.tsx), tất cả page chính lazy-load theo route.
- **Bảo vệ đăng nhập**: `ProtectedRoute` chặn khi chưa có phiên → `/login`.
- **Bảo vệ quyền**: `RequirePermission` đọc `ROUTE_PERMISSIONS` từ [access.ts](src/app/router/access.ts); thiếu quyền → trang 403 (không chỉ ẩn menu).
- **Layout admin**: `MainLayout` ghép `SideNav`, `AppHeader`, `AppBreadcrumb`, `Outlet`, `AppFooter`; desktop dùng `Sider` thu gọn được, mobile dùng `Drawer` trượt.
- **Menu/Breadcrumb**: cấu hình tập trung ở [menu.tsx](src/app/layouts/menu.tsx), tự lọc theo quyền người dùng.
- **Bối cảnh ERP** (`ContextSwitcher`): đổi vai trò/phạm vi (chi nhánh/phòng ban...) dựa trên `available_contexts` trả về lúc đăng nhập; lưu vào `currentContext` trong store.

---

## API & Tầng Dữ Liệu

### axios + interceptor

`axios` cấu hình tại [src/shared/api/axios.ts](src/shared/api/axios.ts):

- `baseURL` = `VITE_API_URL`.
- **Request interceptor**: tự gắn `Authorization: Bearer <token>`.
- **Response interceptor**: gặp `401` → logout + xoá cookie + chuyển `/login`.

Endpoint tập trung ở [src/shared/api/endpoints.ts](src/shared/api/endpoints.ts).

### Envelope API — contract chính thức

```json
{ "success": true, "message": "...", "data": {} }
```

Backend cũ trả `status: "success"/"error"` — `http` xử lý cả hai để tương thích ngược.  
Service **không** gọi `axios` trực tiếp mà qua `http` ([src/shared/api/http.ts](src/shared/api/http.ts)) — lớp bọc mỏng tự bóc `data` ra, nên service chỉ làm việc với kiểu `T`:

```ts
list()              { return http.get<User[]>(API_ENDPOINTS.USERS); }
create(payload)     { return http.post<User>(API_ENDPOINTS.USERS, payload); }
update(id, payload) { return http.put<User>(`${API_ENDPOINTS.USERS}/${id}`, payload); }
remove(id)          { return http.delete<void>(`${API_ENDPOINTS.USERS}/${id}`); }
```

### Xử lý lỗi

`getApiErrorMessage(error)` (từ [api-error.ts](src/shared/api/api-error.ts)) trả thông điệp thân thiện — ưu tiên `message` trong envelope, rồi lỗi mạng, cuối cùng fallback.

```ts
// trong mutation catch / onError — dùng sonner `toast`, không dùng antd `message`
import { toast } from 'sonner';
toast.error(getApiErrorMessage(e));
toast.success('Đã cập nhật thành công');
```

### React Query — quy ước

- **Query key**: định nghĩa hằng số, bao gồm tham số lọc/phân trang:
  ```ts
  const USERS_KEY = ['users'] as const;
  queryKey: [...USERS_KEY, { page, limit, search }];
  ```
- **Sau khi ghi** (create/update/delete): `queryClient.invalidateQueries({ queryKey: USERS_KEY })`.
- **Luồng dữ liệu**: `Page → hook (React Query) → service (http) → API`.

> **Module `employees` là mẫu CRUD đầy đủ hiện đang chạy** — xem [EmployeesPage.tsx](src/modules/employees/pages/EmployeesPage.tsx) khi cần ví dụ nối API, phân trang, lọc, form. (Module `users` từng là khuôn mẫu tham chiếu ban đầu nhưng `UsersPage.tsx` đã bị gỡ khỏi router/codebase — phần còn lại của `users` chỉ còn service/hook dùng nội bộ cho `user-role-scopes`.)

### Chọn nhiều dòng (bulk actions)

Hầu hết bảng CRUD (`departments`, `employees`, `employee-assignments`, `org-units`, `positions`, `roles`, `tasks`, `user-role-scopes`...) đều có `rowSelection` qua `DataTable` — tick chọn nhiều dòng để thao tác hàng loạt (vd xóa nhiều phòng ban/nhân viên cùng lúc). Trạng thái chọn (`selectedRowKeys`) quản lý ở page, thanh hành động hàng loạt chỉ hiện khi có dòng được chọn.

---

## Auth & Trạng Thái Phiên

Store: [src/shared/store/auth.store.ts](src/shared/store/auth.store.ts) — zustand với middleware `persist`.

| Nhóm        | Fields                                                               | Persist?         |
| ----------- | -------------------------------------------------------------------- | ---------------- |
| Phiên       | `token`, `user`, `contexts`, `currentContext`                        | ✅ cookie 7 ngày |
| Cờ phiên    | `isAuthenticated`                                                    | ❌ tính từ token |
| Hồ sơ/quyền | `account`, `employee`, `roles`, `permissionCodes`, `isProfileLoaded` | ❌ fetch lại     |

Cookie lưu `SameSite=Lax`, `Secure` khi HTTPS, hết hạn 7 ngày. Quyền (`permissionCodes`) **không persist** — tải lại qua `GET /auth/me` sau login hoặc F5 để luôn tươi.

**Auth flow:**

```text
LoginPage → useLogin → authService.login
  → setAuth(token, user, contexts) → /dashboard
  → MainLayout mount → useMe() → setProfile(permissionCodes, ...)
```

---

## Phân Quyền (RBAC)

Nguồn quyền: `permission_codes` (mảng phẳng) + `is_super_admin` từ `GET /auth/me`.

```ts
được phép = isSuperAdmin || permissionCodes.includes(code)
```

### Áp dụng

```tsx
// Ẩn/hiện UI theo quyền
import { Can } from '@/lib/permissions';
<Can permission="EMP_CREATE">
  <Button>Thêm nhân viên</Button>
</Can>;

// Hook kiểm quyền
import { useCan } from '@/lib/permissions';
const canEdit = useCan('EMP_EDIT');

// Guard route (trong router/index.tsx)
<RequirePermission permission="EMP_VIEW">
  <EmployeesPage />
</RequirePermission>;
```

> **Không hardcode theo tên role** — luôn kiểm theo `permission_codes`.

### Bảng mã quyền

| Nhóm                             | Mã quyền                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `ORG_*` (Đơn vị tổ chức)         | `ORG_VIEW`, `ORG_CREATE`, `ORG_EDIT`, `ORG_INACTIVE`, `ORG_EXPORT`                                     |
| `DEPT_*` (Phòng ban)             | `DEPT_VIEW`, `DEPT_CREATE`, `DEPT_EDIT`, `DEPT_INACTIVE`, `DEPT_EXPORT`                                |
| `EMP_*` (Nhân sự)                | `EMP_VIEW`, `EMP_CREATE`, `EMP_EDIT`, `EMP_INACTIVE`, `EMP_STATUS`, `EMP_EXPORT`, `EMP_IMPORT`         |
| `POS_*` (Chức vụ)                | `POS_VIEW`, `POS_CREATE`, `POS_EDIT`, `POS_INACTIVE`, `POS_EXPORT`                                     |
| `EMP_ASSIGNMENT_*` (Điều chuyển) | `EMP_ASSIGNMENT_VIEW`, `EMP_ASSIGNMENT_CREATE`, `EMP_ASSIGNMENT_EDIT`, `EMP_ASSIGNMENT_DELETE`         |
| `ROLE_*` (Vai trò & quyền)       | `ROLE_VIEW`, `ROLE_MANAGE`                                                                             |
| `TASK_*` (Giao việc)             | `TASK_VIEW`, `TASK_CREATE`, `TASK_EDIT` (guard route; workflow start/submit/approve/reject xử lý ở BE) |

> Bảng trên khớp strict với `PERMISSION_CATALOG` trong [RolesPage.tsx](src/modules/roles/pages/RolesPage.tsx) — đã bỏ các mã quyền chưa từng dùng trong code (`ROLE_ASSIGN`, `PERM_CONFIG`).

> `WAREHOUSE_VIEW` được khai báo sẵn trong [access.ts](src/app/router/access.ts) cho route `/warehouse`, nhưng route này **chưa được đăng ký** trong router và chưa có module tương ứng — để dành cho module Kho trong tương lai.

---

## Quy Ước Module

Mỗi module nghiệp vụ đặt trong `src/modules/<ten-module>/`:

```text
modules/<ten-module>/
├─ services/<ten-module>.service.ts   # Cửa công khai: gọi API qua http, re-export hook
├─ hooks/use-<ten-module>.ts          # React Query hooks (query + mutation)
├─ pages/<TenModule>Page.tsx          # Page — router lazy-load trực tiếp vào đây
├─ components/                        # Component chỉ dùng trong module
├─ schemas/<ten-module>.schema.ts     # Zod schema cho form
└─ types/<ten-module>.types.ts        # Interface riêng của module
```

Quy tắc phụ thuộc: `modules` dùng `shared`; `shared` **không** dùng ngược `modules`. Module khác import logic tái dùng qua `services/<ten>.service.ts`, không chọc thẳng vào file nội bộ.

---

## Module Hiện Có

| Module                 | Nội dung chính                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`                 | Login/logout/me, lưu phiên cookie, ContextSwitcher, `Can`, permission                                                                 |
| `users`                | Service/hook nội bộ cho `user-role-scopes`/`data-scopes` — **không còn trang riêng** (`UsersPage.tsx` đã gỡ, `/users` không có route) |
| `org-units`            | Đơn vị tổ chức — cây đơn vị, form tạo/sửa, ngừng hoạt động/khôi phục/lưu trữ, export                                                  |
| `org-charts`           | Sơ đồ tổ chức — visualize cây đơn vị/phòng ban                                                                                        |
| `departments`          | Phòng ban — danh sách, lọc, tạo/sửa, soft-delete/restore/archive, chọn nhiều dòng để xóa/thao tác hàng loạt                           |
| `employees`            | Hồ sơ nhân viên, liên kết tài khoản M9, chọn nhiều dòng để xóa/thao tác hàng loạt                                                     |
| `employee-assignments` | Phân công nhân sự vào đơn vị/phòng ban/chức vụ                                                                                        |
| `employee-status`      | Đổi trạng thái nhân sự                                                                                                                |
| `positions`            | Danh mục chức vụ — CRUD, soft-delete/restore                                                                                          |
| `roles`                | Vai trò & quyền — danh sách, form tạo mới, drawer xem chi tiết quyền, gán quyền/phạm vi dữ liệu cho user                              |
| `permissions`          | Danh mục quyền hệ thống (dùng cho ma trận Module × Action ở `roles`)                                                                  |
| `tasks`                | Giao việc & phê duyệt — tạo/giao việc, start/submit/approve/reject                                                                    |

> Route `/warehouse` (`WAREHOUSE_VIEW`) đã có hằng route nhưng **chưa đăng ký trong router**, chưa có module — placeholder cho module Kho tương lai.

---

## Thêm Module Mới

1. Tạo `src/modules/<ten>/` theo cấu trúc module trên.
2. Thêm endpoint vào [src/shared/api/endpoints.ts](src/shared/api/endpoints.ts).
3. Viết service gọi API **qua `http`** (tự bóc envelope).
4. Viết React Query hook — query key + mutation + `invalidateQueries` sau khi ghi.
5. Tạo page trong `pages/`, lazy-load ở [src/app/router/index.tsx](src/app/router/index.tsx).
6. Thêm route constant vào [src/shared/constants/routes.ts](src/shared/constants/routes.ts).
7. Thêm quyền route vào [src/app/router/access.ts](src/app/router/access.ts).
8. Thêm menu item (kèm `permission`) vào [src/app/layouts/menu.tsx](src/app/layouts/menu.tsx).
9. Bọc nút/hành động cần quyền bằng `<Can permission="...">`.

---

## Shared Components

Barrel export tại [src/shared/components/index.ts](src/shared/components/index.ts).

```ts
import {
  PageHeader,
  DataTable,
  FilterBar,
  FormModal,
  StatCard,
} from '@/shared/components';
import { FormInput, FormSelect, FormSwitch } from '@/shared/components/forms';
```

| Nhóm            | Component                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `layout/`       | `AppShell`, `Sidebar`, `Header`, `Breadcrumb`, `PageHeader`                                                                             |
| `data-display/` | `DataTable`, `EmptyState`, `StatusBadge`, `StatusTag`, `LoadingState`, `SearchInput`, `FilterBar`                                       |
| `feedback/`     | `Loading`, `Modal`, `FormModal`, `ConfirmButton`, `confirmDialog()`, `toast()`, `Alert`, `ApiErrorAlert`, `FieldError`, `ErrorBoundary` |
| `navigation/`   | `MenuItem`, `Pagination`, `Tabs`                                                                                                        |
| `cards/`        | `StatCard`, `InfoCard`                                                                                                                  |
| `forms/`        | `FormField`, `FormInput`, `FormTextarea`, `FormSelect`, `FormNumber`, `FormDatePicker`, `FormSwitch`, `FormError`, `SubmitButton`       |

> **Lưu ý `FormDatePicker`**: giá trị trong form là đối tượng `dayjs`, không phải string — khi submit cần `.toISOString()` / `.format()`. Schema Zod dùng `z.instanceof(dayjs).nullable()`, không dùng `z.any()`.

---

## Testing

Test đặt cạnh file nguồn dạng `*.test.ts(x)`, chạy bằng Vitest + Testing Library.

```bash
yarn test        # chạy một lần
yarn test:watch  # watch mode
```

| File                                               | Vai trò                                                 |
| -------------------------------------------------- | ------------------------------------------------------- |
| [vite.config.ts](vite.config.ts)                   | Cấu hình Vitest: `jsdom`, `globals`, setupFiles         |
| [src/test/setup.ts](src/test/setup.ts)             | Mock `matchMedia` cho antd responsive                   |
| [src/test/test-utils.tsx](src/test/test-utils.tsx) | `renderWithProviders` — render kèm QueryClient + Router |

---

## Chất Lượng Code

- **ESLint**: `yarn lint`
- **Prettier**: `yarn format` (format) / `yarn format:check` (kiểm tra — dùng trong CI)
- **Pre-commit** (Husky + lint-staged): tự `eslint --fix` + `prettier --write` trên file staged.
- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)): push/PR vào `main`/`dev` chạy `lint` → `format:check` → `test` → `build`.
- **Line endings**: chuẩn hoá LF qua [.gitattributes](.gitattributes).

---

## 📚 Tài Liệu Chi Tiết

| File                                                                         | Nội dung                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                                 | Kiến trúc chi tiết, luồng auth/RBAC, API layer |
| [docs/API_EVIDENCE.md](docs/API_EVIDENCE.md)                                 | Index tổng quan API endpoints đã xác minh      |
| [docs/CHANGELOG.md](docs/CHANGELOG.md)                                       | Lịch sử thay đổi, bug fixes                    |
| [docs/TASK_BLOCKERS.md](docs/TASK_BLOCKERS.md)                               | Công việc bị blocker, pending items            |
| [docs/PERMISSION_CATALOG_ALIGNMENT.md](docs/PERMISSION_CATALOG_ALIGNMENT.md) | Permission codes alignment với BE              |
| [docs/COOKIE_STORAGE_RISKS.md](docs/COOKIE_STORAGE_RISKS.md)                 | Phân tích rủi ro bảo mật cookie                |
| [docs/PERFORMANCE_OPTIMIZATION.md](docs/PERFORMANCE_OPTIMIZATION.md)         | Hướng dẫn tối ưu performance                   |
| [docs/RUNTIME_EVIDENCE.md](docs/RUNTIME_EVIDENCE.md)                         | Build/test logs, runtime metrics               |
| [docs/api-evidence/\*.md](docs/api-evidence/)                                | API evidence chi tiết theo module              |

---

**Last Updated**: 2026-07-06  
**Maintained By**: ERP Frontend Team  
**Review Cycle**: Update on every major change
