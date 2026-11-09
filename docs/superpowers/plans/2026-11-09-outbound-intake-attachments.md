# Chứng từ đính kèm + sửa phiếu xuất nháp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép đính kèm chứng từ ngay khi tiếp nhận yêu cầu xuất và sửa thông tin đầu phiếu xuất khi còn Nháp, giống trang phiếu nhập.

**Architecture:** FE tách khối chọn tệp của form nhập thành component dùng chung, rồi dùng lại trong form tiếp nhận xuất; tệp chỉ được upload sau khi consume toa thành công. BE thêm một endpoint PATCH chuyên biệt chỉ cho phiếu `DRAFT`, cập nhật header phiếu + toa nguồn, không đụng dòng SKU; FE mở form sửa từ footer drawer chi tiết.

**Tech Stack:** React + TypeScript + TanStack Query + MUI/Vuexy (`src/shared/ui`), Laravel 11 + PHPUnit, Vitest/RTL.

**Spec:** `docs/superpowers/specs/2026-11-09-outbound-intake-attachments-design.md` (FE repo)

## Global Constraints

- Chỉ sửa header phiếu xuất nháp: người/nơi nhận, địa chỉ, SĐT, đại lý/nơi nhận, ngày yêu cầu, ghi chú, chứng từ. **Không sửa SKU/số lượng.**
- Chỉ trạng thái `DRAFT`; SCANNING/POSTED/CANCELLED trả 409.
- Mọi mutation sửa phiếu phải có `If-Match`; thiếu 428, lệch 412.
- Chứng từ tải lên qua `POST /outbound-documents/{id}/attachments`; tệp JPG/PNG/WEBP/PDF ≤ 15MB.
- Chứng từ khi tiếp nhận gắn vào **phiếu đầu tiên** (`outboundDocumentIds[0]`).
- Không gọi consume lần hai khi retry upload.
- Quyền BE/FE của endpoint sửa: `outbound.request.manual_create|outbound.import`.
- Quyền tải chứng từ: `outbound.scan|outbound.post`.
- Giữ nguyên câu chữ tiếng Việt hiện có của form nhập.
- Không thêm dependency mới.

## Review Focus

- **Upload lỗi sau khi phiếu đã tạo:** drawer phải ở lại, hiện lỗi từng tệp, retry chỉ upload tệp chưa xong và tuyệt đối không tạo phiếu thứ hai.
- **Lô Excel nhiều phiếu:** chỉ phiếu đầu nhận chứng từ; các phiếu khác không bị nhân bản tệp.
- **Phiếu vừa bị người khác sửa:** PATCH với version cũ phải trả 412 và FE không âm thầm ghi đè.
- **Phiếu đã quét hoặc đã post:** không được sửa header/dòng; nút sửa phải biến mất và BE trả 409.
- **Tệp sai loại/quá dung lượng:** bị chặn ở client trước khi tạo phiếu; không có tệp mồ côi.

---

### Task 1: Tách khối chứng từ chờ thành component dùng chung

**Files:**
- Create: `WMS_Warehouse_Hoa_Nam_FE/src/shared/components/PendingDocumentAttachments.tsx`
- Delete: `WMS_Warehouse_Hoa_Nam_FE/src/modules/inbound/components/InboundCreateAttachments.tsx`
- Modify: `WMS_Warehouse_Hoa_Nam_FE/src/modules/inbound/components/InboundDraftModal.tsx:26-28,129,275,697`
- Modify: `WMS_Warehouse_Hoa_Nam_FE/src/shared/i18n/messages.ts:613-621,4734-4763`

**Interfaces:**
- Consumes: `FILE_RULES.documentAttachment`, `acceptAttribute`, shared `ActionButton`/`ActionIconButton`.
- Produces:
  ```ts
  export interface PendingDocumentAttachment {
    id: string; file: File;
    status: "selected" | "uploading" | "uploaded" | "failed";
    error?: string;
  }
  export function PendingDocumentAttachments(props: {
    files: PendingDocumentAttachment[]; busy: boolean; locked: boolean;
    onSelect: (files: File[]) => void; onRemove: (id: string) => void;
    hint?: ReactNode;
  }): JSX.Element
  ```

- [ ] **Step 1: Run the existing inbound attachment tests as the baseline**

Run: `npm test -- InboundDraftModal`
Expected: PASS (all tests green before refactor).

- [ ] **Step 2: Create the shared component**

