# 29 — CI Prevention Controls & Governance (Part 5)

> Mục tiêu: DEV KHÔNG THỂ đưa lại direct import / token hard-code / provider trùng / CSS conflict mà CI vẫn xanh. Tài liệu này mô tả bộ điều khiển ĐÃ NỐI VÀO CODE + CI (không phải khuyến nghị suông) và giao thức governance đi kèm.

## 1. Bộ 9 lệnh prevention (package.json)

| Lệnh | Nội dung | Cơ chế |
|---|---|---|
| `ui:architecture` | direct UI import ngoài adapter-zone, public API, provider boundary (`<ThemeProvider>/<ConfigProvider>` ngoài `AppThemeProvider`) | `scripts/check-ui-architecture.mjs` — ratchet allowlist `direct-ui-imports.json` (24 file, toàn bộ `src/shared/components/**`), có `--self-test` |
| `ui:tokens` | hex literal / font cấm / import token nguồn cũ | `scripts/check-ui-tokens.mjs` — baseline 1 file (console-colors), có `--self-test` |
| `ui:styles` | CSS entrypoint duy nhất `src/main.tsx` + thứ tự CSS_MANIFEST, `!important`, import CSS lạc | `scripts/check-ui-styles.mjs`, có `--self-test` |
| `ui:components` | contract/unit/interaction suite của foundation (43+ test ui-foundation, component tests trong `src/shared/ui/**`, hợp đồng WWHN-268 canonical `ui-state-canonical.test.tsx`) | vitest |
| `ui:visual` | golden visual regression Foundation Catalog (desktop 1280 + mobile 375, `maxDiffPixelRatio 0.02`) + computed-style contract + focus-ring + 8-viewport catalog sweep | playwright `e2e/ui-foundation.spec.ts` |
| `ui:responsive` | viewport smoke 10 khổ × toàn bộ route + deep-link modal (overflow/nav/title/modal-width) | playwright `e2e/responsive-sweep.spec.ts` |
| `ui:a11y` | keyboard/ARIA baseline 3 engine (Desktop Chrome / Chrome Android / Safari iOS) | playwright `e2e/wwhn-274-a11y-browser-matrix.spec.ts` |
| `ui:dependencies` | dependency UI trùng lặp (bootstrap/chakra/tailwind/styled-components/@ant-design/icons/@mui/icons-material…) + runtime dep chết (không có import trong src) | `scripts/check-ui-dependencies.mjs` (MỚI Part 5), có `--self-test`; ngoại lệ gián tiếp duy nhất `@emotion/styled` (peer engine MUI) có lý do trong source |
| `ui:full-gate` | `ui:guards` (4 guard + 4 self-test) → `ui:components` → `ui:visual` → `ui:responsive` → `ui:a11y` | tổng hợp, fail-fast |

`ui:guards` = 4 guard tĩnh + self-test của cả 4 (đã gồm `ui:dependencies`).

## 2. Nối vào CI (`.github/workflows/ci.yml` — job Quality gates)

- Step **`ui_guards`** (sau Type check): `npm run ui:guards`.
- Step **`ui_visual`**, **`ui_a11y`**, **`ui_responsive`** (sau khi cài Playwright Chromium).
- Cả 4 outcome được thêm vào `scripts/assert-ci-gates.mjs` (`UI_GUARDS_OUTCOME`, `UI_VISUAL_OUTCOME`, `UI_A11Y_OUTCOME`, `UI_RESPONSIVE_OUTCOME`) — **bất kỳ outcome nào ≠ success là job Enforce fail**, cùng cơ chế với format/lint/typecheck/unit/build hiện có. `ui:components` đã nằm trong step Unit tests (vitest full).
- Pre-commit (husky) sẵn có: credential scan + tsc khi đụng TS; pre-push: tsc. Guard tĩnh chạy nhanh (<5s) — DEV chạy `yarn ui:guards` trước khi mở PR theo checklist §4.

## 3. Negative testing — bằng chứng guard HOẠT ĐỘNG (không phải "sẽ chặn")

Log đầy đủ: `docs/ui/vuexy-sync/negative-tests-part5.txt` (chạy tại working tree Part 5). 10 ca, mỗi ca tạo fixture VI PHẠM THẬT → guard đỏ đúng thông điệp → gỡ fixture → guard xanh lại:

1–4. `--self-test` của 4 guard (fixture nội bộ tổng hợp: 5 vi phạm tokens, 4 vi phạm styles, v.v.).
5. Feature import `antd` trực tiếp → `ui:architecture` FAIL ✔.
6. Feature import `@mui/material/Box` → `ui:architecture` FAIL ✔.
7. Hard-code `#123456` + `font-family: Inter` → `ui:tokens` FAIL ✔.
8. `<ThemeProvider>` thứ hai ngoài composition root → `ui:architecture` FAIL ✔.
9. `import "./rogue.css"` ngoài entrypoint → `ui:styles` FAIL ✔.
10. Thêm `react-bootstrap` vào package.json → `ui:dependencies` FAIL (2 vi phạm) ✔; gỡ `data-ui-state` khỏi `UiStateSurface` → `ui:components` FAIL đúng assertion ✔ (khôi phục xong 2/2 pass).
Visual drift vượt threshold: chứng minh bằng sự kiện THẬT trong Part 4 — 2 golden FAIL ratio 0.04 > 0.02 khi container đổi 906→936px, chỉ được update sau khi xem ảnh + ghi disposition (doc 22 ledger). Component thiếu required state: ca 10 (hook canonical) + guard `deprecated-components.test` (thêm consumer mới cho adapter freeze là đỏ).

