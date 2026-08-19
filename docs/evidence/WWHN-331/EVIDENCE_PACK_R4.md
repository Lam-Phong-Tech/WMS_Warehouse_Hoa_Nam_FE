# WWHN-331 — Evidence Pack R4 (đóng FE331-P1-07R4 và FE331-P1-08R4)

Ngày: 19/08/2026. Nhánh **`m1` duy nhất** ở cả FE và BE (không tạo nhánh riêng).
Task cha `WWHN-89`; BE song hành `WWHN-330`; QA `WWHN-332`.

**Nguồn chấm điểm đang xử lý:** comment *"PASS có điều kiện — Đánh giá: 80/100 (80%)"* —
bảng *P0/P1/P2 Exact Fix Action Register — R4*. **Ticket không có mục P0 ở bất kỳ vòng
review nào.**

Pack này **không thay thế** `EVIDENCE_PACK.md` (R3) mà nối tiếp: R3 vẫn là bằng chứng cho
`FE331-P1-01R3..06R3`; pack này chỉ nói về hai mục P1 **mới mở ở R4** cộng trạng thái các
mục PARTIAL.

> **Ghi chú về CI:** vòng này **không** chạy GitHub Actions và không đụng bất kỳ workflow
> nào — hạn mức Actions của tổ chức đã dùng hết 3 000/3 000 phút. Mọi số liệu dưới đây là
> **chạy thật tại local** trên đúng cây làm việc của commit chốt, lệnh và kết quả ghi
> nguyên văn ở mục D để reviewer chạy lại được.

---

## A. Trạng thái register R4

| ID | Sev | Trạng thái vào R4 | Sau vòng này |
|---|---|---|---|
| FE331-P1-01R3 | P1 | CLOSED source | **giữ CLOSED** — test cũ vẫn xanh sau khi đổi cơ chế vân tay |
| FE331-P1-02R4 | P1 | PARTIAL (chờ duyệt Decision) | **CODE ĐÓNG** từ R3; DEC-IMP-001 §2 — chờ đúng 1 comment BA |
| FE331-P1-03R4 | P1 | PARTIAL (chờ duyệt Decision) | **CODE ĐÓNG** từ R3; DEC-IMP-001 §1/§4 — chờ đúng 1 comment BA + Tech Lead |
| FE331-P1-04R4 | P1 | OPEN (QA1) | **vẫn thuộc QA1** — phạm vi + lệnh ở mục E |
| FE331-P1-05R4 | P1 | PARTIAL | **ĐÓNG phần thuộc FE1** — pack này + SHA chốt + log chạy thật (mục D) |
| FE331-P1-06R4 | P1 | PARTIAL (chờ duyệt + QA chéo) | **CODE ĐÓNG** từ R3; DEC-IMP-001 §3 — chờ comment BA/Tech + QA chéo |
| **FE331-P1-07R4** | **P1 NEW** | **OPEN** | **ĐÓNG** — mục B |
| **FE331-P1-08R4** | **P1 NEW** | **OPEN** | **ĐÓNG** — mục C |
| FE331-P2-01R3 | P2 | CLOSED source | giữ CLOSED |
| FE331-P2-02R4 | P2 | OPEN | **vẫn thuộc PM/Jira owner** — metadata, không phải code |

---

## B. FE331-P1-07R4 — vân tay payload lấy từ NỘI DUNG, và ca đua preview

### B.1 Vì sao bản R3 chưa đóng được lỗ hổng

R3 gắn vân tay `name` + `size` + `lastModified` + `update_existing` vào kết quả dry-run.
Bộ ba metadata đó **không định danh nội dung**, nên đúng lỗ hổng mà FE331-P1-01R3 vừa đóng
("commit một payload chưa hề được kiểm tra thử") vẫn còn nguyên qua hai đường vào — cả hai
là thao tác đời thường của người dùng kho, không phải tình huống bịa ra:

