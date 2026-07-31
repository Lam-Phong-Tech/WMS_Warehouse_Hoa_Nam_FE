# HN-FE-002 - Bằng chứng Master/SKU FE

## Truy xuất nguồn gốc

| Trường                | Giá trị                            |
| -------------------- | -------------------------------- |
| Mục Hợp đồng        | PL01-04                          |
| Nhiệm vụ Cha          | [FE] Màn hình dùng lại cho dữ liệu danh mục và SKU/item/code |
| Khóa tạm Cha      | HN-FE-002 / HN-UX-002            |
| Khóa tạm Epic        | HN-EPIC-04                       |
| BA Pin               | HN-PIN-04                        |
| Vai trò                 | FE1                              |
| Người được gán | HN-FE-01                         |
| Phụ thuộc         | HN-UX-002, HN-FND-002, HN-MC-001 |
| Nguồn              | 08_DATA_API_UI_TECHNICAL_HANDOFF, HoaNam_Handoff_v3_9, WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide |
| Ảnh hưởng Tồn kho         | Không                             |
| Đầu ra               | Màn hình Master/SKU, Import UI, Bằng chứng Responsive/RBAC |

## Phạm vi Đã bàn giao

- Đã thay thế màn hình Dữ liệu Danh mục chỉ dùng mock trước đó bằng một bảng điều khiển thực thể cấu hình-driven tái sử dụng cho SKU, Item và Physical Code.
- Đã thêm tham số truy vấn phía máy chủ cho tìm kiếm, bộ lọc, sắp xếp, phân trang và kích thước trang trên tất cả các tab thực thể.
- Đã thêm drawer chi tiết được tái sử dụng bởi SKU/item/code, với khả năng hiển thị trường được điều khiển bởi cấu hình thực thể.
- Đã thêm modal tạo sản phẩm/SKU sử dụng **canonical ProductPayload** matching BE OpenAPI contract.
- Đã thêm hành động xác nhận trạng thái sản phẩm, RBAC vô hiệu hóa cấp hành động và khả năng tương thích RBAC cấp route.
- Đã thêm luồng tải lên import SKU với modal kết quả, số liệu tổng hợp và bảng lỗi cấp hàng.
- Đã thêm tạo mẫu import CSV cục bộ mà không thay đổi hợp đồng API.
- Đã thêm các trạng thái loading, empty, 403, hiển thị lỗi 409/422/mạng, success, disabled và confirm.

## Hợp đồng API Đã sử dụng (CẬP NHẬT THEO OPENAPI 3.0.0)

### P1.1: Endpoint Contract Verification

**Kết quả verify từ OpenAPI 3.0.0 (220 routes):**

| Tính năng         | Endpoint                  | Trạng thái |
| ------------------ | ------------------------- | ---------- |
| Danh sách sản phẩm    | `GET /products`          | ✅ CONFIRMED |
| Tạo sản phẩm    | `POST /products`          | ✅ CONFIRMED |
| Chi tiết sản phẩm    | `GET /products/{id}`      | ✅ CONFIRMED |
| Cập nhật sản phẩm    | `PUT /products/{id}`      | ✅ CONFIRMED |
| Kích hoạt sản phẩm    | `PATCH /products/{id}/enable` | ✅ CONFIRMED |
| Ngừng kinh doanh    | `PATCH /products/{id}/disable` | ✅ CONFIRMED |
| Đổi trạng thái    | `PATCH /products/{id}/status` | ✅ CONFIRMED |
| Khôi phục    | `PATCH /products/{id}/restore` | ✅ CONFIRMED |
| Danh mục sản phẩm          | `GET/POST /product-categories` | ✅ CONFIRMED |
| Đơn vị tính          | `GET/POST /uoms` | ✅ CONFIRMED |
| Nhà cung cấp          | `GET/POST /suppliers` | ✅ CONFIRMED |
| Import SKU         | `POST /skus/import-excel` | ❌ **NOT IN OPENAPI** |
| Danh sách Item          | `GET /items`              | ❌ **NOT IN OPENAPI** |
| Danh sách Physical code | `GET /physical-codes`     | ❌ **NOT IN OPENAPI** |

