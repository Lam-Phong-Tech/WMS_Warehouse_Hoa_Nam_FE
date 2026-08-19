# WWHN-247 — Ma trận trạng thái bảo hành: SRS ↔ BE ↔ FE

**Phiên bản tài liệu: v1.1 — 19/08/2026.** (v1.0 = 18/08/2026 tại `c6bab76`. v1.1 KHÔNG đổi
bất kỳ nội dung nghiệp vụ nào của §1–§4 — chỉ cập nhật SHA chứng thực ở §5 theo candidate R2
và ghi chú đối tượng sign-off. Đây là phiên bản BA Main tham chiếu khi sign-off trên Jira —
FE247-P2-02.)

Đây là **bản đối chiếu cuối** cho red flag *"Status enum mismatch — đóng phần FE, final matrix
còn chờ BE/BA"*. Trước đây mỗi tầng tự khai một ma trận và tự test chính mình, nên khi một
tầng đổi thì không tầng nào đỏ. Bảng dưới đây là nguồn chốt; ba nơi phải trùng khít và đã có
gate tự động canh.

Nguồn quyết định: **SRS v1.12 §6 STATE MODEL** + **DEC-WAR-STATE-001 (WWHN-244)**.

## 1. Tập trạng thái — đúng 6, không hơn

| Trạng thái  | Nhãn UI (vi)        | Ý nghĩa nghiệp vụ                              |
| ----------- | ------------------- | ---------------------------------------------- |
| `RECEIVED`  | Đã tiếp nhận        | Case vừa mở, máy đã vào kho bảo hành           |
| `CHECKING`  | Đang kiểm tra       | Kỹ thuật đang chẩn đoán                        |
| `REPAIRING` | Đang sửa chữa       | Đã kết luận và đang xử lý                      |
| `COMPLETED` | Đã hoàn tất xử lý   | Xong việc, chờ trả khách                       |
| `RETURNED`  | Đã trả khách        | **Terminal** — đã bàn giao                     |
| `CANCELLED` | Đã hủy              | **Terminal** — dừng case, có lý do bắt buộc    |

`OPEN / PROCESSING / WAITING_PARTS / READY / RETURNED_TO_CUSTOMER / CLOSED` **không** thuộc
§6. Chúng chỉ tồn tại ở FE như alias đọc dữ liệu snapshot cũ và bị `canonicalStatus()` quy về
sáu giá trị trên **trước khi** chạm tới bất kỳ logic nào. Không alias nào được xuất hiện trong
state machine — khoá bằng `Wwhn247WarrantyStateMachineParityTest::test_no_legacy_status_alias_leaks_into_the_matrix`.

## 2. Ma trận transition đã chốt

| Từ \ Đến      | RECEIVED | CHECKING | REPAIRING | COMPLETED | RETURNED | CANCELLED |
| ------------- | :------: | :------: | :-------: | :-------: | :------: | :-------: |
| **RECEIVED**  |    —     |    ✅    |     ✖     |     ✖     |    ✖     |    ✅     |
| **CHECKING**  |    ✖     |    —     |    ✅     |  **✅**   |    ✖     |    ✅     |
| **REPAIRING** |    ✖     |    ✖     |     —     |    ✅     |    ✖     |    ✅     |
| **COMPLETED** |    ✖     |    ✖     |     ✖     |     —     |    ✅     |    ✅     |
| **RETURNED**  |    ✖     |    ✖     |     ✖     |     ✖     |    —     |     ✖     |
| **CANCELLED** |    ✖     |    ✖     |     ✖     |     ✖     |    ✖     |     —     |

✅ hợp lệ · ✖ trả `409 INVALID_WARRANTY_TRANSITION`, không đổi state/movement.

**`CHECKING → COMPLETED` (in đậm) là cạnh dễ mất nhất.** Case kiểm tra xong kết luận *không cần
sửa* mà bị ép đi vòng qua `REPAIRING` giả sẽ làm metric turnaround "đã sửa chữa" của RPT-WAR-01
phồng lên và `REPAIRING` mất nghĩa. FE đã từng thiếu đúng cạnh này.

**RETURNED/CANCELLED là terminal tuyệt đối**: mọi update đều `409 STATE_CONFLICT`, kể cả request
không kèm `status` (nếu chỉ chặn transition thì vẫn ghi được `confirmed_defect`/PII lên case đã đóng).

## 3. Bằng chứng bắt buộc kèm theo transition (DEC-WAR-STATE-001)

