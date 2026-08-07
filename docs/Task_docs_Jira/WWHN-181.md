# WWHN-181 — FE1 Xác minh ánh xạ / payload / lỗi — root remediation

## 1. Trạng thái release sau remediation

| Trường | Giá trị |
| --- | --- |
| Task | `WWHN-181` |
| Parent | `WWHN-40` — HN-INT-001 |
| Branch bắt buộc | `m1` |
| FE remediation base đã review | `aa185096211bc5bef7ec966097edfc106a5003b2` |
| FE closure SHA | **commit chứa chính tài liệu này**; CI bind bằng `GITHUB_SHA` và artifact name chứa exact SHA |
| BE contract target | `WWHN-180` v`1.7.0` |
| Exact BE SHA | `fc534ed8c00dadd91ce60e7bac5a8660dda74d08` |
| BE parent SHA | `04026757d679446b54e1e0c54ea18c3c0a0423ed` |
| FE baseline BE đã quan sát | `f6e137d01ed7afec5d30e8fecde6a2cc31bb7c8b` |
| BE immutable manifest SHA256 | `ba8bc5841b5865095e51d21064ead90ad4c37129ee28142a3f507b497ddcc776` |
| BE release-pack SHA256 | `a20b0d8d8a9145bceb2e797c51befa20d7da9e6439be512b39f72f3d8010cdb9` |
| BE repository SHA256SUMS SHA256 | `0f4dcd23ceb84e39799fae5cb3f112932e6260a34ccff63b1ab7c623c839cb36` |
| FE independent source review | **CHANGES REQUIRED — BE handoff drift** |
| FE critical runtime remediation | **IMPLEMENTED / machine-gated** |
| Final FE sign-off | **BLOCKED / fail-closed** |
| Điều kiện final | exact CI PASS + `WWHN-180 PASS` + `WWHN-182 QA2 PASS` + `WWHN-183 GO` + live UI PASS, tất cả cùng FE SHA / BE SHA / manifest digest |

Không sử dụng lại evidence v1.5.0 hoặc FE SHA cũ để final. Evidence trước đây là lịch sử, không phải identity release hiện tại.

## 2. Kết quả independent source review BE v1.7.0

FE1 đã đối chiếu trực tiếp artifact handoff với runtime source tại **cùng exact BE SHA** `fc534ed...`. Có hai mâu thuẫn nguồn cần BE1/BA xử lý trước khi `WWHN-180` được PASS độc lập.

### 2.1 Scan Warranty context drift

- Focused handoff: `docs/api-contract/WWHN-180-posting-openapi.yaml` khai báo Scan context `WARRANTY`.
- Exact runtime: `Modules/Warehouse/app/Http/Controllers/ScanController.php` validate `INBOUND|OUTBOUND|STOCKTAKE|WARRANTY_TEMP_ONLY` và generated contract runtime cũng dùng `WARRANTY_TEMP_ONLY`.
- FE disposition: giữ `WARRANTY_TEMP_ONLY` vì đó là behavior source đang chạy; **không tự sửa sang `WARRANTY` chỉ vì focused artifact ghi khác**.
- Required external fix: `WWHN-180` phải reconcile/publish một nguồn canonical, changelog và independent approval.

### 2.2 Warranty TEMP_ONLY request-body drift

- Focused handoff TEMP_ONLY không mô tả request body.
- Exact runtime `WarrantyController.php` yêu cầu `temporary_item_code`, `missing_code_reason`, `condition_status`, kèm `Idempotency-Key` và một số field optional.
- FE disposition: không đoán schema mới để hợp thức hóa sign-off.
- Required external fix: BE1 cập nhật artifact canonical hoặc formal disposition, BA/independent reviewer approve đúng exact SHA/digest.

Hai finding này là lý do `WWHN-180` **không được tự suy diễn PASS** dù task status Jira có thể đã chuyển workflow state.

## 3. Root-cause runtime bugs FE đã xử lý

### 3.1 Mất `meta.request_id` sau HTTP unwrap

