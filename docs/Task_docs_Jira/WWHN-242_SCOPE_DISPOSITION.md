# WWHN-242 — Formal Scope Disposition: Stocktake vs Reversal

> Hồ sơ này đóng **FE242-P0-01** và **FE242-P1-04**. Nó trả lời dứt điểm một câu hỏi:
> *artifact nào đang điều khiển phạm vi WWHN-242, và WWHN-242 phải giao Stocktake hay
> chỉ Reversal?*
>
> Đây là **disposition**, không phải bản tự tuyên bố của FE. Mọi khẳng định bên dưới đều
> neo vào clause có thật trong baseline đã adopt, kèm hash để reviewer đối chiếu.

---

## 1. Vấn đề đúng như review nêu

Review 61/100 ghi:

> "Jira vẫn yêu cầu Stocktake + Reversal nhưng m1 đã xóa Stocktake và tự viện dẫn
> DEC-NO-STOCKTAKE-001."

Hai vế đều đúng và **cả hai đều phải sửa**:

| Vế | Sự thật | Hệ quả |
| --- | --- | --- |
| "m1 đã xoá Stocktake" | Đúng, và **đúng theo baseline** | Không phải defect code |
| "tự viện dẫn `DEC-NO-STOCKTAKE-001`" | Đúng, và **đây mới là defect governance** | Rule đang đứng trên thẩm quyền chưa tồn tại |
| "Jira vẫn yêu cầu Stocktake" | Đúng | Jira AC/dependency là artifact **lệch baseline**, cần cập nhật |

Nói cách khác: code đúng, **văn bản viện dẫn sai**, và **Jira chưa được đồng bộ**.

---

## 2. Chuỗi thẩm quyền (authority chain) — exact ID + clause

### 2.1. Baseline được pin

| Artifact | Đường dẫn | SHA-256 |
| --- | --- | --- |
| SRS/FRD v1.12 (FULL) | `docs/HN_SRS_FRD_v1.12_FULL.md` | `5ab1dd6c468e93f57a932741e823855806a9d37ac5dde9b118335ff8f84de086` |
| ERD mới nhất | `docs/HoaNam_ERD_Moi_Nhat.md` | `5209358cb0e9d91ced71b3b2ebaeb6e50d7f4304c03618a81a6a6a0adabf12e2` |
| Wireframe MVP v3.20 ↔ v1.12 | `docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html` | `107a2b4de0f5763e39278ec130758d57e772e004e525416c088018cf9ddba658` |
| Techstack / Architecture / Dev Guide | `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` | `049818cae2d18af0d06d40f5d40098a8cf11279fde7d38cafb256a27cc0812ea` |

### 2.2. Clause quyết định Stocktake **out**

| # | Clause | Trích (rút gọn) | Vị trí |
| --- | --- | --- | --- |
| C1 | **`REQ-SRS-037` (Must)** | "Không expose Stocktake/Variance, menu/API/permission/entity/report hoặc action sửa tồn trực tiếp." | SRS §Requirement matrix |
| C2 | **`AC-SRS-037`** | "deployment v1.12 không chứa capability legacy; reconciliation chỉ tạo incident, **sửa sai dùng reversal theo WWHN-26**." | cùng dòng C1 |
| C3 | SRS §Scope table | Out-of-scope: "Physical stocktake, variance và hành động sửa tồn trực tiếp" — In-scope: "Inventory query/trace/reconciliation/**reversal**" | SRS §2 |
| C4 | SRS §5.3 | "Không có Stocktake Session/Snapshot/Count/Variance/direct stock edit… **sai giao dịch dùng Reversal**." | SRS §5.3 |
| C5 | ERD §0.1 | "Không tạo Stocktake_Session, Stocktake_Snapshot, Stocktake_Count, Variance_Line, Adjustment hoặc report/permission tương ứng." | ERD §0.1 |
| C6 | Wireframe MVP | Nhóm "05 · Tồn kho & kiểm soát" gồm **INV-01, TRACE-01, REV-00, REV-01** — không có màn kiểm kê nào | Wireframe screen map |
| C7 | `TC-SRS-037` / `BR-NOSTK-01..03` | Test case + business rule đối ứng đã tồn tại trong baseline | SRS §Traceability |

### 2.3. Clause quyết định Reversal **in**

