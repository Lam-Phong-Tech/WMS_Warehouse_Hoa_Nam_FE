# WWHN-181 Runtime Evidence Checklist

## Run identity — bắt buộc điền

| Field | Value |
| --- | --- |
| FE repository | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` |
| FE exact SHA | `<40-char SHA from manifest>` |
| BE repository | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE` |
| BE exact SHA | `54d5f4ff9cbaa678e16dcf322bd55836e177409a` |
| BE contract version | `1.5.0` |
| CI URL | `<GitHub Actions run URL>` |
| Artifact | `wwhn-181-exact-sha-evidence-<FE_SHA>` |
| Artifact/manifest digest | `<canonical_payload_sha256>` |
| Environment/build | `<DEV/UAT + deployment/build id>` |
| Browser/device | `<browser/version/viewport>` |
| Tester | `<QA2 identity>` |
| Execution time | `<ISO-8601 +07:00>` |

Không chấp nhận evidence nếu thiếu exact SHA, build/environment hoặc dùng evidence của WWHN-153 thay cho WWHN-181.

## Test matrix bắt buộc

| Area | Positive | Negative / security | Evidence |
| --- | --- | --- | --- |
| Scan classify | valid code batch, response count/status/request_id | duplicate, unknown, invalid, 401/403, timeout/retry | screenshot/video + sanitized request/response/HAR |
| Post receipt | success, movement_ref, request_id | missing/duplicate Idempotency-Key, 409 replay/conflict, 412 stale, 428 precondition, 403/data-scope | API log + DB before/after + audit row |
| Post issue | success, movement_ref, request_id | same negative matrix as receipt | API log + DB before/after + audit row |
| Apply adjustment | success, adjusted lines, movement_ref | stale version, duplicate replay, invalid line, 403/data-scope | API log + DB/reconcile proof |
| Permission aliases | canonical roles see allowed actions | role without canonical capability gets no alias and direct API 403 | `/permissions` response + API proof |
| Reconcile | UI/API totals match source DB | mismatch is visible and traceable | query/result/request_id |

## Responsive/UI states

Capture at minimum `1920x1080`, `1366x768`, `1024x768`, `768x1024` and one mobile viewport. For each critical flow prove loading, empty, success, validation error, forbidden, conflict/stale, disabled/confirm and retry state where applicable.

## Sanitization rules

Remove access tokens, cookies, passwords, personal data and infrastructure secrets. Keep method, path, status, safe headers, request_id/correlation_id, payload shape, error_code and timing. Record the sanitization method and original evidence custodian.

## Gate ownership

FE1 supplies code, exact-SHA manifest, UI support and traceability. QA2 independently executes runtime tests. BE/RBAC proves server-side authorization/data scope. BA records `GO`, `CONDITIONAL_GO` or `NO_GO`. FE1 must not mark final on behalf of those roles.
