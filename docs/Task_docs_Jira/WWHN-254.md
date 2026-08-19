# WWHN-254 — [BE] Báo cáo tích hợp · đóng register 61/100

Baseline hiệu lực: **HN_SRS_FRD v1.12** (adopt tại WWHN-334) · **HoaNam_ERD_Moi_Nhat** ·
**HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814** · **WMS_Hoa_Nam_Techstack_
Architecture_Dev_Guide**.

## Định danh candidate

**Round 2 (19/08/2026):** review 64/100 bắt đúng việc candidate Round 1 đã drift 125 commit
(BE) / 48 commit (FE) kể từ 18/08 (DEV254-P1-02R). Đã soát lại toàn bộ report-scope hai repo
không lệch thêm, tìm và sửa 1 regression thật (guard REQ-SRS-037 báo nhầm do WWHN-190) và
re-pin sang SHA dưới đây. Chi tiết đầy đủ + 2 lỗi hạ tầng tìm thấy trong chính gate CI
(chưa sửa, ngoài phạm vi cho phép vì ngân sách CI-minutes) nằm ở
`docs/evidence/WWHN-254/README.md` mục 6 (repo BE).

| | |
| --- | --- |
| Nhánh | `m1` (không tạo nhánh riêng) |
| BE candidate SHA (Round 2) | `e02903f1fc6b7635c2deac84a0284f49ddfb0fdd` |
| FE candidate SHA (Round 2) | `f9f2e65e687669f033d259a693635546876f05a8` |
| BE candidate SHA (Round 1, superseded) | `c855851b37920237d110f7dffe5dbbad509aebce` |
| FE candidate SHA (Round 1, superseded) | `a2da7ab41b407850c1273cdfd83a72611130caf8` |
| BE evidence pack | `docs/evidence/WWHN-254/README.md` (repo BE) |
| Gate exact-SHA | `.github/workflows/flow06-exact-sha.yml` (repo BE) — **chưa chạy lại qua GitHub Actions ở Round 2**, xem lý do ở evidence pack mục 6 |

Chạy lại gate tại đúng candidate (**để dành cho lúc có ngân sách CI-minutes trở lại**, sau
khi Tech Lead áp 2 bản vá nêu ở evidence pack mục 6.2 — nếu chạy nguyên trạng bây giờ gate
sẽ tự fail ở bước doc-semantics và bước tính hash Postman, không phải do code báo cáo):

```bash
gh workflow run flow06-exact-sha.yml --ref m1 -f candidate_sha=e02903f1fc6b7635c2deac84a0284f49ddfb0fdd
```

## Trạng thái từng mục register

| ID | Sev | Trạng thái | Đã làm gì |
| --- | --- | --- | --- |
| DEV254-P1-01 | P1 | **Phần kỹ thuật ĐÓNG · disposition BA còn mở** | Neo rule vào `REQ-SRS-037` + `REQ-SRS-031` (không neo `DEC-NO-STOCKTAKE-001` như approved Decision ID — SRS ghi "formal Decision: WWHN-25 only", WWHN-25 vẫn mở). Mở rộng guard sang contract artifact bàn giao; gỡ 2 artifact Stocktake của WWHN-131; sửa request scan gửi `context=STOCKTAKE`. Việc còn lại **thuần BA**: cập nhật/pin AC + dependency `HN-STK-003` của WWHN-67. |
| DEV254-P1-02 | P1 | **ĐÓNG** | Nguyên nhân run 32041944243 đỏ là 429/503 khi tải action `setup-php`, không phải code. Đã thêm `workflow_dispatch(candidate_sha)` + checkout đúng SHA + tự kiểm SHA, retry setup 3 lần, mở rộng path filter sang surface báo cáo tích hợp, manifest ghi `requested/resolved SHA` + `openapi_sha256` + `postman_set_sha256`. |
| DEV254-P1-03 | P1 | **ĐÓNG phần source · chờ QA1 chạy độc lập** | Tìm ra và sửa defect thật: **data-scope kho không được áp cho báo cáo** (chỉ dashboard-quick có). Chi tiết bên dưới. Thêm `Wwhn254ReportEvidenceTest` (8 test) phủ đúng các checkpoint QA1 còn thiếu, kèm runbook trong evidence pack. |
| DEV254-P1-04 | P1 | **Contract đã khoá · chờ ký nhận** | OpenAPI của 5 endpoint khai rõ DATA-SCOPE; bộ Postman bàn giao đã sạch và được hash trong manifest gate; FE hiển thị banner phạm vi kho để consumer acceptance có thứ để nghiệm thu. |
| DEV254-P2-01 | P2 | **ĐÓNG bằng ghi chú** | Description ghi Duy Khánh/BE2/HN-BE-02 là **historical placeholder**; owner hiện hành là assignee live, task đã đổi title `[BE]`. Nêu rõ trong comment sign-off của PM. |

