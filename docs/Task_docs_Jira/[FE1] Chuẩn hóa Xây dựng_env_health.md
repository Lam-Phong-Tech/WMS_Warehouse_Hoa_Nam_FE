# [FE1] Chuẩn hóa Xây dựng/env/health - WWHN-156

## Jira review comment 13962

Ngày rà soát: 2026-08-02

Kết luận reviewer: PASS có điều kiện 84/100. Phần P0/P1 trong comment:

| Sev | Vị trí | Trạng thái FE1 | Disposition |
| --- | --- | --- | --- |
| P0 | N/A | Không có P0 thuộc FE1 build/env/health | Không cần sửa code FE. Theo comment review: "Không thấy P0 thuộc FE1 build/env/health." |
| P1 | WWHN-157 QA1 smoke | Không thuộc owner FE1, nhưng FE artifact và local health evidence đã sẵn sàng để QA smoke | QA1 cần attach smoke log DEV/UAT cho FE artifact, `/health.json`, login/master API hoặc smoke path theo parent AC. FE1 cung cấp checklist và kết quả local bên dưới để QA đối chiếu. |
| P1 | WWHN-32 parent gate | Không thuộc owner FE1, nhưng FE env/build/health contract đã được chuẩn hóa ở repo | DevOps cần xác nhận environment URL, build/deploy log, config matrix, secret baseline và health/smoke pass. FE1 đã xác nhận phần frontend static health và runtime config bên dưới. |

Không comment trực tiếp lên Jira theo yêu cầu. Tài liệu này là evidence/disposition nội bộ để cập nhật PR/evidence.

## Phạm vi FE1 đã kiểm tra

### Static health contract

File nguồn: `public/health.json`

```json
{
  "status": "ok",
  "service": "wms-hoa-nam-frontend",
  "component": "frontend",
  "healthcheck": "static"
}
```

Script verify: `scripts/check-frontend-health.mjs`

Điều kiện script đang enforce:

| Hạng mục | Kết quả |
| --- | --- |
| `dist/index.html` tồn tại và không rỗng | Pass |
| `dist/health.json` tồn tại và không rỗng | Pass |
| `dist/index.html` có module entry script | Pass |
| `dist/health.json` parse được JSON | Pass |
| Health payload khớp contract FE static | Pass |

Kết quả chạy local:

```text
npm.cmd run health:check
[health] Frontend build exposes index.html and /health.json with the approved static contract.
```

### Runtime env contract

File nguồn:

| File | Vai trò |
| --- | --- |
| `.env.example` | Baseline biến môi trường local/DEV/UAT cho FE |
| `src/shared/config/env.ts` | Normalize/validate runtime env |
| `src/shared/config/env.test.ts` | Unit test cho env contract |

Biến môi trường FE đã được chuẩn hóa:

| Key | Mục đích | Ghi chú |
| --- | --- | --- |
| `VITE_APP_ENV` | `local`, `dev`, `uat`, `prod`, `test` | Validate enum, default `local` |
| `VITE_APP_TITLE` | Tên ứng dụng | Default `WMS Hoa Nam` |
| `VITE_APP_VERSION` | Version hiển thị/runtime | Default `0.0.0` nếu thiếu |
| `VITE_API_BASE_URL` | Backend base URL | Required, normalize bỏ slash cuối, chỉ nhận `http/https` |
| `VITE_API_HEALTH_PATH` | Backend health path | Default `/health`, tự thêm slash đầu nếu thiếu |
| `VITE_API_TIMEOUT_MS` | API timeout | Required positive number khi set, default `10000` |
| `VITE_API_WITH_CREDENTIALS` | Cookie credential mode | Chỉ true khi BE CORS/auth cookie cho phép |
| `VITE_STORAGE_URL` | Storage URL override | Optional, fallback theo API base URL |
| `VITE_ENABLE_ANALYTICS` | Feature flag analytics | Boolean string |
| `VITE_ENABLE_DEBUG` | Feature flag debug | Boolean string |
| `VITE_ENABLE_PERF_MONITOR` | Feature flag performance monitor | Boolean string |

Kết quả chạy local:

```text
npm.cmd run test -- src/shared/config/env.test.ts
Test Files  1 passed (1)
Tests       2 passed (2)
```

### Build/lint verification

Kết quả kiểm tra ngày 2026-08-02:

| Command | Kết quả | Ghi chú |
| --- | --- | --- |
| `npx.cmd tsc -b` | Pass | TypeScript project build pass. |
| `npm.cmd run lint` | Pass | ESLint `src/` pass. |
| `npm.cmd run health:check` | Pass | Static artifact `/health.json` pass. |
| `npm.cmd run test -- src/shared/config/env.test.ts` | Pass | Runtime env test pass. |
| `npm.cmd run build` | Blocked bởi local filesystem EPERM | Vite fail ở bước chuẩn bị output vì Windows/sandbox không cho unlink/copy trong `dist`, không phải lỗi TypeScript/env/health contract. |
| `npm.cmd run format:check` | Fail P2 ngoài phạm vi WWHN-156 | 10 file format warning, đã ghi disposition P2 bên dưới. |

Build note:

