# WWHN-274 — FE release sign-off / build-config-smoke UI

## Scope

- Jira: WWHN-274 — `[FE1] Kiểm tra build/cấu hình/smoke UI`.
- Parent: WWHN-72 / HN-DEVOPS-003.
- Branch: `m1` only.
- Output: `Frontend release sign-off`.
- This file is the source-controlled evidence index for FE-owned release readiness. It does **not** replace independent QA1 release smoke (WWHN-275) or DevOps deploy/backup/rollback evidence (WWHN-272).

## Baseline reviewed

1. `docs/HN_SRS_FRD_v1.12_FULL.md`
2. `docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html`
3. `docs/HoaNam_ERD_Moi_Nhat.md`
4. `docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md`

Canonical FE contract assumptions used by this gate:

- React/Vite/TypeScript SPA; API-first integration.
- API base is `/api/v1`; browser credentials are enabled for the HttpOnly refresh-cookie session bridge.
- Access-token/RBAC rendering is permission-code based; FE guards are UX controls only. Backend remains the authorization/security boundary.
- Shared UI must expose explicit loading, empty, error/no-permission, API field-error, disabled and confirm states where applicable.
- Required responsive evidence viewports: `1440x900`, `768x1024`, `375x812`.
- Packing Label is stock-neutral until Complete/Post Issue; only Post Issue decrements inventory.
- Stocktake/variance/generic adjustment are outside the current MVP baseline. A parent/release checklist that still names stocktake requires governance disposition and must not cause FE to invent an out-of-scope screen/API.

## WWHN-274 AC / DoD evidence map

| Gate         | Source-controlled evidence                                       | Expected result                                                                   |
| ------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Build/config | `.github/workflows/wwhn-274-fe-release-signoff.yml`              | format/lint/typecheck/unit/env/API-map/build/health PASS on exact SHA             |
| UI states    | `e2e/wwhn-274-release-signoff.spec.ts`                           | loading/empty/error/no-permission/API error/disabled/confirm rendered             |
| Responsive   | same E2E                                                         | 1440x900, 768x1024, 375x812; no horizontal overflow on login shell                |
| RBAC         | same E2E                                                         | menu hides unauthorized entry; direct protected URL fails closed to `/errors/403` |
| API error    | same E2E                                                         | controlled 422 remains visible and retry action remains enabled                   |
| Traceability | `scripts/verify-wwhn-274-closure.mjs`                            | required docs/files/contracts present; truth-boundary assertions present          |
| Exact SHA    | workflow-generated `release-signoff.json` + screenshots/metadata | SHA/env/build/browser/role/viewport/timestamp captured                            |

## P0/P1/P2 remediation register

> This register is a technical classification derived from WWHN-274 AC/DoD + current repository state. Jira WWHN-274 itself did not contain a newer P0/P1/P2 scoring comment at the time this gate was created; therefore these severities must not be presented as a quoted reviewer score.

