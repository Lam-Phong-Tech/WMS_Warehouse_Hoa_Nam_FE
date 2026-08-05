# WWHN-175 - Triển khai khung ứng dụng, phiên làm việc và component dùng chung

Cập nhật: 2026-08-05  
Repository: `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`  
Nhánh duy nhất được xử lý: `m1`  
Baseline trước closure: `79321532b6325b9be598aabdc49f92806b116b1f`  
Tài liệu kiến trúc áp dụng: `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`

## 1. Kết luận phạm vi

- **FE-owned closure: COMPLETE**
- **Final Jira acceptance: PENDING_INDEPENDENT_APPROVAL**
- **P0 trực tiếp trong scope FE foundation: CLOSED / N/A**
- Không tạo nhánh mới; toàn bộ thay đổi closure nằm trong một commit trên `m1`.
- Không tự ký thay QA2, DevOps, BA hoặc Tech Lead.
- Không tuyên bố đã deploy live DEV khi repository chưa có target/credential triển khai thật.

WWHN-175 chỉ được coi là đạt 100% ở cấp Jira sau khi:

1. QA2 xác nhận WWHN-176 trên đúng source SHA/build/artifact.
2. DevOps xác nhận WWHN-177 và target DEV thật, hoặc phê duyệt rõ chế độ `artifact-only`.
3. BA/Tech Lead phê duyệt disposition React/Vite thay cho câu chữ Next.js trong parent/story.
4. Parent WWHN-38 liên kết đúng evidence và không còn P0/P1 mở.

## 2. Root cause và xử lý triệt để

### 2.1 Evidence của WWHN-175 bị rỗng và nằm sai ranh giới

**Root cause:** `docs/Task_docs_Jira/WWHN-175.md` tồn tại nhưng rỗng; Jira vẫn có câu chữ repo cũ `Hoa_Nam_Tools`, còn attachment chính nằm ở parent. Vì vậy code có nhưng không có hồ sơ kiểm toán theo task.

**Xử lý:**

- Tạo hồ sơ canonical này và closure register máy đọc được.
- Tạo evidence index, QA2 matrix, DevOps handoff, architecture disposition và branch scope map.
- CI khóa các file bắt buộc bằng `npm run wwhn-175:verify`.
- CI artifact chứa trực tiếp tài liệu WWHN-175 và toàn bộ `docs/evidence/wwhn-175`.
- Jira subtask/parent phải comment rõ attachment `HN-FE-001-REUSABLE-FE-FOUNDATION.md` là baseline chính và repo evidence là nguồn thực thi theo exact SHA.

### 2.2 Responsive/accessibility/smoke chưa có suite định danh WWHN-175/WWHN-176

**Root cause:** test responsive/RBAC và component catalog đã có ở các task khác, nhưng chưa có execution package riêng cho foundation story; QA2 khó chứng minh đúng task/build/SHA.

**Xử lý:**

- Thêm `e2e/wwhn-175-foundation-evidence.spec.ts`.
- Chạy ba viewport bắt buộc: `1440x900`, `768x1024`, `375x812`.
- Kiểm tra login shell, không overflow ngang, component catalog, shared loading/empty/error/no-permission states, modal bằng keyboard, focus visible và accessible role/name.
- Mỗi scenario sinh screenshot + JSON metadata có task, QA task, environment, source SHA, build version, role, viewport, browser, route và timestamp.
- CI chạy riêng `npm run test:e2e:wwhn-175`; kết quả là gate bắt buộc.

### 2.3 Pipeline có build nhưng chưa có delivery record cho DEV

**Root cause:** workflow cũ build và upload artifact chung, nhưng không tạo handoff manifest theo WWHN-177 và không tạo GitHub Environment deployment record cho `DEV`.

**Xử lý:**

