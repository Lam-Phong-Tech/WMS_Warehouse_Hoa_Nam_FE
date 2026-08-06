# WWHN-153 — Architecture alignment với WMS Hoa Nam Dev Guide

Ngày đối chiếu: 2026-08-06.

## Nguồn kỹ thuật được áp dụng

- React/Vite/TypeScript SPA; API đi qua shared HTTP client.
- Permission code là authority identifier; role chỉ là mapping. Backend luôn là security boundary.
- Route guard là UX gate; action thay đổi dữ liệu phải có permission hẹp và backend direct API phải trả 403 khi thiếu quyền.
- CI phải khóa exact source SHA, build, test và immutable evidence.

## Canonical permission source

Nguồn code duy nhất là `src/shared/constants/wms-permissions.ts`. Các ví dụ permission trong Dev Guide không phải catalog đầy đủ. Ba action nhạy cảm bắt buộc:

| Action | Permission hẹp |
| --- | --- |
| Apply stocktake adjustment | `stocktake.adjust` |
| Export inventory XNT | `report.export` |
| Create TEMP_ONLY warranty | `warranty.temp_only` |

`stocktake.manage` không được dùng thay `stocktake.adjust`. Runtime `/permissions` phải reconcile với toàn bộ `WMS_PERMISSION_CATALOG`; hash response được bind vào permission approval.

## Evidence architecture

Chuỗi provenance: `repository + m1 + source SHA + execution SHA + parent SHA + tree SHA + workflow run + artifact name`. Final SHA không được hard-code trong chính commit; GitHub Actions derive từ immutable checkout.

Chuỗi contract: official OpenAPI/schema → exact SHA256 → QA1 reviewedArtifacts → WWHN-151 module schema → QA2 runtime package → permission approval → BA G1. Bất kỳ mismatch nào đều block final.

## Runtime architecture

Runtime proof dùng direct HTTP và effect probe:

- denied/stale: before hash = after hash;
- idempotency: after-first hash = after-replay hash;
- request/response tách artifact;
- request_id bắt buộc;
- token/cookie/JWT bị redact và scan trước packaging.
