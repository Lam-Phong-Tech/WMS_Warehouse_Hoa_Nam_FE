# WWHN-242 — HN-FE-006 · REV-00 / REV-01 (Hoàn đảo) · Exact Fix Register

Đóng register 61/100 → review lại 72/100 → review 80/100 (19/08/2026) → cập nhật bằng chứng
bên dưới. Mỗi mục ghi **lỗi thật đã sửa ở đâu** và **bằng chứng chạy được**, không có mục nào
đóng bằng lời hứa.

Nguồn thẩm quyền và định đoạt phạm vi: [`WWHN-242_SCOPE_DISPOSITION.md`](./WWHN-242_SCOPE_DISPOSITION.md).
Comment ký theo vai: [`WWHN-242_SIGNOFF_COMMENTS.md`](./WWHN-242_SIGNOFF_COMMENTS.md).
Bộ bằng chứng QA2 retrievable: [`docs/evidence/WWHN-242/qa2/INDEX.md`](../../evidence/WWHN-242/qa2/INDEX.md).

---

## 0-bis. Vòng review 80/100 (19/08/2026) — hai lỗi gốc còn lại

Vòng này chỉ còn hai việc thuộc quyền FE, và cả hai đều là **lỗi gốc thật**, không phải
thiếu giấy tờ.

### 0-bis.1. `FE242-P2-03` — trích dẫn nói quá thẩm quyền (P2, OPEN mới)

Review đúng: chú thích `// REQ-SRS-037 / DEC-NO-STOCKTAKE-001: ...` đặt hai mã ngang hàng
bằng dấu `/`, đọc như thể cả hai đều là căn cứ đã duyệt. Đối chiếu baseline:

- `REQ-SRS-037` là requirement **"Must"** trong SRS/FRD v1.12 (§3 bảng requirement, dòng
  `SRC-008 / DEC-NO-STOCKTAKE-001 → REQ-SRS-037`), adopt qua `WWHN-334`, kèm `AC-SRS-037` +
  `BR-NOSTK-01..03`, và được ERD §0.1 xác nhận. Đây là thứ **enforce được**.
- `DEC-NO-STOCKTAKE-001` nằm trong bảng Decision Records (SRS §2) với cột trạng thái ghi
  *"04/08/2026 confirmation; SRS adoption: WWHN-334; formal Decision: **WWHN-25 only**"* —
  tức Decision Record formal là `WWHN-25`, và `WWHN-25` vẫn **FORMAL APPROVAL PENDING**. Nó
  còn xuất hiện ở §1.6 Supersession Register với trạng thái `SUPERSEDED 04/08/2026` của mệnh
  đề cũ, nên trích nhầm cột là cách nhanh nhất để người đọc kết luận ngược.

Đã sửa **6 điểm trong `src/**`** (`shared/constants/routes.ts` — đúng chỗ review nêu,
`shared/api/endpoints.ts`, `shared/constants/wms-permissions.ts`, `app/router/access.test.ts`,
`test/wms-contract-signoff-guards.test.ts`, `test/wwhn-148-critical-response-contract.test.ts`)
và **2 điểm trong repo BE** (`Modules/Warehouse/app/Http/Controllers/WmsContractController.php`
— mã production, `tests/Feature/Flow05InventoryControlAlignmentTest.php`). `routes.ts` giữ bản
giải thích đầy đủ, các chỗ còn lại trích ngắn và trỏ về đó.

Chống hồi quy (đây mới là phần "tận gốc"): `scripts/verify-wwhn-242-closure.mjs` mục **6b**
quét mọi `.ts/.tsx` trong `src/**` — cấm dạng `REQ-SRS-037 / DEC-NO-STOCKTAKE-001`, và bắt
mọi chỗ nhắc `DEC-NO-STOCKTAKE-001` phải mang ranh giới "chưa có formal approval" trong cùng
khối chú thích. Mục 7 khoá thêm bản BE. Viết lại kiểu cũ là cổng đỏ ngay.

**Còn sót có chủ ý, đã tách việc riêng:** `scripts/build-wwhn190-posting-contract.mjs:431`
(BE) vẫn viết *"REQ-SRS-037 + DEC-NO-STOCKTAKE-001 cấm ..."*. Không sửa ở đây vì chuỗi đó đi
vào artifact sinh tự động của **WWHN-190**, mà script có chế độ `--check` fail-closed theo
digest — sửa chữ sẽ làm trôi pin của một gói đã đóng. Việc này thuộc chủ WWHN-190.

### 0-bis.2. `FE242-P1-03` / `FE242-P2-01` — bằng chứng không retrievable (P1/P2, PARTIAL+)

