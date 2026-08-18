# WWHN-239 — Reversal (DEV) · hồ sơ đóng P1/P2

| Field | Value |
|---|---|
| Task | `WWHN-239` — DEV luồng Reversal |
| QA1 song hành | `WWHN-241` |
| Controlling decision | `DEC-REV-001` / temp key `HN-DEC-004` / Jira `WWHN-26` |
| Stock dependency | temp key `HN-STK-003` |
| Nhánh | `m1` (BE và FE) — **không tạo nhánh riêng** |
| Điểm trước | 68/100 |
| Ngày | 2026-08-18 |

Hồ sơ kỹ thuật đầy đủ nằm trong repo BE:

- `docs/evidence/WWHN-239/DEV239_FIX_REGISTER.md` — register đóng theo từng ID
- `docs/evidence/WWHN-239/EVIDENCE_MATRIX.md` — file set, migration, test, lệnh chạy, digest
- `docs/evidence/WWHN-239/QA1_TEST_PACK_WWHN-241.md` — ma trận 10 ca cho QA1
- `docs/evidence/WWHN-239/RECONCILIATION.sql` — 7 truy vấn đối soát
- `docs/evidence/WWHN-239/RAW_*.log` — log thô chạy trên PostgreSQL 16
- `docs/decision-records/DISPOSITION-WWHN-239-REVERSAL-CONTROLLING-DECISION.md` — DEV239-P1-01

Comment sign-off theo vai trò: `docs/Task_docs_Jira/WWHN-239_SIGNOFF_COMMENTS.md` (repo FE).

---

## 1. Trạng thái từng dòng của bảng chấm

| ID | Sev | Trạng thái | Ai còn phải hành động |
|---|---|---|---|
| DEV239-P1-01 | P1 | DEV-DONE — có formal disposition `DISP-REV-239` | BA Main + Approver (PM/PO) ghi kết quả |
| DEV239-P1-02 | P1 | DEV-DONE — evidence matrix + candidate SHA + PR=N/A có lý do | Tech Lead review |
| DEV239-P1-03 | P1 | DONE — chạy thật trên PostgreSQL 16 | QA1/TL đối chiếu log |
| DEV239-P1-04 | P1 | DEV-DONE — test pack + SQL đối soát; **đã đóng 1 defect P0 mà chính ma trận QA1 sẽ trượt** | QA1 chạy và nộp report WWHN-241 |
| DEV239-P2-01 | P2 | DEV-DONE — đã chốt field authoritative | PM/BAS sửa custom field trên Jira |

## 2. Điểm quan trọng nhất: defect P0 đã đóng trước khi QA1 chạy

`CurrentBaselineStockService::postStockDocument()` ghi **một** movement cho mỗi
`stock_document_line` với `quantity = qty_planned`. Một line PRODUCT serial-tracked gồm
N item vì thế chỉ sinh **một** movement `RECEIPT quantity=N`.

Guard `reversible_qty` của Reversal lại tính theo **tổng quantity**, nên cùng một
`item_id` có thể được khai đảo tới N lần mà vẫn "trong hạn mức" — hệ thống sinh N
movement `REVERSAL` cho **một serial vật lý duy nhất** và trừ tồn N lần.
`assertItemDependency()` không chặn được vì nó whitelist `item_status = ADJUSTED_OUT` —
đúng trạng thái mà lần đảo trước đặt ra.

Lỗi này phá đúng ba dòng mà WWHN-241 phải chứng minh: **double-reverse**,
**duplicate movement = 0**, **ledger = balance**. Đã đóng bằng ba lớp fail-closed:
guard lúc tạo DRAFT (`422`/`409`), re-check dưới `lockForUpdate` lúc Post
(`409 CONCURRENCY_CONFLICT`), và **partial unique index** ở tầng DB
(`ux_reversal_line_posted_item_per_movement`) — lớp duy nhất đúng cho ca
"true competing reversal".

## 3. Ranh giới với các task đang chạy song song trên `m1`

| Phạm vi | Task sở hữu | WWHN-239 làm gì |
|---|---|---|
| Data scope 7 route `/reversal-documents*` | **WWHN-242** | Chỉ đóng góp class middleware `EnforceReversalWarehouseScope`; **không** sửa `routes/api.php` và `ReversalDocumentController.php` |
| Phân lớp mã 409 theo §8.2 | **WWHN-234** | Dùng đúng `App\Support\ConflictCode` cho lớp concurrency; không tự đặt mã ngoài phân lớp |
| Adoption `POST /api/v1/reversals` | `OP-REV-05` (chưa mở ticket) | Ngoài phạm vi — xem `DISP-REV-239` §2 |

## 4. FE

Không có thay đổi mã FE trong phạm vi WWHN-239. Hai mã lỗi mới rơi đúng phân lớp sẵn
có của `src/shared/api/concurrency-contract.ts` (`CONCURRENCY_CONFLICT` →
`RELOAD_THEN_RETRY` giữ nguyên Idempotency-Key; mã miền còn lại → `STOP`), và
`ReversalCreateModal` đã hiển thị thẳng message tiếng Việt của backend cho `409/412/428`.
