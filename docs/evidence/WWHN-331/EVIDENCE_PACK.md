# WWHN-331 [FE1] Hoàn thiện UX nhập dữ liệu tùy chọn — Evidence Pack (đóng register R3)

Ngày: 18/08/2026. Nhánh **`m1` duy nhất** ở cả FE và BE (không tạo nhánh riêng).
Task cha `WWHN-89`; dependency `HN-STR-003-ST01`; BE song hành `WWHN-330`; QA `WWHN-332`.

**Nguồn chấm điểm đang xử lý:** comment *"Chưa đạt yêu cầu - Đánh giá: 77/100 (77%)"* —
bảng *P0/P1/P2 Exact Fix Action Register — R3* gồm `FE331-P1-01R3..06R3` và
`FE331-P2-01R3/02R3`. **Ticket không có mục P0 ở bất kỳ vòng review nào.**

## SHA chốt (FE331-P1-05R3 / FE331-P2-01R3)

| Repo | Nhánh | Commit chốt |
|---|---|---|
| `WMS_Warehouse_Hoa_Nam_FE` | `m1` | `4dc3c570d92baddf3c9ebe47cddf9bc5b989c979` |
| `WMS_Warehouse_Hoa_Nam_BE` | `m1` | `93b1e71f0e01c8a7c77670e0c8f0af38d2e68470` |

Không tồn tại nhánh `m1ee`; không có nhánh riêng cho WWHN-331. Mọi số liệu dưới đây đo
trên đúng hai commit này.

**Ghi chú trung thực về commit BE:** nhánh `m1` được nhiều luồng công việc dùng chung, và
`93b1e71` mang tiêu đề của một task khác (`docs(WWHN-273)`) vì nó gộp cả thay đổi WWHN-331
vào cùng lượt commit. Nội dung WWHN-331 nằm đủ và đúng trong commit đó; danh sách 11 tệp
kèm **sha256 từng tệp** để reviewer kiểm chứng mà không cần tin vào tiêu đề commit nằm ở
`docs/evidence/WWHN-331/BE_CHANGE_MANIFEST.md` (repo BE, commit `3a826ff`).

---

## A. Trạng thái register R3

| ID | Sev | Yêu cầu R3 | Đã làm | Trạng thái |
|---|---|---|---|---|
| FE331-P1-01R3 | P1 | Reset preview khi option đổi + preview fingerprint; test cả false→true và true→false | Mục B | **ĐÓNG** |
| FE331-P1-02R3 | P1 | BA chốt rule; BE fingerprint options nếu options là identity; FE cập nhật UX | Mục C + `DEC-IMP-001` §2 | **ĐÓNG về code**, chờ comment BA |
| FE331-P1-03R3 | P1 | Formal approve values hoặc lấy từ approved/config contract; bỏ user-facing unapproved constant | Mục D + `DEC-IMP-001` §1,§4 | **ĐÓNG về code**, chờ comment BA/Tech Lead |
| FE331-P1-04R3 | P1 | QA1 chạy exact FE + exact BE SHA | Mục F (phạm vi + lệnh) | **CÒN MỞ — thuộc QA1** |
| FE331-P1-05R3 | P1 | Refresh evidence pack/Jira với exact committed SHA | File này + bảng SHA ở trên | **ĐÓNG** |
| FE331-P1-06R3 | P1 | BA/BE chốt scope; QA cross-user/cross-scope verify | Mục E + `DEC-IMP-001` §3 | **ĐÓNG về code**, QA verify ở mục F |
| FE331-P2-01R3 | P2 | Dùng `m1` + exact SHA; không dùng pseudo-path | Bảng SHA ở trên | **ĐÓNG** |
| FE331-P2-02R3 | P2 | Sprint live W3 nhưng Sprint Scope W4 | Metadata Jira, không phải code | **CÒN MỞ — thuộc PM/Jira owner** |

---

## B. FE331-P1-01R3 — kết quả dry-run bị vô hiệu khi đổi tùy chọn

