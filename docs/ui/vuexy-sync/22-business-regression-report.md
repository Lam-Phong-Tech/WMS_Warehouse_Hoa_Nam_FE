# 22 — Business Regression Report (Part 4)

> Mục tiêu: chứng minh migrate UI KHÔNG đổi auth/session/RBAC/API/routes/business flow.
> Môi trường: local dev, Node 22, yarn 1.22; runtime pipeline Fable 5 + xhigh.

## 1. Invariants đã giữ (đối chiếu mục 3 của prompt)

| Invariant | Bằng chứng |
|---|---|
| Authentication/session/refresh | Không sửa `auth.service.ts`/`auth.store.ts`/interceptor nào; suite auth (LoginPage/ChangePassword/ForgotPassword/use-me/use-logout/switch-context) xanh nguyên trạng; E2E auth mock contract (refresh + `/auth/me`) không đổi |
| RBAC/permission/scope/guards | `ROUTE_PERMISSIONS`, `RequirePermission`, `useCan/useCanAny`, `wms-permissions.ts` không đổi; **SEC-RBAC-01 ĐÓNG** (layout luôn render `<Outlet/>` — hết mount màn ngoài guard theo `?screen=`); `auth-security-rbac-audit.test.ts` + `access.test.ts` xanh |
| API client/contract/error envelope | Không sửa `src/shared/api/**`; 2 lớp phòng thủ render THÊM (không đổi request/response): `dashboardService.normalizeDashboardKPI` (payload thiếu trường) và `NotificationBell`/`NotificationsPage` `Array.isArray(data?.data)` — antd List cũ nuốt lặng payload không phải mảng, ul/li tự dựng thì `.map` throw sập shell (phát hiện bởi E2E chunk 1, đã fix + rerun xanh); swagger pin `BE_CONTRACT_PIN` hash-verified (Part 3) |
| Routes/navigation nghiệp vụ | Route paths + permission giữ nguyên; THÊM: catch-all `*` → NotFoundPage (NAV-02, thay redirect lặng lẽ), `/component-catalog` → redirect `/ui-foundation`, nav entries `/scan` + `/pv-admin` (NAV-01 — route đã tồn tại từ trước, chỉ hiện trong menu) |
| Inbound/outbound/inventory/warranty/reversal/report/scan flows | Toàn bộ mutation/query/idempotency/If-Match/version giữ từng literal — pin tests xanh: flow06 packing-label, wwhn-195 scan-mode, wwhn-240 trace net-effect, wwhn-242 reversal evidence-gate, wwhn-258; scan-focus Annex D (ScanInput) không đổi |
| PII masking (SRS §13.8) | `warrantyPiiText`/`canViewPii` byte-identical (agent WarrantyDetailModal xác nhận); testids `report-pii-reason`/`report-export-*` giữ; PII gating `warranty.pii.view/export` không đổi |
| Data/seed/PWA/offline | Không sửa; `pwa-status.css` chỉ đổi 2 hex → var token (giá trị cùng màu trắng) |
| CI/env/deploy separation | Không đổi file CI/env; DELIVERY_MODE=COMMIT_LOCAL_CHECKPOINT, không push/PR/merge/deploy |

## 2. Kết quả test toàn cục (sau wave migrate + integration cleanup)

| Lệnh | Kết quả |
|---|---|
| `yarn test` (vitest, full) | **137 files / 1001 tests PASS** (exit 0) |
| `npx tsc --noEmit -p tsconfig.app.json` | 0 lỗi |
| `yarn lint` | 0 error (warnings tồn tại từ trước, không tăng: `react-hooks/set-state-in-effect`, `exhaustive-deps` — pattern có sẵn được giữ nguyên logic) |
| `yarn format:check` | PASS (sau khi prettier-format các file wave migrate) |
| `node scripts/check-ui-architecture.mjs` | PASS |
| `node scripts/check-ui-tokens.mjs` | PASS |
| `node scripts/check-ui-styles.mjs` | PASS |
| `yarn build` + health check | Xem doc 21 (điền cùng E2E) |