| # | Kịch bản | Vì sao metadata trùng | Hậu quả |
|---|---|---|---|
| 1 | Dry-run `sku.xlsx` ở thư mục A, rồi chọn `sku.xlsx` đồng nghiệp gửi | Trùng tên là chuyện thường; hai workbook cùng template thường trùng `size`; `lastModified` trùng khi sao chép giữ mốc thời gian, giải nén từ zip, hoặc đồng bộ ổ mạng | Nút Import **sáng lên** cho một file chưa hề được kiểm tra thử |
| 2 | Dry-run thấy lỗi → mở Excel sửa → **ghi đè lên chính file đó** → bấm Import | `size` có thể không đổi khi chỉ sửa vài ô; `lastModified` mà trình duyệt đã chụp lúc chọn file thì không tự cập nhật | Commit một nội dung chưa từng kiểm tra, mà người dùng **đinh ninh** là đã kiểm tra |

Thêm một đường thứ ba mà register nêu: response dry-run của một thao tác **đã bị bỏ qua**
về trễ hơn thao tác hiện tại của người dùng.

### B.2 Cách vá

| # | Thay đổi | Tệp |
|---|---|---|
| 1 | Vân tay = **`sha256(nội dung file)`** + `update_existing`, thay cho metadata | `SkuImportModal.tsx` |
| 2 | SHA-256 dùng Web Crypto khi có, **đường thuần JS** khi không có | `src/shared/utils/file-digest.ts` (mới) |
| 3 | Đối chiếu với `file_sha256` **máy chủ trả về** — lệch thì không mở khoá Import | `SkuImportModal.tsx` |
| 4 | **Băm lại ngay trước khi commit** — lệch thì không gửi request nào đi | `SkuImportModal.tsx` |
| 5 | **Số thế hệ payload**: response của thao tác đã bị bỏ qua bị loại hẳn | `SkuImportModal.tsx` |
| 6 | Chưa băm xong ⇒ chưa biết payload ⇒ **không** cho dry-run/Import | `SkuImportModal.tsx` |

**Vì sao phải có đường SHA-256 thuần JS, không chỉ dùng `crypto.subtle`.** `crypto.subtle`
chỉ tồn tại trong secure context. Máy trạm kho mở ứng dụng bằng `http://192.168.x.x`
(không phải `localhost`) sẽ có `crypto.subtle === undefined`. Nếu chỉ dựa vào Web Crypto
thì **đúng những máy đó** lại rơi về so metadata — tức lỗ hổng còn nguyên ở chính môi
trường phổ biến nhất của dự án. Đường dự phòng được khoá bằng **vector chuẩn FIPS
180-4/NIST CAVP** (chuỗi rỗng, `"abc"`, chuỗi 448-bit, 256 giá trị byte) cộng **10 ca ranh
giới đệm** (54/55/56/57/63/64/65/119/120/128 byte) — vì cài sai chỗ đệm thì hầu hết file
vẫn băm đúng và lỗi chỉ lộ ra với đúng vài kích thước, dạng lỗi tệ nhất để phát hiện ở
production. Khớp vector chuẩn cũng chính là điều kiện để nó khớp `hash_file('sha256')` của
BE.

### B.3 Test khoá lại hành vi

`src/shared/utils/file-digest.test.ts` (**21 test, mới**) và
`src/modules/master-data/components/SkuImportModal.test.tsx` (**13 test**, +5 test R4):

| Test | Chứng minh |
|---|---|
| `hai file trùng tên/cỡ/mốc sửa nhưng khác nội dung KHÔNG dùng chung kết quả dry-run` | Đường vào 1 đã bị chặn. Test **tự khẳng định tiền đề** (`name`/`size`/`lastModified` bằng nhau) rồi mới kiểm hệ quả, nên nó không thể "xanh vì lý do khác" |
| `nội dung file đổi trên đĩa sau dry-run: chặn ngay ở client, không gửi request commit` | Đường vào 2. Bằng chứng mạnh nhất: `importSkuExcel` **không** được gọi lần thứ hai |
| `response dry-run về sau khi người dùng đã đổi tùy chọn thì bị loại, không mở khoá Import` | Ca đua request; số liệu của lần đã bị bỏ qua cũng không hiện ra màn hình |
| `máy chủ báo lại sha256 khác với file trên máy: không mở khoá Import` | Đối chiếu hai chiều với BE |
| `chọn lại file rồi dry-run lại thì mở khoá được ngay, không kẹt` | Phép siết **không** biến thành chặn oan |
| 21 test `file-digest` | Vân tay khớp vector chuẩn ⇒ khớp BE; hai đường (Web Crypto / thuần JS) cho cùng kết quả |

