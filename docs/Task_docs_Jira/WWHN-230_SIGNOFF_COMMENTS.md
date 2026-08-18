# WWHN-230 — Comment xác nhận (sign-off) theo vai trò

Mỗi vai trò **chỉ post 1 comment duy nhất** trên `WWHN-230`, đã gộp đủ các hạng mục thuộc
vai trò đó. Không post lại ở `WWHN-58` / `WWHN-232` — chỉ cần link về comment này.

Trước khi post: thay `<sha-be>` / `<sha-fe>` bằng exact SHA của candidate, và điền cùng giá
trị đó vào `docs/decision-records/DISP-STK-230-APPROVAL.json` (BE repo).

Lấy exact SHA:

```bash
cd C:/LAM_PHONG_TECH/HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE && git rev-parse HEAD
```

```bash
cd C:/LAM_PHONG_TECH/HoaNam_FE/WMS_Warehouse_Hoa_Nam_FE && git rev-parse HEAD
```

---

## 1. BA Main — `DEV230-P1-01`

> **BA Main — xác nhận phạm vi WWHN-230.**
>
> Tôi xác nhận đã đọc `DISP-STK-230` v1.0.0 và **duyệt Option B: park/de-scope WWHN-230 +
> WWHN-58 khỏi Beta implementation**, `WWHN-232` chuyển thành absence & substitution test.
>
> Căn cứ: `REQ-SRS-037` (priority `Must`) trong SRS/FRD v1.12 đã adopt tại `WWHN-334`, được
> ERD §0.1 và wireframe MVP ALIGNED v3.20 xác nhận chéo. Không có CR nào đưa Stocktake vào
> current scope tính đến 18/08/2026, nên Option A không có căn cứ.
>
> Xác nhận thêm: disposition này **không** phải approval cho `DEC-STK-001`; `WWHN-25` vẫn
> `In Progress` và được giữ nguyên trạng thái.
>
> Không yêu cầu công việc mới. Exact SHA: BE `<sha-be>` · FE `<sha-fe>`.

## 2. PM / Approver — `DEV230-P1-01`

> **PM — quyết định phạm vi WWHN-230: GO cho Option B.**
>
> Tôi xác nhận `WWHN-230` và `WWHN-58` **không nằm trong Beta scope**, và `WWHN-232` được
> nghiệm thu bằng absence & substitution test thay vì test chức năng kiểm kê.
>
> Effective date: ngày post comment này. Điều kiện mở lại: chỉ khi có Change Request được
> duyệt hạ `REQ-SRS-037` khỏi `Must`, **và** `WWHN-25` đóng với `GO`/`CONDITIONAL GO`.
>
> Nghiệp vụ sửa sai sau Post tiếp tục dùng append-only Reversal; phát hiện lệch dùng
> reconciliation incident. Không yêu cầu công việc mới. Exact SHA: BE `<sha-be>` · FE `<sha-fe>`.

## 3. Tech Lead — `DEV230-P1-01`, `DEV230-P1-02`

> **Tech Lead — xác nhận evidence và ràng buộc kỹ thuật WWHN-230.**
>
> Tôi xác nhận đã review và chấp nhận:
> - `DISP-STK-230` + `DISP-STK-230-APPROVAL.json` (Option B, effective date để trống cho tới
>   khi PM ghi quyết định);
> - identity pin exact SHA/branch/dirty-state ở `docs/evidence/WWHN-230/CLOSURE_EVIDENCE.json`
>   (BE) và `FE_CLOSURE_EVIDENCE.json` (FE), kèm `SHA256SUMS`;
> - gate CI: `node scripts/verify-wwhn-230-closure.mjs` (BE) và `npm run wwhn-230:verify` (FE),
>   cả hai fail-closed và **fail luôn nếu `REQ-SRS-037` biến mất khỏi baseline** — guard
>   không được sống lâu hơn requirement nó thi hành;
> - test lock `Wwhn230StocktakeScopeDispositionTest` (11 test) và
>   `wwhn-230-stocktake-scope-guard` (4 test).
>
> Không có implementation để map code/schema/API vì không có chức năng nào được xây — evidence
> đúng dạng absence proof tại exact SHA. Không yêu cầu công việc mới.
> Exact SHA: BE `<sha-be>` · FE `<sha-fe>`.

## 4. QA1 — `DEV230-P1-03`

> **QA1 — xác nhận ma trận nghiệm thu WWHN-232.**
>
> Tôi xác nhận chấp nhận ma trận AC ở `DISP-STK-230` §5: 8 nhóm AC gốc (session/snapshot/
> cutoff, manual/scan, duplicate/state, movement-warning, variance, RBAC 401/403, audit,
> "snapshot/count không tạo movement/balance delta") được nghiệm thu dạng **absence &
> substitution**, mỗi dòng có một assertion tự động.
>
> Riêng điểm "không tạo movement/balance delta" được chứng minh **mạnh hơn** yêu cầu gốc:
> không tồn tại bất kỳ đường ghi tồn nào ngoài Post Receipt / Post Issue / Reversal.
> Nhóm Apply Adjustment (idempotency/race/rollback/reconcile) nằm ngoài scope theo
> `DISP-ADJ-001` Option B.
>
> Kết quả chạy tại exact SHA: BE 11/11 pass, FE 4/4 pass, cả hai closure gate PASS.
> Tôi **không** yêu cầu candidate build cho chức năng kiểm kê vì chức năng đó không tồn tại.
> Không yêu cầu công việc mới. Exact SHA: BE `<sha-be>` · FE `<sha-fe>`.

## 5. BAS — `DEV230-P1-04`

> **BAS — xác nhận traceability temp key WWHN-230.**
>
> Tôi xác nhận dependency `HN-INV-001` của `WWHN-230` map sang **`WWHN-48` — [INVENTORY] Số
> dư, movement không chỉnh sửa và API đối soát**, status `CONFIRMED`, dẫn nguồn
> `docs/docs_task_jira/WWHN-205.md`.
>
> Register đầy đủ: `docs/traceability/TEMP_KEY_CANONICAL_REGISTER.json` (BE repo), phân
> `CONFIRMED` / `CANDIDATE` / `RETIRED` / `UNRESOLVED` — không suy diễn mapping nào không có
> nguồn trong repo.
>
> Ghi nhận phần còn mở, không chặn việc đóng `WWHN-230`: `HN-MC-001` và `HN-HO-001` đang là
> `CANDIDATE`; `HN-DEC-002`, `HN-DEC-005`, `HN-TEC-001`, `HN-FND-001`, `HN-PIN-06`,
> `HN-QA-003`, `HN-PV-202` và toàn bộ `HN-EPIC-*` là `UNRESOLVED`, cần lấy từ Jira.
> Không yêu cầu công việc mới. Exact SHA: BE `<sha-be>` · FE `<sha-fe>`.

---

## Sau khi 5 comment đã post

1. Điền `decision` / `date` / `commentUrl` cho từng vai trò và `exactCommitSha`,
   `effectiveDate`, `status: "APPROVED"` trong `DISP-STK-230-APPROVAL.json`.
2. Chạy gate ở chế độ cuối:

```bash
cd C:/LAM_PHONG_TECH/HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE && node scripts/verify-wwhn-230-closure.mjs --require-signoff --with-tests
```

```bash
cd C:/LAM_PHONG_TECH/HoaNam_FE/WMS_Warehouse_Hoa_Nam_FE && npm run wwhn-230:verify -- --require-signoff --with-tests
```

3. Attach `docs/evidence/WWHN-230/` (cả hai repo) vào `WWHN-230` và link từ `WWHN-232`.