**Root cause:** shared `http.post()` chỉ trả `data`, trong khi BE v1.7 đặt audit identity ở `meta.request_id`. Receipt/issue/stocktake service sau đó lại yêu cầu `request_id` trong business payload, dẫn đến tình huống nguy hiểm: BE đã commit stock effect nhưng FE vẫn ném `WMS_FE_MISSING_*_EVIDENCE`.

**Fix:**

- thêm `http.postWithMeta()` trả `{ data, meta }`;
- giữ API `post()` cũ cho caller bình thường;
- receipt/issue/stocktake dùng `postWithMeta()`;
- `request_id` lấy từ `meta.request_id`, chỉ fallback root field nếu BE có legacy payload;
- sửa blob-error parsing để best-effort đọc JSON bất kể reverse proxy gắn Content-Type không chuẩn.

**Files:** `src/shared/api/http.ts`, regression tests WWHN-181.

### 3.2 Post receipt / post issue sai contract atomic

**Root cause trước remediation:** FE gửi `{ lines:[...] }` + `Idempotency-Key` + `If-Match`, trong khi exact BE v1.7 post toàn bộ approved document, không validate request body và chỉ bắt buộc `Idempotency-Key`.

Hệ quả cũ:

- UI có thể nghĩ mình post subset nhưng BE post cả document;
- request hash idempotency bị phụ thuộc body FE tự tạo;
- `If-Match` tạo cảm giác có optimistic lock mà BE endpoint này không dùng;
- success evidence có thể mất `request_id` do lỗi shared HTTP ở mục 3.1.

**Fix:**

- service chỉ gửi atomic POST không body;
- chỉ dùng `Idempotency-Key` theo exact v1.7;
- FE preflight đọc detail và chặn nếu bất kỳ planned line nào chưa scan đủ, vì server post whole-document;
- backend vẫn là final authority về state/permission/transaction;
- movement evidence đọc từ `data.movements[]`, request identity từ `meta.request_id`;
- UI `lines` / `ifMatch` cũ chỉ được giữ optional trong type để tránh breaking compile; service tuyệt đối không serialize chúng vào canonical POST.

**Files:**

- `src/modules/receiving/services/receivingService.ts`
- `src/modules/receiving/types/index.ts`
- `src/modules/shipping/services/shippingService.ts`
- `src/modules/shipping/types/index.ts`

### 3.3 Inbound / outbound line-scan gửi sai payload

**Root cause trước remediation:** UI scan raw code, service gọi line-scan với `{ codes:[...] }`; exact BE endpoint `.../{id}/scan` yêu cầu `{ line_id, qty }`.

**Fix canonical hai bước:**

1. Gọi `POST /scan/classify` bằng raw code + context + warehouse UUID. Endpoint này phải read-only: `stock_effect=NONE`, `movement_created=false`, `posting_event_created=false`, `idempotency_cache_written=false`.
2. Dùng `product_id` được BE resolve để tìm **đúng một** remaining line trong document, rồi gọi line-scan `{ line_id, qty }`.

Fail-closed cases mới:

- raw codes duplicate;
- classify không resolve được `product_id`;
- không có line matching;
- nhiều line matching cùng product => ambiguous, yêu cầu explicit line selection thay vì tự chọn sai;
- line-scan response báo stock effect/movement => reject.

Action permission được kiểm riêng: `scan.inbound` / `scan.outbound`; classifier vẫn yêu cầu `scan.classify`. FE guard chỉ defense-in-depth, BE vẫn phải trả 403 cho direct unauthorized request.

### 3.4 Stocktake apply-adjustment sai path, payload và CAS

**Root cause trước remediation:** FE dùng `/stocktake/sessions/{id}/apply-adjustment`, body `{ lines:[{sku,actual_qty}] }` và `If-Match`. Exact BE runtime dùng `/stocktake-sessions/{id}/apply-adjustment`, body `{ session_version, variance_ids, reason }`, `Idempotency-Key`, CAS bằng `session_version` trong body.

BE còn yêu cầu `variance_ids` là **toàn bộ tập APPROVED** của session; hand-picked subset bị 422.

**Fix:**