**Một quyết định thiết kế được ghi rõ vì nó đánh đổi UX:** chọn lại file **luôn** xoá kết
quả cũ, kể cả khi nội dung y hệt. Lý do: vân tay của file mới chỉ có sau một phép băm bất
đồng bộ, nên giữ kết quả cũ trong lúc chờ băm sẽ tạo ra một khoảng người dùng nhìn thấy số
liệu file cũ bên cạnh tên file mới — đúng loại "dữ liệu cũ còn nằm trên màn hình" mà mục
này đang đóng. Đổi lấy một cú bấm dry-run là đáng, và test cuối bảng khoá lại rằng không
có trạng thái kẹt.

---

## C. FE331-P1-08R4 — chốt chặn chống ghi trùng nằm trong CSDL, không nằm ở cache

### C.1 Vì sao vòng R3 chưa đóng được

`DEV330-P1-07R3` đã bỏ nhánh fail-open lúc hết thời gian chờ. Nhưng bất biến *"kiểm tra
trùng + ghi là một thao tác nguyên tử"* vẫn treo trên **một** sợi dây là `Cache::lock`, và
sợi dây đó đứt **lặng lẽ** — không exception, không log — trong ba hoàn cảnh có thật:

| # | Hoàn cảnh | Vì sao test cũ mù |
|---|---|---|
| 1 | Cache store không khoá được liên tiến trình (`array`/`null`, hoặc `file` khi chạy nhiều node) | `block()` "thành công" cho **cả hai** request; không có `LockTimeoutException` nào để mock bắt |
| 2 | Redis/Valkey hỏng | Khoá không dựng được; không đi qua nhánh timeout |
| 3 | `lock.on_timeout = FAIL_OPEN` | Chính hợp đồng cho phép bỏ qua khoá |

Trong cả ba, mã trước R4 vẫn chạy tiếp và vẫn trả 200 — idempotent bị phá mà không ai biết.

Bộ test R3 chứng minh fail-closed bằng `Mockery` trên chính `Cache::lock`, tức là nó kiểm
*"code có rẽ nhánh đúng khi khoá báo hết giờ không"*, **không** kiểm *"hệ thống có thật sự
ngăn được hai lần ghi không"*. Đây đúng là điều register R4 gọi tên: cần **real
concurrent/timeout tests**.

### C.2 Cách vá — hai tầng, tách bạch vai trò

| Tầng | Thành phần | Vai trò | Tắt được không |
|---|---|---|---|
| 1 | `Cache::lock` (giữ nguyên §6) | **Hàng chờ** — người dùng bấm đúp thì chờ vài giây thay vì bị từ chối ngay | Có (`lock.on_timeout`) |
| 2 | Hàng UNIQUE trong `sku_import_claims` | **Bảo đảm** — bất biến nguyên tử | **Không** |

Trọng tài là **chính cơ sở dữ liệu mà kết quả đằng nào cũng phải ghi vào**, nên bảo đảm
đúng trên mọi driver, mọi node, và không tồn tại kịch bản "khoá im lặng không khoá gì".

- Giành chỗ: `INSERT ... ON CONFLICT DO NOTHING` — **một câu lệnh nguyên tử**, không phải
  đọc-rồi-ghi (đọc-rồi-ghi chính là ca đua đang đóng).
- Không giành được → **409 `CONCURRENCY_CONFLICT`** (§8.2, không đổi hợp đồng).
- Không **vận hành được** chốt chặn (mất bảng/mất kết nối) → **503**, cùng nguyên tắc đã
  áp cho `findRecentDuplicateReport()`: mất phương tiện bảo đảm bất biến là sự cố khả
  dụng, **không phải** tranh chấp nghiệp vụ — gọi sai loại là đẩy nhầm việc cho người dùng.
- Chỗ giữ hết hạn → **tiếp quản** bằng `UPDATE ... WHERE expires_at <= now()` (so-sánh-
  rồi-đổi, cũng nguyên tử) và **luôn** ghi log WARNING `SKU_IMPORT_CLAIM_TAKEOVER`.
- Trả chỗ giữ chỉ xoá đúng `owner_token` của mình.

**`FAIL_OPEN` từ nay chỉ còn quyền đổi cách xếp hàng, không còn quyền hạ chuẩn toàn vẹn
dữ liệu.** Đây là câu quan trọng nhất của mục này.

