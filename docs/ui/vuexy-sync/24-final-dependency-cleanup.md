# 24 — Final Dependency/Style Cleanup (Part 5)

> Nguyên tắc: chỉ xoá khi CHỨNG MINH bằng consumer-scan + build + tests + runtime; không xoá vì tên "legacy". Rollback: mọi xoá nằm trong checkpoint commit riêng của Part 5 — revert 1 commit là khôi phục.

## 1. Dependency đã GỠ (yarn remove, lockfile cập nhật)

| Package | Loại | Bằng chứng chết | Ghi chú |
|---|---|---|---|
| `lodash-es` + `@types/lodash-es` | runtime + dev | grep `lodash` toàn src/scripts/e2e/vite.config = 0 import | dep chết từ trước |
| `puppeteer` | dev | grep toàn scripts/e2e/.husky = 0 usage (E2E dùng @playwright/test) | ~180MB node_modules |
| `@emotion/babel-plugin` | dev | vite.config không cấu hình babel plugin nào | không tham gia build |
| `@ant-design/icons` | runtime | 0 import trực tiếp trong src (icon đã hợp nhất về shim Flaticon `@/shared/components/icons` từ Part 2–4; 2 file từng match chỉ là COMMENT) | antd vẫn tự mang icon nội bộ transitively cho phần adapter còn lại |

Guard `ui:dependencies` (MỚI) cấm các package này quay lại (forbidden-list) và bắt mọi runtime dep không còn import (dead-dep ratchet).

## 2. Component/adapter đã XOÁ (consumer = 0, chứng minh bằng scan + test)

| File | Vì sao xoá được | Việc kèm theo |
|---|---|---|
| `data-display/DataTable.tsx` (antd Table adapter) | consumer cuối PvAdminPage (3 bảng) đã migrate sang `ResponsiveDataTable` trong Part 5 — pv tests 24/24 giữ nguyên PASS, comparator sort giữ ngữ nghĩa (localeCompare "vi"/numeric) | barrel `@/shared/components` gỡ export; selection antd `selectedRowKeys` (không gắn hành động nào) → `useRowSelection` |
| `data-display/PageSizeSelector.tsx` | internal-only của DataTable | — |
| `data-display/useSortTooltipColumns.ts` | internal của DataTable (tooltip sort antd) | type `SortWordingType` chuyển về `useClientSort.ts` (nhà mới của họ sort) — import ở RDT/SortableTh retarget |
| `forms/SubmitButton.tsx` | 0 feature consumer; vai trò emitter WWHN-268 "disabled" đã thuộc ActionButton (phát hook khi bị khóa VÌ QUYỀN) | `ui-state.test.tsx` chuyển assertion sang ActionButton (semantics chặt hơn: hook chỉ phát khi permission-block) |

Allowlist `direct-ui-imports.json` thu hẹp 27 → **24 file** (regenerate ratchet). `deprecated-components.json` gỡ 4 entry đã xoá; các adapter còn consumer GIỮ ĐÓNG BĂNG với owner/deadline mới (doc 29 §4).

## 3. Style/injection

- Font: chỉ Flaticon Uicons CSS (main.tsx) + Public Sans system-stack từ tokens — không webfont, không duplicate family (guard font trong `ui:tokens`).
- Style injection: 1 Emotion cache (MUI mặc định) + antd cssinjs cho adapter remnant — không đổi so với Part 4; provider duy nhất `AppThemeProvider` (guard + negative test #8).
- CSS: giữ nguyên 7 lớp manifest của Part 4 (đã token-hoá 100%); không xoá thêm trong Part 5 (5 lớp còn lại đều có consumer thật — audit Part 4).

## 4. Bundle before/after (vite build, dist/, cùng máy)

| Chỉ số | Before (Part 4 output e3044d6) | After (Part 5 cleanup) | Δ |
|---|---|---|---|
| JS tổng | 3684.2 KB (88 file) | **3372.5 KB** (88 file) | **−311.7 KB (−8.5%)** |
| CSS tổng | 175.6 KB (1 file) | 175.6 KB | 0 |
| Chunk lớn nhất biến mất | `components-*.js` 312.4 KB (antd Table adapter chunk) | — | đúng bằng phần DataTable/antd-table bị gỡ |
| Toàn dist | 5819.5 KB | 5507.9 KB | −311.6 KB |

Route lazy-loading giữ nguyên cấu trúc chunk (88 file như cũ, chỉ mất chunk adapter); không layout shift mới (không đổi font/icon load). Báo cáo thô: log build hai lần chạy trong transcript Part 5 (bundle-before/after).

## 5. Exceptions còn giữ (owner/reason/deadline — không có P0/P1)

1. `@emotion/styled` không có import trực tiếp (peer engine của MUI; ESLint cấm import tay) — khai trong `INDIRECT_RUNTIME_DEPS` của guard kèm lý do.
2. Adapter deprecated còn consumer (StatusTag/TopPagination/PageHeader/MvpPaginationFooter/MvpPageSizeSelector/ReportKpi*) — freeze chỉ-giảm, deadline "gỡ antd remnant" (doc 29 §4).
3. `antd` (ScanInput/CameraScanModal/DatePicker + ConfigProvider) — remnant CÓ CHỦ ĐÍCH theo Annex D scan-flow + dayjs contract (ADR Part 2/4); không phải duplicate stack vì được cấp phát token qua antd-adapter duy nhất.
4. `xlsx` chunk 275.6 KB — lazy theo route import/export (SkuImportModal/AuditLogs), giữ.
