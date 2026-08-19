# WWHN-258 — Evidence pack (Flow 06 · Báo cáo vận hành)

Candidate exact SHA: **`ba99f60171974649123bd17eca3c50ce8225cdf9`** (nhánh `m1`,
repo `WMS_Warehouse_Hoa_Nam_FE`).
Nửa BE: **`84e66b35075e34310c212ebf07a12d9a6c74d0ba`** (`WMS_Warehouse_Hoa_Nam_BE`, `m1`).

Tái lập:

```bash
npm run wwhn-258:exact-sha -- --expect-sha=ba99f60171974649123bd17eca3c50ce8225cdf9
```

```bash
npm run wwhn-258:verify
```

## 1. Vì sao cổng Flow 06 đỏ — hai nguyên nhân độc lập

Review WWHN-258 quy nguyên nhân về Prettier. Thực tế có **hai** nguyên nhân, và
nguyên nhân thứ hai không thể chữa bằng cách format lại:

| # | Nguyên nhân | Bằng chứng |
| --- | --- | --- |
| 1 | Prettier drift ở `src/test/wwhn-202-balance-contract-pin.test.ts` khiến bước *Flow 06 formatting* đỏ, mọi bước sau bị skip | `npm run format:check` trước khi sửa |
| 2 | Bước *Current-baseline documentation semantics* grep `docs/HoaNam_Tai_lieu_tong_hop_Moi_Nhat.md`; tệp bị đổi tên ở `68a6a68` rồi **xoá hẳn** ở `f9f7206` (16/08/2026) mà cổng không cập nhật theo | `git log --diff-filter=D -- docs/HoaNam_Tai_lieu_tong_hop_Moi_Nhat.md` |

Bẫy làm nguyên nhân 2 khó thấy: bước đó chạy dưới `bash -e`; hai mệnh đề đầu là
`! grep -Fq` nên **vẫn "đúng" khi tệp không tồn tại** (grep thoát mã 2), chỉ mệnh
đề khẳng định thứ ba mới đỏ. Đọc log sẽ tưởng nội dung tài liệu sai, thật ra là
thiếu tệp.

Đã khôi phục tài liệu baseline Flow 06 tại đúng đường dẫn cổng neo. **Không sửa
`.github/workflows/`** theo yêu cầu giữ nguyên cấu hình CI.

## 2. Kết quả cổng tại exact SHA

`ba99f601…/flow06-exact-sha.json` — 7/7 bước PASS, `evidenceValidity =
VALID_AT_EXACT_SHA`, chạy trên **git worktree detached** tại đúng commit nên
không dính việc dở của các phiên song song trên `m1`.

| Bước | Kết quả | Raw log |
| --- | --- | --- |
| Flow 06 formatting (6 tệp) | PASS | `step-flow06-formatting.log` |
| Documentation semantics (6 mệnh đề) | PASS | `step-documentation-semantics.log` |
| Lint | PASS | `step-lint.log` |
| Type check | PASS | `step-typecheck.log` |
| Flow 06 unit/contract tests (21 test) | PASS | `step-flow06-tests.log` |
| API mapping | PASS | `step-api-mapping.log` |
| Production build | PASS | `step-build.log` |

**Ranh giới sự thật:** đây là cổng chạy LOCAL, không phải một run của GitHub
Actions (quota 3.000/3.000 phút đã hết nên không kích hoạt thêm run nào). Không
có `run_id`. `swagger-api.json` nằm trong `.gitignore` nên vắng mặt trong
checkout sạch — **hệt runner của GitHub** — vì vậy `check:api-mapping` chỉ kiểm
hằng số/register phía FE, không phải sign-off OpenAPI của BE.

## 3. Ma trận QA2 cho WWHN-259 (`qa2/`)

11 test Playwright chạy thật trên dev server, 12 ảnh trạng thái:

| Ảnh | Mặt kiểm | Neo tài liệu |
| --- | --- | --- |
| `role-01-report-view-only.png` | chỉ `report.view` → nút export khoá | §3 ma trận actor |
| `role-02-export-without-pii.png` | `+report.export`, thiếu `warranty.pii.export` → không có ô lý do | §13.8 |
| `role-03-pii-export-allowed.png` | `+warranty.pii.export` → ô lý do xuất hiện | §13.8 |
| `pii-01-masked-columns.png` | thiếu `warranty.pii.view` → `N*** V*** A***` / `*******567` / `***, TP.HCM` | NFR-SRS-015 |
| `pii-02-reason-too-short.png` | lý do < 5 ký tự → chặn tại client, không gọi BE | 422 `PII_EXPORT_REASON_INVALID` |
| `state-01-empty.png` | `data-ui-state="empty"` | Annex D SCR-RPT-01 |
| `state-02-error.png` | `data-ui-state="error"` + retry | Annex D |
| `state-03-permission-denied.png` | `data-ui-state="permission-denied"` | §8.2 |
| `state-04-large-data.png` | tổng 10.001 dòng → cảnh báo + khoá export | 422 `REPORT_EXPORT_ROW_LIMIT_EXCEEDED` |
| `responsive-mobile-390x844.png` | 390×844, không cuộn ngang | NFR-SRS-006 |
| `responsive-tablet-768x1024.png` | 768×1024, không cuộn ngang | NFR-SRS-006 |
| `responsive-desktop-1366x900.png` | 1366×900, không cuộn ngang | NFR-SRS-006 |

Filter + export (giữ nguyên bộ lọc, `Idempotency-Key`, tên file có timestamp của
BE) được khẳng định bằng assertion trên payload thật của `POST /reports/export`,
không phải bằng ảnh.

## 4. Nửa BE

`ReportFlow06DocsAlignmentTest` +3 test; regression Flow 06 sqlite **112/112
pass**; Pint passed. `POST /reports/export` nay từ chối sớm cùng hợp đồng với
bước tải file, nên không còn sinh `ExportJob` lẫn audit
`REPORT_EXPORT_REQUESTED` cho lần export chắc chắn 403.

## 5. Đỏ không thuộc WWHN-258 (quy trách nhiệm)

`npm run format:check` toàn repo còn đỏ ở
`src/modules/master-data/components/SkuImportModal.tsx` và `.test.tsx` — hai tệp
**đang dở dang trong working tree của một phiên song song** (WWHN-331, xem
`docs/evidence/WWHN-331/EVIDENCE_PACK_R4.md`). Không nằm trong tập 6 tệp mà cổng
Flow 06 kiểm, nên không ảnh hưởng kết quả ở mục 2. Kiểm lại bằng:

```bash
git status --short src/modules/master-data/components/SkuImportModal.tsx
```

## 6. Việc cố ý KHÔNG làm

- **Không sửa `.github/workflows/flow06-fe-exact-sha.yml`.** Cách sửa gọn nhất về
  lâu dài là đổi đường dẫn tài liệu trong bước *documentation semantics*; việc đó
  cần một CR riêng vì phạm vi này bị yêu cầu giữ nguyên cấu hình CI.
- **Không mở rộng data-scope kho cho 3 báo cáo Aligned.** `/reports/import-match`,
  `/reports/label-log`, `/reports/warranty-defects` hiện không cắt theo
  `warehouseScopeIds()` (6 báo cáo còn lại có). Warranty có lý do ERD đã ghi nhận
  (`warranty_case` không có `warehouse_id`); import-match và label-log thì chưa có
  decision record. Đây là phát hiện ngoài register WWHN-258 — cần BA/Tech quyết
  trước khi đổi hành vi, vì nó chạm `Wwhn254ReportEvidenceTest`.
