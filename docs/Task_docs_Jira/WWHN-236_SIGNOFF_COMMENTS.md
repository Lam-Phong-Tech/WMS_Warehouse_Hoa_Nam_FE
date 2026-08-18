# WWHN-236 — bộ comment xác nhận (sign-off) cho Jira

Mỗi vai trò **một comment duy nhất**, phạm vi chỉ là _đọc + duyệt_, không phát sinh việc mới.
Định danh dùng chung cho mọi comment (điền exact SHA sau khi commit trên `m1`):

- Disposition: `DISP-STK-236` — BE `docs/decision-records/DISP-STK-236-APPLY-ADJUSTMENT-DEFERRED.md`
- Controlling source: `REQ-SRS-037` (Must) — `HN_SRS_FRD_v1.12_FULL.md`, adopt tại `WWHN-334`
- Evidence: BE `docs/evidence/WWHN-236/` (`SOURCE_REGISTER.json`, `NO_CODE_HANDOFF.md`,
  `CONTRACT_NEGATIVE_LOCK.json`, `QA_DISPOSITION_WWHN-238.md`, `SHA256SUMS`, `logs/`)
- Task doc: FE `docs/Task_docs_Jira/WWHN-236.md`
- BE SHA: `<điền sau khi commit>` · FE SHA: `<điền sau khi commit>` · branch `m1`

---

## 1. DEV — assignee (closure comment)

> **DEV CLOSURE — WWHN-236**
>
> Tôi xác nhận WWHN-236 đóng dưới dạng **NO-CODE / DEFERRED**, không phải implementation-complete.
>
> Nguyên nhân gốc của review 26/100: repo có ba nguồn authority mâu thuẫn về `apply-adjustment`
> (`REQ-SRS-037` cấm — ADOPTED; `DEC-STK-001` mô tả đầy đủ — PROPOSED; `WWHN-180` OpenAPI v1.7.0 khai
> path — PROPOSED), cộng BRD/Handoff v3.9 mà AC của WWHN-60 còn trích. AC yêu cầu implement đúng cái
> controlling source đang cấm, nên task không thể vừa PASS AC vừa PASS `REQ-SRS-037`.
>
> Đã làm: chốt `REQ-SRS-037` là authority duy nhất (`DISP-STK-236`); publish NO-CODE handoff; sinh
> source register đo lại được; bịt lỗ hổng `forbidden_path_fragments` (trước đây chỉ chặn `stocktake`
> nên `POST /api/v1/inventory/apply-adjustment` lọt hết mọi gate — nay thêm `adjustment`, `variance`);
> dựng gate BE 11 check + 7 test và gate FE 7 check + 4 test, đã chứng minh fail-closed bằng negative
> probe (exit 1) chứ không chỉ chạy happy path.
>
> Capability delta = **ZERO**: không route/controller/service/migration/permission/màn hình/report.
>
> Tôi **không** tự duyệt phạm vi: P1-01 thuộc BA+PM/PO, P1-03 thuộc BA+QA, P1-07 thuộc QA1+BA/PM.
> Disposition đang ở `PROPOSED`; guard vẫn active bất kể trạng thái phê duyệt.

---

## 2. BA Main / BA1

> **BA SIGN-OFF — WWHN-236 (DEV236-P1-01, P1-02, P1-03)**
>
> Tôi xác nhận đã đọc và duyệt:
>
> - **P1-01 — authority**: controlling source duy nhất cho phạm vi tồn kho/kiểm kê/sửa tồn là
>   `REQ-SRS-037` (Must, SRS/FRD v1.12, adopt tại WWHN-334). `WWHN-60` và `WWHN-236` =
>   **DEFERRED — NO CODE**. `DEC-STK-001` giữ nguyên `PROPOSED`, không phải authority ở v1.12.
> - **P1-02 — source register**: reliance vào BRD/Handoff **v3.9** được gỡ bỏ. AC nào của `WWHN-60`
>   còn yêu cầu Apply Adjustment thay đổi tồn thì **hết hiệu lực**; business action map sang Reversal
>   canonical (`inbound/outbound-documents/{id}/reverse`, `reversal-documents`). Tôi sẽ rebaseline AC
>   của WWHN-60 theo mapping này.
> - **P1-03 — dependency**: `HN-STK-002` = DEFERRED, không mở scope trong MVP. Nhánh
>   `WWHN-233`/`WWHN-235` thuộc `DISP-STK-233`, không đóng qua ticket này.
>
> Tôi đã đối chiếu danh sách ticket ở `DISP-STK-236` §4 trên Jira (DEV ghi rõ là không truy cập được
> Jira nên suy ra từ artifact repo).
>
> Không phát sinh yêu cầu nghiệp vụ mới. Không còn blocker thuộc BA cho task này.

---

## 3. PM/PO

> **PM/PO SIGN-OFF — WWHN-236 (DEV236-P1-01, P1-07)**
>
> Tôi xác nhận đã đọc và duyệt:
>
> - Phạm vi MVP v1.12 **không** bao gồm Stocktake/Variance/Apply Adjustment, theo `REQ-SRS-037`.
>   `WWHN-60` / `WWHN-236` = DEFERRED, `WWHN-238` = DEFERRED / N/A.
> - Điều kiện re-enable là bộ 4 điều kiện tại `DISP-STK-236` §2 (approved CR + `WWHN-25` GO +
>   rebaseline SRS + mở DEV). Không có đường tắt; `WWHN-25` vẫn là gate riêng, chưa duyệt.
> - **Hệ quả vận hành tôi chấp nhận**: không có kiểm kê vật lý trong MVP. Lệch tồn chỉ phát hiện qua
>   reconciliation report và chỉ sửa bằng Reversal theo đúng chứng từ gốc. Lệch do nguyên nhân vật lý
>   không gắn chứng từ (mất/hỏng/đếm sai) chỉ được ghi nhận bằng `reconciliation_incidents`, không có
>   đường đưa số tồn về khớp thực tế.
>
> Không còn blocker thuộc PM/PO cho task này.