**Lỗi gốc (bị bắt hai vòng liên tiếp R2 rồi R3).** `canCommit` chỉ hỏi *"đã có
previewResult chưa và nó có sạch lỗi không"*; nó không ràng buộc `update_existing` hiện
tại với `update_existing` lúc dry-run. Chuỗi thao tác dry-run → gạt công tắc → Import
chính thức vẫn bấm được, và thứ được commit là payload **chưa hề được kiểm tra thử** —
đúng thứ mà bước dry-run sinh ra để ngăn:

| Chiều đổi | Hệ quả thật |
|---|---|
| `false → true` | Preview báo "sẽ tạo mới N SKU"; commit lại được phép **ghi đè SKU đang tồn tại**. Người dùng sửa dữ liệu đang chạy mà không hề thấy trước. |
| `true → false` | Preview sạch lỗi vì cho phép ghi đè; commit trả `DUPLICATE_CODE` và bị từ chối. Người dùng không hiểu vì sao "đã kiểm tra rồi" mà vẫn lỗi. |

**Cách vá (`src/modules/master-data/components/SkuImportModal.tsx`):**

1. `payloadSignature(file, updateExisting)` — vân tay của payload đã kiểm tra thử.
2. Payload được **truyền vào mutation** thay vì đọc lại từ state trong callback, nên kết
   quả trả về luôn gắn đúng bộ đã gửi — chặn cả ca đua "gạt công tắc trong lúc dry-run
   đang chạy, response cũ về sau đó".
3. `onChange` của `Switch` và của input file gọi `invalidatePreview()`: xoá số liệu cũ
   ngay, giữ lại vân tay để UI phân biệt *"chưa từng kiểm tra thử"* với *"đã kiểm tra thử
   nhưng lựa chọn vừa đổi"* — hai trạng thái cần hai câu hướng dẫn khác nhau.
4. `canCommit` thêm điều kiện `previewSignature === currentSignature` và
   `!previewMutation.isPending`.

**Test (`src/modules/master-data/components/SkuImportModal.test.tsx`, 6 test):**
`false → true` tắt nút Import, hiện đúng lý do, và **không có lời gọi commit nào lọt qua**;
`true → false` cũng tắt; chạy lại dry-run mở khoá và commit gửi **đúng** tùy chọn mới; đổi
file cũng vô hiệu hoá; 2 test cho mục D.

**Sửa kèm ở test harness (`src/test/setup.ts`):** stub `Switch` trước đây render một
`<input>` trần và đẩy nguyên `ChangeEvent` vào `onChange`, trong khi antd thật gọi
`onChange(checked: boolean)`. Component xử lý đúng contract antd sẽ nhận nhầm event
object, và test **không thể** bật/tắt công tắc (click vào `<input>` không có
`type="checkbox"` không sinh sự kiện nào) — tức là đúng hành vi cần khoá lại thì không
kiểm chứng được. Stub nay là `<button role="switch" aria-checked>` gọi `onChange` với
boolean. Toàn bộ 68 file test cũ vẫn xanh sau thay đổi này.

---

## C. FE331-P1-02R3 — `update_existing` là một phần của định danh replay

Trước: định danh replay = `file_sha256 + actor_id + cửa sổ 24h`. Cùng file nộp lại với
`update_existing` khác hẳn bị trả về kết quả cũ và **không chạy** — nuốt mất một thao tác
người dùng thực sự muốn thực hiện.

Sau (`DEC-IMP-001` §2):

```
identity = file_sha256 + actor_id + options_fingerprint
options_fingerprint = sha256("update_existing=0") | sha256("update_existing=1")
```

| Thay đổi | Tệp |
|---|---|
| Cột `options_fingerprint` + index tra cứu replay | `Modules/Warehouse/database/migrations/2026_08_18_190000_*` |
| Tính vân tay; chuỗi chuẩn hoá phơi ra để QA dựng lại được | `Modules/Warehouse/app/Support/SkuImportContract.php` |
| `findRecentDuplicateReport()` so đủ định danh; khoá chống đua cũng theo đúng định danh đó | `ImportService.php` |
| Lưu vân tay khi ghi báo cáo; trả `update_existing` + `options_fingerprint` trong response | `ImportController.php` |
| UX: toast + Alert nói rõ "trùng file **và** trùng tùy chọn", gợi ý đổi tùy chọn là một lần import khác | `SkuImportModal.tsx` |

