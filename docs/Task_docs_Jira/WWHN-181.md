# WWHN-181 — FE1 Xác minh ánh xạ / payload / lỗi

## 1. Kết luận kiểm soát

| Trường | Giá trị |
| --- | --- |
| Task | `WWHN-181` |
| Parent | `WWHN-40` — HN-INT-001 |
| Branch bắt buộc | `m1` |
| BE contract | v1.5.0 — exact SHA `54d5f4ff9cbaa678e16dcf322bd55836e177409a` |
| FE SHA BE đã quan sát | `5cd10ec46021cecd24949075cb4eeefaa1fcc9b2` |
| FE SHA closure | Commit duy nhất tạo từ thay đổi này; CI tự bind bằng `GITHUB_SHA` |
| FE independent review | **CONDITIONAL PASS — NOT FINAL** |
| Final FE sign-off | **FAIL-CLOSED** |
| Điều kiện final | `WWHN-180 PASS` + `WWHN-182 QA2 PASS` + `WWHN-183 BA decision` trên cùng exact build pair |

FE1 đã review lại contract BE v1.5.0 theo exact BE SHA mới. Evidence cũ của BE SHA `f37219...` hoặc FE implementation task `WWHN-153` không được dùng thay cho sign-off WWHN-181.

## 2. Phân tách traceability WWHN-153 và WWHN-181

| Task | Mục đích | Evidence hợp lệ | Không được suy diễn |
| --- | --- | --- | --- |
| `WWHN-153` | Chứng minh implementation guard/service/test phía FE | source code, unit/regression tests, API mapping | Không chứng minh independent contract sign-off |
| `WWHN-181` | Review exact BE contract, khóa final gate, tạo immutable exact-SHA evidence | exact FE+BE pair, CI URL, artifact, digest, review matrix | Không tự ký thay BE/QA2/BA |

Code chính thức dùng `implementationTask: WWHN-153` và `signoffTask: WWHN-181`; không còn gộp hai task vào một trường `task`.

## 3. Closure matrix P0/P1/P2

| Sev | Finding | Root fix đã thực hiện | Evidence | Disposition |
| --- | --- | --- | --- | --- |
| P0 | Final FE sign-off | `WMS_FINAL_SIGNOFF.finalAllowed=false`; dependency chỉ rõ WWHN-180/182/183; workflow kiểm tra final gate luôn fail-closed | `src/shared/api/wms-contract-signoff.ts`, workflow WWHN-181 | FE closed; external gates pending |
| P0 | Contract BE v1.5.0 | Khóa version + exact BE SHA; review scope riêng; không tái sử dụng evidence SHA cũ | `WWHN_181_EXACT_REVIEW` | Conditional pending independent gates |
| P1 | Exact SHA/CI | Workflow checkout exact `${{ github.sha }}`, nhận đúng BE SHA, sinh manifest SHA256, CI URL và artifact name | `.github/workflows/wwhn-181-signoff.yml`, verifier | Closed phía FE/CI |
| P1 | QA2 runtime | Checklist bao phủ happy/negative/RBAC/idempotency/retry/DB/reconcile và identity bắt buộc | `RUNTIME_EVIDENCE_CHECKLIST.md` | Prepared; QA2 execution pending |
| P1 | BA G1 | Format decision bắt buộc `GO/CONDITIONAL_GO/NO_GO`, open count, condition, owner, URL | mục 8 | Prepared; BA decision pending |
| P1 | Backend authorization | Ghi rõ FE guard chỉ UX; bằng chứng hợp lệ phải là direct API 403/data-scope/runtime catalog | code + checklist | BE/RBAC + QA pending |
| P1 | Traceability | Tách task implementation/sign-off, workflow và artifact prefix riêng WWHN-181 | code, workflow, matrix | Closed |
| P2 | Runtime UI evidence | Chuẩn hóa viewport, UI states, request_id, HAR sanitized, build/env/tester | checklist | Prepared; runtime capture pending |

## 4. Exact contract review v1.5.0

| Flow | Method/path FE | Contract/permission disposition | FE review |
| --- | --- | --- | --- |
| Scan classify | `POST /api/v1/scan/classify` | `scan.classify`; payload/response validation giữ fail-closed | PASS phía mapping |
| Post receipt | `POST /api/v1/inbound-documents/{id}/post-receipt` | FE `inbound.post` tương thích BE canonical `stock_document.post`; bắt buộc `Idempotency-Key` + `If-Match` | PASS phía FE mapping; BE runtime pending |
| Post issue | `POST /api/v1/outbound-documents/{id}/post-issue` | FE `outbound.post` tương thích BE canonical `stock_document.post`; bắt buộc `Idempotency-Key` + `If-Match` | PASS phía FE mapping; BE runtime pending |
| Apply adjustment | `POST /api/v1/stocktake/sessions/{id}/apply-adjustment` | `stocktake.adjust`; optimistic locking/idempotency | PASS phía mapping; runtime pending |
| Scan inbound/outbound | action guards `scan.inbound` / `scan.outbound` | Alias visibility về BE `stock_document.scan`; không thay middleware | CONDITIONAL pending direct 403 proof |
| Warranty TEMP_ONLY | `warranty.temp_only` | Exact permission | CONDITIONAL pending runtime proof |
| Reconcile/report | `report.view` / export action riêng | FE visibility không thay data-scope | CONDITIONAL pending DB/reconcile proof |

