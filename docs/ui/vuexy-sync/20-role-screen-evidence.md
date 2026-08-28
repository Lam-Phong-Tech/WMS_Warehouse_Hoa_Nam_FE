# 20 — Role/Screen Evidence (Part 4)

> Bằng chứng bao phủ role × screen × state theo mục 6 của prompt. Hai tầng:
> (1) **Unit RBAC suites** — chạy trong `yarn test` (1001+ test): `src/test/auth-security-rbac-audit.test.ts` (filterMenu/getVisibleNavGroups theo permission), `src/app/router/access.test.ts` (ROUTE_PERMISSIONS ↔ NAV_GROUPS alignment), per-module permission tests (useCan/useCanAny gating).
> (2) **E2E role-fixture suites** — mỗi spec dựng fixture role riêng qua mock `/auth/me permission_codes`, chạy trên dev build thật (chromium). Evidence PNG+JSON per-scenario nằm trong `test-results/wwhn-*/<SOURCE_SHA>/` do `captureEvidence` sinh (metadata: ticket, scenario, role, viewport, route, finalUrl, timestamp, assertions, sourceSha).

## 1. Tổng hợp lần chạy chốt (integration cuối Part 4, working tree trước checkpoint)

| Lượt | Phạm vi | Kết quả |
|---|---|---|
| Confirm 1 | `responsive-sweep` (10 viewport × 27 route + modal routes) | 19/20 xanh trong run đầy đủ; viewport 1366x768 xanh khi chạy riêng (goto treo 240s do IO máy chạy — flake hạ tầng, mục 4) |
| Confirm 2 | TOÀN BỘ project `chromium` còn lại (24 spec) `--retries=1` | **233 passed · 1 flaky (pass khi retry) · 7 skipped (env-gated) · 0 failed** |
| Confirm 3 | `wwhn-144-chromium` + 3 project a11y matrix (desktop / Chrome Android / Safari iOS) | **14 passed · 2 skipped (by-design: keyboard test chỉ desktop) · 0 failed** |

Flaky duy nhất: `wwhn-258 · ma trận vai` (pass ngay khi retry — cùng họ IO). Skipped: `warranty-flow04-live-runtime` (cần `E2E_LIVE_RUNTIME=1` + BE thật) và `wwhn-274-real-env-smoke` (cần `WWHN_274_REQUIRE_REAL_ENV=1`) — skip CÓ ĐIỀU KIỆN khai báo trong spec, không phải skip lách gate; 2 skip của a11y matrix là device-gating tường minh (`test.skip` với lý do touch-device).

## 2. Ma trận role × hành vi (E2E fixture — spec nào chứng minh gì)

