# WWHN-247 — Comment xác nhận / sign-off theo vai trò

Nguyên tắc: **mỗi vai trò chỉ comment 1 lần**, nói rõ mình xác nhận cái gì, không ký thay vai
trò khác. Các mục còn phải **làm việc thật** nằm ở §2 và **không được ký** ở đây.

Candidate đang xác nhận:

- FE `WMS_Warehouse_Hoa_Nam_FE` `m1` — `59c4b16883d64081c8cf150e0df74f90b1d5a8fc`
- BE `WMS_Warehouse_Hoa_Nam_BE` `m1` — `08abf3f95f9e83be3bc9efe1258fd5f3ea5baa9e`

Chỉ dán khi `npm run verify:wwhn-247` PASS tại đúng cặp SHA trên. Không dùng lại SHA của task khác.

---

## 1. Các comment chỉ cần xác nhận (đọc + duyệt)

### 1.1. FE1 — Frontend

> **[FE1] Xác nhận đóng phần FE của WWHN-247 tại `59c4b16`.**
> Tôi đã đọc và duyệt, xác nhận các mục sau đã đóng trên nhánh `m1`:
>
> - **P1 raw PII rendering**: PII bảo hành nay fail-closed ở **hai** lớp — tầng render WAR-01/WAR-03 qua `warrantyPiiText()`, và tầng service `normalizeWarrantyCase()` qua `resolveWarrantyPii()`. Lớp service là cửa duy nhất nên cache React Query, prefill form hiệu chỉnh và mọi consumer sau này đều chỉ nhận giá trị đã mask, kể cả khi payload chứa PII thô. Trường `pii_masked` đưa vào `WarrantyCase` để UI đọc trạng thái mask từ dữ liệu thay vì tự suy từ danh sách quyền client.
> - **P1 status enum**: `WARRANTY_NEXT_STATUS` khớp 1-1 ma trận DEC-WAR-STATE-001, đủ cạnh `CHECKING → COMPLETED`; form chặn sẵn `confirmed_defect` / `note` / `cancel_reason` nên không còn vòng 422 vô ích.
> - **P2 endpoint/skeleton/mojibake**: đã có gate giữ, không chỉ kiểm bằng mắt — `scripts/verify-wwhn-247-closure.mjs` chặn alias legacy `/component-issue-documents`, chặn `http.patch` cho transition, đòi skeleton/empty/error + scan-focus của SCR-WAR-01, và quét mojibake bằng bộ luật đã tự test không báo động giả trên tiếng Việt viết hoa.
>
> QA tại đúng SHA: FE phạm vi bảo hành **8 file / 59 test PASS**; `verify:wwhn-247` **PASS**.
> Tôi **không** xác nhận đây là UAT: `warranty-flow04-evidence.spec.ts` chạy với API mock, không thay QA2 và không chứng minh runtime thật.

### 1.2. BE1 — Backend

> **[BE1] Xác nhận contract và enforcement phía backend cho WWHN-247 tại `08abf3f`.**
> Tôi đã đọc và duyệt:
>
> - **`pii_masked` ở bề mặt đọc danh sách**: `GET /warranty-cases` trước đây mask giá trị nhưng không trả cờ nào, trong khi detail có — client buộc phải tự đoán. Nay `tablePage()` khai `pii_masked` cho mọi bảng có cột PII, kể cả khi actor có quyền (`false`), nên hợp đồng luôn tường minh. Backend vẫn là authority: vẫn mask khi đọc và vẫn `403 PERMISSION_DENIED` khi ghi PII thiếu `warranty.pii.view`.
> - **Một state machine duy nhất**: `CurrentBaselineOperationsController::WARRANTY_TRANSITIONS` (handler **không được route nào trỏ tới**) từng giữ ma trận cũ; nay trùng khít `CurrentBaselineWarrantyController::TRANSITIONS` và được `Wwhn247WarrantyStateMachineParityTest` khoá.
> - **Hai fixture cũ đã sửa đúng nguyên nhân**: chúng chuyển `CHECKING → REPAIRING` không kèm `confirmed_defect` — hợp lệ trước khi guard DEC-WAR-STATE-001 tồn tại, nay 422. Guard được giữ nguyên, chỉ fixture được sửa.
>
> QA tại đúng SHA: `--filter "Warranty|Wwhn244|Wwhn247"` → **58 test / 54 pass / 3 skip / 1 fail**. Fail duy nhất là `CurrentBaselineFlowContractSourceTest::test_warranty_label_and_pv_rules_are_pinned`, đỏ ở hai chuỗi PV catalog vẫn tồn tại nguyên vẹn tại HEAD `08abf3f` và chỉ bị gỡ trong thay đổi **chưa commit** của phiên WWHN-330 song song — không thuộc luồng 04 và không nằm trong commit này.

