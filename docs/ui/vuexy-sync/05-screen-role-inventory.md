# 05 — Screen / Role Inventory

Ngày: 2026-08-27 · SHA: `a908c420663270d783a34fd378689f7940377c85`
Router: `src/app/router/index.tsx` (createBrowserRouter). Guard: `ProtectedRoute` (session, fail-closed) → `MainLayout` → `RequirePermission` (RBAC, OR-semantics, fail-closed qua sentinel `__route.not_registered__` trong `access.ts`).

## 1. Master table — 100% route đã đăng ký (33 entries)

P0/P1/P2 = độ ưu tiên remediation UI (P0 = flow nghiệp vụ chính, lệch baseline nặng hoặc rủi ro cao).

| # | Route | SRS Screen | Permission (OR) | Page file | UI stack | Baseline gap chính | Risk | Ưu tiên |
|---|---|---|---|---|---|---|---|---|
| 1 | `/login` | — | public | `modules/auth/pages/LoginPage.tsx` | antd + MUI ActionButton | token cool + shell `.hn-login-page` custom | Cửa ngõ mọi user | **P0** |
| 2 | `/pv` | SCR-PV-01 | public | `modules/pv/pages/PvCatalogPage.tsx` | antd | public-facing, responsive 360/768/1280 theo SRS | Bộ mặt đối ngoại | **P0** |
| 3 | `/pv/products/:skuId` | SCR-PV-02 | public | `modules/pv/pages/PvProductDetailPage.tsx` | antd (18 inline style) | như trên | như trên | **P0** |
| 4 | `/change-password` | — | public (self-redirect) | `modules/auth/pages/ChangePasswordPage.tsx` | antd | token | forced-flow bảo mật | P1 |
| 5 | `/forgot-password` | — | public | `modules/auth/pages/ForgotPasswordPage.tsx` | antd (3-step OTP) | token | — | P1 |
| 6 | `/` → redirect `/dashboard` | — | protected | router/index.tsx:177 | — | — | — | — |
| 7 | `/dashboard` | (KPI – WWHN-327) | **any authenticated** | `modules/dashboard/pages/DashboardPage.tsx` (887 dòng) | **MUI thuần** + ApexCharts + DashboardPage.css | token cool; DashboardPage.css không import qua main.tsx (import cục bộ) + 3 breakpoint lạc (1100/800/560) | KPI lãnh đạo xem | **P0** |
| 8 | `/system/users` (+`/new`) | SCR-IAM-01 | `iam.user.view|manage` (`/new`: manage) | `modules/iam/pages/IamUsersGd1Page.tsx` | MUI shell + children mixed | mixed trong 1 flow | Admin | P1 |
| 9 | `/system/roles` | SCR-IAM-01 | `iam.role.view|manage|iam.permission.view` | `modules/iam/pages/IamRolePermissionScreen.tsx` | **antd thuần** (block import 18 dòng) + 14 inline style | antd đảo giữa vùng MUI | Admin | P1 |
| 10 | `/master-data/skus` (+`/new`) | SCR-MST-01 | `sku.view|manage` | `modules/master-data/pages/ApiMasterScreens.tsx` (2659 dòng) | **mixed nặng nhất**: MUI Dialog + antd Modal + Modal.confirm + raw `<table>`×3 + 3 lần ThemeProvider | 3 hệ modal trong 1 file | Master data lõi | **P0** |
| 11 | `/master-data/catalog` | SCR-MST-01 | `catalog.view|manage` | `CatalogMasterScreen.tsx` | MUI + antd DataTable | mixed | — | P1 |
| 12 | `/master-data/warehouse` | SCR-WH-01 | `warehouse.view|manage` | `WarehouseConfigScreen.tsx` | **MUI thuần** | token | single-warehouse config | P1 |
| 13 | `/master-data/agencies` (+`/new`) | SCR-AGY-01 | `agency.view|manage` | `ApiMasterScreens.tsx` | mixed | như #10 | — | **P0** |
| 14 | `/master-data/defects` (+`/new`) | SCR-DEF-01 | `defect.view|manage` | `ApiMasterScreens.tsx` | mixed | như #10 | — | **P0** |
| 15 | `/scan` | SCR-TRACE-01 | `inventory.trace|inventory.view` | `modules/scan/pages/PhysicalCodesPage.tsx` | mixed (antd + MUI Tabs) + 21 inline style | **không có trong SideNav** (chỉ URL trực tiếp) | truy vết | P1 |
| 16 | `/inbound` | SCR-IN-01 | `inbound.view|create|scan|post` | `modules/inbound/pages/InboundPage.tsx` + `MvpInboundScreens.tsx` (1642 dòng, 3× ThemeProvider) | mixed | flow Post Receipt — scan-focus theo Annex D | **Stock-changing** | **P0** |
| 17 | `/putaway` | — (Annex D putaway) | `putaway.view|manage|container.view|manage` | `MvpPutawayPage.tsx` (2× ThemeProvider) | mixed | — | — | P1 |
| 18 | `/outbound` | SCR-OUT-01 / SCR-REQ-OUT-01 / SCR-LBL-01 | `outbound.view|scan|post|import|request.*` | `AlignedMvpOutboundPage.tsx` + 2 modal lớn (3× ThemeProvider trong detail modal) | mixed | flow Post Issue + Packing Label — gate nghiệp vụ nặng nhất SRS | **Stock-changing** | **P0** |
| 19 | `/inventory` | SCR-INV-01 | `inventory.view` | `InventoryPage.tsx` + BalanceDetailModal/TraceModal | mixed (list MUI table + modal antd Table) | 2 kiểu bảng cùng flow | tồn kho | **P0** |
| 20 | `/warranty` | SCR-WAR-01 / SCR-COMP-01 | `warranty.view|manage|component_issue` | `WarrantyPage.tsx` + 3 modal (WarrantyDetailModal 2122 dòng) | mixed + antd `message` (offender toast duy nhất) | PII masking theo SRS §13.8 | PII | **P0** |
| 21 | `/reverse` | SCR-REV-01 | `inventory.view|inventory.reversal.post` | `ReversalPage.tsx` + 2 modal | mixed | confirm stock-effect theo SRS | **Stock-changing** | **P0** |
| 22 | `/reports` | SCR-RPT-01 | `report.view` | `ReportsPage.tsx` (MUI tab shell) + `AlignedReportsPage.tsx` (2860 dòng, **38 inline style** — nhiều nhất repo) + `Gd1ScopeReports.tsx` | mixed + ApexCharts | 8 nhóm báo cáo Flow-06; export theo `report.export`/`warranty.pii.export` | lãnh đạo + PII export | **P0** |
| 23 | `/audit-logs` | — | `audit_log.view` | `AuditLogsPage.tsx` | mixed | — | audit | P2 |
| 24 | `/notifications` | — | any authenticated | `NotificationsPage.tsx` | antd | **không có breadcrumb** (thiếu trong menu.tsx MENU) | — | P2 |
| 25 | `/component-catalog` | — | DEV-only (`import.meta.env.DEV` — router/index.tsx:305, access.ts:86) | `ComponentCatalogPage.tsx` | antd | catalog demo lệch chuẩn thật | — | P2 |
| 26 | `/pv-admin` | SCR-PV-ADM-01 | `pv.master.manage|pv.publish` | `PvAdminPage.tsx` (2× ThemeProvider) | mixed | **không có trong SideNav** (comment menu.tsx:180-183 nói đã fix nhưng fix vào MENU breadcrumb, không vào NAV_GROUPS) | publish flow | P1 |
| 27 | `/profile` | — | any authenticated | `ProfilePage.tsx` | antd (antd Table trực tiếp) | vào từ UserMenu | — | P2 |
| 28 | `/errors/403` | — | protected (không RequirePermission, không MainLayout) | `NoPermissionPage.tsx` | antd | trang đích deny của RequirePermission | UX deny đúng SRS | P1 |
| 29 | `*` | — | — | `<Navigate to="/" replace/>` (router/index.tsx:337) | — | **KHÔNG CÓ trang 404** — mọi URL sai lặng lẽ về dashboard | UX + debug khó | P1 |