Copy the JSX/behaviour of `InboundCreateAttachments` into `src/shared/components/PendingDocumentAttachments.tsx`. Rename the type and props as above. Use shared keys:
`shared.attachments.selectFiles`, `shared.attachments.pendingHint`, `shared.attachments.pendingSelected`, `shared.attachments.pendingUploaded`, `shared.attachments.removeFile`. Render `hint ?? t("shared.attachments.pendingHint")`.

- [ ] **Step 3: Add/relocate i18n keys**

Under `shared.attachments` add exactly:
```ts
selectFiles: "Chọn chứng từ đính kèm",
pendingHint: "Ảnh JPG/PNG/WEBP hoặc PDF, mỗi tệp ≤ 15MB. Tệp chỉ được tải lên sau khi bấm tạo phiếu.",
pendingSelected: "Đã chọn · Chưa tải lên",
pendingUploaded: "Đã tải lên",
removeFile: "Bỏ tệp {name}",
```
Remove the five now-unused `inbound.draft.*` keys (`selectAttachments`, `localAttachmentsHint`, `attachmentSelected`, `attachmentUploaded`, `removeAttachment`). Keep `retryAttachments`, `continueScanning`, `attachmentsReceiptCreated`.

- [ ] **Step 4: Point InboundDraftModal at the shared component**

Replace the import with:
```ts
import { PendingDocumentAttachments, type PendingDocumentAttachment } from "@/shared/components/PendingDocumentAttachments";
```
Rename `PendingInboundAttachment` → `PendingDocumentAttachment` everywhere used, and `<InboundCreateAttachments ... />` → `<PendingDocumentAttachments ... />`. Pass no `hint` (default text is identical). Keep props `busy={saving}`, `locked={Boolean(createdReceipt)}`.

- [ ] **Step 5: Delete the old module component**

Delete `src/modules/inbound/components/InboundCreateAttachments.tsx`.

- [ ] **Step 6: Run the inbound tests again**

Run: `npm test -- InboundDraftModal`
Expected: PASS with the same number of tests.

- [ ] **Step 7: Commit**

```bash
git add src/shared/components/PendingDocumentAttachments.tsx src/modules/inbound/components/InboundDraftModal.tsx src/shared/i18n/messages.ts
git rm src/modules/inbound/components/InboundCreateAttachments.tsx
git commit -m "refactor(fe): share pending document attachment picker"
```

---

### Task 2: Chứng từ trong form tiếp nhận yêu cầu xuất

**Files:**
- Modify: `WMS_Warehouse_Hoa_Nam_FE/src/modules/outbound/components/OutboundIntakeModal.tsx`
- Modify: `WMS_Warehouse_Hoa_Nam_FE/src/modules/outbound/pages/AlignedMvpOutboundPage.tsx:91-94,636-646`
- Modify: `WMS_Warehouse_Hoa_Nam_FE/src/shared/i18n/messages.ts:877-992`
- Test: `WMS_Warehouse_Hoa_Nam_FE/src/modules/outbound/components/OutboundIntakeModal.test.tsx`

**Interfaces:**
- Consumes: `PendingDocumentAttachments`, `uploadDocumentAttachment` from `@/shared/api/documentAttachmentService`.
- Produces: `OutboundIntakeModalProps` gains `canAttach: boolean`; `<AlignedMvpOutboundPage>` computes `canAttach = can("outbound.scan") || can("outbound.post")`.

- [ ] **Step 1: Write failing tests**

