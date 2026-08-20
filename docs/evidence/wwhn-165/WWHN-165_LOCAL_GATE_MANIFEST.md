# WWHN-165 — Local exact-SHA gate manifest (đóng gap P1 register comment 14741)

Ngày chạy: 2026-08-20 (UTC+7). Người chạy: FE1 (máy dev cục bộ, không dùng GitHub Actions).

## Pin nguồn

- Repo: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`, branch canonical: `m1`.
- **Code fix candidate: `78738f99874a7e3c674b5b3363708f29246df29f`** — giữ attempted URL khi 401 giữa phiên (`redirectToLogin` + `useLogin` đọc `?redirect=`), fail-closed route chưa khai báo trong `ROUTE_PERMISSIONS` (sentinel `UNREGISTERED_ROUTE_PERMISSION`), guard chống hồi quy no-stack-trace (`ErrorBoundary.test.tsx`), dọn `stocktake.*` khỏi contract expectation (REQ-SRS-037/DEC-NO-STOCKTAKE-001), bổ sung vocabulary 409/412/428 + open point `scope_type`, project Playwright `qa2-msedge`.
- **Gate SHA (nơi chạy toàn bộ bộ gate dưới đây): `6e4c397d81671700a6f526b51c3ddf8d2d888dc2`** — kế tiếp 78738f9, chỉ sửa 1 file test (`axios.refresh.integration.test.ts`) để khớp assertion redirect mới; do một phiên Claude song song khác phát hiện và sửa trên cùng working tree trong lúc tôi đang chạy gate (đã xác minh nội dung đúng trước khi nhận, không có xung đột logic).

## Bất biến dải commit (chống pin rot)

`78738f9..6e4c397` (1 commit): chỉ `src/shared/api/axios.refresh.integration.test.ts` (+7/-1 dòng, nới lỏng 1 assertion cho khớp hành vi `?redirect=` mới) — **0 diff** trên mọi file production code.

## Môi trường & identity

- Windows 11 (10.0.22631), Node v22.17.1, npm 10.9.2, Playwright 1.62.1.
- Chromium (bundled), Microsoft Edge thật qua `channel: msedge` (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`).
- Chạy trong **git worktree sạch** tại gate SHA (`C:/LAM_PHONG_TECH/HoaNam_FE/wt-165-gate`, `git status --porcelain` rỗng ngoài `gate-out/` tự tạo) — tree chính đang có phiên song song khác làm việc (WWHN-178, WWHN-274 responsive) nên không dùng làm identity.
- `node_modules` dùng NTFS junction từ checkout canonical (không ảnh hưởng identity nguồn).
- Input materialized (gitignored, không phải source): `.env`, `swagger-api.json` (copy từ checkout canonical theo đúng bẫy đã ghi nhận ở WWHN-325).
- Dev server riêng cổng **5199** (`npm run dev -- --host 127.0.0.1 --port 5199`) để tránh race port 5173 với phiên song song khác đang chạy gate (bẫy đã ghi nhận ở WWHN-217).
- `SOURCE_SHA=6e4c397d81671700a6f526b51c3ddf8d2d888dc2`, `VITE_APP_ENV=local-exact-sha` khi chạy Playwright (đóng dấu vào tên file evidence).

## Kết quả gate

