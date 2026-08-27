# 09 — Remediation Architecture Plan (đầu vào cho Prompt 2)

Ngày: 2026-08-27 · Input SHA: `a908c420663270d783a34fd378689f7940377c85`
Nguyên tắc: thay NGUỒN thay vì thêm LỚP (RC-03); nhân bản pattern hợp nhất đã thành công (icons/toast/actions — wrapper + test enforce); giữ nguyên hợp đồng state của SRS Annex D (skeleton, confirm stock-effect, scan-focus, inline error + request_id).

## Phase A — Decision Gate (điều kiện mở Prompt 2, KHÔNG code)

| # | Quyết định | Options | Đề xuất của audit |
|---|---|---|---|
| A1 (=BC-01) | Nguồn Vuexy chuẩn | (a) cung cấp licensed source; (b) phê duyệt design-language parity theo hệ X | (b) — tiền lệ Mini App, không rủi ro license; nếu chọn (a) chạy lại readiness |
| A2 (=BC-02) | CR đổi baseline thị giác từ BA-wireframe sang Vuexy/X | approve / reject | approve có chữ ký PM/PO/BA (đặc biệt: sidebar tối → sáng) |
| A3 (=BC-03) | Chốt 3 token lệch giữa hệ X và live Vuejs demo | danger `#EA5455` vs `#FF4C51`; primary-strong `#5E54D8` vs `#675DD8`; secondary bổ sung `#808390`? | Theo hệ X (`#EA5455`, `#5E54D8`) để Web đồng bộ Mini App; thêm secondary `#808390` |
| A4 (=BC-04) | Retire hệ warm P0 (`design-tokens.ts` + `hoa-nam-wireframe.css` + Be Vietnam Pro) | retire / giữ | retire (43/60 class chết, nguồn gốc doc không tồn tại) |
| A5 | Engine đích | MUI 9 (giữ antd tạm cho Table/DatePicker/Scan) / quay lại antd thuần | MUI 9 — 80% trang đã theo hướng này; antd rút dần theo Phase D |
| A6 | SEC-RBAC-01 xử lý ở đâu | ticket riêng trước Prompt 2 / gộp vào Phase C (shell) | ticket riêng ngay (an toàn hơn), Phase C xác nhận đã gỡ |

## Phase B — Token foundation (Prompt 2 thi hành, thứ tự bắt buộc)

1. **Tạo 1 nguồn token vật lý**: `src/shared/design-system/tokens.css` (`:root { --wms-* }`) + `src/shared/design-system/tokens.ts` (TS mirror cùng giá trị, export cùng tên) — copy đúng bộ `--wms-*` của Mini App `app.scss:5-47` (đã chốt qua A3), bổ sung: `--wms-secondary`, thang z-index đặt tên (`--wms-z-header/sidebar/modal/toast/pwa`), thang radius 3 bậc, control height (38 desktop/44 touch), breakpoints hợp đồng (576/768/980/1280).
2. **Trỏ mọi consumer về nguồn đó** (không consumer nào giữ literal):
   - `src/app/theme.ts` (antd themeConfig) đọc từ tokens.ts — antd v6 vẫn cần cho phần chưa migrate;
   - `src/app/mui-theme.ts` đọc từ tokens.ts (palette/shape/typography/breakpoints);
   - `src/shared/components/charts/chart-theme.ts`, `src/shared/theme/actionIconColors.ts` đọc từ tokens.ts (xoá hex chép tay — RC-04);
   - font: Public Sans system-preferred theo pattern X (`app.scss:59`), KHÔNG Google Fonts render-blocking; gỡ link Inter khỏi `index.html:16-17` và `@import` Be Vietnam Pro (`hoa-nam-wireframe.css:1`).
3. **Dọn provider** (RC-05): xoá 34 re-wrap `<ThemeProvider theme={muiTheme}>` thừa (danh sách 06 §3), giữ root AppProviders + 2 ngoại lệ portal; xoá 10 block sx `height: 35` (CSS-15) — đưa về theme.
4. **Guard chống tái phát**: ESLint `no-restricted-syntax` cấm hex literal ngoài `design-system/`; test kiểu `action-standard.test.ts` cho token (không import `design-tokens.ts` cũ, không import `@ant-design/icons`).
5. **Motion**: giữ kiến trúc hiện tại (đã đúng mẫu), map số về contract X nếu A3 chốt (140/220), sinh `--wms-motion-*` từ cùng nguồn.

Definition of Done B: `#7367F0` là primary duy nhất render; `yarn typecheck && yarn lint && yarn test && yarn build` xanh; screenshot login/dashboard đối chiếu Mini App.

## Phase C — Shell & CSS layer teardown