| Chiều kiểm | Spec / test | Fixture roles | Trạng thái |
|---|---|---|---|
| Allowed role vào màn + thao tác | wwhn-144 (7), wwhn-178, wwhn-212, wwhn-242, wwhn-248, wwhn-258, flow04, flow06, wwhn-211, wwhn-217 | per-module manage/post/scan/pii | PASS |
| Restricted role: menu ẩn + direct URL → /errors/403 | wwhn-292 (limited role menu + direct URL fail closed), wwhn-178 (route RBAC deny), wwhn-217 (RBAC-403 router ×3 flow), flow04 (thiếu warranty.manage), wwhn-165 (limited nav filter) | permission_codes rỗng/thiếu | PASS |
| Route guard sau SEC-RBAC-01 | wwhn-212:301 route guard 403 — **fail ở baseline 0b60408, NAY XANH nhờ layout luôn render Outlet** | inventory.view thiếu | PASS (cải thiện) |
| Action hidden/disabled theo quyền | wwhn-211 (Truy vết disabled + shortcut ẩn), wwhn-212 (action guard trace), wwhn-242 (read-only không nút ghi; post role đủ lifecycle), wwhn-248 (RBAC manage), wwhn-258 (nút export/PII theo vai) | per-permission | PASS |
| API 403/401 runtime | wwhn-242 ×5 mã lỗi post; wwhn-327 (403 không số giả); wwhn-258 (403 permission-denied ≠ lỗi chung); wwhn-211/wwhn-212 (403 + retry, 401 fail-closed về login); wwhn-217 (network/retry/duplicate) | — | PASS |
| Loading / empty / partial / error / retry | wwhn-268 gallery 7 trạng thái ×3 viewport (contract `data-ui-state` WWHN-268 — PHỤC HỒI ở tầng canonical UiStateSurface/UiConfirmDialog); wwhn-248 UI-states; wwhn-211; wwhn-258 empty/error; dashboard partial payload (unit + wwhn-327) | — | PASS |
| Validation/business error | wwhn-248 transition guards (bằng chứng chẩn đoán, ngày dự kiến, cancel-reason, 409 STATE_CONFLICT); flow04 422 + field errors; wwhn-258 lý do PII <5 ký tự; wwhn-327 preset-only chặn kỳ đảo | — | PASS |
| PII masking §13.8 | wwhn-248 (masked fail-closed khi BE trả PII thô + full-view khi đủ quyền); wwhn-258 (mask bảng ngoài + modal, export mask theo quyền, lý do bắt buộc) | ±warranty.pii.view/export | PASS |
| Offline/PWA | wwhn-325-pwa-offline + wwhn-325-pwa-business-offline (mutation guard qua UI thật khi offline) | — | PASS |
| Desktop/tablet/mobile per-screen | responsive-sweep (10 viewport × toàn bộ route); ma trận riêng của 217/242/248/258/211/175/292/327 | — | PASS |
| Keyboard/a11y engine matrix | wwhn-274-a11y ×3 engine (semantics + focus hiển thị — chỉ báo focus MUI = viền notched outline, spec đo theo kênh đó); wwhn-175 keyboard dialog focus-return; UiDialog auto aria-labelledby | — | PASS |
| Cross-role navigation | wwhn-144 (7 test, project riêng, video-on) — desktop sidebar 260/main offset + mobile drawer/hamburger/Escape + MAP-01 flow | admin + hạn chế | PASS |

Backend vẫn là boundary cuối: mọi spec chỉ chứng minh hành vi FE trên mock có kiểm soát (các spec tự khai `evidenceBoundary` trong metadata; bằng chứng cưỡng chế BE nằm ở suite BE như ghi trong từng spec).

## 3. Nguồn bằng chứng chi tiết

- `test-results/wwhn-{175,211,217,242,248,258,268,274,292,325,327}/local-uncommitted/*.png|.json` — screenshot + metadata từng scenario (role/viewport/route/timestamp/assertions).
- `e2e/ui-foundation.spec.ts-snapshots/` — 2 golden catalog (desktop 1280 + mobile 375) regenerate có disposition (doc 22).
- `test-results/responsive-sweep/` — screenshot per-viewport các màn tiêu biểu.
- Video wwhn-144: `test-results/**` (project bật `video: on`).
- SOURCE_SHA trong metadata các lần chạy chốt là `local-uncommitted` (chạy trên working tree TRƯỚC checkpoint — commit checkpoint ngay sau đó chứa đúng cây nguồn này; doc 22 + gate JSON neo `input_sha`/`output_sha`).

## 4. Flake hạ tầng (không phải lỗi app — có hồ sơ)

Sau sự cố phải cài lại `node_modules` giữa integration (ghi ở doc 22), IO máy chạy (OneDrive re-sync + Vite re-optimize) làm `page.goto` đôi lúc treo >240s dưới tải song song: 4 test "fail mới" của chunk 3 pass khi chạy riêng; sweep mỗi lần treo một viewport ngẫu nhiên (trang trắng chưa render — không phải overflow); wwhn-258 flaky 1 lần pass khi retry. Xử lý bền: MODAL_ROUTES của sweep thêm wait-for-shell có điều kiện (hết chờ cứng 450ms), lượt chốt chạy `--retries=1 --workers=4`. Không có fail nào tái hiện khi chạy đơn lẻ.
