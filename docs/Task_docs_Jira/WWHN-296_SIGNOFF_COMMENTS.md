# WWHN-296 — bộ comment xác nhận (sign-off) cho Jira

Mỗi vai trò **một comment duy nhất**, phạm vi chỉ là *đọc + duyệt*, không phát sinh việc mới.
Định danh dùng chung cho mọi comment:

- FE source SHA đã chạy kiểm chứng: `66a8a4f7e26ce78a584757d54cf12518b1d79302` (branch `m1`)
- BE SHA cặp đôi: `1655d0b78fa3cd082632e9b2d8510907abce0874` (branch `m1`)
- Evidence: `docs/evidence/WWHN-296/RUNTIME_IDENTITY_PIN.json`, `docs/evidence/WWHN-296/SHA256SUMS`,
  log từng lệnh tại `docs/evidence/WWHN-296/logs/`
- Task doc: `docs/Task_docs_Jira/WWHN-296.md`

---

## 1. FE1 — Quang Nguyễn Thanh (assignee, đóng phần FE source)

> **FE1 CLOSURE — WWHN-296**
>
> Tôi xác nhận đã khắc phục tại source theo review 76/100, trên nhánh `m1`, FE SHA
> `66a8a4f7e26ce78a584757d54cf12518b1d79302` / BE SHA `1655d0b78fa3cd082632e9b2d8510907abce0874`:
>
> - FE296-P1-01: rule "Stocktake removed" nay neo vào `REQ-SRS-037` (Must) của SRS/FRD v1.12 đã adopt tại
>   WWHN-334, có ERD §0.1 và wireframe xác nhận chéo. `check-api-mapping` đọc lại chính baseline thay vì so
>   chuỗi Decision ID; `DEC-NO-STOCKTAKE-001` không còn được trình bày như approved Decision ID.
> - FE296-P1-02: `npm run wwhn-296:evidence` chạy thật 11 gate command và ghi exit code + FE/BE SHA + build id
>   + timestamp vào `RUNTIME_IDENTITY_PIN.json`; `npm run wwhn-296:verify` chặn đóng nếu thiếu định danh.
> - FE296-P1-07 / P2-01: `ATT-11432` được ghi là historical, current artifact là exact SHA ở trên; nhánh
>   canonical là `m1`.
> - FE296-P1-03/04/05/06 tôi **không** tự ký: thuộc WWHN-294 / WWHN-295 / WWHN-297 / WWHN-79.
>
> Disposition: **FE SOURCE REMEDIATED / EXTERNAL PROD+QA GATES PENDING**.

---

## 2. BA Main / BA1

> **BA SIGN-OFF — WWHN-296 (FE296-P1-01)**
>
> Tôi xác nhận đã đọc và duyệt phần điều chỉnh thẩm quyền nghiệp vụ:
>
> - Thẩm quyền của rule "không có Stocktake" là `REQ-SRS-037` (Must) trong SRS/FRD v1.12 — adopt tại WWHN-334,
>   được ERD §0.1 và wireframe MVP xác nhận chéo.
> - `DEC-NO-STOCKTAKE-001` **không** được dùng như approved standalone Decision ID; `WWHN-25 / DEC-STK-001` vẫn
>   là gate riêng, chưa duyệt.
>
> Không phát sinh yêu cầu nghiệp vụ mới từ WWHN-296. Không còn blocker thuộc BA cho task này.

---

## 3. PM/PO

> **PM/PO SIGN-OFF — WWHN-296**
>
> Tôi xác nhận đã đọc và duyệt:
>
> - Thẩm quyền baseline: `REQ-SRS-037` / SRS-FRD v1.12 (WWHN-334) là căn cứ cho phạm vi không-Stocktake của MVP.
> - Disposition của WWHN-296 là **FE source đã khắc phục, gate PROD/QA còn mở** — không nâng lên VERIFIED.
> - `WWHN-25` (DEC-STK-001) và Go/No-Go tại `WWHN-79` vẫn giữ trạng thái mở, không đóng gián tiếp qua task này.
>
> Không còn blocker thuộc PM/PO cho phạm vi FE của WWHN-296.

---

## 4. Tech Lead / Lead

> **LEAD SIGN-OFF — WWHN-296 (FE296-P1-01, P1-07, P2-01)**
>
> Tôi xác nhận đã review và duyệt:
>
> - Thay đổi verifier (`check-api-mapping`, `wms-contract:verify`, `wwhn-148:verify`, `wwhn-296:verify`): rule
>   vẫn fail-closed, nhưng căn cứ được đọc lại từ baseline nên không còn treo trên một Decision ID chưa duyệt.
> - Nhánh canonical là `m1`, không có nhánh phụ; `ATT-11432` là historical, current artifact là exact SHA
>   `66a8a4f7e26ce78a584757d54cf12518b1d79302`.
> - Không còn P0 thuộc FE trong phạm vi WWHN-296.

---

## 5. QA1 — DT Soi

> **QA1 SIGN-OFF — WWHN-296 (FE296-P1-02, P1-05)**
>
> Tôi xác nhận đã đọc và chấp nhận evidence identity của FE: `RUNTIME_IDENTITY_PIN.json` có đủ FE SHA, BE SHA,
> branch, build id, Node version, timestamp và exit code thật của từng lệnh, kèm `SHA256SUMS` và log — đủ để QA
> gắn kết quả vào đúng định danh.
>
> Phần security/health readiness trên môi trường đã deploy vẫn thuộc `WWHN-297` và sẽ được attach tại chính task
> đó; comment ở WWHN-296 không thay acceptance của WWHN-297.
>
> Không còn blocker thuộc QA1 với phần FE source của WWHN-296.

---

## 6. DevOps — Minh Tân Lê

> **DEVOPS SIGN-OFF — WWHN-296 (FE296-P1-03, P1-06)**
>
> Tôi xác nhận đã đọc và tiếp nhận ranh giới evidence:
>
> - FE source chỉ chứng minh contract (`VITE_API_BASE_URL` kết thúc `/api/v1`, không hard-code domain/secret).
> - Giá trị thật của UAT/PROD (`VITE_API_BASE_URL`, CORS origin, cookie `Secure`/`SameSite`, TLS, static cache,
>   rollback, kết quả `/api/v1/health`) thuộc `WWHN-294` và sẽ được attach tại đó.
> - Công cụ sinh config matrix đã có sẵn: `php artisan wms:golive-check --json=...` (check
>   `security.browser_runtime_contract`), chạy trên chính môi trường deploy.
>
> Không có yêu cầu mới đặt lên FE1 từ phía DevOps cho WWHN-296.

---

## 7. BE1

> **BE1 SIGN-OFF — WWHN-296 (FE296-P1-04)**
>
> Tôi xác nhận đã review phần BE mà FE phụ thuộc, trên BE SHA `1655d0b78fa3cd082632e9b2d8510907abce0874`:
> `GET /api/v1/health` (200/503 theo readiness), `POST /api/v1/scan/classify` (auth + `scan.execute|scan.classify`
> + data scope kho), 401/403 do backend quyết định, và check mới `security.browser_runtime_contract` trong
> `wms:golive-check`.
>
> Acceptance runtime của BE được đóng trên chính `WWHN-295`, không đóng qua comment ở WWHN-296.
