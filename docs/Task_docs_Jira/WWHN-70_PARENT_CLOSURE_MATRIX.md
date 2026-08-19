# WWHN-70 — Closure matrix cho vòng sửa lỗi/retest QA (`HN-QA-005-ST01`)

- Parent: `WWHN-70` · Nguồn QA: `HN-QA-005-ST01`
- 5 ticket con: `WWHN-264` (QA1), `WWHN-265` (QA2), `WWHN-266` (BE1), `WWHN-267` (BE2), `WWHN-268` (FE)
- Nhánh: `m1` duy nhất, không tạo nhánh riêng cho vòng này
- Review nguồn của tài liệu này: WWHN-268 round 2 (76/100), finding `FE268-R2-P1-06`
- Mục đích: cho QA Lead/PM một bảng đọc được để ra quyết định Go/No-Go, **không tự tuyên bố** `WWHN-70` Done

## 1. Bảng tổng hợp

| Ticket | Vai trò | Trạng thái mã/bằng chứng kỹ thuật | Còn mở — chủ sở hữu | Blocker CI/deploy |
|---|---|---|---|---|
| `WWHN-266` | BE1 · core transaction / If-Match | **FIXED**, verify local PASS tại HEAD hiện tại (`682b943`) — 9/9 + 4/4 test, `verify-wwhn-266-closure.mjs` PASS | BE266-D03 (movement COMPONENT_ISSUE không đảo được) → BA+Tech Lead; BE266-D04 (container_items không nạp) → BA; DEV266-P1-05 retest độc lập → QA1 | CI workflow `wwhn-266-core-transaction-closure.yml` chưa chạy — **N/A theo chỉ đạo người dùng** (ngân sách Actions hết) |
| `WWHN-267` | BE2 · contract/error/sample/data | **FIXED**, verify local PASS tại HEAD hiện tại — `Wwhn267ContractClosureTest` 8/8, `verify-wwhn-267-closure.mjs` PASS | DIV-401/403/422/500 (mã lỗi) → **đã có đề xuất** `DEC-API-ERRORCODE-001`, chờ BA+Tech Lead duyệt; DELTA-01/02/03 (role baseline) → BA+Tech Lead; W267-EXT-03 retest độc lập → QA1/QA2 | Không có workflow CI riêng cho WWHN-267 trong phạm vi đã biết |
| `WWHN-268` | FE · UI state / defect closure | **FIXED**, verify local PASS tại HEAD hiện tại (`5297160`) — `wwhn-268:verify` PASS, unit 8/8, typecheck sạch, e2e **21/21 PASS** | BE268-D02 kế thừa vào DIV-403-01 ở trên; Stocktake scope → **đã pin** `DISP-STK-268`, chờ BA Main/PM/QA duyệt | Workflow `wwhn-268-fe-defect-closure.yml` / `wwhn-268-be-regression-closure.yml` chưa chạy — **N/A theo chỉ đạo người dùng** |
| `WWHN-264` | QA1 · API/DB/integration regression | Phạm vi máy đọc được đã giao (`BE_REGRESSION_SCOPE.json`); công cụ + test hợp đồng lỗi đã có, PASS local | **Lượt chạy độc lập trên build đã deploy — CHƯA THỰC HIỆN**, là việc thật của QA1, không tự ký thay | Không có build đã deploy để trỏ vào tại thời điểm viết tài liệu này |
| `WWHN-265` | QA2 · UI/E2E regression | Bộ retest đã dựng (`e2e/wwhn-268-defect-retest.spec.ts`), chạy lại xanh 21/21 tại HEAD hiện tại | **Lượt chạy độc lập trên build/SHA công bố — CHƯA THỰC HIỆN**, là việc thật của QA2 | Cùng lý do — không có build/CI công bố để đối chiếu |

## 2. Vì sao chưa thể tuyên bố `WWHN-70` Done

Ba điều kiện dưới đây **đồng thời** chưa thoả, và không điều nào tự đóng được
từ phía DEV do giới hạn thẩm quyền/ngân sách hiện tại:

1. **QA1/QA2 chưa chạy độc lập trên build đã deploy hoặc CI.** Toàn bộ con số
   PASS ở bảng trên là `LOCAL_CONTROLLED` (chạy tại chỗ trên máy dev Windows,
   xem `runClass` trong từng `RUN_MANIFEST.json`/`CANDIDATE_PIN.json`) —
   không phải bằng chứng độc lập, không phải bằng chứng exact-SHA từ CI.