- Thêm `npm run wwhn-177:handoff` để kiểm tra `dist/index.html`, `dist/health.json`, `dist/build-manifest.json`, tính SHA-256 và sinh manifest bất biến.
- CI khóa outcome `WWHN_177_HANDOFF_OUTCOME`.
- Job `DEV delivery evidence` chỉ chạy khi push đúng `m1`, phụ thuộc toàn bộ quality gates và gắn GitHub Environment `DEV`.
- Job tải đúng artifact của source SHA, xác minh manifest/build rồi phát hành artifact `wwhn-177-dev-environment-evidence-<SHA>`.
- `liveDeploymentStatus` được ghi trung thực:
  - `TARGET_CONFIGURED` nếu `DEV_APP_URL` đã được cấu hình;
  - `NOT_CONFIGURED_ARTIFACT_ONLY` nếu chưa có target.
- Không dùng artifact-only để giả mạo runtime deployment.

### 2.4 Next.js trong Jira xung đột React/Vite trong architecture baseline và repo

**Root cause:** parent/story ghi “Next.js shell”, trong khi tài liệu kiến trúc quy định React + TypeScript + Vite và repo thực thi Vite.

**Xử lý:**

- Tạo `ARCHITECTURE_DISPOSITION.md` với trạng thái `PROPOSED_FOR_FORMAL_ACCEPTANCE`.
- Đề xuất chốt **React/Vite SPA shell** cho WWHN-38/WWHN-175; Next.js là câu chữ lỗi thời, không phải runtime hiện hành.
- Không downgrade mù quáng các dependency major đang chạy trong repo; Tech Lead phải ratify exact version matrix sau CI/regression.
- CI kiểm tra disposition không bị xóa hoặc đổi thành “approved” khi chưa có người phê duyệt.
- BA/Tech Lead phải comment/phê duyệt trên Jira trước final Done.

### 2.5 Nhánh `m1` chứa nhiều scope ngoài WWHN-175

**Root cause:** so với `dev`, `m1` đang ahead 81 commits và chứa BA docs, nhiều module FE, auth, inventory, master data và closure task khác. Nghiệm thu theo toàn bộ branch sẽ không truy vết được WWHN-175.

**Xử lý:**

- `BRANCH_SCOPE_MAP.md` khóa baseline `dev@3f168d8` và pre-closure `m1@79321532`.
- Tách:
  - implementation evidence đã tồn tại;
  - file closure được thay đổi trong commit này;
  - phần ngoài scope không được quy kết cho WWHN-175.
- Commit chứa tài liệu này chính là closure commit; exact SHA lấy từ GitHub/Jira comment để tránh self-referential hash.
- CI artifact và Jira comment dùng exact SHA, không dùng “latest m1”.

## 3. Mapping P0/P1/P2

| Sev | Finding | Root fix trong repo | Owner acceptance | Trạng thái |
| --- | --- | --- | --- | --- |
| P0 | Không thấy P0 trực tiếp trong FE foundation | Verifier + mandatory CI gates ngăn regression | FE1 | Closed / N/A |
| P1 | WWHN-176 thiếu responsive/accessibility/smoke evidence | Suite task-specific, metadata, screenshots, trace/video và QA2 matrix | QA2 | FE evidence ready; QA2 sign-off pending |
| P1 | WWHN-177 thiếu pipeline/build/deploy DEV evidence | Immutable build manifest, DEV handoff manifest, GitHub Environment job | DevOps | Pipeline ready; live target disposition pending |
| P1 | Evidence nằm ở parent / repo cũ | Canonical task doc + artifact + Jira cross-link protocol | FE1 + Lead | Repo fixed; Jira comments required |
| P1 | Next.js vs React/Vite | Formal architecture disposition, no silent framework rewrite | BA + Tech Lead | Pending formal approval |
| P2 | Branch scope quá rộng | Exact base/head map và closure file allowlist | FE1 + Reviewer | Closed cho closure commit |

## 4. Implementation evidence hiện có

