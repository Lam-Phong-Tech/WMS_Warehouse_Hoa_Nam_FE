# WWHN-292 — Comment xác nhận / sign-off theo vai trò

Nguyên tắc: **mỗi vai trò chỉ comment 1 lần**, nói rõ mình xác nhận cái gì, không ký thay vai trò khác.
Các mục còn phải làm việc thật (không phải đọc + duyệt) được tách riêng ở §2 và **không được ký**.

Định danh cuối (R2, 2026-08-19): lấy từ `docs/evidence/wwhn-292/final/EXACT_GIT_SHA` và
`final/LOCAL_RUN_ID` — GitHub Actions quota đã cạn (3000/3000) nên KHÔNG có GITHUB_RUN_ID
nào được claim; disposition CI nằm ở `final/CI_RUN_DISPOSITION.md` (fail-closed, chờ quota).
Không dùng lại CI `#488` hay SHA `99fae…`.

---

## 1. Các comment chỉ cần xác nhận (đọc + duyệt)

### 1.1. FE1 — Frontend

> **[FE1] Xác nhận đóng phần FE source của WWHN-292.**
> Tôi đã đọc và duyệt, xác nhận các mục sau đã đóng ở phía FE trên nhánh `m1`:
> - **FE292-P1-02 / P2-01**: bằng chứng gắn đúng candidate SHA đóng băng trong `docs/evidence/wwhn-292/final/EXACT_GIT_SHA` + `LOCAL_RUN_ID` + `SHA256SUMS`; bỏ hẳn CI `#488` và SHA cũ; không claim GITHUB_RUN_ID (CI deferred theo `final/CI_RUN_DISPOSITION.md`).
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
> - Định danh bằng chứng cuối chỉ lấy từ candidate SHA đóng băng (`docs/evidence/wwhn-292/final/EXACT_GIT_SHA`) + `LOCAL_RUN_ID`, kèm `SHA256SUMS`; cấm hard-code định danh CI lịch sử; CI run deferred theo `final/CI_RUN_DISPOSITION.md` (quota 3000/3000).
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
> - R2: GitHub Actions quota 3000/3000 đã cạn — cấm trigger CI. Định danh bản build cuối là LOCAL execution identity tại candidate SHA trong `docs/evidence/wwhn-292/final/` (cùng thứ tự gate fail-fast, chạy local); CI run DEFERRED theo `final/CI_RUN_DISPOSITION.md`, không claim run id nào.

---

## 2. R2 (2026-08-19): 3 mục cũ đã có evidence thật — chỉ còn residual môi trường

Ba mục từng nằm ở mục này đã đóng bằng evidence thật tại exact candidate SHA (xem
`WWHN-292_CLOSURE_REGISTER.json` + `WWHN-292.md` §7): FE292-P1-01 = defect register thật,
FE292-P1-03 = QA2 retest matrix (QA2_LOCAL_RETEST_NOT_UAT_ENV), FE292-P1-04 = raw direct-API
401/403/data-scope trên BE runtime + QA1 độc lập. Verifier vẫn fail-closed: trạng thái đóng
chỉ hợp lệ khi artifact evidence tương ứng tồn tại và hash khớp.

Residual duy nhất (môi trường, thuộc DevOps/QA2 khi có DEV/UAT server — WWHN-287/WWHN-293):
rerun đúng các matrix đã publish trên môi trường đó. Không phát sinh thiết kế/bằng chứng mới phía FE.

Trace lịch sử: **FE SOURCE REMEDIATED / EXTERNAL UAT GATES PENDING** là trạng thái trước R2.
Không tuyên bố 100% UAT/dự án bằng local-execution evidence; tuyên bố đúng là: toàn bộ hạng mục
review 80/100 đã đóng bằng bằng chứng thật trên cùng định danh candidate, chỉ còn rerun môi trường.
