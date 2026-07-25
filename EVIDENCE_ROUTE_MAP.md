# Evidence: Route Map M1/M2/M3 & Sidebar Navigation

## ✅ Acceptance Criteria

### Menu có M1/M2/M3; M1 route active; M2/M3 có placeholder/page shell nếu chưa implement

**Status: Code hoàn thành (FE) — cần BE seed permission M3 trước khi nghiệm thu được**

> Cập nhật 2026-07-14: đã fix `AUDIT_VIEW` → `AUDIT_LOG_VIEW` trong `src/app/router/access.ts`
> để khớp với BE catalog. Đã bổ sung test coverage cho navigation helpers.

## 📦 Deliverables

### 1. Route Tree Structure

Route hiện là **flat routes** (children trực tiếp của `MainLayout`, chưa có tree prefix
kiểu `/organization/*`, `/warehouse/*`, `/business/*`). Nguồn: `src/shared/constants/routes.ts`,
`src/app/router/index.tsx`.

#### Module 1 - Organization (Hoạt động)

```
/org-units             → OrgUnitsPage (Đơn vị tổ chức, có branch-mode /org-units?mode=branch)
/departments           → DepartmentsPage (Phòng ban)
/employees              → EmployeesPage (Nhân viên)
/positions              → PositionsPage (Chức vụ)
/roles                  → RolesPage (Vai trò & quyền)
/org-chart              → OrgChartPage (Sơ đồ tổ chức)
/employee-status        → EmployeeStatusPage (Vòng đời trạng thái)
/employee-assignments   → EmployeeAssignmentsPage (Điều chuyển công tác)
/user-role-scopes       → UserRoleScopesPage (Phân quyền người dùng)
/tasks                  → TasksPage (Giao việc)
/audit-logs             → AuditLogsPage (Nhật ký kiểm tra)
```

> Ghi chú: `/companies` (Công ty / Pháp nhân) **chưa có trong router hiện tại**. Module
> `companies` đã có code (components/services/hooks — commit `3df1a0d`) nhưng chưa được
> nối route/menu/permission. Nếu cần đưa vào M1, đây là việc còn tồn đọng riêng, không
> tính vào phạm vi task Route Map này.

#### Module 2 - Warehouse (Placeholder)

```
/warehouse           → WarehousePage (Quản lý kho - Module 2 dashboard)
/warehouses          → WarehousesPage (Kho hàng)
/stock-receipts      → StockReceiptsPage (Phiếu nhập kho)
/stock-issues        → StockIssuesPage (Phiếu xuất kho)
/stock-transfers     → StockTransfersPage (Điều chuyển kho)
/inventory-balance   → InventoryBalancePage (Tồn kho)
/stock-movements     → StockMovementsPage (Biến động tồn)
```

#### Module 3 - Business (Placeholder)

```
/business            → BusinessPage (Quản lý kinh doanh - Module 3 dashboard)
/products            → ProductsPage (Sản phẩm)
/price-lists         → PriceListsPage (Bảng giá)
/customers           → CustomersPage (Khách hàng)
/sales-orders        → SalesOrdersPage (Đơn hàng)
/sales-channels      → SalesChannelsPage (Kênh bán hàng)
```

### 2. Files chính (nguồn của route/permission/menu)

- `src/shared/constants/routes.ts` - Khai báo path constants
- `src/app/router/index.tsx` - Định nghĩa route tree, bọc `RequirePermission`
- `src/app/router/access.ts` - `ROUTE_PERMISSIONS`: nguồn DUY NHẤT map route → permission
  code (dùng chung cho route guard và lọc menu)
- `src/app/layouts/menu.tsx` - `MENU` (cấu trúc sidebar), `filterMenu`, `getSelectedKey`,
  `getOpenKeys`, `getBreadcrumb`

### 3. Sidebar Navigation Structure

