# WWHN-165 UI Field/State Matrix for BAS/BA Review

Status: `FE_PROPOSED_PENDING_WWHN-146_WWHN-147_APPROVAL`

## Login fields

| Field | Type | Required | Validation | Disabled state | Error mapping |
| --- | --- | --- | --- | --- | --- |
| `email` | email text input | Yes | valid email, trimmed | login/switch pending | 422 `errors.email` hoặc generic auth error |
| `password` | password input | Yes | non-empty, không log/echo | login/switch pending | generic credential error, không phân biệt account/password |
| submit | primary button | N/A | form valid | pending/success navigation | 401/422/5xx visible alert |

## Auth/session states

| State | Trigger | UI | Navigation | Retry |
| --- | --- | --- | --- | --- |
| bootstrap loading | rehydrate/refresh pending | Full-page loading | Giữ URL | No |
| anonymous | refresh 401/403 hoặc không session | Login page | Preserve attempted URL | Login |
| bootstrap infrastructure error | refresh network/5xx/contract invalid | API error alert | Giữ protected URL | `bootstrapAuth()` |
| profile loading | token có, `/auth/me` pending | Full-page loading | Không render shell | Automatic |
| profile error | `/auth/me` network/5xx/contract invalid | API error alert | Giữ URL | refetch `/auth/me` |
| password change required | 403 `PASSWORD_CHANGE_REQUIRED` | Change-password page | `/change-password` | Per form |
| no permission | route permission absent | No-permission page | `/errors/403` | Back/home |
| context switching | switch mutation pending | Context control disabled | Shell fail-closed after JWT change | Retry switch |
| logout pending | logout mutation | Logout item disabled | Current route until settled | N/A |
| logout settled | API success/fail | Login page | `/login` | Login |

## Role/navigation rules

- Route/menu/action visibility dùng permission code, không dùng role name.
- Array permission ở route có nghĩa OR.
- `is_super_admin=true` runtime bypass UX route guard theo policy hiện tại.
- Permission chỉ lấy từ `active_context.permission_codes`.
- Không union permission giữa available contexts.
- JWT đổi thì profile, permission và current context cũ bị thu hồi ngay.
- Direct API authorization luôn do backend enforce.

## Error copy proposed

| Scenario | Title/message |
| --- | --- |
| Refresh network/5xx | `Không thể khôi phục phiên làm việc` |
| `/auth/me` error | `Không thể tải hồ sơ và phân quyền` |
| Missing permission | `Không có quyền truy cập` |
| Login generic | `Đăng nhập thất bại` hoặc BE message đã duyệt |
| Switch context fail | `Không thể chuyển bối cảnh hoạt động, vui lòng thử lại.` |

## Approval checklist WWHN-146 BAS

- Field type/required/read-only/disabled đúng baseline.
- Loading/error/success/403 states đủ.
- Responsive behavior desktop/tablet/mobile.
- Permission/scope visibility mapping.
- Version/date/approver và traceability.

## Approval checklist WWHN-147 BA

- Label/help text/error copy.
- Login/session/switch/logout business rules.
- 401/403/409/422 mapping.
- Password-change-required behavior.
- Open points có owner/disposition.

BAS/BA phải comment approval độc lập; file này không tự chuyển trạng thái WWHN-146/WWHN-147 thành Pass.
