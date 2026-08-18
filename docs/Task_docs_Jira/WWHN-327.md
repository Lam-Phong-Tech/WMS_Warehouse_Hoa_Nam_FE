# WWHN-327 — [FE] Dashboard enhancement

## Scope

- Jira: WWHN-327 — `[FE] Dashboard enhancement`.
- Parent: WWHN-88. Cặp backend: WWHN-328. QA độc lập: WWHN-329.
- Branch: `m1` only.
- Endpoint: `GET /api/v1/reports/dashboard-quick` — **tái sử dụng, không tạo route mới**.
- File này là chỉ mục bằng chứng FE-owned trong source control. Nó **không** thay QA2
  (WWHN-329) và **không** là bằng chứng UAT.

## Baseline reviewed

1. `docs/HN_SRS_FRD_v1.12_FULL.md`
2. `docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html`
3. `docs/HoaNam_ERD_Moi_Nhat.md`
4. `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`
5. `HoaNam_BE/.../docs/evidence/WWHN-328/KPI_MATRIX.md` (matrix v1.1)

Giả định contract FE dùng cho gate này:

- API base `/api/v1`; permission gate của dashboard là `report.view` (mã BE canonical).
- FE guard chỉ là UX; backend vẫn là biên authorization/data-scope.
- `data_scope` / `scope_warehouse_ids` do BE quyết định; FE chỉ hiển thị, không tự suy ra.
- `warranty_cases_by_status` **luôn GLOBAL** kể cả khi `data_scope=WAREHOUSE_SCOPED`
  (ERD `warranty_case` không có `warehouse_id`) — ngoại lệ có chủ đích, phải nói rõ trên UI.
- `reconciliation_warnings` bị BE cắt trần 50 dòng ⇒ tổng cảnh báo đọc từ
  `reconciliation_warning_count`, không phải `length` của mảng.
- Dashboard **nâng cao** (App PV, KPI kinh doanh theo ngày-tuần-tháng) là Non-MVP/Phase 2
  theo SRS §ROADMAP-CTR-001 / DEC-CONTRACT-PHASE-001 — không mở rộng screen/API ngoài
  contract aggregate hiện hành.

## AC / DoD evidence map

| Gate | Bằng chứng trong source | Kết quả mong đợi |
| --- | --- | --- |
| Contract render | `src/modules/dashboard/types/index.ts`, `DashboardPage.tsx` | đúng field set matrix v1.1, không thêm KPI suy đoán |
| Data-scope | `DashboardPage.test.tsx`, `e2e/wwhn-327-dashboard-kpi.spec.ts` | GLOBAL ⇒ "Toàn hệ thống"; WAREHOUSE_SCOPED ⇒ "Giới hạn N kho" |
| Ngoại lệ warranty | cùng bộ test | khối `role="note"` chỉ hiện khi WAREHOUSE_SCOPED |
| Tổng đối soát | cùng bộ test | fixture `count=137` / `length=2` ⇒ hiển thị 137 |
| RBAC | E2E `fails closed for a profile without report.view` | không gọi API, hiện trạng thái no-permission |
| API error | E2E 403/422 | thông báo đúng, không hiện số liệu cũ/giả, nút "Thử lại" còn bật |
| Empty state | unit + E2E | hiện trạng thái rỗng, không vẽ biểu đồ từ KPI = 0 |
| Responsive | E2E 3 viewport | 1440x900, 768x1024, 375x812; không tràn ngang |
| Traceability | `scripts/verify-wwhn-327-closure.mjs` | fail-closed khi mất bất kỳ ràng buộc nào ở trên |
| Exact SHA | `.github/workflows/wwhn-327-fe-closure.yml` | SHA/env/build/viewport/role/timestamp được ghi lại |

## P0/P1/P2 register

Bản máy đọc: `docs/evidence/WWHN-327/WWHN-327_CLOSURE_REGISTER.json`.
Bản người đọc kèm kết quả gate: `docs/evidence/WWHN-327/FE_EVIDENCE_PACK.md`.

| ID | Mức | Chủ | Trạng thái | Nội dung |
| --- | --- | --- | --- | --- |
| W327-P1-01 | P1 | FE | FIXED | UI khai "giới hạn N kho" nhưng card Bảo hành vẫn là số GLOBAL ⇒ quy nhầm ca bảo hành về kho của mình |
| W327-P1-02 | P1 | FE | FIXED | WWHN-327 chưa có gate closure exact-SHA riêng như các task FE khác |
| W327-P2-01 | P2 | FE | FIXED | `WMS_PERMISSION_CATALOG.DASHBOARD_VIEW` khai `report.dashboard.view` — mã không có trong BE seeder |
| W327-P1-03 | P1 | BA Main + BAS | OPEN | KPI matrix v1.1 chưa có một verdict ký duy nhất |
| W327-P1-04 | P1 | QA2 | OPEN | Fixed-build report phải nằm trên WWHN-329, gắn đúng cặp SHA BE/FE |
| W327-P2-02 | P2 | PM/BAS | OPEN | Thiếu Jira issue link WWHN-327 ↔ WWHN-328 và map HN-STR-002-ST01 |

## Truth boundary / anti-false-PASS

- Payload trong unit test và E2E là mock deterministic ⇒ chỉ chứng minh **hành vi FE**.
- Không chứng minh backend thực sự cắt data-scope theo `scope_ref` — việc đó do
  `Wwhn328DashboardQuickContractTest` (BE) và QA2 độc lập chứng minh.
- Không tái sử dụng ảnh/PASS của SHA khác làm bằng chứng đóng task.
- FE chỉ ký các mục FE-owned. Mục của BA/QA2/PM phải do chính vai trò đó ký.
- Không được tuyên bố WWHN-88 hoàn tất chỉ từ artifact này.

## Reviewer checklist

- [ ] Exact FE `m1` SHA được ghi trong `FE_EVIDENCE_PACK.md` §1.
- [ ] `npm run verify:wwhn-327` PASS trên đúng SHA đó.
- [ ] `npm run test:e2e:wwhn-327` PASS, có ảnh + metadata cho cả 3 viewport.
- [ ] Không có endpoint aggregate nào khác `/reports/dashboard-quick` được thêm.
- [ ] Không có mã permission nào ngoài `report.view` gate màn dashboard.
- [ ] Bằng chứng FE không bị trình bày như bằng chứng QA2/UAT.
