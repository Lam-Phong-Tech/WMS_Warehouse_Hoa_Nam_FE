# WWHN-268 — Vòng sửa lỗi và retest (phần FE)

- Task: `WWHN-268` · Parent: `WWHN-70` · Nguồn QA: `HN-QA-005-ST01`
- Nhánh: `m1` (không tạo nhánh riêng)
- Baseline áp dụng: SRS/FRD v1.12, Wireframe MVP ALIGNED v3.20, ERD mới nhất, Techstack/Dev Guide
- Trạng thái: `ĐÃ SỬA + CÓ BẰNG CHỨNG — CHỜ QA1/QA2 CHẠY ĐỘC LẬP`

> Ghi chú phạm vi: WWHN-268 là nửa FE của vòng sửa lỗi WWHN-70; các nửa còn lại
> là `WWHN-264` (QA1 · API/DB/integration), `WWHN-265` (QA2 · UI/E2E),
> `WWHN-266`/`WWHN-267` (BE1/BE2 · contract/error/sample/data). Tài liệu này
> **không** tự ký thay bốn vai trò đó.

## 1. Review đang chặn ở đâu

| Sev | Vị trí | Nội dung review | Xử lý trong WWHN-268 |
|-----|--------|-----------------|----------------------|
| P1 | WWHN-268 evidence | Bổ sung defect list cụ thể: module, route, expected/actual, before/after, owner, fixed/blocked | `docs/evidence/WWHN-268/DEFECT_REGISTER.json` — 5 dòng defect thật, có verifier fail-closed |
| P1 | WWHN-265 | QA2 chạy UI/E2E regression đúng build/SHA/account/role/viewport và comment pass/fail | Đã dựng bộ chạy được (`yarn test:e2e:wwhn-268`) sinh screenshot + metadata theo SHA/vai trò/viewport; **lượt chạy độc lập vẫn thuộc QA2** |
| P1 | WWHN-264 | QA1 chạy API/DB/integration regression cho stock/reversal/warranty/PV/report | Đã giao phạm vi máy đọc được `BE_REGRESSION_SCOPE.json` + test hợp đồng lỗi; **lượt chạy trên build deploy vẫn thuộc QA1** |
| P1 | WWHN-266/267 | BE1/BE2 cung cấp contract/error/sample/data fix nếu blocker chạm API/data | `WWHN-268_BE_REGRESSION_RECEIPT.md` + `Wwhn268RegressionContractTest` (401/403/envelope/PV) |
| P1 | UI evidence | Screenshot/video thật cho loading/empty/error/success/disabled/confirm/responsive/RBAC theo từng lỗi | Hợp đồng `UI_STATE` + spec bằng chứng theo từng defect × 3 viewport |
| P1 | Trace PR/build | PR URL, commit SHA, build ID/env, CI log | `.github/workflows/wwhn-268-fe-defect-closure.yml` (FE) + `wwhn-268-be-regression-closure.yml` (BE) chạy trên `GITHUB_SHA`, upload artifact |
| P2 | Artifact closure | Cần closure matrix 1-1 root cause → fix → evidence → retest → confirmer | Register JSON là closure matrix; §3 dưới đây là bản đọc được cho người |

## 2. Nguyên nhân gốc

Ba ticket liên tiếp (`WWHN-156`, `WWHN-292`, `WWHN-268`) bị đánh trượt vì cùng
một lý do: **defect list và bằng chứng được viết bằng văn xuôi**. Không ai chứng
minh được một bảng Markdown là "không generic", nên vòng nào cũng lặp lại nhận
xét cũ.

WWHN-268 đổi cách làm: register chuyển sang JSON có schema, và
`scripts/verify-wwhn-268-closure.mjs` từ chối

- dòng thiếu bất kỳ trường nào trong: module, route, tài khoản/vai trò, viewport,
  môi trường/build, expected, actual, root cause, fix, bằng chứng trước/sau,
  lệnh retest, owner, người xác nhận;
- chuỗi độn (`TBD`, `N/A`, `generic`, `-`) và mô tả quá ngắn để kiểm chứng;
- đường dẫn fix/bằng chứng không tồn tại trên đĩa (cả repo FE lẫn BE);
- dòng khai `FIXED` mà `retest.result` không phải `PASS`, hoặc không liệt kê file
  đã sửa;
- dòng `BLOCKED_EXTERNAL` không khai kiểm soát bù;
- và mọi cố gắng đóng cổng thuộc vai trò khác (`WWHN-264`/`265`/`266`/`267`).

## 3. Closure matrix 1-1

