# WWHN-252 — App PV: Defect Fix Register & Closure Evidence

| Trường | Giá trị |
|---|---|
| Ticket | WWHN-252 (FE) · phụ thuộc WWHN-249 / HN-PV-001 (BE contract) |
| Nhánh | `m1` (cả hai repo) — không tạo nhánh riêng |
| BE exact SHA | `b90d5ef67c6577db166fdac00f1323741ccfd888` |
| FE exact SHA | `b7cf48859f5d4d14860b8b61f2ea6b5f361d03d4` |
| Nguồn chuẩn | HN_SRS_FRD_v1.12_FULL · HoaNam_ERD_Moi_Nhat · WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide · HN_WMS_Wireframe_MVP_ALIGNED_v3.20 |
| Đánh giá trước | 34/100 — Chưa đạt yêu cầu |

> Ghi chú nguồn: bộ wireframe ALIGNED v3.20 ghi rõ ở tiêu đề và MAP-01 rằng
> **không dựng App PV**. Vì vậy nguồn thiết kế của luồng này là §8.3 + Annex D
> (Screen Map) + Annex C, không phải wireframe.

---

## A. Trạng thái từng mục trong register

| ID | Sev | Trạng thái | Bằng chứng đóng |
|---|---|---|---|
| FE252-P1-01 | P1 | **ĐÃ SỬA** | `src/modules/pv/**` (list/detail/admin), `ROUTES.PV_CATALOG` `/pv`, `ROUTES.PV_PRODUCT_DETAIL` `/pv/products/:skuId`, `ROUTES.PV_ADMIN` `/pv-admin`; 30 test mới; runtime accessibility tree §D.3 |
| FE252-P1-02 | P1 | **ĐÃ SỬA** | 5 endpoint canonical Annex C lên API surface + OpenAPI sinh lại; `docs/evidence/WWHN-252/RUNTIME_API_EVIDENCE.md` |
| FE252-P1-03 | P1 | **ĐÃ SỬA** | BE bỏ `\|sku.manage` ở route publish; FE `canPublish = pv.publish`; test positive/negative cả hai tầng |
| FE252-P1-04 | P1 | **ĐÃ CHỐT** | `docs/decision-records/HN-PIN-09-app-pv-actor-boundary.md` |
| FE252-P1-05 | P1 | **CHỜ QA2** | Bộ test tự động + test-id đã sẵn (§C); phần chụp màn hình/video là deliverable của QA2 |
| FE252-P1-06 | P1 | **ĐÃ CHẠY THẬT — kèm 1 blocker ngoài phạm vi** | §D.1 |
| FE252-P1-07 | P1 | **ĐÃ SỬA** | §B.3 + runtime evidence |
| FE252-P2-01 | P2 | **ĐÃ SỬA** | Source register dùng `m1` + exact SHA ở đầu tài liệu này |
| FE252-P2-02 | P2 | **CHỜ PM/BAS** | Metadata Jira, không sửa được từ repo |
| FE252-P2-03 | P2 | **MỘT PHẦN** | Test-id ổn định + evidence runtime API đã có; ảnh/video của QA2 còn thiếu |

---

## B. Gốc kỹ thuật của từng lỗi và cách sửa

### B.1 — FE252-P1-02: BE chưa có hợp đồng để FE wire vào

Trước khi sửa, API surface chỉ có `GET /pv/catalog`, `/pv/industries`,
`/pv/tags`, `/pv/recommendations`. Annex C lại khai `listPvProducts` tại
`/pv/products` và `getPvProduct` tại `/pv/products/{sku_id}`. Nói cách khác
**path canonical chưa từng tồn tại** — FE không có gì để gọi.

Ba lỗi hợp đồng nữa nằm trong chính handler cũ:

1. `pvCatalog` INNER JOIN `pv_product_profile`. SKU đã publish nhưng chưa có hồ
   sơ PV thì **biến mất khỏi catalog**, trong khi REQ-SRS-036/DEC-CATALOG-001 nói
   publish không phụ thuộc dữ liệu nào khác.
2. `pvCatalog` cộng `inventory_balances.quantity` (mirror của `on_hand_qty`) thay
   vì `available_qty` mà REQ-SRS-018 chỉ đích danh.
