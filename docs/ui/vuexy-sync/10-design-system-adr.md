# 10 — Design System ADR (Part 2: Foundation Remediation)

Ngày: 2026-08-28 · Base: DEC-UI-BASELINE-01 + Part 1 audit (01→09) · Trạng thái: ACCEPTED

## Bối cảnh

Part 1 kết luận (RC-01…RC-07): 11 nguồn token/3 hệ màu, 2 UI engine trộn trong từng flow, 37 điểm mount ThemeProvider, cascade CSS phân giải bằng thứ tự import + 177+ `!important`, tầng shared bị bypass. DEC-UI-BASELINE-01 chốt: design-language parity theo Vuexy Vuejs demo-1, stack React/Vite + MUI 9 + Emotion, retire hệ warm, engine đích MUI.

## Quyết định kiến trúc

### ADR-P2-01 — Canonical token source duy nhất: `src/shared/ui/tokens/`
- `primitives.ts` (giá trị thô, mỗi giá trị gắn nhãn nguồn `[ĐO]`/`[X]`/`[DX]`), `semantic-light.ts` (hợp đồng ngữ nghĩa), `component-tokens.ts` (số đo cấp component), `css-vars.css` (mirror CSS `--wms-*`), `semantic-dark.ts` (= null — dark CHƯA thuộc baseline, giữ chỗ đứng cấu trúc).
- CSS không import được TS → mirror được bảo đảm bằng **parity test** (`src/test/ui-foundation/token-css-parity.test.ts`) fail khi lệch từng giá trị và fail khi css-vars chứa biến ngoài hợp đồng. Không codegen để tránh phức tạp build; test là cơ chế đồng bộ.
- `motion`: bộ số hiện hành (90/140/200/280 + easing) được đưa vào primitives làm nguồn duy nhất; `motion-tokens.ts` và `hn-motion.css` là mirror (parity test kèm).

### ADR-P2-02 — Adapter boundary: engine chỉ nhận token qua adapter
- `theme/mui-adapter.ts` — `createTheme` DUY NHẤT của repo (kế thừa nguyên bộ component-overrides/motion đã có, thay giá trị bằng token).
- `theme/antd-adapter.ts` — ConfigProvider theme cho phần antd chưa migrate; cùng token, cùng motion.
- Cấm literal trong adapter (guard `ui:tokens` fail nếu hex xuất hiện trong `shared/ui/**` ngoài `tokens/`).

### ADR-P2-03 — Một composition root: `theme/AppThemeProvider.tsx`
- Nơi DUY NHẤT mount `MuiThemeProvider` + `ConfigProvider` + `AntdApp` (+ locale vi). `AppProviders` dùng nó; 36 re-wrap cục bộ đã xoá (RC-05 đóng); allowlist ngoại lệ RỖNG (`allowlists/themeprovider-exceptions.json`); file `*.test.*` được miễn (render cô lập).

### ADR-P2-04 — Legacy bridge thay vì rewrite: re-point giá trị, giữ tên
- `BRAND`/`DESIGN_TOKENS` (`src/app/theme.ts`) và `muiTheme` (`src/app/mui-theme.ts`) trở thành **shim @deprecated** trỏ về canonical — consumer cũ đổi diện mạo Vuexy mà không sửa hàng loạt trong Part 2 (đúng mẫu "migration bridge" của Mini App app.scss:700-864).
- CSS legacy: `:root` của `hoa-nam-wireframe.css` (`--hn-*`) và `hn-wms-mvp-exact.css` (`--bg/--primary/…`) alias về `--wms-*`; toàn bộ hex trong 11 file CSS map về token vars (2 pass sed, chỉ chừa `#fff` + 4 màu sidebar tối legacy — xem 12).
- `src/shared/design-tokens.ts` (hệ warm): XOÁ HẲN (chỉ còn 1 consumer FormPage — đã migrate sang tokens). `actionIconColors.ts`, `chart-theme.ts` re-point sang tokens.

