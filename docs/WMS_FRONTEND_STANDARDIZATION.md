# Chuẩn hóa Frontend WMS

Tài liệu này ghi lại cách repo frontend hiện tại được căn chỉnh với
`docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`.

## Phạm vi

Repository này là frontend Web Admin React/Vite/TypeScript. Các yêu cầu backend
trong hướng dẫn như module Laravel, transaction PostgreSQL, lock Valkey,
biến động tồn kho, idempotency, Postman/Newman và Docker
Compose được coi là hợp đồng API/runtime thuộc sở hữu của backend hoặc
repository nền tảng.

## Stack

| Tiêu chuẩn hướng dẫn | Tiêu chuẩn repo |
| --- | --- |
| React + Vite + TypeScript | `react`, `vite`, `typescript` |
| Ant Design | `antd`, `@ant-design/icons` |
| React Hook Form + Zod | `react-hook-form`, `zod`, `@hookform/resolvers` |
| TanStack Query | `@tanstack/react-query` |
| Zustand | `zustand` |
| React Router | `react-router-dom` |
| Vitest / Playwright | `vitest`, `@playwright/test` |

## Bố cục Nguồn

```text
src/
├── app/
│   ├── router/
│   ├── providers/
│   └── layouts/
├── modules/
│   ├── master-data/
│   ├── inbound/
│   ├── outbound/
│   ├── inventory/
│   ├── scan/
│   ├── stocktake/
│   ├── warranty/
│   ├── reverse/
│   └── reports/
├── shared/
│   ├── api/
│   ├── components/
│   ├── constants/
│   ├── hooks/
│   ├── utils/
│   └── types/
└── assets/
```

Ứng dụng không sử dụng nhóm route Next.js. Các layout dùng chung nằm dưới
`src/app/layouts`, và thành phần route nằm trong `src/app/router`.

## Ánh xạ Ngữ cảnh Giới hạn

| Ngữ cảnh giới hạn hướng dẫn | Module/đường dẫn frontend |
| --- | --- |
| MasterData | `src/modules/master-data` |
| Scan | `src/modules/scan` |
| Warehouse.Inbound | `src/modules/inbound` |
| Warehouse.Outbound | `src/modules/outbound` |
| InventoryBalance / InventoryMovement | `src/modules/inventory` |
| Stocktake | `src/modules/stocktake` |
| Warranty | `src/modules/warranty` |
| Reverse | `src/modules/reverse` |
| Report | `src/modules/reports` |
| Shared | `src/shared` |

## Hợp đồng API

Các dịch vụ frontend phải gọi API thông qua `src/shared/api/http.ts` và các
hằng số endpoint dùng chung. Envelope WMS được ưu tiên là:

```json
{
  "success": true,
  "message": "Created successfully",
  "data": {},
  "meta": {
    "request_id": "uuid",
    "timestamp": "2026-07-26T00:00:00+07:00"
  }
}
```

Lỗi nghiệp vụ nên giữ nguyên `error_code` và `errors` cấp trường để form
có thể hiển thị xác thực backend mà không cần suy luận phía client.

## Build, Env và Health

Cấu hình runtime được tập trung trong `src/shared/config/env.ts`.

| Vấn đề | Tiêu chuẩn |
| --- | --- |
| Tên môi trường | `VITE_APP_ENV` được giới hạn ở `local`, `dev`, `uat`, `prod` hoặc `test`. |
| URL cơ sở API | `VITE_API_BASE_URL` phải là URL `http/https` tuyệt đối và được tiêu thụ thông qua `runtimeConfig`, không trực tiếp trong module. |
| Health backend | `apiHealthUrl` được tạo từ `VITE_API_BASE_URL` và `VITE_API_HEALTH_PATH`; FE không tự phát minh ngữ nghĩa health backend. |
| API timeout | `VITE_API_TIMEOUT_MS` điều khiển timeout axios dùng chung. |
| Storage URL | `VITE_STORAGE_URL` là tùy chọn; đường dẫn storage tương đối dự phòng về URL cơ sở API khi không được đặt. |
| Frontend health | `public/health.json` được sao chép vào `dist/health.json`; `npm run health:check` xác minh artifact FE có thể triển khai sau khi build. |

