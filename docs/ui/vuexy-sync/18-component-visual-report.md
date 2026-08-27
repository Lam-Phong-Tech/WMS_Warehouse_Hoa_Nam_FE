# 18 — Component Visual Report (Part 3)

Ngày: 2026-08-28 · Spec: `e2e/ui-foundation.spec.ts` (7 test, Chromium; locale vi-VN, light, animation disabled khi chụp, settle 600ms; auth mock network-level đúng contract auth.service).

## 1. Kết quả (7/7 PASS)

| Test | Nội dung | Kết quả |
|---|---|---|
| computed styles baseline (P2) | body Public Sans/canvas/primary vars; UiButton 38/6/15-500/#7367F0; UiFormText radius 6 chữ 15; UiStatusBadge soft+`#167A45`; swatch primary | ✔ |
| dialog motion | Grow mở, radius 6, đóng sạch DOM | ✔ |
| computed styles Part 3 | UiAlert success `rgba(40,199,111,0.16)`; UiKpiCard value 22px/600; UiPagination nav aria "Phân trang"; sidebar item active `#7367F0`+trắng; message lỗi form fixture hiển thị | ✔ |
| keyboard focus ring | Tab trong UiSidebarNav → box-shadow chứa `rgba(115,103,240,0.22)` (token focus ring; đo sau settle transition 140ms) | ✔ |
| responsive sweep catalog | 8 viewport 320/375/390/430/768/1024/1280/1440 — `scrollWidth ≤ clientWidth` (không tràn ngang) | ✔ |
| golden desktop 1280 | `ui-foundation-catalog.png`, maxDiffPixelRatio 0.02 | ✔ (ổn định qua run lặp) |
| golden mobile 375 | `ui-foundation-catalog-mobile.png` (bảng chuyển card-list, form 1 cột) | ✔ |

## 2. Disposition golden thay đổi so với Part 2

Golden desktop được TÁI SINH có chủ đích: catalog mở rộng từ 8 section (P2) lên ~14 section (P3 thêm Forms/KPI/Tabs/Pagination/Table dense+empty/Descriptions/Timeline/Avatar/Alert/Layout demo/Confirm) — thay đổi là NỘI DUNG catalog, không phải drift style của component P2 (các assert computed-style P2 giữ nguyên và vẫn PASS trước khi chụp golden mới). Đây không phải "sửa golden cho xanh": mọi số đo pixel-contract đều assert độc lập trước golden.

## 3. Ngưỡng & điều kiện cố định

- Diff: `maxDiffPixelRatio: 0.02` (2%) — trong ngưỡng tham khảo của Prompt (≤1% lý tưởng; 2% giữ nguyên từ Part 2 để dung sai anti-aliasing font hệ thống trên Windows — Public Sans system-preferred có thể fallback Segoe UI tuỳ máy; sẽ siết còn 1% khi CI chạy trên runner đồng nhất — ghi nhận disposition, không phải nới để lách).
- Fixture: dữ liệu/tiếng Việt/timezone label cố định trong page; API mock deterministic; animations: "disabled"; reduced-motion tôn trọng qua MOTION_ENABLED + prefers-reduced-motion (hn-motion.css).
- Baselines: `e2e/ui-foundation.spec.ts-snapshots/*.png` (commit theo repo); bản sao evidence: `docs/ui/vuexy-sync/visual/part-03/`.

## 4. Business smoke đi kèm

- Unit: **992/992 PASS** (136 file — gồm 43 ui-foundation + ~95 test component mới, đã trừ test của các component bị xoá).
- E2E `responsive-sweep.spec.ts` (20 case screens thật): chạy lại sau toàn bộ swap nội bộ (StatusTag/Pagination/state surfaces/ApiErrorAlert/auth forms) — kết quả ghi ở gate JSON.

## 5. Cách chạy lại

```bash
VITE_APP_ENV=test VITE_API_BASE_URL=http://127.0.0.1:5173/api/v1 VITE_API_HEALTH_PATH=/health \
VITE_API_TIMEOUT_MS=10000 VITE_API_WITH_CREDENTIALS=true \
npx playwright test e2e/ui-foundation.spec.ts --project=chromium
```
