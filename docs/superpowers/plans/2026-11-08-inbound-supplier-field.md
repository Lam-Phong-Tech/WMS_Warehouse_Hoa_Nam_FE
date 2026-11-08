# Inbound Supplier Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required, server-searched supplier field to the web inbound receipt create/edit drawer, persist it on the receipt header, and show the selected supplier when editing.

**Architecture:** The web form posts header-only receipts to `/api/v1/inbound-documents` (runtime handler `BaM1InboundDocumentController`). Add a nullable `stock_documents.supplier_id`, validate/persist it in the create/update controller, and return a resolved supplier object from the receipt detail endpoint. On the FE, add a server-side supplier lookup hook, a `filterMode="server"` option to the canonical `UiAutocomplete`, and a required full-width field in `InboundDraftModal`.

**Tech Stack:** Laravel 13 / PHP 8.4 / PHPUnit, React 19 / TypeScript / Vite / Vitest / Playwright, TanStack Query v5, MUI via `@/shared/ui`.

**Spec:** `D:\laragon\www\Hoa_Nam\outputs\inbound-supplier-field-20261108-design.md`

**Worktrees:**
- Backend: `D:\laragon\www\Hoa_Nam\backend-inbound-supplier-20261108` (branch `codex/inbound-supplier-field`)
- Frontend: `D:\laragon\www\Hoa_Nam\frontend-inbound-supplier-20261108` (branch `codex/inbound-supplier-field`)

## Global Constraints

- Supplier is required in the web UI; the API keeps `supplier_id` nullable to preserve existing header-only clients and tests.
- Only suppliers with `status = ACTIVE` can be selected; no inline supplier creation.
- Supplier lookup uses `GET /api/v1/mini-app/inbound/suppliers?q=&status=ACTIVE&page=1&per_page=20`.
- Initial search is empty (`q` omitted); typing is debounced 300ms.
- Use `UiAutocomplete` from `@/shared/ui`; do not import MUI Autocomplete directly in module code.
- In React Testing Library, never pass `exact` to `*ByRole`; string names already match exactly.
- Preserve all unrelated working-tree changes and existing header-only tests.

## Review Focus

- A receipt created without `supplier_id` must still succeed at API level (existing clients/tests).
- The FE save button must not call the create/update mutation when no supplier is selected.
- Editing an old receipt with `supplier_id = null` must require choosing a supplier before saving.
- Editing a receipt with a supplier must display the supplier name without needing another search.
- Fast typing must only render results for the last debounced keyword; changing results must not clear the selected supplier.

---

### Task 1: Add `supplier_id` to `stock_documents`

**Files:**
- Create: `Modules/Warehouse/database/migrations/2026_11_08_000200_add_supplier_id_to_stock_documents.php`
- Modify: `Modules/Warehouse/app/Models/StockDocument.php`
- Test: `tests/Feature/InboundSupplierFieldTest.php`

**Interfaces:**
- Consumes: `stock_documents` table, `Schema` builder.
- Produces: nullable UUID column `stock_documents.supplier_id` with index `idx_sd_supplier_id`; `StockDocument::$fillable` includes `supplier_id`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/InboundSupplierFieldTest.php` with `RefreshDatabase`, `PreparesOutboundFixtures`, and one test:

```php
public function test_stock_documents_has_nullable_supplier_id_column(): void
{
    $this->assertTrue(Schema::hasColumn('stock_documents', 'supplier_id'));
    $this->assertFalse(Schema::getColumnListing('stock_documents') === []);
}
```

Add a second assertion in the same test after inserting a header without supplier: the inserted row has `supplier_id === null`.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=test_stock_documents_has_nullable_supplier_id_column -v`
Expected: FAIL because `supplier_id` does not exist.

- [ ] **Step 3: Implement the migration and model change**

Migration:

```php
Schema::table('stock_documents', function (Blueprint $table): void {
    $table->uuid('supplier_id')->nullable()->after('dst_warehouse_id');
    $table->index('supplier_id', 'idx_sd_supplier_id');
});
```