| Gate | Lệnh | Kết quả |
|---|---|---|
| Format | `npm run format:check` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Typecheck | `npm run typecheck` (`tsc -b`) | exit 0 |
| Unit/integration | `npm run test` (vitest) | exit 0 — **98 file / 777 test PASS** (chạy 2 lượt: lượt đầu tại 78738f9 có 1 fail do assertion cũ, đã fix ở 6e4c397, lượt 2 tại 6e4c397 xanh toàn bộ) |
| Production build | `npm run build` | exit 0 |
| `npm run wwhn-165:verify` | node script | exit 0 — PASS |
| E2E WWHN-165 (auth/session) | `playwright test e2e/wwhn-165-auth-session.spec.ts --project=chromium --trace on` | exit 0 — **4/4 PASS** |
| E2E WWHN-292 (RBAC/responsive) | `playwright test e2e/wwhn-292-ui-responsive-rbac.spec.ts --project=chromium` | exit 0 — **25/25 PASS** |
| E2E WWHN-274 (a11y/browser matrix) | `playwright test e2e/wwhn-274-a11y-browser-matrix.spec.ts --project=wwhn-274-desktop-chromium --project=wwhn-274-chrome-android --project=wwhn-274-safari-ios` | exit 0 — **7 PASS / 2 skipped** (skip = keyboard test trên mobile emulation, không có physical keyboard — kỳ vọng) |
| E2E QA2 Edge thật | `QA2_EDGE=1 playwright test e2e/wwhn-165-auth-session.spec.ts e2e/auth-role-navigation-qa2.spec.ts --project=qa2-msedge` | exit 1 — **9 PASS / 2 FAIL** (2 fail = cùng gốc với dòng dưới, KHÔNG phải regression WWHN-165) |
| E2E WWHN-144/145 (role navigation) | `playwright test e2e/auth-role-navigation-qa2.spec.ts --project=wwhn-144-chromium` | exit 1 — **5 PASS / 2 FAIL** |

## Disposition 2 test FAIL (WWHN-144/145, KHÔNG thuộc phạm vi WWHN-165/166/167)

`e2e/auth-role-navigation-qa2.spec.ts`:
- `limited role menu is filtered and forbidden direct URL renders 403` (dòng 253) — assert text menu `"Tra cứu tồn & đối soát"`, nhưng label hiện tại trong `src/app/layouts/menu.tsx:155` là `"Tồn & truy vết"`.
- `BA source-port navigation renders exact screen inventory` (dòng 320) — assert text `"Wireframe mức low-fi · Nguồn BA: BRD / SRS-FRD / BPD hiện tại."` không còn khớp `DashboardPage.tsx` hiện tại.

**Xác nhận đây là drift có từ trước, không phải regression do WWHN-165 gây ra:**
`git diff 78738f9^ 6e4c397 --stat -- src/app/layouts/menu.tsx src/modules/dashboard/pages/DashboardPage.tsx e2e/auth-role-navigation-qa2.spec.ts` → **0 file thay đổi**. Hai commit của WWHN-165 (`78738f9`, `6e4c397`) không chạm menu/dashboard/spec này. Đã spawn task riêng để BA/FE xác nhận label đúng ý nghĩa nghiệp vụ rồi cập nhật spec (thuộc WWHN-144/145, ticket khác, đã Done từ trước — đây là hồi quy UI-text độc lập, cần disposition riêng).

**Ảnh hưởng tới WWHN-165/166/167**: KHÔNG. project `wwhn-144-chromium` không nằm trong `test:e2e:evidence` (script chính thức của WWHN-165) và không được `docs/evidence/wwhn-165/*` tham chiếu làm điều kiện đóng. QA2 matrix (WWHN-167) yêu cầu Chrome/Edge trên chính `wwhn-165-auth-session.spec.ts` + `wwhn-292-ui-responsive-rbac.spec.ts` — cả hai đều 100% xanh trên cả Chromium lẫn Edge thật.

## Ghi chú trung thực khác

- Lượt unit test đầu tại `78738f9` có 1/777 fail vì `axios.refresh.integration.test.ts` còn assertion cũ `toHaveBeenCalledWith("/login")` — không tương thích với hành vi `?redirect=` mới. Một phiên Claude song song khác đã tự sửa file này trên working tree chung trong lúc gate đang chạy; đã review nội dung đúng và nhận làm commit `6e4c397`, rerun toàn bộ → 777/777 xanh.
- CI GitHub Actions **không được dùng** cho gate này (quyết định `DEC-165-CI-LOCAL-01`, xem `docs/decision-records/DEC-165-CI-LOCAL-01.md`) vì quota Actions của tổ chức đã dùng hết 3000/3000 phút; mọi commit liên quan mang hậu tố `[skip ci]`.

## Disposition CI (FE165-P1)

`DEC-165-CI-LOCAL-01`: evidence gate này thay thế CI run trên GitHub Actions do quota hết. Không tái sử dụng cho commit sau — mỗi thay đổi tiếp theo trên bề mặt auth/session/RBAC phải chạy lại bộ gate này tại SHA mới, theo đúng `sourceShaPolicy` đã khai trong `WWHN-165_CLOSURE_REGISTER.json`.