---

## 4. BAS

> **BAS SIGN-OFF — WWHN-236 (DEV236-P1-02)**
>
> Tôi xác nhận đã đọc và duyệt source register hiện hành:
>
> - Nguồn controlling: `REQ-SRS-037` / SRS-FRD v1.12; xác nhận chéo bởi ERD §0.1, Techstack Dev Guide
>   và Wireframe MVP v3.20/v1.12 (zero màn hình kiểm kê).
> - Nguồn **historical**, không được trích làm controlling contract: `WWHN-180-posting-openapi`,
>   `WWHN-150-scan-openapi` (enum scan context `STOCKTAKE`, đã lệch runtime), Changelog BE1 v1.0.1,
>   `DEC-STK-001` (PROPOSED), BRD/Handoff v3.9 (superseded).
> - Digest **không** chép tay vào tài liệu mà sinh bằng `scripts/build-wwhn236-source-register.mjs`
>   ra `docs/evidence/WWHN-236/SOURCE_REGISTER.json`. Tôi đồng ý cách này vì hash chép tay mục nhanh
>   (ERD đã đổi digest ngay trong lúc soạn tài liệu).
>
> Traceability `SRC-008 → REQ-SRS-037 → BR-NOSTK-01..03 → AC-SRS-037 → TC-SRS-037` giữ nguyên.

---

## 5. Tech Lead

> **TECH LEAD SIGN-OFF — WWHN-236 (DEV236-P1-04, P1-05, P1-06)**
>
> Tôi xác nhận đã đọc và duyệt:
>
> - **P1-04 — handoff**: `docs/evidence/WWHN-236/NO_CODE_HANDOFF.md` là **NO-CODE / DEFERRED**.
>   WWHN-236 không được đóng như implementation-complete. Delta code chỉ gồm hàng rào, capability = 0.
> - **P1-05 — contract**: vì DEFERRED, nghĩa vụ contract là **phủ định** và đã được khoá máy tại
>   `CONTRACT_NEGATIVE_LOCK.json`: runtime OpenAPI, permission matrix, route source và baseline
>   contract đều zero `apply-adjustment`/`stocktake`/`variance`. Artifact historical chỉ được
>   supersede bằng decision record, không sửa nội dung.
> - **P1-06 — không có đường ghi tồn thứ hai**: `chk_stock_movement_type_current` chỉ cho
>   `OPENING/RECEIPT/ISSUE/COMPONENT_ISSUE/REVERSAL` nên `ADJUST_IN`/`ADJUST_OUT` bị PostgreSQL từ
>   chối; 4 bảng `stocktake_*` vắng mặt ở schema cuối; correction path duy nhất là Reversal
>   append-only đã có lock/CAS/idempotency riêng.
> - Tôi chấp nhận việc bổ sung `adjustment` + `variance` vào `forbidden_path_fragments` và ranh giới
>   sở hữu artifact với nhánh `WWHN-233` (`DISP-STK-236` §4 ↔ `DISP-STK-233` §12).
>
> Yêu cầu duy nhất khi merge: pin exact BE/FE SHA vào evidence trước khi chuyển Done.

---

## 6. QA1

> **QA1 SIGN-OFF — WWHN-236 (DEV236-P1-03, P1-06, P1-07)**
>
> Tôi xác nhận đã đọc và duyệt:
>
> - **P1-07 — `WWHN-238` = DEFERRED / N/A cho MVP v1.12**, không phải `Blocked`, không phải `Pending`.
>   Không có build nào để test exact-build vì capability đã bị `REQ-SRS-037` loại khỏi phạm vi.
> - Phạm vi QA của WWHN-236 ở v1.12 là **negative gate** 6 mục tại
>   `docs/evidence/WWHN-236/QA_DISPOSITION_WWHN-238.md` §2 — đã chạy và pass: gate BE 11/11, test BE
>   7/7 (sqlite), gate FE 7/7, test FE 4/4, negative probe fail-closed (exit 1), ba route Reversal vẫn
>   sống, và constraint PostgreSQL chặn `ADJUST_IN` được chứng minh bằng truy vấn trực tiếp
>   (`logs/pg-direct-constraint-probe.log`). Tôi ghi nhận giới hạn: nhánh pgsql của phpunit không chạy
>   được do lỗi migrate fresh có sẵn (`hn_erd_mirror_pv_industries`), ngoài phạm vi WWHN-236.
> - Danh sách test case dương (lock/CAS, replay/409, atomic, append-only, stale reject, no-double-effect,
>   reconcile mismatch=0) được **bảo lưu nguyên vẹn** cho lần re-enable, không bị coi là đã đóng.
> - **P1-03**: dependency `HN-STK-002` DEFERRED; QA gate của nhánh count/recount là `WWHN-235` thuộc
>   `DISP-STK-233`, không đóng qua ticket này.
>
> Không còn blocker thuộc QA1 cho phạm vi WWHN-236.

---

## Ghi chú khi post lên Jira

- Post đúng **một** comment cho mỗi vai trò ở trên; không tách nhỏ theo từng register item.
- Điền exact BE/FE SHA vào phần định danh đầu file trước khi post.
- `WWHN-238` cần được **chuyển trạng thái** sang DEFERRED / N/A, không chỉ comment.
- `WWHN-25` (DEC-STK-001) giữ nguyên trạng thái mở — không đóng gián tiếp qua task này.
