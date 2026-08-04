# HN-UX-002 — Closure matrix cho review 72/100

Cập nhật: 2026-08-04 ICT  
Canonical FE task evidence: `docs/Task_docs_Jira/WWHN-148.md`

## Trạng thái chính xác

FE repository có thể đóng toàn bộ remediation thuộc quyền kiểm soát FE1, nhưng final 100/100 vẫn phụ thuộc evidence độc lập. Tại thời điểm rà soát Jira:

- `WWHN-146` — BAS field/state matrix: `To Do`.
- `WWHN-147` — BA rule/label/validation: `To Do`.
- `WWHN-149` — QA2 testability review: `To Do`.
- BE1/BE2 contract, permission catalog và negative/idempotency samples: chưa final.

## Ma trận P1/P2

| Mức | Vấn đề | FE disposition | External gate |
| --- | --- | --- | --- |
| P1 | HN-UX-002-ST01 chưa chốt | Canonical document ghi owner/evidence và giữ final fail-closed | BAS `WWHN-146` + BA `WWHN-147` |
| P1 | QA2 chưa review testability | Controlled browser evidence mở rộng cho states/responsive/RBAC/422 | QA2 `WWHN-149` chạy named build và comment pass/fail |
| P1 | Thiếu `M1_API_MAPPING.md` | File được khôi phục; `check:api-mapping` và `wwhn-148:verify` bắt buộc trong CI | BE/BA approval cho conditional mappings |
| P1 | Contract/permission/sample data conditional | Critical FE guards, fail-closed endpoints và evidence boundary đã khóa | BE1/BE2 cung cấp OpenAPI/catalog/403/409/422/idempotency samples |
| P1 | Runtime evidence chưa đủ | CI capture 3 viewport, component states, limited-role 403 và API 422 | QA2 xác minh backend thật trên exact build/env |
| P2 | Service normalization fallback | Normalization register đóng băng read aliases; critical success fields canonical-first với explicit alias whitelist đóng băng | Cleanup cuối sau BE lock contract |
| P2 | Vite/Vitest config warning | Config tách riêng, ESM-safe; static gate chặn regression | Không cần dependency upgrade trong scope này |

## Final sign-off rule

Không chuyển HN-UX-002/WWHN-148 thành final pass chỉ dựa trên FE controlled evidence. Final pass cần đủ BAS, BA, QA2 và BE evidence được liệt kê trong `WWHN-148.md`.