Review nói "cần QA2 evidence **retrievable** và **exact frozen SHA**". Truy nguyên: mọi vòng
trước đều ghi bằng chứng vào `test-results/wwhn-242/<sha>/`, mà `.gitignore` dòng 52 loại
nguyên `test-results/`. Nghĩa là **ai clone lại repo tại đúng SHA đó cũng không lấy được một
tấm ảnh nào** — bằng chứng chỉ tồn tại trên máy người chạy, nên về hồ sơ là không tồn tại.
Đây là lỗi gốc, không phải chuyện "chưa đính kèm".

Đã sửa:

1. `scripts/publish-wwhn-242-qa2-evidence.mjs` (mới) publish sang
   **`docs/evidence/WWHN-242/qa2/`** — thư mục được commit. Kèm `MANIFEST.json`
   (SHA-256 từng tệp), `SHA256SUMS`, và `INDEX.md` là **ma trận QA2 13 ca** với neo tài liệu
   từng ca (SRS §5.5/§6/§8.1-8.2, BR-REV-*, Annex D SCR-REV-01, NFR-SRS-006).
2. Script **fail-closed** ba chỗ: SHA phải là 40 ký tự thật (không nhận `local-uncommitted`);
   **các tệp thuộc phạm vi hoàn đảo phải đã commit** tại SHA đó; ma trận phải phủ đủ trước khi
   chép. Không đạt thì không publish, thay vì publish ra một bộ nửa vời.
3. Cổng `verify:wwhn-242` mục **8** băm lại từng tệp trên đĩa, đối chiếu manifest, kiểm phủ
   ma trận × 4 khổ, và kiểm **bất biến dải commit**: giữa `evidenceSourceSha` và `HEAD` không
   tệp nào trong phạm vi hoàn đảo được đổi. Cố ý chỉ soi *phạm vi* chứ không soi cả cây — `m1`
   luôn có phiên khác commit song song, soi cả cây thì cổng đỏ vì việc của người khác.

Bổ sung cho `FE242-P2-01`: hai màn review đòi mà trước đây chỉ có ở 1440×900 — **hộp xác nhận
trước khi Post** và **màn lỗi 403 DATA_SCOPE_DENIED** — nay chạy ở đủ bốn khổ. Spec đi từ
**18 → 25 test**.

**Đo được tại `2d9ca77bff67d27d4bc235ebf4542edb1d42f888`:**

| Hạng mục | Kết quả |
| --- | --- |
| `test:e2e:wwhn-242` | **25/25 PASS** |
| Bằng chứng publish | 50 tệp (25 ảnh + 25 JSON) + `MANIFEST.json` + `SHA256SUMS` + `INDEX.md`, 2,7 MB |
| Ma trận QA2 | 13 ca; 4 ca responsive × 4 khổ (1440×900, 1366×768, 768×1024, 390×844) |
| `verify:wwhn-242` | **PASS** (gồm mục 6b và mục 8 mới) |
| BE `Wwhn242ReversalScopeAndProjectionTest` + `Flow05InventoryControlAlignmentTest` | **17/17 PASS, 613 assertion** |
| FE unit (`npm run test`) | 90/91 file PASS, 709/710 test — 1 đỏ ở `src/test/flow06-report-pagination-export.test.ts`, thuộc luồng báo cáo của phiên khác |
| `npm run lint` | **PASS** — 0 error / 26 warning nền (không warning nào thuộc tệp của WWHN-242) |
| `npm run typecheck` / `npm run build` | 2 lỗi TS, cả hai ở `src/test/wwhn-258-report-pii-rbac.test.tsx` — tệp **untracked** của phiên WWHN-258 đang làm dở; `build` dừng ở chính hai lỗi đó |

Hai mục đỏ cuối **không có tệp nào thuộc phạm vi hoàn đảo**; ghi nguyên trạng thay vì làm
tròn thành xanh hoặc sửa hộ task khác.

Hai lỗi phép đo tự gặp và tự sửa trong lượt chạy đầu (ghi lại để QA2 khỏi mất thời gian
chẩn đoán lại): antd v6 vẽ tiêu đề `Modal.confirm` ở **hai** nút DOM — một `ant-modal-title`
**ẩn** (chỉ để `aria-labelledby`) và một `ant-modal-confirm-title` hiện, nên bám chuỗi tiêu đề
trần thì hoặc vi phạm strict mode hoặc trúng đúng nút ẩn; và lần điều hướng đầu tiên phải chờ
Vite dev server biên dịch cả cây module nên test đầu ma trận đỏ vì timeout `page.goto` chứ
không phải vì màn hình sai — đã thêm bước hâm nóng ngoài phạm vi mọi phép đo.