In `OutboundIntakeModal.test.tsx`:
- Add `vi.mock("@/shared/api/documentAttachmentService", () => ({ uploadDocumentAttachment: vi.fn() }))`.
- Import `uploadDocumentAttachment` and `consumeOutboundImport`.
- Change `renderIntake(canImport = true, canAttach = true)` to pass `canAttach`.
- Add tests:
  1. `keeps selected attachments local until the outbound document is created` — select `delivery.png` through `screen.getByLabelText("Chọn chứng từ đính kèm")`; expect `uploadDocumentAttachment` not called; fill required fields, click validate; expect the confirm button; click confirm with `consumeOutboundImport` mocked to `{ importId:"IMP-1", status:"CONSUMED", outboundRequestIds:["REQ-1"], outboundDocumentIds:["OUT-1"] }`; wait for upload call `{ documentType:"OUTBOUND", documentId:"OUT-1", file }` and `onConsumed(["OUT-1"])`.
  2. `retries only failed attachments without consuming again` — first upload rejects, second resolves; click confirm; find button `Thử tải lại chứng từ`; click it; expect `onConsumed`, `consumeOutboundImport` called once, upload called twice with the same file.
  3. `attaches to the first document when the import creates several` — consume returns `["OUT-1","OUT-2"]`; expect upload `documentId: "OUT-1"`.
  4. `rejects invalid attachment files before creation` — select `bad.exe` and a 16MB png; expect neither filename rendered and upload not called.
  5. `allows removing a local attachment` — select, click `Bỏ tệp remove.png`, expect gone and upload not called after creating.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- OutboundIntakeModal`
Expected: FAIL — no attachment input/`canAttach` prop, no upload call.

- [ ] **Step 3: Add `canAttach` to the page**

In `AlignedMvpOutboundPage.tsx` after `canImport`:
```ts
const canAttach = can("outbound.scan") || can("outbound.post");
```
Pass `canAttach={canAttach}` to `<OutboundIntakeModal ... />`.

- [ ] **Step 4: Implement the intake flow**

In `OutboundIntakeModal.tsx`:
- Add `canAttach` to props.
- Imports: `UiAlert` from `@/shared/ui`, `uploadDocumentAttachment` from `@/shared/api/documentAttachmentService`, `PendingDocumentAttachments` and type.
- State: `pendingFiles`, `createdResult: ConsumeOutboundImportResult | null`, `uploading`.
- `busy = consumeMutation.isPending || uploading`.
- `selectFiles(files)` validates each with `checkFile(file, FILE_RULES.documentAttachment)`, toasts invalid ones, appends accepted as `selected`.
- `uploadPendingFiles(documentId)` loops over `pendingFiles`, skips `uploaded`, sets `uploading`, per-file `uploading/failed/uploaded` + `getApiErrorMessage`, returns `true` only if no failure.
- `consumeMutation.onSuccess`: if no pending files → current toast/reset/`onConsumed`; else `setCreatedResult(result)` and upload to `result.outboundDocumentIds[0]` (if empty, toast error and keep drawer); on success → toast + reset + `onConsumed(ids)`.
- Retry button calls `uploadPendingFiles(createdResult.outboundDocumentIds[0])`; on success → toast + reset + `onConsumed`.
- `close()`: return if `busy`; capture ids from `createdResult`; reset; if ids exist call `onConsumed(ids)`, else `dialog.close()`.
- Header close button and footer `Đóng` use `close` and `disabled={busy}`.
- Disable validate button and manual/excel mode buttons when `createdResult` or uploading.
- Replace the preview action row: when `createdResult` exists, render a `UiAlert` with `outbound.intake.attachmentsCreated` and a retry `ActionButton` (`kind="upload"`) if any file is not uploaded; do not render the confirm button.
- Render after the preview block:
```tsx
{canAttach ? (
  <PendingDocumentAttachments
    files={pendingFiles}
    busy={busy}
    locked={Boolean(createdResult)}
    onSelect={selectFiles}
    onRemove={(id) => { if (!busy) setPendingFiles((cur) => cur.filter((e) => e.id !== id)); }}
    hint={t("outbound.intake.attachmentsHint")}
  />
) : null}
```
- `resetAll` clears `pendingFiles`, `createdResult`, `uploading`.

- [ ] **Step 5: Add i18n keys**

Under `outbound.intake` add:
```ts
attachmentsHint: "Ảnh JPG/PNG/WEBP hoặc PDF, mỗi tệp ≤ 15MB. Tệp được tải lên sau khi tạo phiếu; nếu lô tạo nhiều phiếu, chứng từ gắn vào phiếu đầu tiên.",
attachmentsCreated: "Phiếu xuất đã được tạo. Một số tệp chứng từ chưa tải lên được — thử lại hoặc bỏ tệp lỗi. Đóng cửa sổ sẽ bỏ các tệp chưa tải lên.",
attachmentsRetry: "Thử tải lại chứng từ",
attachmentsUploading: "Đang tải chứng từ...",
attachmentsNeedDocument: "Không xác định được phiếu xuất vừa tạo để đính kèm chứng từ.",
```

- [ ] **Step 6: Run the intake tests**

Run: `npm test -- OutboundIntakeModal`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/outbound/components/OutboundIntakeModal.tsx src/modules/outbound/pages/AlignedMvpOutboundPage.tsx src/shared/i18n/messages.ts src/modules/outbound/components/OutboundIntakeModal.test.tsx
git commit -m "feat(fe): attach documents while accepting outbound requests"
```

---

### Task 3: BE — endpoint sửa phiếu xuất Nháp + enrich chi tiết

