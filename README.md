# Hoa Nam Tools - Frontend

Frontend Web Admin cho hệ thống WMS Hoa Nam, xây dựng bằng React + Vite + TypeScript + Ant Design.

## Kiến trúc

Ứng dụng tuân theo `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` và requirement hiện hành trong `docs/HN_SRS_FRD_v1.12_FULL.md`. Khi tài liệu kỹ thuật cũ xung đột requirement mới hơn, phải xử lý theo source/approval hierarchy của dự án, không tự suy diễn contract.

| Tiêu chí | Giá trị hiện hành |
| --- | --- |
| Framework | React 19 + TypeScript + Vite 8 |
| UI | Ant Design 6.x |
| State management | Zustand (auth/client), TanStack Query (server state) |
| Forms | React Hook Form + Zod |
| Routing | React Router v7 |
| Testing | Vitest (unit/integration), Playwright (E2E) |
| CI Node baseline | Node.js 22 |

## Bắt đầu

### Yêu cầu

- Node.js 22 khuyến nghị để khớp CI baseline.
- Yarn theo lockfile của repository.

### Cài đặt

```bash
yarn install --frozen-lockfile
```

### Biến môi trường

Sao chép `.env.example` thành `.env` và cập nhật các giá trị phù hợp môi trường:

```bash
cp .env.example .env
```

| Biến | Mô tả | Mặc định/tham chiếu |
| --- | --- | --- |
| `VITE_APP_ENV` | Môi trường (`local`, `dev`, `uat`, `prod`, `test`) | `local` |
| `VITE_API_BASE_URL` | URL cơ sở API | `http://localhost:8080/api/v1` |
| `VITE_API_TIMEOUT_MS` | Timeout API (ms) | `10000` |
| `VITE_API_WITH_CREDENTIALS` | Gửi credential/cookie cho refresh-session | `true` (bắt buộc; runtime luôn enforce) |
| `VITE_STORAGE_URL` | URL storage (tùy chọn) | - |
| `VITE_API_HEALTH_PATH` | Health path tương đối so với `/api/v1` | `/health` → `/api/v1/health` |

Không commit secret/credential vào repository hoặc tài liệu handover. DEV/UAT/PROD phải inject `VITE_API_BASE_URL` và các origin/cookie policy tương ứng qua pipeline/deployment; không hard-code domain production trong source FE.

### Chạy phát triển

```bash
yarn dev
```

Ứng dụng mặc định chạy tại `http://localhost:5173`.

## Build / quality gates

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run health:check
npm run check:api-mapping
npm run test:e2e
```

Các script task-specific/evidence khác được định nghĩa trong `package.json`. CI trên `m1` chạy quality gates, build immutable manifest và runtime evidence theo workflow `.github/workflows/ci.yml`.

Build output chính:

- `dist/index.html`
- `dist/health.json`
- `dist/build-manifest.json`

## Cấu trúc dự án

```text
src/
├── app/                    # App shell, router, layouts, providers
│   ├── layouts/            # Shared layouts/navigation
│   ├── providers/          # Query, theme, auth providers
│   └── router/             # Route definitions, guards, access control
├── modules/                # Feature modules
│   ├── auth/               # Authentication/session
│   ├── master-data/        # SKU/Product Master và related master
│   ├── inbound/            # Inbound, receiving, putaway
│   ├── outbound/           # Outbound, matching, Packing Label, issue
│   ├── inventory/          # Inventory balance/movement/trace
│   ├── scan/               # Scan/classification
│   ├── warranty/           # Warranty/component issue
│   ├── reverse/            # Reversal/correction
│   └── reports/            # Báo cáo vận hành
├── shared/                 # Shared API, RBAC, components, hooks, types
└── assets/                 # Static assets
```

## Phạm vi nghiệp vụ MVP quan trọng

- **Authentication & Authorization**: session/JWT integration, route/action RBAC theo permission code; backend là authorization boundary cuối cùng.
- **Master Data**: SKU/Product Master, agency, defect và các master được baseline.
- **Inbound**: tạo DRAFT, scan, full Post Receipt; không partial posting.
- **Outbound**: tiếp nhận toa, scan/match đủ, Packing Label, full Post Issue; chỉ Post Issue thành công mới trừ tồn.
- **RFID**: optional theo SRS-FRD v1.12; Barcode/QR/manual fallback theo contract.
- **Inventory**: xem tồn, movement, trace; không có generic stock-edit.
- **Reversal**: correction sau Post bằng reversal append-only.
- **Warranty**: tiếp nhận/xử lý bảo hành và xuất linh kiện theo permission/business guard.
- **Reports**: báo cáo vận hành theo baseline hiện hành.

### Không thuộc MVP baseline

Không có Stocktake/kiểm kê, Stocktake Session/Snapshot/Count, variance adjustment hoặc quyền sửa tồn trực tiếp. Không thêm route/module/permission stocktake nếu chưa có Change Request được phê duyệt.

## RBAC

Canonical FE catalog đặt tại:

`src/shared/constants/wms-permissions.ts`

Nguyên tắc:

- Dùng permission code, không hard-code role name để authorize action.
- Route/menu guard chỉ là UX gate; BE phải tiếp tục enforce permission.
- Canonical key phải đối chiếu BE/OpenAPI/SRS hiện hành; alias legacy chỉ dùng compatibility, không được nâng thành contract mới.
- Direct URL hoặc API 403 phải được hiển thị đúng trạng thái no-permission/error, không biến UI disabled thành bằng chứng backend authorization.

## Tài liệu/evidence

- `docs/HN_SRS_FRD_v1.12_FULL.md` - requirement/flow baseline hiện hành.
- `docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html` - screen/UX baseline.
- `docs/HoaNam_ERD_Moi_Nhat.md` - ERD/data dictionary technical proposal.
- `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` - kiến trúc/dev guide.
- `docs/Task_docs_Jira/` - task-specific trace/evidence docs.
- `docs/Task_docs_Jira/WWHN-311.md` - frontend handover cho WWHN-311.
- `docs/evidence/` - evidence/register được task-specific verifier/CI sử dụng.

## CI/CD

Push/PR thuộc workflow hiện hành phải vượt qua các gate áp dụng như format, lint, typecheck, unit/integration test, build, health, API mapping và E2E/evidence theo scope. Khi nghiệm thu Jira, luôn dùng **exact commit SHA + exact CI run**, không dùng mô tả chung “latest m1”.

## Đóng góp

- Tuân theo branch/workflow đã được dự án phê duyệt.
- Không force-push nếu không có yêu cầu/approval rõ ràng.
- Không tạo nhánh riêng khi ticket yêu cầu sửa trực tiếp trên `m1`.
- Commit theo Conventional Commits và bảo toàn traceability Jira/task.
- Không commit secret.

## Giấy phép

Internal use only - Hoa Nam Tools

---

**Last Updated**: 2026-08-18  
**Maintained By**: FE1 Team