### 0-bis.3. Register 80/100 sau phiên này

| ID | Sev | Trạng thái sau phiên | Đã làm gì / còn ai phải làm |
| --- | --- | --- | --- |
| `FE242-P0-01` | P0 | **OPEN — chỉ còn thao tác Jira** | Text Description/AC/dependency đã soạn sẵn ở `WWHN-242_SCOPE_DISPOSITION.md` §4. FE không có quyền sửa `WWHN-62`/`WWHN-242` trên Jira ⇒ BA Main + PM/PO dán và comment approval. |
| `FE242-P1-01` | P1 | **OPEN — việc thật của QA2** | Đã giao đủ đầu vào: ma trận 13 ca có neo tài liệu + 25 ảnh + lệnh chạy lại ở `docs/evidence/WWHN-242/qa2/INDEX.md`, gắn exact SHA. Lượt chạy độc lập + verdict vẫn là việc của QA2 trên `WWHN-243`; FE không tự đóng thay. |
| `FE242-P1-02` | P1 | **DEFERRED / OUT OF SCORE** | Theo review, chuyển final project gate. Phiên này **không** đụng gì tới GitHub Actions. |
| `FE242-P1-03` | P1 | **CLOSED** | Bằng chứng chuyển sang nơi retrievable + băm + exact SHA `2d9ca77`. Xem §0-bis.2. |
| `FE242-P1-04` | P1 | **TECHNICAL CLOSED / FORMAL OPEN** | Nội dung §2 hồ sơ định đoạt không đổi và vẫn đúng; còn thiếu chữ ký formal của BA/BAS + PM/PO trực tiếp trên Jira. |
| `FE242-P2-01` | P2 | **CLOSED** | 4 ca responsive × 4 khổ (REV-00, REV-01 chi tiết, hộp xác nhận, màn lỗi) đã có ảnh thật, retrievable, gắn SHA. |
| `FE242-P2-02` | P2 | **CLOSED** | Canonical là `m1`; không tồn tại `m1ee`. Không đổi. |
| `FE242-P2-03` | P2 | **CLOSED** | 6 điểm FE + 2 điểm BE đã chuẩn hoá; cổng 6b/7 chặn hồi quy. Một chỗ còn sót có chủ ý ở gói WWHN-190, xem §0-bis.1. |

---

## 0. Vòng review 72/100 (19/08/2026) — chẩn đoán lại và bằng chứng mới

Review 72/100 nêu `FE242-P1-02` **OPEN**: "evidence hiện có lint FAIL, verify FAIL,
build/typecheck skipped và dirty tree". Đúng — file
`docs/evidence/WWHN-242/RUNTIME_IDENTITY_PIN.json` tại thời điểm review có
`generatedAt: 2026-08-18T15:59:00.514Z`, `workingTreeClean: false`,
`dirtyFileCount: 66` (FE) / `76` (BE), và `typecheck`/`build` bị `--skip`. Chính file đó tự
gắn cờ `truthBoundary`: *"Nếu workingTreeClean=false thì SHA KHÔNG mô tả đúng cây đã chạy;
phải commit rồi chạy lại trước khi dùng làm exact-SHA evidence"* — nói cách khác bản ghi cũ
tự nhận nó KHÔNG hợp lệ, nhưng vẫn bị để lại trong repo. Review bắt đúng.

**Chẩn đoán lại trên `m1` sạch, không dùng `--skip`:**

| Cổng | Trước (18/08 15:59, dirty=66/76, có `--skip`) | Sau (19/08, chạy lại đủ 5 cổng) |
| --- | --- | --- |
| `lint` | FAIL (exit 1) | **PASS** (exit 0, 0 error / 25 warning nền không đổi) |
| `typecheck` | SKIPPED | **PASS** (exit 0) |
| `test` | PASS | **PASS** — 90 file / 701 test (nền cũ 74/571) |
| `build` | SKIPPED | **PASS** (exit 0) |
| `verify:wwhn-242` | FAIL (exit 1) | **PASS** (exit 0) |

Kết luận: **không có regression code thật** trong phạm vi `src/modules/reverse/**`,
`src/app/router/access.ts`, `src/test/setup.ts`, `scripts/*wwhn-242*`. `lint`/`verify` FAIL
lần trước là do bản ghi bị chụp giữa lúc cây làm việc bẩn bởi các phiên song song khác
(đúng bẫy đã ghi ở [[feedback-check-concurrent-session-first]]), không phải lỗi trong code
hoàn đảo. Bằng chứng mới: `docs/evidence/WWHN-242/RUNTIME_IDENTITY_PIN.json` (5/5 PASS) +
`test-results/wwhn-242/<EXACT_SHA>/` (18/18 e2e PASS, chạy với `SOURCE_SHA` ghim đúng HEAD).

