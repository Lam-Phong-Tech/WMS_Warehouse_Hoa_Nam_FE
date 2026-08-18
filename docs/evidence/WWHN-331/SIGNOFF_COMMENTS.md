# WWHN-331 — Bộ comment xác nhận / sign-off (mỗi vai trò ĐÚNG 1 comment)

Dán thẳng lên Jira `WWHN-331`. Mỗi vai trò chỉ đăng **một** comment duy nhất, gộp đủ mọi
mục thuộc thẩm quyền của vai trò đó — tránh comment nhiều lần trên cùng ticket.

Các comment này là **đọc + duyệt**, không giao việc mới.

> **Trước khi đăng:** thay `<SHA-FE>` / `<SHA-BE>` bằng SHA thật ở bảng đầu
> `EVIDENCE_PACK.md`. Không đăng khi chưa có SHA thật.
>
> **Riêng comment QA1:** chỉ đăng **sau khi đã thực sự chạy** phạm vi test ở mục F của
> evidence pack. Đây là mẫu để ghi lại kết quả, không phải lời xác nhận thay QA.

---

## 1) BA / BAS — 1 comment

**[BA] Xác nhận nghiệp vụ WWHN-331 — đóng FE331-P1-02R3 / P1-03R3 / P1-06R3 (phần BA)**

Tôi đã đọc `docs/decision-records/DEC-IMP-001.md` (BE, nhánh `m1` @ `<SHA-BE>`) và
evidence pack `docs/evidence/WWHN-331/EVIDENCE_PACK.md` (FE @ `<SHA-FE>`). Tôi xác nhận
bốn điểm sau, không yêu cầu thay đổi thêm:

1. **Chốt chính thức hạn mức import SKU** (đóng phần BA của FE331-P1-03R3): tối đa
   **1 000 dòng** dữ liệu mỗi lần import; file tối đa **10 MB**; định dạng **.xlsx/.xls**;
   hạn tải file lỗi CSV **24 giờ**; cửa sổ idempotent **24 giờ**. Các giá trị này không
   còn trạng thái "tạm". Đổi giá trị phải sửa DEC-IMP-001 trước.
2. **Chốt ngữ nghĩa "gửi trùng"** (đóng phần BA của FE331-P1-02R3): một lần import được
   định danh bằng **file + người thực hiện + tùy chọn `update_existing`**. Cùng file mà
   đổi `update_existing` là **hai thao tác nghiệp vụ khác nhau** (chỉ tạo mới ↔ cho phép
   ghi đè SKU đang tồn tại) nên phải chạy thật, không được coi là gửi trùng. Trùng đủ cả
   ba thì hệ thống trả lại kết quả lần gốc và không ghi SKU lần hai — đây là kết quả
   đúng, không phải lỗi.
3. **Chốt phạm vi dữ liệu của Import báo cáo** (đóng phần BA của FE331-P1-06R3): người
   dùng bị giới hạn kho chỉ được xem báo cáo và tải file lỗi của **chính lần import mình
   đã chạy**; người dùng không bị giới hạn kho xem được tất cả để đối soát chéo. Báo cáo
   của người khác trả 404 như bản ghi không tồn tại — tôi đồng ý không xác nhận sự tồn
   tại, vì file lỗi chứa nguyên nội dung file người khác nộp.
4. **Luồng UI đúng nghiệp vụ**: chọn file → Kiểm tra trước (dry-run) → sửa lỗi nếu có →
   Import chính thức (all-or-nothing). Đổi file hoặc đổi tùy chọn thì phải kiểm tra thử
   lại trước khi Import — đúng ý đồ của bước dry-run.

Ranh giới tôi ghi nhận: hạn mức 1 000 dòng ở trên áp cho **endpoint import SKU tương
tác**; NFR-SRS-017 (dry-run ≥ 10 000 dòng) vẫn thuộc luồng migration/opening balance chạy
bằng job có kiểm soát, hai luồng có hạn mức riêng là chủ ý.

---

## 2) Tech Lead — 1 comment

**[Tech Lead] Xác nhận kỹ thuật WWHN-331 — đóng FE331-P1-03R3 (phần Tech) và FE331-P2-01R3**

