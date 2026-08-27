# 14 — Foundation Visual Report

Ngày: 2026-08-28 · Spec: `e2e/ui-foundation.spec.ts` (Chromium, viewport 1280×900, locale vi-VN, light, animation settle 600ms + disabled khi chụp)

## 1. Computed-style contract — đo THẬT trên trình duyệt (PASS ×2 lần chạy)

| Phần tử | Thuộc tính đo | Kỳ vọng (DEC-UI-BASELINE-01) | Kết quả |
|---|---|---|---|
| `document.body` | fontFamily | chứa "Public Sans" | ✔ |
| `:root` | `--wms-bg-canvas` / `--wms-primary` | `#f8f7fa` / `#7367f0` | ✔ |
| UiButton filled | background-color | `rgb(115, 103, 240)` | ✔ |
| UiButton filled | height / radius / font | 38px / 6px / 15px w500 Public Sans | ✔ |
| UiTextField (OutlinedInput) | radius / font-size / height | 6px / 15px / 36–40px | ✔ |
| UiStatusBadge success | bg / màu chữ | `rgba(40,199,111,0.16)` / `rgb(22,122,69)` (#167A45) | ✔ |
| Swatch primary | background-color | `rgb(115, 103, 240)` | ✔ |
| MuiDialog paper | border-radius | 6px | ✔ |
| Dialog motion | Grow enter → đóng sạch DOM (closeAfterTransition) | mở/đóng không kẹt | ✔ |

## 2. Visual golden

- Baseline: `e2e/ui-foundation.spec.ts-snapshots/ui-foundation-catalog-chromium-win32.png` (commit kèm repo; maxDiffPixelRatio 0.02, animations disabled).
- Ổn định: chạy 2 lần liên tiếp (lần 1 sinh golden, lần 2 so khớp) — PASS.
- Bản sao evidence: `docs/ui/vuexy-sync/visual/part-02/ui-foundation-catalog-chromium-win32.png`.
- Nội dung catalog (fixed fixtures, tiếng Việt dài): token swatches · typography scale · button 4 appearance + danger/disabled/loading + icon button · textfield default/error/multiline/disabled + FormField shell · 6 status badge tones · dialog/drawer · 4 state surfaces (loading/empty/error+request_id/no-permission).
- Dark: không chụp — dark chưa thuộc baseline (semantic-dark = null, ADR-P2-01).

## 3. Cách chạy lại

```bash
VITE_APP_ENV=test VITE_API_BASE_URL=http://127.0.0.1:5173/api/v1 VITE_API_HEALTH_PATH=/health \
VITE_API_TIMEOUT_MS=10000 VITE_API_WITH_CREDENTIALS=true \
npx playwright test e2e/ui-foundation.spec.ts --project=chromium
```
(Env giống block env của `.github/workflows/ci.yml`; route `/ui-foundation` là DEV-only nên spec chạy trên dev server của webServer config; auth được mock ở network layer theo đúng contract `auth.service.ts` — không đụng BE thật.)

## 4. Ghi chú

- Trang login/catalog xác nhận thêm 2 fix hạ tầng: mock `/auth/refresh` phải có `refresh_token`+`expires_in` và `/auth/me` trả user object trực tiếp trong `data` — spec là tài liệu sống cho contract này.
- Business smoke: unit suite 926/926 PASS (bao gồm contract flows inbound/outbound/warranty/reversal/reports); E2E `responsive-sweep` chạy kèm — kết quả ghi ở gate JSON.
