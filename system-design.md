# Hướng dẫn Đánh giá & Thiết kế Hệ thống

Repo Agent đọc file này trước mọi đánh giá code và gắn cờ bất kỳ thay đổi nào vi phạm các quy tắc dưới đây (nó trích dẫn quy tắc đã vi phạm).

## Thiết kế hệ thống / kiến trúc

React 19 + TypeScript + Vite SPA (ERP admin). Chi tiết đầy đủ ở
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); tóm tắt các ràng buộc mà reviewer
cần soi:

- Tổ chức theo module nghiệp vụ dưới `src/modules/<module>/` (mỗi module có
  `components/`, `hooks/`, `pages/`, `services/`, `schemas/`, `types/` khi cần).
  Không tạo layer DI-container hay service class tách biệt — module tự chứa.
- `src/shared/` chỉ chứa những gì dùng ở ≥ 2 module. Không thêm code chỉ dùng
  cho 1 module vào `shared/`.
- `src/app/` là vỏ ứng dụng (router, layout, theme) — không chứa nghiệp vụ.
- Gọi API: mọi service module đi qua `src/shared/api/http.ts` (axios instance +
  interceptor bóc envelope), không gọi `axios` trực tiếp trong component/hook.
- Data fetching qua `@tanstack/react-query` (hook `use-*.ts` trong từng module);
  không tự quản lý loading/error state thủ công khi react-query đã đủ.
- Phân quyền: kiểm tra qua `useCan` / `<Can permission="...">` /
  `RequirePermission` (`src/lib/permissions`), đối chiếu `permission_codes` từ
  `/auth/me` — không hardcode theo role name. Mã quyền hợp lệ phải khớp
  `PERMISSION_CATALOG` trong [RolesPage.tsx](src/modules/roles/pages/RolesPage.tsx)
  hoặc `ROUTE_PERMISSIONS` trong [access.ts](src/app/router/access.ts) — không
  suy đoán/tạo mã quyền mới theo prefix/heuristic.
- Import alias `@/` trỏ tới `src/`.

## Quy tắc đánh giá

- **Không debug output**: không `console.log` trong code commit — dùng cách xử lý
  lỗi/log đã có trong `shared/api/api-error.ts` hoặc toast (`sonner`).
- **Xử lý lỗi**: mọi call API qua react-query mutation/query phải xử lý
  `isError`/`onError` và hiển thị lỗi qua `getApiErrorMessage` — không nuốt lỗi.
- **Đặt tên**: hàm là động từ, type/interface là PascalCase noun; theo đúng style
  file xung quanh (đã có ESLint + Prettier + Husky pre-commit).
- **Kiểm thử**: hàm helper thuần (không phụ thuộc DOM/API) khi thêm mới hoặc sửa
  logic quan trọng (vd matching, validation, mapping) nên có test Vitest đi kèm.
- **Không secrets**: không hardcode API key/token; dùng biến môi trường (`import.meta.env`).
- **So khớp quyền phải strict**: không thêm lại kiểu match theo
  prefix/action-word (heuristic fallback) cho permission code — chỉ so khớp
  chính xác với catalog đã khai báo tĩnh.
- **Đồng bộ tài liệu**: khi đổi endpoint path/method hoặc permission code, cập nhật
  cùng lúc `docs/api-evidence/*.md` và `docs/ARCHITECTURE.md`/`README.md` liên
  quan trong cùng PR — không để lệch tài liệu vs code.