Suite theo module trong wave (báo cáo cụm A–H): dashboard/notifications/audit 23/23 · pv/auth/errors 63/63 · iam 3/3 · master-data 31/31 · inbound/putaway 60/60 · outbound/scan 16/16 (+flow06/wwhn-195 52/52) · warranty 50/50 · inventory 11/11 + trace 12/12 · reverse/reports 143/143. **Không cụm nào phải sửa selector test nghiệp vụ** trừ các mục trong ledger dưới.

## 3. Ledger sửa test có chủ đích (drift-repair & migration-mechanics)

Nguyên tắc: chỉ sửa test khi (a) test pin markup cũ đã thay bằng canonical tương đương, hoặc (b) drift từ 2 commit `[skip ci]` tiền-pipeline (5df4f21, a908c42) — đã verify FAIL tại input SHA trước khi sửa (Part 2–3). Không sửa test để che regression.

| Test | Loại | Nội dung | Ngữ nghĩa nghiệp vụ |
|---|---|---|---|
| `src/test/ui-foundation/theme-adapter-parity.test.ts` | cleanup | GỠ describe "shim tương thích" — 2 shim `@/app/theme`, `@/app/mui-theme` đã XOÁ (consumer=0, đúng kế hoạch ghi trong shim); invariant một-nguồn-theme vẫn do provider-uniqueness + ui:architecture giữ | không đổi |
| `src/modules/putaway/components/TraySelectionGrid.test.tsx` | mechanics | import `muiTheme` đổi từ shim sang `@/shared/ui/theme` (cùng object) | không đổi |
| `src/modules/audit-logs/.../AuditLogsPage.test.tsx` | mechanics (cụm A) | 2 assertion STT `getByText("1"/"2")` scope vào `within(table)` — antd Pagination cũ bị stub trong setup, UiPagination render nút trang "1" thật gây trùng text | không đổi |
| `src/modules/master-data/pages/MvpMasterScreens.test.tsx` | mechanics (P4a) | bọc render trong `MemoryRouter` — screens đọc `useSearchParams` cho deep-link `?screen=` sau khi gỡ bypass layout | không đổi |
| `src/app/layouts/SideNav.test.tsx`, `src/app/router/access.test.ts`, `src/test/auth-security-rbac-audit.test.ts` | mechanics (P4a) | trỏ sang nav-data.ts (nguồn nav mới NAV-01): `matchesPath`/`getBreadcrumbTrail`/`getVisibleNavGroups` — thay menu.tsx đã xoá | không đổi (RBAC semantics giữ, case mở rộng) |
| `src/shared/components/actions/action-standard.test.ts` | cleanup (cụm A) | gỡ allowlist entry DashboardPage (đã hết Button trần) — allowlist CHỈ GIẢM | siết chặt hơn |
| `e2e/auth-role-navigation-qa2.spec.ts` (wwhn-144) | mechanics (P4a) | locator `.hn-mvp-*` → `main`/testid `app-sidebar`; test 337 viết lại theo contract MAP-01 hiện tại (heading "Tổng quan kho", cột "sắp xếp theo SKU") — wireframe cũ đã thay | hành vi user-visible tương đương, đã rà từng assertion |
| `e2e/responsive-sweep.spec.ts` | mechanics (integration) | assertion "nav visible mọi viewport" cập nhật theo shell P4a: ≥980 đòi `primary-navigation`, <980 đòi `mobile-nav-toggle` (nav trong Drawer — hành vi drawer đã kiểm ở wwhn-144 mobile branch); check overflow/title/modal giữ nguyên | contract responsive MỚI có chủ đích của shell |
| Golden `ui-foundation-catalog(.mobile).png` | disposition | regenerate sau CSS teardown: container catalog rộng 906→936px (padding lớp wireframe bị xoá), nội dung component không đổi — đã xem ảnh actual desktop + mobile trước khi update (render đầy đủ, không vỡ khối nào) | thẩm mỹ khung, không nghiệp vụ |
| Drift `[skip ci]` (fix tại Part 2–3, giữ nguyên ở Part 4) | drift-repair | LoginPage placeholder `your@gmail.com`; WarrantyPage nút "Sửa"; wwhn-242 evidence-gate (mock attachments PROVIDED + waitFor enabled + a11y `aria-labelledby` thật) | đã verify fail-at-input-SHA |

## 3b. Regression THẬT do wave migrate — phát hiện bởi E2E, đã sửa trong integration

