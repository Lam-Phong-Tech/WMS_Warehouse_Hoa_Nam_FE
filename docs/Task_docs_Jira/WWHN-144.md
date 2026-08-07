# WWHN-144 — FE layout/navigation/shared component closure

> Re-audit authoritative: **07/08/2026**  
> Branch duy nhất: `m1`  
> FE technical disposition: **READY FOR REVIEW**  
> Parent/QA disposition: **không tự nhận Done; giữ workflow gate độc lập**

## 1. Mục tiêu và phạm vi

WWHN-144 triển khai khung giao diện responsive, navigation shell, menu theo RBAC, route guard và shared component phục vụ parent WWHN-29 theo `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`.

Kiến trúc áp dụng đúng baseline: React/Vite/TypeScript SPA, shared layout/router, RBAC theo **permission code** thay vì role name, Vitest + Playwright, fail-closed route guard và CI quality gates.

**Disposition API mapping:** WWHN-144 và WWHN-29 là **UX frame scope**, **không phải API integration endpoint scope**. Mock API trong E2E chỉ tạo state xác định để kiểm thử hành vi FE. Backend authorization, direct API denial, data scope và audit vẫn thuộc BE/QA1; FE hide menu hoặc redirect không được dùng thay bằng chứng authorization phía server.

## 2. Kết luận re-review P0/P1/P2 ngày 07/08/2026

| Sev | Finding | Xử lý gốc rễ / evidence | Disposition |
| --- | --- | --- | --- |
| P0 | N/A trực tiếp FE-owned | Không tạo thay đổi giả để “đóng P0”; route/menu tiếp tục fail-closed theo permission code. | **CLOSED / no FE P0** |
| P1 | Final exact-SHA CI chưa verified | Re-verify known-good artifact bằng SHA-256 thực; audit equivalence critical blobs; xác định run hiện tại fail trước khi job start do GitHub Actions billing/spending limit. Không bypass gate. | **FE evidence closed; external CI infra gate open** |
| P1 | `WWHN-145` chưa QA2 PASS | Giữ deterministic 6/6 technical suite + extracted evidence; QA2 Nguyễn Cúc vẫn phải review/rerun độc lập trên exact final SHA khi CI runner hoạt động. | **External QA2 gate** |
| P1 | Parent chưa ready | `WWHN-143 = In Progress`, `WWHN-145 = To Do`, `WWHN-29 = In Progress`; **không chuyển parent WWHN-29**. | **Workflow guard enforced** |
| P1 | Evidence còn self-handoff | Artifact PASS đã được tải lại, hash lại và giải nén lên Drive theo `screenshots/metadata/videos/manifests`, có root manifest + per-file SHA-256. | **CLOSED** |
| P2 | API scope disposition | Khóa ranh giới UX frame; BE auth/API denial/data scope/audit không nằm trong sign-off WWHN-144. | **CLOSED** |

## 3. Known-good exact-SHA evidence — kiểm lại độc lập

### 3.1 Source/run/build

- Source SHA: `8f9ac97f5ebbc9ac036d5ad732ccbbfdf615adab`;
- GitHub Actions run: `30977711589` — **PASS**;
- Artifact: `wms-fe-closure-evidence-8f9ac97f5ebbc9ac036d5ad732ccbbfdf615adab`;
- Artifact ID: `8918968586`;
- Artifact SHA-256: `ece3d04f85f014bc89411c8fa852023ca67df2989e98766f82c20ce0ef6344c1`;
- Build: `1.0.0-ci.133.1`;
- Environment: `test`;
- Mandatory gates: **19/19 PASS**;
- Unit/integration: **39 files / 320 tests PASS**;
- WWHN-144 technical matrix: **6/6 PASS**.

### 3.2 Artifact integrity re-verification

Ngày 07/08/2026 artifact ID `8918968586` được tải lại trực tiếp từ GitHub Actions và SHA-256 được tính lại độc lập. Actual hash khớp expected hash `ece3d04f85f014bc89411c8fa852023ca67df2989e98766f82c20ce0ef6344c1`.

Điều này loại bỏ rủi ro “comment tự khai hash” hoặc artifact không còn truy xuất được: nguồn ZIP gốc đã được truy xuất thật, nội dung được kiểm và sau đó giải nén phục vụ reviewer.

