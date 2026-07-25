# Review Guidelines & System Design

Repo Agent reads this file before every code review and flags any change that
violates the rules below (it cites the rule it broke).

## System design / architecture

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

## Review rules

- **No debug output**: không `console.log` trong code commit — dùng cách xử lý
  lỗi/log đã có trong `shared/api/api-error.ts` hoặc toast (`sonner`).
- **Error handling**: mọi call API qua react-query mutation/query phải xử lý
  `isError`/`onError` và hiển thị lỗi qua `getApiErrorMessage` — không nuốt lỗi.
- **Naming**: hàm là động từ, type/interface là PascalCase noun; theo đúng style
  file xung quanh (đã có ESLint + Prettier + Husky pre-commit).
- **Tests**: hàm helper thuần (không phụ thuộc DOM/API) khi thêm mới hoặc sửa
  logic quan trọng (vd matching, validation, mapping) nên có test Vitest đi kèm.
- **No secrets**: không hardcode API key/token; dùng biến môi trường (`import.meta.env`).
- **Permission matching phải strict**: không thêm lại kiểu match theo
  prefix/action-word (heuristic fallback) cho permission code — chỉ so khớp
  chính xác với catalog đã khai báo tĩnh.
- **Docs đồng bộ**: khi đổi endpoint path/method hoặc permission code, cập nhật
  cùng lúc `docs/api-evidence/*.md` và `docs/ARCHITECTURE.md`/`README.md` liên
  quan trong cùng PR — không để lệch tài liệu vs code.
