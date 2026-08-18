# WWHN-249 — Comment xác nhận / sign-off theo vai trò

Nguyên tắc: **mỗi vai trò chỉ comment 1 lần**, nói rõ mình xác nhận cái gì, không
ký thay vai trò khác. Các mục còn phải **làm việc thật** nằm ở §2 và **không được
ký** ở đây.

Candidate đang xác nhận:

- BE `WMS_Warehouse_Hoa_Nam_BE` `m1` — `231740fe991fea35005bdf195d6e4f88fa16569e`
- FE `WMS_Warehouse_Hoa_Nam_FE` `m1` — `e02d4185608e7bb661481968a902b71c81386362`

Trước khi dán: thay hai SHA trên bằng SHA của **commit đóng task** nếu đã commit
thêm; không dùng lại SHA của task khác. Không dán khi
`node scripts/verify-wwhn-249-closure.mjs` chưa PASS.

---

## 1. Các comment chỉ cần xác nhận (đọc + duyệt)

### 1.1. BE1 — Backend

> **[BE1] Xác nhận đóng phần backend của WWHN-249 tại `231740f` trên `m1`.**
> Tôi đã đọc và duyệt, xác nhận:
>
> - **Đủ 8 operation Annex C của App PV** có route thật: 4 GET công khai
>   (`/pv/products`, `/pv/products/{sku_id}`, `/pv/industries`,
>   `/pv/recommendations`), `PATCH /pv/products/{sku_id}/publish`, và 3 operation
>   `/pv-admin/resources/{resource_type}`.
> - **Hai biên bảo mật tách bạch**: nhóm public không có `auth:api` đúng theo SRS
>   §12; nhóm quản trị bắt buộc bearer + `pv.master.manage`; publish gate đúng một
>   quyền `pv.publish` — nhánh `|sku.manage` đã bị gỡ nên việc tách quyền không
>   còn là hình thức.
> - **Error set đúng contract**: nhóm public trả `400` cho tham số sai (không phải
>   `422`), `404` cho SKU chưa publish; nhóm quản trị có đủ `401/403/404/409/412/
>   422/428`, `If-Match` là bắt buộc trên PATCH.
> - **Ràng buộc bù cho việc ẩn danh** còn nguyên: `throttle:pv-public`, DTO danh
>   sách trắng, cache ≤60 giây kèm `data_as_of`, và không endpoint nào chạm ledger.
>
> Kết quả tại đúng SHA: `verify-wwhn-249-closure.mjs` PASS; 47 test PV/contract —
> **45 PASS, 0 FAIL, 2 SKIP** (2 skip là cổng chỉ chạy trên PostgreSQL, tôi không
> đọc chúng là PASS).
> Tôi **không** xác nhận đây là UAT và **không** ký thay QA1 (WWHN-250).

### 1.2. BA Main / BAS

> **[BA] Xác nhận cách hiểu contract App PV và ma trận quyền của WWHN-249.**
> Tôi đã đọc và duyệt, xác nhận:
>
> - **Nhóm PV đọc được phép ẩn danh** là đúng hợp đồng, không phải lỗi phân quyền:
>   SRS §2 `SRC-008`/`DR-PLAT-001`, §3 actor "Người xem App PV" (read-only
>   published product + available quantity), §8.1 `PUBLIC_ANONYMOUS`, §12 yêu cầu
>   khai `security: []` cho đúng 4 GET đó.
> - **Ranh giới ghi**: publish là `pv.publish`, quản trị Industry/Tag/Product
>   Mapping/Recommendation Rule là `pv.master.manage`; App PV không có quyền ghi.
> - **DEC-CATALOG-001**: publish độc lập tồn kho, SKU tồn 0 vẫn hiển thị với nhãn
>   "Chưa có hàng".
> - **D-02 được chấp nhận**: `/pv/catalog` và `/pv/tags` là alias lịch sử ngoài
>   Annex C, giữ để client cũ không vỡ, dùng chung read model chỉ-đọc và đã được
>   khai tường minh trong danh sách mặt công khai.
>
> Đây là **một verdict duy nhất** cho phần contract. Tôi **chưa** ký D-01 (mức xem
> của NV kho/Lãnh đạo trên dữ liệu chưa publish) và D-04 (cấp `pv.master.manage`
> cho QL kho) — hai mục đó cần quyết định, xem §2.

### 1.3. Tech Lead

> **[Tech Lead] Xác nhận nguồn canonical và ranh giới kiến trúc của WWHN-249.**
> Tôi đã đọc và duyệt:
>
> - Nhánh canonical là **`m1`**; không có nhánh riêng cho task này. Pin cũ
>   **`m1-be-2` bị supersede**: toàn bộ implementation App PV nằm trên `m1`, nên
>   source pin trên Jira phải đổi sang `m1` + SHA đóng task.
> - Candidate là cặp BE `231740f` / FE `e02d418`.
> - Ranh giới kiến trúc giữ nguyên: backend là biên authorization duy nhất; FE chỉ
>   là UX gate. Nhóm public không đi qua interceptor auth của FE.
> - `docs/contracts/HoaNam_Current_Baseline_Contract.json` đã đăng ký 5 operation
>   PV mới — API surface không được phình mà không qua chỗ này.
>
> Tôi **không** ký thay QA1 và không ký phần build/PR trên Jira.

