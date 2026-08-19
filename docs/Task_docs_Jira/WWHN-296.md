# WWHN-296 — [FE1] Kiểm tra build/cấu hình runtime

Date: 2026-08-18, cập nhật 2026-08-19 (ICT)
Branch: `m1` (canonical, không mở nhánh phụ)
Repository: <https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE>
Review đầu vòng 1: **76/100 — CHANGES REQUIRED** (register `FE296-P1-01..07`, `FE296-P2-01`).
Review vòng 2 (comment 15653, 18/08): **PASS có điều kiện 80/100** (register `FE296-P1-08`,
`FE296-P1-02R`, `FE296-P1-03..06`, `FE296-P1-01G`) — phần FE-owned đã khắc phục ở §2b.

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

## 2b. Register khắc phục theo review 80/100 (comment 15653, 18/08/2026)

| ID | Sev | Nguyên nhân gốc | Khắc phục đã áp dụng | Trạng thái |
| --- | --- | --- | --- | --- |
| FE296-P1-08 | P1 | `wwhn-296:verify` chỉ ghi *note* khi `workingTreeClean=false`; pin cũ mang `buildId 1.0.0+local-uncommitted`, `sourceSha/executionSha=local-uncommitted` — evidence mô tả một trạng thái không ai checkout lại được. Thêm nữa, rule `.gitignore` `logs` nuốt cả thư mục `docs/evidence/**/logs/` (negation `*.log` vô hiệu vì thư mục cha bị exclude) nên **log evidence chưa từng được commit**. | Verifier **hard-FAIL** khi: `workingTreeClean != true` (cả FE lẫn BE), bất kỳ trường identity nào chứa `local-uncommitted`, `buildManifest.sourceSha != executionSha != pinned FE SHA`, `generatedAt` sớm hơn commit của candidate, thiếu block `integrity`, hoặc evidence pack lệch `SHA256SUMS` (từng entry được băm lại; log nào được trích dẫn phải có mặt trong SUMS). `.gitignore` mở lại `!docs/evidence/**/logs/`. Positive control: verifier mới chạy trên pin cũ FAIL đúng 8 lỗi — log `logs/verify-closure-positive-control-old-pin.log`. | Đóng tại source |
| FE296-P1-02R | P1 | Evidence sinh từ tree bẩn, trước khi commit source. | Generator **fail-closed trước khi chạy**: từ chối nếu FE/BE tree không sạch hoặc không trên `m1` (chấp nhận detached checkout đúng exact SHA thuộc `m1` — cách vật chất hoá clean checkout khi `m1` là tree dùng chung); inject `SOURCE_SHA/EXECUTION_SHA` thật vào `build-manifest`; tự vật chất hoá `swagger-api.json` qua `contract:sync --from` BE checkout đã pin (WWHN-309) vì clean checkout không có artifact synced; kiểm tra **integrity hậu-run** (HEAD không đổi, source không bị phiên song song sửa giữa chừng — vi phạm là VOID RUN). Evidence hiện hành sinh từ **clean checkout exact SHA** `821ac834bb70f1ee076acb7da659777be43742c6` (FE) / BE `7da26cb1cc13df58537c5ff8556070ad8529ed4d`, 12/12 lệnh PASS, `buildId 1.0.0+821ac834...`. | Đóng — evidence current |
| FE296-P1-03 | P1 | UAT/PROD deploy/runtime checks thuộc DevOps. | Không đổi từ vòng 1: công cụ đã bàn giao, DevOps chạy và attach trên `WWHN-294`. | External — `WWHN-294` |
| FE296-P1-04 | P1 | BE runtime acceptance phải nằm trên task BE. | Evidence BE nằm trên chính `WWHN-295` (đã có review riêng + FE consumer confirmation trên đó). WWHN-296 không self/cross-sign thay. | External — `WWHN-295` |
| FE296-P1-05 | P1 | Prod QA evidence phải nằm trên task QA. | QA1 chạy/attach trên chính `WWHN-297`. | External — `WWHN-297` |
| FE296-P1-06 | P1 | Parent thiếu production checklist + Go/No-Go. | FE cung cấp identity pin/build-runtime config cho checklist parent; disposition thuộc `WWHN-79`. | External — `WWHN-79` |
| FE296-P1-01G | P1 gov | Không được nâng `DEC-NO-STOCKTAKE-001` thành approved standalone Decision. | Giữ nguyên **Pending** trong `STOCKTAKE_GOVERNANCE_STATUS.json` (`approvedStandaloneDecisionId: null`, gate `WWHN-25 / DEC-STK-001`); verifier tiếp tục chặn mọi claim approval. BA đã xác nhận thẩm quyền REQ-SRS-037 (comment 15657). | Pending — `WWHN-25` |

Sửa kèm trong vòng này (root cause lộ ra khi chạy trên clean checkout): digest wireframe trong
governance register được tính từ bản working-copy CRLF thay vì bytes LF canonical (`.gitattributes eol=lf`)
— refresh về `22c69d4b...` (nội dung file không đổi, `git diff` rỗng); re-pin BE contract sang exact SHA
`7da26cb` theo flow WWHN-309 vì BE đổi contract có chủ đích ở WWHN-295.

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