`down()` drops the index then the column. Add `'supplier_id'` to `StockDocument::$fillable`.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=test_stock_documents_has_nullable_supplier_id_column -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Modules/Warehouse/database/migrations/2026_11_08_000200_add_supplier_id_to_stock_documents.php Modules/Warehouse/app/Models/StockDocument.php tests/Feature/InboundSupplierFieldTest.php
git commit -m "feat(inbound): add supplier reference to stock documents"
```

---

### Task 2: Accept, validate and persist supplier on header create/update

**Files:**
- Modify: `Modules/Warehouse/app/Http/Controllers/BaM1InboundDocumentController.php`
- Test: `tests/Feature/InboundSupplierFieldTest.php`

**Interfaces:**
- Consumes: `stock_documents.supplier_id`, `inbound_suppliers` directory, `superAdminHeaders()` and `warehouseFixture()` from `PreparesOutboundFixtures`.
- Produces: `POST/PATCH /api/v1/inbound-documents` accept `supplier_id` (nullable UUID), reject unknown (`422 SUPPLIER_NOT_AVAILABLE`) and inactive (`409 SUPPLIER_INACTIVE`) suppliers, persist the value, and return it as `data.supplier_id`.

- [ ] **Step 1: Write failing tests**

Add helpers and tests to `tests/Feature/InboundSupplierFieldTest.php`:

```php
private function supplier(string $status = 'ACTIVE'): string
{
    $id = (string) Str::uuid();
    $warehouse = $this->warehouseFixture();
    DB::table('inbound_suppliers')->insert([
        'id' => $id,
        'warehouse_id' => $warehouse->id,
        'code' => 'NCC-001',
        'name' => 'Honda Việt Nam',
        'status' => $status,
        'version' => 1,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    return $id;
}
```

Tests:
- `test_create_persists_supplier_id_and_returns_it`
- `test_create_without_supplier_remains_backward_compatible`
- `test_create_rejects_unknown_supplier`
- `test_create_rejects_inactive_supplier`
- `test_update_changes_supplier_and_increments_version`

Use `postJson('/api/v1/inbound-documents', [...], $this->superAdminHeaders())` and `patchJson(..., $headers + ['If-Match' => '"1"'])`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --filter=InboundSupplierFieldTest -v`
Expected: the supplier tests fail because the field is ignored or rejected.

- [ ] **Step 3: Implement validation, lookup and persistence**

In `BaM1InboundDocumentController`:
- Add `'supplier_id' => ['nullable', 'uuid']` to both `store()` and `update()` validation arrays.
- Add a private `assertActiveSupplier(?string $id): void`:
  - `null`/empty returns.
  - Query `inbound_suppliers` by lowercase id.
  - Missing → `ApiError::abort(422, 'SUPPLIER_NOT_AVAILABLE', 'Nhà cung cấp không tồn tại trong danh mục chung.')`.
  - `status !== 'ACTIVE'` → `ApiError::abort(409, 'SUPPLIER_INACTIVE', 'Nhà cung cấp đã ngừng sử dụng; chọn lại trước khi lưu.')`.
- Call it after warehouse validation in `store()` and before the update transaction in `update()`.
- Persist `supplier_id` in `createHeader()` insert.
- In `update()`, add `'supplier_id'` to the updatable fields loop; only change it when the key exists in `$validated`.
- Include `'supplier_id' => $row->supplier_id` in `normalizeDocument()`.
- Add `supplier_id` to both OpenAPI request-body property lists.

- [ ] **Step 4: Run tests to verify they pass**

Run: `php artisan test --filter=InboundSupplierFieldTest -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Modules/Warehouse/app/Http/Controllers/BaM1InboundDocumentController.php tests/Feature/InboundSupplierFieldTest.php
git commit -m "feat(inbound): persist supplier on receipt header"
```

---

### Task 3: Return the resolved supplier in receipt detail

**Files:**
- Modify: `Modules/Warehouse/app/Http/Controllers/Concerns/InteractsWithStockDocuments.php`
- Test: `tests/Feature/InboundSupplierFieldTest.php`

**Interfaces:**
- Consumes: `stock_documents.supplier_id`, `inbound_suppliers`.
- Produces: `GET /api/v1/inbound-documents/{id}` returns `data.supplier` as `{id, code, name, display_name, status, version}` or `null`.

- [ ] **Step 1: Write failing tests**

Add:
- `test_detail_returns_selected_supplier`
- `test_detail_returns_null_supplier_when_not_selected`

Create a receipt with the supplier helper, then `getJson('/api/v1/inbound-documents/'.$id, $headers)->assertOk()->assertJsonPath('data.supplier.id', $supplierId)->assertJsonPath('data.supplier.display_name', 'NCC-001 - Honda Việt Nam')`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test --filter=InboundSupplierFieldTest -v`
Expected: `data.supplier` is missing.

- [ ] **Step 3: Implement the detail enrichment**

In `InteractsWithStockDocuments::show()`, after the document is found and before `respondSuccess`:
- If `docType() === StockDocument::TYPE_RECEIPT` and `$doc->supplier_id` is non-empty:
  - Query `inbound_suppliers` by id.
  - Set `display_name` to `"code - name"` when code exists, else `name`.
  - `$doc->setAttribute('supplier', $supplier);`
- Otherwise set `supplier` to `null`.
- Import `Illuminate\Support\Facades\DB` if not already imported.

- [ ] **Step 4: Run tests to verify they pass**

Run: `php artisan test --filter=InboundSupplierFieldTest -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Modules/Warehouse/app/Http/Controllers/Concerns/InteractsWithStockDocuments.php tests/Feature/InboundSupplierFieldTest.php
git commit -m "feat(inbound): expose supplier in receipt detail"
```

---

### Task 4: Map supplier fields in FE types and service

**Files:**
- Modify: `src/modules/inbound/types/index.ts`
- Modify: `src/modules/inbound/services/inboundService.ts`
- Test: `src/modules/inbound/services/inboundService.test.ts`

**Interfaces:**
- Consumes: BE `supplier_id` and `supplier` fields.
- Produces:
  - `CreateInboundPayload.supplier_id?: string | null`
  - `UpdateInboundPayload.supplier_id?: string | null`
  - `InboundDocument.supplierId?: string | null`
  - `InboundDetail.supplier?: InboundSupplier | null`
  - `InboundSupplier = { id: string; code: string | null; name: string; displayName: string; status: "ACTIVE" | "INACTIVE"; version: number }`

- [ ] **Step 1: Write failing service test**

In `inboundService.test.ts`, add a test that mocks a detail response containing:

```ts
supplier_id: "SUP-1",
supplier: {
  id: "SUP-1", code: "NCC-001", name: "Honda",
  display_name: "NCC-001 - Honda", status: "ACTIVE", version: 1,
},
```

Assert `fetchInboundDetail` returns `document.supplierId === "SUP-1"` and `supplier.displayName === "NCC-001 - Honda"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:NODE_OPTIONS='--no-experimental-webstorage'; npx vitest run src/modules/inbound/services/inboundService.test.ts --maxWorkers=2`
Expected: FAIL because the mapping does not exist.

- [ ] **Step 3: Implement types and mapping**

In `inboundService.ts`:
- Add a `normalizeSupplier(raw)` helper returning the `InboundSupplier` shape or `null`.
- In `normalizeDocument`, add `supplierId: text(row.supplier_id) || undefined`.
- In `normalizeDetail`, add `supplier: normalizeSupplier(row.supplier)`.
- Add the optional fields to the payload interfaces.

- [ ] **Step 4: Run test to verify it passes**

Run the same Vitest command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/inbound/types/index.ts src/modules/inbound/services/inboundService.ts src/modules/inbound/services/inboundService.test.ts
git commit -m "feat(inbound): map supplier on receipt payloads"
```

---

### Task 5: Add server-filter mode to `UiAutocomplete`

**Files:**
- Modify: `src/shared/ui/forms/UiAutocomplete.tsx`
- Test: `src/shared/ui/forms/UiAutocomplete.test.tsx` (new)

**Interfaces:**
- Consumes: existing `UiAutocomplete` props.
- Produces: optional `filterMode?: "local" | "server"` (default `"local"`); when `"server"`, skip local label filtering but keep option-window slicing and add-new handling.

- [ ] **Step 1: Write failing tests**

Create `UiAutocomplete.test.tsx` with `renderWithProviders`:
- `local mode filters options by typed text` (existing behavior).
- `server mode keeps options returned by the caller even when the label does not contain the typed text`.

Use options `[{ value: "1", label: "NCC-001 - Honda" }]` and type `"zzz"`; local mode shows no option, server mode still shows it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:NODE_OPTIONS='--no-experimental-webstorage'; npx vitest run src/shared/ui/forms/UiAutocomplete.test.tsx --maxWorkers=2`
Expected: FAIL because `filterMode` is not supported.

- [ ] **Step 3: Implement `filterMode`**

- Add `filterMode?: "local" | "server"` to `UiAutocompleteBaseProps`.
- Destructure with default `"local"`.
- In `filterOptions`, choose `const matched = filterMode === "server" ? all : filterByLabel(all, state);` then keep the existing `ADD_NEW` filtering and `slice(0, listWindow.limit)`.

- [ ] **Step 4: Run tests to verify they pass**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/forms/UiAutocomplete.tsx src/shared/ui/forms/UiAutocomplete.test.tsx
git commit -m "feat(ui): allow server-filtered autocomplete options"
```

---

### Task 6: Add supplier lookup hook

**Files:**
- Create: `src/modules/inbound/hooks/use-inbound-supplier-search.ts`
- Test: `src/modules/inbound/hooks/use-inbound-supplier-search.test.tsx`

**Interfaces:**
- Consumes: `listSuppliers` from `@/modules/master-data/services/supplier.service`, TanStack Query.
- Produces:

```ts
export interface UseInboundSupplierSearchResult {
  options: Array<{ value: string; label: string }>;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  onSearch: (keyword: string) => void;
}
export function useInboundSupplierSearch(enabled = true): UseInboundSupplierSearchResult;
```

- [ ] **Step 1: Write failing tests**

Mock `listSuppliers` and use `renderHook` with a `QueryClientProvider`:
- Initial render calls `listSuppliers` with `{ q: undefined, status: "ACTIVE", page: 1, per_page: 20 }`.
- Typing `"Hon"` does not call immediately; after 300ms it calls once with `q: "Hon"`.
- Rapid typing `"H"`, `"Ho"`, `"Hon"` results in only the final debounced call.
- Returned options map `display_name` to `label` and `id` to `value`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:NODE_OPTIONS='--no-experimental-webstorage'; npx vitest run src/modules/inbound/hooks/use-inbound-supplier-search.test.tsx --maxWorkers=2`
Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook**

- Local `keyword` state and a 300ms debounce `useEffect`.
- `useQuery` with key `["inbound", "supplier-lookup", debouncedKeyword]`.
- `queryFn` calls `listSuppliers({ q: debouncedKeyword || undefined, status: "ACTIVE", page: 1, per_page: 20 })`.
- `enabled` forwarded; `placeholderData: (previous) => previous`; `staleTime: 60_000`.
- Map rows to options; `retry` = `refetch`.

- [ ] **Step 4: Run tests to verify they pass**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/inbound/hooks/use-inbound-supplier-search.ts src/modules/inbound/hooks/use-inbound-supplier-search.test.tsx
git commit -m "feat(inbound): add server-side supplier lookup"
```

---

### Task 7: Add required supplier field to `InboundDraftModal`

**Files:**
- Modify: `src/modules/inbound/components/InboundDraftModal.tsx`
- Modify: `src/shared/i18n/messages.ts`, `messages.en.ts`, `messages.zh.ts`
- Test: `src/modules/inbound/components/InboundDraftModal.test.tsx`

**Interfaces:**
- Consumes: `useInboundSupplierSearch`, `UiAutocomplete` `filterMode="server"`, `InboundDetail.supplier`.
- Produces: `FormValues.supplierId`; create/update payloads include `supplier_id`; required validation key `inbound.draft.errSupplier`.

- [ ] **Step 1: Write failing tests**

Update `InboundDraftModal.test.tsx`:
- Mock `@/modules/inbound/hooks/use-inbound-supplier-search` to return `[{ value: "SUP-1", label: "NCC-001 - Honda" }]`, `loading: false`, `error: null`, `retry: vi.fn()`, `onSearch: vi.fn()`.
- Add `supplier` to the edit detail fixture.
- Change existing create test to select the supplier before clicking "Tạo phiếu & quét hàng"; expect the payload to include `supplier_id: "SUP-1"`.
- Change existing edit test to expect `supplier_id` in the update payload.
- Add `không gọi API tạo phiếu khi chưa chọn nhà cung cấp`.
- Add `hiện nhà cung cấp đã chọn khi sửa phiếu`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `$env:NODE_OPTIONS='--no-experimental-webstorage'; npx vitest run src/modules/inbound/components/InboundDraftModal.test.tsx --maxWorkers=2`
Expected: FAIL because the field and payload do not exist.

- [ ] **Step 3: Implement the field**

- `FormValues` + `EMPTY_FORM` add `supplierId: ""`.
- Add `SERVER_FIELD_TO_FORM_FIELD` entries `supplierId` and `supplier_id` → `"supplierId"`.
- Call `useInboundSupplierSearch(true)`; keep `supplierKeyword` via the hook's `onSearch`.
- Build `selectedSupplier` from `detail?.supplier`; merge it into options when missing.
- Add a full-width `UiAutocomplete` after the date/warehouse grid row:
  - `label={t("inbound.draft.supplier")}`, `required`, `filterMode="server"`, `loading`, `noOptionsText`, `onInputChange={onSearch}`.
  - `value={formValues.supplierId || null}`; `onChange` sets `supplierId`, clears `supplierId` error.
  - `disabled={!mutable || headerLocked}`; `error`/`helperText` from `fieldErrors.supplierId`.
- In `validateForm`, add `if (!formValues.supplierId) errors.supplierId = t("inbound.draft.errSupplier");`.
- In the detail initialization effect, set `supplierId: detail.supplier?.id ?? ""`; in the create initialization set `supplierId: ""`.
- Add `supplier_id: formValues.supplierId || null` to both create and update payloads.
- Add i18n keys in all three catalogs:
  - `supplier`: `"Nhà cung cấp"` / `"Supplier"` / `"供应商"`
  - `supplierPlaceholder`: `"Tìm mã hoặc tên nhà cung cấp..."` / `"Search supplier code or name..."` / `"搜索供应商编码或名称..."`
  - `errSupplier`: `"Chọn nhà cung cấp."` / `"Select a supplier."` / `"请选择供应商。"`
  - `supplierEmpty`: `"Không tìm thấy nhà cung cấp"` / `"No suppliers found"` / `"未找到供应商"`
  - `supplierLoadError`: `"Không tải được danh sách nhà cung cấp."` / `"Unable to load suppliers."` / `"无法加载供应商列表。"`

- [ ] **Step 4: Run tests to verify they pass**

Run: `$env:NODE_OPTIONS='--no-experimental-webstorage'; npx vitest run src/modules/inbound/components/InboundDraftModal.test.tsx --maxWorkers=2`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/inbound/components/InboundDraftModal.tsx src/modules/inbound/components/InboundDraftModal.test.tsx src/shared/i18n/messages.ts src/shared/i18n/messages.en.ts src/shared/i18n/messages.zh.ts
git commit -m "feat(inbound): require and search supplier in receipt form"
```

---

### Task 8: Focused regression, build and browser verification

**Files:**
- Test: `e2e/inbound-supplier-field.spec.ts` (new, optional if the page fixture is too broad; otherwise use the unit evidence)
- Docs: update `docs/ui/supplier-directory-verification.md` or add `docs/ui/inbound-supplier-field-verification.md`

**Interfaces:**
- Consumes: the completed BE and FE changes.
- Produces: green focused tests, typecheck, lint, build, and a browser check of the form.

- [ ] **Step 1: Run BE focused tests**

Run: `php artisan test --filter=InboundSupplierFieldTest -v`
Expected: PASS.

- [ ] **Step 2: Run FE focused tests**

Run: `$env:NODE_OPTIONS='--no-experimental-webstorage'; npx vitest run src/modules/inbound/components/InboundDraftModal.test.tsx src/modules/inbound/hooks/use-inbound-supplier-search.test.tsx src/modules/inbound/services/inboundService.test.ts src/shared/ui/forms/UiAutocomplete.test.tsx --maxWorkers=2`
Expected: PASS.

- [ ] **Step 3: Run typecheck, lint and build**

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all exit 0. If `lint` reports a file outside this change, report it separately; do not fix unrelated code.

- [ ] **Step 4: Browser check**

Start the FE dev server from the worktree, open `/inbound`, click `Tạo phiếu nhập`, type a supplier code/name, select a result, save, and verify the receipt edit drawer shows the same supplier. Capture the console/network errors. If the full page fixture is not available, document that the browser check was limited to the form component tests.

- [ ] **Step 5: Commit**

```bash
git add e2e/inbound-supplier-field.spec.ts docs/ui/inbound-supplier-field-verification.md
git commit -m "test(inbound): verify supplier field flow"
```

---

## Self-Review

- Spec coverage: BE schema/persistence/detail, FE types/hook/autocomplete/form/i18n/tests, browser verification.
- Type consistency: `supplier_id` in API payloads; `supplierId` in FE form/document; `supplier` in detail; `filterMode` in `UiAutocomplete`.
- Review Focus tests: backward-compatible create without supplier; required UI save block; edit with null supplier; edit with existing supplier; rapid typing; 403 supplier lookup.
- Proportion: plan describes interfaces and assertions, not full component bodies.
