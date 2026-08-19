# WWHN-327 — FE Evidence Pack (candidate 2026-08-18)

> **SUPERSEDED (R4, 2026-08-19).** Candidate hiện hành là cặp
> FE `5a0cfda4ccdacfa4aac324ed7c16bda513c3c8f3` /
> BE `b610b1ff191f8c1f2cce3c24571de850f946d690`, KPI matrix **v1.2** — nguồn
> authority: `docs/evidence/WWHN-327/WWHN-328_CONSUMER_PIN.json`. Nội dung bên
> dưới là hồ sơ lịch sử của vòng pin `99dff42`/`6db0965` (matrix v1.1), giữ
> nguyên để đối chiếu, không dùng để ký closure nữa.

Bằng chứng FE-owned cho `[FE] Dashboard enhancement`. Cặp backend là WWHN-328
(`GET /api/v1/reports/dashboard-quick`, KPI matrix v1.1); QA độc lập là WWHN-329.

## 1. Candidate pin

| Thành phần | Repo                       | Branch | Exact SHA                                  |
| ---------- | -------------------------- | ------ | ------------------------------------------ |
| Frontend   | `WMS_Warehouse_Hoa_Nam_FE` | `m1`   | `99dff42fb4272ed8930e8fb9bf4da6368f4cfd96` |
| Backend    | `WMS_Warehouse_Hoa_Nam_BE` | `m1`   | `6db0965940a6ae8b22a591d50705f258326b172d` |

Backend candidate lấy nguyên từ `WWHN-328/EVIDENCE_PACK.md` §1. FE **không** tự ký
backend; SHA backend ở đây chỉ để khoá cặp build mà bằng chứng FE này đối chiếu.

FE candidate `99dff42` **supersede** `3ddce52` (bản pin trong `WWHN-328/EVIDENCE_PACK.md`
§1): sau `3ddce52`, màn dashboard đã đổi hành vi hiển thị (ngoại lệ phạm vi warranty) và
mã permission dashboard. Mọi kết quả kiểm thử FE gắn với `3ddce52` phải retest tại `99dff42`.

`99dff42` là bundled commit trên `m1` (có luồng làm việc song song); file **thuộc WWHN-327**
và git blob tương ứng:

| File                                                    | git blob                                   |
| ------------------------------------------------------- | ------------------------------------------ |
| `src/modules/dashboard/pages/DashboardPage.tsx`         | `0250a4eeada845189525b4aa7a1989c57dafcb7f` |
| `src/modules/dashboard/pages/DashboardPage.test.tsx`    | `2ea15f7a0ce2f6bb323a43ced460fe017ef2d890` |
| `src/modules/dashboard/pages/DashboardPage.css`         | `5a76431bcc91868358c994ddc155bcd1859886a2` |
| `src/shared/constants/wms-permissions.ts`               | `a083b99fad37efff84d411cc03ab411f8a338fe2` |
| `e2e/wwhn-327-dashboard-kpi.spec.ts`                    | `dbba92d42de9df88530cea06ad2b23e537648ed9` |
| `scripts/verify-wwhn-327-closure.mjs`                   | `4f8e2d9d4fe7ee038fb4228c006ffceaea69fbf6` |
| `.github/workflows/wwhn-327-fe-closure.yml`             | `1f90bcd61344ff7b98bcf293920928fb8b509577` |
| `docs/Task_docs_Jira/WWHN-327.md`                       | `92fc3172952aba5cce67cdc393d2eac704ca6b48` |
| `docs/evidence/WWHN-327/WWHN-327_CLOSURE_REGISTER.json` | `82a40cfbab093e650932efa28d877f2b7343ac4d` |

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