| # | Clause | Nội dung |
| --- | --- | --- |
| R1 | **`REQ-SRS-013` (Must)** | "Reversal append-only cho Receipt/Issue; không có action sửa tồn trực tiếp." |
| R2 | `BR-REV-01..12` (SRS §5.5) | Append-only, If-Match + Idempotency-Key, reversible_qty, dependency guard, concurrency, retry |
| R3 | `SCR-REV-01` (Annex D) | Màn Reversal: movement gốc read-only, reversible qty, dependencies, reason, condition, Post |
| R4 | ERD bảng **33/34** | `reversal_documents` / `reversal_lines`, kèm `ERD-AMD-002` bổ sung `condition_status`, `physical_return_status` |
| R5 | `TC-P1-025..032` | Bộ test POST_REVERSAL: positive / negative / permission / invalid state / retry / same-key-diff-payload / concurrency / rollback |

### 2.4. Trạng thái adoption (điểm mấu chốt)

| Item | Trạng thái | Kết luận sử dụng |
| --- | --- | --- |
| `WWHN-334` — adopt SRS/FRD v1.12 | **Done** | ⇒ `REQ-SRS-037` và `REQ-SRS-013` là **requirement đã có hiệu lực** |
| `WWHN-333` — BRD v3.20 Decision & Approval Record | ghi nhận no-stocktake | evidence hỗ trợ |
| `WWHN-25` / `DEC-STK-001` | **In Progress — FORMAL APPROVAL PENDING** | ⇒ KHÔNG được trích `DEC-NO-STOCKTAKE-001` như approved standalone Decision ID |
| `WWHN-26` / `DEC-REV-001` | **In Progress — FORMAL APPROVAL PENDING** | ⇒ Reversal enforce theo `REQ-SRS-013`, không neo vào Decision ID |

SRS tự nói rõ điều này ở dòng P0-04: *"WWHN-25/26/27 vẫn FORMAL APPROVAL PENDING; SRS
v1.12 adoption không thay formal decision gates."*

---

## 3. DISPOSITION

> **Phạm vi WWHN-242 là REVERSAL-ONLY. Stocktake nằm ngoài phạm vi và không được khôi phục.**

### 3.1. Căn cứ

`REQ-SRS-037` là requirement mức **Must** trong baseline đã adopt qua `WWHN-334` (Done),
được ERD §0.1 và wireframe MVP xác nhận chéo. Requirement Must trong baseline đã adopt
**thắng** phần mô tả/AC cũ trong một Jira ticket chưa đồng bộ. Đây không phải "FE tự
quyết", mà là áp dụng đúng thứ tự thẩm quyền artifact của chính dự án.

### 3.2. Vì sao lựa chọn "restore Stocktake" bị loại

Review đưa hai nhánh. Nhánh "restore Stocktake implementation nếu Jira vẫn controlling"
bị loại vì nếu thực hiện thì deliverable sẽ **vi phạm trực tiếp** `REQ-SRS-037` (Must),
làm đỏ `AC-SRS-037` / `TC-SRS-037` / `BR-NOSTK-01..03`, mâu thuẫn ERD §0.1 (không có
entity để lưu), và không có màn nào trong wireframe MVP để gắn. Nói cách khác nó tạo ra
một P0 lớn hơn P0 đang mở.

### 3.3. Hệ quả bắt buộc — phần này KHÔNG phải việc của FE

Vì Jira là artifact lệch, **BA Main/PM phải cập nhật Jira**, không phải FE tự đóng:

1. Sửa Description/AC của `WWHN-242` sang Reversal-only (text sẵn ở §4).
2. Gỡ dependency Stocktake khỏi `WWHN-242`.
3. Ghi vào scope evidence rằng thay đổi này neo `REQ-SRS-037`, không neo `DEC-NO-STOCKTAKE-001`.

### 3.4. Ranh giới trích dẫn (đây là phần đã sửa trong code)

| Được phép | Không được phép |
| --- | --- |
| Neo rule vào `REQ-SRS-037` / `AC-SRS-037` / `REQ-SRS-013` / `BR-REV-01..12` | Trình bày `DEC-NO-STOCKTAKE-001` như **approved standalone Decision ID** |
| Nhắc `DEC-NO-STOCKTAKE-001` như **nội dung decision đã ghi trong SRS, formal approval còn pending** | Nhắc `DEC-REV-001` như đã được PM/PO ký |
| Pin SHA-256 baseline làm bằng chứng | Suy diễn phạm vi từ comment trong source code |

