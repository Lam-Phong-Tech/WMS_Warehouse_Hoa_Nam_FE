# WWHN-242 — Comment xác nhận theo vai (dán thẳng vào Jira)

Quy ước: **mỗi vai chỉ comment MỘT lần**, gộp đủ các đầu mục thuộc vai đó. Comment dưới đây
chỉ dành cho việc **đọc + duyệt**; vai nào còn phải làm việc thật thì ghi rõ ở §7 và **không**
soạn comment ký.

Nguồn tham chiếu chung khi ký:
- `docs/Task_docs_Jira/WWHN-242_SCOPE_DISPOSITION.md` (định đoạt phạm vi + exact clause + SHA-256)
- `docs/Task_docs_Jira/WWHN-242.md` (register + kết quả đo)
- Cổng: `npm run verify:wwhn-242`, `npm run test:e2e:wwhn-242`, `npm run wwhn-242:evidence`

---

## 1. FE1 — người thực hiện

> **[FE1] Xác nhận đã đóng FE242-P0-01 (phần kỹ thuật), P1-02, P1-03, P2-01, P2-02.**
>
> Tôi xác nhận các thay đổi FE trên nhánh **`m1`** (nguồn canonical duy nhất; **không tồn tại
> nhánh `m1ee`**):
> 1. `/reverse` mở cho `inventory.view` — trước đó gate chỉ nhận `inventory.reversal.post` nên
>    khoá nhầm 5 vai chỉ đọc mà BE vẫn cho đọc.
> 2. 409/412/428 nay **tự nạp lại** phiếu + dòng (BR-REV-02); 403/422 không kích hoạt cơ chế này.
> 3. Thiếu `version` chứng từ gốc thì chặn ngay ở UI thay vì gửi request chắc chắn 428.
> 4. Bằng chứng chạy thật: unit **571 PASS**, e2e WWHN-242 **18/18 PASS**, `verify:wwhn-242` **PASS**.
>
> Tôi **không** ký thay QA độc lập (FE242-P1-01) và không tuyên bố đây là bằng chứng UAT.
> Lưu ý trung thực: `typecheck`/`build` đang đỏ ở `src/modules/warranty/**` do cây làm việc dở
> của một task khác trên cùng `m1`, **không** thuộc phạm vi WWHN-242.

---

## 2. BA Main / BAS — xác nhận chuỗi thẩm quyền

> **[BA] Xác nhận FE242-P1-04 và căn cứ phạm vi của FE242-P0-01.**
>
> Tôi đã đọc `WWHN-242_SCOPE_DISPOSITION.md` §2 và xác nhận **chuỗi thẩm quyền là đúng**:
> baseline điều khiển là **SRS/FRD v1.12**, adopt qua **WWHN-334 (Done)**; clause quyết định là
> **`REQ-SRS-037` (Must)** + `AC-SRS-037`, xác nhận chéo bởi **ERD §0.1** và **wireframe MVP
> nhóm 05** (chỉ có INV-01/TRACE-01/REV-00/REV-01); phần Reversal neo **`REQ-SRS-013`** +
> `BR-REV-01..12` + Annex D `SCR-REV-01`. Bốn baseline đã được ghim SHA-256 và cổng CI tính lại
> hash tại chỗ.
>
> Tôi cũng xác nhận ranh giới trích dẫn: **`DEC-NO-STOCKTAKE-001` và `DEC-REV-001` KHÔNG được
> dùng như approved standalone Decision ID** vì `WWHN-25` và `WWHN-26` còn **FORMAL APPROVAL
> PENDING**.
>
> Việc còn lại của tôi (không nằm trong comment này): cập nhật Description/AC/dependency của
> WWHN-242 theo text đã soạn sẵn ở §4 của hồ sơ định đoạt.

---

## 3. PM / PO — duyệt định đoạt phạm vi

> **[PM/PO] Duyệt disposition FE242-P0-01: phạm vi WWHN-242 là REVERSAL-ONLY.**
>
> Tôi duyệt kết luận: Stocktake/Variance/Adjustment **nằm ngoài phạm vi** và **không khôi phục**,
> vì `REQ-SRS-037` là requirement **Must** trong baseline đã adopt (`WWHN-334` Done); khôi phục
> Stocktake sẽ làm đỏ `AC-SRS-037`/`TC-SRS-037`/`BR-NOSTK-01..03` và mâu thuẫn ERD §0.1.
>
> Tôi đồng ý cập nhật Jira AC + gỡ dependency Stocktake theo §4 của hồ sơ định đoạt.
> Duyệt này **không** thay việc phê duyệt chính thức `WWHN-25` / `WWHN-26`; hai Decision Record
> đó vẫn PENDING và được theo dõi riêng.

