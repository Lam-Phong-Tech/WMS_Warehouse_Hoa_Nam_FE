# 21 — Full-App Visual Report (Part 4)

> Bằng chứng thị giác/responsive/a11y/console-network sau khi migrate toàn app về canonical (DEC-UI-BASELINE-01 — Vuexy live demo-1).

## 1. Visual regression (golden)

| Golden | Trạng thái | Ghi chú |
|---|---|---|
| `ui-foundation-catalog-chromium-win32.png` (desktop 1280, full catalog ~14 section) | PASS (regenerate có disposition) | Sau CSS-teardown, container catalog rộng 906→936px (padding lớp wireframe bị xoá) — nội dung component không đổi; đã XEM ảnh actual desktop+mobile trước khi update (doc 22 ledger). Sau đó pass lại nguyên trạng ở mọi lượt chạy (kể cả sau khi thêm hooks WWHN-268 vào catalog). |
| `ui-foundation-catalog-mobile-chromium-win32.png` (mobile 375) | PASS (cùng disposition) | Card/table→stack, không tràn ngang. |
| maxDiffPixelRatio | 0.02 (giữ nguyên ngưỡng Part 3 — không nới để lách) | |

Golden phủ P0-foundation (toàn bộ bộ mặt component canonical). Visual per-screen được phủ bằng screenshot-matrix + evidence PNG per-scenario (mục 2) — đúng chiến lược Part 3/4: golden cho foundation, screenshot có metadata cho màn nghiệp vụ.

## 2. Responsive screenshot matrix

- **`responsive-sweep`**: 10 viewport (320/375/390/768/820/1024/1280/1366/1440/1920) × 27 route (mọi màn + deep-link modal MST-02/AGY-02/DEF-02/IAM-02/WAR-02/IN-02/REV-01/OUT-REQ-01…): kiểm scrollWidth (không tràn ngang), nav/hamburger theo contract shell (≥980 sidebar 260; <980 hamburger + Drawer), title topbar, modal không rộng hơn viewport; screenshot màn tiêu biểu mỗi viewport lưu `test-results/responsive-sweep/`. Kết quả: 19/20 run đầy đủ + 1366 solo pass (flake IO — doc 20 §4).
- **Catalog 8-viewport** (`ui-foundation` Part 3 test): 320→1440 không tràn ngang — PASS.
- **Ma trận riêng per-ticket**: wwhn-217 (3 flow × 3 viewport), wwhn-242 (4 viewport × list/detail/confirm), wwhn-248 (360/768/1440), wwhn-258 (390/768/1366), wwhn-175 (login+catalog ×3), wwhn-292 (10 viewport shell + per-route), wwhn-327 (3 viewport KPI), wwhn-253 (PV public ma trận khung nhìn) — tất cả PASS, PNG+JSON trong `test-results/wwhn-*/`.

Lỗi responsive THẬT bắt được và đã sửa trong integration (doc 22 §3b): topbar tràn ngang viewport hẹp khi tên user dài → `UserMenu compact` mobile + `minWidth:0`.

## 3. A11y

- **Engine matrix wwhn-274**: login semantics (label liên kết input, heading, focus đầu autoFocus) trên Desktop Chrome 1440 / Chrome Android (Pixel 5) / Safari iOS (iPhone 13) — PASS. Keyboard-only (desktop): Tab-order, focus NHÌN THẤY được (chỉ báo focus MUI = đổi màu/độ dày viền `.MuiOutlinedInput-notchedOutline` — spec đo đúng kênh này thay outline/box-shadow của antd cũ), Enter kích hoạt validation — PASS.
- **wwhn-175**: keyboard mở/đóng dialog + focus trả về trigger (UiDialog/MUI focus-trap) — PASS.
- **Cải thiện a11y do Part 4** (doc 22): mọi dialog có accessible name (UiDialog auto `aria-labelledby`; WarrantyIntakeModal trước đây KHÔNG có tên); nền sau modal bị aria-hidden đúng chuẩn (hết double-button trong a11y tree); radio-group có role + arrow-key native; `aria-labelledby="reversal-post-confirm-title"` (wwhn-242) giữ tường minh.

## 4. Console / network

- Console error trong E2E: phát hiện và SỬA 2 lỗi thật trong integration — NotificationBell crash `items.map` (sập shell) và React "Received NaN for children" (badge chuông + UiPagination) — cả hai fix tận gốc (store/canonical), các lượt chốt không còn error này; unit setup vẫn fail-on-console như trước pipeline.
- Duplicate network: wwhn-217 "bấm tiếp không tạo bão request" (duplicate-click guard) + retry đúng số lần + Idempotency-Key duy nhất — PASS; wwhn-178 endpoint-pin: màn MST-01 chỉ gọi bề mặt swagger pin (traffic shell NotificationBell tách riêng, vẫn thuộc pin chung) — PASS.
- PWA/offline: wwhn-325 ×2 (offline banner + mutation guard qua UI thật) — PASS.

## 5. Kết luận thị giác

Toàn bộ 29 route inventory (doc 19) có bằng chứng thị giác ở ít nhất 3 lớp (sweep + matrix per-ticket + golden foundation), 0 P0/P1 thị giác còn mở; khác biệt có chủ đích (control 38px, radio thay toggle, dividers dialog, preset-only dashboard…) được kê trong doc 19 (Tồn dư) + doc 22 (§4) với disposition.
