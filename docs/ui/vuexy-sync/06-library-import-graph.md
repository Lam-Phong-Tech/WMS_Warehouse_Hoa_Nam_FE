# 06 — Library Import Graph

Ngày: 2026-08-27 · SHA: `a908c420663270d783a34fd378689f7940377c85` · Phạm vi: `src/` (416 file .ts/.tsx)

## 0. Grep patterns (tái lập được)

```bash
# đếm file theo package (specifier + subpath)
grep -rlE "from \"<PKG>([\"/])" src --include="*.ts" --include="*.tsx"
# bucketing theo thư mục
| awk -F/ '{ if ($2=="modules") print "src/modules/"$3; else print "src/"$2 }' | sort | uniq -c
# raw HTML controls
grep -rlE "<(button|input|select|table|textarea)(\s|>|$)" src/modules src/app --include="*.tsx" | grep -v "\.test\.tsx"
```

## 1. Tổng số file import theo package

| Package | Tổng file | src/app | src/shared | src/modules | Ghi chú |
|---|---|---|---|---|---|
| `antd` (mọi subpath) | **93** | 8 | 44 | 41 | 102 câu import `"antd"` + 9 subpath (`antd/es/table` ×6, locale, SizeContext, table/interface) |
| `@mui/material` | **59** (+6 file `@mui/material/styles`) | 3 (+2) | 18 | 38 (+4) | |
| **Import CẢ HAI antd + MUI** | **29** | 2 | 1 | 26 | danh sách đầy đủ §2 |
| `@ant-design/icons` | **0** | — | — | — | **dependency chết** trong package.json (^6.2.5) — chỉ còn trong comment/docs |
| `@emotion/react` / `@emotion/styled` | **0** | — | — | — | chỉ là engine nội bộ MUI (peer deps); không first-party styling |
| `@flaticon/flaticon-uicons` | 1 | — | — | — | side-effect CSS duy nhất: `src/main.tsx:7` |
| `sonner` | 30 | 2 | 1 | 26 | 189 call sites (error 88 / success 81 / warning 14 / info 6) |
| `dayjs` (+2 plugin) | 13 | 0 | 2 | 10 | +1 test |
| `react-hook-form` | 13 | 0 | 10 | 3 | RHF chỉ sống ở shared/forms (antd) + 3 trang auth |
| `@hookform/resolvers` | 4 | 0 | 1 | 3 | |
| `zod` | 5 | 0 | 2 | 3 | chỉ auth schemas + useFormPattern |
| `apexcharts` / `react-apexcharts` | 5/5 | 0 | 4 | 1 | |
| `react-transition-group` | 1 | 0 | 1 | 0 | AnimatedList |
| tailwind / bootstrap / styled-components | **0** | — | — | — | xác minh sạch (không dep, không import, không directive) |

### Phân bố antd/MUI theo module

| Module | antd | MUI | | Module | antd | MUI |
|---|---|---|---|---|---|---|
| pv | 5 | 1 | | master-data | 2 | 4 |
| auth | 5 | 1 | | inbound | 2 | 3 |
| reverse | 4 | 3 | | putaway | 1 | 3 |
| warranty | 3 | 4 | | iam | 1 | 2 |
| outbound | 3 | 3 | | errors | 1 | 0 |
| notifications | 3 | 1 | | component-catalog | 1 | 0 |
| inventory | 3 | 3 | | dashboard | 0 | 3 |
| audit-logs | 3 | 3 | | shipping/receiving | 0 | 0 |
| scan | 2 | 2 | | reports | 2 | 2 |

→ **Không module nghiệp vụ nào thuần một engine** (trừ dashboard thuần MUI và errors/component-catalog thuần antd).

## 2. 29 file import ĐỒNG THỜI antd + @mui/material (worklist chính của migration)