3. `pvRecommendations` JOIN thẳng `r.product_id = s.sku_id`, nên **mọi rule chọn
   theo `category_id` hoặc `tag_id`** (ERD bảng 57 cho phép cả ba selector) bị bỏ
   âm thầm; và response trả `r.*` — nội dung rule nội bộ — thay vì sản phẩm.

Đã sửa: `PvCatalogReadModel` + `PvPublicCatalogController`. Hai path lịch sử
`/pv/catalog` và `/pv/recommendations` giữ nguyên handler (route đang bị pin bởi
`DocumentationBaselineContractTest`) nhưng thân hàm ủy quyền về cùng read model,
nên hai path không bao giờ trả hai sự thật khác nhau.

### B.2 — FE252-P1-03: quyền publish chỉ tách trên giấy

- BE: `permission:pv.publish|sku.manage` → **ai sửa được SKU là publish được lên
  mặt công khai**. Đã đổi thành `permission:pv.publish`.
- FE: `useCanManage(["pv.publish", "sku.manage"])` là phép OR, cùng lỗ hổng. Đã
  đổi thành `useCanManage(WMS_PERMISSION_CATALOG.PV_PUBLISH)`.
- `/pv-admin/resources/product-profiles` từ chối tường minh payload `published`
  và trả 422 BUSINESS_RULE_VIOLATION chỉ rõ phải gọi endpoint `pv.publish` —
  để `pv.master.manage` không lách qua đường sửa hồ sơ.

### B.3 — FE252-P1-07: visibility / data-scope / freshness

| Yêu cầu | Cách đóng |
|---|---|
| active + published visibility | Nguồn publish là `sku.published_to_app`. Trên PostgreSQL view `sku` chiếu thẳng `pv_product_profiles.published` (migration 2026_08_16_121000) nên hai giá trị luôn khớp; trên sqlite publish nằm ở cột thật. Đây là cách duy nhất cho **cùng kết quả trên cả hai driver**. |
| unpublished deep-link | 404 `RESOURCE_NOT_FOUND` masked (§13.8), không phải 403 — 403 tự xác nhận SKU tồn tại. |
| available_qty | `SUM(inventory_balances.available_qty)` trên bucket `AVAILABLE`, cùng nguồn với dashboard (`OperationalReportController`). |
| zero-stock | `stock_status=OUT_OF_STOCK`, `stock_label="Chưa có hàng"` do BE trả; FE không tự sinh nhãn. |
| freshness/degraded | Response mang `data_as_of`, `max_staleness_seconds`, `inventory_freshness`. FE tính tuổi = (lúc NHẬN response) − `data_as_of`, đóng dấu tại tầng transport. **Không** so với đồng hồ máy khách: lệch giờ máy khách sẽ tạo degraded giả hoặc giấu degraded thật. |
| no operational leakage | DTO là whitelist tường minh trong `PvCatalogReadModel::presentMany()`; test khẳng định response không chứa `warehouse_id / item_id / container_id / serial_number / movement / cost / reserved_qty / on_hand_qty`. |
| ẩn danh thật | FE dùng client riêng `publicHttp` — không gắn `Authorization` (không rò token của nhân viên đang đăng nhập sang endpoint public có thể nằm sau CDN), không redirect `/login` khi lỗi. |

### B.4 — Hai lệch schema phải sửa tận gốc (không sửa thì 412/428 là mã chết)

| Migration | Vấn đề | Cách sửa |
|---|---|---|
| `2026_08_19_000100_add_optimistic_lock_to_pv_master_tables` | Annex C khai `updatePvAdminResource` dùng `If-Match` và có 412 trong error set, nhưng `pv_industry`, `pv_filter_tag` (bảng thật ở cả hai driver) và `pv_recommendation_rule` (bảng thật trên sqlite) **không có cột `version`** → If-Match không thể thực thi. | Thêm `version`, đồng thời cập nhật projection sang bảng ERD số nhiều để mirror không chiếu hằng `0` — nếu bỏ bước này thì `pv_industries.version` vĩnh viễn là 0 trong khi `pv_industry.version` tăng, tức mirror nói dối về optimistic lock. |
| `2026_08_19_000200_sync_sqlite_pv_profile_publish_state` | Trên PostgreSQL, trigger `hn_legacy_sku_write` upsert hồ sơ PV mỗi khi publish. Trên sqlite (driver CI chạy full suite) `sku` là bảng thật, không có trigger nào → **publish không tạo hồ sơ PV**, cùng payload cho hai kết quả khác nhau. | Dựng đúng hành vi đó bằng AFTER INSERT/UPDATE trigger + backfill + unique index `ux_pv_product_profile_product_id` mà ERD bảng 51 (UX(sku_id)) yêu cầu. Điều kiện trigger là `published_to_app = 1` chứ không phải `IS NOT NULL`: cột này có DEFAULT false trên sqlite nên `IS NOT NULL` sẽ đúng với MỌI SKU và tạo hồ sơ cho cả SKU chưa publish — lệch hẳn PostgreSQL. |

