# WWHN-296 — [FE1] Kiểm tra build/cấu hình runtime

Date: 2026-08-18 (ICT)
Branch: `m1` (canonical, không mở nhánh phụ)
Repository: <https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE>
Latest reviewed Jira assessment at start of this remediation: **76/100 — CHANGES REQUIRED**
(register `FE296-P1-01..07`, `FE296-P2-01`)

## 1. Phạm vi và ranh giới sự thật

WWHN-296 sở hữu việc kiểm tra cấu hình build/runtime của FE và evidence ở tầng source. Nó **không** tự
ký thay hạ tầng production, runtime deployment, chấp thuận vai trò BE, thực thi QA hay Go/No-Go của task cha.

Trạng thái các gate ngoài, đọc trực tiếp trên Jira ngày 18/08/2026:

| Jira | Vai trò | Phạm vi | Status quan sát |
| --- | --- | --- | --- |
| `WWHN-294` | DevOps | Provision/harden prod, env matrix, rollback | `Blocked/Pending` |
| `WWHN-295` | BE1 | Runtime/cấu hình/health của backend đã deploy | `In Progress` |
| `WWHN-297` | QA1 | Security/health readiness trên build đã deploy | `Blocked/Pending` |
| `WWHN-79` | PM + DevOps + BA/QA | Parent Go/No-Go | `Blocked/Pending` |
| `WWHN-25` | PM/PO + Process Owner | Decision Record `DEC-STK-001` | `In Progress` |
| `WWHN-334` | BA + PM/PO | Adoption của SRS/FRD v1.12 | `DONE REDFLAG` / resolution `Done` |

Vì vậy disposition đúng vẫn là **FE SOURCE REMEDIATED / EXTERNAL PROD+QA GATES PENDING**.

## 2. Register khắc phục theo review 76/100

| ID | Sev | Nguyên nhân gốc | Khắc phục đã áp dụng | Trạng thái |
| --- | --- | --- | --- | --- |
| FE296-P1-01 | P1 | Rule "Stocktake removed" trong `M1`/`M3`/`check-api-mapping.mjs` viện dẫn `DEC-NO-STOCKTAKE-001` như Decision ID đã duyệt. Decision Record độc lập `WWHN-25 / DEC-STK-001` vẫn `In Progress`, nên rule đứng trên một thẩm quyền không tồn tại. | Đổi neo thẩm quyền sang **`REQ-SRS-037` (Must)** trong baseline đã adopt `SRS/FRD v1.12` (`WWHN-334` = Done), có ERD §0.1 và wireframe MVP xác nhận chéo. `check-api-mapping.mjs` nay **đọc lại chính baseline** (REQ-SRS-037 + câu "Không expose Stocktake/Variance" + ERD "Không tạo Stocktake_Session") thay vì so chuỗi Decision ID, và chặn mọi văn bản trình bày `DEC-NO-STOCKTAKE-001` như approved Decision ID. `verify-wwhn-296-closure.mjs` pin SHA-256 của cả ba baseline. | FE source đóng; approval `WWHN-25` vẫn external |
| FE296-P1-02 | P1 | Task doc chỉ *liệt kê* lệnh kiểm tra; không có exit code, không có FE/BE SHA, build id, URL hay timestamp gắn với lần chạy nào. | Thêm `npm run wwhn-296:evidence`: chạy thật 11 gate command, ghi log + exit code + thời lượng từng lệnh, rồi sinh `docs/evidence/WWHN-296/RUNTIME_IDENTITY_PIN.json` (FE SHA, BE SHA, branch, build id từ `dist/build-manifest.json`, Node version, timestamp) và `SHA256SUMS`. `npm run wwhn-296:verify` từ chối đóng nếu thiếu SHA 40-hex, thiếu build id, hoặc có lệnh bắt buộc `FAIL`/`NOT_RUN`. | FE source đóng |
| FE296-P1-03 | P1 | Không có cách nào chứng minh CORS origin / refresh-cookie policy / SSL của môi trường thật; các giá trị này chỉ tồn tại lúc deploy nên review không có gì để kiểm. | BE thêm check `security.browser_runtime_contract` vào `php artisan wms:golive-check`: chạy trên **chính môi trường deploy**, in ra config matrix đã sanitize (APP_URL, health URL, CORS allow-list, supports_credentials, cookie name/path/domain/Secure/SameSite) và fail-closed khi allow-list rỗng/wildcard/`http` ngoài local, `APP_URL` không https, cookie không Secure, path cookie sai, hoặc **FE khác registrable domain mà SameSite vẫn `lax`** — lỗi này vẫn trả 200 ở health/curl nhưng đăng xuất mọi user sau F5. | Công cụ đã có; **DevOps phải chạy và attach** — external `WWHN-294` |
| FE296-P1-04 | P1 | Comment của cùng assignee trên WWHN-296 không thay được acceptance của task BE. | Không self-sign. Contract phía BE mà FE phụ thuộc được ghi rõ ở §5 để BE1 xác nhận trên chính `WWHN-295`. | External — `WWHN-295` |
| FE296-P1-05 | P1 | QA evidence chưa nằm trên task QA. | Không self-sign. Danh sách evidence QA1 cần attach ghi ở §6. | External — `WWHN-297` |
| FE296-P1-06 | P1 | Parent thiếu checklist env/secret/backup-restore/monitoring/health/rollback/Go-No-Go. | Không self-sign; FE cung cấp phần thuộc FE (build/runtime config + identity pin) để ghép vào checklist parent. | External — `WWHN-79` |
| FE296-P1-07 | P1 | `ATT-11432` (01/08) vẫn là primary output trong khi cây source đã đi xa. | `docs/evidence/devops/DEVOPS_EXACT_EVIDENCE_REGISTER.md` và tài liệu này ghi rõ `ATT-11432` là historical và trỏ current artifact + exact SHA. `wwhn-296:verify` fail nếu mất phần supersession này. | FE source đóng |
| FE296-P2-01 | P2 | Có reference nhánh `m1ee`/`tree/m1ee` không tồn tại. | Toàn bộ việc nằm trên `m1`; `wwhn-296:verify` cấm chuỗi `m1ee` trong task doc và DevOps register. | Đóng |

