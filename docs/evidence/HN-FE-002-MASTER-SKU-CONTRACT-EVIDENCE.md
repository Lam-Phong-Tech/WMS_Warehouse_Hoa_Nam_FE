# HN-FE-002 Master SKU/FE - Contract Alignment Evidence

## P1.1: Endpoint Contract Verification

### Finding
OpenAPI 3.0.0 specification (`swagger-api.json`) contains **220 routes**. Analysis shows:

**CONFIRMED endpoints (canonical):**
- `POST /products` - Create product (SKU)
- `GET /products` - List products with pagination/filter/sort
- `GET /products/{id}` - Product detail
- `PUT /products/{id}` - Update product
- `PATCH /products/{id}/enable` - Enable product
- `PATCH /products/{id}/disable` - Disable product  
- `PATCH /products/{id}/status` - Change status (active/inactive/discontinued)
- `PATCH /products/{id}/restore` - Restore soft-deleted product
- `GET,POST /product-categories` - Category CRUD
- `GET,POST /uoms` - Unit of measure CRUD
- `GET,POST /suppliers` - Supplier CRUD

**NOT FOUND in OpenAPI:**
- `/skus` - Does not exist
- `/skus/import-excel` - Does not exist  
- `/items` - Does not exist
- `/physical-codes` - Does not exist

### Action Taken
Updated `src/shared/api/endpoints.ts`:
- Added clear comments marking canonical vs legacy endpoints
- Legacy endpoints preserved for reference but marked as "do NOT use in production"
- FE now uses canonical `/products` endpoint via `getProducts()` service

### Evidence
- Script: `scripts/extract-product-detail.mjs`
- Output confirms POST /products request body schema:
  ```json
  {
    "supplier_id": "integer (required)",
    "category_id": "integer",
    "uom_id": "integer (required)",
    "product_code": "string (required)",
    "barcode": "string",
    "name": "string (required)",
    "description": "string",
    "list_price_net": "integer (required)",
    "vat_rate": "enum=[0,5,8,10] (required)",
    "status": "enum=['active','inactive','discontinued']"
  }
  ```

---

## P1.2: Field Spec/Enum HN-MC-001 Alignment

### Previous State (INCORRECT)
FE was using legacy `SkuPayload`:
```typescript
{
  code: string;
  name: string;
  unit: string;
  sku_type: "PRODUCT" | "COMPONENT";
  is_serial_tracked: boolean;
  status: "ACTIVE" | "INACTIVE" | "DRAFT";
}
```

### Current State (ALIGNED)
Updated to canonical `ProductPayload` matching BE contract:
```typescript
{
  supplier_id?: number | null;
  category_id?: number | null;
  uom_id?: number | null;
  product_code: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  list_price_net?: number | null;
  vat_rate?: 0 | 5 | 8 | 10 | number | null;
  status?: "active" | "inactive" | "discontinued" | string;
}
```

### Files Updated
1. **`src/modules/master-data/types/master-data.types.ts`**
   - Renamed `SkuRecord` → `ProductRecord` (canonical)
   - Renamed `SkuPayload` → `ProductPayload` (canonical)
   - Updated `status` enum: `"active" | "inactive" | "discontinued"` (lowercase)
   - Added all BE contract fields: `supplier_id`, `category_id`, `uom_id`, `barcode`, `description`, `list_price_net`, `vat_rate`
   - Kept legacy types as comments for reference

2. **`src/modules/master-data/services/master-data.service.ts`**
   - Added canonical functions: `getProducts()`, `createProduct()`, `updateProductStatus()`
   - Kept legacy aliases: `getSkus()`, `createSku()`, `updateSkuStatus()` → delegate to canonical
   - Added warning comment on `importSkus()` about endpoint not in BE contract

3. **`src/modules/master-data/hooks/use-master-data.ts`**
   - Updated hooks to use canonical services
   - `useCreateSku()` now calls `createProduct()` with `ProductPayload`
   - `useUpdateSkuStatus()` now accepts lowercase status values
   - Added `useSuppliers()` and `useUoms()` imports

