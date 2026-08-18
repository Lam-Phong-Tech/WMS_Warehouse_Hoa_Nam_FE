# WWHN-242 — HN-FE-006 · REV-00 / REV-01 (Hoàn đảo) · Exact Fix Register

Đóng register 61/100. Mỗi mục ghi **lỗi thật đã sửa ở đâu** và **bằng chứng chạy được**,
không có mục nào đóng bằng lời hứa.

Nguồn thẩm quyền và định đoạt phạm vi: [`WWHN-242_SCOPE_DISPOSITION.md`](./WWHN-242_SCOPE_DISPOSITION.md).
Comment ký theo vai: [`WWHN-242_SIGNOFF_COMMENTS.md`](./WWHN-242_SIGNOFF_COMMENTS.md).

---

## 1. Register theo đúng ID của review

| ID | Sev | Trạng thái | Đã làm gì | Bằng chứng |
| --- | --- | --- | --- | --- |
| **FE242-P0-01** | P0 | **CLOSED (phần kỹ thuật) / PENDING (phần Jira)** | Lập hồ sơ định đoạt chính thức: neo `REQ-SRS-037` (Must, adopt qua `WWHN-334` Done) + `REQ-SRS-013`, ghim SHA-256 của 4 baseline, tuyên bố **REVERSAL-ONLY**, giải thích vì sao nhánh "restore Stocktake" bị loại, và khoá ranh giới trích dẫn: `DEC-NO-STOCKTAKE-001` / `DEC-REV-001` KHÔNG được dùng như approved standalone Decision ID vì `WWHN-25/26` còn PENDING. Soạn sẵn text AC/Description/dependency để BA/PM dán vào Jira. | `WWHN-242_SCOPE_DISPOSITION.md`; gate `npm run verify:wwhn-242` tính lại hash tại chỗ ⇒ doc lệch baseline là ĐỎ |
| **FE242-P1-01** | P1 | **CLOSED (FE-controlled) / QA độc lập vẫn cần** | Bộ e2e ma trận UI · role · stale · partial · responsive · API-error, chạy trên đúng build, tự ghi metadata + screenshot + `truthBoundary`. | `e2e/wwhn-242-reversal-qa2.spec.ts` — 18/18 PASS; ảnh + JSON tại `test-results/wwhn-242/<SHA>/` |
| **FE242-P1-02** | P1 | **CLOSED** | Runner chạy THẬT `lint` / `typecheck` / `test` / `build` / `verify:wwhn-242`, ghi exit code + log thô + ghim danh tính (SHA, sạch/bẩn, node/npm) + SHA256SUMS. Workflow CI chạy cùng bộ đó trên exact SHA. | `scripts/run-wwhn-242-evidence.mjs`, `.github/workflows/wwhn-242-fe-closure.yml`, `docs/evidence/WWHN-242/` |
| **FE242-P1-03** | P1 | **CLOSED** | Phủ lookup → chọn → partial 2/20 → dependency guard → chi tiết → CONFIRMED → Post; ma trận 403/409/412/422/428 với khẳng định "không đổi trạng thái". | cùng file e2e + unit `src/modules/reverse/wwhn-242-reversal-contract.test.tsx` (6 test) |
| **FE242-P1-04** | P1 | **CLOSED** | §2 của hồ sơ định đoạt liệt kê exact clause C1..C7 / R1..R5 kèm version + SHA-256 để reviewer đối chiếu, thay cho việc suy phạm vi từ comment trong code. | `WWHN-242_SCOPE_DISPOSITION.md` §2 |
| **FE242-P2-01** | P2 | **CLOSED** | Chụp bằng chứng ở 390×844, 768×1024, 1366×768, 1440×900 cho REV-00 + chi tiết + lỗi + confirm, kèm assert không tràn ngang. | e2e `REQUIRED_VIEWPORTS`; gate chặn nếu thiếu bất kỳ khổ nào |
| **FE242-P2-02** | P2 | **CLOSED** | Nguồn canonical là `m1`. Không tồn tại nhánh `m1ee`. Workflow ghi `CANONICAL_BRANCH=m1` + `EXACT_GIT_SHA` vào artifact bất biến. | `.github/workflows/wwhn-242-fe-closure.yml` |

---

## 2. Lỗi gốc mới phát hiện khi rà lại theo tài liệu (không nằm trong register cũ)

Review 61/100 chỉ nêu vấn đề bằng chứng/governance. Khi đối chiếu code với SRS/ERD/wireframe
thì lộ **bốn defect thật**, trong đó hai cái làm luồng chết hẳn.

