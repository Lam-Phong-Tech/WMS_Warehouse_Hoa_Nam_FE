# 28 — Bundle / Performance Report (Part 5)

> So sánh trước/sau cleanup Part 5 (cùng máy, cùng vite build production). Số thô nằm trong transcript integration (bundle-before/after) và tái lập được bằng `yarn build` tại 2 SHA.

## 1. Kích thước

| Chỉ số | Part 4 output (e3044d6) | Part 5 (sau cleanup) | Δ |
|---|---|---|---|
| JS tổng (dist/assets) | 3684.2 KB / 88 file | **3372.5 KB / 88 file** | **−311.7 KB (−8.5%)** |
| CSS tổng | 175.6 KB / 1 file | 175.6 KB / 1 file | 0 |
| Toàn dist | 5819.5 KB / 98 file | 5507.9 KB / 98 file | −311.6 KB |

Nguồn giảm: chunk `components-*.js` 312.4 KB (antd Table + tooltip-sort adapter) biến mất khi DataTable-family bị xoá và PvAdminPage dùng ResponsiveDataTable (đã có sẵn trong chunk dùng chung).

Top chunks sau cleanup: react-apexcharts 867.5 KB (lazy theo màn chart), ui 829.4 KB (MUI foundation), vendor-xlsx 275.6 KB (lazy import/export), vendor-react 177.5 KB, actions 115.9 KB.

## 2. Acceptance theo mục 11 của prompt

- **Initial JS/CSS không tăng** — GIẢM 8.5% JS, CSS giữ nguyên. ✔
- **Không duplicate font family runtime** — chỉ Flaticon icon-font + system-stack Public Sans (không webfont); guard font trong `ui:tokens`. ✔
- **Không import cả icon/component library** — icon qua shim per-name (tree-shake theo slug); `@ant-design/icons` đã GỠ khỏi dependencies; MUI import theo path/barrel tree-shakeable. ✔
- **Không duplicate provider/style injection** — 1 `AppThemeProvider` (guard + negative test #8); 1 Emotion cache + antd cssinjs cho remnant (không đổi). ✔
- **Route lazy loading không regression** — số chunk giữ nguyên 88, cấu trúc route-chunk như Part 4; health:check + E2E điều hướng toàn route PASS. ✔
- **Không layout shift nghiêm trọng do font/icon/image** — không đổi cơ chế load font/icon; sweep 10 viewport không phát hiện shift/overflow mới. ✔
- **Before/after report lưu lại** — bảng trên + log build 2 lần trong transcript; dist hiện hành build từ đúng cây Part 5. ✔

Không có disposition tăng size nào cần ghi (chỉ giảm).