Quy trình: chạy 6 spec QA2 module ở cây hiện tại (60 fail) và ở worktree input SHA 0b60408 (49 fail) → diff tập test fail. Delta (fail mới) = regression thật của Part 4; phần trùng = drift có sẵn (mục 3c).

| Regression | Nguyên nhân | Fix |
|---|---|---|
| Badge chuông hiện chữ "NaN" (mọi trang authenticated khi payload unread-count lỗi) | `Math.max(0, undefined) = NaN` tại notification.store; `?? 0` ở Bell không chặn NaN | Chuẩn hoá `Number.isFinite` tại store setter + render Bell |
| Topbar tràn ngang viewport hẹp khi tên user dài (wwhn-242 REV-00 390x844) | flex `min-width:auto` — tên trong UserMenu không co, đẩy scrollWidth > innerWidth | `minWidth: 0` cụm phải topbar + `UserMenu compact={!isDesktop}` (mobile chỉ avatar) |
| NotificationBell crash `items.map is not a function` (sập cả shell qua ErrorBoundary) | ul/li tự dựng thay antd List — List cũ nuốt payload không phải mảng | `Array.isArray(data?.data)` guard (Bell + NotificationsPage) |
| wwhn-292 "authenticated shell responsive" ×10 | spec pin shell wireframe cũ (`.hn-mvp-aside` fixed 300px) — shell UiAppShell là thay đổi CÓ CHỦ ĐÍCH của Part 4a | cập nhật spec theo contract mới (260px grid / hamburger <980), cùng ngôn ngữ wwhn-144 |

Đối chứng: sau 3 fix code + 1 spec-refresh, toàn bộ delta về 0 (wwhn-242 :400/:499 8/8 xanh; chunk foundation+sweep 27/27). Một test route-guard 403 (wwhn-212:301) fail ở baseline nay TỰ XANH nhờ đóng SEC-RBAC-01.

## 3c. Drift E2E có sẵn tại input SHA (48 test / 6 spec QA2)

48 test fail NGAY TẠI 0b60408 (bằng chứng: worktree run) — hệ quả 2 commit [skip ci] tiền-pipeline đổi wording/aria (2ad8aa7 i18n reversal, 024f578 dashboard operator wording, chuỗi "Import Excel"→"Nhập từ Excel"…) mà không cập nhật spec. Xử lý: sửa spec về contract hiện tại theo doctrine (không nới ngữ nghĩa RBAC/PII/error-code; nghi bug thật phải báo cáo, không che). Kết quả cuối: **178 10/10 · 212 8/8 · 242 25/25 · 258 11/11 · 292 37/37 · 327 9/9**. Bảng repair chính:

| Spec | Assertion cũ → mới | Lý do |
|---|---|---|
| 178 | nút `/Import Excel/` → text hiện tại "Nhập từ Excel" (regex khớp qua i18n runtime); endpoint-pin thêm `/notifications(/unread-count)?` | i18n cũ; traffic shell NotificationBell trên mọi route (vẫn trong swagger pin) |
| 212 | selector InventoryPage theo UiTabs/UiSelect/RDT | agent sửa trước khi bị dừng; 8/8 |
| 242 | `openDetail`: title "Chi tiết hoàn đảo"→"Chi tiết phiếu điều chỉnh"; nút `/Mở/`→`"Mở"` exact (hamburger "Mở menu" của shell mobile nuốt match lỏng); `/Post reversal/`→`/Hoàn tất điều chỉnh/`; confirm title/body theo UiDialog hiện tại; `toHaveCount(2)`→`(1)` (MUI aria-hidden nền — cải thiện a11y); mã guard thô `DOWNSTREAM_CONSUMPTION_EXISTS`→"Đang bị chặn bởi nghiệp vụ liên quan" (định hướng gỡ thuật ngữ dev khỏi operator UI); mock THÊM `/attachments` evidence PROVIDED (DocumentEvidenceGuard a908c42 — cùng họ drift unit đã sửa); `input[role=spinbutton]`→`getByRole("spinbutton")` | i18n + evidence-gate + shell mobile |
| 258 | thêm bước chọn tab "Báo cáo vận hành" (ReportsPage mặc định tab thị trường); `selectWarrantyTab` bỏ nhánh rc-tabs "more" (UiTabs scrollable); placeholder "SKU / model"→"SKU / mẫu sản phẩm"; fixture `summary.total_cases`→`summary.total/processing/...` (contract BaM1 hiện tại); PII mask assert chuyển vào modal "Xem chi tiết dòng báo cáo" (bảng ngoài không còn cột PII — mask vẫn bắt buộc, thêm assert "N*** V*** A***"); mock THÊM `GET /reports/export/{id}` READY (flow job-poll 27/08); note export-mask theo wording banner mới | cấu trúc màn reports + contract export mới |
| 292 | test :252 chuyển từ /component-catalog (redirect) sang Foundation Catalog anchors tiếng Việt; :606 label nav "Danh sách phiếu Reversal"→"Danh sách phiếu điều chỉnh tồn kho"; block shell :408 viết lại theo UiAppShell (260px grid / hamburger <980, topbar h2 giữ "Bản đồ màn hình & phạm vi") | Part 4a shell + catalog golden |
| 327 | thông điệp quyền/lỗi theo wording operator hiện tại; region "KPI vận hành"→"Chỉ số vận hành"; test reversed-period viết lại theo control preset-only (BA 2026-08-27 — không thể nhập kỳ đảo; assert mọi request from≤to) | 024f578 + a908c42 |

