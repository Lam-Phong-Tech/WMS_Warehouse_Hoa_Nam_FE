# 13 — Import Boundary Policy (UI engine / token / style guards)

Ngày: 2026-08-28 · Hiệu lực: sau Part 2 · Enforce: local + CI (script chạy được, không chỉ tài liệu)

## 1. Luật

1. **Feature modules (`src/modules/**`, `src/app/**`) KHÔNG được thêm import trực tiếp** `antd`, `@mui/material`, `@emotion/*`. UI engine chỉ xuất hiện trong `src/shared/ui/**` (adapters/foundation) hoặc file có sẵn trong allowlist ratchet.
2. **`@emotion/*` cấm tuyệt đối ở mọi nơi** (0 usage hiện tại — chỉ là styled-engine nội bộ MUI). ESLint chặn ngay khi gõ.
3. **Một canonical token source** (`src/shared/ui/tokens/`) — thêm "nguồn thứ hai" (export const UPPER_CASE chứa ≥3 hex ngoài tokens/) ⇒ fail.
4. **Một provider composition root** (`AppThemeProvider`) — mount ThemeProvider/ConfigProvider/AntdApp nơi khác ⇒ fail (allowlist ngoại lệ hiện RỖNG; *.test.* miễn).
5. **Một CSS entrypoint** (`src/main.tsx`, thứ tự = `CSS_MANIFEST` trong check-ui-styles.mjs) — import CSS nơi khác phải nằm trong allowlist component-scoped; file CSS mới trong `src/styles/` ⇒ fail.
6. **Không design literal mới**: hex ngoài tokens theo ratchet per-file (chỉ được GIẢM); font cấm (`Inter`, `Be Vietnam Pro`, `Arial,Helvetica`, fonts.googleapis) ⇒ fail; `!important` mới ⇒ fail.
7. Code mới dùng: `@/shared/ui` (foundation + tokens + theme) — hoặc tạm thời các shared component hiện có (ActionButton, DataTable…) cho tới khi Part 3 hợp nhất.

## 2. Lệnh

```bash
yarn ui:architecture   # biên giới engine-import + provider + nguồn token thứ hai
yarn ui:tokens         # hex ratchet + font drift + design-tokens quay lại + index.html
yarn ui:styles         # entrypoint manifest + CSS import lạ + !important ratchet + file styles mới
yarn ui:foundation     # vitest src/test/ui-foundation (parity + uniqueness + boundary + computed-style)
yarn ui:guards         # cả 3 guard + --self-test của từng guard
```
Mỗi script hỗ trợ `--self-test` (bơm vi phạm tổng hợp, chứng minh guard THẬT SỰ fail — negative test) và `--update-baseline` (đóng băng lại hiện trạng — chỉ dùng khi cố ý, trong PR có review).

## 3. Allowlists (ratchet, có owner/reason/deadline)

| File | Nội dung | Deadline |
|---|---|---|
| `allowlists/direct-ui-imports.json` | 119 file hiện trạng còn import antd/@mui trực tiếp (sinh bằng `--update-baseline`). File MỚI không được vào trừ khi thêm thủ công có review | Part 4 — mục tiêu rỗng |
| `allowlists/hardcoded-hex-baseline.json` | 41 file còn hex, số lượng per-file (gồm 10 block sx height:35, literal TSX module, #fff CSS) | Part 4 — ~0 ngoài tokens |
| `allowlists/css-baseline.json` | CSS import component-scoped hợp lệ + đếm !important per-file | Part 3 Phase C |
| `allowlists/themeprovider-exceptions.json` | RỖNG — thêm mục cần review Tech Lead | giữ rỗng |

Quy trình xin ngoại lệ: PR sửa allowlist + nêu owner/reason/deadline trong `meta` + approve của Tech Lead. **Không được chuyển P0/P1 thành allowlist để lách gate** — allowlist chỉ đóng băng nợ CŨ đã kiểm kê ở Part 1.

## 4. Tầng enforce

| Tầng | Bắt gì | Khi nào |
|---|---|---|
| ESLint `no-restricted-imports` | `@emotion/*`, `@/shared/design-tokens` (+ 2 rule permission có sẵn) | ngay trong editor + pre-commit (lint-staged) + CI lint |
| `ui:architecture`/`ui:tokens`/`ui:styles` | toàn bộ luật §1 (ratchet) | local + CI (thêm vào pipeline cùng lint/typecheck) |
| Vitest `src/test/ui-foundation/*` | parity token↔CSS↔adapter, provider uniqueness, matcher negative/positive, computed-style contract | `yarn test` (nằm trong suite chính) |
| Playwright `e2e/ui-foundation.spec.ts` | computed style THẬT trên trình duyệt + visual golden catalog | E2E theo scope UI |

## 5. Ghi chú cho CI

Khuyến nghị thêm bước sau `lint` trong `.github/workflows/ci.yml`:
```yaml
- name: UI guards (Part 2 Vuexy sync)
  run: yarn ui:guards
```
(Chưa sửa workflow trong Part 2 — thay đổi CI thuộc phạm vi DevOps review; guard đã chạy được local và qua `yarn test`.)