Bản ghi cũ (`options_fingerprint IS NULL`) được xử lý theo hướng **bảo toàn hành vi cũ** —
vẫn coi là trùng — thay vì đoán; nhánh này tự hết hiệu lực sau một cửa sổ idempotent kể từ
lúc triển khai.

---

## D. FE331-P1-03R3 — hết hằng số "tạm" trên màn hình người dùng

Trước: bốn giá trị (1000 dòng / 10MB / hạn file lỗi 24h / cửa sổ idempotent 24h) là hằng
số riêng ở ba lớp PHP, mỗi chỗ kèm ghi chú *"giá trị tạm, cần BA/Tech Lead chốt"*, và FE
chép lại chính những con số đó vào một Alert **kèm cả câu "chưa chốt chính thức"** cho
người dùng cuối đọc.

Sau:

1. `config/warehouse.php` → `warehouse.sku_import` là **nguồn sự thật duy nhất**;
   `ImportService`, validator upload và `ImportErrorFileService` đều đọc từ đó.
2. Quyết định chính thức `docs/decision-records/DEC-IMP-001.md` (BE repo) — BA + Tech Lead
   duyệt bằng comment trên WWHN-331.
3. API trả khối `constraints` trong **mọi** response `/skus/import-excel` và trong
   `meta.constraints` của `GET /skus/import-reports`; OpenAPI mô tả đủ.
4. FE render từ khối đó. Không còn con số nào viết cứng ở FE — kể cả thuộc tính `accept`
   của input file. BE không trả `constraints` thì UI nói *"giới hạn do máy chủ quy định"*
   thay vì đoán một con số có thể đã lỗi thời (có test riêng).

**Không mở route mới là chủ ý:** `/skus/import-excel`, `/skus/import-template` và ba route
Import báo cáo vốn đã nằm ngoài 67 operation Annex C (REQ-SRS-034, DEC-MIG-API-001); thêm
một endpoint công khai nữa là tự mở rộng bề mặt API ngoài baseline đã duyệt.

**Ranh giới đã ghi rõ trong DEC-IMP-001:** NFR-SRS-017 (dry-run tối thiểu 10 000 dòng/file)
thuộc luồng migration/opening balance chạy bằng job có kiểm soát (REQ-SRS-021,
DEC-MIG-API-001), **không** áp cho endpoint import SKU tương tác này.

---

## E. FE331-P1-06R3 — data-scope của Import báo cáo SKU

`sku.manage` trả lời *"được dùng chức năng import hay không"*, **không** trả lời *"được
đọc lần import của ai"*. Trước thay đổi này, bất kỳ ai có `sku.manage` cũng liệt kê được
mọi Import báo cáo và tải được file lỗi CSV của người khác — mà file lỗi chứa nguyên nội
dung file người đó nộp (mã SKU, tên hàng, giá trị từng ô sai).

| Phạm vi | Điều kiện | Được đọc |
|---|---|---|
| `GLOBAL` | `User::warehouseScopeIds() === null` | Mọi Import báo cáo SKU |
| `ACTOR_SCOPED` | Người gọi bị giới hạn kho | Chỉ báo cáo do chính mình tạo |

| Tình huống | Mã |
|---|---|
| Thiếu `sku.manage` | **403** `ACCESS_DENIED` |
| Trong scope | **200** |
| Báo cáo của người khác | **404** `RESOURCE_NOT_FOUND` — y hệt bản ghi không tồn tại |

Chọn 404 (không phải 403) cho bản ghi ngoài scope là chủ ý: 403 xác nhận *"id này có tồn
tại nhưng bạn không được xem"*, tức vẫn rò rỉ sự tồn tại. Với `warehouse_id` truyền vào làm
**tham số lọc** thì vẫn giữ 403 `ACCESS_DENIED` như WWHN-328 — hai ca khác nhau.