- endpoint constants chuyển sang canonical `/stocktake-sessions/...`;
- ngay trước apply, FE re-read `/stocktake-sessions/{id}/variances`;
- chỉ lấy status `APPROVED` và bắt buộc non-empty;
- bắt duplicate variance IDs;
- gửi complete set + positive integer `session_version` + reason;
- bỏ `If-Match` khỏi action này;
- response chỉ chấp nhận exact status `APPLIED`;
- `movement_ids` có thể rỗng ở zero-effect dimension; `meta.request_id` vẫn bắt buộc;
- total variance UI được tính từ exact approved set đã đọc, không từ draft line FE cũ.

**Files:** `src/modules/stocktake/services/stocktakeService.ts`, `src/modules/stocktake/types/index.ts`, `src/shared/api/endpoints.ts`.

## 4. Contract helpers và API mapping được làm sạch

`src/shared/api/wms-contract.ts` đã tách:

- `requireIdempotencyKeyHeader()` cho endpoint thật sự chỉ yêu cầu idempotency;
- `requireIdempotencyHeaders()` giữ compatibility cho endpoint thật sự dùng cả `If-Match`;
- `requirePositiveInteger()` cho `session_version` CAS.

Điều này loại bỏ anti-pattern cũ: một helper chung tự ép `If-Match` lên tất cả stock-changing endpoint dù contract mỗi action khác nhau.

`docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json` được nâng schema và khóa 6 critical flow thực tế:

1. scan classify;
2. inbound line scan;
3. outbound line scan;
4. post receipt;
5. post issue;
6. stocktake apply-adjustment.

`wms-contract:verify` cũng được cập nhật để CI không hard-code lại endpoint/payload cũ.

## 5. Regression suite chống tái phát

`src/test/wms-contract-signoff-guards.test.ts` khóa các case sau:

- exact BE SHA/version/manifest pin và hai BE handoff drifts;
- `/scan/classify` read-only invariants;
- FE action guard fail-closed trước HTTP;
- raw inbound/outbound code phải được classify trước, line-scan chỉ gửi `{line_id, qty}`;
- payload legacy `codes[]` không được gửi;
- duplicate line guard vẫn chặn intent lỗi trước HTTP;
- post receipt/issue phải no-body, `Idempotency-Key` only;
- incomplete whole-document scan bị chặn trước atomic post;
- success receipt/issue giữ movement evidence + `meta.request_id`;
- stocktake dùng complete APPROVED set, `session_version` body CAS, Idempotency-Key only;
- invalid session version / no approved variance fail-closed;
- permission alias boundary không dùng `stocktake.manage` thay `stocktake.adjust`;
- final sign-off luôn blocked ở source code cho đến independent evidence.

## 6. Exact-SHA CI / immutable evidence

Workflow riêng: `.github/workflows/wwhn-181-signoff.yml`.

Workflow bắt buộc:

1. checkout exact `${GITHUB_SHA}` và assert HEAD match;
2. reject BE SHA khác pin nếu chưa có source-review supersession;
3. install, format-check, lint, typecheck;
4. focused WWHN-181 regression test;
5. `npm run wms-contract:verify`;
6. production build + build manifest, health, API mapping;
7. validate direct-runtime evidence contract;
8. validate live UI evidence contract;
9. sinh exact evidence manifest theo `${GITHUB_SHA}`;
10. chạy `sha256sum -c` trên source files, `SHA256SUMS`, `manifest.json`;
11. chứng minh template independent gates **không thể** tự authorize final;
12. upload artifact `wwhn-181-exact-sha-evidence-<FE_SHA>`;
13. publish artifact ID/URL/`artifact-digest` vào GitHub Step Summary.

`verify-wwhn-181-exact-sha.mjs` ghi:

- exact FE SHA / BE SHA / contract version;
- BE parent, baseline, immutable manifest/release-pack/repository checksums;
- CI URL/run identity;
- source-review findings;
- FE runtime remediation flags;
- source file SHA256 list;
- `SHA256SUMS`, `SHA256SUMS.sha256`, `MANIFEST.sha256`, `IDENTITY.json`.