| ID         | Sev | Finding                                                                                                                                                                                                                                        | Root fix / disposition                                                                                                                                                                                                                                | Owner      |
| ---------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| W274-P0-01 | P0  | Release smoke must not validate a non-canonical backend health URL.                                                                                                                                                                            | Backend release gate must use `/api/v1/health`; FE keeps `/api/v1` as canonical API prefix.                                                                                                                                                           | BE/DevOps  |
| W274-P1-01 | P1  | WWHN-274 had no task-owned exact-SHA FE closure/evidence gate.                                                                                                                                                                                 | Added dedicated verifier, Playwright evidence and workflow on `m1`.                                                                                                                                                                                   | FE1        |
| W274-P1-02 | P1  | Parent WWHN-72 still mentions stocktake smoke although current SRS/ERD exclude Stocktake from MVP.                                                                                                                                             | Fail closed against current baseline: do not implement/hard-code stocktake; PM/PO/QA must disposition stale parent wording.                                                                                                                           | PM/PO + QA |
| W274-P1-03 | P1  | Independent deploy/rollback and release smoke remain external to FE-owned source evidence.                                                                                                                                                     | WWHN-272 and WWHN-275 must attach their own exact build/environment evidence before parent release closure.                                                                                                                                           | DO + QA1   |
| W274-P2-01 | P2  | Without machine checks, future changes can silently drop required evidence metadata or viewport/RBAC coverage.                                                                                                                                 | `verify-wwhn-274-closure.mjs` checks evidence contract on every relevant `m1` change.                                                                                                                                                                 | FE1        |
| W274-P0-02 | P0  | The WWHN-274 workflow installed with `npm ci` and `cache: npm`, but this repository ships `yarn.lock` and no `package-lock.json`. The gate could never install, so every "exact-SHA PASS" claim was unbacked.                                  | Switched install to `yarn install --frozen-lockfile --non-interactive` with `cache: yarn` + `cache-dependency-path: yarn.lock`, matching `ci.yml` / `wwhn-292` / `wwhn-211`. Verifier now rejects `npm ci` and `cache: npm` and requires `yarn.lock`. | FE1        |
| W274-P0-03 | P0  | `e2e/tsconfig.tsbuildinfo` (TypeScript incremental cache) was version-controlled and held a stale entry for a deleted spec `e2e/zz-probe-tmp.spec.ts`, so `tsc -b` — and therefore `npm run build` — failed with TS6053 on any clean checkout. | Untracked the cache, added `*.tsbuildinfo` to `.gitignore`, and the verifier now asserts that ignore rule so the cache can never be re-committed.                                                                                                     | FE1        |
| W274-P2-02 | P2  | The verifier matched `.env.example` as raw text (`VITE_API_HEALTH_PATH=/health`), so a compliant quoted value (`"/health"`) produced a false FAIL and any future quoting change would break the gate again.                                    | Verifier now parses env into key/value pairs (same parser shape as `verify-env-health-contract.mjs`) and asserts values, plus asserts `VITE_API_BASE_URL` ends at `/api/v1`.                                                                          | FE1        |
| W274-P2-03 | P2  | The workflow invoked evidence files by raw path, so renaming a spec/verifier would silently change what the gate ran.                                                                                                                          | Workflow now calls `npm run wwhn-274:verify` and `npm run test:e2e:wwhn-274`; the verifier asserts both package scripts exist and resolve to the real evidence files.                                                                                 | FE1        |

## Local pre-flight verification (2026-08-18)

Run on the working tree of `m1` before the exact-SHA CI run, to prove the gate is
actually green rather than merely declared green:

| Gate                        | Result                                                             |
| --------------------------- | ------------------------------------------------------------------ |
| `npm run wwhn-274:verify`   | PASS                                                               |
| `npm run format:check`      | PASS                                                               |
| `npm run lint`              | PASS                                                               |
| `npm run typecheck`         | PASS                                                               |
| `npm run test`              | PASS                                                               |
| `npm run env:verify`        | PASS                                                               |
| `npm run check:api-mapping` | PASS                                                               |
| `npm run build`             | PASS (failed TS6053 before W274-P0-03 was fixed)                   |
| `npm run health:check`      | PASS                                                               |
| `npm run test:e2e:wwhn-274` | 6/6 PASS (3 viewports, shared UI states, RBAC 403, controlled 422) |

Scope of this table: it is a **local pre-flight** signal only. It does not replace
the workflow run bound to a pushed `m1` SHA, and no closure claim may quote it as
exact-SHA evidence.

## Truth boundary / anti-false-PASS rules

- Evidence class is `FE_CONTROLLED_NOT_QA_UAT`. "**FE-controlled**" describes the _kind_ of proof (deterministic, source-driven, produced from an exact `m1` SHA under mocked API routes); "FE-owned" describes _who is accountable_. The two must not be used interchangeably when claiming closure.
- Controlled mocked API evidence proves deterministic **FE behavior only**.
- It is not proof of backend 403/data-scope enforcement, real database state, UAT deployment, backup/restore, or independent QA execution.
- FE may sign off WWHN-274 when its exact-SHA workflow passes and there is no unresolved FE-owned P0/P1.
- WWHN-72 may not be declared release-complete from this artifact alone while WWHN-272/WWHN-275 or other release-owned gates remain open.
- Do not reuse screenshots or PASS statements from a different commit SHA as closure evidence.