`verify:wwhn-242` PASS **không cần `--repin`**: commit `719c1a4` (WWHN-310) đã tự cập nhật
hash baseline trong `WWHN-242_SCOPE_DISPOSITION.md` khi đồng bộ ERD, đúng quy ước chống
pin-rot đã dùng từ trước — không phải việc của phiên này.

Hai cổng KHÔNG thuộc 5 cổng bắt buộc của `FE242-P1-02` (`lint`/`typecheck`/`test`/`build`/
`verify:wwhn-242`) vẫn đỏ nhưng **không** do WWHN-242, xem bảng ở §3.

---

## 1. Register theo đúng ID của review

| ID | Sev | Trạng thái | Đã làm gì | Bằng chứng |
| --- | --- | --- | --- | --- |
| **FE242-P0-01** | P0 | **CLOSED (phần kỹ thuật) / OPEN (phần Jira — chưa có action thật trên Jira)** | Kỹ thuật không đổi so với vòng 61/100 (đúng). Review 72/100 bắt đúng: Jira `WWHN-62`/`WWHN-242` **chưa được cập nhật thật** — mới chỉ có text soạn sẵn trong doc, chưa dán vào Jira. Đây là thao tác chỉ người có quyền Jira làm được. | `WWHN-242_SCOPE_DISPOSITION.md` §4 (text dán sẵn); cần BA Main/PM thực thi trên Jira + comment xác nhận (soạn sẵn ở cuối phiên làm việc này) |
| **FE242-P1-01** | P1 | **OPEN — không đổi, đúng như review** | `WWHN-243` là Jira ticket riêng, FE không sở hữu, không có quyền attach/update. Phiên này đã chạy lại matrix và tạo bằng chứng thật (18/18 PASS, screenshot+JSON+trace) sẵn sàng để QA2 đính kèm — nhưng **việc đính kèm + independent run là việc thật của QA2**, FE không tự đóng thay được. | `e2e/wwhn-242-reversal-qa2.spec.ts` — 18/18 PASS chạy lại 19/08; `test-results/wwhn-242/<EXACT_SHA>/` (ảnh 4 khổ + JSON) sẵn sàng cho QA2 |
| **FE242-P1-02** | P1 | **CLOSED (re-verified 19/08)** | Root cause là evidence CŨ bị chụp giữa lúc cây bẩn (dirty=66/76) kèm `--skip=typecheck,build` — không phải code hỏng. Đã chạy lại `npm run wwhn-242:evidence` KHÔNG `--skip` trên `m1` tại HEAD hiện hành: **5/5 gate PASS** (lint/typecheck/test/build/verify:wwhn-242). Xem §0. | `docs/evidence/WWHN-242/RUNTIME_IDENTITY_PIN.json` (5/5 PASS, exit=0 mọi cổng) + `logs/*.log` |
| **FE242-P1-03** | P1 | **CLOSED (thực thi lại 19/08, không chỉ commit source)** | Đã **chạy** `npm run test:e2e:wwhn-242` với `SOURCE_SHA` ghim đúng HEAD (không phải "local-uncommitted"): 18/18 PASS, phủ lookup → chọn → partial 2/20 → dependency guard → chi tiết → CONFIRMED → Post; ma trận 403/409/412/422/428 với khẳng định "không đổi trạng thái". | `test-results/wwhn-242/<EXACT_SHA>/*.png` + `*.json` (32 file bằng chứng) — chạy thật, không phải liệt kê ý định |
| **FE242-P1-04** | P1 | **CLOSED kỹ thuật / OPEN formal (đúng như review)** | Nội dung §2 (C1..C7/R1..R5 + SHA-256) không đổi, vẫn đúng — phần còn thiếu là **BA/PM ký formal trên Jira**, không phải sửa lại doc. | `WWHN-242_SCOPE_DISPOSITION.md` §2; cần comment xác nhận của BA Main + PM/PO (soạn sẵn cuối phiên này) |
| **FE242-P2-01** | P2 | **CLOSED (có runtime screenshot PASS trên HEAD hiện hành, không chỉ code cover)** | Chạy lại thật, không chỉ dựa vào code đã cover: ảnh PASS tại 390×844, 768×1024, 1366×768, 1440×900 cho REV-00/REV-01/chi tiết/lỗi/confirm, gắn đúng `EXACT_SHA`. | `test-results/wwhn-242/<EXACT_SHA>/WWHN-242__rev00-list__*` và `__rev01-detail__*` — 4 khổ × các màn |
| **FE242-P2-02** | P2 | **CLOSED — xác nhận lại, không đổi** | Nguồn canonical vẫn là `m1`. Không tồn tại nhánh `m1ee`; các chỗ nhắc `m1ee` trong repo đều là câu khẳng định "không dùng nguồn này", không phải usage thật (đã rà lại toàn repo 19/08). | `.github/workflows/wwhn-242-fe-closure.yml`; `grep -r m1ee` chỉ trúng câu phủ định |

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

