# Luồng 04 · Bảo hành & linh kiện — Evidence hoàn thiện WWHN-63 (BE) / WWHN-64 (FE)

Ngày lập: 2026-08-13. Tài liệu này tổng hợp evidence đóng các P1 còn lại sau
đợt review module 04 (chấm 89% có điều kiện) để đưa module lên trạng thái
sẵn sàng sign-off.

## Baseline

| Repo | Branch | Base SHA lúc review | Nội dung bổ sung trong đợt này |
| ---- | ------ | ------------------- | ------------------------------ |
| BE `Hoa_Nam_Backend` | m1 | `df9090ac0153` | Pint clean, idempotency POST/PATCH warranty, test contract mới |
| FE `Hoa_Nam_Tools` | m1 | `7c6c0124a5a9` | Verifier contract mới, live E2E runtime suite |

> SHA commit mới của từng repo: xem `git log` tại thời điểm đính kèm comment
> Jira (commit tiếp sau các SHA trên).

## P1-01 — BE CI static gate (Pint): CLOSED

- `./vendor/bin/pint` đã format 5 file lệch chuẩn:
  `ReportController.php`, `WarrantyDemoSeeder.php`, `Modules/Warehouse/routes/api.php`,
  `scripts/normalize_app_user_emails.php`, `scripts/reset_app_user_passwords.php`.
- Xác nhận lại: `./vendor/bin/pint --test app Modules tests config database routes scripts`
  → `{"tool":"pint","result":"passed"}`.
- Full suite BE sau sửa: `php artisan test` → **238 passed / 16 skipped / 0 failed**
  (3613 assertions).

## P1-02 — FE WMS contract verifier: CLOSED

`scripts/verify-wms-contract-signoff.mjs` được cập nhật đúng bản chất governance:

- Bỏ ràng buộc cứng `criticalFlows.length === 6`; thay bằng: **6 flow nền tảng
  v1.7 bắt buộc tồn tại với path chính xác**, flow mở rộng (Warranty/Component
  Issue, 22 flow tổng) được phép nếu khai báo id + relativePath hợp lệ, cấm
  trùng id.
- Cập nhật theo hiện trạng source: receivingService là shim re-export sang
  inboundService (verifier khóa cả shim lẫn service active); payload scan chấp
  nhận `qty`/`quantity` (khớp BE `required_without` hai chiều); check warranty
  chuyển từ "fail-closed chưa có contract" sang guard thật
  (assertWmsActionPermission + If-Match + Idempotency-Key + movement guard).
- Kết quả: `npm run wms-contract:verify` → PASS; các gate còn lại của workflow
  WWHN-153 (`wwhn-153:self-test`, `wwhn-153:verify`, `wwhn-153:runtime
  --contract-only`, vitest policy test) đều PASS local.

## P2 — Idempotency-Key cho Warranty mutation (BE): CLOSED

`CurrentBaselineWarrantyController` giờ xử lý idempotency đúng như Component
Issue Post, khớp FE contract baseline (WARRANTY_INTAKE / WARRANTY_UPDATE khai
báo `Idempotency-Key` là required header):

- `POST /warranty-cases` và `PATCH /warranty-cases/{id}`:
  `IdempotencyKeyGuard::require` (428 khi thiếu, 422 khi sai độ dài 8–100)
  + `IdempotencyStore::handle` (replay cùng key trả snapshot đã commit, header
  `Idempotent-Replay: true`, không tạo event/version mới; cùng key khác payload
  → 409).
- Version check (412) chỉ chạy ở lần thực thi đầu nên FE retry sau thành công
  không bị 412 giả.
- Test mới trong `WarrantyIdempotencyKeyContractTest`:
  - `test_warranty_intake_requires_key_and_replays_snapshot_without_duplicate_case`
  - `test_warranty_update_requires_key_and_replay_does_not_double_apply`
- `WarrantyReadinessTest` bổ sung case 428 thiếu Idempotency-Key riêng, tách
  khỏi 428 thiếu If-Match.

## P1-03 — Live E2E runtime (không mock): CLOSED

File mới `e2e/warranty-flow04-live-runtime.spec.ts` (+ npm script
`test:e2e:warranty-live`). Suite **không đăng ký bất kỳ `page.route()` nào**;
browser FE nói chuyện HTTP thật với BE + PostgreSQL:

1. UI login thật (form → `POST /auth/login`).
2. UI WAR-01 list thật; WAR-02 intake TEMP_ONLY qua modal → `POST
   /warranty-cases` 201 với header `Idempotency-Key` thật; case code hiển thị.
3. `PATCH /warranty-cases/{id}` → CHECKING (If-Match + Idempotency-Key), replay
   cùng key → `Idempotent-Replay: true`, version giữ nguyên, không double event.
4. Attachment upload/list/download/delete thật (multipart, checksum, 404 sau
   logical delete).