Sau chuỗi test, mọi fixture đã gỡ khỏi production source; guard xanh lại (log mục [9]).

## 4. Governance

### UI PR checklist (dán vào description PR đụng UI)
- [ ] `yarn ui:guards` xanh local; không sửa allowlist/baseline trừ khi PR NÓI RÕ lý do + owner + deadline.
- [ ] Component mới: đặt ở `@/shared/ui` (nếu dùng ≥2 nơi) — theo Component creation checklist bên dưới; KHÔNG import antd/@mui trực tiếp trong feature.
- [ ] Text/label đổi: cập nhật E2E spec liên quan CÙNG PR (bài học drift [skip ci] — doc 22 §3c).
- [ ] Golden đổi: đính kèm ảnh before/after + disposition trong PR (giao thức §4.3).
- [ ] Không thêm dependency UI mới khi chưa qua `ui:dependencies` + ADR.

### Component creation checklist
1. Đã có canonical cùng purpose chưa? (xem `15-component-contracts.md` + catalog `/ui-foundation`) — nếu có, dùng/mở rộng nó.
2. Props contract viết trước, style CHỈ từ `@/shared/ui/tokens` (guard chặn hex).
3. Thêm case vào `FoundationCatalogPage` (golden tự phủ) + unit test colocated (states + a11y roles).
4. Nếu phát trạng thái loading/empty/error/disabled/confirm → gắn `data-ui-state` theo `src/shared/constants/ui-state.ts` (WWHN-268; test `ui-state-canonical` khoá tầng canonical).
5. Export qua barrel `@/shared/ui`; chạy `yarn ui:guards && yarn ui:components`.

### Token change protocol
1. Sửa CHỈ trong `src/shared/ui/tokens/primitives.ts` (+semantic/component nếu thêm ngữ nghĩa), gắn nhãn nguồn `[ĐO]/[X]/[DX]`.
2. Mirror `css-vars.css` — parity test (`token-css-parity`) fail nếu quên.
3. Chạy `ui:components` + `ui:visual` (golden sẽ đỏ nếu token đổi diện mạo) → đính disposition.
4. Cấm: giá trị mới ở adapter/feature (guard `ui:tokens` chặn), đổi token để "sửa 1 màn" (fix tại component canonical).

### Visual baseline update protocol (approval bắt buộc)
1. Golden CHỈ được regenerate khi: (a) diff là hệ quả CÓ CHỦ ĐÍCH của thay đổi trong PR, (b) đã MỞ ảnh actual/diff xem bằng mắt, (c) PR ghi disposition (nguyên nhân + ảnh). Không bao giờ `--update-snapshots` để "cho xanh".
2. Reviewer (CODEOWNERS đường dẫn `e2e/ui-foundation.spec.ts-snapshots/`) đối chiếu ảnh trước khi approve.
3. Threshold 0.02 KHÔNG được nới trong PR thường — nới threshold = ADR.

### Allowlist policy
- Mọi allowlist (`docs/ui/vuexy-sync/allowlists/*.json`) là RATCHET: chỉ được GIẢM. `meta.owner/reason/deadline` bắt buộc. Thêm entry mới = vi phạm quy trình trừ khi ADR đi kèm; P0/P1 không bao giờ vào allowlist.
- Regenerate baseline (`--update-baseline`) chỉ trong PR dọn nợ, diff baseline phải THU HẸP.

### Migration/deprecation policy
- Adapter thay thế: gắn `@deprecated` + entry trong `deprecated-components.json` (consumer bị đóng băng bởi `deprecated-components.test`). Consumer chỉ được GIẢM; về 0 thì xoá file + entry cùng PR (mẫu: DataTable/PageSizeSelector/useSortTooltipColumns/SubmitButton — Part 5, doc 24).
- Còn đóng băng sau chương trình: StatusTag(3)/TopPagination(3)/PageHeader(1)/MvpPaginationFooter(3)/MvpPageSizeSelector(3)/ReportKpiCard+Grid(1) — owner FE1, deadline "khi gỡ antd remnant".

### CODEOWNERS
`.github/CODEOWNERS` (MỚI): `src/shared/ui/**`, `scripts/check-ui-*.mjs`, `allowlists/`, golden snapshots, `main.tsx`/`index.css` — bắt buộc review owner design system (handle cập nhật khi có team slug chính thức).

## 5. Ranh giới trung thực

Tài liệu không thay CI: mọi mục §1–2 đều là lệnh chạy được + đã có negative proof §3. Phần CHƯA có guard tự động (ghi nhận, không claim): literal radius/shadow ngoài token không bị scan tĩnh (được phủ gián tiếp bởi computed-style tests + golden); wording tiếng Việt đổi không tự bắt (phủ bằng checklist §4 + E2E theo màn); `!important` trong 5 file CSS scoped còn 97 chỗ (đếm bởi ui:styles, ratchet theo file — giảm dần khi gỡ antd remnant).
