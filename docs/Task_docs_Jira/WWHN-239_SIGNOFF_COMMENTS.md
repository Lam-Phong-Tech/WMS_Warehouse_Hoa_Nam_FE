# WWHN-239 — Comment xác nhận / sign-off theo vai trò

Nguyên tắc: **mỗi vai trò chỉ comment 1 lần**, nói rõ mình xác nhận cái gì, không ký thay
vai trò khác. Các mục còn phải **làm việc thật** (chạy test, đổi field Jira) nằm ở §2 và
**không được ký** ở đây.

Candidate đang xác nhận:

- BE `WMS_Warehouse_Hoa_Nam_BE` `m1` — `c85eca4d9f9ea932bdb57cba0b4711aa1a3aa2b6`
- FE `WMS_Warehouse_Hoa_Nam_FE` `m1` — `3d58bdd1c500acb60c4cc5f93202a79a4fd166df` (chỉ tài liệu; không thay đổi mã, xem §1.5)

Nguồn tài liệu để đọc trước khi ký:

- `docs/decision-records/DISPOSITION-WWHN-239-REVERSAL-CONTROLLING-DECISION.md`
- `docs/evidence/WWHN-239/DEV239_FIX_REGISTER.md`
- `docs/evidence/WWHN-239/EVIDENCE_MATRIX.md`
- `docs/evidence/WWHN-239/QA1_TEST_PACK_WWHN-241.md`

---

## 1. Các comment chỉ cần xác nhận (đọc + duyệt)

### 1.1. BA Main — đóng DEV239-P1-01

> **[BA] Xác nhận disposition của decision điều khiển Reversal và dependency tồn kho (DEV239-P1-01).**
> Tôi đã đọc và duyệt `DISP-REV-239`, xác nhận:
>
> - **Không tồn tại version `EFFECTIVE` nào của `DEC-REV-001` (HN-DEC-004 / WWHN-26)**: `Effective date = NULL`, sign-off ledger §12 toàn `PENDING`. Vì vậy yêu cầu "pin latest EFFECTIVE version" được đóng bằng **formal disposition**, đúng nhánh thứ hai mà DEV239-P1-01 cho phép.
> - **Nguồn điều khiển implementation là SRS/FRD v1.12** (`REQ-SRS-013`, `AC-SRS-013`, `BR-REV-01..12`, `§6`, `§8.1`, `§8.2`, ERD bảng 33/34), vì SRS v1.12 đã hấp thụ toàn bộ nội dung nghiệp vụ của WWHN-26 ("CONTENT ADOPTED").
> - **Contract đề xuất `1.3.0-proposed` §5 (`POST /api/v1/reversals`, `stock.reversal.create`) chưa được adopt**; `OP-REV-05` vẫn OPEN và **không chặn** WWHN-239 vì nó chỉ đổi API surface, không đổi bất biến nghiệp vụ.
> - **Dependency `HN-STK-003`**: prerequisite bắt buộc trước Reversal là S-1…S-8 (append-only ledger, movement gốc bất biến, balance = SUM(qty_delta), no-negative, CAS version, item subledger, FK reversal→ledger canonical, một serial chỉ đảo một lần). Cả tám đều có nơi enforce và bằng chứng chạy thật.
> - **S-9/S-10 không phải prerequisite**: `DEC-STK-001` (kiểm kê) còn `PROPOSED` nhưng REQ-SRS-037 đã gỡ Stocktake khỏi v1.12 và Reversal không đọc artefact kiểm kê nào → `HN-STK-003` là **NON-BLOCKING** cho WWHN-239.
>
> Tôi **không** ký thay QA1 và không xác nhận kết quả kiểm thử.

### 1.2. Approver (PM/PO) — đóng DEV239-P1-01 + DEV239-P2-01

> **[PM/PO] Duyệt disposition WWHN-239 và chốt field Sprint authoritative.**
> Tôi đã đọc và duyệt:
>
> - **Chấp thuận `DISP-REV-239`**: WWHN-239 được đánh giá theo **SRS v1.12**, không theo `DEC-REV-001 1.3.0-proposed`. Việc runtime dùng `POST /inbound|outbound-documents/{id}/reverse|reversals` + `inventory.reversal.post` là **đúng disposition**, không phải sai lệch.
> - **`OP-REV-05` (đổi sang `POST /api/v1/reversals`) tách thành ticket adoption riêng**, không gộp vào WWHN-239.
> - **`HN-STK-003` là NON-BLOCKING** cho WWHN-239 theo lập luận S-9/S-10.
> - **DEV239-P2-01**: field authoritative là **`Sprint` (field hệ thống của board)**; custom field `Sprint Scope` phải sửa về **W3** cho khớp. Không kéo `Sprint` sang W4 vì làm vậy sẽ sai burndown/velocity của cả sprint chứ không chỉ task này.
>
> Tôi **không** xác nhận WWHN-239 là Done: closure còn chờ QA1 (WWHN-241).

### 1.3. Tech Lead — đóng DEV239-P1-02 và duyệt kỹ thuật P1-03