**Files:**
- Modify: `WMS_Warehouse_Hoa_Nam_BE/Modules/Warehouse/routes/api.php:185-204`
- Modify: `WMS_Warehouse_Hoa_Nam_BE/Modules/Warehouse/app/Http/Controllers/CurrentBaselineDocumentController.php`
- Modify: `WMS_Warehouse_Hoa_Nam_BE/Modules/Warehouse/app/Http/Controllers/OutboundDocumentController.php:405-419`
- Create: `WMS_Warehouse_Hoa_Nam_BE/tests/Feature/OutboundDraftUpdateTest.php`

**Interfaces:**
- Produces: `PATCH /api/v1/outbound-documents/{id}`, handler `CurrentBaselineDocumentController@updateOutbound`, permission `outbound.request.manual_create|outbound.import`, `Expose ETag` = new version.
- Detail payload adds `request_no`, `request_date`, `agency_code`, `agency_name`; document keeps `recipient_contact_phone`.

- [ ] **Step 1: Write the failing feature test**

Create `tests/Feature/OutboundDraftUpdateTest.php` using `RefreshDatabase`, `PreparesOutboundFixtures`. Cover:
```php
public function test_updates_draft_header_and_syncs_source_request(): void
{
    $headers = $this->superAdminHeaders();
    $warehouse = $this->warehouseFixture();
    $sku = $this->productSkuFixture('SKU-OUT-UPD-001');
    $requestId = $this->outboundRequestFixture((string) $sku->sku_id, 2, 'TOA-UPD-001');
    $doc = $this->outboundDocumentFixture((string) $warehouse->id, $requestId);
    $documentId = $doc['document_id'];

    $this->patchJson("/api/v1/outbound-documents/{$documentId}", [
        'recipient_name' => 'Khách sửa tên',
        'recipient_address' => 'Số 9 đường mới',
        'recipient_contact_phone' => '0901234567',
        'request_date' => '2026-11-01',
        'note' => 'Ghi chú đã sửa',
    ], $headers + ['If-Match' => '1'])->assertOk()
      ->assertJsonPath('data.recipient_name', 'Khách sửa tên')
      ->assertJsonPath('data.recipient_contact_phone', '0901234567')
      ->assertJsonPath('data.note', 'Ghi chú đã sửa')
      ->assertJsonPath('data.version', 2);

    $this->assertDatabaseHas('outbound_requests', [
        'id' => $requestId, 'recipient_name' => 'Khách sửa tên',
        'customer_name' => 'Khách sửa tên', 'customer_phone' => '0901234567',
        'request_date' => '2026-11-01',
    ]);
    $this->assertSame(2, (int) DB::table('outbound_requests')->where('id', $requestId)->value('version'));
    // lines không đổi
    $this->assertDatabaseHas('stock_document_lines', [
        'stock_document_id' => $documentId, 'product_id' => $sku->sku_id, 'qty_planned' => 2,
    ]);
}
```
Add cases: `test_rejects_non_draft_document` (set status SCANNING → 409), `test_requires_if_match` (428), `test_rejects_stale_version` (412), `test_rejects_invalid_phone_and_empty_name` (422), `test_rejects_line_changes` (422 `SOURCE_REQUEST_IMMUTABLE`), `test_viewer_cannot_update` (403), `test_detail_exposes_request_and_agency_labels` (GET → `request_no`, `request_date`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `php artisan test --filter=OutboundDraftUpdateTest`
Expected: FAIL 404/405 because the route and method do not exist.

- [ ] **Step 3: Add the route**

In `routes/api.php` near the GET detail:
```php
Route::patch('outbound-documents/{id}', [CurrentBaselineDocumentController::class, 'updateOutbound'])
    ->middleware(['permission:outbound.request.manual_create|outbound.import', EnforceOutboundWarehouseScope::class]);
```
Update the old comment at lines 139-143 to say draft header editing is allowed but lines remain immutable.

- [ ] **Step 4: Implement `updateOutbound`**

In `CurrentBaselineDocumentController`:
- Validate:
```php
'recipient_name' => ['sometimes', 'required', 'string', 'max:200'],
'recipient_address' => ['sometimes', 'nullable', 'string', 'max:1000'],
'recipient_contact_phone' => ['sometimes', 'nullable', 'string', 'max:50', 'regex:/^0\d{9}$/'],
'agency_id' => ['sometimes', 'nullable', 'uuid'],
'request_date' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:'.InputLimits::DATE_MIN, 'before_or_equal:'.InputLimits::pastDateMax()],
'note' => ['sometimes', 'nullable', 'string', 'max:1000'],
```
- Abort 422 `SOURCE_REQUEST_IMMUTABLE` if `$request->has('lines')`.
- `expectedVersion`, `lockDocument($id, 'issue')`, `assertVersion`; if status !== DRAFT abort 409 `STATE_CONFLICT`; `assertDraftNotExpired`.
- `MasterSelectionGuard::assertAgencySelectable($validated['agency_id'] ?? null, $document->agency_id)` when the key is present.
- Update `stock_documents`: `recipient_name`, `recipient_address`, `recipient_contact_phone`, `agency_id`, `note`, `version = expected+1`, `updated_by`, `updated_at`.
- When `outbound_request_id` is set, update `outbound_requests`: same identity fields, `customer_name`, `customer_address`, `customer_phone`, `request_date`, `version = version + 1`, `updated_by`, `updated_at`. Use `''` for null address, null for empty phone.
- Audit `UPDATE_STOCK_DOCUMENT` with before/after and `line_update_mode: 'NONE'`.
- Return `documentPayload($id)` + ETag; after transaction `DB::afterCommit(fn () => $this->bumpReadCache('stock:version'));`.
- Add the `#[OA\Patch(...)]` annotation with `operationId: 'stock_out_update'` and full request/response.

- [ ] **Step 5: Enrich the detail response**

In `OutboundDocumentController::buildShowPayload`, after `$payload = $doc->toArray();`:
```php
$request = $doc->outbound_request_id === null ? null : DB::table('outbound_requests')
    ->where('id', $doc->outbound_request_id)->first(['request_no', 'request_date', 'customer_phone']);
$payload['request_no'] = $request->request_no ?? null;
$payload['request_date'] = $request->request_date ?? null;
$agency = $doc->agency_id === null ? null : DB::table('agencies')
    ->where('agency_id', $doc->agency_id)->first(['agency_code', 'agency_name']);
$payload['agency_code'] = $agency->agency_code ?? null;
$payload['agency_name'] = $agency->agency_name ?? null;
```
Remove the obsolete "no PATCH" comment in that file.

- [ ] **Step 6: Run the feature test**

Run: `php artisan test --filter=OutboundDraftUpdateTest`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add Modules/Warehouse/routes/api.php Modules/Warehouse/app/Http/Controllers/CurrentBaselineDocumentController.php Modules/Warehouse/app/Http/Controllers/OutboundDocumentController.php tests/Feature/OutboundDraftUpdateTest.php
git commit -m "feat(be): allow editing draft outbound headers"
```
Capture the commit SHA: `git rev-parse --short HEAD` (use it in Task 4).

---

### Task 4: BE — đồng bộ contract, Swagger và route guard

**Files:**
- Modify: `WMS_Warehouse_Hoa_Nam_BE/docs/api-contract/WWHN-195-outbound-openapi.yaml`
- Modify: `WMS_Warehouse_Hoa_Nam_BE/docs/contracts/HoaNam_Current_Baseline_Contract.json`
- Modify: `WMS_Warehouse_Hoa_Nam_BE/docs/testing/WWHN-195-outbound-test-cases.json`
- Modify: `WMS_Warehouse_Hoa_Nam_BE/scripts/verify-wwhn-195-outbound-contract.mjs`
- Modify: `WMS_Warehouse_Hoa_Nam_BE/app/Swagger/Processors/RouteSyncProcessor.php`
- Modify: `WMS_Warehouse_Hoa_Nam_BE/tests/Feature/Wwhn195OutboundContractAlignmentTest.php`
- Modify: `WMS_Warehouse_Hoa_Nam_BE/tests/Feature/DocumentationBaselineContractTest.php`

- [ ] **Step 1: Update the published OpenAPI YAML**

Under `/api/v1/outbound-documents/{id}:`, add `patch` with `operationId: stock_out_update`, summary "Sửa thông tin phiếu xuất nháp", `x-permission: outbound.request.manual_create|outbound.import`, `x-data-scope: EnforceOutboundWarehouseScope`, `IfMatch`, request body fields, and 200/401/403/404/409/412/428 responses. Remove the sentence "Không có `patch`/`put`".

- [ ] **Step 2: Update the baseline contract JSON**

- Change `operation_count_note` to describe the new amendment instead of "PATCH đã gỡ".
- Add to `api.post_baseline_amendments.groups`:
```json
{
  "id": "OUTBOUND-DRAFT-HEADER-EDIT",
  "introduced_in": "<SHA from Task 3>",
  "introduced_at": "2026-11-09",
  "title": "Sửa thông tin đầu phiếu xuất nháp",
  "rationale": "Người dùng yêu cầu sửa header phiếu xuất DRAFT giống phiếu nhập; dòng SKU vẫn bất biến.",
  "owner": "BA + Tech Lead",
  "approval": "PENDING (BA + Tech Lead)",
  "operations": ["PATCH /api/v1/outbound-documents/{id}"]
}
```
Do **not** add it to `retired_operations`.

- [ ] **Step 3: Update test-case JSON and verify script**

- `WWHN-195-outbound-test-cases.json` SRC-002: scenario becomes "PATCH /api/v1/outbound-documents/{id} chỉ sửa header phiếu DRAFT"; expected HTTP 200; expected notes include permission `outbound.request.manual_create|outbound.import`, handler `CurrentBaselineDocumentController@updateOutbound`, no line edits.
- `scripts/verify-wwhn-195-outbound-contract.mjs` V1: assert POST `/outbound-documents` is absent; assert PATCH `/outbound-documents/{id}` is present and points at `CurrentBaselineDocumentController`; keep the `stock_out_create` absence check; assert `stock_out_update` exists in the controller annotation.

- [ ] **Step 4: Update route guard tests**

- `Wwhn195OutboundContractAlignmentTest`:
  - Add `'api/v1/outbound-documents/{id}' => ['PATCH' => CurrentBaselineDocumentController::class.'@updateOutbound']` to `CANONICAL_SURFACE`.
  - Replace `test_ghost_create_and_update_operations_do_not_exist_at_runtime` with a test that asserts POST create + PUT are absent, PATCH is present with the expected handler, and `stock_out_create` is absent while `stock_out_update` is present.
- `DocumentationBaselineContractTest`:
  - In `test_current_business_routes_use_final_baseline_handlers` add `'PATCH api/v1/outbound-documents/{id}' => 'CurrentBaselineDocumentController@updateOutbound'`.
  - Replace `test_removed_outbound_write_routes_are_absent_from_api_surface` with: POST absent; PATCH present with the expected handler.
  - In `test_canonical_route_permissions_cover_core_mutations` add `'PATCH api/v1/outbound-documents/{id}' => 'permission:outbound.request.manual_create|outbound.import'`.

- [ ] **Step 5: Add the Swagger summary fallback**

In `RouteSyncProcessor::ROUTE_SUMMARIES` add:
```php
'patch api/v1/outbound-documents/{id}' => 'Sửa thông tin phiếu xuất nháp',
```

- [ ] **Step 6: Run the contract tests**

Run:
```bash
php artisan test --filter=Wwhn195OutboundContractAlignmentTest
php artisan test --filter=DocumentationBaselineContractTest
php artisan test --filter=SwaggerRouteSyncTest
node scripts/verify-wwhn-195-outbound-contract.mjs
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/api-contract/WWHN-195-outbound-openapi.yaml docs/contracts/HoaNam_Current_Baseline_Contract.json docs/testing/WWHN-195-outbound-test-cases.json scripts/verify-wwhn-195-outbound-contract.mjs app/Swagger/Processors/RouteSyncProcessor.php tests/Feature/Wwhn195OutboundContractAlignmentTest.php tests/Feature/DocumentationBaselineContractTest.php
git commit -m "docs(be): align outbound draft update contract"
```

---

### Task 5: FE — service/types cập nhật + form sửa thông tin

**Files:**
- Modify: `WMS_Warehouse_Hoa_Nam_FE/src/modules/outbound/services/mvpOutboundService.ts:28-51,337-366,514-530`
- Modify: `WMS_Warehouse_Hoa_Nam_FE/src/modules/outbound/services/alignedOutboundService.ts:1-51`
- Create: `WMS_Warehouse_Hoa_Nam_FE/src/modules/outbound/components/OutboundEditInfoModal.tsx`
- Test: `WMS_Warehouse_Hoa_Nam_FE/src/modules/outbound/components/OutboundEditInfoModal.test.tsx`
- Modify: `WMS_Warehouse_Hoa_Nam_FE/src/shared/i18n/messages.ts` (new `outbound.edit` block)

**Interfaces:**
- Produces:
  ```ts
  export interface UpdateOutboundDocumentPayload {
    recipient_name?: string; recipient_address?: string | null;
    recipient_contact_phone?: string | null; agency_id?: string | null;
    request_date?: string; note?: string | null;
  }
  export async function updateOutboundDocument(
    id: string, payload: UpdateOutboundDocumentPayload, ifMatch: number
  ): Promise<OutboundDetail>
  ```
  `OutboundDocumentRecord` adds `recipientPhone?: string`, `requestDate?: string`, `agencyCode?: string | null`, `agencyName?: string | null`.
  `OutboundEditInfoModal({ documentId, canAttach, onClose, onSaved })`.

- [ ] **Step 1: Write the failing component test**

Create `OutboundEditInfoModal.test.tsx` mocking `@/modules/outbound/services/alignedOutboundService`, `@/modules/master-data/hooks/use-mvp-master`, `@/shared/components/DocumentAttachmentsPanel`, and permissions. Cases:
1. Prefills `recipientName`, `recipientPhone`, `recipientAddress`, `note`, `requestDate` from `fetchOutboundDetail`.
2. Clicking `Lưu thông tin` calls `updateOutboundDocument("OUT-1", { recipient_name, recipient_address, recipient_contact_phone, agency_id: null, request_date, note }, 1)` and then `onSaved`.
3. Invalid phone (`123`) blocks save and shows the phone error.
4. `updateOutboundDocument` rejecting with a 412 shows the API error alert and does not call `onSaved`.
5. Status `SCANNING` shows the "chỉ DRAFT" notice and disables save.
6. Lines render read-only: SKU code and quantity visible, no input/remove button.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- OutboundEditInfoModal`
Expected: FAIL — module/component not found.

- [ ] **Step 3: Extend the service and types**

In `mvpOutboundService.ts`:
- Add the four fields to `OutboundDocumentRecord`.
- In `normalizeDocument`, map `recipientPhone`, `requestDate`, `agencyCode`, `agencyName`.
- Add `UpdateOutboundDocumentPayload` and `updateOutboundDocument` using `http.patch` + `headers(ifMatch)`.
- Remove the old "updateOutboundDocument đã gỡ" comments where they now contradict the new endpoint.
In `alignedOutboundService.ts`, import/export `updateOutboundDocument` and the payload type.

- [ ] **Step 4: Implement `OutboundEditInfoModal`**

- `UiDrawer` width 600, title "Sửa thông tin phiếu xuất", header close icon, footer actions "Đóng" + "Lưu thông tin".
- Load detail with `fetchOutboundDetail(documentId)`; prefill once via `initializedRef`.
- Fields: `UiAutocomplete` for agency (search `useMvpAgencies({status:"ACTIVE", keyword, per_page:50})`, default `{per_page:100}`; keep selected label from detail `agencyCode/agencyName`; no create-new; selecting an agency fills recipient name/address), `UiTextField` recipient name (required, max 200), phone (digits max 10, `validatePhone`), `UiAddressField`, `UiVuexyDateField` request date (`pastDateBounds`, required), `UiTextField` note multiline max 1000 with count.
- Read-only lines: `ResponsiveDataTable` columns "SKU", "Tên", "SL" from `detail.lines`.
- `UiAlert tone="info"` with `outbound.edit.linesLocked`.
- `DocumentAttachmentsPanel documentType="OUTBOUND" documentId={documentId} disabled={!canAttach}`.
- If `detail.document.status !== "DRAFT"`: `UiAlert tone="warning"` with `outbound.edit.onlyDraft`; no save button.
- Save mutation: `updateOutboundDocument(documentId, payload, detail.document.version)`; on success toast + `onSaved()`; on error show `ApiErrorAlert` and refetch on 412.
- Validate: recipient non-empty, phone valid or empty, request date valid. Inline errors under fields.

- [ ] **Step 5: Add i18n keys**

Under `outbound.edit` add:
```ts
title: "Sửa thông tin phiếu xuất",
action: "Sửa thông tin",
save: "Lưu thông tin",
saved: "Đã cập nhật thông tin phiếu xuất.",
saveError: "Không lưu được thông tin phiếu xuất.",
onlyDraft: "Chỉ phiếu xuất ở trạng thái Nháp mới được sửa thông tin.",
linesLocked: "SKU và số lượng được chốt từ toa yêu cầu; muốn đổi hàng, hãy huỷ phiếu và tạo lại.",
linesTitle: "Dòng hàng (chỉ đọc)",
errRecipient: "Nhập người / nơi nhận.",
errPhone: "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.",
errRequestDate: "Ngày yêu cầu không hợp lệ hoặc nằm trong tương lai.",
```

- [ ] **Step 6: Run the component test**

Run: `npm test -- OutboundEditInfoModal`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/outbound/services/mvpOutboundService.ts src/modules/outbound/services/alignedOutboundService.ts src/modules/outbound/components/OutboundEditInfoModal.tsx src/modules/outbound/components/OutboundEditInfoModal.test.tsx src/shared/i18n/messages.ts
git commit -m "feat(fe): add outbound draft header edit form"
```

---

### Task 6: FE — mở form sửa từ drawer chi tiết

**Files:**
- Modify: `WMS_Warehouse_Hoa_Nam_FE/src/modules/outbound/components/AlignedOutboundDetailModal.tsx:190-260,712-720`
- Test: `WMS_Warehouse_Hoa_Nam_FE/src/modules/outbound/components/AlignedOutboundDetailModal.drawer.test.tsx` or `.layout.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that mocks `./OutboundEditInfoModal` to `<div data-testid="edit-info-modal" />`:
- With `status: "DRAFT"` and permissions true, `Sửa thông tin` appears in the drawer footer; clicking it renders `edit-info-modal`.
- With `status: "POSTED"`, the button is absent.
- With DRAFT but `useHasPermission` returning false for `outbound.request.manual_create`/`outbound.import`, the button is absent.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- AlignedOutboundDetailModal`
Expected: FAIL — button not rendered.

- [ ] **Step 3: Integrate**

- Add `import { OutboundEditInfoModal } from "./OutboundEditInfoModal";`
- State `const [editOpen, setEditOpen] = useState(false);`
- Compute:
```ts
const canEdit = can("outbound.request.manual_create") || can("outbound.import");
const canAttach = can("outbound.scan") || can("outbound.post");
const showEdit = doc?.status === "DRAFT" && canEdit;
```
- Pass `actions={showEdit ? <ActionButton kind="edit" onClick={() => setEditOpen(true)}>{t("outbound.edit.action")}</ActionButton> : undefined}` to the loaded `UiDrawer`.
- Render after `</UiDrawer>`:
```tsx
{editOpen ? (
  <OutboundEditInfoModal
    documentId={documentId}
    canAttach={canAttach}
    onClose={() => setEditOpen(false)}
    onSaved={() => { setEditOpen(false); onChanged?.(); void detailQuery.refetch(); }}
  />
) : null}
```
- Keep the loading/error early returns unchanged (no edit button there).

- [ ] **Step 4: Run the detail tests**

Run: `npm test -- AlignedOutboundDetailModal`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/outbound/components/AlignedOutboundDetailModal.tsx src/modules/outbound/components/AlignedOutboundDetailModal.drawer.test.tsx
git commit -m "feat(fe): open draft header edit from outbound detail"
```

---

### Task 7: Xác minh toàn bộ

- [ ] **Step 1: Run focused FE tests**

Run:
```bash
npm test -- OutboundIntakeModal OutboundEditInfoModal InboundDraftModal AlignedOutboundDetailModal
```
Expected: PASS.

- [ ] **Step 2: Run FE static checks**

Run:
```bash
npm run typecheck
npm run lint
npm run format:check
```
Expected: no errors. If Prettier reports files, run `npx prettier --write` on only the changed files and re-run.

- [ ] **Step 3: Run the FE build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Run BE tests**

Run:
```bash
php artisan test --filter=OutboundDraftUpdateTest
php artisan test --filter=Wwhn195OutboundContractAlignmentTest
php artisan test --filter=DocumentationBaselineContractTest
php artisan test --filter=SwaggerRouteSyncTest
```
Expected: PASS.

- [ ] **Step 5: Verify the route exists**

Run: `php artisan route:list --path=outbound-documents`
Expected: includes `PATCH api/v1/outbound-documents/{id} ... CurrentBaselineDocumentController@updateOutbound`.

- [ ] **Step 6: Manual browser check (if a runnable local stack is available)**

Start FE dev server if needed. Verify:
1. OUT-01 → Tiếp nhận yêu cầu xuất → chọn tệp chứng từ → tạo phiếu → tab "Chứng từ đính kèm" của phiếu vừa tạo có tệp.
2. Mở một phiếu DRAFT → "Sửa thông tin" → đổi người nhận/SĐT/ghi chú → lưu → drawer chi tiết hiển thị dữ liệu mới.
3. Upload lỗi (chặn mạng) → drawer ở lại, báo lỗi, retry không tạo thêm phiếu.
4. Phiếu POSTED/SCANNING không có nút sửa.

If the local stack is unavailable, record that the manual check was not run and list the unit/build evidence instead.

- [ ] **Step 7: Commit any remaining changes**

```bash
git status --short
git add <changed files>
git commit -m "chore: verify outbound intake attachments and draft edit"
```
