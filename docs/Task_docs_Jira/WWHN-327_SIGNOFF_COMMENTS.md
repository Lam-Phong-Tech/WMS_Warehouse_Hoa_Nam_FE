# WWHN-327 — Comment xác nhận / sign-off theo vai trò

Nguyên tắc: **mỗi vai trò chỉ comment 1 lần**, nói rõ mình xác nhận cái gì, không ký thay
vai trò khác. Các mục còn phải **làm việc thật** (không phải đọc + duyệt) nằm ở §2 và
**không được ký** ở đây.

Candidate đang xác nhận (**R4 — supersede cặp cũ theo
`docs/evidence/WWHN-327/WWHN-328_CONSUMER_PIN.json`**):

- FE `WMS_Warehouse_Hoa_Nam_FE` `m1` — `5a0cfda4ccdacfa4aac324ed7c16bda513c3c8f3`
- BE `WMS_Warehouse_Hoa_Nam_BE` `m1` — `b610b1ff191f8c1f2cce3c24571de850f946d690`
- KPI matrix **v1.2** (nguồn: BE `docs/evidence/WWHN-328/KPI_MATRIX.md`)

Cặp cũ `99dff42`/`6db0965` (matrix v1.1) và BE trung gian `127c573` đã bị supersede;
mọi template bên dưới khi dán phải thay bằng cặp R4 ở trên. `127c573` là commit gộp
"gỡ cờ 13" của phiên song song, KHÔNG phải commit cuối chạm bề mặt WWHN-328.

Về run CI: quota GitHub Actions đã cạn (3.000/3.000 phút). Không dispatch workflow
mới; evidence closure dùng kết quả gate chạy local tại exact SHA (ghi trong
`docs/evidence/WWHN-327/` và `docs/evidence/WWHN-328/` phía BE) với disposition
nêu rõ trong comment.

---

## 1. Các comment chỉ cần xác nhận (đọc + duyệt)

### 1.1. FE1 — Frontend

> **[FE1] Xác nhận đóng phần FE của WWHN-327 tại `99dff42`.**
> Tôi đã đọc và duyệt, xác nhận các mục FE sau đã đóng trên nhánh `m1`:
>
> - **Ngoại lệ phạm vi bảo hành (P1)**: màn Dashboard nay khai rõ `warranty_cases_by_status` luôn là số liệu toàn hệ thống khi `data_scope=WAREHOUSE_SCOPED`; trước đó người dùng bị giới hạn kho đọc "Giới hạn N kho" rồi quy nhầm số ca bảo hành về kho của mình.
> - **Gate closure riêng cho task (P1)**: đã có `scripts/verify-wwhn-327-closure.mjs`, `e2e/wwhn-327-dashboard-kpi.spec.ts`, `.github/workflows/wwhn-327-fe-closure.yml`, `docs/Task_docs_Jira/WWHN-327.md`, `docs/evidence/WWHN-327/`; không mượn artifact của task khác.
> - **Mã permission dashboard (P2)**: `WMS_PERMISSION_CATALOG.DASHBOARD_VIEW` trỏ về `report.view`; mã `report.dashboard.view` không tồn tại trong `AuthDatabaseSeeder` và đã bị verifier chặn quay lại.
> - **Đọc số đúng contract**: tổng cảnh báo đối soát lấy từ `reconciliation_warning_count`, không từ độ dài mảng mẫu bị BE cắt trần 50 dòng; `reversal_net` giữ dấu; `available_qty` là snapshot không lọc kỳ.
>
> Kết quả cổng FE tại đúng SHA: `verify:wwhn-327` PASS, `test:e2e:wwhn-327` **9/9 PASS** (3 viewport bắt buộc + data-scope + empty + RBAC + 403 + 422), `vitest` **510 PASS**, `format:check` và `typecheck` PASS.
> Tôi **không** xác nhận đây là UAT: bằng chứng FE là controlled/mock, không thay QA2 (WWHN-329) và không chứng minh backend thực sự cắt data-scope.

### 1.2. BA Main / BAS

> **[BA] Xác nhận KPI matrix v1.1 và cách FE hiểu baseline của WWHN-327.**
> Tôi đã đọc và duyệt, xác nhận:
>
> - **Data scope**: dashboard chịu đúng warehouse data-scope của người gọi, cùng nguồn `scope_ref` với `/inventory/balances` và `/stock-movements`. `GLOBAL` = không giới hạn kho; `WAREHOUSE_SCOPED` = đã cắt theo `scope_warehouse_ids`.
> - **Ngoại lệ có chủ đích**: `warranty_cases_by_status` **luôn GLOBAL** vì ERD `warranty_case` không có `warehouse_id`; ngoại lệ này phải hiển thị trên màn hình, và FE đã làm.
> - **Công thức K0–K10, timezone `Asia/Ho_Chi_Minh`, kỳ mặc định 31 ngày inclusive** và trần 50 dòng mẫu `reconciliation_warnings` là đúng nghiệp vụ.
> - **Phạm vi**: dashboard nâng cao (App PV, KPI kinh doanh ngày–tuần–tháng) là Non-MVP/Phase 2 theo SRS `ROADMAP-CTR-001` / `DEC-CONTRACT-PHASE-001`; WWHN-327 không được mở rộng screen/API ngoài aggregate hiện hành.
>
> Đây là **một verdict duy nhất**: matrix v1.1 được duyệt. Tôi **không** ký thay QA2 và không ký phần bằng chứng vận hành.

