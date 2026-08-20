# WWHN-153 — Runbook QA2 direct runtime/API evidence v2

## Mục tiêu

Tạo bằng chứng WWHN-182 trên đúng FE commit, immutable build và môi trường DEV/UAT có backend thật. Runner gọi HTTP trực tiếp, không dùng mock/browser, không lưu credential và không chấp nhận boolean “không có side effect” nếu thiếu phép đo before/after.

## Lệnh

```bash
npm run wwhn-153:runtime -- --contract-only
npm run wwhn-153:runtime
```

Live run bắt buộc:

```text
WWHN_153_API_BASE_URL=https://<dev-or-uat>/api/v1
WWHN_153_ENVIRONMENT=DEV|UAT
WWHN_153_SOURCE_SHA=<40-hex FE SHA>
WWHN_153_BUILD_ID=<immutable deployed build id>
WWHN_153_QA2_ACCOUNT=<QA2 identity>
WWHN_153_DENIED_TOKEN=<credential không có quyền>
WWHN_153_ALLOWED_TOKEN=<credential có quyền>
WWHN_153_PERMISSION_DENY_PROBE_JSON=<JSON>
WWHN_153_IDEMPOTENCY_PROBE_JSON=<JSON>
WWHN_153_STALE_PROBE_JSON=<JSON>
```

## Probe contract

Mỗi probe phải có `effectProbe` đọc trạng thái business/resource bằng allowed credential. `valuePath` là JSON path dạng `$.data.version`, `$.data.count` hoặc `$`.

```json
{
  "method": "POST",
  "path": "/warranty-cases/{id}/temp-only",
  "body": {"missing_code_reason": "...", "manual_product_description": "..."},
  "effectProbe": {
    "method": "GET",
    "path": "/warranty-cases/{id}",
    "valuePath": "$.data.version",
    "expectedStatuses": [200]
  }
}
```

Ghi chú: `/stocktake/*` không tồn tại và không được dùng làm ví dụ — REQ-SRS-037 cấm mọi entity/API/permission Stocktake trong MVP (xem `WWHN-153_ARCHITECTURE_ALIGNMENT.md`). Probe thật phải trỏ vào một trong 5 hành động nhạy cảm đã khóa: `post-receipt`, `post-issue`, `report export-excel`, `warranty temp-only`, `scan classify`.

Idempotency probe bổ sung `changedBody`, `idempotencyKey` và có thể có `ifMatch`. Stale probe bổ sung `staleIfMatch` và có thể có `idempotencyKey`.

## Assertions bắt buộc

| Scenario | Điều kiện PASS |
| --- | --- |
| `PERMISSION_DENY_403` | Direct API trả `403`, có request_id; effect hash trước và sau giống nhau. |
| `IDEMPOTENCY_REPLAY` | Hai request cùng key/payload đều 2xx, cùng business result; effect hash sau lần đầu bằng sau replay. |
| `IDEMPOTENCY_CONFLICT` | Cùng key, payload khác trả `409`, có request_id. |
| `STALE_WRITE` | `If-Match` cũ trả `409/412`, có request_id; effect hash trước và sau giống nhau. |
| `PERMISSION_CATALOG` | GET `/permissions` 2xx, có request_id, không thiếu code trong `WMS_PERMISSION_CATALOG`. |

## Artifact contract

Runner sinh:

- file request và response riêng cho từng call, mỗi file có SHA256;
- `WWHN-153_RUNTIME_API_SUMMARY.json` chứa source/build/env/QA2, scenario, request_id, effect proof và permission reconciliation;
- `SHA256SUMS` cho toàn bộ JSON evidence;
- `WWHN-153_RUNTIME_ARTIFACT_DIGEST.txt` = SHA256 của nội dung `SHA256SUMS`;
- secret hygiene PASS sau khi quét raw token, Bearer chưa redact và JWT-like material.

QA2 attach nguyên artifact GitHub Actions vào WWHN-182. Không copy/paste riêng screenshot để thay package.

## Binding sang permission approval và BA G1

- `PERMISSION_CATALOG.responseArtifacts[0].sha256` phải bằng `runtimeCatalogSnapshot.sha256` trong `WWHN-153_PERMISSION_APPROVAL.json`.
- Source SHA/build/env/artifact digest/summary/SHA256SUMS phải giống giữa WWHN-182 và permission approval.
- BA chỉ ghi `GO` sau khi exact SHA và artifact digest khớp, open P0/P1 = 0.

## Ranh giới trách nhiệm

FE cung cấp runner/verifier. QA2 tự chạy bằng môi trường và credential QA. BE/RBAC + BA duyệt catalog. FE không tự ký thay BE/QA/BA và final vẫn fail-closed khi evidence còn `PENDING`.