### 1.3. BA Main / BAS

> **[BA] Xác nhận ma trận trạng thái bảo hành bản cuối và cách FE hiểu §13.8.**
> Tôi đã đọc và duyệt `docs/evidence/WWHN-247/STATUS_MATRIX.md`:
>
> - **Tập trạng thái**: đúng 6 giá trị §6 (`RECEIVED / CHECKING / REPAIRING / COMPLETED / RETURNED / CANCELLED`). `OPEN / PROCESSING / WAITING_PARTS / READY / RETURNED_TO_CUSTOMER / CLOSED` chỉ là alias đọc dữ liệu cũ, bị quy về canonical trước mọi logic, không được có mặt trong state machine.
> - **Cạnh `CHECKING → COMPLETED` là hợp lệ** theo DEC-WAR-STATE-001: case kiểm tra xong kết luận không cần sửa không bị ép đi vòng qua `REPAIRING` giả — nếu ép, metric turnaround "đã sửa chữa" của RPT-WAR-01 bị thổi phồng.
> - **RETURNED/CANCELLED là terminal tuyệt đối**: mọi update trả `409 STATE_CONFLICT`, kể cả request không kèm `status`.
> - **Bằng chứng bắt buộc**: `confirmed_defect` khi rời `CHECKING`; `note` khi `COMPLETED` và khi `RETURNED` (biên bản bàn giao — ERD §45 không có cột receiver riêng); `cancel_reason` khi huỷ.
> - **§13.8**: mask mặc định `N*** H***` / `******9922` / địa chỉ chỉ còn địa giới cuối; đầy đủ chỉ với `warranty.pii.view`; mask phải đi kèm chặn tìm kiếm LIKE trên cột PII.
>
> Đây là **một verdict duy nhất**: bảng §2/§3 của `STATUS_MATRIX.md` là bản cuối. Tôi **không** ký thay QA2 và không ký phần bằng chứng vận hành.

### 1.4. Tech Lead

> **[Tech Lead] Xác nhận nhánh, định danh bằng chứng và ranh giới kiến trúc của WWHN-247.**
> Tôi đã đọc và duyệt:
>
> - Nhánh canonical là **`m1`**; không tạo nhánh riêng cho task này.
> - Candidate là cặp FE `59c4b16` / BE `08abf3f`. FE `59c4b16` xây tiếp trên `be18bec` (WWHN-244 — ma trận trạng thái + mask tầng render); hai commit **không chồng lấn**: WWHN-244 đóng tầng render, WWHN-247 đóng tầng service và hợp đồng `pii_masked`.
> - **Dependency HN-WAR-001 đã chuyển từ lời nói sang bằng chứng**: verifier đọc thẳng `routes/api.php` của BE và đối chiếu **từng** trong 12 operation Annex C mà FE tiêu thụ, cùng permission bề mặt đọc/ghi. Thiếu repo BE thì gate **fail**, trừ khi chạy `--fe-only` — khi đó dependency ghi `SKIPPED`, không bao giờ ghi PASS. Điểm 66/100 của WWHN-244 là hạng mục của task đó.
> - FE chỉ là **lớp phòng thủ thứ hai**; backend vẫn là biên authorization, data-scope và masking. WWHN-247 không thay phân quyền backend bằng kiểm tra phía client.
> - Handler warranty chết trong `CurrentBaselineOperationsController` **chưa gỡ** — commit này chỉ đồng bộ hằng số; gỡ hẳn cần CR riêng vì đụng test pin nguồn.

---

## 2. Các mục **không** ký ở đây — còn phải làm việc thật

| Mục | Vì sao không ký được | Ai làm |
| --- | -------------------- | ------ |
| QA2 / UAT luồng 04 | Bằng chứng hiện có là unit + e2e mock. Chuỗi runtime thật cần `E2E_LIVE_RUNTIME=1` với BE + DB thật (`warranty-flow04-live-runtime.spec.ts`) | QA2 |
| Chữ ký BA lên `STATUS_MATRIX.md` §5 | Là hành động ký thật trên tài liệu, không phải mục kỹ thuật | BA Main |
| `test_warranty_label_and_pv_rules_are_pinned` (BE) | Đỏ do thay đổi PV catalog **chưa commit** của WWHN-330 trên cùng worktree | Chủ WWHN-330 |
| `TraceModal.test.tsx` (FE, 2 fail) | Đỏ do refactor `shared/components` ui-state **chưa commit** của phiên song song | Chủ thay đổi ui-state |
| Điểm review 66/100 của WWHN-244 | Hạng mục chấm điểm của chính task đó | Chủ WWHN-244 |
