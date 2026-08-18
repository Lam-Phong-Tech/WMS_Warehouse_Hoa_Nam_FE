# WWHN-331 — Bộ comment xác nhận / sign-off (mỗi vai trò ĐÚNG 1 comment)

Dán thẳng lên Jira `WWHN-331`. Mỗi vai trò chỉ đăng **một** comment duy nhất, gộp đủ mọi
mục thuộc thẩm quyền của vai trò đó — tránh comment nhiều lần trên cùng ticket.

Các comment này là **đọc + duyệt**, không giao việc mới.

> Trước khi đăng: thay `<SHA-FE>` / `<SHA-BE>` bằng SHA thật của commit chốt trên nhánh
> `m1` sau khi chủ repo commit. Không đăng khi chưa có SHA thật.

---

## 1) Tech Lead — 1 comment

**[Tech Lead] Xác nhận WWHN-331**

Tôi đã đọc code + evidence pack (`docs/evidence/WWHN-331/EVIDENCE_PACK.md`) và xác nhận:

1. **Baseline**: nguồn review là `WMS_Warehouse_Hoa_Nam_FE` / `WMS_Warehouse_Hoa_Nam_BE`
   nhánh **`m1`**, SHA `<SHA-FE>` / `<SHA-BE>`. Không có nhánh riêng nào cho WWHN-331.
   Đóng FE331-P2-01.
2. **Hướng vá FE331-P1-03 là đúng gốc**: "file lỗi có tải được hay không" do server
   quyết định qua `error_file_available`, dùng chung một điều kiện với endpoint tải; FE
   không tự so hạn dùng bằng đồng hồ client. Đường dẫn lưu trữ nội bộ `error_file_path`
   không còn được API trả ra ngoài.
3. **Duyệt việc dùng cột `duplicate_of_replay`** để đánh dấu bản ghi gốc khi bị phát
   lại — là marker truy vết, không đổi số liệu nghiệp vụ của lần import gốc.
4. **Benchmark DEV330-P1-02 đã có số thật** và chứng minh được bounded-read; tôi hiểu
   đây là số trên môi trường test, không phải cam kết SLA production.

Không phát sinh việc mới từ phía Tech Lead.

---

## 2) BA / BAS — 1 comment

**[BA] Xác nhận nghiệp vụ WWHN-331**

Tôi đã đọc và xác nhận 3 điểm sau:

1. **Luồng UI đúng nghiệp vụ**: chọn file → Kiểm tra trước (dry-run) → sửa lỗi nếu có →
   Import chính thức (all-or-nothing). Chỉ khi dry-run sạch lỗi mới bấm được Import.
2. **Chốt chính thức 4 giá trị đang ghi "tạm" trong code** (hết phần chờ BA của
   FE331-P1-04): tối đa **1 000 dòng dữ liệu**/lần import; file tối đa **10 MB**; cửa sổ
   idempotent **24 giờ theo từng actor** (hai người khác nhau nộp cùng file vẫn là 2 lần
   import độc lập); hạn tải file lỗi CSV **24 giờ**, hết hạn thì chạy lại dry-run.
3. **Ứng xử khi nộp trùng file** là kết quả đúng, không phải lỗi: hệ thống trả lại kết
   quả lần import gốc và không ghi SKU lần hai.

Không yêu cầu thay đổi thêm về nghiệp vụ.

---

## 3) PM / PO — 1 comment

**[PM] Xác nhận phạm vi & metadata WWHN-331**

Tôi xác nhận:

1. **Sprint metadata (đóng FE331-P2-02)**: Sprint hiện hành là **W3**; phần Sprint Scope
   text còn ghi W4 là tồn đọng — lấy comment này làm căn cứ, reviewer dùng W3.
2. **Phạm vi**: FE331-P1-01, P1-02, P1-03, P1-05, P1-07 và P2-01 đã có evidence; ticket
   này không có mục P0.
3. **Còn phụ thuộc, không chặn sign-off của FE1**: FE331-P1-06 chờ QA1 chạy độc lập
   (WWHN-332) — đây là điều kiện để chuyển toàn ticket sang Done.

