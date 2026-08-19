# WWHN-325 â€” Local exact-SHA evidence (thay tháº¿ CI run, quota Actions Ä‘Ã£ cáº¡n)

- Exact FE SHA: `5cc27970d36edd2063fd3ce4181d2108dd0077d0` (final reviewed candidate;
  implementation ancestor `651d037569ac8beb1f2440475f96ec66982f826c`).
- MÃ´i trÆ°á»ng: git worktree detached Ä‘Ãºng SHA trÃªn (`identity.txt` â€” worktree sáº¡ch),
  Windows 11, Node 22, `yarn install --frozen-lockfile`, Chromium qua
  `npx playwright install chromium`, dev server Vite port riÃªng `--strictPort`
  (trÃ¡nh race port 5173 giá»¯a cÃ¡c phiÃªn), cÃ³ `.env` theo env contract.
- NgÃ y cháº¡y: 2026-08-19. NgÆ°á»i cháº¡y: DevOps local (phiÃªn lÃ m viá»‡c m1).

## Káº¿t quáº£ gate (`summary.txt`, log tá»«ng gate trong thÆ° má»¥c nÃ y)

| Gate | Lá»‡nh | Exit | Ghi chÃº |
| --- | --- | --- | --- |
| lint | `yarn lint` | 0 | PASS |
| typecheck | `yarn typecheck` | 0 | PASS |
| build | `yarn build` (tsc -b + vite build + build manifest) | 0 | PASS |
| unit | `yarn test` (vitest) | 1 | 501/502 PASS; 1 fail duy nháº¥t `DashboardPage.test.tsx` ("multiple elements" â€” bá» máº·t WWHN-327 tá»“n táº¡i sáºµn táº¡i snapshot; `04b-unit-dashboard-only.log` tÃ¡i láº­p; PASS 7/7 táº¡i m1 HEAD hiá»‡n hÃ nh). ToÃ n bá»™ unit PWA-owned PASS. |
| e2e PWA | `npx playwright test e2e/wwhn-325-pwa-offline.spec.ts --project=chromium` | 0 | 2/2 PASS táº¡i exact SHA (`07-e2e-pwa-rerun.log`). Láº§n Ä‘áº§u (`07-e2e-pwa.log`) fail do worktree thiáº¿u `.env` (app fail-closed Ä‘Ãºng thiáº¿t káº¿) + race port â€” Ä‘iá»u kiá»‡n mÃ´i trÆ°á»ng, khÃ´ng pháº£i defect. |
| format | `yarn format:raw-check` / `yarn format:check` | 1 / 1 | Drift Prettier tá»“n táº¡i sáºµn táº¡i snapshot (26 file, gá»“m file ngoÃ i PWA); Ä‘Ã£ Ä‘Æ°á»£c cÃ¡c commit sau trÃªn `m1` dá»n: `format:check` PASS `0 debt` táº¡i m1 HEAD. Ghi trung thá»±c, khÃ´ng claim xanh táº¡i snapshot. |

## Disposition

- KhÃ´ng dispatch GitHub Actions (quota 3000/3000 phÃºt Ä‘Ã£ cáº¡n) â€” theo tiá»n lá»‡
  WWHN-292, evidence executed dÃ¹ng báº£n local exact-SHA nÃ y; CI run báº¥t biáº¿n cÃ³ thá»ƒ
  bá»• sung sau khi quota Ä‘Æ°á»£c cáº¥p láº¡i, khÃ´ng cháº·n closure.
- `SHA256SUMS` bÄƒm toÃ n bá»™ file trong thÆ° má»¥c (trá»« chÃ­nh nÃ³).