Tôi đã đọc code và evidence pack, xác nhận:

1. **Baseline** (đóng FE331-P2-01R3): nguồn review là `WMS_Warehouse_Hoa_Nam_FE` @
   `<SHA-FE>` và `WMS_Warehouse_Hoa_Nam_BE` @ `<SHA-BE>`, **cùng nhánh `m1`**. Không tồn
   tại nhánh `m1ee`, không có nhánh riêng cho WWHN-331.
2. **Duyệt cách công bố hạn mức**: một nguồn sự thật `config/warehouse.php →
   warehouse.sku_import`, gắn với DEC-IMP-001; API trả khối `constraints` kèm các
   operation **sẵn có** thay vì mở endpoint mới — giữ nguyên bề mặt API ngoài Annex C
   (REQ-SRS-034 / DEC-MIG-API-001). FE hiển thị lại, không giữ hằng số riêng.
3. **Duyệt cách vá FE331-P1-01R3**: vân tay payload gắn vào kết quả dry-run, payload
   truyền vào mutation nên kết quả trả về luôn khớp bộ đã gửi — xử lý được cả ca đua đổi
   tùy chọn khi request còn đang chạy, không chỉ ca bấm tuần tự.
4. **Duyệt thay đổi schema**: cột `options_fingerprint` (nullable) + index tra cứu replay;
   bản ghi cũ `NULL` giữ nguyên hành vi cũ thay vì đoán, và nhánh tương thích này tự hết
   hiệu lực sau một cửa sổ idempotent.
5. **Duyệt sửa test harness**: stub `Switch` nay bám đúng contract antd
   (`onChange(checked: boolean)`); 68 file test cũ vẫn xanh.
6. **Kết quả gate**: FE typecheck/lint/format/build/test PASS (516 test); BE full suite
   PASS (724 test, 702 pass, 22 skip môi trường PostgreSQL, 0 fail); pint PASS.

Tôi hiểu số benchmark là đo trên môi trường test, **không** phải cam kết SLA production.
Không phát sinh việc mới từ phía Tech Lead.

---

## 3) BE1 / BE2 — 1 comment

**[BE] Xác nhận BE đã hiện thực đúng hợp đồng WWHN-331 / WWHN-330**

Trên `WMS_Warehouse_Hoa_Nam_BE` nhánh `m1` @ `<SHA-BE>`, tôi xác nhận đã hiện thực và tự
kiểm chứng:

1. **Định danh idempotent** gồm `file_sha256 + actor_id + options_fingerprint`
   (`options_fingerprint = sha256("update_existing=0|1")`). Khoá chống chạy song song dùng
   đúng bộ định danh đó nên khoá và điều kiện nhận diện replay không thể lệch nhau.
2. **Hạn mức** đọc từ `warehouse.sku_import` (DEC-IMP-001) ở cả ba nơi enforce: số dòng,
   rule upload `mimes/max`, hạn file lỗi. Không còn hằng số "tạm" trong code.
3. **`constraints`** trả trong mọi response `/skus/import-excel` (200 và cả 422) và trong
   `meta.constraints` của `GET /skus/import-reports`; OpenAPI đã mô tả đủ.
4. **Data-scope** áp cho cả 3 route Import báo cáo qua một query duy nhất; thiếu
   `sku.manage` → 403, ngoài scope → 404, trong scope → 200; `meta.data_scope` trả ra để
   đối soát.
5. **Test**: `Wwhn331ImportContractClosureTest` (8 test / 60 assertion) khoá cả ba mục;
   full suite 724 test / 702 pass / 22 skip / 0 fail.

Không có thay đổi contract nào ngoài phạm vi trên; không thêm route mới, không thêm
permission mới.

---

## 4) QA1 — 1 comment

**[QA1] Xác nhận kiểm thử độc lập WWHN-331 / WWHN-332 — đóng FE331-P1-04R3**

Tôi đã kiểm thử độc lập trên đúng build: FE `m1` @ `<SHA-FE>`, BE `m1` @ `<SHA-BE>`
(môi trường: `<env>`; raw log/screenshot đính kèm tại `<link>`).