Role model: **permission-code based** (đúng system-design.md) — 62 keys / 60 distinct codes trong `src/shared/constants/wms-permissions.ts` + `WMS_PERMISSION_ALIASES` + `WMS_ACTION_PERMISSIONS` (24 action bundles); bypass duy nhất `SUPER_ADMIN` (`auth.store.ts` — `role_code === "SUPER_ADMIN"`). Đối chiếu đủ các nhóm: iam(6), master(10), pv(2), item_instance(2), scan(4, 2 deprecated), inventory(3), inbound(5), container/putaway(4), outbound(8), label/packing_label(6), physical_code(2), warranty(6), report(2), audit(1). Đã gỡ theo BE 27/08: `master.manage`, `outbound.create`. Không tồn tại permission stocktake (đúng REQ-SRS-037).

## 2. Đối chiếu SRS §8.3 / Annex D — coverage

| SRS Screen | Route thực tế | Trạng thái |
|---|---|---|
| SCR-IAM-01 | `/system/users`, `/system/roles` | ✔ |
| SCR-WH-01 | `/master-data/warehouse` | ✔ |
| SCR-MST-01 / SCR-AGY-01 / SCR-DEF-01 | `/master-data/*` | ✔ |
| SCR-IN-01 | `/inbound` | ✔ (scan-focus cần giữ khi retheme) |
| SCR-OUT-01 / SCR-REQ-OUT-01 / SCR-LBL-01 / CMP-LBL-01 | `/outbound` (+modals) | ✔ |
| SCR-REV-01 | `/reverse` | ✔ |
| SCR-INV-01 / SCR-TRACE-01 | `/inventory`, `/scan` | ✔ (`/scan` thiếu nav entry) |
| SCR-WAR-01 / SCR-COMP-01 | `/warranty` (+modals) | ✔ |
| SCR-RPT-01 | `/reports` | ✔ |
| SCR-PV-01 / SCR-PV-02 / SCR-PV-ADM-01 | `/pv`, `/pv/products/:id`, `/pv-admin` | ✔ (pv-admin thiếu nav entry) |
| CMP-CAM-01 | `CameraScanModal` (shared, antd) | ✔ component |