Không phát sinh việc mới từ phía PM.

---

## 4) QA1 — 1 comment

**[QA1] Xác nhận phạm vi kiểm thử WWHN-331 / WWHN-332**

Tôi đã đọc evidence pack và **đồng ý phạm vi test độc lập** sẽ chạy trên đúng SHA
`<SHA-FE>` / `<SHA-BE>` nhánh `m1`, gồm:

- Import: tải template, dry-run có lỗi/không lỗi, Import chính thức all-or-nothing.
- File lỗi CSV: nội dung `row/field/error_code/message/value`, RBAC `sku.manage` (403),
  404 khi hết hạn/không có file, hành vi UI khi file bị dọn giữa chừng.
- Giới hạn: 1 000 dòng hợp lệ, 1 001 dòng trả 422 `SKU_IMPORT_ROW_LIMIT_EXCEEDED`
  (không 500), file > 10 MB.
- Import lặp cùng file: `duplicate=true`, không ghi SKU/báo cáo lần hai.
- Responsive + trạng thái loading/empty/error/disabled trên màn hình Import.

Tôi **chưa** ký nghiệm thu kết quả — WWHN-332 giữ nguyên trạng thái chờ chạy.

---

## 5) DevOps — 1 comment

**[DevOps] Xác nhận vận hành liên quan WWHN-331 / WWHN-330**

Tôi xác nhận đã đọc và nắm 2 điểm vận hành, không phát sinh việc mới trong ticket này:

1. **Scheduler PROD**: file lỗi CSV nằm ở `storage/app/import-error-files` và chỉ được
   dọn bởi lệnh `import:purge-error-files` chạy 02:15 hằng ngày. Nếu Laravel scheduler
   không thực sự chạy trên PROD thì file sẽ tồn vĩnh viễn dù API đã coi là hết hạn —
   tôi chịu trách nhiệm xác nhận scheduler hoạt động trên môi trường thật.
2. **Benchmark**: các con số trong evidence pack đo trên môi trường test (sqlite
   in-memory), dùng để chứng minh bounded-read chứ không phải SLA. Nếu cần SLA
   production thì phải đo lại trên đúng môi trường/CSDL thật.

---

## 6) DEV (FE1/BE — Quang Nguyễn Thanh) — 1 comment bàn giao

**[DEV] Bàn giao WWHN-331**

Tôi xác nhận đã hoàn thành và tự kiểm chứng trên nhánh `m1`:

- FE331-P1-01/02: màn hình Import SKU thật, endpoint đúng `/skus/import-excel` (không
  phải `/import-batches`), mapping ghi tại `docs/api-evidence/M1_API_MAPPING.md`.
- FE331-P1-03: file lỗi CSV tải được thật; availability do server quyết định
  (`error_file_available`), đường dẫn lưu trữ nội bộ không còn lộ ra API; UI phủ đủ
  availability/loading/403/404/hết hạn/retry/double-submit.
- FE331-P1-04: FE không hard-code giới hạn, hiển thị nguyên văn lỗi limit của BE; đã có
  benchmark số thật (`docs/evidence/WWHN-330/BENCHMARK_RESULT.md`).
- FE331-P1-05: nộp trùng file trả `duplicate=true`, không ghi lần hai; bản ghi gốc được
  đánh dấu `duplicate_of_replay` để đối soát.
- FE331-P1-07 / P2-01: evidence pack tại `docs/evidence/WWHN-331/EVIDENCE_PACK.md`;
  toàn bộ nằm trên `m1`.

Kết quả chạy thật: FE typecheck/lint/format/build PASS, **508/508** test FE PASS,
`check:api-mapping` PASS, `master-sku:verify` PASS; BE suite import **39/39** PASS,
contract/schema PASS, Pint PASS trên các file thuộc WWHN-330/331.

Bàn giao QA1 (WWHN-332) kiểm thử độc lập. Còn chờ BA/Tech Lead chốt 4 giá trị "tạm" và
PM đồng bộ Sprint metadata.