### 2.1. `BE242-D1` · P0 · Ghi vượt biên warehouse ở toàn bộ nhóm `reversal-documents`

Bảy route `reversal-documents` chỉ có `permission:` mà **không có bất kỳ ràng buộc phạm vi
kho nào**, trong khi nhóm inventory (WWHN-211) và inbound (WWHN-289) đã có. Hệ quả nặng nhất
không phải lộ dữ liệu mà là **ghi vượt biên**: một actor có `inventory.reversal.post` nhưng
`user_role.scope_ref` trỏ kho khác vẫn `POST /reversal-documents/{id}/post` được — tức sinh
movement và đổi tồn ở kho ngoài phạm vi của mình. SRS §8.1: *"All protected endpoints | Exact
x-permission + data scope; default deny"*.

- Sửa: `EnforceReversalWarehouseScope` gắn cho cả 7 route + `ReversalDocumentController::applyWarehouseScope()`
  lọc ngay trong query (để `meta.total` của phân trang cũng đúng, không phải lọc sau phản hồi).
- Bằng chứng: `tests/Feature/Wwhn242ReversalScopeAndProjectionTest.php` — **7/7 PASS, 65 assertion**,
  trong đó có khẳng định "từ chối theo data scope là no-write: số movement không đổi".

### 2.2. `BE242-D2` · P0 · Bước CONFIRMED của §6 không tồn tại trên UI

`index()`/`show()` **không chiếu** `physical_return_status`, `condition_status`,
`cancelled_at`, `cancel_reason` (ERD bảng 33 + `ERD-AMD-002`). FE đọc đúng bốn cột này, nên:

- `pendingReturn` luôn `false` ⇒ nút **"Xác nhận hàng vật lý đã về" không bao giờ render**;
- nút Post luôn mở ⇒ mọi Reverse Issue đều chết ở `409 PHYSICAL_RETURN_REQUIRED` (BR-REV-06);
- phiếu CANCELLED luôn hiện `-` ở ô huỷ.

Nói cách khác luồng Reverse Issue **không thể hoàn thành** qua UI. Đây chính là lý do
FE242-P1-03 không thể có bằng chứng "lookup → create → confirm → post" trước bản vá.

- Sửa: bổ sung bốn cột vào cả `index()` và `show()`.
- Bằng chứng: `test_read_projection_exposes_physical_return_and_cancel_columns` + e2e
  "PENDING_RETURN: hiện bước xác nhận hàng về và khoá Post cho tới khi xác nhận".

### 2.3. `FE242-D3` · P0 · Route `/reverse` fail-closed sai, khoá nhầm vai chỉ đọc

`ROUTE_PERMISSIONS[/reverse]` chỉ nhận `inventory.reversal.post`. Nhưng BE mở
`GET /reversal-documents{,/:id,/:id/lines}` bằng `inventory.view`, và `AuthDatabaseSeeder`
cấp `inventory.view` **không kèm** `inventory.reversal.post` cho `WAREHOUSE_STAFF`,
`WAREHOUSE_APPROVER`, `WARRANTY_STAFF`, `LEADERSHIP`, `VIEWER`. Năm vai này bị đá khỏi màn
REV-00 dù backend cho đọc — đúng lớp lỗi đã sửa cho warranty ở WWHN-327.

- Sửa: `[ROUTES.REVERSE]: [P.INVENTORY_VIEW, P.REVERSAL_POST]`; hành động ghi vẫn ẩn theo
  `inventory.reversal.post`; thêm ghi chú chế độ chỉ đọc để màn hình không trông như lỗi thiếu nút.
- Bằng chứng: e2e "vai chỉ có inventory.view: vào được REV-00 ở chế độ đọc, không có hành động ghi".

### 2.4. `FE242-D4` · P1 · 409/412/428 không phục hồi được, người dùng kẹt vòng lặp

BR-REV-02 bắt buộc `If-Match` theo version hiện hành, nên ba mã đó **luôn** nghĩa là bản chụp
trong cache đã cũ. FE cũ chỉ toast "tải lại phiếu" rồi giữ nguyên cache ⇒ bấm lại vẫn gửi
đúng version cũ và **thất bại vô hạn**.

- Sửa: tự `refetch()` header + line ngay khi gặp 409/412/428, kèm alert nêu version/trạng thái mới.
  403/422 **không** kích hoạt cơ chế này (không phải xung đột optimistic lock).
- Bằng chứng: 4 unit test (`409`, `412`, `428`, và ca đối chứng `403`) + 5 ca e2e.

### 2.5. `FE242-D5` · P1 · Gửi request chắc chắn 428

