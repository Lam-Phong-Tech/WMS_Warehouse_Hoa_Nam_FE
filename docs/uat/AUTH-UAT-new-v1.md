# AUTH — UAT_HOANAM_new_v1

Source: the supplied workbook, sheet AUTH, 11 cases (10 UI + TC_VAL_01), including embedded references. This change does not mark the workbook Fixed/Pass. Tester retest is still required.

## Scope

Only authentication pages/components, login validation/completion, the initial profile-check presentation in ProtectedRoute, and related regression tests. No inventory/report data, shared form controls, shared HTTP/interceptors, RBAC rules, token/cookie storage policy, MFA verification, or backend files are changed. The kiosk exception stays unchanged.

## Case coverage and retest

| Case | FE implementation / retest focus |
| --- | --- |
| TC_UI_LOGIN_01 | Filled blue shield, crisp outline, darker than the pale access notice. |
| TC_UI_LOGIN_02 | Empty fields: dark bold labels, red leading icons and leading helper icons. Check focus and Enter submission on desktop/tablet. |
| TC_VAL_01 | `@` chooses Email validation; otherwise Username. Preserve case and password. Wrong credentials (401) appear in the pink banner below password and above forgot-password. Username end-to-end is BLOCKED by the current BE/dev contract below. |
| TC_UI_LOGIN_03 | Inline button spinner and “Đang đăng nhập…”; keep fields/layout, no overlay. Double click/Enter must send one request. |
| TC_UI_LOGIN_04 | Offline banner above fields, “Thử lại”; no queued password request and no automatic submit on reconnect. |
| TC_UI_LOGIN_05 | Timeout/cancel/invalid authenticated response: unknown result, disabled form, no repeat-login action, administrator guidance. No password/MFA request replay. |
| TC_UI_LOGIN_06 | 429 locks submission, not field editing. Use actual Retry-After (seconds or HTTP date); editing inputs or remounting must not clear a known deadline. Expiry enables a manual retry only. No fabricated attempt threshold/countdown. |
| TC_UI_LOGIN_07 | Explicit account denial: top error banner, disabled fields, cleared password, “Quay lại đăng nhập” resets the form without another request. |
| TC_UI_LOGIN_08 | Online blocked request/service failure: complete error banner and “Thử lại”; no ERR_NETWORK, HTTP/probe/transport diagnostics or raw server message on login/MFA UI. |
| TC_UI_LOGIN_09 | After password/MFA succeeds, verify profile/permissions first; show initial session-check card, then explicit confirmation with actual account/context. Start work opens the preserved destination. Logout uses the existing revocation/cache-cleanup flow. Existing one-hour idle confirmation remains. No fake active-warehouse status. |
| TC_UI_LOGIN_10 | Align applicable recovery/reset UI, inline pending buttons, “Đặt lại mật khẩu”, password confirmation/help and “Lưu mật khẩu”. Preserve email -> OTP -> verified reset_token -> reset. Username/reset-link flow is BLOCKED below; it is not relabelled as completed. |

## Backend dependencies — not implemented or simulated in FE

Read-only source inspection of WMS_Warehouse_Hoa_Nam_BE/dev:

1. `Modules/Auth/app/Http/Requests/LoginRequest.php` explicitly requires lowercase email and prohibits `username`. The UAT requires Username OR Email. The FE now validates/maps that UAT union but never guesses an email or retries with another identifier. A matching BE login contract and case-sensitivity tests are necessary before TC_VAL_01 can pass end-to-end. Uppercase Email is preserved, not silently lowercased; current BE may reject it.
2. `Modules/Auth/app/Http/Controllers/PasswordResetController.php` implements email OTP (and explicitly does not use sendResetLink); the request takes email, verification returns reset_token. The reference instead uses Username + “Gửi liên kết”. Supporting that reference requires an agreed BE reset-link/identifier contract. Keep the working OTP path until that contract is supplied; do not fake a link, alter token verification, or claim an email was sent based on UI alone.
3. The normalized AuthContext has no warehouse activity status. Do not display “Đang hoạt động” without API evidence. The suspended-warehouse reference needs an explicit backend signal and a supported status recheck; a generic timeout/403 must not be treated as suspension. A 403 profile read shows access denial, without guessing that a particular warehouse is suspended.
4. Rate-limit UI needs a readable Retry-After header. Without one, keep the current attempt flow locked and explain that the user must wait/reload; do not invent a 30/60-second unlock. On cross-origin deployments the header must be exposed by the backend/CORS configuration.

## Important distinction between cases 05 and 08

Both workbook scripts use DevTools request blocking. That alone cannot prove whether login was committed on the server. Retest 08 with an online blocked /login request/service failure. Retest 05 with an actual response timeout after submission or an invalid authenticated response. Blocking /me after a successful login is a profile/session-check failure; retry only the read, never POST /login again. There is no new login-job status API in this change.

## Verification

Related regression suites cover identity mapping, error classification, Retry-After persistence/expiry, UI banners and placement, duplicate-submit guards, unknown outcome, account denial, MFA before token publication, explicit work-session confirmation and preserved OTP/reset payloads. Fixtures are test-only, not runtime mock data, and do not use workbook credentials.

Local environment has no repository dependencies or network DNS access. Local checks completed: 19 TS/TSX files transpiled with zero syntax diagnostics; 33 dependency-free helper assertions passed; the standalone login-feedback helper passed strict TypeScript checking. These are NOT a full typecheck, production build, React/Vitest run, browser pixel comparison, or live UAT. The repository's existing CI should run on the dev push. CI outcomes and tester evidence must be reviewed before declaring Pass.