### 1.3. Tech Lead

> **[Tech Lead] Xác nhận nhánh, định danh bằng chứng và ranh giới kiến trúc của WWHN-327.**
> Tôi đã đọc và duyệt:
>
> - Nhánh canonical là **`m1`**; không có nhánh riêng cho task này.
> - Candidate là cặp FE `99dff42` / BE `6db0965`. FE `99dff42` **supersede** `3ddce52` (bản pin cũ trong evidence pack WWHN-328) vì sau `3ddce52` màn dashboard đã đổi hành vi hiển thị phạm vi và mã permission — kết quả kiểm thử FE gắn với `3ddce52` phải retest.
> - Endpoint là **tái sử dụng** `GET /api/v1/reports/dashboard-quick`, không tạo route aggregate mới.
> - FE chỉ là **UX gate**; backend vẫn là biên authorization và data-scope. WWHN-327 không thêm phân quyền phía client thay cho BE.

### 1.4. BE1 — Backend

> **[BE1] Xác nhận contract và enforcement phía backend cho WWHN-327.**
> Tôi đã đọc và duyệt:
>
> - `GET /api/v1/reports/dashboard-quick` tại BE `6db0965` giữ nguyên field set matrix v1.1; data-scope được giải **trước** cache và `scope` nằm trong cache key, nên payload của người dùng GLOBAL không phục vụ nhầm cho người dùng bị giới hạn kho và `403` của `warehouse_id` ngoài scope không bị cache hit nuốt mất.
> - Hợp đồng lỗi FE đang bám đúng: 401 `UNAUTHENTICATED`, 403 `ACCESS_DENIED` (thiếu `report.view` hoặc kho ngoài scope), 422 `BUSINESS_RULE_ERROR` (kỳ không hợp lệ).
> - WWHN-327 **không** đổi contract BE.
>
> Bằng chứng enforcement backend là `tests/Feature/Wwhn328DashboardQuickContractTest.php` (17 test) trên repo BE, không phải bằng chứng FE.

### 1.5. DevOps

> **[DevOps] Xác nhận cổng CI và artifact bằng chứng của WWHN-327.**
> Tôi đã đọc và duyệt `.github/workflows/wwhn-327-fe-closure.yml`:
>
> - Thứ tự fail-fast: `format:check` → `lint` → `typecheck` → `check:api-mapping` → `test` → `verify:wwhn-327` → `build` → `test:e2e:wwhn-327`.
> - Bằng chứng chỉ sinh **sau** khi mọi cổng trước xanh; manifest ghi `SHA256SUMS`, `EXACT_GIT_SHA`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `CANONICAL_BRANCH=m1`, `EVIDENCE_CLASS=FE_CONTROLLED_NOT_UAT`.
> - Gate là fail-closed thật, không phải loại "luôn xanh": gỡ khối khai ngoại lệ phạm vi thì verifier đỏ (đã chứng minh trong `FE_EVIDENCE_PACK.md` §4).
> - Run xanh dùng để đóng task: `<GITHUB_RUN_ID>` tại SHA `99dff42`.

---

## 2. KHÔNG ký ở đây — còn phải làm việc thật

| Việc                                                                                                                         | Ai làm       | Vì sao không phải "đọc + duyệt"                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------- |
| Đăng fixed-build report của dashboard **trên chính WWHN-329**, một verdict duy nhất, gắn cặp SHA FE `99dff42` / BE `6db0965` | QA2          | Phải chạy kiểm thử độc lập trên build thật, không phải duyệt tài liệu |
| Tạo Jira issue link WWHN-327 ↔ WWHN-328 và map dependency HN-STR-002-ST01                                                    | PM / BAS     | Là thao tác trên Jira, không phải nội dung để duyệt                   |
| Chạy workflow `WWHN-327 FE Closure` trên `m1` và lấy `GITHUB_RUN_ID` xanh                                                    | DevOps / FE1 | Phải có run thật mới điền được định danh bằng chứng                   |

## 3. Lưu ý khi dán

- Không dán comment nào ở §1 trước khi workflow `WWHN-327 FE Closure` xanh tại `99dff42`.
- Không để dual verdict kiểu `VERIFIED PASS / CHANGES REQUIRED` hay placeholder
  `[GLOBAL / WAREHOUSE-SCOPED]` — các lần sign-off trước bị đánh trượt vì đúng lỗi này.
- Nếu register trên Jira dùng ID khác với `W327-*` trong `WWHN-327_CLOSURE_REGISTER.json`,
  map theo **nội dung** (ngoại lệ phạm vi bảo hành / gate closure riêng / mã permission
  dashboard), đừng đổi ID trong source cho khớp.