| ID | Sev | Root cause | Fix | Bằng chứng trước | Bằng chứng sau | Retest | Owner → Confirmer | Trạng thái |
|----|-----|-----------|-----|------------------|----------------|--------|-------------------|-----------|
| FE268-D01 | P1 | Không có hợp đồng trạng thái UI dùng chung; antd v6 nuốt prop lạ trên `Empty`/`Alert` nên hook bị mất cả khi truyền vào | `src/shared/constants/ui-state.ts` + 12 surface dùng chung phát `data-ui-state`/`data-testid` | `BEFORE_TESTID_INVENTORY.md` — toàn FE chỉ có 5 testid, không cái nào là trạng thái | `ui-state.test.tsx` (8 test) + gallery 7 trạng thái × 3 viewport | `yarn vitest run src/shared/constants/ui-state.test.tsx`; `yarn test:e2e:wwhn-268` | FE1 → QA2 | FIXED |
| FE268-D02 | P1 | Sáu màn tự viết `locale.emptyText` bằng chuỗi ternary nên empty ≡ error; `/inbound` khai `ApiErrorAlert` cục bộ che component dùng chung nên 403 không ra `NoPermissionState` | `BusinessState.tsx` thành điểm duy nhất phân biệt empty/error + `TableLoadingBanner`; bỏ component cục bộ ở `/inbound` | `BEFORE_E2E_FAILURES.md` — 7 failed/14 passed, kèm nguyên văn assertion | Lượt retest 20 passed | `yarn test:e2e:wwhn-268` | FE1 → QA2 | FIXED |
| FE268-D03 | P1 | Không có defect: sáu route đều chặn đúng về `/errors/403` ngay lượt đầu | Không đổi mã; bổ sung ca kiểm chứng tự động | — | Spec retest | `yarn test:e2e:wwhn-268` | FE1 → QA2 | VERIFIED_NO_DEFECT |
| BE268-D01 | P1 | Phạm vi regression chỉ tồn tại dưới dạng câu chữ; không test nào khoá hợp đồng lỗi 401/403 trên nhóm bề mặt FE phụ thuộc | `BE_REGRESSION_SCOPE.json` + `Wwhn268RegressionContractTest` | — | `WWHN-268_BE_REGRESSION_RECEIPT.md` | `php artisan test --filter=Wwhn268RegressionContractTest` | BE1 → QA1 | FIXED |
| BE268-D02 | P2 | SRS §8.2 nêu `PERMISSION_DENIED`/`DATA_SCOPE_DENIED` ở cột *ví dụ*, cài đặt dùng `ACCESS_DENIED` — hai cách gọi tên trôi ra khác nhau mà không bên nào vi phạm | Không tự đổi contract; test khoá theo danh mục thực tế và ghi nhận divergence | — | Receipt §4 | `php artisan test --filter=Wwhn268RegressionContractTest` | BA + Tech Lead → QA1 | BLOCKED_EXTERNAL |

## 4. Ma trận bằng chứng UI

Mỗi lần chụp ghi kèm: `sourceSha`, `environment`, `buildVersion`, `browserProject`,
`module`, `uiState`, `role`, `account`, `viewport`, `route`, `finalUrl`,
`timestamp`, danh sách assertion và ranh giới sự thật.

| Trạng thái | Nơi chứng minh | Selector |
|------------|----------------|----------|
| loading | gallery + 6 module trong phạm vi | `[data-ui-state="loading"]`, riêng bảng dữ liệu là `ui-state-loading-table` |
| empty | gallery + 6 module | `[data-ui-state="empty"]` |
| error | gallery + `/inbound` 500 | `[data-ui-state="error"]` |
| success | gallery (xác nhận Popconfirm sinh toast thật) | `[data-sonner-toast][data-type="success"]` |
| disabled | gallery (`SubmitButton` bị chặn thật sự, không chỉ đổi màu) | `[data-ui-state="disabled"]` |
| confirm | gallery (mở bằng thao tác người dùng) | `[data-ui-state="confirm"]` |
| permission-denied | gallery + 6 module trả 403 | `[data-ui-state="permission-denied"]` |
| responsive | gallery tại 1440x900 / 768x1024 / 375x812, khẳng định không tràn ngang | — |
| RBAC | 6 route, vai trò `DASHBOARD_ONLY` gõ thẳng URL | điều hướng `/errors/403` |

## 5. Ranh giới sự thật

- Bằng chứng trong `test-results/wwhn-268/` là **FE-controlled**: mọi phản hồi
  API do Playwright giả lập để ép đúng một trạng thái. Nó chứng minh hành vi FE,
  **không** chứng minh backend enforce permission/data scope.
- Chạy tại chỗ sinh thư mục `local-uncommitted`; chỉ lượt chạy CI trên
  `GITHUB_SHA` mới được trích dẫn ra ngoài như bằng chứng exact-SHA.
- Stocktake/kiểm kê không nằm trong phạm vi MVP (SRS v1.12 §5.3, wireframe không
  có màn kiểm kê); đường sửa sai là đối soát + Reversal append-only. WWHN-268
  không tạo màn/API ngoài baseline.

## 6. Việc còn lại, không tự đóng

| Việc | Vai trò | Ticket |
|------|---------|--------|
| UI/E2E regression độc lập trên build/SHA công bố, comment pass/fail | QA2 | `WWHN-265` |
| API/DB/integration regression trên build đã deploy | QA1 | `WWHN-264` |
| Contract/error/sample/data fix cho blocker chạm API/data ngoài phần đã giao | BE1/BE2 | `WWHN-266` / `WWHN-267` |
| Disposition danh mục mã 403 (§8.2 vs cài đặt) | BA + Tech Lead | BE268-D02 |
| PR URL + exact SHA + build ID + CI log của lượt chạy chốt | DEV + DevOps | W268-EXT-04 |
