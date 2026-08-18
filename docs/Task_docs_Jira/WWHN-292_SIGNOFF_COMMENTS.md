# WWHN-292 — Comment xác nhận / sign-off theo vai trò

Nguyên tắc: **mỗi vai trò chỉ comment 1 lần**, nói rõ mình xác nhận cái gì, không ký thay vai trò khác.
Các mục còn phải làm việc thật (không phải đọc + duyệt) được tách riêng ở §2 và **không được ký**.

Trước khi dán: thay `<EXACT_GIT_SHA>` / `<GITHUB_RUN_ID>` bằng giá trị do workflow
`WWHN-292 FE Closure` sinh ra ở lần chạy xanh cuối (artifact `evidence/wwhn-292/EXACT_GIT_SHA`,
`GITHUB_RUN_ID`). Không dùng lại CI `#488` hay SHA `99fae…`.

---

## 1. Các comment chỉ cần xác nhận (đọc + duyệt)

### 1.1. FE1 — Frontend

> **[FE1] Xác nhận đóng phần FE source của WWHN-292.**
> Tôi đã đọc và duyệt, xác nhận các mục sau đã đóng ở phía FE trên nhánh `m1`:
> - **FE292-P1-02 / P2-01**: bằng chứng gắn đúng `GITHUB_SHA` của lần chạy workflow `WWHN-292 FE Closure` (`<EXACT_GIT_SHA>` / run `<GITHUB_RUN_ID>`); bỏ hẳn CI `#488` và SHA cũ.
> - **FE292-P1-05**: đã có artifact riêng cho task — `docs/Task_docs_Jira/WWHN-292.md`, `docs/evidence/wwhn-292/WWHN-292_CLOSURE_REGISTER.json`, `scripts/verify-wwhn-292-closure.mjs`, `e2e/wwhn-292-ui-responsive-rbac.spec.ts`; không còn mượn WWHN-156.
> - **FE292-P2-02**: ma trận viewport đúng `1440x900`, `768x1024`, `375x812`, thêm `1280x900` cho mức tối thiểu desktop NFR-SRS-006.
> - **FE292-P1-06**: bổ sung kiểm thử responsive cho **app shell sau đăng nhập** (trước đây chỉ có `/login`) — không tràn ngang, aside `fixed 300px` khi >980px và stack full-width khi ≤980px đúng wireframe BA.
> - **FE292-P2-03**: fail-closed route mở rộng từ 1 route mẫu thành **ma trận 13 route** (403 + trạng thái "Không có quyền truy cập" + ẩn menu), kèm 1 ca đối chứng `/inventory` vẫn vào được để chắc chắn guard không chặn nhầm.
>
> Kết quả cổng FE cho phạm vi WWHN-292: `wwhn-292:verify` PASS, `test:e2e:wwhn-292` **24/24 PASS**.
> Tôi **không** xác nhận đây là UAT: bằng chứng FE là controlled/mock, không thay QA2 và không chứng minh phân quyền backend.

### 1.2. BA

> **[BA] Xác nhận baseline UI/responsive dùng cho WWHN-292 là đúng.**
> Tôi đã đọc và duyệt, xác nhận cách FE hiểu baseline là đúng tài liệu:
> - Mức tối thiểu desktop **≥1280px** theo **NFR-SRS-006**.
> - Điểm gãy stack sidebar **980px** và bề rộng aside **300px** theo `HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html`.
> - Bộ viewport bắt buộc `1440x900` / `768x1024` / `375x812` là đúng yêu cầu đánh giá (tablet là 768x1024, **không** phải 1024x768).
> - Phạm vi màn hình/route trong ma trận RBAC khớp screen map MVP.
>
> Tôi **chưa** xác nhận phần defect register của HN-UAT-003 / WWHN-78 — xem §2.

### 1.3. Tech Lead