Semantics giữ nguyên 100%: RBAC/fail-closed, 403/409/412/422/428, PII mask (bảng + modal + export), evidence gate, append-only/no-write, idempotency, endpoint pin.

**Đợt 2 (chunk 3+4 — 13 spec còn lại).** Baseline worktree 0b60408: 36+? fail có sẵn; delta hiện tại chỉ 4 test và CẢ 4 pass khi chạy riêng (flake compile-chunk lần đầu dưới tải song song — không phải regression). Repair chính (cùng doctrine):

| Spec | Nội dung repair | Kết quả |
|---|---|---|
| flow06-report-docs | thêm bước chọn tab "Báo cáo vận hành"; "Packing Label"→"Nhật ký nhãn đóng gói"; placeholder as-of; expandable row/cột metadata (Phiên bản, Đã đối chiếu, máy in/người in, reconciliation) → modal "Xem" (PRIMARY_REPORT_FIELDS); NOT_APPLICABLE→"Không áp dụng"; "Đã match"→"Đã đối chiếu"; "Đã post"→"Đã ghi nhận"; note as-of "sổ ledger"→"sổ tồn kho"; mock thêm GET /reports/export/{id} | 5/5 |
| wwhn-211 | "MATCH"→"Khớp" (RECONCILE_STATUS_LABELS); tab "Lịch sử dịch chuyển"→"Lịch sử biến động"; bảng biến động 5-cột (mã movement → chứng từ nguồn IN-*); nút "Trace"→"Truy vết" exact; TraceModal title bỏ "(TRACE-01)"; empty-state không render `<table>` (RDT) | 9/9 |
| wwhn-217 | helper `expectDataSurface` (≥768 `<table>`, <768 MuiCard — contract RDT); click "Mở/Chi tiết" scope vào `main` (tránh hamburger) | 20/20 |
| wwhn-248 | "Mở"→"Sửa" exact; row-click mở luôn modal; `.ant-modal/.ant-select` → role dialog (aria-label) + combobox/option MUI; label MUI notched-outline nhân đôi → `.first()`; note TEMP_ONLY theo boundary-rewrite ("item"→"sản phẩm"); 409 = toast + modal giữ mở (chuẩn hoá toast a908c42); guard mới "Ngày dự kiến sửa xong" phải điền | 12/12 |
| wwhn-175 + wms-runtime + wwhn-274-signoff | login h1 "Đăng nhập hệ thống"; input theo placeholder (UiFormText không phát name attr); catalog cũ → Foundation Catalog anchors (redirect /ui-foundation) | 7/7 · pass · pass |
| wwhn-165 / wwhn-325-business-offline / flow04-live | nhóm nav bỏ tiền tố "05 · "; placeholder login cũ "admin@gmail.com hoặc admin" → "your@gmail.com" | pass |
| warranty-flow04-evidence | "Mở"→"Sửa"; mã tạm xem trong modal chi tiết; phone client-guard 10 số (điền hợp lệ để BE 422 đến được UI); "Tệp đính kèm"→"Ảnh & video"; "Tạo phiếu DRAFT"→/Tạo phiếu (DRAFT\|nháp)/ (INLINE_TOKEN_LABELS rewrite) | 4/4 |
| wwhn-268 | trigger "Confirm action"→"useUiConfirm()"; PHỤC HỒI hợp đồng WWHN-268 Ở TẦNG CANONICAL (không nới spec): UiStateSurface phát `data-ui-state` (no-permission→permission-denied), UiConfirmDialog phát hook "confirm", catalog demo phát "disabled"/"success" + toast success thật sau Đồng ý | 21/21 |

