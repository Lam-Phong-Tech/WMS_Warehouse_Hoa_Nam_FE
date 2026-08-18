# WWHN-327 — FE Evidence Pack (candidate 2026-08-18)

Bằng chứng FE-owned cho `[FE] Dashboard enhancement`. Cặp backend là WWHN-328
(`GET /api/v1/reports/dashboard-quick`, KPI matrix v1.1); QA độc lập là WWHN-329.

## 1. Candidate pin

| Thành phần | Repo | Branch | Exact SHA |
| --- | --- | --- | --- |
| Frontend | `WMS_Warehouse_Hoa_Nam_FE` | `m1` | pin tại commit `docs(WWHN-327): pin candidate SHA` ngay sau commit này |
| Backend | `WMS_Warehouse_Hoa_Nam_BE` | `m1` | `6db0965940a6ae8b22a591d50705f258326b172d` |

Backend candidate lấy nguyên từ `WWHN-328/EVIDENCE_PACK.md` §1. FE **không** tự ký
backend; SHA backend ở đây chỉ để khoá cặp build mà bằng chứng FE này đối chiếu.

## 2. Contract FE bám theo

- Endpoint **tái sử dụng**: `GET /api/v1/reports/dashboard-quick` (`API_ENDPOINTS.DASHBOARD_KPI`).
- Permission gate: `report.view` — mã canonical trong `AuthDatabaseSeeder`.
- Field set: đúng matrix v1.1 (`period`, `data_scope`, `scope_warehouse_ids`,
  `available_qty`, `receipt_qty`, `issue_qty`, `component_issue_qty`, `reversal_net`,
  `warranty_cases_by_status`, `reconciliation_warning_count`, `reconciliation_warnings`).
- Timezone/cutoff: `Asia/Ho_Chi_Minh`, kỳ mặc định 31 ngày inclusive — do BE quyết định,
  FE chỉ hiển thị kỳ BE trả về.
- Không thêm KPI suy đoán, không thêm endpoint aggregate nào khác.

## 3. Khiếm khuyết FE đã đóng ở candidate này

| ID | Mức | Vấn đề | Sửa |
| --- | --- | --- | --- |
| W327-P1-01 | P1 | Màn hình khai `Phạm vi dữ liệu: Giới hạn N kho` nhưng card "Bảo hành theo trạng thái" vẫn là số liệu toàn hệ thống. Người dùng bị giới hạn kho đọc hai khối cạnh nhau và quy nhầm số ca bảo hành về kho của mình — đúng loại lỗi quy kết sai số liệu mà data-scope của WWHN-328 sinh ra ở tầng UI. | Thêm khối `role="note"` khai ngoại lệ GLOBAL của `warranty_cases_by_status`, chỉ render khi `data_scope=WAREHOUSE_SCOPED`; GLOBAL không hiện để nhãn phạm vi không mất nghĩa. |
| W327-P1-02 | P1 | WWHN-327 không có gate closure exact-SHA riêng, khác mọi task FE đã đóng (153/181/211/274/292). Một thay đổi sau này có thể lặng lẽ quay lại đếm cảnh báo bằng `length`, bỏ nhãn data-scope hoặc bỏ ngoại lệ warranty mà CI vẫn xanh. | Thêm `scripts/verify-wwhn-327-closure.mjs` (fail-closed), `e2e/wwhn-327-dashboard-kpi.spec.ts` (9 kịch bản, 3 viewport) và `.github/workflows/wwhn-327-fe-closure.yml` chạy trên đúng SHA của `m1`. |
| W327-P2-01 | P2 | `WMS_PERMISSION_CATALOG.DASHBOARD_VIEW` khai `report.dashboard.view`. Mã này chưa từng tồn tại trong `AuthDatabaseSeeder`, nên bất kỳ gate nào dùng hằng đó sẽ fail-closed vĩnh viễn và ẩn màn Dashboard khỏi cả role hợp lệ. | Trỏ `DASHBOARD_VIEW` về `report.view`, kèm comment giải thích để không ai khôi phục mã ma; verifier chặn chuỗi `report.dashboard.view` quay lại. |

Các mục contract đã có sẵn từ trước và được gate này khoá lại để không trôi:
`reconciliation_warning_count` là tổng thật (mảng mẫu bị BE cắt trần 50 dòng),
`reversal_net` giữ dấu, `available_qty` là snapshot không lọc kỳ.

## 4. Kết quả kiểm thử tại candidate

Chạy cục bộ ngày 2026-08-18 trên `m1`.

| Gate | Lệnh | Kết quả |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | **PASS** |
| Format baseline | `node scripts/verify-format-baseline.mjs` | **PASS**, 0 drift |
| Unit/integration | `npx vitest run` | **67 files, 510 passed**, 0 failed |
| Dashboard unit | `npx vitest run src/modules/dashboard/pages/DashboardPage.test.tsx` | **7 passed** |
| Controlled E2E | `npm run test:e2e:wwhn-327` | **9 passed** (3 viewport + scope + empty + RBAC + 403 + 422 + guard kỳ đảo) |
| Closure verifier | `npm run verify:wwhn-327` | **PASS** |

Bằng chứng E2E (ảnh + metadata JSON kèm SHA/env/build/role/viewport/timestamp) ghi tại
`test-results/wwhn-327/<SOURCE_SHA>/`.

## 5. Truth boundary

- Toàn bộ payload trong unit test và E2E là **mock deterministic**. Chúng chứng minh
  hành vi render của FE, **không** chứng minh backend thật sự cắt data-scope theo `scope_ref`.
- Bằng chứng backend cho data-scope nằm ở `tests/Feature/Wwhn328DashboardQuickContractTest.php`
  (17 test) trên repo BE, không phải ở đây.
- Đây **không** phải bằng chứng UAT và **không** thay QA2 độc lập trên WWHN-329.
- Không tái sử dụng ảnh hoặc câu PASS của một SHA khác làm bằng chứng đóng task.
- FE chỉ ký phần FE-owned. WWHN-88 không được tuyên bố hoàn tất chỉ từ artifact này.

## 6. Phần KHÔNG thuộc phạm vi sửa code (cần người ký)

| ID | Nội dung | Ai đóng |
| --- | --- | --- |
| W327-P1-03 | Ký KPI matrix v1.1 với **một** verdict duy nhất, không dual verdict/placeholder | BA Main + BAS |
| W327-P1-04 | Đăng fixed-build report trên **chính WWHN-329**, gắn cặp SHA BE/FE ở §1 | QA2 |
| W327-P2-02 | Tạo Jira issue link WWHN-327 ↔ WWHN-328 và map dependency HN-STR-002-ST01 | PM/BAS |

## 7. Reviewer checklist

- [ ] SHA FE ở §1 là SHA thật trên `m1`, không phải nhánh khác.
- [ ] `npm run verify:wwhn-327` PASS trên đúng SHA đó.
- [ ] `npm run test:e2e:wwhn-327` PASS, có metadata cho `1440x900`, `768x1024`, `375x812`.
- [ ] Không xuất hiện endpoint aggregate mới ngoài `/reports/dashboard-quick`.
- [ ] Không xuất hiện lại mã permission `report.dashboard.view`.
- [ ] Bằng chứng FE không bị trình bày như bằng chứng QA2/UAT.