> **[Tech Lead] Xác nhận nhánh và quy tắc định danh bằng chứng của WWHN-292.**
> Tôi đã đọc và duyệt:
> - Nhánh canonical là **`m1`**; không có nhánh riêng cho task này; mọi tham chiếu `m1ee/m1` là không hợp lệ.
> - Định danh bằng chứng cuối chỉ lấy từ `GITHUB_SHA` / `GITHUB_RUN_ID` của lần workflow xanh (`<EXACT_GIT_SHA>` / `<GITHUB_RUN_ID>`), kèm `SHA256SUMS`; cấm hard-code định danh CI lịch sử.
> - Ranh giới đúng: FE chỉ là **UX gate**, backend là biên phân quyền có thẩm quyền — WWHN-292 không thêm authorization phía client để thay thế BE.

### 1.4. BE1 — Backend

> **[BE1] Xác nhận ranh giới phân quyền giữa BE và FE trong WWHN-292.**
> Tôi đã đọc và duyệt:
> - BE `m1` giữ nguyên là nơi enforce phân quyền: `auth:api` + `permission:*` trên route nghiệp vụ, cộng middleware warehouse/data-scope cho inventory/outbound.
> - WWHN-292 **không** đổi contract BE và **không** thêm phân quyền phía client thay cho BE.
> - Hợp đồng lỗi FE đang bám đúng §8.2: 401 → refresh/đăng nhập lại, 403 → trạng thái không có quyền, 422 → lỗi theo field, kèm `request_id`.
>
> Tôi **không** xác nhận thay bằng chứng direct-API của môi trường DEV/UAT — xem §2.

### 1.5. DevOps

> **[DevOps] Xác nhận cổng CI và artifact bằng chứng của WWHN-292.**
> Tôi đã đọc và duyệt workflow `.github/workflows/wwhn-292-fe-closure.yml`:
> - Thứ tự fail-fast: `format:check` → `lint` → `typecheck` → `check:api-mapping` → `test` → `wwhn-292:verify` → `build` → `test:e2e:wwhn-292`.
> - Artifact bất biến `wwhn-292-fe-<sha>` chỉ được ghi **sau khi** toàn bộ cổng trên xanh, gồm `EXACT_GIT_SHA`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `CANONICAL_BRANCH=m1`, `EVIDENCE_CLASS=FE_CONTROLLED_NOT_UAT` và `SHA256SUMS`.
> - Định danh bản build cuối lấy từ run `<GITHUB_RUN_ID>` trên SHA `<EXACT_GIT_SHA>`.

---

## 2. KHÔNG ký thay — các mục còn cần làm việc thật

Các mục dưới đây **giữ nguyên fail-closed** trong `WWHN-292_CLOSURE_REGISTER.json`; verifier sẽ đỏ nếu ai đó tự chuyển sang PASS.

| Mục | Chủ sở hữu | Còn thiếu |
| --- | --- | --- |
| FE292-P1-01 | BA / QA1 | Defect register thật của HN-UAT-003 / WWHN-78, hoặc quyết định zero-defect được duyệt độc lập. Mỗi dòng phải đủ: module/route, account-role, viewport, env/build, expected, actual, severity, evidence trước, fix SHA/files, evidence sau, kết quả retest. |
| FE292-P1-03 | QA2 | Retest độc lập trên DEV/UAT thật với đúng browser / account-role / ma trận viewport (WWHN-293, WWHN-287). Test mock của FE chỉ là handoff. |
| FE292-P1-04 | QA2 / BE / DevOps | Bằng chứng direct-API bỏ qua UI: tài khoản/role/phạm vi kho, kết quả 401/403, `request_id`, từ chối data-scope, kèm đúng FE SHA + BE SHA + định danh môi trường. |

Chốt trạng thái WWHN-292: **FE SOURCE REMEDIATED / EXTERNAL UAT GATES PENDING**.
Không tuyên bố 100% UAT/dự án cho tới khi 3 dòng trên có bằng chứng thật trên cùng một định danh build.