## Reviewer checklist

- [ ] Exact FE `m1` SHA recorded.
- [ ] WWHN-274 workflow PASS on that SHA.
- [ ] Responsive screenshots/metadata exist for all three required viewports.
- [ ] Shared UI state evidence exists.
- [ ] Permission menu + direct URL `/errors/403` evidence exists.
- [ ] API 422/retry-safe evidence exists.
- [ ] No endpoint/payload hard-code conflicts with the approved `/api/v1` contract.
- [ ] External WWHN-272/WWHN-275 evidence is not falsely claimed as FE-owned evidence.

---

# Vòng 2 — register FE274-\* (đánh giá 76/100, 2026-08-19)

Vòng 1 chỉ chứng minh **gate tồn tại**. Reviewer bác bỏ vì ba lý do có thật:
không truy xuất được run/artifact theo đúng candidate SHA; toàn bộ E2E chạy trên
API mock nên không chứng minh được FE↔BE thật; và không có bằng chứng bàn
phím/a11y/ma trận trình duyệt. Phần dưới đây đóng đúng từng nguyên nhân đó.

## Nguồn review canonical (FE274-P2-01)

| Mục           | Giá trị                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| Repository    | `https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`                                           |
| Nhánh         | `m1` (task này không mở nhánh riêng)                                                                   |
| Candidate SHA | commit cuối chạm artifact WWHN-274 — pin ở mục “Bằng chứng tại exact SHA” bên dưới                     |
| Workflow      | `.github/workflows/wwhn-274-fe-release-signoff.yml`, chạy lại được bằng `workflow_dispatch.source_sha` |
| Runner cục bộ | `npm run wwhn-274:exact-sha` → `docs/evidence/WWHN-274/generated/<sha>/gate-results.json`              |

Mọi URL review phải trỏ đúng repo/nhánh trên. Nhánh `m1ee` trong link review cũ
không tồn tại; verifier từ chối mọi URL của repo này trỏ về nhánh đó.

## Register FE274-\*

