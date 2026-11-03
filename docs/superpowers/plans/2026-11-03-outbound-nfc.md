# Outbound NFC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone NFC screen with read-only NFC lookup in Xuất kho, while preserving the existing outbound workflow.

**Architecture:** A new scoped backend read model serves a paginated product list for all POSTED documents or one document, plus item NFC history. The FE adds a product tab and detail tab using its current design system. Scanner App mutation endpoints remain separate.

**Tech Stack:** Laravel 13, PostgreSQL, PHPUnit; React, TypeScript, TanStack Query, Vitest, existing UI kit.

**Spec:** `docs/superpowers/specs/2026-11-03-outbound-nfc-design.md`

## Global Constraints

- `ASSIGNED` requires an ACTIVE NFC chip; `UNASSIGNED` requires a successful read with no such chip; FE-only `UNKNOWN` represents read failure.
- Global list includes POSTED documents only; document view follows its status and excludes removed matches.
- Read permission is `outbound.view` plus warehouse scope; no write endpoint or stock effect is added.
- Keep existing outbound intake, scan, label, Post Issue, and cancellation behavior.
- Remove standalone `/nfc` navigation/page; redirect old URL to outbound products.

## Review Focus

- A revoked chip must make its item UNASSIGNED while preserving history.
- An out-of-scope document or item must not reveal UID or actor.
- UID search and counts must work across the full result set, not only the visible page.
- NFC read failure must not show false UNASSIGNED values.
- DRAFT, SCANNING, POSTED and CANCELLED must have distinct item eligibility.

---

### Task 1: Backend outbound NFC read contract

**Files:** Create `Modules/Warehouse/app/Http/Controllers/OutboundNfcReadController.php`; modify `Modules/Warehouse/routes/api.php`; create `tests/Feature/OutboundNfcReadTest.php`; add OpenAPI annotations in the new controller.

**Interfaces:** `GET /api/v1/outbound-documents/nfc-items?document_id=&keyword=&nfc_status=&page=&per_page=` returns `{data:[{document_id,document_no,document_status,item_id,item_code,serial_number,sku_code,sku_name,nfc_status,nfc:{physical_code_id,hardware_uid,assigned_at,linker}|null}],meta:{current_page,per_page,total,tab_totals:{ALL,ASSIGNED,UNASSIGNED}}}`. `GET /api/v1/outbound-documents/{id}/items/{itemId}/nfc-history` returns paginated assignment/revocation events for that matched item.

- [ ] Write feature tests for global POSTED scope, DRAFT/SCANNING/CANCELLED behavior, UID search and totals, revoked tag history, 403/404 scope, and stock neutrality.
- [ ] Run the new test file and confirm failures identify missing routes.
- [ ] Implement both read routes with SQL pagination and bounded page size; scope by `outbound.view` and warehouse. Document the response in OpenAPI.
- [ ] Run the new tests and relevant outbound/NFC contract tests.

### Task 2: Frontend typed API client

**Files:** Create `src/modules/outbound/services/outboundNfcService.ts`, `src/modules/outbound/services/outboundNfcService.test.ts`; modify endpoint constants only if the service uses them.

**Interfaces:** `fetchOutboundNfcItems(filters, signal)` and `fetchOutboundItemNfcHistory(documentId,itemId,page,signal)` normalize the new API; types distinguish `ASSIGNED|UNASSIGNED` from UI-only `UNKNOWN`.

- [ ] Write failing tests for pagination/totals and stable UID/history mapping.
- [ ] Run the tests to see the expected failure.
- [ ] Implement the minimal typed service and run its tests.

### Task 3: Product view and detail integration

**Files:** Create `src/modules/outbound/components/OutboundNfcProducts.tsx`, `OutboundNfcProductDetail.tsx`, related CSS/tests; modify `AlignedMvpOutboundPage.tsx` and `AlignedOutboundDetailModal.tsx`; add i18n strings.

**Interfaces:** `OutboundNfcProducts({documentId?,onOpenDocument?})` owns filters, request and pagination. `OutboundNfcProductDetail({documentId,itemId,onClose})` reads item history and shows UID state.

- [ ] Write failing UI tests for global POSTED list, document SCANNING list, filters, UID no-result, read-only detail and NFC-only retry.
- [ ] Run these tests and confirm missing UI behavior.
- [ ] Add a product tab to Xuất kho and an NFC tab to detail using existing UI components/tokens; keep all current write controls on the existing tab.
- [ ] Run focused UI tests, typecheck, and visual inspection at desktop and tablet widths.

### Task 4: Retire standalone NFC screen

**Files:** Modify `src/app/layouts/nav-data.ts`, `MainLayout.tsx`, `src/app/router/index.tsx`, `route-components.ts`, `route-preload.ts`, `access.ts`, and affected tests. Remove the standalone `src/modules/nfc` page and its page-only helpers after the read-only behavior is represented in outbound; keep the legacy URL redirect.

- [ ] Write/update route and nav tests proving the sidebar has no NFC entry and `/nfc` redirects to `/outbound?tab=products`.
- [ ] Run tests to see the old route/nav fail.
- [ ] Remove the page wiring, set legacy redirect, and adapt the header warehouse selector to outbound context.
- [ ] Run route/nav tests and verify the old URL safely lands in Xuất kho.

### Task 5: Integration verification

**Files:** Review only, plus corrective edits if a concrete failure is found.

- [ ] Run BE outbound/NFC feature tests, FE targeted tests, typecheck, lint and build.
- [ ] Inspect FE at desktop/tablet widths against mockups 01–18, especially empty/loading/error/unknown states.
- [ ] Review both worktree diffs for accidental stock mutation or unrelated changes; record remaining runtime limits.