Không route nào thiếu so với SRS baseline; không route stocktake (đúng). Route constants mồ côi: `ORG_UNITS`, `EMPLOYEE_ASSIGNMENTS`, `USER_ROLE_SCOPES` (`shared/constants/routes.ts:50-52`) — không có page/permission, chỉ test tham chiếu.

## 3. Phát hiện rủi ro & sai lệch (ngoài UI token)

### SEC-RBAC-01 (P0 — bảo mật UX-gate, PHÁT HIỆN TRONG AUDIT, độc lập với UI migration)
`MainLayout.renderMvpScreen()` (`src/app/layouts/MainLayout.tsx:286-363`) render trực tiếp `IamUsersGd1Page`, `SkuMasterScreen`, `AgencyMasterScreen`, `DefectMasterScreen`, `InboundPage`, `PutawayPage`, `OutboundPage`, `WarrantyPage`, `InventoryPage`, `ReversalPage`, `ReportsPage` **theo query param `?screen=` THAY CHO `<Outlet/>`**, tức nằm NGOÀI `RequirePermission` của route đích. User chỉ có quyền dashboard vẫn mount được màn IAM qua `/dashboard?screen=IAM-01`; chỉ còn BE chặn API. Theo README RBAC ("Route/menu guard chỉ là UX gate") thì boundary cuối vẫn là BE, nhưng cơ chế này vô hiệu hoá UX-gate đã cam kết trong SRS (403 phải hiển thị đúng trạng thái no-permission) và làm màn hình rác dữ liệu rỗng/lỗi. **Khuyến nghị: tạo ticket riêng, sửa trước hoặc trong Prompt 2 phần shell** (renderMvpScreen cũng chính là chướng ngại kiến trúc của layout migration).

### NAV-01 (P1)
Hai nguồn nav lệch nhau: `SideNav.NAV_GROUPS` (render thật) vs `menu.tsx MENU` (breadcrumb + test RBAC). Lệch: `/scan`, `/pv-admin` (mất khỏi sidebar), `/notifications` (mất breadcrumb), nhóm/nhãn khác nhau. Breadcrumb và sidebar-highlight có thể mâu thuẫn.

### NAV-02 (P1)
Không có trang 404; catch-all về `/`. `middleware.ts` chết còn redirect `/403` — path không tồn tại (`/errors/403` mới đúng).

### DEAD-01 (P2)
Dead: `PartnerLayout.tsx` (nguyên shell đối tác), `AppHeader.tsx`, `AppFooter.tsx`, `menu.toMenuItems()`, `src/middleware.ts` (cả 2 export), `modules/shipping/` (service+types không page), `modules/receiving/ReceivingPage.tsx` (shim re-export có chủ đích — giữ).

## 4. Ma trận state (Loading/Empty/Error/Confirm) — theo Annex D
Các trang list dùng chuẩn chung: `PageSkeleton` (lazy fallback), `EmptyState`/`tableEmptyText`, `ApiErrorAlert` + request_id, confirm cho hành động stock-changing (Post/Reversal) — nhất quán về LOGIC nhưng render bằng 2 engine tuỳ trang (antd Result/Empty vs MUI Alert/Dialog). Khi retheme phải giữ nguyên hợp đồng state (Annex D: skeleton, disable-duplicate-action, inline error + request_id, confirm nêu stock effect, scan-focus giữ focus sau success/error) — đây là ràng buộc nghiệm thu, không phải styling tự do.