1. Gỡ `renderMvpScreen`/`?screen=` (RC-07/SEC-RBAC-01): mọi màn là route thật dưới `RequirePermission`; hợp nhất `NAV_GROUPS` + `MENU` thành 1 nguồn nav-data (đủ `/scan`, `/pv-admin`, breadcrumb `/notifications`); thêm trang 404; xoá `middleware.ts`, `PartnerLayout`, `AppHeader`, `AppFooter`, `layout.styles.ts` phần chết.
2. Shell mới theo spec X §3 (sidebar sáng ~260px, sticky header ~80px, padding 24, canvas `#F8F7FA`) — viết MỚI bằng MUI + tokens, không retheme `.hn-mvp-*`.
3. Rút lớp CSS theo thứ tự an toàn (mỗi bước build + E2E responsive sweep):
   a. Xoá dead CSS đã verify (CSS-14: bộ `hn-*` primitives ma, `barcode-*/label-*`, `hn-wms-sidebar-account.css`, 4 class index.css) — RE-VERIFY từng class trước khi xoá (check hiện tại là substring-based);
   b. Thay attribute-substring hooks (CSS-08) bằng class thật TRƯỚC khi dọn inline style;
   c. Khi shell mới thay `.hn-mvp-*`: xoá `hn-wms-mvp-exact.css`, `hn-wms-page-normalize.css`, `hn-wms-sidebar-account.css`;
   d. Khi Phase A4 duyệt: xoá `hoa-nam-wireframe.css` + `design-tokens.ts` (di trú 2-3 consumer sống: FormDrawer, ErrorState..., PlaceholderPage `#356fa3`);
   e. `hn-responsive.css` co lại thành foundation nhỏ (xoá section 11 ~170 dòng khi modal-vocabulary hết được dùng — CSS-07);
   f. Đưa `DashboardPage.css`, `pwa-status.css` vào hệ layer thống nhất, chuẩn breakpoint (CSS-09/CSS-13).
   Đích cuối: ≤2 file CSS global (tokens.css + foundation.css), `!important` ≈ 0, selector `.ant-*` chỉ còn trong 1 file bridge tạm.

## Phase D — Component unification (thứ tự dễ → khó, theo 04 §4)

| Bước | Việc | Phạm vi |
|---|---|---|
| D1 | Tag/Chip: 31 file antd `Tag` → `StatusTag` (MUI) mở rộng | dễ, diff máy móc |
| D2 | Pagination: 5 impl → 1 wrapper | 8+3+3 consumers |
| D3 | Toast sót: WarrantyPage `message`, ApiMasterScreens `Modal.confirm` → sonner + ConfirmDialog MUI mới | 2 file |
| D4 | Modal: chuẩn `AppDialog` wrapper (MUI, radius/motion token) — 22 file MUI Dialog quy về wrapper, 3 file antd Modal migrate | 25 file |
| D5 | Form: `FormField` layer mới trên MUI + RHF (giữ API `control`/`name` hiện có); migrate 25 file TextField trực tiếp + 3 trang auth khỏi antd forms; xoá forms/ antd chết | lớn |
| D6 | Table: `AppTable` chuẩn hoá từ `ResponsiveDataTable` (7 trang list đã dùng); antd `Table` trong 12 modal + `DataTable` (5) migrate dần; virtual scroll đánh giá riêng | khó |
| D7 | DatePicker: chọn giải pháp thay antd DatePicker (đề xuất @mui/x-date-pickers, đánh giá bundle/license MIT) | rào cản kỹ thuật |
| D8 | Scan cuối cùng: `CameraScanModal`, `ScanInput` (giữ hợp đồng scan-focus Annex D; chạy full E2E scan flows trước/sau) | rủi ro nghiệp vụ cao nhất |
| D9 | Khi antd import = 0: gỡ `antd` + `@ant-design/icons` (chết sẵn) khỏi package.json; xoá `ConfigProvider`; xoá 502 override `.ant-*` còn lại | kết thúc |

Sau mỗi bước: `yarn typecheck && yarn lint && yarn test && yarn build` + E2E scope (`test:e2e:responsive`, flow E2E tương ứng module); cập nhật 2 README shared thành 1 convention + test enforce.

## Phase E — Verification & docs (Prompt 5 input)

- Visual QA matrix theo mẫu Mini App phase 5 (320/360/390/430/768/980/1280; `clientWidth == scrollWidth`).
- Đối chiếu side-by-side với Mini App (cùng token) + live demo.
- Cập nhật `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` (UI stack thật + trỏ tài liệu design-system MỚI thay 4 link chết — BC-06); Decision Records cho A1-A6.

## Ràng buộc bất biến trong mọi phase

1. Không đổi hành vi nghiệp vụ/permission/endpoint — chỉ UI (trừ SEC-RBAC-01 là fix an ninh UX-gate có ticket riêng).
2. Giữ hợp đồng Annex D: skeleton/empty/error + request_id/confirm nêu stock effect/scan-focus/responsive 360-768-1280.
3. Test hiện có (852 unit + E2E) phải xanh sau mỗi phase; test nghiệm thu theo exact SHA + CI run.
4. Không thêm lớp CSS global mới; không `!important` mới; không hex literal mới ngoài tokens.
5. PII masking (warranty) và no-Stocktake authority (WWHN-296/236) không được suy suyển.

## Ước lượng khối lượng (để PM lập kế hoạch Prompt 2-4)

| Hạng mục | Số lượng |
|---|---|
| File mixed antd+MUI phải tách | 29 |
| File antd còn lại phải migrate | 93 tổng (44 shared — phần lớn xoá; 41 modules; 8 app) |
| ThemeProvider re-wrap phải xoá | 34 |
| sx `height:35` blocks | 10 |
| CSS global phải rút | 2717 dòng → mục tiêu ~400-500 |
| `!important` | 177 → ~0 |
| Hex literals | 450 → ~0 ngoài tokens |
| Dead exports shared phải xoá | 41 |
| Dead CSS classes | 103+ (re-verify từng cái) |