2. **GitHub Actions hiện đang tạm dừng theo chỉ đạo người dùng** (ngân sách
   3000/3000 phút đã dùng hết, cấm phát sinh phí thêm). Bốn workflow liên
   quan (`wwhn-266-core-transaction-closure.yml`,
   `wwhn-268-fe-defect-closure.yml`, `wwhn-268-be-regression-closure.yml`, và
   workflow của WWHN-267 nếu có) **cố ý không được kích hoạt** trong vòng làm
   việc này. Đây là **N/A có kiểm soát**, không phải bị bỏ sót — xem §3.
3. **3 mục governance vẫn cần người có thẩm quyền quyết định**, không phải
   việc DEV có thể tự đóng bằng code: `DEC-API-ERRORCODE-001` (mã lỗi),
   `DISP-STK-268` (Stocktake scope kế thừa), và DELTA-01/02/03 (role
   baseline). Cả ba đã có đề xuất/tài liệu đầy đủ, chỉ còn thiếu chữ ký.

## 3. Disposition tường minh cho phần CI/deploy (đáp ứng yêu cầu "PR URL + exact SHA + build ID + CI log")

Theo đúng cho phép của chính register review ("nếu không dùng PR thì formal
N/A + review evidence"):

- **Không dùng CI cho vòng làm việc này** — quyết định có chủ đích của người
  dùng vì tài khoản GitHub Actions đã dùng hết 3000/3000 phút miễn phí; kích
  hoạt thêm workflow sẽ phát sinh phí. DEV/QA không được tự ý bật CI để né
  giới hạn này.
- **Bằng chứng thay thế**: 3 lượt "evidence refresh" ở `RUN_MANIFEST.json`
  (FE), `CANDIDATE_PIN.json` (BE, WWHN-266), và kết quả `phpunit`/`vitest`/
  `playwright` dẫn ở bảng §1 — đều dẫn commit SHA cụ thể trên `m1`, có thể tái
  chạy bằng đúng lệnh đã ghi.
- **Khi ngân sách Actions được cấp lại**: chạy 3-4 workflow trên đúng các SHA
  đã dẫn ở đây (không cần SHA mới, trừ khi có commit tiếp theo chạm phạm vi),
  rồi dán `GITHUB_SHA`/`GITHUB_RUN_ID` vào đúng chỗ đã để `<EXACT_GIT_SHA>` /
  `<FE_RUN_ID>` / `<BE_RUN_ID>` trong `WWHN-268_SIGNOFF_COMMENTS.md` và tương
  đương của WWHN-266/267.

## 4. Khuyến nghị Go/No-Go (không phải quyết định — QA Lead/PM ra quyết định)

**CONDITIONAL GO** cho phần mã nguồn (source-remediated), **NO-GO** cho UAT/
Beta cho tới khi có bằng chứng độc lập của QA1+QA2. Cụ thể:

- Phần code/contract của cả 3 ticket kỹ thuật (266/267/268) đã sửa tận gốc,
  có test khoá lại, verify PASS tại HEAD hiện tại của `m1` — không còn P0/P1
  nào thuộc trách nhiệm DEV còn mở trong 3 ticket đó theo hiểu biết hiện tại.
- `WWHN-70` **không** được chuyển Done cho tới khi `WWHN-264` và `WWHN-265`
  có lượt chạy độc lập + comment PASS/FAIL, **và** 3 mục governance ở §2.3 có
  chữ ký BA/Tech Lead/PM.
- Khi ngân sách CI được khôi phục, đây là điều kiện **bổ sung bằng chứng**,
  không phải điều kiện **sửa lại code** — trừ khi lượt chạy độc lập của QA1/
  QA2 tìm ra defect mới.

## 5. Liên quan

`docs/Task_docs_Jira/WWHN-268_SIGNOFF_COMMENTS.md`,
`docs/evidence/WWHN-268/RUN_MANIFEST.json`,
BE `docs/evidence/WWHN-266/CANDIDATE_PIN.json`,
BE `docs/evidence/WWHN-267/HTTP_ERROR_CODE_PAIRING.json`,
BE `docs/decision-records/DEC-API-ERRORCODE-001-srs-8-2-example-vs-implementation.md`,
BE `docs/decision-records/DISP-STK-268-scope-inheritance.md`.