`src/app/layouts/UserMenu.tsx` · `src/app/providers/AppProviders.tsx` · `src/modules/audit-logs/components/AuditLogDetailDrawer.tsx` · `src/modules/audit-logs/components/AuditLogsTable.tsx` · `src/modules/audit-logs/pages/AuditLogsPage.tsx` · `src/modules/auth/components/ContextSwitcher.tsx` · `src/modules/inbound/pages/InboundPage.tsx` · `src/modules/inbound/pages/MvpInboundScreens.tsx` · `src/modules/inventory/components/BalanceDetailModal.tsx` · `src/modules/inventory/components/TraceModal.tsx` · `src/modules/inventory/pages/InventoryPage.tsx` · `src/modules/master-data/components/SkuImportModal.tsx` · `src/modules/master-data/pages/ApiMasterScreens.tsx` · `src/modules/notifications/components/NotificationBell.tsx` · `src/modules/outbound/components/AlignedOutboundDetailModal.tsx` · `src/modules/outbound/components/OutboundIntakeModal.tsx` · `src/modules/outbound/pages/AlignedMvpOutboundPage.tsx` · `src/modules/putaway/pages/MvpPutawayPage.tsx` · `src/modules/pv/pages/PvAdminPage.tsx` · `src/modules/reports/pages/AlignedReportsPage.tsx` · `src/modules/reverse/components/ReversalCreateModal.tsx` · `src/modules/reverse/components/ReversalDetailModal.tsx` · `src/modules/reverse/pages/ReversalPage.tsx` · `src/modules/scan/components/IssuePhysicalCodeModal.tsx` · `src/modules/scan/pages/PhysicalCodesPage.tsx` · `src/modules/warranty/components/ComponentIssueModal.tsx` · `src/modules/warranty/components/WarrantyDetailModal.tsx` · `src/modules/warranty/pages/WarrantyPage.tsx` · `src/shared/components/mvp/MvpListPagination.tsx`

## 3. Provider / theme graph

```text
main.tsx
 ├─ import CSS (thứ tự quyết định cascade):
 │   flaticon → index.css → hoa-nam-wireframe → hoa-nam-ant-overrides → hn-wms-mvp-exact
 │   → hn-wms-page-normalize → hn-wms-sidebar-account → hn-wms-source-screen → hn-responsive → hn-motion
 └─ <AppProviders>                        src/app/providers/AppProviders.tsx
     └─ QueryProvider
        └─ MuiThemeProvider theme={muiTheme}          ← MUI root (mui-theme.ts, createTheme DUY NHẤT)
           └─ ConfigProvider theme={themeConfig} locale=viVN   ← antd root (theme.ts)
              └─ AntdApp
                 └─ ErrorBoundary → Toaster (sonner) → children
```

- `createTheme`: **1 site** (`src/app/mui-theme.ts:31`).
- antd `ConfigProvider`: **1 site thật** (AppProviders.tsx:36) + 1 mock test (`src/test/setup.ts:397`).
- `StyleProvider` (@ant-design/cssinjs): **0** — không kiểm soát thứ tự inject của antd cssinjs.
- **MUI `ThemeProvider`: 37 file, ~48 render sites** — 1 root + **36 file re-wrap lại đúng `muiTheme`** (một số file wrap 2-3 lần: `MvpInboundScreens` ×3, `ApiMasterScreens` ×3, `AlignedOutboundDetailModal` ×3, `MvpPutawayPage` ×2, `PvAdminPage` ×2). Chỉ 2 chỗ có lý do được ghi chú (ActionDropdown.tsx:74-76 — portal ra ngoài cây; MvpListPagination.tsx:38-39 thừa nhận nested). 34 file còn lại là redundant sau khi root provider đã có ở AppProviders (thêm từ commit a908c42/5df4f21).

