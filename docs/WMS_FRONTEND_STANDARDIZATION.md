# WMS Frontend Standardization

This document records how the current frontend repo is aligned with
`docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`.

## Scope

This repository is the React/Vite/TypeScript Web Admin frontend. Backend
requirements in the guide such as Laravel modules, PostgreSQL transactions,
Valkey locks, inventory movement, idempotency, Postman/Newman, and Docker
Compose are treated here as API/runtime contracts owned by the backend or
platform repositories.

## Stack

| Guide standard | Repo standard |
| --- | --- |
| React + Vite + TypeScript | `react`, `vite`, `typescript` |
| Ant Design | `antd`, `@ant-design/icons` |
| React Hook Form + Zod | `react-hook-form`, `zod`, `@hookform/resolvers` |
| TanStack Query | `@tanstack/react-query` |
| Zustand | `zustand` |
| React Router | `react-router-dom` |
| Vitest / Playwright | `vitest`, `@playwright/test` |

## Source Layout

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

The app does not use Next.js route groups. Shared layouts live under
`src/app/layouts`, and route composition lives in `src/app/router`.

## Bounded Context Mapping

| Guide bounded context | Frontend module/path |
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

## API Contract

Frontend services must call APIs through `src/shared/api/http.ts` and shared
endpoint constants. The preferred WMS envelope is:

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

Business errors should preserve `error_code` and field-level `errors` so forms
can render backend validation without client-side guessing.

## Build, Env, And Health

Runtime configuration is centralized in `src/shared/config/env.ts`.

| Concern | Standard |
| --- | --- |
| Environment name | `VITE_APP_ENV` is restricted to `local`, `dev`, `uat`, `prod`, or `test`. |
| API base URL | `VITE_API_BASE_URL` must be an absolute `http/https` URL and is consumed through `runtimeConfig`, not directly inside modules. |
| Backend health | `apiHealthUrl` is composed from `VITE_API_BASE_URL` and `VITE_API_HEALTH_PATH`; FE does not invent backend health semantics. |
| API timeout | `VITE_API_TIMEOUT_MS` controls the shared axios timeout. |
| Storage URL | `VITE_STORAGE_URL` is optional; relative storage paths fall back to the API base URL when unset. |
| Frontend health | `public/health.json` is copied to `dist/health.json`; `npm run health:check` verifies deployable FE artifacts after build. |

CI must run install, format check, lint, unit tests, build, frontend health
artifact check, and API mapping check before a branch is considered deployable.

## Frontend Rules

- Route guards and hidden UI are UX aids only; backend must enforce RBAC and
  data scope.
- Module pages use `shared/components` for loading, empty, error, table, form,
  permission, and scan states.
- Tables with large datasets must request pagination/filter/sort from backend.
- Scan screens must model clear states: waiting, scanned, duplicate, unknown,
  invalid, success, and error.
- Pages must not mutate inventory locally. Only backend post/apply/reverse APIs
  can change stock.

## HN-FE-001 Reusable FE Foundation

Traceability:

- Parent Task: WWHN-38
- Parent Temp Key: HN-FE-001
- Epic Temp Key: HN-EPIC-02
- Role: FE1
- Assignee Placeholder: HN-FE-01
- Dependencies: HN-UX-001, HN-FND-001
- Output: Reusable FE Nen tang

Reusable foundation delivered in this repository:

- `src/app/providers/AppProviders.tsx`: single application provider root for
  TanStack Query, Ant Design theme/locale, Ant Design app context, toast, and
  ErrorBoundary.
- `src/app/router`: protected route, route-level RBAC, lazy page loading, and
  no-permission routing.
- `src/app/layouts`: responsive admin shell with sidebar, drawer navigation,
  header, breadcrumb, footer, and profile bootstrap handling.
- `src/modules/component-catalog/ComponentCatalogPage.tsx`: authenticated demo
  route at `/component-catalog` for BA/QA review of shared table, form, modal,
  status, scan, toast, loading, empty, error, no-permission, disabled, and
  confirm states.
- `src/shared/store/auth.store.ts`: session state, memory-only access token,
  persisted non-sensitive hints, context, permission codes, and logout cleanup.
- `src/shared/api`: approved API envelope unwrap, pagination meta handling,
  refresh-token interceptor, RBAC/API error classification, and field error
  extraction.
- `src/shared/components`: shared layout, form, table, feedback, permission,
  navigation, card, and page-level UI states exported through a stable barrel.

Contract boundaries:

- RBAC in FE is for UI/UX only; backend remains the authority for permission and
  data scope.
- Business validation and inventory mutation rules are not inferred in FE.
  Forms may improve UX with local validation, but API errors and field errors
  must be displayed from the backend contract.
- Any endpoint, payload, enum, or error-code mismatch must be recorded as a
  blocker with owner/ETA instead of being silently patched in the UI.

Verification evidence is recorded in
`docs/evidence/HN-FE-001-REUSABLE-FE-FOUNDATION.md`.
