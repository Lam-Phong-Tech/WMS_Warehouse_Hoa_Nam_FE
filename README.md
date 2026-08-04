# Hoa Nam Tools - Frontend

Frontend Web Admin cho hệ thống WMS Hoa Nam, được xây dựng bằng React + Vite + TypeScript + Ant Design.

## Kiến trúc

Ứng dụng này tuân theo hướng dẫn kỹ thuật trong `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`.

| Tiêu chí | Giá trị |
| --- | --- |
| Framework | React 19 + TypeScript + Vite |
| UI | Ant Design 5.x |
| State management | Zustand (auth), TanStack Query (server state) |
| Forms | React Hook Form + Zod |
| Routing | React Router v6 |
| Testing | Vitest (unit), Playwright (E2E) |

## Bắt đầu

### Yêu cầu

- Node.js 18+
- Yarn hoặc npm

### Cài đặt

```bash
yarn install
```

### Biến môi trường

Sao chép `.env.example` thành `.env` và cập nhật các giá trị:

```bash
cp .env.example .env
```

Các biến môi trường chính:

| Biến | Mô tả | Mặc định |
| --- | --- | --- |
| `VITE_APP_ENV` | Môi trường (`local`, `dev`, `uat`, `prod`) | `local` |
| `VITE_API_BASE_URL` | URL cơ sở API | `http://localhost:8000/api/v1` |
| `VITE_API_TIMEOUT_MS` | Timeout API (ms) | `10000` |
| `VITE_API_WITH_CREDENTIALS` | Gửi credentials với request | `false` |
| `VITE_STORAGE_URL` | URL storage (tùy chọn) | - |

### Chạy phát triển

```bash
yarn dev
```

Ứng dụng sẽ chạy tại `http://localhost:5173`.

### Build

```bash
yarn build
```

Build output nằm trong thư mục `dist/`.

### Build/Env/Health Baseline

| Công cụ | Mục đích | Lệnh |
| --- | --- | --- |
| Lint | Kiểm tra code style | `yarn lint` |
| Format | Định dạng code | `yarn format` |
| Test | Chạy unit tests | `yarn test` |
| Build | Build production | `yarn build` |
| Health check | Kiểm tra health artifact | `yarn health:check` |
| API mapping | Kiểm tra ánh xạ API | `yarn check:api-mapping` |

Frontend build exposes a static health artifact at `dist/health.json` and `dist/index.html` so the deploy pipeline can verify the frontend bundle without starting a server.

## Cấu trúc dự án

```
src/
├── app/                    # App shell, router, layouts, providers
│   ├── layouts/           # Shared layouts (SideNav, Header, Footer)
│   ├── providers/         # App providers (Query, Theme, Auth)
│   └── router/            # Route definitions and guards
├── modules/               # Feature modules
│   ├── master-data/       # SKU, Item, Physical Code management
│   ├── inbound/           # Inbound documents and receiving
│   ├── outbound/          # Outbound documents and shipping
│   ├── inventory/         # Inventory balances and movements
│   ├── scan/              # Scan and physical code classification
│   ├── stocktake/         # Stocktake sessions and counts
│   ├── warranty/          # Warranty cases and events
│   ├── reverse/           # Reversal documents
│   └── reports/           # Reports and analytics
├── shared/                # Shared utilities, components, API
│   ├── api/               # HTTP client, endpoints, interceptors
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   └── types/             # TypeScript type definitions
└── assets/                # Static assets
```

## Các tính năng chính

- **Authentication & Authorization**: Đăng nhập, refresh token, RBAC route guards
- **Master Data**: Quản lý SKU, Item, Physical Code với import Excel
- **Inbound**: Nhập hàng, quét mã, post receipt
- **Outbound**: Xuất hàng, quét mã, post issue
- **Inventory**: Xem số dư và biến động tồn kho
- **Scan**: Phân loại mã quét (duplicate, unknown, invalid)
- **Stocktake**: Kiểm kê hàng tồn kho
- **Warranty**: Quản lý phiếu bảo hành
- **Reverse**: Lập phiếu điều chỉnh ngược
- **Reports**: Báo cáo tồn kho, doanh thu

## Testing

```bash
# Unit tests
yarn test

# E2E tests
yarn test:e2e

# Coverage
yarn test:coverage
```

## Tài liệu

- `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` - Hướng dẫn kiến trúc
- `docs/WMS_FRONTEND_STANDARDIZATION.md` - Chuẩn hóa frontend
- `docs/design-system/` - Design tokens và component inventory
- `docs/evidence/` - Bằng chứng triển khai và acceptance criteria

## CI/CD

Pull request cần vượt qua:

1. Lint và format check
2. Unit tests
3. Build production
4. API mapping check
5. E2E tests (nếu có thay đổi UI)

## Đóng góp

1. Tạo nhánh feature từ `main` hoặc `m1`
2. Commit theo Conventional Commits
3. Đảm bảo tất cả checks đều pass
4. Tạo PR với mô tả rõ ràng

## Giấy phép

Internal use only - Hoa Nam Tools

---

**Last Updated**: 2026-07-31
**Maintained By**: FE1 Team
**Review Cycle**: Mỗi sprint