4. **`src/modules/master-data/pages/MasterPage.tsx`**
   - Updated form to use `ProductPayload` fields
   - Added supplier/category/UOM dropdown selects
   - Updated status options to lowercase: `active`, `inactive`, `discontinued`
   - Added VAT rate selector (0%, 5%, 8%, 10%)
   - Added list price input with Vietnamese locale formatting
   - Updated table columns to show: barcode, supplier, category, UOM, price, VAT
   - Fixed action button logic to use lowercase status comparison

### Field Mapping: Screen → API Schema

| Screen Field | Form Name | API Field | Type | Required | Notes |
|-------------|-----------|-----------|------|----------|-------|
| Mã SP | `product_code` | `product_code` | string | Yes | Auto-generated format: `[Mã NPP]-[Mã SP]` |
| Barcode | `barcode` | `barcode` | string | No | Auto-sinh if empty |
| Tên sản phẩm | `name` | `name` | string | Yes | |
| Mô tả | `description` | `description` | string | No | |
| Nhà cung cấp | `supplier_id` | `supplier_id` | integer | No | Select from `/suppliers` |
| Danh mục | `category_id` | `category_id` | integer | No | Select from `/product-categories` |
| Đơn vị tính | `uom_id` | `uom_id` | integer | Yes | Select from `/uoms` |
| Giá niêm yết | `list_price_net` | `list_price_net` | integer | Yes | Chưa VAT |
| Thuế VAT | `vat_rate` | `vat_rate` | enum | Yes | 0, 5, 8, 10 (%) |
| Trạng thái | `status` | `status` | enum | Yes | active, inactive, discontinued |

---

## P1.3: QA2 Test Coverage

### Current Test Status
**MANUAL TESTING REQUIRED** - Automated tests not yet implemented for master-data module.

### Test Checklist (QA2 to execute)

#### UI/UX Tests
- [ ] **Responsive Layout**: Test on 1920px, 1366px, 1024px, 768px viewports
  - Table horizontal scroll works correctly
  - Form fields stack properly on mobile
  - Modals are full-screen on mobile
- [ ] **Table Pagination**: Verify page size selector (15, 20, 50, 100)
- [ ] **Filter/Sort**: Test status filter, column sorting
- [ ] **Search**: Test debounced search (400ms)
- [ ] **Detail Drawer**: Verify all fields display correctly
- [ ] **Import Modal**: Test file upload, result display, error table

#### Validation Tests
- [ ] **Required Fields**: product_code, name, uom_id, list_price_net, vat_rate, status
- [ ] **Field Formats**: 
  - product_code: alphanumeric, max length?
  - list_price_net: positive integer
  - vat_rate: 0, 5, 8, or 10
- [ ] **Backend Validation Errors**: Test 422 responses display inline

#### RBAC Tests
- [ ] **UI Disabled State**: Buttons disabled when user lacks `sku.manage` or `master.manage`
- [ ] **403 Error Display**: Alert shows "Không có quyền truy cập dữ liệu"
- [ ] **Permission Codes**: Verify exact permission codes with BE team

#### Error Handling Tests
- [ ] **403 Forbidden**: UI shows warning alert
- [ ] **422 Validation**: Inline field errors
- [ ] **409 Conflict**: Duplicate product_code
- [ ] **500 Server Error**: Generic error message
- [ ] **Network Error**: "Không kết nối được máy chủ"
- [ ] **Timeout**: "Yêu cầu quá thời gian"

### Test Evidence Template
```markdown
## Test Session: [Date]
Tester: [Name]
Environment: [Dev/Staging/Prod]
Browser: [Chrome/Firefox/Edge] + Version
Role: [Permission codes]

### Results
- [PASS/FAIL] Test case name
  - Steps: ...
  - Expected: ...
  - Actual: ...
  - Screenshot: [path]
```

---

## P1.4: Backend Authorization Evidence

### Current State
- **UI RBAC**: Implemented via `useHasPermission("sku.manage")` and `useHasPermission("master.manage")`
- **Backend RBAC**: NOT YET VERIFIED - requires BE team confirmation

### Required Evidence from BE
1. **403 Response Contract**: BE must return consistent 403 for unauthorized access
   ```json
   {
     "success": false,
     "status": "error",
     "message": "Forbidden",
     "error_code": "FORBIDDEN",
     "request_id": "uuid"
   }
   ```

