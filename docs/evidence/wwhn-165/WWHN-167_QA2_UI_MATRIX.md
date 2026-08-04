# WWHN-167 QA2 UI Role/Navigation Retest Matrix

Status: `READY_FOR_QA2_EXECUTION`  
Task: WWHN-167  
Final owner: QA2  
Environment: approved DEV/UAT build

## Browser/viewport matrix

| Browser | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Chrome current enterprise version | 1440x900 | 1024x768 | 390x844 |
| Edge current enterprise version | 1440x900 | 1024x768 | Responsive emulation 390x844 |

Controlled CI chạy Chromium. Edge/UAT browser evidence vẫn là independent QA2 gate.

## Test cases

| ID | Scenario | Expected |
| --- | --- | --- |
| QA2-LOGIN-001 | Truy cập protected URL khi anonymous | Redirect login và giữ attempted URL |
| QA2-LOGIN-002 | Login loading | Form disabled, không double-submit, loading copy rõ |
| QA2-LOGIN-003 | Login 422 | Error visible, submit re-enabled, không lộ password |
| QA2-LOGIN-004 | Login một context | Vào attempted URL, chờ `/auth/me` trước shell |
| QA2-LOGIN-005 | Login nhiều context switch success | Chỉ mở shell sau token context cuối |
| QA2-LOGIN-006 | Login nhiều context switch fail | Giữ login, không render shell/menu cũ |
| QA2-SESSION-001 | F5 với refresh session hợp lệ | Khôi phục phiên, không flash login |
| QA2-SESSION-002 | Refresh 401/403 | Xóa session và về login |
| QA2-SESSION-003 | Refresh 503/network | Fail-closed retry state, URL protected giữ nguyên |
| QA2-SESSION-004 | Đổi context | Menu/action/data scope cập nhật, không flash quyền cũ |
| QA2-LOGOUT-001 | Logout success | Token/cache/context clear, về login |
| QA2-LOGOUT-002 | Logout API lỗi | Local state vẫn clear do `onSettled` |
| QA2-RBAC-001 | Role đủ quyền | Menu + direct route accessible |
| QA2-RBAC-002 | Role thiếu quyền | Menu hidden, direct route `/errors/403` |
| QA2-RBAC-003 | Permission thay đổi sau switch | Quyền context cũ biến mất ngay |
| QA2-RBAC-004 | Super admin | Access theo `is_super_admin` runtime |
| QA2-A11Y-001 | Keyboard login | Tab order, Enter submit, visible focus |
| QA2-A11Y-002 | User menu | Enter/Space mở dropdown, logout accessible |
| QA2-RESP-001 | Desktop | Không horizontal overflow ngoài table chủ đích |
| QA2-RESP-002 | Tablet | Drawer/header/content không overlap |
| QA2-RESP-003 | Mobile | Form, drawer, 403, error state usable |

## Evidence filename

`WWHN-167_<test-id>_env-<env>_build-<build>_sha-<sha>_role-<role>_viewport-<viewport>_browser-<browser>_<timestamp>.<ext>`

## Evidence checklist

- Screenshot hoặc video bắt đầu từ URL và role setup.
- Network log cho login/refresh/me/logout và error response liên quan.
- Source SHA + deploy/build ID cùng WWHN-166.
- Viewport/browser/version.
- Expected/actual/pass-fail.
- Defect ID nếu fail.
- Không dùng blob URL không filename.

## Pass rule

WWHN-167 chỉ Pass khi các scenario applicable chạy trên UAT build thật, Chrome + Edge desktop, đủ desktop/tablet/mobile, và không còn blocker P0/P1 chưa có disposition.