---

## 4. Tech Lead — xác nhận ranh giới kỹ thuật và cổng

> **[Tech Lead] Xác nhận ranh giới trích dẫn, cổng fail-closed và tính nhất quán của bản vá.**
>
> Tôi xác nhận:
> 1. Rule no-Stocktake được enforce theo **`REQ-SRS-037`**, không neo vào Decision ID chưa duyệt.
> 2. `scripts/verify-wwhn-242-closure.mjs` là **fail-closed**: thiếu governance, lệch hash baseline,
>    RBAC drift, mất cơ chế nạp lại version, thiếu viewport hoặc thiếu mã lỗi trong ma trận đều ĐỎ.
>    Trong CI cổng chạy **không kèm** `--repin` nên baseline trôi là đỏ, không tự vá.
> 3. Bản vá BE đi đúng khuôn đã dùng ở WWHN-211 (inventory) và WWHN-289 (inbound): data scope là
>    **biên phía server**, route guard/ẩn nút ở FE chỉ là UX.
>
> Không yêu cầu thêm việc mới từ phía tôi.

---

## 5. BE1 — xác nhận hai bản vá backend

> **[BE1] Xác nhận BE242-D1 (data scope) và BE242-D2 (projection) khớp SRS/ERD.**
>
> 1. **BE242-D1:** cả **7/7** route `reversal-documents` nay chịu `EnforceReversalWarehouseScope`,
>    và danh sách lọc data scope **ngay trong query** (`applyWarehouseScope`) nên `meta.total` của
>    phân trang cũng đúng phạm vi. Đúng SRS §8.1 "exact permission + data scope; default deny".
>    Trước bản vá, actor có `inventory.reversal.post` nhưng `scope_ref` trỏ kho khác vẫn **Post
>    được reversal** — tức ghi vượt biên, không chỉ lộ dữ liệu.
> 2. **BE242-D2:** `index()/show()` nay chiếu `physical_return_status`, `condition_status`,
>    `cancelled_at`, `cancel_reason` theo **ERD bảng 33 + ERD-AMD-002**. Thiếu bốn cột này thì bước
>    **CONFIRMED** của §6 không tồn tại trên UI và mọi Reverse Issue chết ở
>    `409 PHYSICAL_RETURN_REQUIRED` (BR-REV-06).
>
> Bằng chứng: `tests/Feature/Wwhn242ReversalScopeAndProjectionTest.php` — **7/7 PASS, 65 assertion**,
> gồm khẳng định từ chối theo data scope là **no-write** (số movement không đổi).

---

## 6. DevOps — xác nhận cổng CI và ghim danh tính

> **[DevOps] Xác nhận FE242-P1-02 và FE242-P2-02.**
>
> Tôi xác nhận `.github/workflows/wwhn-242-fe-closure.yml` chạy trên **exact SHA** đủ chuỗi
> `format:check → lint → typecheck → check:api-mapping → test → verify:wwhn-242 → build →
> test:e2e:wwhn-242`, và chỉ tạo manifest **sau khi** mọi cổng trước xanh.
>
> Artifact bất biến ghi `EXACT_GIT_SHA`, `CANONICAL_BRANCH=m1`, `EVIDENCE_CLASS=FE_CONTROLLED_NOT_UAT`
> và `SHA256SUMS` của cả source lẫn 4 baseline — đủ để reviewer khác không dùng nhầm nguồn.
> `scripts/run-wwhn-242-evidence.mjs` ghi thêm exit code + log thô + cờ `workingTreeClean`; nếu cây
> bẩn thì SHA **không** được coi là exact-SHA evidence.

---

## 7. Vai KHÔNG ký ở đợt này (còn việc thật)

| Vai | Vì sao không ký | Việc thật còn lại |
| --- | --- | --- |
| **QA2** | FE242-P1-01 yêu cầu QA **chạy** ma trận độc lập, không phải duyệt hộ | Chạy UI/role/stale/partial/responsive/API-error trên build đã deploy, nộp screenshot/video + test matrix + exact SHA |
| **PM/PO (với WWHN-25/26)** | Hai Decision Record vẫn FORMAL APPROVAL PENDING | Phê duyệt riêng, ngoài phạm vi WWHN-242 |
| **BA Main (với Jira)** | Sửa Description/AC/dependency là thao tác thật trên Jira | Dán text ở §4 hồ sơ định đoạt |
