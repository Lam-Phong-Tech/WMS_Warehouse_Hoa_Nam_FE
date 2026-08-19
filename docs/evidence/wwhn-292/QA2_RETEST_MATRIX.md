# WWHN-292 — QA2 retest matrix (R2, 2026-08-19)

**Evidence class: QA2_LOCAL_RETEST_NOT_UAT_ENV** — retest độc lập theo defect/role/browser/
viewport tại **exact FE candidate SHA `9d87628ba717b835b2b211cfba2349e9aa221d07`** (nhánh
`m1`), cặp với BE runtime evidence tại BE SHA `5db3cb06…` (xem `BE_AUTHZ_EVIDENCE_REF.md`).
Đây KHÔNG phải bằng chứng môi trường DEV/UAT do DevOps vận hành; khi môi trường đó tồn tại
(WWHN-287/WWHN-293), QA2 rerun đúng matrix này trên đó.

## 1. Định danh lần chạy

| Trường | Giá trị |
| --- | --- |
| FE SHA (exact, frozen) | `9d87628ba717b835b2b211cfba2349e9aa221d07` |
| Run id | xem `final/LOCAL_RUN_ID` |
| Browser | chromium (Playwright project `chromium`) |
| Máy / OS | DESKTOP-M4G9NRS / Windows 11 Home 10.0.22631 |
| Node | v22.17.1 |
| Server | vite dev `http://localhost:5292` phục vụ đúng working tree = candidate SHA |
| Thời điểm | 2026-08-19 ~11:52–11:57 UTC |
| Kết quả tổng | **25/25 PASS** (raw log: `final/LOCAL_GATE_LOG.md` §7) |
| Screenshot/metadata | 25 PNG + 25 JSON tại `qa2/9d87628ba717b835b2b211cfba2349e9aa221d07/` (mỗi JSON ghi sourceSha/role/viewport/route/timestamp/assertions) |

## 2. Ánh xạ defect → scenario retest

| Defect | Scenario (e2e) | Role | Viewport | Kết quả |
| --- | --- | --- | --- | --- |
| DEF-292-01 (tablet 768x1024) | `required login viewport 768x1024` + `authenticated shell responsive 768x1024` | anonymous / super_admin_controlled | 768x1024 | PASS |
| DEF-292-02 (shell responsive) | `authenticated shell responsive {1440x900, 1280x900, 768x1024, 375x812}` — no horizontal overflow + hợp đồng aside 300px/breakpoint 980px | super_admin_controlled | 4 viewport | PASS (4/4) |
| DEF-292-03 (RBAC matrix) | 13 × `direct URL <route> fails closed for a limited role` + 2 positive control (`/inventory`, `/reverse` read semantic WWHN-242) | inventory_viewer_controlled (chỉ `inventory.view`) | 1440x900 | PASS (15/15) |
| DEF-292-04..06 (governance) | `wwhn-292:verify` + `wwhn-292:verify:final` (identity pack, defect register, hash) | n/a | n/a | PASS |
| Hợp đồng lỗi §8.2 phía FE | `shared component states are explicit and retry-safe` + `controlled login 422 remains visible and retry enabled` | super_admin_controlled / anonymous | 1440x900 | PASS |
| Login responsive | `required login viewport {1440x900, 768x1024, 375x812}` | anonymous | 3 viewport | PASS (3/3) |
| Menu + direct URL fail-closed (mẫu) | `limited role menu and direct URL fail closed to 403` | inventory_viewer_controlled | 1440x900 | PASS |

Tổng scenario: 3 login + 4 shell + 1 shared-states + 1 menu/403 + 1 login-422 + 13 deny
matrix + 2 positive control = **25**.

## 3. Ghi chú độc lập & ranh giới

- Suite chạy qua mock API có kiểm soát cho hành vi FE; enforcement thật của backend
  (401/403/data-scope kèm `request_id`) được chứng minh RIÊNG bằng raw direct-API trên BE
  runtime thật + lượt QA1 độc lập — `BE_AUTHZ_EVIDENCE_REF.md`.
- `/reverse` là positive control theo semantic đọc WWHN-242 (SRS §3 cấp V qua
  `inventory.view`); suất deny thứ 13 là IAM-02 `/system/roles`.
- Ảnh và metadata sinh tự động từng scenario; hash toàn bộ pack tại `final/SHA256SUMS`.
