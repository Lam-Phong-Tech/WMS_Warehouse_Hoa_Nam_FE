# WWHN-331 [FE1] Hoàn thiện UX nhập dữ liệu tùy chọn — Evidence Pack

Ngày: 18/08/2026. Nhánh **`m1` duy nhất** ở cả FE và BE (không tạo nhánh riêng).
Task cha: `WWHN-89` [STRETCH] Tối ưu UX nhập dữ liệu hàng loạt. Dependency:
`HN-STR-003-ST01`. Task BE song hành: `WWHN-330`. Task QA: `WWHN-332`.

Nguồn chấm điểm: comment "Chưa đạt yêu cầu - Đánh giá: 33/100 (33%)" của Wuangg trên
`WWHN-331`, bảng *P0/P1/P2 Exact Fix Action Register* gồm FE331-P1-01..07 và
FE331-P2-01..02. **Ticket này không có mục P0 nào.**

---

## A. Trạng thái từng mục trong register

| ID | Sev | Hiện trạng lúc review | Đã làm gì | Trạng thái |
|---|---|---|---|---|
| FE331-P1-01 | P1 | Chưa có Import UI enhancement ở đúng SKU/Item scope | Màn hình `SkuImportModal` mở từ `SkuMasterScreen` (`ApiMasterScreens.tsx`), gate `sku.manage` | **ĐÓNG** |
| FE331-P1-02 | P1 | `SKU_IMPORT_EXCEL` trỏ `/import-batches` (resource khác hẳn), chưa có service/component | Constant trỏ đúng `/skus/import-excel`; `sku-import.service.ts` phủ đủ 5 route; mapping ghi vào `docs/api-evidence/M1_API_MAPPING.md` | **ĐÓNG** |
| FE331-P1-03 | P1 | Không có error-file download UX | Xem mục B — vá tận gốc cả BE lẫn FE | **ĐÓNG** |
| FE331-P1-04 | P1 | BE limit chưa khoá; FE pattern khác hard-code 10k/20MB | FE **không** validate bằng số cứng; hiển thị nguyên văn lỗi limit của BE. Số thật đã đo, xem mục C | **ĐÓNG về phía code** — con số chính thức chờ BA/Tech Lead chốt |
| FE331-P1-05 | P1 | Chưa có idempotency/replay/conflict UX | `commitMutation` xử lý `duplicate:true` như success-envelope riêng; nút disable khi pending (chống double-submit) | **ĐÓNG** |
| FE331-P1-06 | P1 | QA1 (WWHN-332) Blocked/Pending, 0 evidence | Không thể tự làm thay QA. Đã liệt kê phạm vi test đề nghị ở mục E | **CÒN MỞ — thuộc QA1** |
| FE331-P1-07 | P1 | Không có evidence pack, không CI exact HEAD | File này + kết quả chạy thật ở mục D | **ĐÓNG phần FE tự chạy được** |
| FE331-P2-01 | P2 | Tham chiếu nhánh `m1ee`/`m1` không tồn tại | Toàn bộ việc nằm trên `m1`, SHA ghi ở mục D | **ĐÓNG** |
| FE331-P2-02 | P2 | Sprint live W3 nhưng Sprint Scope text còn W4 | Là metadata Jira, không phải code | **CÒN MỞ — thuộc PM/Jira owner** |

---

## B. FE331-P1-03 — Error-file download UX: root cause thật sự nằm ở đâu

Lúc review, FE chỉ có thể suy ra "có file lỗi hay không" từ `error_file_path` mà BE trả
ra, rồi **tự so `error_file_expires_at` với đồng hồ máy client** để đoán còn hạn hay
không. Cách đó có hai lỗi gốc, không phải lỗi giao diện:

1. **Rò thông tin ngoài phạm vi.** `error_file_path` là đường dẫn lưu trữ nội bộ trên
   disk private của server. Register ghi rõ yêu cầu "không lộ data ngoài scope", nhưng
   API vẫn trả nguyên đường dẫn cho mọi client có `sku.manage`.
2. **Nguồn sự thật đặt sai chỗ.** Đồng hồ máy client không đáng tin (lệch giờ, sai
   timezone). Client tự tính hạn dùng thì có lúc hiện nút tải dẫn thẳng tới 404, có lúc
   ẩn nút trong khi file vẫn tải được — hai trạng thái mà register bắt phải xử lý đúng.

**Cách vá (BE — `WMS_Warehouse_Hoa_Nam_BE`, nhánh `m1`):**