### Vòng 61/100 (18/08)

| Cổng | Kết quả |
| --- | --- |
| FE unit (`npm run test`) | 74 file / 571 test PASS (nền đầu phiên: 69/526) |
| FE lint | 0 error (25 warning có sẵn, không thuộc WWHN-242) |
| FE e2e `test:e2e:wwhn-242` | 18/18 PASS |
| Gate `verify:wwhn-242` | PASS |
| BE `Wwhn242ReversalScopeAndProjectionTest` | 7/7 PASS, 65 assertion |

### Vòng 72/100 → chạy lại 19/08 (HEAD `f9f2e65e687669f033d259a693635546876f05a8`)

| Cổng | Kết quả |
| --- | --- |
| FE lint | **PASS**, exit 0 (0 error / 25 warning nền, không đổi) |
| FE typecheck | **PASS**, exit 0 |
| FE unit (`npm run test`) | **PASS** — 90 file / 701 test |
| FE build | **PASS**, exit 0 |
| Gate `verify:wwhn-242` | **PASS**, exit 0 (không cần `--repin`, xem §0) |
| FE e2e `test:e2e:wwhn-242` (`SOURCE_SHA` ghim HEAD) | **18/18 PASS**, evidence tại `test-results/wwhn-242/f9f2e65.../` |
| BE `Wwhn242ReversalScopeAndProjectionTest` | **7/7 PASS, 65 assertion** (chạy lại, không đổi so với 18/08) |

Nguồn: `docs/evidence/WWHN-242/RUNTIME_IDENTITY_PIN.json` (regenerate 19/08, `summary.passed=5,
failed=0, skipped=0`).

### Cổng đang ĐỎ nhưng KHÔNG thuộc WWHN-242 (rà lại 19/08)

Nhánh `m1` vẫn có **nhiều phiên làm song song**; các cổng dưới đây đỏ vì việc của task khác,
**không có file nào thuộc phạm vi hoàn đảo** (`src/modules/reverse/**`,
`src/app/router/access.ts`, `src/test/setup.ts`, `e2e/wwhn-242-*`, `scripts/*wwhn-242*`):

| Cổng | Đỏ ở đâu | Thuộc task nào |
| --- | --- | --- |
| `npm run format:check` | `src/test/wwhn-202-balance-contract-pin.test.ts` (Prettier drift) | WWHN-202, phiên khác |
| `npm run check:api-mapping` | `swagger-api.json` không khớp `docs/api-evidence/BE_CONTRACT_PIN.json` (pin trỏ BE `8326d505e5c7`, BE hiện đã tiến xa hơn do các task khác) | contract sync xuyên task, không phải reversal |

So với vòng 18/08: `npm run typecheck` và `npm run lint` (khi đó đỏ vì `src/modules/warranty/**`
và `src/modules/pv/**` của các phiên khác) **nay đã PASS** — các task đó đã đóng xong ở các
phiên sau. `npm run build` cũng PASS theo. Hai cổng còn đỏ ở trên **không nằm trong 5 cổng bắt
buộc** của `FE242-P1-02` (`lint`/`typecheck`/`test`/`build`/`verify:wwhn-242`) nên không chặn
closure của register này; ghi lại đúng nguyên trạng thay vì làm tròn thành xanh hoặc tự ý sửa
hộ task khác.

---

## 4. Việc còn lại — không phải việc của FE

| Việc | Chủ | Ghi chú |
| --- | --- | --- |
| Cập nhật Description/AC/dependency của `WWHN-242` sang Reversal-only | BA Main / PM | Text dán sẵn ở `WWHN-242_SCOPE_DISPOSITION.md` §4 |
| Phê duyệt chính thức `WWHN-25 / DEC-STK-001` và `WWHN-26 / DEC-REV-001` | PM/PO + Client | Ngoài phạm vi task này; rule đang enforce theo `REQ-SRS-037` / `REQ-SRS-013` |
| QA độc lập chạy lại ma trận trên build đã deploy | QA2 | e2e ở đây là bằng chứng FE có kiểm soát, **không** thay QA độc lập, **không** phải UAT |