```
┌─────────────────────────────────────┐
│ Module 1 · Tổ chức                   │
│   ├── Đơn vị tổ chức                 │
│   ├── Chi nhánh (branch-mode)        │
│   ├── Phòng ban                      │
│   ├── Nhân viên                      │
│   ├── Chức vụ                        │
│   ├── Vai trò & quyền                │
│   ├── Sơ đồ tổ chức                  │
│   ├── Vòng đời trạng thái            │
│   ├── Điều chuyển công tác           │
│   ├── Phân quyền người dùng          │
│   └── Giao việc                      │
├─────────────────────────────────────┤
│ Module 2 · Kho                       │
│   ├── Quản lý kho                    │
│   ├── Kho hàng                       │
│   ├── Phiếu nhập kho                 │
│   ├── Phiếu xuất kho                 │
│   ├── Điều chuyển kho                │
│   ├── Tồn kho                        │
│   └── Biến động tồn                  │
├─────────────────────────────────────┤
│ Module 3 · Kinh doanh                │
│   ├── Quản lý kinh doanh             │
│   ├── Sản phẩm                       │
│   ├── Bảng giá                       │
│   ├── Khách hàng                     │
│   ├── Đơn hàng                       │
│   └── Kênh bán hàng                  │
├─────────────────────────────────────┤
│ Hệ thống                             │
│   └── Nhật ký kiểm tra               │
└─────────────────────────────────────┘
```

### 4. Permission Mapping (theo `src/app/router/access.ts`)

| Route                   | Permission Code (FE)                                       | Có trong BE? (91 permission, kiểm tra 2026-07-14) |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| /org-units              | ORG_VIEW                                                   | ✅                                                |
| /departments            | DEPT_VIEW                                                  | ✅                                                |
| /employees              | EMP_VIEW                                                   | ✅                                                |
| /positions              | POS_VIEW                                                   | ✅                                                |
| /roles                  | ROLE_VIEW                                                  | ✅                                                |
| /org-chart              | ORG_VIEW                                                   | ✅                                                |
| /employee-status        | EMP_VIEW                                                   | ✅                                                |
| /employee-assignments   | EMP_ASSIGNMENT_VIEW                                        | ✅                                                |
| /user-role-scopes       | `['ROLE_ASSIGN', 'SCOPE_CONFIG']` (OR — chỉ cần 1 trong 2) | ✅ (cả 2 code đều tồn tại)                        |
| /tasks                  | TASK_VIEW                                                  | ❌ **không tồn tại trong catalog BE**             |
| /warehouse, /warehouses | WAREHOUSE_VIEW                                             | ✅                                                |
| /stock-receipts         | STOCK_RECEIPT_VIEW                                         | ✅                                                |
| /stock-issues           | STOCK_ISSUE_VIEW                                           | ✅                                                |
| /stock-transfers        | STOCK_TRANSFER_VIEW                                        | ✅                                                |
| /inventory-balance      | INVENTORY_VIEW                                             | ✅                                                |
| /stock-movements        | STOCK_MOVEMENT_VIEW                                        | ✅                                                |
| /business               | BUSINESS_VIEW                                              | ❌ **không tồn tại trong catalog BE**             |
| /products               | PRODUCT_VIEW                                               | ❌ **không tồn tại trong catalog BE**             |
| /price-lists            | PRICE_LIST_VIEW                                            | ❌ **không tồn tại trong catalog BE**             |
| /customers              | CUSTOMER_VIEW                                              | ❌ **không tồn tại trong catalog BE**             |
| /sales-orders           | SALES_ORDER_VIEW                                           | ❌ **không tồn tại trong catalog BE**             |
| /sales-channels         | SALES_CHANNEL_VIEW                                         | ❌ **không tồn tại trong catalog BE**             |
| /audit-logs             | AUDIT_LOG_VIEW                                             | ✅ **đã fix khớp BE**                             |

#### ⚠️ Gap xác nhận với backend thật (đăng nhập tài khoản Super Admin, `POST /api/v1/auth/login`)

Gọi `GET /api/v1/users/1/effective-permissions` (Super Admin) và `GET /api/v1/permissions`
(toàn bộ 91 permission trong hệ thống) cho kết quả:

1. **Toàn bộ 6 permission của Module 3 (Business) chưa được định nghĩa trong backend** —
   không phải chỉ chưa gán cho role, mà chưa tồn tại trong catalog `/permissions` luôn.
   ⇒ Menu "Module 3 · Kinh doanh" sẽ **luôn ẩn** với mọi user, kể cả Super Admin, cho tới
   khi BE tạo các permission `BUSINESS_VIEW/PRODUCT_VIEW/PRICE_LIST_VIEW/CUSTOMER_VIEW/
SALES_ORDER_VIEW/SALES_CHANNEL_VIEW` và gán cho role phù hợp.
2. **`TASK_VIEW`** (route `/tasks`) không tồn tại trong catalog BE ⇒ mục "Giao việc" trong
   M1 cũng sẽ ẩn với mọi user cho tới khi BE bổ sung.
3. **`AUDIT_LOG_VIEW`** (route `/audit-logs`) đã khớp BE — **đã fix** trong commit này.
4. Module 2 (Warehouse) permission đầy đủ và đã cấp cho Super Admin — nghiệm thu M2 qua
   tài khoản admin không gặp vấn đề.

### 5. Test coverage

- `src/app/layouts/menu.test.tsx` — test `filterMenu` theo permission cho từng route
  M1/M2/M3, nhóm rỗng tự ẩn.
- `src/app/layouts/menu.getSelectedKey.test.ts` — test `getSelectedKey`, `getOpenKeys`,
  `getBreadcrumb` cho cả 3 module, gồm case sub-route sâu và tránh khớp nhầm tiền tố
  (`/warehouse` vs `/warehouses/1`).

### 6. Screenshot Evidence (Cần bổ sung)

**Trạng thái hiện tại:** Chưa có screenshot trong repo. Cần chụp bằng tài khoản Super Admin
và attach vào Jira.

#### Checklist screenshot cần chụp:

- [ ] **Screenshot 1:** Sidebar đầy đủ M1/M2/M3 (đăng nhập tài khoản Super Admin, navigate đến
      `/org-units` hoặc `/warehouses`)
- [ ] **Screenshot 2:** M2 placeholder page (ví dụ `/warehouse` hoặc `/stock-receipts`)
- [ ] **Screenshot 3:** M3 placeholder page (nếu BE đã seed permission — hiện tại M3 sẽ ẩn)
- [ ] **Screenshot 4:** Route map text/table (có thể là screenshot của file
      `docs/route-map-m1-m2-m3.md` đang mở)

#### Script capture screenshot:

Xem script `scripts/capture-m1-screenshots.mjs` và `scripts/capture-role-scopes-screenshots.mjs`
làm mẫu. Cần tạo script tương tự cho sidebar M1/M2/M3.

## 🎯 Build Status

**Build: ✅ SUCCESS** (TypeScript + Vite) — xem `build-output.txt` ở root repo.

## 📋 Checklist

- [x] Route tree M1/M2/M3 khai báo trong `routes.ts` + `router/index.tsx`
- [x] `RequirePermission` guard theo `ROUTE_PERMISSIONS`
- [x] Sidebar `MENU` + `filterMenu` ẩn/hiện theo quyền
- [x] `getSelectedKey`/`getOpenKeys`/`getBreadcrumb` cho active state + breadcrumb
- [x] Unit test cho menu helpers
- [x] Fix `AUDIT_VIEW` → `AUDIT_LOG_VIEW` để khớp BE
- [ ] Evidence ảnh chụp sidebar M1/M2/M3 (screenshot) — **chưa có**, cần bổ sung
- [ ] Permission M3 (`BUSINESS_VIEW`, `PRODUCT_VIEW`, ...) chưa tồn tại ở BE — **cần BE seed**
- [ ] Permission `TASK_VIEW` chưa tồn tại ở BE — **cần BE seed**

## 🔗 References

- **Route Constants:** `src/shared/constants/routes.ts`
- **Route Permissions:** `src/app/router/access.ts`
- **Menu Config:** `src/app/layouts/menu.tsx`
- **Menu Tests:** `src/app/layouts/menu.test.tsx`, `src/app/layouts/menu.getSelectedKey.test.ts`
- **Route Map Doc:** `docs/route-map-m1-m2-m3.md`
- **API Docs:** `https://astrodev.test8.io.vn/api/documentation` (spec JSON: `/docs?api-docs.json`)
