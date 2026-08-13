# Khắc phục lỗi UI responsive/RBAC — compatibility evidence pointer

Nguồn canonical:

- `docs/Task_docs_Jira/WWHN-144.md`
- `docs/Task_docs_Jira/WWHN-156.md`
- `e2e/wms-runtime-evidence.spec.ts`
- `e2e/auth-role-navigation-qa2.spec.ts`

File này giữ tương thích cho gate `HN-UAT-003` và trace `WWHN-78`; không thay thế QA/UAT sign-off độc lập.

## Defect/evidence matrix

| Severity | Module/route | Role/account | Viewport | Before evidence | After evidence bắt buộc |
| --- | --- | --- | --- | --- | --- |
| P0/P1 | Auth và shared layout routes | anonymous/limited/admin | desktop, tablet, mobile | before/after defect reference tại WWHN-78 | screenshot/video đúng source SHA, build, browser và environment |
| P1 | `/master-data` và `/errors/403` | limited role không có permission | desktop, tablet, mobile | RBAC route/action gap | direct URL deny, 403 UI và backend authorization evidence độc lập |
| P2 | Shared UI state catalog | QA account | desktop, tablet, mobile | thiếu state coverage | loading, empty, error, success, disabled và confirm state |

## Closure boundary

- FE controlled evidence chứng minh rendering, responsive và route guard.
- Backend direct API 403/data-scope do BE/QA thực thi độc lập.
- QA2 phải attach screenshot/video và kết luận pass/fail trên exact build; file này không tự nhận approval.