**Hạn chỗ giữ (900s) không phải cửa sổ idempotent (24h).** Nó chỉ là van cứu hộ cho tiến
trình chết giữa chừng: lớn hơn 15× ngân sách commit đã duyệt (DEC-IMP-001 §4: 60s) và lớn
hơn mọi trần thực thi ở tầng dưới (PHP `max_execution_time`, `fastcgi_read_timeout`), nên
một chỗ giữ chỉ hết hạn khi tiến trình giữ nó đã thực sự chết. Có **sàn cứng ≥ 2× ngân
sách commit** để một giá trị cấu hình quá thấp không mở lại chính ca đua này.

**Residual ghi nhận công khai:** nếu một tiến trình vừa vượt 900 giây vừa còn sống, chỗ
giữ của nó có thể bị tiếp quản. Khi đó phép kiểm tra trùng (DEC-IMP-001 §2) vẫn là lớp thứ
hai, và mọi lần tiếp quản đều có log WARNING. Đây là đánh đổi có ý thức, không phải khoảng
trống bị bỏ sót.

### C.3 Test — chồng lấn THẬT, không giả lập chốt chặn

`tests/Feature/Wwhn331ImportDurableClaimTest.php` (**10 test, mới**):

| Test | Chứng minh |
|---|---|
| `test_a_second_commit_is_refused_while_the_first_is_still_inside_its_import` | **Bằng chứng chính.** Lần import thứ hai được gọi **từ bên trong** lần thứ nhất, đúng lúc lần thứ nhất đã qua bước kiểm tra trùng nhưng chưa commit — tức đúng khoảng thời gian mà bản cũ để lọt. Không mock khoá, không mock chỗ giữ. Kết quả: đúng **1** `import_reports` COMMITTED, đúng **1** SKU |
| `test_a_live_claim_left_by_another_process_refuses_the_import_even_when_the_cache_lock_succeeds` | Hoàn cảnh 1: khoá cache giành được **bình thường**; thứ duy nhất chặn được là hàng trong CSDL |
| `test_fail_open_configuration_cannot_bypass_the_durable_claim` | Hoàn cảnh 3: FAIL_OPEN **và** khoá hết giờ — mọi lớp bảo vệ cũ đã bị vô hiệu hoá mà import vẫn bị từ chối |
| `test_a_broken_cache_backend_neither_fails_the_request_nor_removes_the_guarantee` | Hoàn cảnh 2: cache ném lỗi ⇒ import hợp lệ **vẫn chạy** (không thành 500 oan) nhưng import trùng định danh **vẫn bị chặn** |
| `test_a_claim_only_blocks_the_same_options_fingerprint` | Chỗ giữ dùng **đúng** định danh của DEC-IMP-001 §2 — nếu rộng hơn thì đổi `update_existing` sẽ bị **chặn oan**, tái tạo lỗi FE331-P1-02R3 ở dạng khác |
| `test_an_expired_claim_is_taken_over_and_the_takeover_is_logged` | Van cứu hộ hoạt động và **không im lặng** |
| `test_claim_ttl_can_never_be_configured_below_twice_the_approved_commit_budget` | Sàn cứng |
| `test_the_claim_is_released_after_success_and_after_failure` | Lỗi nhất thời không khoá chết file tới khi hết hạn |
| `test_releasing_only_removes_the_claim_this_request_owns` | Request đã bị tiếp quản không xoá chỗ giữ của người kế nhiệm — đó là cách van cứu hộ biến thành chính lỗ hổng nó vá |
| `test_the_published_contract_names_the_durable_guard_not_just_the_timeout_policy` | QA dựng lại được định danh chỗ giữ **từ hợp đồng công bố**, không phải từ mã nguồn |

### C.4 ERD giữ nguyên 59 bảng

`sku_import_claims` là **bảng vận hành**, cùng loại với `import_reports` — không thuộc 59
bảng canonical (DEC-IMP-001 §9 hàng 2). `HoaNamErdSchema::TABLE_COUNT` **không đổi**;
`ErdCompilerSourcePinTest` kiểm "ERD ký duyệt biên dịch ra đúng 59 bảng", không cấm bảng
vận hành. Đã chạy lại để chứng minh (mục D). Đề nghị BA gộp `import_reports` và
`sku_import_claims` vào **cùng một** ERD amendment.