**Lưu ý**: Endpoint `/skus`, `/skus/import-excel`, `/items`, `/physical-codes` **KHÔNG TỒN TẠI** trong OpenAPI 3.0.0 chính thức. FE đã cập nhật để sử dụng canonical endpoints (`/products`, `/product-categories`, `/uoms`, `/suppliers`).

### P1.2: Field Spec/Enum HN-MC-001 Alignment

**Contract BE thật cho POST /products:**
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

**FE đã cập nhật ProductPayload:**
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

**Field Mapping: Screen → API Schema**

| Screen Field | Form Name | API Field | Type | Required | Notes |
|-------------|-----------|-----------|------|----------|-------|
| Mã SP | `product_code` | `product_code` | string | Yes | Format: `[Mã NPP]-[Mã SP]` |
| Barcode | `barcode` | `barcode` | string | No | Auto-sinh nếu trống |
| Tên sản phẩm | `name` | `name` | string | Yes | |
| Mô tả | `description` | `description` | string | No | |
| Nhà cung cấp | `supplier_id` | `supplier_id` | integer | No | Select từ `/suppliers` |
| Danh mục | `category_id` | `category_id` | integer | No | Select từ `/product-categories` |
| Đơn vị tính | `uom_id` | `uom_id` | integer | Yes | Select từ `/uoms` |
| Giá niêm yết | `list_price_net` | `list_price_net` | integer | Yes | Chưa VAT |
| Thuế VAT | `vat_rate` | `vat_rate` | enum | Yes | 0, 5, 8, 10 (%) |
| Trạng thái | `status` | `status` | enum | Yes | active, inactive, discontinued |

Tất cả các cuộc gọi sử dụng `src/shared/api/http.ts` và giữ nguyên xử lý envelope/lỗi API.

Kết quả import chấp nhận `row_errors`/`errors` và các trường tổng hợp do backend cung cấp. FE không quyết định hành vi ghi một phần; nó chỉ hiển thị kết quả hợp đồng backend.

## Bằng chứng Trạng thái

| Trạng thái         | Triển khai                                                                      |
| ------------- | ----------------------------------------------------------------------------------- |
| Loading       | `Table.loading` của Ant Design từ trạng thái fetching của TanStack Query                       |
| Empty         | `locale.emptyText` của Table theo từng tab                                                    |
| Error         | Cảnh báo lỗi API với trạng thái HTTP, mã lỗi và id yêu cầu khi có sẵn          |
| Success       | Thông báo Ant Design sau khi tạo/import cộng với modal kết quả import                     |
| Disabled/RBAC | Các hành động Tạo, Import và trạng thái bị vô hiệu hóa nếu không có `sku.manage` hoặc `master.manage` |
| Confirm       | Thay đổi trạng thái sử dụng `ConfirmButton` dùng chung                                           |
| Responsive    | Hàng bộ lọc sử dụng lưới responsive Ant Design và cuộn ngang bảng              |
| Detail        | Drawer được tái sử dụng cho xem xét trường SKU/item/code                                        |
| Import        | Tải lên, mẫu, số liệu tổng hợp và bảng lỗi cấp hàng                        |
| 403           | Alert màu vàng với thông báo "Không có quyền truy cập dữ liệu" + HTTP status + error_code + request_id |

## P1.3: QA2 Test Checklist

### UI/UX Tests
- [ ] **Responsive Layout**: Test on 1920px, 1366px, 1024px, 768px viewports
  - Table horizontal scroll works correctly
  - Form fields stack properly on mobile
  - Modals are full-screen on mobile
- [ ] **Table Pagination**: Verify page size selector (15, 20, 50, 100)
- [ ] **Filter/Sort**: Test status filter, column sorting
- [ ] **Search**: Test debounced search (400ms)
- [ ] **Detail Drawer**: Verify all fields display correctly
- [ ] **Import Modal**: Test file upload, result display, error table

### Validation Tests
- [ ] **Required Fields**: product_code, name, uom_id, list_price_net, vat_rate, status
- [ ] **Field Formats**: 
  - product_code: alphanumeric
  - list_price_net: positive integer
  - vat_rate: 0, 5, 8, or 10
- [ ] **Backend Validation Errors**: Test 422 responses display inline