| Điều kiện                                | Field bắt buộc     | Mã lỗi khi thiếu                      |
| ---------------------------------------- | ------------------ | ------------------------------------- |
| Rời `CHECKING` → `REPAIRING`/`COMPLETED` | `confirmed_defect` | `422 WARRANTY_DIAGNOSIS_REQUIRED`     |
| → `COMPLETED`                            | `note`             | `422 WARRANTY_TREATMENT_RESULT_REQUIRED` |
| → `RETURNED`                             | `note`             | `422 WARRANTY_HANDOVER_NOTE_REQUIRED` |
| → `CANCELLED`                            | `cancel_reason`    | `422 CANCEL_REASON_REQUIRED`          |

`confirmed_defect` được coi là đã có nếu đã lưu ở lần cập nhật trước — không bắt nhập lại.
ERD §45 không có cột receiver riêng: biên bản bàn giao là `warranty_event` `RETURN` với `note`
bắt buộc + `created_by` = actor.

FE chặn ngay trên form (`WARRANTY_DIAGNOSIS_REQUIRED_TARGETS`, `WARRANTY_NOTE_REQUIRED_LABELS`)
để người dùng không phải ăn một vòng 422 mới biết thiếu gì.

## 4. Ba nơi khai báo và gate canh chúng

| Nơi khai báo                                                            | Vai trò                            | Gate |
| ----------------------------------------------------------------------- | ---------------------------------- | ---- |
| `CurrentBaselineWarrantyController::TRANSITIONS`                        | **Authority** — route thật đi qua đây | `Wwhn244WarrantyStateMatrixTest` (chạy thật mọi cặp from→to), `Wwhn247WarrantyStateMachineParityTest` |
| `CurrentBaselineOperationsController::WARRANTY_TRANSITIONS`             | Bản sao ở handler **không được route** | `Wwhn247WarrantyStateMachineParityTest::test_duplicate_matrix_matches_the_routed_one` |
| `src/modules/warranty/constants.ts` → `WARRANTY_NEXT_STATUS`            | Dropdown "Cập nhật trạng thái" (WAR-03) | `src/test/wwhn-247-warranty-closure.test.ts`, `scripts/verify-wwhn-247-closure.mjs` (đọc chéo file BE) |

Bản sao ở `CurrentBaselineOperationsController` trước đây giữ ma trận cũ
(`CHECKING → [REPAIRING, CANCELLED]`, `COMPLETED → [RETURNED]`). Handler đó không được route nào
trỏ tới nên không lộ ra hành vi, nhưng nó chính là cái bẫy khiến lần sửa sau "sửa đúng file sai".
Đã đưa về trùng khít và khoá bằng test.

`npm run verify:wwhn-247` đọc thẳng file PHP của BE và so từng cạnh với FE — hai bên trôi khỏi
nhau là gate đỏ ngay, không cần chờ ai phát hiện bằng mắt.

## 5. Trạng thái phê duyệt

| Bên | Nội dung cần duyệt                                                     | Trạng thái |
| --- | ---------------------------------------------------------------------- | ---------- |
| BE  | `TRANSITIONS` = bảng §2, guard bằng chứng = bảng §3                     | Đã khớp code + test tại `08abf3f95f9e83be3bc9efe1258fd5f3ea5baa9e`; **re-verify R2 19/08/2026** tại BE HEAD `4a6965b5d432947c497a2c3370a62a17907251a3` (commit cuối chạm artifact: `0142b49` — chỉ refactor import/bản sao unrouted, ma trận không đổi; `Wwhn247WarrantyStateMachineParityTest` PASS) |
| FE  | `WARRANTY_NEXT_STATUS` + form guard = bảng §2/§3                        | Đã khớp code + test tại `59c4b16883d64081c8cf150e0df74f90b1d5a8fc`; **re-verify R2 19/08/2026** tại FE HEAD `ebdb061098bea9426c2949e5c50b53ba8a09289f` (candidate warranty-scope `c9f52df44638558cc3c2e08807e05a9d05f689c8`; vitest 59/59 + QA2 16/16 + `verify:wwhn-247` PASS) |
| BA  | Xác nhận bảng §2/§3 là bản cuối của SRS §6 + DEC-WAR-STATE-001          | **Sign-off thực hiện bằng comment trên Jira** (WWHN-247), tham chiếu đích danh "STATUS_MATRIX.md v1.1" — không dùng draft text trong repo làm chữ ký (FE247-P2-02) |

Ba nơi khai báo đã trùng khít và có gate tự động; phần còn lại của "final matrix" chỉ là chữ ký
BA lên chính bảng §2/§3 (comment Jira tham chiếu v1.1) — không còn hạng mục kỹ thuật nào đang mở.