---

## D. Chạy thật tại local — lệnh và kết quả nguyên văn

> Không có run CI nào cho vòng này (xem ghi chú đầu file). Reviewer chạy lại đúng hai lệnh
> dưới đây trên cùng SHA sẽ ra cùng số.

### D.1 BE — sqlite (driver mặc định của `phpunit.xml`)

```
php vendor/bin/phpunit --no-coverage \
  tests/Feature/Wwhn331ImportDurableClaimTest.php \
  tests/Feature/Wwhn330ImportR3ClosureTest.php \
  tests/Feature/Wwhn331ImportContractClosureTest.php \
  tests/Feature/Wwhn330ImportHardeningTest.php \
  tests/Feature/Wwhn330ImportResidualHardeningTest.php \
  tests/Feature/Wwhn224SkuImportDryRunTest.php \
  tests/Feature/Wwhn174SkuImportValidationTest.php \
  tests/Feature/Wwhn330ImportErrorFilePurgeTest.php \
  tests/Feature/Wwhn224P1ClosureTest.php \
  tests/Feature/ErdCompilerSourcePinTest.php \
  tests/Feature/Wwhn310DataHandoverContractTest.php
```

```
{"tool":"phpunit","result":"passed","tests":82,"passed":77,"assertions":433,
 "duration_ms":38199,"skipped":5}
```

**0 fail.** 5 skip là `ErdPhysicalSchemaParityTest` — các test đó tự `requirePostgres()`
nên bị bỏ qua trên driver sqlite mặc định; `ErdCompilerSourcePinTest` (kiểm ERD ký duyệt
biên dịch ra **đúng 59 bảng**) **có chạy và xanh**, tức bảng vận hành mới không đụng tới
số bảng canonical.

Riêng bộ test của mục C, chạy tách để đọc số cho gọn:

```
php vendor/bin/phpunit --no-coverage tests/Feature/Wwhn331ImportDurableClaimTest.php
{"tool":"phpunit","result":"passed","tests":10,"passed":10,"assertions":35,"duration_ms":19008}
```

### D.2 FE — vitest

```
npx vitest run src/modules/master-data/components/SkuImportModal.test.tsx src/shared/utils/file-digest.test.ts
```

```
 ✓ src/shared/utils/file-digest.test.ts (21 tests)
 ✓ src/modules/master-data/components/SkuImportModal.test.tsx (13 tests)

 Test Files  2 passed (2)
      Tests  34 passed (34)
```

### D.3 Toàn bộ suite FE

```
npx vitest run

 Test Files  1 failed | 92 passed (93)
      Tests  1 failed | 744 passed (745)
```

**Test fail duy nhất KHÔNG thuộc WWHN-331 và phải nói rõ chứ không được giấu:**
`src/test/flow06-report-pagination-export.test.ts:84` đọc mã nguồn
`src/modules/reports/pages/AlignedReportsPage.tsx` và tìm chuỗi
`filters.reason = piiReason.trim()`. Tại thời điểm chạy, tệp đó đang được **một luồng
công việc khác sửa dở trên cùng nhánh `m1`** (WWHN-258, PII báo cáo — kèm hai tệp chưa
commit `src/test/wwhn-258-report-pii-rbac.test.tsx` và `e2e/wwhn-258-report-qa2.spec.ts`).

Không tệp nào trong bốn tệp WWHN-331 sửa (`SkuImportModal.tsx`,
`SkuImportModal.test.tsx`, `file-digest.ts`, `file-digest.test.ts`) liên quan tới màn
hình báo cáo. Reviewer đối chiếu được bằng chính commit: diff của commit FE chốt không
chạm `src/modules/reports/**`.

---

## E. FE331-P1-04R4 — phạm vi QA1 phải chạy độc lập (không thuộc FE1)

QA1 chạy trên **đúng** cặp SHA ở mục cuối, ghi lại env + log thô. Bổ sung cho phạm vi R3:

| # | Ca | Kỳ vọng |
|---|---|---|
| Q1 | Dry-run file A. Đổi sang file B **trùng tên, trùng cỡ, trùng mốc sửa** nhưng khác nội dung | Nút Import **tắt**, hiện "Tùy chọn hoặc nội dung file đã thay đổi…" |
| Q2 | Dry-run file. Mở Excel sửa, **ghi đè cùng đường dẫn**. Bấm Import | Bị chặn tại client, **không** có request `POST /skus/import-excel` nào trong Network |
| Q3 | Mở ứng dụng bằng `http://<IP LAN>` (không phải `localhost`) rồi lặp Q1/Q2 | Kết quả y hệt — đường SHA-256 dự phòng hoạt động khi không có secure context |
| Q4 | Hai người dùng **khác nhau** cùng nộp một file giống hệt, gần như đồng thời | Cả hai chạy được (định danh theo actor), mỗi người một Import báo cáo |
| Q5 | Một người dùng gửi **hai** request COMMIT trùng đủ định danh gần như đồng thời | Đúng **một** 200; request kia **409 `CONCURRENCY_CONFLICT`**; đúng **một** `import_reports` COMMITTED |
| Q6 | Lặp Q5 với `CACHE_STORE=array` | Kết quả y hệt Q5 — đây là ca chứng minh chốt chặn không phụ thuộc cache |
| Q7 | Lặp Q5 với `SKU_IMPORT_LOCK_ON_TIMEOUT=FAIL_OPEN` | Kết quả y hệt Q5 — FAIL_OPEN không hạ chuẩn toàn vẹn |
| Q8 | Cross-user Import báo cáo (FE331-P1-06R4): user bị giới hạn kho đọc báo cáo của người khác | **404**; thiếu `sku.manage` → **403**; user GLOBAL → **200** |
| Q9 | `GET /skus/import-reports?per_page=1` | `meta.constraints.concurrency_guard = "DB_DURABLE_CLAIM"`, `concurrency_guard_table = "sku_import_claims"`, `claim_ttl_seconds ≥ 120` |

---

## F. Các mục còn mở và người chịu trách nhiệm

| ID | Còn thiếu gì | Ai |
|---|---|---|
| FE331-P1-02R4 / P1-03R4 / P1-06R4 | **Chỉ còn comment duyệt** — code và Decision đã xong. Bộ comment soạn sẵn 1 comment/vai trò | BA Main, Tech Lead |
| FE331-P1-04R4 | Chạy độc lập mục E, ghi env + log thô | QA1 |
| FE331-P2-02R4 | Sprint Scope W4 ↔ Sprint live W3 — metadata Jira, không phải code | PM/Jira owner |

---

## G. SHA chốt của vòng R4

Theo quy ước đã dùng từ các vòng trước: **pin theo commit cuối cùng chạm artifact**, không
pin theo `HEAD` của `m1` (nhánh dùng chung, nhiều luồng công việc cùng commit vào).

| Repo | Nhánh | Commit chốt R4 | Nội dung |
|---|---|---|---|
| `WMS_Warehouse_Hoa_Nam_BE` | `m1` | `c12e95e3d9d595c8e529ecbdd67474dd2c86cc02` | FE331-P1-08R4 — chỗ giữ chính danh + 10 test + DEC-IMP-001 Rev.3 |
| `WMS_Warehouse_Hoa_Nam_FE` | `m1` | `ba99f60171974649123bd17eca3c50ce8225cdf9` | FE331-P1-07R4 — vân tay nội dung + số thế hệ + 34 test |

Commit BE `c12e95e` chứa **đúng 6 tệp** của WWHN-331, không gộp thay đổi của luồng khác:

```
Modules/Warehouse/database/migrations/2026_08_19_140000_create_sku_import_claims_table.php
Modules/Warehouse/app/Support/SkuImportContract.php
Modules/Warehouse/app/Services/ImportService.php
config/warehouse.php
tests/Feature/Wwhn331ImportDurableClaimTest.php
docs/decision-records/DEC-IMP-001.md
```

Commit FE chứa **đúng 4 tệp**:

```
src/modules/master-data/components/SkuImportModal.tsx
src/modules/master-data/components/SkuImportModal.test.tsx
src/shared/utils/file-digest.ts
src/shared/utils/file-digest.test.ts
```

Khác với R3 (nội dung BE nằm lẫn trong một commit dùng chung mang tiêu đề task khác, phải
truy vết bằng `BE_CHANGE_MANIFEST.md`), vòng R4 commit tách bạch ở cả hai repo nên reviewer
đối chiếu thẳng bằng `git show <SHA> --stat`, không cần manifest trung gian.
