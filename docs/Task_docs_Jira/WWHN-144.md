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
