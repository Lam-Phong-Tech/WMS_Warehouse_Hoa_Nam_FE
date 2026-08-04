# HN-INT-001 — FE Sign-off Control Record

## 1. Kết luận hiện tại

**Trạng thái: CONDITIONAL PASS — CHƯA ĐƯỢC PHÉP FINAL SIGN-OFF.**

FE đã hoàn thành các guard và remediation nằm trong phạm vi repository. Tuy nhiên, không thể tuyên bố 100% hoặc Final FE Sign-off khi các điều kiện độc lập sau chưa có bằng chứng hợp lệ:

1. `WWHN-180` phải hết Impediment và BE1 + BA khóa contract chính thức.
2. `WWHN-182` phải có QA2 execution evidence trên commit/build/env cụ thể.
3. `WWHN-183` phải có G1 minutes và quyết định `Go / Conditional Go / No-Go`.
4. Permission catalog phải được BE/RBAC + BA duyệt và đối chiếu với runtime `/permissions`.
5. P2 responsive/API-error evidence phải được chụp trên build thực.

Không mục nào bên dưới được ghi là “Pass production” nếu chỉ có code FE hoặc unit test.

## 2. Baseline và thay đổi mới nhất

| Trường | Giá trị |
| --- | --- |
| Repository | `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE` |
| Branch | `m1` |
| Ngày cập nhật | `2026-08-03` |
| Permission catalog commit | `a052d042416d0403cd657110ebbdac617ed69cd5` |
| Regression test commit | `6e627964e348b7605092f6fc4b3acfe84bbb49d9` |
| CI remediation commit | `7b2a967301c4bad16e20cca0affd9bc420188da7` |
| Sign-off authority | FE1 xác nhận FE code readiness; BA/QA/BE quyết định gate tích hợp |

## 3. P0/P1/P2 closure matrix

| Mức | Vấn đề | Remediation trong FE | Trạng thái thật | Điều kiện đóng |
| --- | --- | --- | --- | --- |
| P0 | BE contract chưa khóa | FE giữ endpoint tập trung, validation, idempotency và `If-Match` guards cho Scan, Post Receipt, Post Issue, Apply Adjustment. Không tự đổi disputed Scan path. | **FE guarded / External blocker open** | BE1 + BA publish một contract duy nhất gồm method, path, request, response, errors, permission, idempotency, sample success/error. |
| P0 | Final FE sign-off chưa hợp lệ | `WMS_FINAL_SIGNOFF.finalAllowed=false`; unit test khóa điều kiện không được ký final. | **Closed trong code wording / Gate vẫn blocked** | `WWHN-180` pass, `WWHN-182` pass, `WWHN-183` có decision. |
| P1 | Scan path conflict | FE hiện dùng `POST /scan-batches/classify`; test bảo đảm không tự chuyển sang `/api/v1/scan/classify` khi chưa có approved contract. | **Conditional** | BE1 + BA chọn một canonical path; FE cập nhật constant/service/test trong cùng commit nếu contract khác. |
| P1 | `ROUTE_PERMISSIONS` conditional | Bổ sung central catalog và action groups cho `stocktake.adjust`, `warranty.temp_only`, `report.export`, scan inbound/outbound/warranty context. Route-entry và action permission được tách riêng. | **FE guarded / Approval open** | BE/RBAC + BA duyệt code, scope rule và runtime mapping; action guards phải được wiring ở UI tương ứng nếu chưa có. |
| P1 | Dashboard/Reports chưa canonical đủ | FE constants hiện có `/reports/dashboard-quick`, `/reports/inventory-xnt`, `/reports/inventory-xnt/export-excel`, `/reports/hub`; unit test khóa mapping hiện tại. | **Conditional** | BE1/BE2 + BA xác nhận OpenAPI/Jira disposition của từng endpoint, đặc biệt `/reports/hub`. |
| P1 | QA2 chưa chạy | CI và test guards cung cấp input cho QA; không giả mạo QA evidence. | **Open external blocker** | QA2 chạy happy, negative, RBAC, 401/403/409/422, idempotency replay, retry/network failure trên commit/build/env cụ thể. |
| P1 | BA gate chưa có | FE-SO closure conditions được chuẩn hóa trong tài liệu này. | **Open external blocker** | BA ghi G1 minutes, decision và closure từng `FE-SO-001...006`. |
| P2 | UI evidence chưa đủ | Foundation responsive/error-state có trong code; chưa được coi là runtime evidence. | **Open external blocker** | FE1 + QA2 attach screenshot/video desktop/tablet/mobile, role/env/build, và lỗi API thật. |

## 4. Contract guard hiện có

### 4.1 Endpoint và mutation safety

`src/test/wms-contract-signoff-guards.test.ts` kiểm tra:

- Scan classify dùng endpoint hiện tại `/scan-batches/classify`.
- Không tự chuyển sang disputed path `/api/v1/scan/classify`.
- Scan payload duplicate hoặc invalid bị chặn trước network call.
- Physical-code endpoint chưa approved bị fail-closed.
- Post Receipt gửi `Idempotency-Key` và `If-Match`.
- Post Issue gửi `Idempotency-Key` và `If-Match`.
- Apply Adjustment gửi `Idempotency-Key` và `If-Match`.
- Mutation thiếu idempotency/version hoặc response evidence bị reject.
- Dashboard/XNT/export chỉ dùng constants hiện tại và vẫn mang trạng thái conditional.

### 4.2 Permission catalog và action mapping

`src/shared/constants/wms-permissions.ts` hiện định nghĩa:

- Route/basic permissions: `inventory.trace`, `scan.classify`, `inbound.post`, `outbound.post`, `stocktake.count`, `stocktake.adjust`, `warranty.manage`, `report.view`, `report.export`, `inventory.reversal.post`.
- Context permissions: `scan.inbound`, `scan.outbound`, `scan.warranty`.
- Sensitive action permission: `warranty.temp_only`.
- `WMS_ACTION_PERMISSIONS` tách action-level authorization khỏi route-entry authorization.

**Caveat:** đây là FE mapping proposal/guard. Backend vẫn là authority. Mapping chỉ được coi là production-approved sau khi BE/RBAC + BA xác nhận runtime catalog và scope semantics.

## 5. CI quality gate

Workflow `.github/workflows/ci.yml` chạy:

1. install dependencies;
2. `format:check`;
3. `lint`;
4. `test`;
5. `env:verify`;
6. `uat:p0p1:verify`;
7. `master-sku:verify`;
8. `build`;
9. `health:check`;
10. `check:api-mapping`.

Run của commit `6e627964...` fail tại `npm ci` vì repository không có `package-lock.json`; các quality gates sau đó chưa chạy. Commit `7b2a9673...` đã sửa workflow:

- Có lockfile: dùng `npm ci`.
- Chưa có lockfile: dùng `npm install --package-lock=false` và phát warning rõ ràng.

Đây là remediation để CI tiếp tục chạy, nhưng không thay thế yêu cầu tạo/review `package-lock.json` để có deterministic install. CI chỉ được ghi Pass sau khi workflow của HEAD hoàn tất thành công.

## 6. FE-SO closure register

| ID | Trạng thái FE | Blocker còn lại |
| --- | --- | --- |
| FE-SO-001 Scan | FE guard có test | Canonical endpoint/schema/error/permission/sample chưa BE+BA approved. |
| FE-SO-002 Receipt/Issue | FE guard có idempotency + optimistic-lock test | Contract lỗi/RBAC và QA replay evidence chưa có. |
| FE-SO-003 Dashboard/Reports | FE mapping có regression test | `/reports/hub` và toàn bộ report contract chưa BE+BA xác nhận. |
| FE-SO-004 RBAC | FE catalog/action groups đã bổ sung | Runtime permission catalog, scope và approval chưa có. |
| FE-SO-005 Stocktake/Warranty/Reverse | FE service/types/guards có sẵn | Apply Adjustment, TEMP_ONLY, reverse errors/sample/permission chưa được khóa. |
| FE-SO-006 UI evidence | Chưa đóng | Cần screenshot/video responsive và API errors thật theo role/env/build. |

## 7. QA2 execution checklist bắt buộc

QA2 phải ghi commit SHA, workflow/build ID, environment, account/role và evidence link cho từng nhóm:

| Nhóm | Cases tối thiểu |
| --- | --- |
| Happy | Scan success; Post Receipt; Post Issue; Apply Adjustment; dashboard/XNT/export. |
| Negative | invalid/duplicate scan; validation 422; stock conflict 409; network failure; malformed response. |
| RBAC | allowed role; denied 403; hidden/disabled action; direct API denial. |
| Idempotency | double-click; replay cùng key; retry sau timeout; key mới tạo transaction mới. |
| Auth | 401 refresh success; refresh failure/logout; 403 không bị hiểu nhầm thành 401. |
| Responsive | desktop, tablet, mobile cho các flow P0/P1. |

Không chấp nhận screenshot không có build/env/role hoặc dùng mock response làm production evidence.

## 8. BA G1 minutes template

BA phải ghi rõ:

- Decision: `Go`, `Conditional Go`, hoặc `No-Go`.
- Baseline commit/build/env.
- Trạng thái `WWHN-180`, `WWHN-182`, `WWHN-183`.
- Closure từng `FE-SO-001...006`.
- Owner và deadline cho blocker còn mở.
- Risk acceptance, rollback condition và người có thẩm quyền chấp nhận.

## 9. Final sign-off rule

Chỉ được đổi tài liệu này sang **FINAL PASS** khi đồng thời:

- BE1 + BA khóa contract và xóa conflict Scan path.
- Permission catalog/runtime mapping được duyệt.
- CI của đúng HEAD pass toàn bộ quality gates.
- QA2 attach đủ evidence và kết luận Pass.
- BA phát hành G1 minutes với decision hợp lệ.
- P2 responsive/API-error evidence có đủ build/env/role.

Trước thời điểm đó, kết luận hợp lệ duy nhất là **Conditional Pass — Final blocked**.
