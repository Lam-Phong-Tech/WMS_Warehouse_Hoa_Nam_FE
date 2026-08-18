# WWHN-311 - Hoàn thiện tài liệu build/component FE

Cập nhật: 2026-08-18  
Repository: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`  
Nhánh thực hiện: `m1`  
Pre-remediation FE SHA: `5cc27970d36edd2063fd3ce4181d2108dd0077d0`  
BE baseline đối chiếu: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE@m1` / `0a7bd392f4510f3ad5d5be7394173695463f2b6e`

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
| P1 | Lint/build/test chỉ ghi trong tài liệu, thiếu exact execution identity | GitHub Actions `CI` trên push `m1` là execution source: exact commit SHA + run ID + `VITE_APP_VERSION` + env + logs; reviewer phải dùng run của closure SHA, không dùng “latest m1” mơ hồ | READY ON CLOSURE CI | FE1 + reviewer |
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

Các lệnh phải chạy/được CI ghi log trên exact closure SHA:

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
- GitHub Actions run ID/URL
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

FE-owned output đủ điều kiện chuyển sang independent review khi closure commit đã có CI execution theo exact SHA và các gate bắt buộc PASS.

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
- CI exact closure SHA chứng minh lint/typecheck/test/build/health/API mapping/E2E theo scope.
- Không có stocktake/partial-post/RFID-mandatory drift trong handover.
- Independent reviewers ghi một sign-off rõ phạm vi; FE không tự đóng external gate.