2. **Permission Matrix**: Document which permissions map to which endpoints
   - `sku.manage` → POST/GET/PATCH /products
   - `master.manage` → POST/GET/PATCH /products, /product-categories
   - `category.manage` → POST/GET/PATCH /product-categories

3. **Data Scope**: Verify row-level filtering works independently of UI

### FE Implementation (Already Done)
- `errorAlert()` in MasterPage.tsx detects 403 status
- Displays warning alert: "Không có quyền truy cập dữ liệu"
- Shows HTTP status, error code, request_id
- Uses `normalizeError()` from `@/shared/api/api-error`

### Test Script for QA2
```bash
# 1. Login as user WITHOUT sku.manage permission
# 2. Navigate to /master-data
# 3. Verify buttons are disabled
# 4. Open browser DevTools → Network tab
# 5. Manually call GET /products with valid token
# 6. Expected: 403 response
# 7. Verify UI shows warning alert
```

---

## P1.5: PR/Build/Version Documentation

### Current Build Status
**BUILD FAILING** - TypeScript error in MasterPage.tsx line 987:
```
Type '(value: string | undefined) => number' is not assignable to type '(displayValue: string | undefined) => 0'.
```

**Root Cause**: Ant Design InputNumber `parser` prop expects return type `0` but we return `number`.

**Fix Required**: Add `@ts-ignore` comment or cast to `0`:
```typescript
parser={(value) => Number((value ?? "").replace(/,/g, "")) as 0}
```

### Version Information
- **Frontend Commit**: `af850cdb5b48e4170389451ce07b06ee49dffa87`
- **Backend OpenAPI**: 220 routes, version 3.0.0
- **Node Version**: v18+ (check with `node --version`)
- **Yarn Version**: 1.22.22

### Build Command
```bash
yarn build
# or
yarn build:dev  # if available
```

### Environment Variables Required
```env
VITE_API_BASE_URL=https://api.hoanam.com
VITE_WS_URL=wss://ws.hoanam.com
```

### Deployment Checklist
- [ ] Fix TypeScript build error
- [ ] Run `yarn test` (unit tests)
- [ ] Run `yarn test:e2e` (Playwright tests)
- [ ] Build production bundle: `yarn build`
- [ ] Verify bundle size < 500KB gzipped
- [ ] Deploy to staging
- [ ] QA2 executes test checklist (P1.3)
- [ ] BE team provides 403 evidence (P1.4)
- [ ] Sign-off from BA, BE, FE, QA

---

## Summary of Changes

### Files Modified
1. `src/shared/api/endpoints.ts` - Added canonical contract comments
2. `src/modules/master-data/types/master-data.types.ts` - Aligned with BE schema
3. `src/modules/master-data/services/master-data.service.ts` - Canonical services
4. `src/modules/master-data/hooks/use-master-data.ts` - Updated hooks
5. `src/modules/master-data/pages/MasterPage.tsx` - Aligned UI with contract

### Breaking Changes
- **Status enum**: `"ACTIVE" | "INACTIVE"` → `"active" | "inactive" | "discontinued"`
- **Form fields**: Removed `code`, `unit`, `sku_type`, `is_serial_tracked`
- **Form fields**: Added `product_code`, `barcode`, `supplier_id`, `category_id`, `uom_id`, `list_price_net`, `vat_rate`

### Backward Compatibility
- Legacy aliases maintained in services (`getSkus()` → `getProducts()`)
- UI tabs for Items/Physical Codes preserved (legacy endpoints)
- Import functionality preserved with warning comment

---

## Next Steps

1. **FE1**: Fix TypeScript build error (P1.5)
2. **QA2**: Execute test checklist (P1.3)
3. **BE1/BE2**: Provide 403 permission evidence (P1.4)
4. **BA**: Confirm field/enum spec sign-off (P1.2)
5. **DevOps**: Tag release with commit SHA

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| FE1 | [Name] | [Date] | [Sig] |
| BE1 | [Name] | [Date] | [Sig] |
| QA2 | [Name] | [Date] | [Sig] |
| BA | [Name] | [Date] | [Sig] |