- `ImportReport` thêm `$hidden = ['error_file_path']`: đường dẫn nội bộ không bao giờ ra
  khỏi server nữa.
- `ImportReport` thêm accessor `error_file_available` = *đã sinh file* **và** *chưa quá
  `error_file_expires_at`* — tính tại server, **đúng bằng** điều kiện
  `ImportReportController::downloadErrorFile()` dùng để quyết định 200 hay 404. Một
  điều kiện duy nhất, hai nơi không thể lệch nhau.
- `ImportController::importExcel()` trả luôn `error_file_available` trong response 422,
  lấy từ chính accessor đó.
- OpenAPI của cả 3 route Import báo cáo ghi rõ hợp đồng này.

**Cách vá (FE):**

- `sku-import.service.ts`: `SkuImportReportRecord.errorFilePath` → `errorFileAvailable`;
  `SkuImportResult` nhận thêm `errorFileAvailable`/`errorFileExpiresAt`.
- `SkuImportModal.tsx`: bỏ hoàn toàn phép so hạn dùng phía client (`isPastExpiry` đã
  xoá). Panel tải file lỗi phủ đủ trạng thái register yêu cầu:

  | Trạng thái | Hành vi UI |
  |---|---|
  | availability | Nút chỉ hiện khi `error_file_available === true` |
  | loading | Nút `loading` khi đang tải hoặc đang làm mới báo cáo |
  | 403 (thiếu quyền) xem báo cáo | Ẩn hẳn khu vực — không lộ cả sự tồn tại |
  | 403 khi bấm tải | Dòng chữ giải thích thiếu quyền, không đổ lỗi kỹ thuật |
  | 404 / hết hạn / đã bị dọn | Một thông điệp đúng nghĩa + gợi ý chạy lại dry-run; đồng thời tự `refetch` báo cáo để nút tắt đi |
  | lỗi khác (mạng/5xx) | `ApiErrorAlert` kèm nút thử lại |
  | double-submit | Nút disable khi đang gửi |

- Response import đã tự mang `error_file_available` nên panel hiển thị đúng ngay lần
  render đầu, không nháy trạng thái "đang kiểm tra".

