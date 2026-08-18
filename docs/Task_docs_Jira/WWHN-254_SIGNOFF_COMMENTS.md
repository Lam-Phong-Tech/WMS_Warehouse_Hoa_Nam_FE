# WWHN-254 — bộ comment xác nhận (sign-off) cho Jira

Mỗi vai trò **một comment duy nhất**, phạm vi chỉ là *đọc + duyệt*, không phát sinh việc
mới. Định danh dùng chung cho mọi comment:

- BE candidate SHA: `c855851b37920237d110f7dffe5dbbad509aebce` (branch `m1`)
- FE candidate SHA: `a2da7ab41b407850c1273cdfd83a72611130caf8` (branch `m1`)
- Evidence pack BE: `docs/evidence/WWHN-254/README.md`
- Task doc: `docs/Task_docs_Jira/WWHN-254.md`
- Gate: `flow06-exact-sha.yml`, chạy lại tại candidate bằng
  `gh workflow run flow06-exact-sha.yml --ref m1 -f candidate_sha=c855851…`

---

## 1. DEV (assignee) — comment đóng phần source

> **DEV CLOSURE — WWHN-254**
>
> Tôi xác nhận đã khắc phục tại source theo register 61/100, trên nhánh `m1`, BE SHA
> `c855851b37920237d110f7dffe5dbbad509aebce` / FE SHA `a2da7ab41b407850c1273cdfd83a72611130caf8`:
>
> - **DEV254-P1-02**: run 32041944243 đỏ ở bước setup vì codeload trả 429/503 khi tải
>   action `setup-php` — flake hạ tầng, không phải code. Gate nay có `workflow_dispatch`
>   nhận `candidate_sha`, checkout đúng SHA đó và fail nếu lệch; retry setup 3 lần; path
>   filter mở rộng sang surface báo cáo tích hợp (trước đây `OperationalReportController`,
>   `config/l5-swagger.php`, `routes` nằm ngoài filter nên code báo cáo đổi mà gate không
>   chạy lại); manifest ghi `requested/resolved SHA` + `openapi_sha256` + `postman_set_sha256`.
> - **DEV254-P1-03**: tìm ra defect thật — data-scope kho chỉ được áp cho
>   `/reports/dashboard-quick`, mọi `/reports/*` còn lại để người dùng bị giới hạn kho đọc
>   và export dữ liệu toàn hệ thống (vi phạm AC-SRS-032, BR-EXP-01..05). Đã áp scope chung
>   cho inventory-balance, XNT, document-history, outbound-by-agency, movement-trace;
>   scope giải trước cache và nằm trong cache key; payload trả `data_scope` +
>   `scope_warehouse_ids`; kho ngoài scope trả 403 ACCESS_DENIED kể cả ở route export.
> - **DEV254-P1-01 (phần máy kiểm được)**: guard REQ-SRS-037 mở rộng sang contract
>   artifact bàn giao; đã gỡ 2 artifact Stocktake WWHN-131 và sửa request scan gửi
>   `context=STOCKTAKE` (runtime trả 422) về `INVENTORY`.
> - Chạy thật: 109/109 test luồng báo cáo + scope, Pint pass, FE typecheck + 7/7 vitest.
>
> Tôi **không** tự ký các mục thuộc vai trò khác: disposition BA của WWHN-67 (P1-01),
> QA1 WWHN-255 (P1-03), ký nhận contract WWHN-256/257/68 (P1-04).
>
> Disposition: **BE SOURCE REMEDIATED / BA + QA GATES PENDING**.

---

## 2. BA Main / BAS

> **BA SIGN-OFF — WWHN-254 (DEV254-P1-01, P2-01)**
>
> Tôi xác nhận đã đọc và duyệt phần thẩm quyền nghiệp vụ:
>
> - Baseline hiệu lực của báo cáo MVP là **SRS/FRD v1.12** (adopt tại WWHN-334):
>   `REQ-SRS-031` (AC: "công thức/filter đúng; **không có stocktake report**") và
>   `REQ-SRS-037` (AC: deployment v1.12 không chứa capability legacy).
> - `DEC-NO-STOCKTAKE-001` **không** được trích như approved standalone Decision ID —
>   SRS ghi rõ "formal Decision: WWHN-25 only" và WWHN-25 vẫn đang mở.
> - Tôi xác nhận việc gỡ artifact Stocktake khỏi bộ contract bàn giao là **đúng baseline**,
>   không làm mất phạm vi đã cam kết.
> - Yêu cầu Stocktake report còn nằm ở AC/dependency `HN-STK-003` của **WWHN-67** là
>   **tồn dư của baseline cũ**; tôi nhận việc cập nhật/pin lại AC đó theo baseline hiệu lực
>   trên. Nếu Stocktake thật sự quay lại scope thì phải có Decision/CR được duyệt trước.
>
> Không phát sinh yêu cầu nghiệp vụ mới từ WWHN-254.

---

## 3. PM/PO