REV-01 cho phép Submit khi lookup không trả `version`, tức bảo đảm nhận `428 PRECONDITION_REQUIRED`.
Nay chặn tại UI kèm lý do nghiệp vụ.

### 2.6. `TEST242-D6` · P1 · Lỗ hổng harness khiến lớp bug này lọt lưới

Mock `antd.Table` trong `src/test/setup.ts` **nuốt luôn prop `onRow`**. Mọi màn chọn-dòng-bằng-click
(REV-01 lookup movement, REV-00 double-click mở chi tiết…) không thể kiểm thử ở tầng unit, nên
suite vẫn xanh trong khi tương tác hỏng. Đã cho mock áp đúng props mà component khai báo.

- Ảnh hưởng: toàn bộ suite vẫn xanh sau thay đổi — **74 file / 571 test PASS**.

---

## 3. Kết quả đo được

| Cổng | Kết quả |
| --- | --- |
| FE unit (`npm run test`) | **74 file / 571 test PASS** (nền đầu phiên: 69/526) |
| FE lint | **0 error** (25 warning có sẵn, không thuộc WWHN-242) |
| FE e2e `test:e2e:wwhn-242` | **18/18 PASS** |
| Gate `verify:wwhn-242` | **PASS** |
| BE `Wwhn242ReversalScopeAndProjectionTest` | **7/7 PASS, 65 assertion** |

### Cổng đang ĐỎ nhưng KHÔNG thuộc WWHN-242

Ghi nguyên trạng thay vì làm tròn thành xanh. Nhánh `m1` đang có **nhiều phiên làm song song**;
hai cổng chung dưới đây đỏ vì cây làm việc dở của các task khác, **không có file nào thuộc phạm
vi hoàn đảo**:

| Cổng | Đỏ ở đâu | Thuộc task nào |
| --- | --- | --- |
| `npm run typecheck` | `src/modules/warranty/services/warrantyService.ts` (`resolveWarrantyPii` chưa tồn tại, import thừa), `src/modules/warranty/pages/WarrantyPage.test.tsx` (thiếu `pii_masked`) | luồng bảo hành, phiên khác |
| `npm run lint` | 9 error ở `src/modules/pv/pages/PvCatalogPage.tsx`, `PvProductDetailPage.tsx`, `src/test/wwhn-247-warranty-closure.test.ts` (`react-hooks`, `no-useless-escape`, `react-refresh`) | WWHN-247/252, phiên khác |
| `npm run format:check` | 13 file thuộc `modules/pv/**`, `modules/master-data/**`, `modules/inventory/**`, `modules/reports/**`, `shared/api/public-http.ts`, `test/wwhn-236\|237\|260` | WWHN-236/237/240/252/260/331, phiên khác |

Ghi chú vận hành cổng `verify:wwhn-242`: trong phiên này baseline bị các task khác sửa **hai
lần** (`ERD-AMD-007` của WWHN-260 trên ERD; mục "WWHN-236 closure" thêm vào Techstack Dev Guide).
Cổng đã **bắt đúng cả hai lần** rồi được repin bằng `npm run verify:wwhn-242 -- --repin` sau khi
đọc diff và xác nhận thay đổi không đụng clause hoàn đảo. Trong CI, cổng chạy **không kèm**
`--repin` nên baseline trôi vẫn là ĐỎ.

`npm run build` sẽ đỏ theo `typecheck` cho tới khi phiên bảo hành hoàn tất. **Không** file nào
trong `src/modules/reverse/**`, `src/app/router/access.ts`, `src/test/setup.ts`,
`e2e/wwhn-242-*`, `scripts/*wwhn-242*` bị liệt kê ở hai cổng trên — đã kiểm bằng
`npx eslint src/modules/reverse src/app/router/access.ts src/test/setup.ts` (0 vấn đề) và
`npx prettier --check` trên đúng tập file của task (unchanged).

---

## 4. Việc còn lại — không phải việc của FE

| Việc | Chủ | Ghi chú |
| --- | --- | --- |
| Cập nhật Description/AC/dependency của `WWHN-242` sang Reversal-only | BA Main / PM | Text dán sẵn ở `WWHN-242_SCOPE_DISPOSITION.md` §4 |
| Phê duyệt chính thức `WWHN-25 / DEC-STK-001` và `WWHN-26 / DEC-REV-001` | PM/PO + Client | Ngoài phạm vi task này; rule đang enforce theo `REQ-SRS-037` / `REQ-SRS-013` |
| QA độc lập chạy lại ma trận trên build đã deploy | QA2 | e2e ở đây là bằng chứng FE có kiểm soát, **không** thay QA độc lập, **không** phải UAT |