## Defect thật đã đóng (DEV254-P1-03)

Trước WWHN-254, chỉ `/reports/dashboard-quick` áp warehouse data-scope (WWHN-328). Các
route `/reports/*` còn lại chỉ có `permission:report.view|report.export`, không có
middleware phạm vi kho ⇒ tài khoản bị giới hạn `scope_ref` vẫn **đọc và export** tồn,
XNT, lịch sử chứng từ, movement, người nhận của toàn hệ thống.

- Vi phạm `AC-SRS-032` — "export dùng cùng filter; audit; **dữ liệu đúng scope**".
- Vi phạm `BR-EXP-01..05` — "export dùng cùng filter/scope với màn hình".

Đã sửa: `dashboardWarehouseScope()` → `reportWarehouseScope()` dùng chung cho
inventory-balance, inventory-xnt (+enhanced), document-history, outbound-by-agency,
movement-trace (inventory-ledger và inventory-reconciliation kế thừa qua builder). Scope
được giải **trước** cache và nằm trong cache key. Payload trả `data_scope` +
`scope_warehouse_ids`; `warehouse_id` ngoài scope trả `403 ACCESS_DENIED` kể cả trên
route `*/export-excel`.

## Bằng chứng đã chạy thật (18/08/2026)

| Lệnh | Kết quả |
| --- | --- |
| `php artisan test --filter 'ReportFlow06\|Flow06\|Flow05InventoryControlAlignmentTest\|Wwhn328DashboardQuickContractTest\|Wwhn254ReportEvidenceTest'` | 109 test / 109 pass / 1065 assertion |
| `vendor/bin/pint --test` (các tệp đã sửa) | passed |
| `npx tsc --noEmit` (FE) | passed |
| `npx vitest run src/test/flow06-report-pagination-export.test.ts` | 7/7 pass |

**Cảnh báo trước khi pin candidate cuối:** full suite BE tại thời điểm chạy có 14 đỏ nằm
ngoài luồng báo cáo (`Wwhn300BackendGoLiveCheckTest`, `Wwhn309PermissionCatalogEvidenceTest`,
`DocumentationBaselineContractTest`, `SwaggerRouteSyncTest` phần PV,
`CurrentBaselineFlowContractSourceTest`, `SchemaApiModulesTest`) do các thay đổi đang dở
của phiên làm việc song song trên cùng nhánh `m1`. Phải chạy lại full suite ở trạng thái
sạch rồi mới pin.

## Việc còn lại — không thuộc phạm vi sửa source

1. **BA/BAS**: disposition chính thức cho WWHN-67 AC + dependency `HN-STK-003`
   (DEV254-P1-01). Nếu Stocktake thực sự quay lại scope thì phải có Decision/CR được
   duyệt; nếu không thì pin AC theo `REQ-SRS-031`/`REQ-SRS-037`.
2. **QA1 (WWHN-255)**: chạy runbook trong evidence pack trên candidate đã pin, đính raw
   request/response + query đối soát.
3. **QA2/BAS/FE1 (WWHN-256 / WWHN-257 / WWHN-68)**: ký nhận contract cùng SHA + cùng
   phiên bản OpenAPI/Postman đã hash.

Comment sign-off: `docs/Task_docs_Jira/WWHN-254_SIGNOFF_COMMENTS.md`.
