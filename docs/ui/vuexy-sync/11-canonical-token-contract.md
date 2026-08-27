# 11 — Canonical Token Contract

Ngày: 2026-08-28 · Nguồn: `src/shared/ui/tokens/` · Mirror CSS: `css-vars.css` (parity test enforced)
Nhãn nguồn: **[ĐO]** đo live Vuexy Vuejs demo-1 (27-28/08) · **[X]** spec hệ X Mini App · **[DX]** dẫn xuất quy ước Vuexy · **[GIỮ]** giữ giá trị hiện hành của dự án (đổi ở Part sau nếu đo được).

## 1. Màu

| Token (TS / CSS var) | Giá trị | Nguồn |
|---|---|---|
| primary / `--wms-primary` | `#7367F0` | [ĐO] |
| primaryDark / `--wms-primary-dark` | `#675DD8` | [ĐO] (DEC A3) |
| primaryLight / `--wms-primary-light` | `#ABA4F6` | [DX] tint |
| primarySoft / `--wms-primary-soft` | `rgba(115,103,240,0.16)` | [DX] soft 16% |
| onPrimary / `--wms-on-primary` | `#FFFFFF` | [ĐO] |
| secondary(+dark,+soft) | `#808390` / `#737682` / rgba 0.16 | [ĐO]/[ĐO]/[DX] |
| success(+dark,+soft,+text) | `#28C76F` / `#24B364` / rgba 0.16 / `#167A45` | [ĐO]/[ĐO]/[DX]/[X] |
| warning(+dark,+soft,+text) | `#FF9F43` / `#E68F3C` / rgba 0.16 / `#98520E` | [ĐO]/[ĐO]/[DX]/[X] |
| error(+dark,+soft,+text) | `#FF4C51` / `#E64449` / rgba 0.16 / `#B52F3B` | [ĐO] (DEC A3)/[ĐO]/[DX]/[X] |
| info(+dark,+soft,+text) | `#00BAD1` / `#00A7BC` / rgba 0.16 / `#087C90` | [ĐO]/[ĐO]/[DX]/[X] |
| bgCanvas / bgSurface / bgSubtle | `#F8F7FA` / `#FFFFFF` / `#F8F7FA` | [ĐO] |
| textStrong / High / Medium / Disabled | `#2F2B3D` / rgba(47,43,61,.9) / .7 / .4 | [ĐO] (emphasis opacity đo `--v-*-opacity`) |
| border / borderInput / divider | rgba(47,43,61,.12) / .22 / .12 | [ĐO]/[DX]/[ĐO] |
| focusRing | `0 0 0 3px rgba(115,103,240,0.22)` | [X] |
| shadowCard / shadowFloating | `0 4px 18px rgba(47,43,61,.10)` / `0 8px 24px …,.14)` | [X] |
| grey100/200/300/500 | `#F5F5F5`/`#EEEEEE`/`#E0E0E0`/`#9E9E9E` | [ĐO] |

## 2. Typography

| Token | Giá trị | Nguồn |
|---|---|---|
| fontFamily | `"Public Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` — system-preferred, KHÔNG webfont render-blocking | [ĐO]+[X] (DEC D1) |
| body | 15px / lh 22 | [ĐO] |
| secondary/label | 13px | [ĐO] |
| heading (pageTitle) | 24 / 500 / lh 38 | [ĐO] h4 login |
| cardTitle | 18 / 600 / lh 24 | [X] |
| kpi | 22 / 600 / lh 30 | [X] |
| button | 15 / 500 | [ĐO] |

## 3. Kích thước / hình khối

| Token | Giá trị | Nguồn |
|---|---|---|
| radius control/card | 6px | [ĐO] |
| radius sheet (mobile modal) | 16px | [X] |
| radius pill | 999px | quy ước |
| control height | 38px (touch 44px) | [ĐO] / [X] |
| input padding | 7×14, label 13 | [ĐO] |
| spacing | 4/8/12/16/24/32 | [X] |
| breakpoints | 0/576/768/980/1280 | [GIỮ] hợp đồng dự án |
| icon | 16/18/20 | [GIỮ] |
| table density | font 13, cell 10 | [GIỮ] — đo lại Part 3 |
| z-index | header 30 · sidebar 40 · dropdown 999 · pwa 2200 · loading 9999 | [GIỮ] token-hoá, chuẩn thang Part 3 |

## 4. Motion

| Token | Giá trị | Nguồn |
|---|---|---|
| instant/fast/normal/slow | 90/140/200/280 ms | [GIỮ] — 3 hệ antd/MUI/CSS đã đồng nhịp từ trước |
| easing standard/out/in | cubic-bezier(0.4,0,0.2,1) / (0.16,1,0.3,1) / (0.4,0,1,1) | [GIỮ] |

## 5. Legacy scoped (deadline Part 3)

`LEGACY_SHELL` (primitives.ts): siderBg `#0f172a`, siderHover `#111f3d`, siderText `#e5e7eb`, siderMuted `#94a3b8` — sidebar tối BA-wireframe giữ tạm tới shell Vuexy Part 3; menu-selected đã đổi sang primary/onPrimary.

## 6. Mapping adapter (enforced bằng test `theme-adapter-parity.test.ts`)

| Semantic | antd token | MUI theme |
|---|---|---|
| primary | colorPrimary/colorLink | palette.primary.main |
| primaryDark | — (hover do antd tự derive) | palette.primary.dark |
| success/warning/error/info | colorSuccess/Warning/Error/Info | palette.\*.main (+dark) |
| bgCanvas/bgSurface | colorBgLayout/colorBgContainer | background.default/paper |
| textHigh/textMedium | colorText/colorTextSecondary | text.primary/text.secondary |
| borderInput/border | colorBorder/colorBorderSecondary | OutlinedInput.notchedOutline / divider |
| button.height/radius/weight | controlHeight/borderRadius/Button.fontWeight | MuiButton height/radius/fontWeight + shape |
| fontFamily/fontSizeBody | fontFamily/fontSize | typography.fontFamily/fontSize |
| motion | motionDuration\*/motionEase\* | transitions.duration/easing |

## 7. Deprecated bridges (không dùng cho code mới — guard chặn)

| Bridge | Trỏ về | Xoá ở |
|---|---|---|
| `@/app/theme` BRAND/DESIGN_TOKENS/themeConfig | tokens + antd-adapter | Part 3-4 (sau khi consumer migrate) |
| `@/app/mui-theme` muiTheme | mui-adapter | Part 3-4 |
| CSS vars `--hn-*`, `--bg/--primary/--line/…` | alias `var(--wms-*)` | Part 3 (Phase C — xoá cùng file) |
| `@/shared/design-tokens` | ĐÃ XOÁ (ESLint + guard chặn quay lại) | done |