> **PM/PO SIGN-OFF — WWHN-254**
>
> Tôi xác nhận đã đọc và duyệt:
>
> - Candidate được pin là BE `c855851b37920237d110f7dffe5dbbad509aebce` / FE
>   `a2da7ab41b407850c1273cdfd83a72611130caf8` trên `m1`; mọi bằng chứng downstream phải
>   thuộc đúng cặp SHA này.
> - Disposition của WWHN-254 là **BE source đã khắc phục, gate BA/QA còn mở** — không nâng
>   lên VERIFIED khi WWHN-255/256/257 chưa có kết quả trên candidate đã pin.
> - **DEV254-P2-01**: phần "Vai trò và phối hợp / Source & Traceability" trong Description
>   ghi Duy Khánh / BE2 / HN-BE-02 là **historical placeholder** của lần giao việc trước;
>   owner hiện hành là assignee live và title đã đổi `[BE]`. Ghi nhận như vậy để audit không
>   đọc nhầm, không truy ngược trách nhiệm sang người cũ.
> - WWHN-67 giữ nguyên trạng thái mở, không đóng gián tiếp qua task này.

---

## 4. Tech Lead

> **TECH LEAD SIGN-OFF — WWHN-254 (DEV254-P1-02, P1-04)**
>
> Tôi xác nhận đã đọc và duyệt:
>
> - Kết luận nguyên nhân run 32041944243: lỗi tải action `setup-php` (429/503), là flake hạ
>   tầng — **không** được ghi nhận như gate đỏ do code.
> - Cơ chế exact-SHA nay hợp lệ: `workflow_dispatch` nhận `candidate_sha`, job tự so
>   `git rev-parse HEAD` với SHA yêu cầu và fail nếu lệch; artifact `manifest.txt` mang
>   `requested_sha`, `resolved_sha`, `run_id`, `openapi_sha256`, `postman_set_sha256` kèm
>   `SHA256SUMS`. Đây là bộ định danh tôi khoá cho contract.
> - Path filter đã bao phủ surface báo cáo tích hợp; lỗ hổng "code báo cáo đổi mà gate không
>   chạy lại" đã được bịt.
> - Phiên bản contract khoá cho WWHN-254 là OpenAPI + bộ Postman tại đúng BE SHA trên,
>   hash nằm trong manifest của run gate. FE/QA chỉ nghiệm thu theo bản hash này.
>
> Không còn blocker kỹ thuật thuộc Tech Lead cho WWHN-254.

---

## 5. QA1 (WWHN-255)

> **QA1 ACK — WWHN-254 / WWHN-255**
>
> Tôi xác nhận đã nhận đủ đầu vào để bắt đầu test độc lập, không còn Blocked:
>
> - Candidate đã pin: BE `c855851b37920237d110f7dffe5dbbad509aebce` (branch `m1`).
> - Runbook + ánh xạ checkpoint ↔ test tại `docs/evidence/WWHN-254/README.md` mục 4, phủ
>   200/403 (cả permission lẫn data-scope), filter/date/timezone, công thức XNT,
>   Balance↔Movement MATCH/MISMATCH, import error rows, export scope/audit/tên file,
>   warranty privacy, agency không phải bucket tồn.
> - Tôi ghi nhận thay đổi hành vi cần test lại: báo cáo nay bị cắt theo warehouse
>   data-scope và trả `data_scope` / `scope_warehouse_ids`; kho ngoài scope trả 403.
> - Tôi ghi nhận cảnh báo: full suite BE đang có 14 đỏ **ngoài luồng báo cáo** do phiên làm
>   việc song song trên `m1`; tôi sẽ chạy trên candidate đã pin, không chạy trên HEAD trôi.
>
> Việc còn lại của tôi là thực thi và đính raw evidence — không phát sinh yêu cầu cho DEV.

---

## 6. QA2 (WWHN-256) + FE1 (WWHN-68) — ký nhận contract

> **CONSUMER ACCEPTANCE — WWHN-254 (DEV254-P1-04)**
>
> Chúng tôi xác nhận đã nhận và đọc contract của báo cáo tích hợp tại BE SHA
> `c855851b37920237d110f7dffe5dbbad509aebce`, phiên bản OpenAPI/Postman theo hash trong
> manifest của run gate `flow06-exact-sha`:
>
> - Field set / filter / mã lỗi của 8 báo cáo MVP và `POST /reports/export` khớp Annex C.
> - Trường mới `data_scope` (`GLOBAL｜WAREHOUSE_SCOPED`) và `scope_warehouse_ids` đã được
>   FE tiêu thụ tại FE SHA `a2da7ab41b407850c1273cdfd83a72611130caf8` (banner cảnh báo phạm
>   vi kho trên màn Báo cáo), nên số liệu một phần không bị đọc nhầm thành tổng toàn hệ thống.
> - Hợp đồng lỗi cho vi phạm phạm vi là `403 ACCESS_DENIED`, đồng nhất với
>   `/inventory/balances` và `/stock-movements` — FE chỉ phải xử lý một contract duy nhất.
>
> Không còn yêu cầu bổ sung contract từ phía consumer cho WWHN-254.
