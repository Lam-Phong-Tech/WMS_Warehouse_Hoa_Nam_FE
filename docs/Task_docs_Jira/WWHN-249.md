# WWHN-249 — App PV: mặt công khai vs mặt xác thực

## Scope

- Jira: WWHN-249. Liên quan: WWHN-19 / WWHN-251 (ma trận actor), WWHN-65 (AC1–3),
  WWHN-250 (QA1), WWHN-252 (hiện thực read model + UI App PV trên cùng nhánh).
- Branch: **`m1` only**. Không tạo nhánh riêng. Pin cũ `m1-be-2` trên Jira không
  còn là nguồn canonical.
- File này là chỉ mục bằng chứng trong source control. Nó **không** phải UAT và
  **không** thay QA1 (WWHN-250).

## Baseline đã đọc

1. `docs/HN_SRS_FRD_v1.12_FULL.md` — §2 `SRC-008`/`DR-PLAT-001`, §3 ma trận actor,
   §8.1 nhóm PV, §12 bảng Security, Annex C (8 operation PV).
2. `docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html` — SCR-PV-01/02,
   SCR-PV-ADM-01.
3. `docs/HoaNam_ERD_Moi_Nhat.md` — bảng 51 `pv_product_profiles`, 52
   `pv_product_images`, 53 `pv_industries`, 54 `pv_tags`, 55
   `pv_product_industries`, 56 `pv_product_tags`, 57 `pv_recommendation_rules`.
4. `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`.

## Kết luận nghiệp vụ chốt cho task này

App PV có **hai nửa với hai biên bảo mật khác nhau**, và trước WWHN-249 chỉ có
nửa đầu tồn tại một phần:

| Nửa | Endpoint | Bảo mật | Nguồn |
| --- | --- | --- | --- |
| Công khai | `GET /pv/products`, `/pv/products/{sku_id}`, `/pv/industries`, `/pv/recommendations` | `PUBLIC_ANONYMOUS` (`security: []`) | SRS §8.1 nhóm PV; §12 bảng Security; `SRC-008` "App PV anonymous"; §3 actor "Người xem App PV" = read-only published |
| Xác thực | `PATCH /pv/products/{sku_id}/publish` | `pv.publish` | §3 dòng "Publish PV / Reports"; §12 "PATCH publish remains bearer + pv.publish" |
| Xác thực | `GET/POST /pv-admin/resources/{resource_type}`, `PATCH .../{id}` | `pv.master.manage` (+ `If-Match`) | Annex C; §3 dòng "PV Industry/Tag/Product Mapping/Recommendation Rule manage" |

Vì vậy nhận định "PV routes public trong khi parent yêu cầu login" trong register
đúng **một nửa**: phần đọc được phép ẩn danh theo hợp đồng, nhưng việc mở ẩn danh
chỉ hợp lệ khi có đủ 4 ràng buộc bù — rate limit, DTO chỉ đọc, cache ≤60s kèm
`data_as_of`, và không có stock effect.

## Bằng chứng đóng task

Nằm ở repo BE, tại đúng SHA pin:

| Gate | Bằng chứng | Kết quả mong đợi |
| --- | --- | --- |
| Mặt công khai fail-closed | `tests/Feature/Wwhn249PvSurfaceGovernanceTest.php` | tập route ẩn danh của **toàn hệ thống** = đúng 9 route đã khai |
| Rate limit nhóm PV | cùng bộ test | mọi `api/v1/pv/*` ẩn danh đều có `throttle:pv-public` |
| Quyền nhóm xác thực | cùng bộ test | `pv-admin` = `auth:api` + `pv.master.manage`; publish = `pv.publish` (không còn nhánh `|sku.manage`) |
| Không stock effect | cùng bộ test | ledger + tồn kho không đổi sau toàn bộ lưu lượng public |
| OpenAPI §12 | cùng bộ test | 4 GET public khai `security: []`; phần còn lại `bearerAuth`; `If-Match` được khai cho `updatePvAdminResource` |
| Hợp đồng nghiệp vụ | `tests/Feature/Wwhn252PvContractTest.php` | list/detail/recommendation/CRUD + error set |
| Cổng đóng task | `scripts/verify-wwhn-249-closure.mjs` | PASS; đỏ ngay khi surface/allowlist/contract lệch nhau |
| Register + pack | `docs/evidence/WWHN-249/` | register máy đọc + pack người đọc |

Kết quả tại SHA pin: **47 test — 45 PASS, 0 FAIL, 2 SKIP** (2 skip là cổng chỉ
chạy trên PostgreSQL, không đọc là PASS).

## P0/P1/P2 register

Bản máy đọc: `HoaNam_BE/.../docs/evidence/WWHN-249/WWHN-249_CLOSURE_REGISTER.json`.

| ID | Mức | Chủ | Trạng thái | Nội dung |
| --- | --- | --- | --- | --- |
| DEV249-P1-01 | P1 | BA + BAS | READY_FOR_APPROVAL | Ma trận actor/permission đã sinh từ route table thật; chờ BA duyệt + xử lý D-01/D-04 |
| DEV249-P1-02 | P1 | DEV + Tech Lead | FIXED | Canonical branch = `m1`; pin SHA; `m1-be-2` bị supersede |
| DEV249-P1-03 | P1 | DEV | FIXED | Tách rõ public/authenticated + guard fail-closed + đồng bộ allowlist |
| DEV249-P1-04 | P1 | DEV | FIXED | Đủ 8 operation Annex C; error set được khoá bằng test |
| DEV249-P1-05 | P1 | QA1 | READY_FOR_QA1 | Có bằng chứng tự động; QA1 vẫn phải retest trên build thật |
| DEV249-P1-06 | P1 | DEV + Tech Lead | PARTIAL | OpenAPI/ma trận/baseline contract xong; còn PR-commit-build ID trên Jira |
| DEV249-P2-01 | P2 | PM / BAS | OPEN | Ghi chú ownership hiện tại vs mô tả cũ |
| D-01 | P2 | BA | NEEDS_DISPOSITION | §3 cho NV kho/Lãnh đạo mức xem, Annex C chỉ có 1 key `pv.master.manage` |
| D-02 | P2 | BA | ACCEPTED | `/pv/catalog`, `/pv/tags` là alias ngoài Annex C, đã khai tường minh |
| D-03 | P3 | — | ACCEPTED | `operationId` runtime khác tên Annex C; có bảng ánh xạ |
| **D-04** | **P1** | **DEV (chờ duyệt)** | **OPEN** | Seed thiếu `pv.master.manage` cho `WAREHOUSE_MANAGER` dù §3 ghi mức A |

## Truth boundary / anti-false-PASS

- Bằng chứng ở đây là **test tự động + artifact hợp đồng**, chạy trên SQLite
  in-memory. Không phải UAT, không thay QA1 (WWHN-250).
- 2 test SKIP là cổng PostgreSQL — không được đếm là PASS.
- Nhánh `m1` tại thời điểm dựng evidence còn 2 test đỏ **thuộc luồng khác**
  (WWHN-236 apply-adjustment/Postman artifact; pin nguồn read model của
  WWHN-252). Chúng không nằm trong phạm vi WWHN-249 và phải do chính luồng đó
  đóng — không được mượn kết quả của WWHN-249 để tuyên bố chúng xanh.
- **D-04 chưa được sửa.** Không vai trò nào được ký "phân quyền PV đã đúng §3"
  cho tới khi bản vá một dòng ở `PV_SURFACE_EVIDENCE.md §6` được duyệt và áp.