| ID         | Mức | Vấn đề                                                                                                                                                                                                                                                                                             | Sửa                                                                                                                                                                                                 |
| ---------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W327-P1-01 | P1  | Màn hình khai `Phạm vi dữ liệu: Giới hạn N kho` nhưng card "Bảo hành theo trạng thái" vẫn là số liệu toàn hệ thống. Người dùng bị giới hạn kho đọc hai khối cạnh nhau và quy nhầm số ca bảo hành về kho của mình — đúng loại lỗi quy kết sai số liệu mà data-scope của WWHN-328 sinh ra ở tầng UI. | Thêm khối `role="note"` khai ngoại lệ GLOBAL của `warranty_cases_by_status`, chỉ render khi `data_scope=WAREHOUSE_SCOPED`; GLOBAL không hiện để nhãn phạm vi không mất nghĩa.                       |
| W327-P1-02 | P1  | WWHN-327 không có gate closure exact-SHA riêng, khác mọi task FE đã đóng (153/181/211/274/292). Một thay đổi sau này có thể lặng lẽ quay lại đếm cảnh báo bằng `length`, bỏ nhãn data-scope hoặc bỏ ngoại lệ warranty mà CI vẫn xanh.                                                              | Thêm `scripts/verify-wwhn-327-closure.mjs` (fail-closed), `e2e/wwhn-327-dashboard-kpi.spec.ts` (9 kịch bản, 3 viewport) và `.github/workflows/wwhn-327-fe-closure.yml` chạy trên đúng SHA của `m1`. |
| W327-P2-01 | P2  | `WMS_PERMISSION_CATALOG.DASHBOARD_VIEW` khai `report.dashboard.view`. Mã này chưa từng tồn tại trong `AuthDatabaseSeeder`, nên bất kỳ gate nào dùng hằng đó sẽ fail-closed vĩnh viễn và ẩn màn Dashboard khỏi cả role hợp lệ.                                                                      | Trỏ `DASHBOARD_VIEW` về `report.view`, kèm comment giải thích để không ai khôi phục mã ma; verifier chặn chuỗi `report.dashboard.view` quay lại.                                                    |

Các mục contract đã có sẵn từ trước và được gate này khoá lại để không trôi:
`reconciliation_warning_count` là tổng thật (mảng mẫu bị BE cắt trần 50 dòng),
`reversal_net` giữ dấu, `available_qty` là snapshot không lọc kỳ.

## 4. Kết quả kiểm thử tại candidate

Chạy cục bộ ngày 2026-08-18 trên `m1`.

| Gate                 | Lệnh                                                                | Kết quả                                                                              |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Typecheck            | `npx tsc --noEmit`                                                  | **PASS**                                                                             |
| Format baseline      | `node scripts/verify-format-baseline.mjs`                           | **PASS**, 0 drift                                                                    |
| Unit/integration     | `npx vitest run`                                                    | **67 files, 510 passed**, 0 failed                                                   |
| Dashboard unit       | `npx vitest run src/modules/dashboard/pages/DashboardPage.test.tsx` | **7 passed**                                                                         |
| Controlled E2E       | `npm run test:e2e:wwhn-327`                                         | **9 passed** (3 viewport + scope + empty + RBAC + 403 + 422 + guard kỳ đảo)          |
| Closure verifier     | `npm run verify:wwhn-327`                                           | **PASS**                                                                             |
| Verifier fail-closed | tạm đổi `role="note"` → `role="status"` rồi chạy lại verifier       | **FAIL đúng như thiết kế** (`must contain "role=\"note\""`), khôi phục xong PASS lại |

Dòng cuối là bằng chứng gate không phải loại "luôn xanh": nếu ai đó gỡ khối khai ngoại
lệ phạm vi, CI đỏ chứ không im lặng.

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

| ID         | Nội dung                                                                        | Ai đóng       |
| ---------- | ------------------------------------------------------------------------------- | ------------- |
| W327-P1-03 | Ký KPI matrix v1.1 với **một** verdict duy nhất, không dual verdict/placeholder | BA Main + BAS |
| W327-P1-04 | Đăng fixed-build report trên **chính WWHN-329**, gắn cặp SHA BE/FE ở §1         | QA2           |
| W327-P2-02 | Tạo Jira issue link WWHN-327 ↔ WWHN-328 và map dependency HN-STR-002-ST01       | PM/BAS        |

## 7. Reviewer checklist

- [ ] SHA FE ở §1 là SHA thật trên `m1`, không phải nhánh khác.
- [ ] `npm run verify:wwhn-327` PASS trên đúng SHA đó.
- [ ] `npm run test:e2e:wwhn-327` PASS, có metadata cho `1440x900`, `768x1024`, `375x812`.
- [ ] Không xuất hiện endpoint aggregate mới ngoài `/reports/dashboard-quick`.
- [ ] Không xuất hiện lại mã permission `report.dashboard.view`.
- [ ] Bằng chứng FE không bị trình bày như bằng chứng QA2/UAT.