Không có source-controlled boolean nào có thể tự chuyển final thành PASS.

## 7. CI infrastructure hiện tại — không được nhầm thành code failure/PASS

Trước remediation commit, FE `m1` HEAD `aa185096...` có workflow run `31152844827`; job `92785933978` kết thúc failure nhưng không có executable step (`steps` rỗng/null). BE exact target cũng có cùng pattern pre-runner. Jira `WWHN-337` đang ghi blocker GitHub Actions runner/provisioning/billing/spending-limit.

Disposition:

- không gọi đây là lint/test/build failure vì runner chưa thực thi code;
- cũng **không gọi CI PASS**;
- sau closure commit, exact workflow phải được runner thực thi và PASS thật mới đóng P1 Exact SHA/CI.

## 8. Backend authorization evidence

Frontend guards không phải security authority. `WWHN-182`/BE QA evidence phải chứng minh bằng direct requests thật:

- actor thiếu canonical permission => HTTP `403`;
- warehouse/data scope ngoài quyền => deny;
- runtime permission catalog đúng exact BE build;
- alias không mở rộng capability ngoài mapping approved;
- denied request có `request_id` để trace;
- denied request không tạo business-row/stock side effect.

Ảnh button hidden/disabled chỉ là UX evidence và không thể thay server authorization proof.

## 9. QA2 runtime WWHN-182

Trước khi có credentials, validate runner contract:

```bash
npm run wwhn-153:runtime -- --contract-only
```

QA2 real DEV/UAT phải chạy cùng exact identity và attach raw/sanitized artifacts cho:

- happy;
- negative;
- backend RBAC 403;
- data-scope deny;
- idempotency replay;
- same-key different-payload conflict 409;
- stale/CAS conflict;
- retry/double-post/race;
- DB before/after;
- reconcile zero mismatch.

Không dùng `LOCAL`, `CI`, `MOCK`, `TEST`, `SYNTHETIC` làm release runtime evidence.

## 10. P2 live UI evidence — collector thật, không mock

Script: `scripts/run-wwhn-181-runtime-ui-evidence.mjs`.

Contract check:

```bash
npm run wwhn-181:ui-runtime -- --contract-only
```

Real collector:

- mở real DEV/UAT URL bằng Playwright;
- dùng storage-state file từ environment, không commit token/session;
- không gọi `page.route()` hoặc install mock/interception;
- bắt buộc viewport `1920x1080`, `1366x768`, `1024x768`, `768x1024`, `390x844`;
- capture full-page screenshot + video mỗi scenario;
- kiểm page-level horizontal overflow;
- chỉ ghi network trace tối thiểu: scenario, method, `/api/v1/...` path, status, `error_code`, `request_id`;
- không ghi Authorization, Cookie, query string, request body hoặc response body;
- P2 chỉ PASS nếu tất cả required scenario PASS và có ít nhất một **real API error** với `request_id`.

Chi tiết environment/schema ở `docs/evidence/WWHN-181/RUNTIME_EVIDENCE_CHECKLIST.md`.

## 11. Final gate evaluator — không còn PASS bằng prose

Template: `docs/evidence/WWHN-181/FINAL_GATE_EVIDENCE.template.json`.

Evaluator:

```bash
npm run wwhn-181:final -- path/to/FINAL_GATE_EVIDENCE.json
```

Máy chỉ cho `final_allowed=true` khi:

- identity có exact FE 40-hex SHA, exact BE SHA v1.7, BE manifest digest và exact artifact name;
- CI PASS, `SHA256SUMS` PASS, artifact digest hợp lệ;
- `WWHN-180 PASS` cùng identity, reviewer khác publisher, có evidence URL;
- `WWHN-182 PASS` cùng identity và từng proof happy/negative/RBAC/data-scope/replay/conflict/race/DB/reconcile đều PASS;
- `WWHN-183` cùng identity, decision `GO`, open P0=`0`, open P1=`0`;
- live UI PASS cùng identity, real API error request_id PASS, responsive PASS, sanitized HAR PASS.

Nếu thiếu bất kỳ field nào, result là BLOCKED.

