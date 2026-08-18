# WWHN-274 — Comment xác nhận / sign-off theo vai trò

Mỗi vai trò **một comment duy nhất**, gộp đủ các đầu P0/P1/P2 thuộc vai trò đó.
Nội dung là **xác nhận (đọc + duyệt)**, không giao việc mới.

---

## Comment 1 — FE1 (chủ task WWHN-274)

Tôi xác nhận đã khắc phục và kiểm chứng phần FE của WWHN-274 trên nhánh `m1`:

- **W274-P0-02 (P0)** — Workflow `wwhn-274-fe-release-signoff.yml` cài dependency bằng `npm ci` + `cache: npm`, trong khi repo chỉ có `yarn.lock` và không có `package-lock.json` → gate không thể cài đặt, nên mọi tuyên bố "exact-SHA PASS" trước đó là chưa có căn cứ. Đã đổi sang `yarn install --frozen-lockfile --non-interactive` + `cache: yarn` + `cache-dependency-path: yarn.lock`, đúng chuẩn đang dùng ở `ci.yml`, `wwhn-292`, `wwhn-211`.
- **W274-P0-03 (P0)** — `e2e/tsconfig.tsbuildinfo` (cache biên dịch) bị version-control và còn trỏ tới spec đã xoá `e2e/zz-probe-tmp.spec.ts`, làm `tsc -b` → `npm run build` fail TS6053 trên mọi checkout sạch. Đã gỡ khỏi git và thêm `*.tsbuildinfo` vào `.gitignore`.
- **W274-P2-02 (P2)** — Verifier so khớp `.env.example` bằng chuỗi thô nên báo FAIL giả với giá trị hợp lệ `VITE_API_HEALTH_PATH="/health"`. Đã chuyển sang parse `key=value` (bỏ dấu nháy) và assert theo giá trị, đồng thời assert `VITE_API_BASE_URL` kết thúc ở `/api/v1`.
- **W274-P2-03 (P2)** — Workflow gọi evidence bằng đường dẫn thô. Đã chuyển sang `npm run wwhn-274:verify` và `npm run test:e2e:wwhn-274`; verifier assert hai script này trỏ đúng file.
- **Chống tái phát**: verifier nay từ chối `npm ci` / `cache: npm`, bắt buộc tồn tại `yarn.lock`, và bắt buộc `.gitignore` chứa `*.tsbuildinfo`.

Bằng chứng đã chạy trên đúng cây mã này: `wwhn-274:verify`, `format:check`, `lint`, `typecheck`, `test`, `env:verify`, `check:api-mapping`, `build`, `health:check` — PASS. E2E `wwhn-274-release-signoff` 6/6 PASS: 3 viewport `1440x900` / `768x1024` / `375x812` không tràn ngang, 7 trạng thái UI dùng chung (loading/empty/error/no-permission/API field-error/confirm/disabled), menu ẩn mục không có quyền + vào URL trực tiếp fail-closed về `/errors/403`, API 422 hiện lỗi và giữ nút retry.

Ranh giới sự thật: đây là bằng chứng **FE-controlled** (mock API, sinh từ source theo đúng SHA), **không** thay thế QA1 (WWHN-275) và **không** thay thế DevOps deploy/backup/rollback (WWHN-272).

---

## Comment 2 — BE / DevOps (DO)

Tôi xác nhận **W274-P0-01 (P0)** đã đóng phía BE/DevOps: health canonical là `/api/v1/health` — `routes/api.php` khai `Route::prefix('v1')` → `Route::get('health', ...)` (`api.v1.health`); `hn-devops-ci-cd.yml` smoke gọi `/api/v1/health`; `wwhn-273-backend-release-signoff.yml` có gate chặn `/api/health` legacy. Tôi đã đọc và duyệt, không phát sinh việc mới cho WWHN-274.

Tôi xác nhận phần DevOps của **W274-P1-03 (P1)**: bằng chứng deploy/backup/rollback thuộc WWHN-272 là hạng mục độc lập, phải tự đính kèm build/SHA/môi trường riêng; không được dùng artifact của WWHN-274 để thay thế.

---

## Comment 3 — PM / PO

Tôi xác nhận **W274-P1-02 (P1)**: baseline hiện hành (SRS/FRD v1.12; Wireframe MVP v3.20 — không xuất hiện Stocktake; ERD mới nhất) **không** đưa Stocktake / variance / adjustment tổng quát vào phạm vi MVP. Vì vậy phần "smoke stocktake" còn sót trong mô tả parent WWHN-72 là wording cũ; FE **không** được tự tạo màn hình/API ngoài phạm vi.

Tôi duyệt cách xử lý fail-closed theo baseline hiện hành và ghi nhận wording của parent cần chỉnh lại. Không phát sinh việc mới cho WWHN-274.

---

## Comment 4 — QA1

Tôi xác nhận đã đọc và duyệt ranh giới bằng chứng của WWHN-274: toàn bộ artifact của task này là **FE-controlled** (mock API, exact-SHA sinh từ source), hợp lệ cho đúng phạm vi build / cấu hình / smoke UI mà FE1 chịu trách nhiệm.

Tôi xác nhận phần QA của **W274-P1-03 (P1)**: release smoke độc lập (WWHN-275) vẫn là hạng mục riêng, phải chạy trên môi trường triển khai thật và tự đính kèm bằng chứng; không dùng artifact WWHN-274 để thay thế, và không tái sử dụng ảnh/PASS từ SHA khác.

Trong phạm vi FE1 của WWHN-274, tôi không thấy P0/P1 còn tồn đọng.