**Đóng luôn một schema chết phát hiện khi rà:** cột `duplicate_of_replay` (migration
`2026_08_18_180000`) được khai báo `fillable`/`cast` nhưng **không nơi nào ghi hoặc
đọc**. Nay `ImportService::duplicateResult()` đánh dấu bản ghi **gốc** khi nó bị phát
lại — đúng thứ bằng chứng reconcile mà DEV330-P1-03 yêu cầu ("same file repeat …
counts/checksum/reconciliation"): QA/BA truy vấn `import_reports` là thấy ngay báo cáo
nào đã được trả lại cho một lần gửi trùng, không phải đi đọc log ứng dụng. Marker này
không đụng tới số liệu nghiệp vụ của lần import gốc (có test khẳng định).

---

## C. FE331-P1-04 / DEV330-P1-02 — số benchmark thật (trước đây NOT RUN)

`tests/Feature/Wwhn330ImportPerformanceBenchmarkTest.php` (BE, mới) vừa là test chặn
regression vừa sinh evidence thô vào `docs/evidence/WWHN-330/BENCHMARK_RESULT.md`.
Chạy lại độc lập:

```bash
php vendor/bin/phpunit tests/Feature/Wwhn330ImportPerformanceBenchmarkTest.php
```

Kết quả đo ngày 18/08/2026 (PHP 8.3.30, sqlite in-memory theo `phpunit.xml`):

| Case | Dòng dữ liệu | Kích thước file | Thời gian | Peak memory | HTTP |
|---|---:|---:|---:|---:|---:|
| dry_run | 100 | 8,0 KB | 124 ms | 74 MB | 200 |
| dry_run | 500 | 15,7 KB | 135 ms | 76 MB | 200 |
| dry_run | 1 000 | 25,0 KB | 217 ms | 80 MB | 200 |
| commit | 1 000 | 25,1 KB | 1 758 ms | 84 MB | 200 |
| reject (limit 1000) | 20 000 | 379,6 KB | 727 ms | 132 MB | 422 |

Đọc số này thế nào:

- Peak memory là đỉnh của cả tiến trình PHP; nền ~70 MB là chi phí bootstrap
  Laravel + test, không phải chi phí của riêng import.
- **Bằng chứng bounded-read**: file **gấp 20 lần** hạn mức bị từ chối với peak memory
  chỉ nhỉnh hơn ~1,6 lần so với xử lý trọn vẹn một file đúng hạn mức — tức không tăng
  tỉ lệ theo số dòng. Nếu code còn `IOFactory::load()->toArray()` như trước khi vá thì
  toàn bộ 20 000 dòng phải nằm trong memory trước khi bị từ chối.
- Đây là số trên máy dev/sqlite, **không phải cam kết SLA production**. SLA phải đo lại
  trên đúng môi trường/CSDL thật — thuộc DevOps/QA1.

---

## D. FE331-P1-07 — Evidence pack: lệnh đã chạy thật và kết quả

Baseline: FE `m1` @ `537d682c5784d2ea2ae76743547da7c90c4887ad`,
BE `m1` @ `30dc01ac67cb7aba2fb67e7772a0c82024aa653e` (SHA trước khi áp thay đổi của
lần rà này — thay đổi đang nằm ở working tree, **chưa commit/push**; chủ repo tự
review rồi commit, khi đó phải cập nhật SHA chốt vào comment sign-off).

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` (FE) | **PASS** — 0 lỗi |
| `npm run lint` (FE) | **PASS** — 0 error, 25 warning (đều pre-existing ở file khác: `CameraScanModal`, `MvpPutawayPage`, …) |
| `npm run format:check` (FE) | **PASS** — không phát sinh Prettier drift mới ngoài baseline |
| `npm run test` (FE) | **PASS** — 67 file / **508 test** |
| `npm run build` (FE) | **PASS** |
| `npm run master-sku:verify` (FE) | **PASS** |
| `npm run check:api-mapping` (FE) | **PASS** — 56 dòng endpoint, đã có 5 route import |
| `php vendor/bin/phpunit` — suite import (BE) | **PASS** — **39 test / 218 assertion** |
| `php vendor/bin/phpunit` — contract/schema (BE) | **PASS** — 20 pass, 6 skip (skip do gate môi trường PostgreSQL) |
| `php vendor/bin/pint --test` — các file thuộc WWHN-330/331 | **PASS** |

Test mới thêm trong lần rà này:

- BE `Wwhn330ImportHardeningTest`: `test_import_report_never_exposes_internal_storage_path_and_states_availability`,
  `test_error_file_availability_flips_to_false_once_expired_and_download_matches`,
  `test_replay_marks_the_original_report_as_duplicate_of_replay`.
- BE `Wwhn330ImportPerformanceBenchmarkTest`: 3 test (dry-run theo cỡ file, commit đúng
  hạn mức, từ chối file 20 000 dòng + khẳng định bounded-read).
- FE `sku-import.service.test.ts`: 4 test cho `error_file_available` /
  `error_file_expires_at` / `duplicate_of_replay`, gồm cả ca "không có thông tin thì
  coi như không tải được" (thà ẩn nút còn hơn hiện nút chắc chắn 404).

**Ranh giới trung thực:** đây là evidence do FE/DEV tự chạy. Nó **không** thay thế
QA1 chạy độc lập (WWHN-332), không thay thế BE runtime sign-off trên môi trường thật,
và không thay thế BA/Tech Lead chốt các giá trị còn để "tạm".

---

## E. Còn mở — không thuộc thẩm quyền FE1, cần vai trò khác xác nhận

| Mục | Cần ai | Nội dung |
|---|---|---|
| FE331-P1-04 / DEV330-P1-02 | **BA + Tech Lead** | Chốt chính thức: `MAX_ROWS = 1000`, giới hạn upload 10 MB, cửa sổ idempotent 24h theo từng actor, hạn file lỗi 24h. Code đang ghi rõ 4 giá trị này là "tạm". |
| FE331-P1-06 / WWHN-332 | **QA1** | Chạy độc lập trên đúng SHA: nội dung file lỗi CSV, RBAC `sku.manage` (403), 404 khi hết hạn, giới hạn 1000/1001 dòng (422 không 500), import lặp cùng file (duplicate, không ghi 2 lần), dry-run không ghi dữ liệu, responsive. |
| FE331-P2-02 | **PM / Jira owner** | Sprint live W3 nhưng Sprint Scope text còn W4 — đồng bộ để reviewer không lấy nhầm phạm vi. |
| Job dọn file lỗi | **DevOps** | Xác nhận Laravel scheduler thực sự chạy ở PROD để `import:purge-error-files` (02:15 hằng ngày) hoạt động; nếu không, file CSV lỗi tồn vĩnh viễn trên đĩa. |
| Commit/push | **Chủ repo** | Thay đổi đang ở working tree nhánh `m1`, chưa commit. Không tạo nhánh riêng. |