5. COMP-01: tự discovery container BOX còn tồn COMPONENT qua API thật
   (hoặc `E2E_LIVE_COMPONENT_SKU_ID`/`E2E_LIVE_CONTAINER_ID`), tạo phiếu DRAFT
   stock-neutral → scan (version CAS) → **post trừ tồn thật** (movement_ids,
   subledger container giảm đúng 1) → replay post không trừ tồn lần hai.
6. Kiểm `warranty_event` taxonomy (RECEIVE/CHECK) qua API thật.

Cách chạy trên UAT/local:

```bash
# BE: php artisan serve --port=8080 (hoặc UAT base URL), DB đã seed WarrantyDemoSeeder
E2E_LIVE_RUNTIME=1 \
E2E_LIVE_USERNAME=<email> \
E2E_LIVE_PASSWORD=<password> \
E2E_LIVE_API_BASE_URL=<base>/api/v1 \
npm run test:e2e:warranty-live
```

Khi thiếu env, suite tự skip nên CI hiện tại không bị ảnh hưởng.

**Kết quả chạy thật (2026-08-13, local):** `1 passed (15.1s)` với FE dev
(127.0.0.1:5173) → BE `php artisan serve` (127.0.0.1:8080) → PostgreSQL
`wms_hoanam`, dữ liệu WarrantyDemoSeeder, user seed `admin@gmail.com`.
Toàn chuỗi login UI → intake TEMP_ONLY UI (201 + Idempotency-Key) → PATCH
CHECKING → replay (`Idempotent-Replay: true`, version giữ 2, không double
event) → attachment upload/list/download/delete → component issue create
(DRAFT stock-neutral) → scan (BOX container, version CAS) → post
(`movement_ids` non-empty, subledger container giảm đúng 1) → replay post
(không trừ tồn lần hai) → detail POSTED. Không có `page.route()` nào.

## Ghi chú kỹ thuật phát hiện khi chạy live

- FE giữ access/refresh token in-memory: full page reload sẽ mất session.
  Suite điều hướng client-side qua menu (đúng hành vi người dùng).
- `POST /auth/login` BE yêu cầu field `email` đúng định dạng email.
- LoginPage dùng FormInput custom (label không gắn `htmlFor`) — selector theo
  placeholder; các modal warranty dùng antd `Form.Item` chuẩn nên `getByLabel`
  hoạt động.

## P1-04 — Jira: nội dung comment đề xuất

### WWHN-63 (Warranty BE/API) — chuyển In Progress → sẵn sàng review/QA

> Đã đóng toàn bộ P0/P1 code-level của luồng 04 trên m1:
> - `GET /component-issue-documents/{id}` + filter theo warranty_case_id (WAR-P0-01).
> - Warranty attachment API đầy đủ (upload/list/download/logical delete, checksum, không expose storage_path) (WAR-P1-01).
> - PATCH persist đủ field ERD §45 (confirmed_defect, accessories_received, received_condition, cancel_reason, completed_at/returned_at) + event taxonomy §46 + audit + version/ETag (WAR-P1-02, WAR-P1-05).
> - Idempotency-Key contract cho POST/PATCH warranty (428/422/replay snapshot/Idempotent-Replay header) — khớp FE baseline (P2 review).
> - Pint clean toàn tree; `php artisan test`: 238 passed / 0 failed.
> Evidence: docs/evidence/warranty-flow04/WWHN-63-64-completion-evidence.md (FE repo) + CI run trên SHA mới nhất m1.

### WWHN-64 (Warranty FE/UI) — chuyển To Do → sẵn sàng review/QA

> - API mapping đầy đủ 16 flow warranty/component issue trong WMS_FE_CONTRACT_BASELINE (kèm verifier mới cho phép mở rộng flow nhưng khóa 6 flow nền tảng v1.7).
> - Unit/component test: ComponentIssueModal, WarrantyDetailModal, WarrantyPage, warrantyService, componentIssueService (398 test FE pass).
> - E2E: warranty-flow04-evidence.spec.ts (UI, mock envelope chuẩn) + warranty-flow04-live-runtime.spec.ts (LIVE, không mock — login/intake/PATCH replay/attachment/component post trừ tồn thật).
> - lint/typecheck/format gates giữ nguyên baseline; wms-contract:verify PASS.
> Evidence: docs/evidence/warranty-flow04/WWHN-63-64-completion-evidence.md.

### Điều kiện còn lại trước khi move Epic WWHN-8 → Done

1. Push m1 hai repo, chờ CI xanh trên **exact SHA mới** (wwhn-150/wwhn-180 BE,
   WWHN-153 Sign-off Integrity FE).
2. Chạy `test:e2e:warranty-live` trên UAT (deploy từ đúng SHA) và đính kèm
   report/video vào WWHN-63/64.
3. BA/QA xác nhận theo DoD (UI evidence + traceability) — không self-sign.