| ID          | Sev | Khoảng trống chính xác                                                                                        | Cách đóng tận gốc                                                                                                                                                                                              | Trạng thái                                                              |
| ----------- | --- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| FE274-P1-01 | P1  | Không có run/artifact PASS truy xuất được theo đúng candidate SHA; bảng PASS gõ tay không gắn với commit nào. | Workflow nhận `inputs.source_sha` và **fail** nếu checkout khác SHA yêu cầu; thêm `scripts/run-wwhn-274-exact-sha-evidence.mjs` chạy đúng chuỗi gate của workflow rồi ghi manifest gắn SHA + trạng thái cây.   | FE-owned — ĐÓNG (evidence bên dưới)                                     |
| FE274-P1-02 | P1  | Jira WWHN-274 chưa có handoff comment nêu SHA/workflow/evidence/known gaps.                                   | Comment handoff theo vai trò FE1, nêu SHA, workflow, đường dẫn evidence và phần còn mở thuộc vai trò khác.                                                                                                     | Cần **comment xác nhận** (không phát sinh code)                         |
| FE274-P1-03 | P1  | WWHN-275 (QA1 release smoke độc lập) vẫn Blocked/Pending.                                                     | Không FE-owned. FE chỉ chịu trách nhiệm không tuyên bố artifact của mình là bằng chứng QA; ranh giới này được khoá bằng verifier + manifest.                                                                   | Ngoài phạm vi FE1 — chờ QA1 xác nhận                                    |
| FE274-P1-04 | P1  | HN-DEVOPS-003-ST01 / WWHN-272 chưa có bằng chứng build/env đã deploy.                                         | Không FE-owned. Workflow nhận `vars.WWHN_274_REAL_BASE_URL` + `vars.WWHN_274_REAL_API_BASE_URL` để chạy smoke ngay trên build DevOps đã deploy khi env sẵn sàng.                                               | Ngoài phạm vi FE1 — chờ DevOps xác nhận                                 |
| FE274-P1-05 | P1  | Parent WWHN-72 còn yêu cầu smoke Stocktake trong khi baseline hiện hành loại trừ.                             | Neo vào **REQ-SRS-037 / DEC-NO-STOCKTAKE-001** (SRS v1.12) và wireframe v3.20 (không có màn kiểm kê): FE fail-closed, không tự tạo màn/API ngoài phạm vi.                                                      | Ngoài phạm vi FE1 — chờ PM/PO chốt wording parent                       |
| FE274-P1-06 | P1  | E2E chỉ chạy trên API mock ⇒ chưa chứng minh FE↔BE thật.                                                      | Thêm `e2e/wwhn-274-real-env-smoke.spec.ts` **cấm mock**: health canonical, `/api/health` legacy = 404, 401 fail-closed khi không phiên, bootstrap `/auth/refresh` thật, đăng nhập sai thật, phiên sống qua F5. | FE-owned — ĐÓNG về mặt bộ kiểm; **chạy trên Beta cần env của WWHN-272** |
| FE274-P2-01 | P2  | URL review trỏ nhánh sai canonical.                                                                           | Pin repo + `m1` + candidate SHA ở bảng trên; verifier chặn URL `m1ee` quay lại tài liệu.                                                                                                                       | ĐÓNG                                                                    |
| FE274-P2-02 | P2  | Không có commit/PR trace gắn WWHN-274; commit gần nhất chỉ là “gỡ cờ”.                                        | Mục “Commit trace” bên dưới ghi rõ commit nào chạm artifact nào; manifest exact-SHA ghi luôn `commitSubject` + `committedAt`.                                                                                  | ĐÓNG                                                                    |
| FE274-P2-03 | P2  | Bằng chứng bàn phím/a11y/ma trận trình duyệt còn hạn chế.                                                     | Thêm `e2e/wwhn-274-a11y-browser-matrix.spec.ts` chạy trên 3 engine + 3 breakpoint biên của **NFR-SRS-006**; kiểm landmark/heading/label, focus nhìn thấy được, Enter submit, không tràn ngang.                 | ĐÓNG (mức emulation, xem ranh giới)                                     |

## Ma trận trình duyệt/thiết bị theo NFR-SRS-006

| Project Playwright          | Đại diện cho                     | Breakpoint kiểm                            |
| --------------------------- | -------------------------------- | ------------------------------------------ |
| `wwhn-274-desktop-chromium` | Chrome/Edge desktop (Blink)      | 1280×800 (biên desktop), 768×1024, 360×640 |
| `wwhn-274-chrome-android`   | Chrome Android (Chromium mobile) | 1280×800, 768×1024, 360×640 (biên mobile)  |
| `wwhn-274-safari-ios`       | Safari iOS (WebKit)              | 1280×800, 768×1024, 360×640                |

Ranh giới: đây là bằng chứng **engine-level bằng emulation**, không phải ma trận
thiết bị thật. Ma trận thiết bị thật thuộc QA1 (WWHN-275).

## Ranh giới của real-env smoke (FE274-P1-06)

- `e2e/wwhn-274-real-env-smoke.spec.ts` **không được** chứa `page.route(` /
  `route.fulfill(`; verifier chặn ở tầng nguồn để bộ kiểm này không âm thầm biến
  thành mock.
- Thiếu `WWHN_274_REAL_BASE_URL` / `WWHN_274_REAL_API_BASE_URL` khi
  `WWHN_274_REQUIRE_REAL_ENV=1` là **FAIL**, không phải skip: một lần skip im lặng
  là một lần PASS giả cho release sign-off.
- Luồng đã đăng nhập chỉ chạy khi có `WWHN_274_REAL_USER` / `WWHN_274_REAL_PASSWORD`
  (secrets). Không có credential thì manifest ghi `NOT_EXECUTED`, và bằng chứng
  mock **không được** dùng thay.

## Nơi lưu evidence

Evidence ghi vào `docs/evidence/WWHN-274/generated/<sha>/{controlled,a11y,real-env}`.
Trước vòng này evidence ghi vào `test-results/`, nhưng Playwright **dọn sạch
`outputDir` ở đầu mỗi lệnh `playwright test`**, nên bước E2E sau xoá bằng chứng của
bước trước — artifact “exact-SHA” chỉ còn lần chạy cuối cùng; `test-results/` cũng
nằm trong `.gitignore` nên không pin theo SHA được.