### ADR-P2-05 — Sidebar tối giữ tạm (LEGACY_SHELL)
Shell Vuexy (sidebar sáng ~260px) thuộc Part 3 Phase C (đi cùng gỡ `?screen=`/SEC-RBAC-01). 4 giá trị sidebar tối (#0f172a, #111f3d, #e5e7eb, #94a3b8) được token-hoá thành `LEGACY_SHELL` trong primitives (deadline Part 3) — literal vẫn chỉ nằm trong tokens; menu-selected đổi sang primary Vuexy.

### ADR-P2-06 — Guard chạy được, ratchet-based
4 lệnh: `yarn ui:architecture` / `ui:tokens` / `ui:styles` / `ui:foundation` (+ `ui:guards` gộp và chạy cả `--self-test`). Nguyên tắc **ratchet**: hiện trạng được đóng băng vào allowlist/baseline có owner/reason/deadline (`docs/ui/vuexy-sync/allowlists/`); file MỚI/lượng TĂNG ⇒ fail; giảm dần theo Part 3-4. Negative-tested bằng `--self-test` (mỗi guard tự chứng minh bắt được vi phạm tổng hợp) + `src/test/ui-foundation/import-boundary.test.ts` (negative/positive trên matcher thật). Chi tiết: 13-import-boundary-policy.md.

### ADR-P2-07 — Foundation components + catalog làm bằng chứng mapping
`src/shared/ui/components/`: UiText, UiIcon, UiButton/UiIconButton, UiTextField/UiFormField, UiCard, UiStatusBadge, UiDialog/UiDrawer, UiStateSurface (loading/empty/error/no-permission). Mỏng trên MUI, đọc token qua theme/tokens, không literal. Catalog golden: `/ui-foundation` (DEV-only, đăng ký cùng cơ chế `/component-catalog`) dùng CHÍNH các component production; computed-style + screenshot: `e2e/ui-foundation.spec.ts`. KHÔNG migrate màn nghiệp vụ nào trong Part 2 (đúng phạm vi prompt).

## Hệ quả
- (+) Một nguồn token; hai engine render cùng giá trị; đổi màu = sửa 1 nơi; guard chặn tái phát.
- (+) 36 provider re-wrap biến mất; theme drift 35-vs-36px sẽ được dọn ở Part 3 (10 sx `height:35` nằm trong hex/sx baseline, ratchet).
- (−) Diện mạo antd cũ đổi theo token mới (chủ đích của retheme); mọi khác biệt thị giác là expected-change, được soi bằng catalog + E2E responsive hiện có.
- (−) Legacy CSS layers CHƯA xoá (Part 3 Phase C theo 09-remediation) — nhưng đã bị "trói" (alias về token, ratchet `!important`, cấm file/lớp mới).

---

## Addendum Part 4–5 (2026-08-28) — trạng thái cuối chương trình

Cập nhật hiện trạng so với các ADR gốc (không đảo quyết định nào):

- **ADR-P2-04/P2-05 HOÀN TẤT VÒNG ĐỜI**: 3 shim (`app/theme.ts`, `app/mui-theme.ts`, `app/layouts/layout.styles.ts`) và `LEGACY_SHELL` đã XOÁ (consumer=0, Part 4); 4 lớp CSS wireframe đã XOÁ, 5 lớp còn lại (page-normalize/source-screen/responsive/motion/index) 100% `var(--wms-*)` và nằm trong CSS_MANIFEST 7 lớp.
- **ADR-P2-06 MỞ RỘNG (Part 5)**: bộ guard thành 9 lệnh — thêm `ui:components`, `ui:visual`, `ui:responsive`, `ui:a11y`, `ui:dependencies` (guard MỚI: cấm UI stack/icon-engine thứ hai + bắt runtime dep chết, có `--self-test`) và `ui:full-gate`. Tất cả nối vào CI (`ci.yml` + `assert-ci-gates.mjs`); negative-proof 10 ca trong `negative-tests-part5.txt`. Governance: `29-ci-prevention-controls.md` + `.github/CODEOWNERS`.
- **ADR-P2-07 MỞ RỘNG**: foundation đủ bộ Part 3 (forms/layout/overlay) + Part 4 (UiSelect/UiDatePicker/primitives mở rộng) + hợp đồng WWHN-268 phát `data-ui-state` ngay trên tầng canonical (UiStateSurface/UiConfirmDialog — test `ui-state-canonical`).
- **Adapter surface cuối**: `src/shared/components/**` còn 24 file trong allowlist ratchet; DataTable/PageSizeSelector/useSortTooltipColumns/SubmitButton/AppBreadcrumb đã xoá (consumer=0); nhóm deprecated còn consumer bị đóng băng chỉ-giảm (owner/deadline trong `deprecated-components.json`). `@ant-design/icons`, `lodash-es`, `puppeteer`, `@emotion/babel-plugin` đã gỡ khỏi package.json (doc 24).
- **antd remnant CÓ CHỦ ĐÍCH**: ScanInput/CameraScanModal (Annex D scan-focus) + DatePicker (dayjs contract) + ConfigProvider trong AppThemeProvider — cấp token qua antd-adapter; không coi là duplicate stack.