CI phải chạy install, format check, lint, unit tests, build, frontend health
artifact check và API mapping check trước khi một nhánh được coi là có thể triển khai.

## Quy tắc Frontend

- Bảo vệ route và UI ẩn chỉ là hỗ trợ UX; backend phải thực thi RBAC và
  phạm vi dữ liệu.
- Các trang module sử dụng `shared/components` cho trạng thái loading, empty, error, table, form,
  quyền và scan.
- Bảng với tập dữ liệu lớn phải yêu cầu phân trang/lọc/sắp xếp từ backend.
- Màn hình scan phải mô hình hóa các trạng thái rõ ràng: waiting, scanned, duplicate, unknown,
  invalid, success và error.
- Trang không được tự biến đổi tồn kho cục bộ. Chỉ API post/apply/reverse backend
  mới có thể thay đổi tồn kho.

## HN-FE-001 Nền tảng FE Tái sử dụng

Truy xuất nguồn gốc:

- Nhiệm vụ Cha: WWHN-38
- Khóa tạm Cha: HN-FE-001
- Khóa tạm Epic: HN-EPIC-02
- Vai trò: FE1
- Người được gán: HN-FE-01
- Phụ thuộc: HN-UX-001, HN-FND-001
- Đầu ra: Nền tảng FE tái sử dụng

Nền tảng tái sử dụng đã được bàn giao trong repository này:

- `src/app/providers/AppProviders.tsx`: gốc provider ứng dụng duy nhất cho
  TanStack Query, Ant Design theme/locale, ngữ cảnh ứng dụng Ant Design, toast và
  ErrorBoundary.
- `src/app/router`: route được bảo vệ, RBAC cấp route, tải trang lười và
  định tuyến không có quyền.
- `src/app/layouts`: shell admin responsive với sidebar, drawer navigation,
  header, breadcrumb, footer và xử lý bootstrap profile.
- `src/modules/component-catalog/ComponentCatalogPage.tsx`: route demo đã xác thực
  tại `/component-catalog` cho BA/QA xem xét bảng dùng chung, form, modal,
  trạng thái, scan, toast, loading, empty, error, no-permission, disabled và
  confirm.
- `src/shared/store/auth.store.ts`: trạng thái phiên, token truy cập chỉ trong bộ nhớ,
  gợi ý phiên không nhạy cảm đã được persist, ngữ cảnh, mã quyền và dọn dẹp logout.
- `src/shared/api`: mở envelope API đã được phê duyệt, xử lý pagination meta,
  interceptor refresh-token, phân loại lỗi RBAC/API và trích xuất
  lỗi trường.
- `src/shared/components`: layout dùng chung, form, table, feedback, quyền,
  điều hướng, thẻ và trạng thái UI cấp trang được xuất qua barrel ổn định.

Ranh giới hợp đồng:

- RBAC trong FE chỉ dành cho UI/UX; backend vẫn là cơ quan có thẩm quyền về quyền và
  phạm vi dữ liệu.
- Xác thực nghiệp vụ và quy tắc biến đổi tồn kho không được suy luận trong FE.
  Form có thể cải thiện UX với xác thực cục bộ, nhưng lỗi API và lỗi trường
  phải được hiển thị từ hợp đồng backend.
- Bất kỳ endpoint, payload, enum hoặc mã lỗi không khớp nào phải được ghi lại như
  blocker với chủ sở hữu/ETA thay vì được vá im lặng trong UI.

Bằng chứng xác minh được ghi lại trong
`docs/evidence/HN-FE-001-REUSABLE-FE-FOUNDATION.md`.