| Capability | Evidence path |
| --- | --- |
| Provider composition | `src/app/providers/AppProviders.tsx` |
| Query client/provider | `src/app/providers/query-client.ts`, `src/app/providers/query-provider.tsx` |
| Router shell | `src/app/router/index.tsx` |
| Protected session bootstrap | `src/app/router/ProtectedRoute.tsx`, `src/app/bootstrap-auth.ts` |
| Permission route guard | `src/app/router/RequirePermission.tsx`, `src/app/router/access.ts` |
| Main responsive shell | `src/app/layouts/MainLayout.tsx`, `src/app/layouts/SideNav.tsx` |
| Auth/session service | `src/modules/auth/services/auth.service.ts`, `src/shared/api/axios.ts`, `src/shared/store/auth.store.ts` |
| Shared component exports/docs | `src/shared/components/index.ts`, `src/shared/components/README.md` |
| Shared component runtime catalog | `src/modules/component-catalog/ComponentCatalogPage.tsx`, route `/component-catalog` |
| Existing auth/RBAC evidence | `e2e/wms-runtime-evidence.spec.ts`, `e2e/auth-role-navigation-qa2.spec.ts`, `e2e/wwhn-165-auth-session.spec.ts` |
| WWHN-175 QA2 evidence | `e2e/wwhn-175-foundation-evidence.spec.ts` |

## 5. Quality gates bắt buộc

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run env:verify`
- `npm run uat:p0p1:verify`
- `npm run wwhn-175:verify`
- `npm run build`
- `npm run health:check`
- `npm run check:api-mapping`
- `npm run test:e2e:evidence`
- `npm run test:e2e:wwhn-175`
- `npm run wwhn-177:handoff`
- `node scripts/assert-ci-gates.mjs`

Workflow chỉ pass khi toàn bộ mandatory outcomes là `success`.

## 6. Evidence naming và metadata

Thư mục runtime:

`test-results/wwhn-175/<SOURCE_SHA>/`

Filename:

`WWHN-175__<scenario>__<role>__<width>x<height>.png|json`

Metadata tối thiểu:

- `ticket`: WWHN-175
- `qaTicket`: WWHN-176
- `sourceSha`
- `environment`
- `buildVersion`
- `browserProject`
- `role`
- `viewport`
- `route`
- `finalUrl`
- `timestamp`
- `assertions`
- `evidenceBoundary`

CI artifact chính:

`wms-fe-closure-evidence-<SOURCE_SHA>`

DEV delivery artifact:

`wwhn-177-dev-environment-evidence-<SOURCE_SHA>`

## 7. Jira cross-link protocol

Sau khi commit và CI chạy:

1. Comment WWHN-175:
   - exact commit SHA;
   - CI run;
   - artifact name;
   - link tới file này;
   - xác nhận parent attachment `HN-FE-001-REUSABLE-FE-FOUNDATION.md` là baseline chính.
2. Comment WWHN-176:
   - exact SHA/build;
   - artifact;
   - execution matrix;
   - yêu cầu QA2 ghi PASS/FAIL độc lập.
3. Comment WWHN-177:
   - build manifest;
   - DEV handoff manifest;
   - GitHub Environment job;
   - target URL/status.
4. Comment WWHN-38:
   - architecture disposition;
   - yêu cầu BA/Tech Lead phê duyệt React/Vite;
   - không chuyển parent Done trước khi 176/177 hoàn tất.

## 8. Definition of Done trung thực

### FE1 completion

- Foundation implementation có source path rõ.
- WWHN-175 canonical evidence không còn rỗng.
- P0/P1/P2 được map tới root cause và automated gate.
- Responsive/accessibility/smoke evidence có suite riêng.
- Build/DEV handoff có checksum, source SHA và environment record.
- Branch scope được giới hạn theo closure commit.
- Một commit duy nhất trên `m1`.

### Final Jira completion

Final Done vẫn cần chữ ký độc lập của QA2, DevOps và BA/Tech Lead. FE evidence hoặc GitHub Environment artifact không được dùng để tự thay thế các owner này.