## 5. CI và immutable evidence

Workflow riêng: `.github/workflows/wwhn-181-signoff.yml`.

Workflow thực hiện:

1. Checkout đúng commit `m1` bằng `${{ github.sha }}`.
2. `npm ci`, format, lint, regression test liên quan, build, health và API mapping.
3. Xác minh BE SHA đúng `54d5f4ff9cbaa678e16dcf322bd55836e177409a`.
4. Sinh `docs/evidence/WWHN-181/exact-sha-manifest.json` từ commit chạy thật.
5. Tính SHA256 cho source sign-off, FE contract baseline, tài liệu và runtime checklist.
6. Upload artifact `wwhn-181-exact-sha-evidence-<FE_SHA>` với retention 90 ngày.

Manifest chứa CI URL, run ID/attempt, exact FE+BE SHA, artifact name, digest và trạng thái external gates. Không điền tay current FE SHA vào source vì commit tự tham chiếu không thể biết trước SHA của chính nó; CI bind SHA sau commit là nguồn đúng.

## 6. Backend authorization boundary

Frontend permission guard chỉ phục vụ UX và defense-in-depth. Final evidence bắt buộc có:

- direct API `403` từ actor thiếu canonical permission;
- data-scope denial ở company/branch/warehouse không thuộc phạm vi;
- `/permissions` hoặc runtime catalog đúng exact BE build;
- role không có canonical capability không nhận alias;
- audit/request_id cho request bị deny;
- không có business-row side effect khi bị deny.

Ảnh nút ẩn/disabled không thay thế được server-side authorization proof.

## 7. QA2 runtime package

QA2 phải chạy trên exact FE SHA từ manifest, BE SHA v1.5.0, deployment/build ID cụ thể và environment cụ thể. Matrix tối thiểu gồm happy, validation, 401/403, duplicate/idempotency replay, 409 conflict, 412 stale, 428 precondition, retry, DB before/after, audit row và reconciliation.

Responsive/UI capture: `1920x1080`, `1366x768`, `1024x768`, `768x1024` và mobile; chứng minh loading, empty, success, validation, forbidden, conflict/stale, disabled/confirm và retry. HAR phải sanitized nhưng giữ method/path/status/error_code/request_id/timing.

## 8. BA G1 decision template

```text
Decision: GO | CONDITIONAL_GO | NO_GO
Exact FE SHA: <manifest frontend_sha>
Exact BE SHA: 54d5f4ff9cbaa678e16dcf322bd55836e177409a
CI URL: <url>
Artifact: wwhn-181-exact-sha-evidence-<FE_SHA>
Manifest digest: <canonical_payload_sha256>
Open P0 count: <n>
Open P1 count: <n>
Conditions: <condition or NONE>
Owner / due date: <owner / date>
Evidence URLs: <WWHN-180, WWHN-182, runtime, BE authorization>
```

BA chỉ được ghi `GO` khi P0/P1 bắt buộc đã đóng trên cùng exact build pair. Nếu còn external evidence, dùng `CONDITIONAL_GO` hoặc `NO_GO` với owner và điều kiện rõ ràng.

## 9. Commands/gates

```bash
npm ci
npm run format:check
npm run lint
npm run test -- --run src/test/wms-contract-signoff-guards.test.ts
npm run build
npm run health:check
npm run check:api-mapping
WWHN_181_BE_SHA=54d5f4ff9cbaa678e16dcf322bd55836e177409a FE_SHA=<40-char-fe-sha> node scripts/verify-wwhn-181-exact-sha.mjs
```

## 10. Final disposition

FE-owned P0/P1/P2 remediation đã được xử lý ở mức code, traceability, CI, exact-SHA manifest và runtime handoff. Tuy nhiên kết quả **không được ghi 100% final** trước khi ba bằng chứng độc lập WWHN-180, WWHN-182 và WWHN-183 hoàn tất. Trạng thái chính xác hiện tại là **CONDITIONAL PASS — NOT FINAL**, với final gate được khóa triệt để để tránh sign-off sai hoặc tái sử dụng evidence cũ.