Kết quả theo mục F của evidence pack:

| # | Nội dung | Kết quả |
|---|---|---|
| 1 | Dry-run rồi đổi `update_existing` (cả false→true và true→false): nút Import tắt, không có request commit nào được gửi | `<PASS/FAIL>` |
| 2 | Nộp lại cùng file + cùng tùy chọn → duplicate, không tạo báo cáo thứ hai, không ghi SKU lần hai | `<PASS/FAIL>` |
| 3 | Nộp lại cùng file + đổi tùy chọn → chạy thật, không bị nuốt | `<PASS/FAIL>` |
| 4 | `sha256("update_existing=1")` trùng `options_fingerprint` của lần chạy tương ứng | `<PASS/FAIL>` |
| 5 | Data-scope: 403 khi thiếu `sku.manage`; 404 với báo cáo/error-file của người khác; 200 trong scope; danh sách không lộ báo cáo người khác | `<PASS/FAIL>` |
| 6 | Hạn mức hiển thị trên UI trùng khít `constraints` trong response | `<PASS/FAIL>` |
| 7 | File lỗi CSV: nội dung row/field/error_code/message/value; hết hạn → 404; responsive | `<PASS/FAIL>` |

Defect phát hiện: `<không có / danh sách>`.

---

## 5) PM / Jira owner — 1 comment

**[PM] Xác nhận phạm vi & metadata WWHN-331 — đóng FE331-P2-02R3**

1. **Sprint metadata**: Sprint hiện hành của ticket là **WHN-W3 Beta Completion R2**; tôi
   đã đồng bộ trường *Sprint Scope* về đúng W3 để reviewer không lấy nhầm phạm vi. Mọi
   đánh giá WWHN-331 tính theo W3.
2. **Phạm vi ticket** giữ nguyên theo task cha WWHN-89 (STRETCH) và output "Import UI
   enhancement" — không mở rộng thêm.
3. **Nguồn review chính thức**: FE `m1` @ `<SHA-FE>`, BE `m1` @ `<SHA-BE>`; evidence tại
   `docs/evidence/WWHN-331/EVIDENCE_PACK.md`.

---

## 6) FE1 / Lead — 1 comment

**[FE1] Bàn giao WWHN-331 sau register R3 — đóng FE331-P1-01R3 / P1-05R3 / P2-01R3**

Đã xử lý trên nhánh `m1` (không tạo nhánh riêng): FE `<SHA-FE>`, BE `<SHA-BE>`.

1. **FE331-P1-01R3 (đóng)**: kết quả dry-run nay gắn vân tay payload
   `(file, update_existing)`. Đổi tùy chọn hoặc đổi file làm kết quả cũ hết hiệu lực ngay,
   nút Import chính thức tắt kèm câu giải thích lý do; payload được truyền vào mutation
   nên còn chặn được ca đổi tùy chọn trong lúc dry-run đang chạy. 6 component test khoá
   cả hai chiều false→true và true→false, có khẳng định **không có lời gọi commit nào lọt
   qua**.
2. **FE331-P1-02R3 / P1-03R3 / P1-06R3**: phần code đã xong ở cả FE lẫn BE và có test;
   phần quyết định nghiệp vụ nằm ở `DEC-IMP-001` — xin comment duyệt của BA và Tech Lead.
3. **FE331-P1-05R3 (đóng)**: evidence pack đã làm mới theo SHA đã commit ở trên; bỏ toàn
   bộ mô tả "working tree chưa commit" và baseline cũ.
4. **FE331-P2-01R3 (đóng)**: mọi tham chiếu dùng repo + nhánh `m1` + SHA chính xác. Không
   tồn tại `m1ee`.
5. **Gate đã chạy**: FE typecheck/lint/format/build PASS, 516 test PASS; BE full suite 724
   test / 702 pass / 22 skip / 0 fail; pint PASS.

Còn mở và **không thuộc FE1**: QA1 chạy độc lập (FE331-P1-04R3), PM đồng bộ Sprint Scope
(FE331-P2-02R3), DevOps xác nhận scheduler chạy thật ở PROD cho job dọn file lỗi.