---

## C. Bao phủ test

### BE — `tests/Feature/Wwhn252PvContractTest.php` (17 case, 17 PASS)

| Case | Bất biến |
|---|---|
| public list | chỉ SKU active + published; SKU chưa publish và SKU đã tắt bị loại |
| zero-stock | REQ-SRS-036 — tồn 0 vẫn hiện, nhãn "Chưa có hàng" |
| no-leak | §15 OP-09 — quét chuỗi response, không có khoá vận hành nào |
| freshness meta | NFR-SRS-016 — `data_as_of` + `max_staleness_seconds=60` + `LIVE` |
| 404 mask | §13.8 — deep-link SKU chưa publish |
| 400-not-422 | Annex C error set `{400,404,429,500}` cho `per_page` vượt trần, uuid sai, path sai, thiếu `industry_id` |
| filter | industry_id và tag_id thu hẹp đúng danh sách |
| industry INACTIVE | BR-PV-MST — bị loại khỏi mặt công khai |
| recommendation | cả ba selector sku/category/tag resolve đúng, sắp theo priority |
| publish RBAC | `sku.manage` → 403; `pv.publish` → 200 |
| publish e2e | publish → hiện trên catalog; unpublish → biến mất |
| pv-admin RBAC | `sku.manage` → 403; `pv.master.manage` → 200 |
| If-Match | thiếu → 428 PRECONDITION_REQUIRED; lệch → 412 STALE_VERSION; đúng → version+1 |
| duplicate code | 422 VALIDATION_ERROR |
| rule guard | thiếu selector → 422 BUSINESS_RULE_VIOLATION; priority trùng → 409 STATE_CONFLICT |
| profile publish | `pv.master.manage` gửi `published` → 422 BUSINESS_RULE_VIOLATION |
| resource_type lạ | 404 RESOURCE_NOT_FOUND |

### FE — 30 case mới, tất cả PASS

- `src/test/wwhn-252-pv-contract.test.ts` (15): path canonical; client ẩn danh
  không gắn Bearer; bỏ bộ lọc rỗng; `in_stock=1`; nhận diện 404/429+Retry-After/
  offline/500+request_id; giữ meta độ tươi; tính degraded; route công khai không
  nằm trong bảng gate quyền; `/pv-admin` mở cho `pv.master.manage|pv.publish` và
  **không** cho `sku.manage`.
- `src/modules/pv/pages/PvCatalogPage.test.tsx` (11): loading / empty (có và
  không có filter) / error kèm request_id / 429 / offline / zero-stock label /
  freshness live vs degraded / đọc bộ lọc từ URL.
- `src/modules/pv/pages/PvAdminPage.test.tsx` (4): `pv.master.manage` không
  bật/tắt được publish; `pv.publish` bật được; `sku.manage` **không** mở khoá;
  người chỉ có `pv.publish` không sửa được master.

---

## D. Cổng chất lượng chạy thật tại exact SHA

### D.1 — FE

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Unit/integration | `npx vitest run` | **83 file / 628 test PASS, 0 fail** |
| Lint (phạm vi PV) | `npx eslint src/modules/pv src/shared/api/public-http.ts …` | **0 error** (6 warning `react-hooks/*` là dòng có sẵn của `ApiMasterScreens`, không thuộc thay đổi này) |
| Typecheck | `npm run typecheck` | **5 error — KHÔNG có error nào trong phạm vi PV** |

