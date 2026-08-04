# WWHN-167 — QA2 UI Role/Navigation Matrix

Chạy trên build thật; mỗi evidence phải có filename chuẩn, env, source SHA, build ID, role, permission, viewport, browser, timestamp và result.

| ID | Scenario | Expected |
|---|---|---|
| QA2-UI-01 | Anonymous mở route protected | Redirect login, giữ intended route |
| QA2-UI-02 | Login success | Disabled/loading chống submit lặp; vào đúng route |
| QA2-UI-03 | Login error | Hiển thị error an toàn; focus/keyboard sử dụng được |
| QA2-UI-04 | Refresh session thành công | Không flash dữ liệu sai quyền; shell chỉ mở sau `/auth/me` |
| QA2-UI-05 | Refresh/session hết hạn | Dọn session/cache và redirect login; không loop |
| QA2-UI-06 | Logout | Không back-cache thấy dữ liệu cũ; route protected bị chặn |
| QA2-UI-07 | Thiếu permission | Navigation/action không hiển thị; direct route/API error hiển thị 403 đúng |
| QA2-UI-08 | `/errors/403` | Có no-permission state, không giả 404/loading vô hạn |
| QA2-UI-09 | PASSWORD_CHANGE_REQUIRED | Điều hướng change-password, không mất token trước khi hoàn tất flow |
| QA2-UI-10 | Đổi context | Menu/action/data đổi theo permission/scope mới, không dùng union quyền |
| QA2-UI-11 | API 409/422 | Conflict và field validation hiển thị đúng vị trí/copy |
| QA2-UI-12 | Responsive | Desktop 1440x900, tablet 768x1024, mobile 390x844 |
| QA2-UI-13 | Browser | Chrome và Edge bản được hỗ trợ |
| QA2-UI-14 | Accessibility cơ bản | Tab order, focus visible, Enter/Space, label/error association |

QA2 comment PASS/FAIL độc lập tại WWHN-167 và ghi blocker kèm owner/disposition.
