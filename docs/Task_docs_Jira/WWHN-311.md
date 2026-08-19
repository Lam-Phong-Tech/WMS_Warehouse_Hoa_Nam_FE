# WWHN-311 - Hoàn thiện tài liệu build/component FE

Cập nhật: 2026-08-19 (R2 theo register comment 15621)  
Repository: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`  
Nhánh thực hiện: `m1`  
Pre-remediation FE SHA (R1, historical): `5cc27970d36edd2063fd3ce4181d2108dd0077d0`  
R1 closure SHA (historical, đã bị supersede): `13ef8b6f85afeba147f83bb593e493ddfc522e8e`  
BE baseline đối chiếu R1 (historical): `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE@m1` / `0a7bd392f4510f3ad5d5be7394173695463f2b6e`  
BE re-verify R2: canonical permission seed (`audit_log.view`, `scan.execute|scan.classify`, `putaway.view/manage`, `packing_label.*`, `outbound.request.*`) được xác nhận vẫn tồn tại không đổi tại BE `m1` HEAD hiện hành khi chốt R2; SHA BE re-verify ghi trong evidence pack R2.

Quy tắc chốt candidate R2: candidate là **commit cuối cùng chạm tập artifact handover** (`docs/Task_docs_Jira/WWHN-311.md`, `README.md`, `.env.example`, `package.json`, `src/app/router/*`, `src/shared/constants/wms-permissions.ts`, `src/shared/api/*`) trên `m1`; exact SHA của candidate và của evidence run được ghi trong `docs/evidence/WWHN-311/R2/run-identity.txt` (evidence pack đứng ngoài tập artifact được pin để tránh pin tự tham chiếu).

## 1. Phạm vi và nguồn chuẩn

WWHN-311 là FE handover của parent WWHN-83. Phạm vi FE gồm build/run, component/module map, API/RBAC integration boundary, quality gates và evidence có thể truy vết. Không tự ký thay BAS/BA/BE/QA/DevOps và không tự đóng parent WWHN-83.

Nguồn được đọc/đối chiếu:

1. `docs/HN_SRS_FRD_v1.12_FULL.md` - requirement/flow hiện hành.
2. `docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html` - screen/state/UX baseline.
3. `docs/HoaNam_ERD_Moi_Nhat.md` - physical schema proposal; nếu có xung đột cũ với SRS v1.12 thì không được dùng để ghi đè requirement mới hơn.
4. `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md` - React/Vite/TypeScript SPA, module architecture, API-first, RBAC theo permission code và CI gates.

Các invariants FE không được làm sai:

- MVP không có stocktake/adjustment trực tiếp.
- Không partial posting; inbound/outbound là full-post.
- Outbound: tiếp nhận toa -> DRAFT -> full scan/match -> Packing Label Preview/Ready/Print + xác nhận đã dán -> Post Issue; chỉ Post Issue thành công mới trừ tồn.
- RFID là optional theo SRS/wireframe v1.12, không phải gate bắt buộc để Post.
- Posted movement/audit không sửa trực tiếp; correction đi qua reversal.

## 2. Kết quả remediation theo đánh giá WWHN-311

| Sev | Finding | Xử lý FE | Trạng thái sau remediation | Owner còn lại |
| --- | --- | --- | --- | --- |
| P0 | Parent WWHN-83 còn `Blocked/Pending` | Giữ fail-closed; WWHN-311 không tự tuyên bố parent Done | EXTERNAL GATE PENDING | BAS/PM + sibling owners |
| P1 | Chưa có independent review Frontend handover | Chuẩn hóa handover này, build/RBAC/module/evidence boundary để reviewer xác nhận một lần | READY FOR REVIEW | BA/QA/DevOps |
| P1 | Lint/build/test chỉ ghi trong tài liệu, thiếu exact execution identity | Execution identity theo exact SHA: raw command logs + exit code + env + `VITE_APP_VERSION` + SHA256SUMS trong `docs/evidence/WWHN-311/R2/` (local reproducible run, cùng pattern đã nghiệm thu ở WWHN-292); CI exact-SHA run là kênh bổ sung, không phải điều kiện duy nhất | CLOSED (local identity R2) | FE1 + reviewer |
| P1 | Permission/API workflow conditional | Đối chiếu BE canonical permission seed; sửa FE route keys sai `AUDIT_LOG_VIEW`, Scan thiếu `scan.execute`, Putaway thiếu `putaway.*`; phần formal API/permission handover vẫn thuộc WWHN-309/BA | FE RUNTIME FIXED / FORMAL SIGN-OFF PENDING | BE + BA |
| P1 | Weak GitHub trace | Tạo canonical path `docs/Task_docs_Jira/WWHN-311.md` và ghi exact pre-remediation SHA/BE baseline | CLOSED | FE1 |
| P2 | README/script mismatch | README đồng bộ package hiện hành, bỏ stocktake ngoài MVP, ghi đúng Ant Design 6 / React Router 7 và test commands | CLOSED | FE1 |

## 3. Build / run / quality gates

Runtime baseline hiện tại:

- React 19 + TypeScript + Vite 8 SPA.
- Ant Design 6.
- React Router 7.
- Zustand cho auth/client state; TanStack Query cho server state.
- Vitest unit/integration; Playwright E2E.

Các lệnh phải được chạy và ghi raw log trên exact closure SHA (CI run hoặc local reproducible run có SHA256SUMS):

```bash
yarn install --frozen-lockfile --non-interactive
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run health:check
npm run check:api-mapping
npm run test:e2e:evidence
```

`package.json` còn có `test:e2e`, `test:coverage` và các verifier/evidence suite task-specific. Build tạo `dist/index.html`, `dist/health.json`, `dist/build-manifest.json`.

Execution identity tối thiểu cần ghi khi review:

- Branch: `m1`
- Source/commit SHA
- Run identity: GitHub Actions run ID/URL, hoặc local run identity (timestamp + máy chạy + raw log + SHA256SUMS trong `docs/evidence/WWHN-311/`)
- `VITE_APP_ENV`
- `VITE_APP_VERSION` / build version
- Kết quả lint/typecheck/unit/build/health/API mapping/E2E liên quan
- Artifact/evidence name nếu run phát hành artifact

Không dùng log từ SHA khác để kết luận WWHN-311 PASS.

## 4. Component / module handover

| Hạng mục | Path chính |
| --- | --- |
| App providers/query/theme/auth | `src/app/providers/` |
| Router + route access | `src/app/router/` |
| Main shell/navigation | `src/app/layouts/` |
| Shared API/error/contract | `src/shared/api/` |
| Canonical FE WMS permission catalog | `src/shared/constants/wms-permissions.ts` |
| Shared reusable components | `src/shared/components/` |
| Auth/session | `src/modules/auth/` + `src/shared/store/auth.store.ts` |
| Master/IAM | `src/modules/master-data/`, IAM-related modules |
| Inbound/Putaway | `src/modules/inbound/` |
| Outbound/Packing Label | `src/modules/outbound/` |
| Inventory/trace/reversal | `src/modules/inventory/`, `src/modules/reverse/` |
| Warranty/component issue | `src/modules/warranty/` |
| Reports | `src/modules/reports/` |
| Runtime evidence | `e2e/`, `docs/evidence/`, `test-results/` |

Loading/empty/error/no-permission/confirm state phải ưu tiên shared components và không hard-code response ngoài API contract.

## 5. RBAC/API contract closure

BE `m1@0a7bd392...` seed canonical permissions gồm `inbound.*`, `outbound.*`, `inventory.trace`, `inventory.reversal.post`, `putaway.view/manage`, `warranty.view/manage`, `packing_label.*`, `outbound.request.*`, `report.*`, `audit_log.view` và các key IAM/master liên quan.

FE remediation của WWHN-311 áp dụng các nguyên tắc:

- Route/action gate là UX guard; BE vẫn là authoritative authorization boundary.
- Audit route dùng canonical `audit_log.view`.
- Scan route nhận cả `scan.execute` và `scan.classify` theo compatibility contract của BE.
- Putaway route nhận `putaway.view/manage`; `container.*` chỉ giữ compatibility nơi BE cho phép, không được coi là canonical replacement.
- Không thêm stocktake permission/route/action.

Formal lock endpoint/payload/error/sample/permission cho backend handover phải được BE/BA xác nhận ở WWHN-309/related baseline. FE không tự ký thay owner đó.

## 6. Evidence và acceptance boundary

FE-owned output đủ điều kiện chuyển sang independent review khi closure commit đã có execution identity theo exact SHA (CI run hoặc local reproducible evidence pack có raw log + SHA256SUMS) và các gate bắt buộc PASS.

Các gate không thuộc FE1 và không được giả lập:

1. WWHN-83 parent disposition/closure của BAS/PM.
2. BA xác nhận UI/requirement/API mapping dùng được và không có baseline drift.
3. QA xác nhận testability/runtime evidence trên exact closure SHA.
4. DevOps xác nhận build/run/ops handover dùng được nếu phạm vi nghiệm thu yêu cầu operational receipt.
5. BE/BA xác nhận formal permission/API contract cho các workflow nhạy cảm.

## 7. Definition of Done cho WWHN-311

- Canonical frontend handover nằm trong repo và truy vết được tới exact SHA.
- README/build/component docs khớp package/runtime hiện hành và MVP baseline.
- Không còn FE RBAC mismatch đã biết ở audit/scan/putaway.
- Execution identity tại exact closure SHA chứng minh lint/typecheck/test/build/health/API mapping theo scope (raw log + SHA256SUMS; E2E theo scope khi môi trường runtime có sẵn).
- Không có stocktake/partial-post/RFID-mandatory drift trong handover.
- Independent reviewers ghi một sign-off rõ phạm vi; FE không tự đóng external gate.

## 8. Remediation R2 theo register WWHN-311 comment 15621 (PASS có điều kiện 82/100)

Compare scope chính thức `13ef8b6f...` → candidate R2, giới hạn trong tập artifact handover:

| File | Thay đổi kể từ R1 closure | Disposition R2 |
| --- | --- | --- |
| `README.md` | Bảng env sửa `VITE_API_BASE_URL` `8000→8080`, `VITE_API_WITH_CREDENTIALS` `false→true`, làm rõ health path (commit `7320501`, WWHN-296) | Chính là fix của FE311-P1-02; README/.env.example nhất quán `8080/true` tại candidate R2 |
| `.env.example` | Không đổi kể từ R1 (`8080/true` từ trước) | Nguồn đúng; README đã hội tụ về nguồn này |
| `package.json` | Chỉ thêm task-specific verifier/e2e scripts của các ticket khác; không đổi dependency runtime, không đổi các gate command của WWHN-311 | Không ảnh hưởng handover contract |
| `src/app/router/access.ts`, `access.test.ts`, `index.tsx` | Bổ sung route/access của các ticket sau R1 (dashboard, reversal, ...) | RBAC regression `access.test.ts` phải PASS lại tại candidate R2 |
| `src/shared/constants/wms-permissions.ts` | Bổ sung permission key mới theo BE canonical seed | Đối chiếu lại BE seed tại BE `m1` HEAD: các key WWHN-311 quan tâm không đổi |
| `src/shared/api/*` | Bổ sung contract pin/test của các ticket khác (267/289/202/...) | Không phá API boundary đã bàn giao; unit/integration suite phải PASS lại |
| `docs/Task_docs_Jira/WWHN-311.md` | Cập nhật R2 (tài liệu này) | Canonical handover hiện hành |

Disposition từng mục register:

| ID | Disposition R2 |
| --- | --- |
| FE311-P1-01 | Chốt candidate R2 theo quy tắc commit-cuối-chạm-artifact ở đầu tài liệu; compare scope như bảng trên; sign-off refresh tại exact candidate SHA (ghi trong evidence pack + Jira comment) |
| FE311-P1-02 | Fix nằm trong lịch sử `m1` (commit `7320501`); tại candidate R2, README và `.env.example` cùng SHA và cùng giá trị `http://localhost:8080/api/v1` + `VITE_API_WITH_CREDENTIALS=true` |
| FE311-P1-03 | Jira attachment ATT-11431 (01/08) tuyên bố SUPERSEDED bằng Jira comment; canonical duy nhất là `docs/Task_docs_Jira/WWHN-311.md` tại exact candidate SHA trên GitHub |
| FE311-P1-04 | Execution identity tái lập được: raw log lint/typecheck/test/build/health/API-mapping + env + build version + SHA256SUMS trong `docs/evidence/WWHN-311/R2/`; không phụ thuộc mô tả miệng |
| FE311-P1-05 | External gate của DO; FE cung cấp đủ build/run/env/artifact input; DO ghi sign-off độc lập trên Jira |
| FE311-P2-01 | External gate của BE2/BAS actual owner; không xóa comment cũ; owner thật bổ sung confirmation độc lập trên Jira |