**Blocker ngoài phạm vi (phải nêu, không được che):** `tsc -b` của nhánh `m1`
đang đỏ ở 3 tệp **không thuộc WWHN-252** và đã đỏ từ trước thay đổi này:

```
src/modules/reports/pages/AlignedReportsPage.tsx(1468,45)  TS2339
src/test/wwhn-233-count-deferral-gate.test.ts(83,25)       TS2677
src/test/wwhn-236-adjustment-deferral-gate.test.ts(42/61/72) TS2677
```

Hai tệp đầu đã ở HEAD; tệp thứ ba là WIP chưa commit của phiên song song. Vì
`npm run build` chạy `tsc -b` trước `vite build`, **cổng build cấp nhánh không
thể xanh cho tới khi chủ sở hữu WWHN-233 / WWHN-236 / Flow 06 sửa 3 tệp trên**.
WWHN-252 không sửa hộ để tránh xung đột với phiên đang chỉnh chính các tệp đó.
Do vậy FE252-P1-06 được đóng **cho phạm vi PV**, và blocker cấp nhánh được
chuyển đúng chủ sở hữu.

### D.2 — BE

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Full suite (sqlite) | `php vendor/bin/phpunit --no-coverage` | 915 test — sau khi đóng 4 lỗi contract do thay đổi surface: **0 fail trong nhóm bị ảnh hưởng** (`CurrentBaselineFlowContractSourceTest`, `DocumentationBaselineContractTest`, `SwaggerRouteSyncTest`, `Wwhn268RegressionContractTest`, `Wwhn252PvContractTest` = 41 test, 0 fail) |
| Migration | `php artisan migrate` | 2 migration mới chạy sạch trên sqlite |
| OpenAPI | `php artisan l5-swagger:generate` | 231 operation, parity với route, summary người-đọc-được |

Bốn lỗi contract đã đóng đúng gốc, không nới lỏng assertion:

1. `CurrentBaselineFlowContractSourceTest::test_warranty_label_and_pv_rules_are_pinned`
   — pin `where('p.published', true)` nằm ở controller cũ. Luật đã chuyển sang
   read model nên pin chuyển theo, và **siết thêm**: pin đúng
   `where('s.published_to_app', true)` + `where('s.status','ACTIVE')` tại
   `PvCatalogReadModel`.
2/3. Số operation 226→231 — 5 operation mới đều đã có mặt trong
   `docs/contracts/HoaNam_Current_Baseline_Contract.json` (`annex_c_alignment`).
4. Summary Swagger — hai controller PV chưa nằm trong `config/l5-swagger.php`
   nên `RouteSyncProcessor` sinh skeleton (đúng lỗi lớp của WWHN-184/WWHN-240).
   Đã thêm vào scan list; **tên tham số OA phải trùng tên biến route**
   (`{skuId}`, `{resourceType}`), lệch một ký tự là processor coi như không có
   annotation.

### D.3 — Runtime

- `docs/evidence/WWHN-252/RUNTIME_API_EVIDENCE.md` — 8 lần gọi thật vào BE đang
  chạy: 200 kèm `data_as_of`, 400 INVALID_QUERY (per_page & uuid), 400
  INVALID_PATH, 404 masked, 400 thiếu `industry_id`, 401 cho `/pv-admin`.
- Trang công khai `/pv` render **không cần đăng nhập** trên dev server (cây
  accessibility: banner "Hòa Nam · Danh mục sản phẩm", vùng "Bộ lọc sản phẩm",
  chỉ báo độ tươi, footer) — chứng minh FE252-P1-01 đã có output thật.

---

## E. Việc còn lại và chủ sở hữu

| Việc | Chủ sở hữu | Ghi chú |
|---|---|---|
| Chụp screenshot/video 390/768/1366+ và ma trận RBAC trên build thật | QA2 | Test-id ổn định đã sẵn: `pv-product-grid`, `pv-list-empty`, `pv-list-loading`, `pv-error-generic/offline/rate-limited`, `pv-stock-badge`, `pv-freshness`, `pv-admin-publish-switch` |
| Sửa 3 tệp làm đỏ `tsc -b` cấp nhánh | WWHN-233 / WWHN-236 / Flow 06 | Xem §D.1 |
| Đồng bộ Sprint ID93 và Sprint Scope | PM/BAS | Metadata Jira, không sửa được từ repo |