### 3.3 Extracted reviewer folder — không dùng ZIP làm evidence chính

Google Drive authoritative extracted handoff:

`https://drive.google.com/drive/folders/1ejdNCeP-wdq6KWHsBJ-hBdXE2yJyfqdh`

Cấu trúc:

```text
WWHN-144_FE_Evidence_8f9ac97_2026-08-07/
├── README.md
├── WWHN-144_EVIDENCE_MANIFEST.json
├── screenshots/   # 6 PNG
├── metadata/      # 6 JSON
├── videos/        # 6 WEBM, đổi tên theo scenario
└── manifests/     # build/health/CI/Playwright/task snapshot
```

Root manifest có filename, size và SHA-256 từng file. Metadata scenario có `sourceSha`, env, build, role, viewport, timestamp, route/final URL, screenshot filename, assertions và API-scope disposition.

Từ thời điểm authoritative comment được đăng, blob image, ZIP-only handoff hoặc self-asserted closure comment cũ là `SUPERSEDED_NON_EVIDENCE` cho final review.

## 4. Equivalence audit: evidence cũ có còn đại diện cho core WWHN-144 không?

Không sử dụng run `30977711589` một cách mù quáng. Đã compare known-good SHA `8f9ac97f5ebbc9ac036d5ad732ccbbfdf615adab` với `m1` head trước closure `2b88d55922c7fc4269918ef5e35beea86297b49a`:

- Git history: head **ahead 15 commits**, **behind 0** so với known-good SHA.
- Những commit sau có thay đổi cross-task contract, CI và tài liệu.
- Tuy nhiên các critical WWHN-144 implementation/test blob dưới đây vẫn **byte-identical** với known-good PASS SHA.

| Path | Git blob SHA |
| --- | --- |
| `e2e/auth-role-navigation-qa2.spec.ts` | `bbc3944ff611e37fabef18407d5b5c840a82da12` |
| `src/app/layouts/AppHeader.tsx` | `df5435452821fca7ae17e797d039d76e3d97446f` |
| `src/app/layouts/MainLayout.tsx` | `e108a145dd75cfc32f6c0038b9517ceca045500d` |
| `src/app/layouts/SideNav.tsx` | `abc601ded66afa0ac4e4f40dba3420bdd9055735` |
| `src/app/layouts/SideNav.test.tsx` | `f49e6d83aa3836b198663f31a60b611d6599541d` |
| `src/app/layouts/layout.styles.ts` | `03c5befc143330a057a65720234f5f4dd41f6e16` |
| `src/app/layouts/menu.tsx` | `13e1baec7f420f10d21ae30297f682f532958488` |
| `src/app/router/ProtectedRoute.tsx` | `96ad7c1a0784daab081d1a3477997e31b06b6c88` |
| `src/app/router/ProtectedRoute.test.tsx` | `89a91479b3cf85d080990c618e8dab20ad3b4272` |
| `src/app/router/RequirePermission.tsx` | `2d6051ae57a9175230bbb951439698e2052b8e43` |
| `src/app/router/RequirePermission.test.tsx` | `8402a234dd71d7e159082f7e0c8c2f1472c32b6a` |
| `src/app/router/access.ts` | `308b15992d02c42d3059f4ac7e8ae67264f3f9e5` |
| `src/app/router/access.test.ts` | `389bc622face25e9d0dcb55f69c5bc973837a60c` |
| `src/app/router/index.tsx` | `838d4d3de11782430abf380a37f33d94121daef4` |

Kết luận: **không phát hiện core layout/navigation/RBAC/direct-URL regression của WWHN-144** giữa known-good PASS SHA và `m1` head đã audit.

Chi tiết machine-readable: `docs/evidence/wwhn-144/WWHN-144_CLOSURE_REGISTER.json`.

## 5. Final exact-SHA CI: phân loại đúng nguyên nhân

Run `31074312011` trên SHA `2b88d55922c7fc4269918ef5e35beea86297b49a` có conclusion `failure`, nhưng GitHub check annotation của Quality gates job `92528859961` xác nhận:

> Job không được start do account payment thất bại hoặc GitHub Actions spending limit cần tăng.

Do job **chưa start**, không có format/lint/typecheck/test/build/E2E step nào được thực thi tại run đó. Vì vậy:

- không được ghi “test fail”;
- không được coi đây là FE code regression;
- không sửa code để che một lỗi billing;
- không nới `format:check`, lint, test hoặc final aggregate;
- không dùng known-debt/whitelist để biến đỏ thành xanh.

Đây là **external GitHub Actions infrastructure blocker**. Required external action: repository/org owner khôi phục billing/spending capacity rồi rerun CI trên **exact final commit SHA**.

Known-good PASS + artifact integrity + equivalence audit chứng minh FE technical provenance hiện tại, nhưng không giả mạo một “fresh CI PASS” khi runner chưa chạy.

## 6. Thay đổi kỹ thuật và testability đã khóa

- `MainLayout` có `data-testid="desktop-navigation"` cho desktop sider.
- `AppHeader` có `data-testid="navigation-toggle"` cho responsive toggle.
- `SideNav` dùng semantic navigation và `data-testid="primary-navigation"`.
- Selector không phụ thuộc class nội bộ Ant Design.
- RBAC dựa trên permission code, không dựa trên tên role.
- Direct URL thiếu quyền chuyển `/errors/403`; anonymous protected URL chuyển `/login`.
- FE guard chỉ là UX gate; backend vẫn là security authority.
- `Prettier drift` từng làm exact-SHA gate fail trước đây đã được xử lý tại nguồn; không bypass baseline.
- Closure verifier giữ fail-closed đối với evidence contract và scope disposition.

## 7. QA2 E2E matrix

| Scenario | Role | Viewport | Expected / evidence |
| --- | --- | --- | --- |
| Anonymous direct URL `/master-data` | anonymous | 1440x900 | Redirect `/login`, protected content không render |
| RBAC menu + forbidden direct URL | inventory_viewer | 1440x900 | Menu cho phép visible; menu thiếu quyền absent; direct URL → `/errors/403` |
| Direct `/errors/403` | inventory_viewer | 1440x900 | Render no-permission state |
| Responsive desktop | super_admin | 1440x900 | Fixed sider + primary navigation |
| Responsive tablet | super_admin | 768x1024 | Drawer mở từ navigation toggle |
| Responsive mobile | super_admin | 375x812 | Drawer mở từ navigation toggle |

Automated technical result tại known-good exact-SHA: **6/6 PASS**. Formal `WWHN-145` PASS vẫn thuộc QA2 assignee, automation không tự ký thay reviewer.

## 8. Evidence contract

Artifact chuẩn: `wms-fe-closure-evidence-<SOURCE_SHA>`, retention **90 ngày**.

Nội dung tối thiểu:

- `docs/Task_docs_Jira/WWHN-144.md`;
- `docs/evidence/wwhn-144/README.md`;
- `docs/evidence/wwhn-144/WWHN-144_CLOSURE_REGISTER.json`;
- `test-results/wwhn-144/<SOURCE_SHA>/*.png`;
- `test-results/wwhn-144/<SOURCE_SHA>/*.json`;
- `test-results/playwright-results.json`;
- `playwright-report/index.html`;
- Playwright video trong `test-results/`;
- `dist/build-manifest.json` và `dist/health.json`;
- aggregate evidence manifest.

### Quy tắc authoritative evidence

1. GitHub Actions artifact là immutable CI source.
2. Reviewer-facing evidence dùng extracted Drive folder + root manifest, không dùng ZIP mơ hồ làm nguồn duy nhất.
3. Final Jira authoritative comment ghi final commit SHA, run/artifact/hash/build/env, Drive folder và external-gate state.
4. Blob/ảnh tạm/ZIP-only/self-handoff cũ: `SUPERSEDED_NON_EVIDENCE`.
5. Không tự nhận QA2 formal PASS.
6. Không chuyển parent WWHN-29 khi dependency workflow chưa thỏa.

## 9. Jira dependency và workflow guard — live audit

Live state đã kiểm tra qua Atlassian Rovo ngày 07/08/2026:

- `WWHN-144`: **IN PROGRESS REDF**;
- `WWHN-143`: **In Progress**;
- `WWHN-145`: **To Do**;
- `WWHN-29`: **In Progress**.

Quy tắc bắt buộc:

1. FE1 cung cấp final closure commit + authoritative Drive evidence.
2. QA2 review/rerun responsive/RBAC/direct URL/403 trên exact final build/SHA khi GitHub Actions runner hoạt động.
3. **Không chuyển parent WWHN-29** khi `WWHN-143` còn In Progress hoặc `WWHN-145` chưa đạt workflow approval.
4. Automation PASS là technical evidence, không thay reviewer sign-off.
5. Lead + QA chỉ move parent sau khi independent gates đóng.

## 10. One-commit / exact-SHA policy

Yêu cầu của WWHN-144 là chỉ tạo **một commit** sau khi hoàn thiện. Commit SHA của chính commit đó không thể được hard-code vào file nằm trong cùng commit mà không tạo commit thứ hai.

Do đó provenance được thiết kế đúng cách:

- repo lưu immutable known-good SHA, artifact hash, equivalence blob hashes và closure register;
- final closure commit SHA được lấy từ `m1` HEAD sau khi commit được tạo và ghi vào **một authoritative Jira comment**;
- CI khi runner hoạt động dùng `SOURCE_SHA` để ghi exact-SHA tự động vào build/runtime manifest và artifact.

Cách này tránh vòng lặp “commit lần hai chỉ để chèn SHA của commit lần một”.

## 11. Lệnh kiểm tra bắt buộc

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run wwhn-144:verify
npm run build
npm run health:check
npm run check:api-mapping
npm run test:e2e:wwhn-144
```

GitHub Actions là nguồn evidence chuẩn cho exact SHA. Local run chỉ dùng để debug, không thay thế CI evidence.

## 12. Definition of Done / closure register

### FE-owned technical closure

- [x] Không có P0 code blocker riêng FE layout/navigation/shared component.
- [x] Exact viewport `1440x900`, `768x1024`, `375x812` được mã hóa và có evidence.
- [x] RBAC menu, anonymous/authenticated direct URL và `/errors/403` có assertion thực.
- [x] Core WWHN-144 implementation blobs được audit equivalence với known-good PASS SHA.
- [x] Known-good artifact được tải lại và SHA-256 verify độc lập: **MATCH**.
- [x] Evidence đã giải nén lên Drive, có filename/env/build/role/viewport/timestamp/SHA và manifest.
- [x] Blob/ZIP-only/self-handoff cũ được disposition `SUPERSEDED_NON_EVIDENCE`.
- [x] API scope disposition rõ: UX frame, không phải BE authorization/API denial sign-off.
- [x] Không nới CI gate để che billing/infrastructure failure.
- [x] Closure register machine-readable được thêm vào repo.

### Independent / external gates — không được FE tự ký

- [ ] GitHub Actions rerun PASS trên final exact-SHA sau khi org khôi phục billing/spending capacity.
- [ ] QA2 xác nhận `WWHN-145` trên exact final SHA/artifact.
- [ ] BAS hoàn tất `WWHN-143`.
- [ ] Lead + QA xác nhận parent `WWHN-29` đủ điều kiện chuyển trạng thái.

## 13. Final disposition

**FE technical scope: READY FOR REVIEW.**

Không còn P0/P1/P2 **FE-owned** chưa có disposition trong phạm vi layout/navigation/shared component. Hai loại gate còn mở không được che giấu:

1. GitHub Actions runner không start do billing/spending limit của repo/org;
2. independent QA2/BAS/parent workflow chưa hoàn tất.

Vì vậy tài liệu này không tuyên bố giả `100% Done` cho toàn bộ parent/QA workflow. Nó đóng đầy đủ phần FE có thể kiểm soát và cung cấp evidence đủ sâu để reviewer phân biệt rõ **FE defect** với **external approval/infrastructure gate**.

## 14. Traceability

- Parent: `WWHN-29`;
- FE implementation/evidence: `WWHN-144`;
- QA2 responsive/RBAC smoke: `WWHN-145`;
- BAS dependency: `WWHN-143`;
- Branch duy nhất: `m1`;
- Known-good PASS SHA: `8f9ac97f5ebbc9ac036d5ad732ccbbfdf615adab`;
- Known-good CI run: `30977711589`;
- Drive extracted evidence: `https://drive.google.com/drive/folders/1ejdNCeP-wdq6KWHsBJ-hBdXE2yJyfqdh`;
- Closure register: `docs/evidence/wwhn-144/WWHN-144_CLOSURE_REGISTER.json`;
- Commit policy: **một commit tiếng Việt sau khi hoàn thiện toàn bộ thay đổi**.