## 12. BA G1 WWHN-183

BA record tối thiểu:

```text
Decision: GO | CONDITIONAL_GO | NO_GO
Exact FE SHA: <closure SHA>
Exact BE SHA: fc534ed8c00dadd91ce60e7bac5a8660dda74d08
Contract version: 1.7.0
CI URL: <exact run URL>
Artifact: wwhn-181-exact-sha-evidence-<FE_SHA>
Artifact digest: <GitHub upload-artifact digest>
Manifest digest: <FE manifest SHA256>
Open P0 count: <n>
Open P1 count: <n>
Conditions: <conditions or NONE>
Owner / due date: <owner/date>
Evidence URLs: <WWHN-180 / WWHN-182 / UI runtime / authorization>
```

Final evaluator yêu cầu `GO` + P0/P1 = 0. `CONDITIONAL_GO` vẫn là release blocked.

## 13. P0/P1/P2 closure matrix hiện tại

| Sev | Vấn đề | Root fix / control đã hoàn tất phía FE | Còn thiếu để final | Owner external |
| --- | --- | --- | --- | --- |
| P0 | Final FE sign-off chưa hợp lệ | exact identity + fail-closed evaluator; không thể source-self-sign | `WWHN-180 PASS`, `WWHN-182 PASS`, `WWHN-183 GO` cùng identity | FE1 + BA + QA2 |
| P0 | Contract v1.7 chưa approved độc lập | independent source compare đã tìm 2 drift và ghi machine-readable | BE reconcile source + independent approval/artifact/digest/changelog | BE1 + BA |
| P1 | Exact SHA/CI | workflow exact checkout, manifest, SHA256SUMS, artifact digest publication | runner phải thực thi PASS; `WWHN-337` hiện block infra | FE1 + BE1 + DevOps |
| P1 | QA2 runtime | direct runner contract + exact matrix/checklist | QA2 chạy real build/env và attach evidence | QA2 |
| P1 | BA G1 | final schema/evaluator khóa GO + open counts + identity | BA decision thật sau QA/contract | BA |
| P1 | Backend authorization | FE action guards + explicit backend-authority boundary | direct 403/data-scope/runtime catalog/no-side-effect | BE/RBAC + QA2 |
| P2 | Runtime UI evidence | live no-mock collector + 5 viewport + screenshot/video/request_id/HAR checksum | chạy real DEV/UAT exact build | FE1 + QA2 |

## 14. Commands local/CI

```bash
npm run format:check
npm run lint
npm run typecheck
npx vitest run src/test/wms-contract-signoff-guards.test.ts
npm run wms-contract:verify
npm run build
npm run health:check
npm run check:api-mapping
npm run wwhn-153:runtime -- --contract-only
npm run wwhn-181:ui-runtime -- --contract-only
WMS_SOURCE_SHA=<EXACT_FE_SHA> npm run wwhn-181:verify -- fc534ed8c00dadd91ce60e7bac5a8660dda74d08
npm run wwhn-181:final -- path/to/FINAL_GATE_EVIDENCE.json
```

## 15. Final disposition

Phần FE-owned đã được xử lý ở tầng runtime contract, validation, permission boundary, response evidence, regression test, exact-SHA CI, checksum chain, live UI collector và final-gate evaluator. Remediation không chỉ đổi tài liệu hay boolean sign-off.

Tuy nhiên **không được ghi 100% final ở thời điểm commit này** vì:

1. exact BE v1.7 handoff còn hai source drifts cần WWHN-180 resolve/approve độc lập;
2. `WWHN-337` đang chặn GitHub Actions runner nên chưa có exact closure CI PASS/artifact digest từ run thật;
3. `WWHN-182` chưa có QA2 runtime PASS;
4. `WWHN-183` chưa có BA `GO` trên cùng identity.

Trạng thái chính xác: **FE remediation complete at critical integration layer; release sign-off BLOCKED / fail-closed pending independent and infrastructure gates**. Đây là trạng thái an toàn để tránh "remove flag" bằng evidence giả rồi phát sinh lỗi runtime khác.