Áp cho **cả ba** route qua đúng một `scopedQuery()`. Nguồn scope lấy đúng `scope_ref` mà
`EnforceInventoryWarehouseScope` và `/reports/dashboard-quick` đang dùng → **không phát
sinh permission mới**, không có nguồn scope thứ hai để lệch nhau. `meta.data_scope` được
trả ra để QA/BA đọc được phạm vi ngay trên response.

---

## F. FE331-P1-04R3 / FE331-P1-05R3 — lệnh đã chạy thật và kết quả

Tất cả chạy trên đúng hai SHA ở bảng đầu file.

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` (FE) | **PASS** — 0 lỗi |
| `npm run test` (FE) | **PASS** — 68 file / **516 test** |
| `npm run lint` (FE) | **PASS** — 0 error, 25 warning (đều pre-existing ở file khác: `CameraScanModal`, `MvpPutawayPage`, …) |
| `npm run format:check` (FE) | **PASS** — không phát sinh drift mới |
| `npm run build` (FE) | **PASS** |
| `npm run check:api-mapping` (FE) | **PASS** — 56 dòng endpoint |
| `php vendor/bin/phpunit tests/Feature/Wwhn331ImportContractClosureTest.php` | **PASS** — 8 test / 60 assertion |
| `php vendor/bin/phpunit` (BE, full suite, sqlite theo `phpunit.xml`) | **PASS** — **724 test / 702 pass / 22 skip / 0 fail**, 8 413 assertion |
| `php vendor/bin/pint --test` — các tệp thuộc WWHN-331 | **PASS** |

Ghi chú đọc số BE: 22 skip là các gate chỉ chạy trên PostgreSQL (`DocumentationBaselineContractTest`
phần physical contract, ERD parity…) — không phải test bị bỏ qua vì hỏng.

**Phạm vi QA1 (WWHN-332) phải chạy độc lập trên đúng hai SHA này:**

1. `update_existing` false→true và true→false sau dry-run: nút Import phải tắt, và không
   có request commit nào được gửi.
2. Nộp lại **cùng file + cùng tùy chọn** → `duplicate=true`, không tạo báo cáo thứ hai,
   không ghi SKU lần hai. Nộp lại **cùng file + đổi tùy chọn** → chạy thật.
3. Dựng lại vân tay không cần đọc code: `sha256("update_existing=1")` phải bằng
   `options_fingerprint` của lần import chạy với `update_existing=true`.
4. Data-scope: người dùng bị giới hạn kho A tạo import lỗi → người dùng bị giới hạn kho B
   gọi detail và error-file phải **404** (không phải 403), danh sách của B không chứa báo
   cáo của A, người dùng GLOBAL vẫn 200. Thiếu `sku.manage` vẫn 403.
5. Hạn mức hiển thị trên UI trùng khít `constraints` trong response (đổi
   `SKU_IMPORT_MAX_ROWS` ở môi trường test rồi kiểm tra UI đổi theo).
6. File lỗi CSV: nội dung row/field/error_code/message/value; hết hạn → 404; responsive.

---

## G. Còn mở — không thuộc thẩm quyền FE1

| Mục | Cần ai | Nội dung |
|---|---|---|
| FE331-P1-02R3 / P1-03R3 / P1-06R3 | **BA + Tech Lead** | Duyệt `DEC-IMP-001` bằng comment trên WWHN-331 (mẫu ở `SIGNOFF_COMMENTS.md`) |
| FE331-P1-04R3 | **QA1** | Chạy độc lập theo phạm vi mục F, đính raw log + env + hai SHA |
| FE331-P2-02R3 | **PM / Jira owner** | Đồng bộ Sprint Scope (W4) với Sprint live (W3) |
| Job dọn file lỗi | **DevOps** | Xác nhận Laravel scheduler chạy thật ở PROD để `import:purge-error-files` (02:15 hằng ngày) hoạt động; nếu không, CSV lỗi tồn vĩnh viễn trên đĩa |

**Ranh giới trung thực:** evidence ở mục F do FE/DEV tự chạy. Nó **không** thay thế QA1
chạy độc lập (WWHN-332), không thay thế BE runtime sign-off trên môi trường thật, và không
phải cam kết SLA production.