> **[Tech Lead] Xác nhận candidate, file set và cách đóng defect của WWHN-239.**
> Tôi đã đọc và duyệt:
>
> - **Nhánh canonical là `m1`**; không có nhánh riêng cho task này. **PR = N/A** và đã ghi lý do trong evidence matrix: `m1` là nhánh làm việc chung, tại thời điểm này có nhiều phiên sửa song song trên cùng working tree, nên review được thực hiện trực tiếp trên candidate SHA `c85eca4d9f9ea932bdb57cba0b4711aa1a3aa2b6` thay vì trên PR.
> - **Defect P0 `D-239-01` là thật và cách đóng là đúng tầng**: guard `reversible_qty` tính theo tổng quantity, trong khi một `stock_document_line` serial gồm N item chỉ sinh **một** movement `quantity=N`, nên cùng một `item_id` đảo được N lần. Đóng bằng ba lớp — guard lúc tạo DRAFT, re-check dưới `lockForUpdate` lúc Post, và **partial unique index** `ux_reversal_line_posted_item_per_movement` ở tầng DB. Lớp thứ ba là lớp duy nhất đúng cho ca "true competing reversal".
> - **Phân lớp mã 409 đúng WWHN-234**: thua race trả `CONCURRENCY_CONFLICT` (client reload + retry **giữ nguyên** Idempotency-Key); trạng thái không cho phép trả mã miền `REVERSAL_ITEM_ALREADY_REVERSED` như biến thể của `STATE_CONFLICT`.
> - **Bỏ `ADJUSTED_OUT` khỏi whitelist receipt không mất năng lực nghiệp vụ**: item `ADJUSTED_OUT` vẫn nhận lại được (`assertItemAvailableForReceipt`) và sau Post Receipt trở về `IN_STOCK` nên vẫn đảo được.
> - **Ranh giới với WWHN-242**: `routes/api.php` và `ReversalDocumentController.php` do WWHN-242 sở hữu; WWHN-239 chỉ đóng góp class middleware `EnforceReversalWarehouseScope` và không ghi đè hai file đó.
> - **Bằng chứng DEV239-P1-03 chạy trên PostgreSQL 16** (không phải sqlite), gồm `migrate:fresh --seed` và suite Reversal + regression tồn kho; log thô nằm trong `docs/evidence/WWHN-239/`.
>
> Tôi **không** ký thay QA1: `Test Ready` chỉ đạt khi WWHN-241 nộp report trên đúng SHA này.

### 1.4. QA1 — xác nhận test pack đủ để chạy (chưa phải kết quả)

> **[QA1] Xác nhận phạm vi kiểm thử WWHN-241 đã đủ điều kiện để chạy.**
> Tôi đã đọc và duyệt `QA1_TEST_PACK_WWHN-241.md`, xác nhận:
>
> - **10 dòng yêu cầu của DEV239-P1-04 đã ánh xạ đủ**: double-reverse, same-key replay, same-key/different-payload, RBAC 401/403 (+403 data scope), rollback, dependency guard, true competing reversal, no-negative, duplicate movement = 0, orphan = 0, ledger = balance.
> - **Tiêu chí chấm là fail-closed**: mỗi ca chỉ PASS khi vừa đúng HTTP + `error.code`, vừa chứng minh **không có write** (đo lại `stock_movements` count và `inventory_balances.quantity` sau khi bị từ chối).
> - **Ca "true competing reversal" phải chạy bằng đồng thời thật** (hai request song song, khác Idempotency-Key), không chấp nhận test tuần tự; và **Q7 phải trả đúng 1 dòng** — nếu build thiếu migration `2026_08_18_214000` thì ca này không được chấm PASS kể cả khi kết quả hai request trông đúng.
> - **Bộ đối soát `RECONCILIATION.sql`** (Q1–Q7) là điều kiện nộp bắt buộc kèm report.
>
> Tôi **chưa** xác nhận kết quả: WWHN-241 vẫn OPEN cho tới khi có log thô + output Q1–Q7 chạy trên đúng exact build.

### 1.5. FE — xác nhận không cần đổi mã FE trong phạm vi WWHN-239

> **[FE] Xác nhận WWHN-239 không phát sinh thay đổi FE.**
> Tôi đã đọc và duyệt:
>
> - Hai mã lỗi mới của backend rơi đúng vào phân lớp sẵn có trong `src/shared/api/concurrency-contract.ts`: `409 CONCURRENCY_CONFLICT` → `RELOAD_THEN_RETRY` (**giữ nguyên** Idempotency-Key), còn `409 REVERSAL_ITEM_ALREADY_REVERSED` rơi vào nhánh "409 còn lại → `STOP`" — đúng hành vi mong muốn vì đây là lỗi không được retry.
> - `ReversalCreateModal` đã hiển thị thẳng message của backend cho `409/412/428`, nên câu hướng dẫn tiếng Việt do BE trả về đến được người dùng mà không cần thêm bản đồ mã lỗi ở FE.
> - Preflight `GET /stock-movements/reversible` vốn chỉ chào item `IN_STOCK`/`NEW`; sau WWHN-239 backend enforce đúng bằng preflight, nên UI và BE không còn lệch.
>
> Tôi **không** xác nhận phần data-scope UI — phần đó thuộc WWHN-242.

---

## 2. Các mục KHÔNG được ký ở đây (còn phải làm việc thật)

| Mục | Ai làm | Vì sao không ký ở §1 |
|---|---|---|
| Chạy ma trận WWHN-241 trên exact build và nộp report | QA1 | Là chạy kiểm thử, không phải đọc + duyệt |
| Sửa custom field `Sprint Scope` W4 → W3 trên Jira | PM/BAS | Là thao tác trên Jira, không phải review |
| Ghi kết quả từng vai trò vào sign-off ledger của `DEC-REV-001` §12 | từng vai trò | Phải ghi trên Jira WWHN-26/WWHN-134, không phải trong repo |
| Adoption `OP-REV-05` (`POST /api/v1/reversals`) | Tech Lead + BE1 + FE + QA | Ticket riêng, ngoài phạm vi WWHN-239 |