### 1.4. FE1 — Frontend

> **[FE1] Xác nhận hợp đồng FE↔BE của App PV tại FE `e02d418`.**
> Tôi đã đọc và duyệt:
>
> - FE dùng **path canonical Annex C** `/pv/products` và `/pv/products/{sku_id}`;
>   `/pv/catalog` chỉ là path lịch sử của BE và **không** được dùng ở FE.
> - Nhóm public được giữ **tách khỏi `shared/api/endpoints.ts`** để không có ngày
>   nào đó ai đó gắn interceptor auth vào endpoint ẩn danh.
> - Màn App PV public **không** bị ẩn sau permission guard; màn quản trị PV yêu cầu
>   `pv.master.manage`, còn nút publish yêu cầu `pv.publish` — hai quyền khác nhau,
>   không gộp.
> - PATCH `/pv-admin/resources/{resource_type}/{id}` luôn gửi `If-Match` bằng
>   `version` vừa đọc; thiếu là `428`, lệch là `412`.
> - Bộ lọc public bám đúng §8.1 (brand / power source) và hiển thị `data_as_of`
>   theo NFR-SRS-016.
>
> Tôi **không** xác nhận đây là bằng chứng UAT.

### 1.5. DevOps

> **[DevOps] Xác nhận cổng và artifact bằng chứng của WWHN-249.**
> Tôi đã đọc và duyệt:
>
> - Cổng đóng task là `node scripts/verify-wwhn-249-closure.mjs`, đọc **nguồn thật**
>   (`route:list`, OpenAPI runtime, `PUBLIC_ALLOWLIST`, baseline contract) chứ không
>   đọc lại tài liệu do chính nó sinh ra.
> - Cổng là **fail-closed thật**: đã chứng minh bằng cách gỡ một route khỏi danh
>   sách đã chốt và verifier đỏ ngay với đúng hai vi phạm.
> - Bằng chứng gồm `docs/evidence/WWHN-249/WWHN-249_CLOSURE_REGISTER.json` và
>   `PV_SURFACE_EVIDENCE.md`, kèm SHA-256 của OpenAPI runtime (231 operation).
> - Thêm một route public mới ở bất kỳ đâu trong hệ thống sẽ làm đỏ cả verifier lẫn
>   `Wwhn249PvSurfaceGovernanceTest` cho tới khi được khai báo ở đủ 3 nơi.

### 1.6. PM / BAS — governance (DEV249-P2-01)

> **[PM/BAS] Xác nhận ghi chú quyền sở hữu của WWHN-249.**
> Tôi đã đọc và duyệt: mô tả cũ ghi BE2/Duy Khánh là **vết lịch sử**, giữ nguyên
> để trace; owner hiện tại của task là assignee đang hoạt động. Từ nay đọc trạng
> thái task theo assignee + register `WWHN-249_CLOSURE_REGISTER.json`, không theo
> phần mô tả cũ.

---

## 2. KHÔNG ký ở đây — còn phải làm việc thật

| Việc | Ai làm | Vì sao không phải "đọc + duyệt" |
| --- | --- | --- |
| **D-04**: cấp `pv.master.manage` cho `WAREHOUSE_MANAGER` trong `AuthDatabaseSeeder`, chạy lại seeder, thêm test RBAC | DEV + người duyệt phân quyền | Là thay đổi cấp quyền thật, phải có người quyết định; bản vá một dòng ở `PV_SURFACE_EVIDENCE.md §6` |
| **D-01**: quyết định có mở `pv.master.view` cho NV kho/Lãnh đạo trên dữ liệu **chưa** publish hay không | BA | Là thay đổi Annex C, không phải sửa code |
| QA1 retest tại exact SHA: auth, assignment, positive/negative filter, field detail, `403`, `409`, pagination, no stock side-effect — đăng trên **WWHN-250** | QA1 | Phải chạy độc lập trên build thật, không phải duyệt tài liệu |
| Đổi source pin Jira từ `m1-be-2` sang `m1` + SHA đóng task; đính PR/commit + build ID | Tech Lead / DEV | Là thao tác trên Jira/CI |
| Đóng 2 test đỏ còn lại trên `m1` (WWHN-236 apply-adjustment/Postman; pin nguồn read model WWHN-252) | Luồng WWHN-236 / WWHN-252 | Ngoài phạm vi WWHN-249; không được mượn PASS của task này |

## 3. Lưu ý khi dán

- Không dán comment nào ở §1 trước khi `verify-wwhn-249-closure.mjs` PASS tại
  đúng SHA ghi ở đầu file.
- Không dán verdict kép kiểu `VERIFIED PASS / CHANGES REQUIRED`, không để
  placeholder — các lần sign-off trước bị đánh trượt vì đúng lỗi này.
- Không tuyên bố WWHN-65 / WWHN-19 / WWHN-251 hoàn tất chỉ từ artifact này.
