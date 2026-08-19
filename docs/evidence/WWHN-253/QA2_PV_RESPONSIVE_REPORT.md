# WWHN-253 — Báo cáo QA2 App PV (FE252-P1-05R2)

> **Tệp sinh tự động — không sửa tay.** Nguồn: `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f`.
> Sinh lại: `SOURCE_SHA=<sha> node scripts/generate-wwhn-253-qa2-report.mjs`.

| Trường | Giá trị |
|---|---|
| Register item | FE252-P1-05R2 (WWHN-253) |
| Ticket cha | WWHN-252 |
| Exact review SHA | `ebdb061098bea9426c2949e5c50b53ba8a09289f` |
| Build version | `local-dev` |
| Môi trường | `local-controlled` |
| Trình duyệt | `chromium` (Chromium engine) |
| Số ô bằng chứng | 32 (8 trạng thái × 4 khung nhìn) |
| Kết quả | **PASS toàn bộ ma trận** |
| Sinh lúc | 2026-08-19T11:25:25.270Z |

## 1. Ma trận khung nhìn × trạng thái

| Trạng thái \ Khung nhìn | 390×844 | 768×1024 | 1366×768 | 1440×900 |
|---|---|---|---|---|
| public — SCR-PV-01 ẩn danh, không gửi Authorization | PASS | PASS | PASS | PASS |
| RBAC — pv.master.manage KHÔNG mở khoá publish | PASS | PASS | PASS | PASS |
| RBAC — pv.publish mở khoá publish | PASS | PASS | PASS | PASS |
| error — 500 kèm request_id | PASS | PASS | PASS | PASS |
| offline — mất kết nối, không đá sang /login | PASS | PASS | PASS | PASS |
| 404 — chi tiết sản phẩm không tồn tại | PASS | PASS | PASS | PASS |
| 429 — giới hạn truy cập, không tự retry | PASS | PASS | PASS | PASS |
| freshness — NFR-SRS-016 cảnh báo dữ liệu cũ | PASS | PASS | PASS | PASS |

Mọi ô đều kiểm thêm một điều kiện chung: **không tràn ngang**
(`documentElement.scrollWidth <= window.innerWidth`) — đây là lỗi responsive
hay lọt nhất và không thể thấy được qua ảnh chụp.

## 2. Khẳng định của từng trạng thái

- **public — SCR-PV-01 ẩn danh, không gửi Authorization** (route `/pv`, vai `anonymous`)
  - Luoi san pham SCR-PV-01 hien thi
  - O tim kiem + bo loc hien thi
  - Khong tran ngang o khung nhin nay
  - Request /pv/* KHONG kem Authorization (actor an danh)
- **RBAC — pv.master.manage KHÔNG mở khoá publish** (route `/pv-admin`, vai `pv.master.manage`)
  - pv.master.manage KHONG mo khoa cong tac publish (§3 tach hai quyen)
  - UI noi ro ly do thay vi im lang vo hieu hoa
- **RBAC — pv.publish mở khoá publish** (route `/pv-admin`, vai `pv.master.manage + pv.publish`)
  - Co pv.publish thi cong tac publish mo khoa
- **error — 500 kèm request_id** (route `/pv`, vai `anonymous`)
  - 500 hien trang thai loi tai cho
  - Hien thi request_id de doi chieu log (NFR-SRS-008)
- **offline — mất kết nối, không đá sang /login** (route `/pv`, vai `anonymous`)
  - Mat mang hien trang thai mat ket noi chu khong da sang /login
  - Co nut thu lai
- **404 — chi tiết sản phẩm không tồn tại** (route `/pv/products/99999999-9999-4999-8999-999999999999`, vai `anonymous`)
  - 404 hien trang thai khong tim thay tai cho
  - Van co duong quay lai danh muc (khong phai ngo cut)
- **429 — giới hạn truy cập, không tự retry** (route `/pv`, vai `anonymous`)
  - 429 hien thong diep gioi han truy cap kem so giay cho tu Retry-After
  - Khong tu retry sau 429 (dung 1 request /pv/products)
- **freshness — NFR-SRS-016 cảnh báo dữ liệu cũ** (route `/pv`, vai `anonymous`)
  - Nhan do tuoi hien trang thai degraded khi data_as_of qua nguong
  - Nguong lay tu max_staleness_seconds cua response, khong hardcode

## 3. Ranh giới sự thật (đọc trước khi dùng làm bằng chứng nghiệm thu)

Bang chung hanh vi FE co kiem soat (API mock o tang network). Khong phai bang chung backend authorization/data-scope.

Cụ thể: báo cáo này chứng minh **hành vi giao diện** khớp hợp đồng Annex C ở bốn
khung nhìn. Nó KHÔNG thay thế:

- Bằng chứng backend enforce quyền/data-scope → `Wwhn252PvContractTest`,
  `Wwhn249PvSurfaceGovernanceTest` (repo BE).
- UAT trên thiết bị thật của QA1/khách hàng → WWHN-275.

## 4. Tệp bằng chứng (ảnh)

- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-404__desktop-1366x768.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-404__desktop-1440x900.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-404__mobile-390x844.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-404__tablet-768x1024.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-429__desktop-1366x768.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-429__desktop-1440x900.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-429__mobile-390x844.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-429__tablet-768x1024.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-500__desktop-1366x768.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-500__desktop-1440x900.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-500__mobile-390x844.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__error-500__tablet-768x1024.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__freshness-degraded__desktop-1366x768.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__freshness-degraded__desktop-1440x900.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__freshness-degraded__mobile-390x844.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__freshness-degraded__tablet-768x1024.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__offline__desktop-1366x768.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__offline__desktop-1440x900.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__offline__mobile-390x844.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__offline__tablet-768x1024.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__public-catalog__desktop-1366x768.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__public-catalog__desktop-1440x900.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__public-catalog__mobile-390x844.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__public-catalog__tablet-768x1024.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__rbac-publish-allowed__desktop-1366x768.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__rbac-publish-allowed__desktop-1440x900.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__rbac-publish-allowed__mobile-390x844.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__rbac-publish-allowed__tablet-768x1024.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__rbac-publish-denied__desktop-1366x768.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__rbac-publish-denied__desktop-1440x900.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__rbac-publish-denied__mobile-390x844.png`
- `test-results/wwhn-253/ebdb061098bea9426c2949e5c50b53ba8a09289f/WWHN-253__rbac-publish-denied__tablet-768x1024.png`

Mỗi ảnh đi kèm một tệp `.json` cùng tên chứa SHA, khung nhìn, route, vai trò và
danh sách khẳng định. Video/trace của phiên chạy nằm trong `test-results/`.
