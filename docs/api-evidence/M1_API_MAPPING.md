# M1 API Mapping Evidence

Status: WWHN-29 shell/RBAC/shared UI evidence placeholder
Scope: app shell, navigation guard, 403 UX, shared component baseline

This task does not add or change concrete backend endpoint bindings. The FE surface
covered here is route/menu/action gating and shared UI behavior. Endpoint-level
mapping remains owned by module implementation tasks that wire real API services.

| Screen | UI action | Method | Path | Permission | Status |
| --- | --- | --- | --- | --- | --- |
| App shell | Authenticated route/menu guard | N/A | N/A | route permission map | No endpoint change |
| 403 UX | Block direct unauthorized route | N/A | N/A | `RequirePermission` | No endpoint change |
| Shared scan baseline | Normalize/duplicate-check scan input | N/A | N/A | page-owned action guard | No endpoint change |