```text
npm.cmd run build
tsc -b: pass
vite build: EPERM khi thao tác với dist/assets hoặc dist/favicon.svg
```

Do đó, với phạm vi FE1 env/health:

| Gate | Trạng thái |
| --- | --- |
| TypeScript contract | Pass |
| Lint | Pass |
| Unit test env/health URL | Pass |
| Static health artifact | Pass |
| Vite write vào `dist` local sandbox | Blocked bởi quyền/lock file local, cần DevOps/owner môi trường chạy lại trên CI/runner sạch để attach deploy log |

## P1 resolution handoff

### P1 - WWHN-157 QA1 smoke

Owner theo Jira: QA1 (`WWHN-157`, assignee DT Soi). Trạng thái đọc từ Jira ngày 2026-08-02: `To Do`, chưa có comment smoke log.

FE1 handoff cho QA1:

| Smoke item | FE evidence sẵn có | QA cần attach |
| --- | --- | --- |
| FE artifact load | `dist/index.html` tồn tại và health script xác minh module entry | DEV/UAT smoke log truy cập FE URL |
| `/health.json` | `public/health.json` và `dist/health.json` khớp static contract | Log hoặc screenshot response `/health.json` trên DEV/UAT |
| Login smoke | FE đã có env `VITE_API_BASE_URL`, `VITE_API_HEALTH_PATH`, auth services và route guard | Smoke login bằng test credential qua secret chuẩn |
| Master API smoke | FE đã có API base URL và mapping docs riêng | Log master API hoặc smoke path theo parent AC |

Disposition: P1 này không phải code blocker của FE1. FE1 đã chuẩn hóa artifact/health để QA smoke; cờ chỉ được gỡ hoàn toàn khi QA1 attach smoke log DEV/UAT vào `WWHN-157` hoặc parent evidence.

### P1 - WWHN-32 parent gate

Owner theo Jira: DevOps/DO (`WWHN-32`, assignee Minh Tân Lê). Trạng thái đọc từ Jira ngày 2026-08-02: `In Progress`.

FE1 handoff cho DevOps:

| Parent gate item | FE1 status | DevOps cần xác nhận |
| --- | --- | --- |
| Environment URL | `.env.example` đã định nghĩa `VITE_API_BASE_URL` và health path | URL DEV/UAT chính thức cho FE và BE |
| Build/deploy log | `tsc`, lint, health check pass local; Vite bị local EPERM khi ghi `dist` | CI/runner sạch build/deploy log |
| Config matrix | FE env keys đã liệt kê trong tài liệu này | Matrix local/DEV/UAT/prod giá trị thật, không lộ secret |
| Secret baseline | FE không hard-code secret; credential smoke không nằm trong repo | Secret storage/rotation/least privilege |
| Health/smoke pass | Static `/health.json` contract pass local | DEV/UAT health/smoke pass evidence |

Disposition: P1 này thuộc parent gate DevOps. FE1 đã cung cấp contract và local verification; cờ chỉ được gỡ hoàn toàn khi `WWHN-32` có environment URL, build/deploy log, config matrix, secret baseline và health/smoke evidence.

## P2 disposition để tránh nhiễu CI gate

### `format:check`

Kết quả hiện tại:

```text
npm.cmd run format:check
Code style issues found in 10 files.
```

Các file warning:

```text
src/app/router/ProtectedRoute.tsx
src/modules/auth/services/auth.service.ts
src/modules/master-data/hooks/use-master-data.ts
src/modules/master-data/pages/MasterPage.tsx
src/modules/master-data/services/master-data.service.test.ts
src/modules/master-data/services/master-data.service.ts
src/modules/master-data/services/warehouse.service.ts
src/modules/putaway/pages/PutawayPage.tsx
src/modules/putaway/services/putawayService.ts
src/test/auth-security-rbac-audit.test.ts
```

Disposition: ngoài scope P0/P1 của WWHN-156. Owner đề xuất: FE owner các module tương ứng hoặc task cleanup riêng. ETA đề xuất: xử lý trước khi bật `format:check` thành CI required gate, hoặc trước merge release nếu CI đã yêu cầu.

### API mapping warning

Disposition: ngoài scope FE env/health. Nếu cần Done sạch cho parent gate, QA/DevOps/FE cần dùng test credentials từ secret đúng chuẩn để chạy live catalog/smoke; không commit credential vào repo. Khi credential chưa sẵn sàng, ghi waiver rõ ở parent evidence vì đây không phải blocker code của WWHN-156.

## Kết luận FE1

WWHN-156 không còn P0/P1 code blocker thuộc FE1 sau khi đối chiếu comment review:

| Mức | Kết luận |
| --- | --- |
| P0 | Không có P0 thuộc FE1. |
| P1 QA smoke | FE1 đã sẵn sàng artifact/health evidence; chờ QA1 attach smoke log DEV/UAT ở `WWHN-157`. |
| P1 parent gate | FE1 đã chuẩn hóa env/health contract; chờ DevOps cập nhật parent evidence ở `WWHN-32`. |
| FE verification | `tsc`, `lint`, env unit test, static health check pass. |

Không thực hiện comment trực tiếp trên Jira.