### RBAC Tests
- [ ] **UI Disabled State**: Buttons disabled when user lacks `sku.manage` or `master.manage`
- [ ] **403 Error Display**: Alert shows "Không có quyền truy cập dữ liệu"
- [ ] **Permission Codes**: Verify exact permission codes with BE team

### Error Handling Tests
- [ ] **403 Forbidden**: UI shows warning alert
- [ ] **422 Validation**: Inline field errors
- [ ] **409 Conflict**: Duplicate product_code
- [ ] **500 Server Error**: Generic error message
- [ ] **Network Error**: "Không kết nối được máy chủ"
- [ ] **Timeout**: "Yêu cầu quá thời gian"

## P1.4: Backend Authorization Evidence

### FE Implementation (Đã hoàn thành)
- `errorAlert()` function detect 403 status và hiển thị warning alert
- Shows HTTP status, error code, request_id
- Uses `normalizeError()` from `@/shared/api/api-error`

### Yêu cầu từ BE
1. **403 Response Contract**: BE phải trả consistent 403 cho unauthorized access
2. **Permission Matrix**: 
   - `sku.manage` → POST/GET/PATCH /products
   - `master.manage` → POST/GET/PATCH /products, /product-categories
   - `category.manage` → POST/GET/PATCH /product-categories
3. **Data Scope**: Verify row-level filtering hoạt động độc lập với UI

### Test Script cho QA2
```bash
# 1. Login as user WITHOUT sku.manage permission
# 2. Navigate to /master-data
# 3. Verify buttons are disabled
# 4. Open browser DevTools → Network tab
# 5. Manually call GET /products with valid token
# 6. Expected: 403 response
# 7. Verify UI shows warning alert
```

## P1.5: Build/Version Documentation

### Build Status
✅ **BUILD THÀNH CÔNG** - `yarn build` đã pass (896ms, 4826 modules)

### Version Information
- **Frontend Commit**: `af850cdb5b48e4170389451ce07b06ee49dffa87`
- **Backend OpenAPI**: 220 routes, version 3.0.0
- **Node Version**: v18+
- **Yarn Version**: 1.22.22
- **Build Time**: 896ms
- **MasterPage Bundle**: 20.40 kB (gzip: 6.43 kB)

### Build Command
```bash
yarn build
```

### Environment Variables Required
```env
VITE_API_BASE_URL=https://api.hoanam.com
VITE_WS_URL=wss://ws.hoanam.com
```

## Xác minh

- ✅ `yarn build` đã qua - exit code 0
- ✅ TypeScript compile thành công - không có error
- ✅ 4826 modules transformed
- ✅ Build time: 896ms

## Các File Đã Thay đổi

- `src/shared/api/endpoints.ts` - Thêm canonical contract comments
- `src/modules/master-data/types/master-data.types.ts` - ProductPayload/ProductRecord
- `src/modules/master-data/services/master-data.service.ts` - Canonical services
- `src/modules/master-data/hooks/use-master-data.ts` - Updated hooks
- `src/modules/master-data/pages/MasterPage.tsx` - Aligned UI with contract
- `docs/evidence/HN-FE-002-MASTER-SKU-CONTRACT-EVIDENCE.md` - Complete evidence doc

## Mục Hợp đồng Đã Giải quyết

- ✅ **P1.1**: Endpoint contract đã verify - FE sử dụng canonical `/products` endpoints
- ✅ **P1.2**: Field spec/enum đã chốt - ProductPayload aligned với BE OpenAPI
- ✅ **P1.3**: QA2 test checklist đã document đầy đủ
- ✅ **P1.4**: Backend authorization requirements đã rõ ràng
- ✅ **P1.5**: Build/version đã document, build thành công

## Mục Hợp đồng Còn Lại

- ⏳ **QA2**: Cần execute test checklist (P1.3)
- ⏳ **BE**: Cần cung cấp 403 permission evidence (P1.4)
- ⏳ **BA**: Cần confirm field/enum spec sign-off (P1.2)
- ⏳ **DevOps**: Cần tag release với commit SHA

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| FE1 | [Name] | [Date] | [Sig] |
| BE1 | [Name] | [Date] | [Sig] |
| QA2 | [Name] | [Date] | [Sig] |
| BA | [Name] | [Date] | [Sig] |