Thay đổi src trong đợt này (đều là PHỤC HỒI contract WWHN-268 lên foundation, không đổi nghiệp vụ): UiStateSurface + UiConfirmDialog + FoundationCatalogPage (hooks + toast demo). Unit 74/74 + goldens ui-foundation 7/7 xanh lại sau thay đổi.

## 4. Thay đổi hành vi user-visible có chủ đích (không phải regression)

1. **404**: URL sai hiển thị trang 404 (trước: redirect lặng lẽ về dashboard) — NAV-02.
2. **Nav**: `/scan`, `/pv-admin` xuất hiện trong sidebar cho role đủ quyền (trước: chỉ vào bằng URL) — NAV-01; sidebar mặc định mở tất cả nhóm (Vuexy expand-all).
3. **Copy affordance**: antd `Text copyable` (hover icon) → `ActionIconButton kind="copy"` hiện rõ + toast/clipboard.
4. **Dấu trang antd Pagination "Tổng …"**: giữ nguyên wording qua `UiText` cạnh `UiPagination` (không mất thông tin).
5. **Expandable row** (2 chỗ): bảng "Hàng thực nhận theo SKU" (inbound) bỏ expand — cùng dữ liệu vẫn ở bảng "Mã đã quét" ngay dưới; Lịch sử nhập/xuất (reports) chuyển expand vào modal chi tiết. Đã ghi chú tại chỗ + bàn giao.
6. **Autocomplete → select** ở 4 chỗ (mất typeahead, giữ chức năng chọn) — tồn dư có chủ đích, xem doc 19 mục Tồn dư.
7. **Dialog dividers** mất ở một số dialog (thẩm mỹ).
8. Control height chuẩn 38px thay hack 35px; radio thay ToggleButton (semantics giữ, arrow-key native).

Không phát hiện regression nghiệp vụ nào trong 1001 unit test + pin suites; E2E xem doc 20/21.

## 5. Sự cố môi trường trong integration (hồ sơ)

Khi dọn worktree baseline (dùng để chứng minh fail-at-input-SHA), lệnh xoá đã đi xuyên junction `node_modules` và xoá một phần `node_modules` THẬT của repo (chỉ dependencies — gitignored; source/lockfile không đổi, `git status` xác nhận). Khắc phục: `yarn install --frozen-lockfile` → tsc 0 lỗi, unit foundation 40/40 ngay sau đó. Hệ quả phụ: OneDrive re-sync + Vite re-optimize làm các lượt E2E sau đó chậm (10.9m → 17-18m) và sinh flake `page.goto` treo — đã ghi ở doc 20 §4, xử lý bằng wait-for-shell + retries; không ảnh hưởng kết quả cuối.

## 6. Số liệu chốt (working tree trước checkpoint Part 4)

| Lệnh | Kết quả |
|---|---|
| `yarn test` (full unit, chạy lại cuối) | xem dòng cập nhật ở §2 — 137 files / 1001 tests PASS (lượt giữa integration) và PASS lại ở lượt chốt |
| E2E chromium (trừ sweep, `--retries=1`) | 233 passed · 1 flaky-pass · 7 skipped (env-gated) · 0 failed |
| E2E responsive-sweep | 19/20 full-run + 1366x768 solo pass (flake IO doc 20 §4) |
| E2E wwhn-144 + a11y matrix (4 projects) | 14 passed · 2 skipped (device-gating tường minh) · 0 failed |
| Guards ui:architecture / ui:tokens / ui:styles | PASS |
| `yarn build` + `yarn health:check` | PASS |
| `yarn lint` / `yarn format:check` | 0 error (44 warning tồn tại từ trước, họ `set-state-in-effect`/`exhaustive-deps`) / PASS |