## Bằng chứng tại exact SHA

<!-- WWHN-274-EXACT-SHA-EVIDENCE -->

Bảng này được điền bằng `npm run wwhn-274:exact-sha` chạy trên cây **sạch**; nếu cây
bẩn, manifest ghi `INVALID_FOR_CLOSURE_DIRTY_TREE` và không được dùng để đóng task.

Bằng chứng đã chạy: `docs/evidence/WWHN-274/generated/1d4761c2161bc13621a4c3d4fa2ff60504839eb3/`
(manifest `gate-results.json`, log từng gate, metadata E2E). Cây làm việc **sạch**
(`treeState: clean`), E2E đo trên `http://127.0.0.1:4271` — chính là build `vite preview`
của SHA này, không phải một dev server nào khác.

| Gate                     | Kết quả | Ghi chú                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wwhn-274:verify`        | PASS    | hợp đồng nguồn của task                                                                                                                                                                                                                                                                                               |
| `format:check`           | PASS    | sau khi dọn 17 file drift thuộc các task khác (commit `1d4761c`)                                                                                                                                                                                                                                                      |
| `lint`                   | PASS    | 25 cảnh báo, 0 lỗi                                                                                                                                                                                                                                                                                                    |
| `typecheck`              | PASS    |                                                                                                                                                                                                                                                                                                                       |
| `test` (unit)            | FAIL    | 677/679; 2 test đỏ là `wwhn-233-count-deferral-gate` và `wwhn-260-migration-operational-only`, cùng một nguyên nhân: digest của wireframe baseline lệch do **line ending** khi checkout ở worktree phụ. Cả hai PASS trên cây làm việc chính và **không** thuộc artifact WWHN-274 — chủ sở hữu là WWHN-233 / WWHN-260. |
| `env:verify`             | PASS    |                                                                                                                                                                                                                                                                                                                       |
| `check:api-mapping`      | PASS    |                                                                                                                                                                                                                                                                                                                       |
| `build`                  | PASS    |                                                                                                                                                                                                                                                                                                                       |
| `health:check`           | PASS    |                                                                                                                                                                                                                                                                                                                       |
| `test:e2e:wwhn-274`      | PASS    | 6/6 — 3 viewport, 7 trạng thái UI, RBAC 403, API 422 retry-safe                                                                                                                                                                                                                                                       |
| `test:e2e:wwhn-274:a11y` | PASS    | 7 passed / 2 skipped (bàn phím chỉ áp dụng desktop) trên Chromium desktop, Chrome Android, WebKit iOS                                                                                                                                                                                                                 |

### Real-env FE↔BE smoke (FE274-P1-06) — đã chạy thật

`npm run test:e2e:wwhn-274:real-env` với `WWHN_274_REQUIRE_REAL_ENV=1` và
`WWHN_274_REQUIRE_AUTHENTICATED=1`: **5/5 PASS** trên build đã deploy
(`vite preview`) nói chuyện với backend Laravel thật (`/api/v1`, DB PostgreSQL
riêng đã migrate + seed):

| Kịch bản                                        | Kết quả đo được                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `backend-health-canonical`                      | `GET /api/v1/health` = 200, `checks.database/migrations/seed = ok`; `GET /api/health` = 404           |
| `protected-api-401-fail-closed`                 | `GET /api/v1/skus` không phiên = 401, envelope `success=false`                                        |
| `deployed-fe-guard-and-bootstrap`               | `/dashboard` chưa đăng nhập → `/login`, bootstrap gọi thật `/auth/refresh`                            |
| `real-login-rejection-retry-safe`               | đăng nhập sai → 401/422 thật, vẫn ở `/login`, nút submit còn bấm lại được                             |
| `authenticated-session-and-representative-read` | đăng nhập thật 200 → `/auth/me` 200 → F5 giữ phiên qua HttpOnly refresh cookie → có GET nghiệp vụ 200 |

Ranh giới: đây là môi trường **local có kiểm soát**, không phải Beta. Chạy lại đúng
bộ này trên Beta cần `WWHN_274_REAL_BASE_URL` / `WWHN_274_REAL_API_BASE_URL` (và
credential) do DevOps cung cấp — tức là phụ thuộc WWHN-272; kết quả trên Beta vẫn
không thay thế release smoke độc lập của QA1 (WWHN-275).

## Commit trace (FE274-P2-02)

<!-- WWHN-274-COMMIT-TRACE -->

| Commit    | Chạm gì                                                                                                                                                                                                                                 | Đóng ID                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `76f2efd` | `e2e/wwhn-274-real-env-smoke.spec.ts`, `e2e/wwhn-274-a11y-browser-matrix.spec.ts`, `scripts/run-wwhn-274-exact-sha-evidence.mjs`, `scripts/verify-wwhn-274-closure.mjs`, `playwright.config.ts`, `package.json`, workflow, tài liệu này | FE274-P1-01, P1-06, P2-01, P2-02, P2-03 |
| `ffbff16` | workflow: checkout đủ lịch sử + tự resolve `inputs.source_sha`; verifier khoá lại                                                                                                                                                       | FE274-P1-01 (chạy lại theo SHA)         |
| `4a17bff` | runner tự dựng `vite preview` cho build của chính SHA, manifest ghi `e2eTargetBaseUrl`                                                                                                                                                  | FE274-P1-01 (evidence đo đúng build)    |

Nhánh `m1` có nhiều phiên làm việc song song trên cùng cây làm việc; ba commit trên
chỉ chứa artifact của WWHN-274 (đã tách phần của task khác ra khỏi index trước khi commit).

## Trạng thái GitHub Actions tại thời điểm đóng vòng 2

Workflow `wwhn-274-fe-release-signoff.yml` đã chạy lại được theo SHA, nhưng **mọi
job Actions của repository hiện không khởi động được**:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

Điều này áp cho toàn bộ workflow của repo (`CI`, `WWHN-233`, `WWHN-274` — các run
`32206985014`, `32206985042`, `32207008464`), không phải lỗi riêng của gate này. Vì
vậy “run ID + job PASS + artifact” của FE274-P1-01 **chỉ có thể tạo sau khi tài
khoản GitHub được mở lại**; cho tới lúc đó bằng chứng hợp lệ duy nhất là manifest
exact-SHA chạy trên cây làm việc **sạch** (`npm run wwhn-274:exact-sha`), và nó
phải được trình bày đúng như vậy, không được gọi là bằng chứng CI.

---

# Vòng 3 — đánh giá 84/100, PASS có điều kiện (2026-08-19)

Review R3 cập nhật trạng thái register và chỉ còn **một khoảng trống FE-owned**:
FE274-P1-02/P2-02 — chưa có structured handoff trên Jira và chưa pin candidate SHA
chính thức cho reviewer. Vòng này đóng đúng khoảng trống đó, không phát sinh thay
đổi nào vào code sản phẩm hay GitHub Actions (quota Actions đã cạn — mọi bằng chứng
vòng này là local, chỉ **đọc** file workflow để hash).

## Trạng thái register theo R3

| ID          | Status R3                    | Việc còn lại & chủ sở hữu                                                                                                 |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| FE274-P1-01 | DEFERRED / NOT ASSESSED      | CI/CD run/artifact gate — theo yêu cầu R3 không đánh giá, không chặn vòng này. Không tạo run mới khi quota Actions cạn.   |
| FE274-P1-02 | **ĐÓNG vòng này (FE-owned)** | Pin candidate chính thức HN-PIN-274 (bên dưới) + structured handoff comment trên Jira theo vai trò FE1.                   |
| FE274-P1-03 | OPEN — cross-role hard gate  | WWHN-275: QA1 release smoke độc lập. Ngoài phạm vi FE1.                                                                   |
| FE274-P1-04 | OPEN — external              | WWHN-272: DevOps bàn giao deployed Beta environment/build. Ngoài phạm vi FE1.                                             |
| FE274-P1-05 | CLOSED FOR FE                | BA đã chốt Stocktake ngoài FE MVP (REQ-SRS-037, SRS v1.12); FE fail-closed đúng. Wording parent WWHN-72 do PM/PO cleanup. |
| FE274-P1-06 | PARTIAL+                     | Suite real FE↔BE no-mock đã tồn tại, local 5/5 PASS. Beta execution + independent QA chờ WWHN-272/275.                    |
| FE274-P2-01 | CLOSED                       | Canonical là `m1`; `m1ee` sai — verifier chặn.                                                                            |
| FE274-P2-02 | **ĐÓNG vòng này (FE-owned)** | Commit trace đã có; exact candidate nay được surface trong pin + handoff comment.                                         |
| FE274-P2-03 | CLOSED FE-SCOPE              | a11y/keyboard + browser-engine matrix đã có (emulation); real-device thuộc QA1.                                           |

## Pin candidate chính thức — HN-PIN-274 (đóng FE274-P1-02/P2-02)

| Mục               | Giá trị                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| **Candidate SHA** | `1481ee9df7a14aa05bf2840fc934939a43447127` — commit cuối chạm tập artifact sở hữu WWHN-274 trên `m1`   |
| Evidence SHA      | `1d4761c2161bc13621a4c3d4fa2ff60504839eb3` — SHA sinh manifest exact-SHA + real-env 5/5                |
| Pin nội dung      | `docs/evidence/WWHN-274/RC_PIN.json` (8 artifact: 6 hash cả tệp, 2 pin mức đối tượng bằng extractor)   |
| Verifier          | `node scripts/verify-wwhn-274-candidate-pin.mjs` (thêm `--expect-sha=<sha>` ở cổng deploy) — PASS 8/8  |
| Mô hình           | HN-PIN-222/328/184: file dùng chung (package.json, playwright.config.ts) pin đối tượng để không đỏ giả |

Bất biến được verifier kiểm **tự động** (chống pin rot trên nhánh nhiều phiên):

1. **Bất biến dải commit:** toàn bộ `git log -- <owned paths>` phải là tập con của
   `implementation_range` (11 commit đã review) và phần tử mới nhất phải đúng bằng
   candidate SHA — commit lạ chạm artifact hoặc candidate bị vượt qua ⇒ pin đỏ.
2. **Đồng nhất nội dung evidence↔candidate:** các artifact sinh evidence tại
   `1d4761c` phải identical với nội dung tại candidate `1481ee9` (bằng chứng hợp lệ
   theo nội dung, không theo HEAD). Riêng `wwhn-274-real-env-smoke.spec.ts` được
   khai ranh giới tường minh trong `boundary_notes`: 5/5 real-env chạy từ working
   tree với đúng nội dung được commit tại candidate.
3. **Manifest fail-closed:** `gate-results.json` phải tồn tại, đúng `sourceSha`,
   `treeState=clean`; 5 file real-env + `release-signoff.json` phải tồn tại.

Ghi chú trung thực (đã khai trong pin, không giấu): `gate-results.json` có
`overallResult=FAIL` do **duy nhất** gate unit 677/679 — 2 test đỏ thuộc
WWHN-233/WWHN-260 (digest wireframe lệch line-ending ở worktree phụ), không thuộc
artifact WWHN-274; reviewer R3 đã chấp nhận trình bày này.

## Nội dung handoff cho reviewer (nguồn của Jira comment FE1)

- Repo `Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE`, nhánh `m1`, candidate
  `1481ee9df7a14aa05bf2840fc934939a43447127`.
- Evidence: `docs/evidence/WWHN-274/generated/1d4761c…/` (manifest, log từng gate,
  metadata E2E controlled/a11y, real-env 5/5).
- Chạy lại: `npm run wwhn-274:exact-sha` (cây sạch) + `node scripts/verify-wwhn-274-candidate-pin.mjs --expect-sha=<sha>`.
- Known gaps ngoài FE1: FE274-P1-03 (WWHN-275/QA1), FE274-P1-04 (WWHN-272/DevOps),
  FE274-P1-06 phần Beta, FE274-P1-01 (deferred — CI quota).