Gate `scripts/check-api-mapping.mjs` đã đọc lại chính baseline và **chặn đỏ** mọi văn bản
trình bày `DEC-NO-STOCKTAKE-001` như approved Decision ID (đóng từ WWHN-296, WWHN-242 kế
thừa và thêm gate riêng ở `scripts/verify-wwhn-242-closure.mjs`).

---

## 4. Text đề xuất để BA/PM dán thẳng vào Jira `WWHN-242`

### 4.1. Description (thay đoạn đang nhắc Stocktake)

```
Phạm vi: REVERSAL-ONLY (REV-00 danh sách phiếu hoàn đảo, REV-01 tạo hoàn đảo).

Stocktake/Variance/Adjustment KHÔNG thuộc phạm vi. Căn cứ: SRS/FRD v1.12 REQ-SRS-037
(Must) — "Không expose Stocktake/Variance, menu/API/permission/entity/report hoặc action
sửa tồn trực tiếp", adopt qua WWHN-334 (Done); ERD §0.1; wireframe MVP nhóm 05 chỉ có
INV-01/TRACE-01/REV-00/REV-01.

Sửa sai sau Post chỉ đi qua Reversal append-only theo REQ-SRS-013 + BR-REV-01..12.

Ghi chú governance: WWHN-25/DEC-STK-001 và WWHN-26/DEC-REV-001 vẫn FORMAL APPROVAL
PENDING. Rule được enforce theo REQ-SRS-037 / REQ-SRS-013, KHÔNG theo Decision ID.
```

### 4.2. Acceptance Criteria (thay AC cũ)

```
AC-1  REV-00 hiển thị danh sách phiếu hoàn đảo (mã, chứng từ gốc, loại, kho, tổng SL,
      lý do, trạng thái, ngày tạo, người tạo) + tìm kiếm + lọc trạng thái + phân trang.
AC-2  REV-01 lookup movement reversible, hiện reversible_qty, dependency guard và ảnh
      hưởng tồn dự kiến trước khi gửi (Annex D SCR-REV-01).
AC-3  Lifecycle §6 DRAFT → CONFIRMED → POSTED / CANCELLED hiển thị đúng; POSTED là
      terminal append-only, UI không cho sửa/xoá (BR-REV-08).
AC-4  Mọi lifecycle op gửi If-Match theo version hiện hành; Create/Post gửi thêm
      Idempotency-Key (BR-REV-02, BR-REV-12).
AC-5  UI xử lý đúng 403 / 409 / 412 / 422 / 428: hiện thông điệp nghiệp vụ + request_id,
      không ghi dữ liệu, và tự nạp lại version khi 409/412/428.
AC-6  Reverse Issue bắt buộc khai return_condition và xác nhận hàng vật lý đã về; chỉ
      SELLABLE mới cộng available (BR-REV-06/07).
AC-7  Vai chỉ có inventory.view vào được REV-00 ở chế độ đọc; hành động ghi chỉ hiện với
      inventory.reversal.post. BE là nơi quyết định cuối cùng.
AC-8  Không có route/menu/permission/endpoint Stocktake/Variance/Adjustment nào trong
      deployment (REQ-SRS-037 / AC-SRS-037), có gate CI chứng minh.
AC-9  Responsive 390x844, 768x1024, 1366x768 và 1440x900 không tràn ngang ở REV-00,
      REV-01, chi tiết, confirm và trạng thái lỗi (NFR-SRS-006).
```

### 4.3. Dependency

```
GỠ: dependency tới hạng mục Stocktake.
GIỮ: WWHN-26 (Reversal decision record, formal approval pending) — quan hệ "relates to",
     KHÔNG phải "blocked by", vì nội dung đã được adopt trong SRS v1.12 qua WWHN-334.
```

---

## 5. Ai phải ký gì

| Vai | Ký cái gì | Không phải ký |
| --- | --- | --- |
| **BA Main / BAS** | Xác nhận chuỗi thẩm quyền §2 đúng và text §4 phản ánh đúng baseline | Không cần dựng lại tài liệu |
| **PM / PO** | Chấp thuận disposition Reversal-only và việc cập nhật Jira AC/dependency | Không cần phê duyệt `WWHN-25/26` ở đây |
| **Tech Lead** | Xác nhận ranh giới trích dẫn §3.4 và gate CI đã fail-closed | Không cần review lại code nghiệp vụ |

Bản ký sẵn theo vai: `docs/Task_docs_Jira/WWHN-242_SIGNOFF_COMMENTS.md`.