Danh sách đầy đủ 36 file re-wrap (file:import-line/render-lines): UserMenu.tsx:9/62,159 · AuditLogDetailDrawer.tsx:10/110,198 · AuditLogsPage.tsx:7/134,270 · ContextSwitcher.tsx:8/51,136 · DashboardPage.tsx:14/335,885 · IamUserScreen.tsx:32/692,1722 · IamUsersGd1Page.tsx:2/25,54 · InboundDraftModal.tsx:11/242,425 · InboundPage.tsx:4/262,366 · MvpInboundScreens.tsx:17/293,337·954,1617·1629,1642 · BalanceDetailModal.tsx:11/318,488 · TraceModal.tsx:12/208,1109 · InventoryPage.tsx:15/459,745 · SkuImportModal.tsx:13/510,730 · ApiMasterScreens.tsx:28/655,1497·1714,2190·2359,2659 · CatalogMasterScreen.tsx:19/489,829 · WarehouseConfigScreen.tsx:21/268,598 · NotificationBell.tsx:3/56,200 · AlignedOutboundDetailModal.tsx:15/561,566·572,584·589,1124 · OutboundIntakeModal.tsx:15/462,905 · AlignedMvpOutboundPage.tsx:5/289,396 · TraySelectionGrid.test.tsx:4/110,118 · MvpPutawayPage.tsx:19/659,724·773,1071 · PvAdminPage.tsx:22/324,415·669,1045 · AlignedReportsPage.tsx:27/2816,2860 · ReportsPage.tsx:2/12,35 · ReversalCreateModal.tsx:19/230,771 · ReversalDetailModal.tsx:17/213,677 · ReversalPage.tsx:9/229,377 · IssuePhysicalCodeModal.tsx:14/197,378 · PhysicalCodesPage.tsx:4/547,580 · ComponentIssueModal.tsx:15/366,778 · WarrantyDetailModal.tsx:23/803,2122 · WarrantyIntakeModal.tsx:15/371,798 · WarrantyPage.tsx:9/270,473 · ActionDropdown.tsx:7/117,152 · MvpListPagination.tsx:2/40,55.

## 4. Raw HTML controls trong modules/app (bypass shared UI)

Chỉ **9 file** (rất sạch): `ApiMasterScreens.tsx` (`<table>`×3) · `SideNav.tsx` (`<button>`×3) · `WarrantyIntakeModal.tsx`/`WarrantyDetailModal.tsx` (`<input>`×2 mỗi file — file picker ẩn) · `Gd1ScopeReports.tsx`, `OutboundIntakeModal.tsx`, `SkuImportModal.tsx` (`<input>`×1) · `AlignedOutboundDetailModal.tsx` (`<select>`×1) · `IamUserScreen.tsx` (`<table>`×1). Trong shared, 6 file dùng raw hợp lệ (ResponsiveDataTable, SortableTh, MvpListPagination, MvpSelectionCell, PwaStatus, DocumentAttachmentsPanel).

## 5. Icon / toast / duplicate style injection

- **Icon**: 1 family duy nhất (Flaticon shim `shared/components/icons/index.tsx`, 90 icons, 35 consumers); `@mui/icons-material` không tồn tại (IamUserScreen.tsx:223 có comment chủ động né việc thêm dep); 1 file mixed shim+inline-SVG (IamUserScreen).
- **Toast**: sonner thống trị (30 file); sót antd `message` (WarrantyPage.tsx — 1 file) và `Modal.confirm` (ApiMasterScreens.tsx:127 + shared ConfirmDialog.tsx:31 không ai dùng).
- **Duplicate style injection runtime**: antd cssinjs + Emotion(MUI) cùng inject `<style>` vào `<head>` không thứ tự cố định so với 10 file CSS tĩnh — chính comment `hn-motion.css:296-303` thừa nhận "cùng một selector khai ở hai nơi sẽ 'ai thắng tùy lúc'". Xem CSS-Register `07-css-conflict-register.md`.

## 6. Dependencies gỡ được ngay (sau xác nhận)

| Dep | Lý do |
|---|---|
| `@ant-design/icons` | 0 import — chết hoàn toàn |
| (giữ) `@emotion/*` | bắt buộc cho MUI |
| Inter font link trong `index.html` | tải nhưng không bao giờ render (Arial thắng cascade) |
| `@import` Be Vietnam Pro (`hoa-nam-wireframe.css:1`) | chỉ còn heading dùng; sẽ chết hẳn khi retire hệ warm (BC-04) |
