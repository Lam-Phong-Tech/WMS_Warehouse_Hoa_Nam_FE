# `lib/auth` & `lib/permissions` — Skeleton Auth / Permission

Điểm vào tập trung cho **xác thực** (`lib/auth`) và **phân quyền** (`lib/permissions`) của Admin Layout.
Đây là **facade** gom các primitive sẵn có vào một nơi rõ ràng, để màn nghiệp vụ import nhất quán.

## Mapping năng lực → cài đặt

| Năng lực (review)             | Cài đặt                                                                    | Import từ           |
| ----------------------------- | -------------------------------------------------------------------------- | ------------------- |
| Protected route               | `ProtectedRoute` (chưa login → `/login`)                                   | `@/lib/auth`        |
| Redirect khi chưa login / 401 | `ProtectedRoute` + axios interceptor (`shared/api/axios.ts`)               | —                   |
| Permission guard (route)      | `RequirePermission` (thiếu quyền → **403**)                                | `@/lib/permissions` |
| Permission guard (UI)         | `Can`                                                                      | `@/lib/permissions` |
| Role-based access             | `useCan` / `useHasPermission` (theo `permission_codes` + `is_super_admin`) | `@/lib/permissions` |
| Nguồn quyền theo route        | `ROUTE_PERMISSIONS` (single source cho router + menu)                      | `@/lib/permissions` |
| Data scope theo module        | `useDataScope` / `scopeToParams` (từ `currentContext`)                     | `@/lib/permissions` |
| Phiên/token/hồ sơ             | `useAuthStore`, `useMe`, `useLogin`, `useLogout`                           | `@/lib/auth`        |

## Vì sao KHÔNG có `middleware.ts` / `src/app/(admin)` / `src/app/(partner)`

Đó là cấu trúc **Next.js App Router**. Dự án này là **Vite + react-router** (SPA), nên:

- `middleware.ts` (chặn server-side) → thay bằng **`ProtectedRoute` + `RequirePermission`** ở client router.
- `src/app/(admin)` / `(partner)` (route groups) → thay bằng cấu hình route trong [`app/router/index.tsx`](../../app/router/index.tsx) + layout [`MainLayout`](../../app/layouts/MainLayout.tsx).

Tạo các file Next.js đó ở đây sẽ là scaffolding rỗng, không chạy.

## Ví dụ

```tsx
import { RequirePermission, useCan } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth';

// Guard 1 nhánh UI
const canEdit = useCan('ORG_EDIT');

// Bọc nội dung cần quyền
<RequirePermission permission="ROLE_VIEW">
  <RolesPage />
</RequirePermission>;
```