Không phát hiện P0 thuộc FE trong review hiện tại. Các gate P1 external cố ý **không** được FE đánh dấu PASS.

## 3. Định danh chính xác

Nguồn duy nhất: `docs/evidence/WWHN-296/RUNTIME_IDENTITY_PIN.json` (sinh bằng `npm run wwhn-296:evidence`).
File này ghi FE SHA, BE SHA, branch, build id, Node version, timestamp và exit code thật của từng lệnh;
`docs/evidence/WWHN-296/SHA256SUMS` băm chính các artifact đó.

Vì `m1` là nhánh dùng chung, reviewer/QA phải gắn evidence vào đúng SHA đã build/deploy và chạy lại
`npm run wwhn-296:evidence` nếu có commit mới.

## 4. Source đã thay đổi

### FE `m1`

- `scripts/run-wwhn-296-evidence.mjs` — sinh identity pin + log/exit code (mới).
- `scripts/verify-wwhn-296-closure.mjs` — gate đóng task (mới).
- `scripts/check-api-mapping.mjs` — đọc lại thẩm quyền no-Stocktake từ chính baseline.
- `scripts/verify-wms-contract-signoff.mjs`, `scripts/verify-wwhn-148-closure.mjs` — neo lại `REQ-SRS-037`.
- `docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json` — register thẩm quyền + hash baseline.
- `docs/api-evidence/M1_API_MAPPING.md`, `docs/api-evidence/M3_DEPENDENCY_LIST.md` — bảng thẩm quyền.
- `docs/evidence/devops/DEVOPS_EXACT_EVIDENCE_REGISTER.md` — sửa mục Stocktake, pin SHA hiện hành.
- `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` — sửa default `VITE_API_BASE_URL` về cổng `8080` và
  `VITE_API_WITH_CREDENTIALS` thành bắt buộc `true` cho khớp `.env.example` và `src/shared/config/env.ts`.
- `package.json` — thêm `wwhn-296:evidence`, `wwhn-296:verify`.

### BE `m1`

- `app/Console/Commands/BackendGoLiveCheck.php` — thêm check `security.browser_runtime_contract`.
- `tests/Feature/Wwhn296BrowserRuntimeContractTest.php` — 8 test cho các failure mode chỉ xảy ra khi deploy (mới).
- `tests/Feature/Wwhn300BackendGoLiveCheckTest.php` — bổ sung dimension mới vào danh sách bắt buộc.
- `.env.example` — ghi rõ điều kiện bắt buộc `SameSite=none` khi FE khác site.

## 5. Lệnh kiểm chứng

Chạy trên đúng FE SHA sẽ được review/deploy:

```bash
npm run wwhn-296:evidence
```

Lệnh trên chạy tuần tự và ghi log: `format:check`, `lint`, `typecheck`, `test`, `env:verify`,
`uat:p0p1:verify`, `wms-contract:verify`, `wwhn-148:verify`, `build`, `health:check`, `check:api-mapping`.
Sau đó:

```bash
npm run wwhn-296:verify
```

Phía BE, trên đúng BE SHA và **chính môi trường deploy**:

```bash
php artisan wms:golive-check --json=build/evidence/wwhn-296/golive-check.json
```

Người review BE cần chứng minh thêm:

- `GET /api/v1/health` trả 200 chỉ khi app/database/migration/seed readiness đạt, ngược lại 503.
- `POST /api/v1/scan/classify` vào đúng classifier read-only và ép auth + `scan.execute|scan.classify` + data scope kho.
- Request thiếu quyền vẫn 401/403 ở tầng API; guard của FE không được coi là bằng chứng phân quyền backend.

## 6. Evidence còn thiếu trước khi đóng cuối

| Hạng mục | Owner | Task |
| --- | --- | --- |
| Config matrix thật (kết quả `wms:golive-check` trên UAT/PROD), CORS origin, cookie `Secure`/`SameSite`, TLS, static cache, rollback | DevOps | `WWHN-294` |
| BE runtime/health trên đúng BE SHA đã deploy | BE1 | `WWHN-295` |
| QA1 health/401/403/CORS/cookie logs kèm SHA + environment | QA1 | `WWHN-297` |
| Checklist parent + Go/No-Go disposition | PM + DevOps + BA/QA | `WWHN-79` |
| Formal disposition cho `DEC-STK-001` | PM/PO + Process Owner | `WWHN-25` |

## 7. Supersession của attachment

`ATT-11432` (01/08/2026) là **historical artifact**, không còn là primary current evidence. Current artifact
cho source review là cây repo tại exact SHA ghi trong `RUNTIME_IDENTITY_PIN.json`, cùng
`docs/evidence/devops/DEVOPS_EXACT_EVIDENCE_REGISTER.md`. Nếu quy trình Jira bắt buộc binary attachment mới,
người có quyền upload phải đính kèm chính file register/handover hiện hành và ghi Attachment ID + SHA-256;
không tạo Attachment ID giả.
