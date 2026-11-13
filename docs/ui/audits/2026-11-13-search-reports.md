# Report search contract audit — 2026-11-13

Scope: `src/modules/reports`, its report-specific loaders, and linked report controllers. Read `AGENTS.md`, `DESIGN_FOUNDATIONS.md` and the SKU filter/table guide. This is a functional source audit with focused automated checks, not a browser certification or design rewrite. No live database writes, staging, commits, or generated API-doc/evidence changes were performed.

## Checked inventory

| Family / controls | Advertised fields → actual source/predicate | Result |
| --- | --- | --- |
| Inventory flow XNT main SKU input; SKU table search | SKU code/name → complete SKU lookup plus report XNT rows; kind filter composed before client pagination | Contract supported. Legacy `/products` lookup fallback now reads all bounded pages rather than silently stopping at 2,000 SKU. |
| XNT document table search | Document/partner/warehouse → `FlowDocument.document_no/counterpart/warehouse_code` | Supported; filters whole report slice before client pagination. |
| Inbound report table search | Document/supplier → document history number/counterpart plus actor/status | Supported, whole loaded report period. |
| Inbound supplier/status dropdown search | Visible option labels → local normalized label filter | Supported; no separate remote keyword promise. |
| Inbound detail search | SKU/name/serial/item code → active scan entries and SKU summary lines | Supported for fields present in each view; no search over a paginated summary table. |
| Outbound report table search | Document/source request/recipient → document number, request metadata and counterpart | Supported; request metadata loader checks complete pagination rather than silently clipping. |
| Outbound recipient/status dropdown search | Option label → local normalized label predicate | Supported. |
| Stock reconciliation SKU search | SKU code/name → merged flow and reconciliation SKU rows | Supported; before pagination and detail-tab filtering. |
| Stock reconciliation kind/status dropdown searches | Visible option labels → `ReportFilterCombobox` label predicate | Supported. Evidence/detail modals have no independent free-text search. |
| Legacy IO history main quick search | Document/operator/recipient → documentNo/actor/party/movement label | Supported fields; unsupported “request” promise sent to root for precise translation correction. |
| Legacy IO history section search (including alternate presentation input) | Document/SKU/operator/destination → documentNo, party, actor, department, movement/original document and all skuLines | Supported; search acts on section rows before pagination. |
| RPT08 history table search | Document/SKU/operator/partner → complete history source | **Fixed:** previously indexed first displayed SKU only and omitted supplier/party. Now indexes all structured lines, all SKU labels, party, original document and movement. Serial/Lot/Pallet are absent from this report payload; precise wording correction sent to root. |
| RPT08 type/actor dropdown searches | Transaction type/operator labels → local option-label search | Supported; choices originate from authorized report rows. |
| Movement trace main code input | Physical/serial/container/SKU code → authoritative trace-by-code resolver | Explicit code lookup; not a name substring search. No arbitrary internal identifier added. |
| Movement trace source/actor inputs | Source/actor → source text and actor predicate on loaded movement rows | Supported. |
| Movement trace timeline search | SKU/document/actor → productCode, human document code, actor and movement label | Supported. |
| Movement trace ledger search | SKU/document/chain → human movement/original movement numbers, source and actor | Supported semantic chain identifiers. Existing tests explicitly prohibit showing raw correction-chain UUIDs; those IDs were not added to search. |
| Goods trace code input | Human code → `/reports/goods-trace` query `code`, code_type and filters | Search remains server-side; response tracks loaded/total/complete. Entity/details drawers have no additional text search. |
| Import quality baseline main/table inputs | Previously document/SKU/Serial/Lot/Pallet; actual source is SKU import file histories | Unsupported vocabulary sent to root for file-name-only wording. No fabricated serial/lot/pallet values. Source already reads all checked import-history pages. |
| Import/match main context search | Import file or reconciliation/request/document → batchNo/sourceFile plus per-line source_request_no/outbound_no | **Fixed:** source request and linked issue numbers were missing locally; backend keyword builder now also matches normalized/raw source request numbers and canonical request/linked issue codes before pagination/export. |
| Import/match log section search | Batch/file/operator → batchNo/caption/sourceFile/actor | Supported. SKU input searches matching SKU codes on all lines. |
| Operations import-quality batch search | Batch/request → batchNo and per-line source_request_no | **Fixed** request omission. Search is before pagination. |
| Recipient/agency table search | Agency/recipient/document → agency group plus event data | **Fixed:** a group retained only its first receiver for search. Now every event receiver and document number is indexed. |
| Recipient agency/status dropdown searches | Agency/status labels → local option-label predicate | Supported; agency option source now loads all authorized pages. |
| Agency comparison detail search | Recipient/SKU/product name → party code/name and SKU code/name | Supported; option pickers search visible recipient/category/SKU labels. |
| Packing label/event shared keyword | Label/outbound/SKU/recipient → label or event data with related label SKU summary | Supported in both views. Event source already exposes `capped`/events errors rather than claiming complete coverage; this audit did not remove that limit. |
| Packing printer/operator dropdown search | Printer/operator labels → option labels on scoped source | Sources now load all bounded pages, instead of first 100/200 entries. |
| Warranty components main/table searches | Case/serial/SKU/component → normalized report rows | **Fixed upstream:** live warranty report omitted serial_number entirely. It now returns authoritative item serial; existing component predicate immediately searches it. Current serial UI regression passes. |
| Operations warranty case/component searches | Case/SKU/physical code/serial → authorized report identifiers and raw case data | **Fixed:** preserve serial, temporary identifier, and every active physical ITEM code in a separate search-only identifier set; do not choose a preferred tag to display. |
| Warranty status/SKU/defect/assignee dropdowns | Visible labels → local option predicate | Existing controls advertise their actual labels. The unused `reports.warrantyReport.searchPlaceholder` string mentions defect/owner but is not mounted by these report controls; no speculative predicate change was made for an unused string. |
| Export drawers / report details | Export filename/section controls and detail displays | No separate record-search input. RPT08 and report table exporters carry selected row/document identifiers for workbook scoping. Import/match uses the same backend builder for list and export keyword filtering. |

Page wrappers were included: inventory/inbound/outbound, stock reconciliation, traceability, import quality, recipient, packing, warranty, and pending-evidence (both `screen=RPT-08` and legacy presentation).

## Source completeness and authorization

- Added `fetchCompleteReportPage`: reads all pages up to 100, rejects invalid/oversized metadata, inconsistent totals, and transport/authorization errors. It never converts an API failure into a successful empty response.
- Applied it to report users, categories, printers, agencies, defects, SKU import histories, warranty cases, component issue documents and legacy SKU fallback. Complete source cache keys prevent reuse of another screen's cached first-page dataset.
- Warranty report reads now allow up to 100 pages and reject an oversized source instead of quietly stopping after ten pages. Search still occurs before client pagination. Recipient and packing sources retain their existing explicit incomplete/capped behavior.
- Main `/reports/*` period payloads generally omit `per_page` intentionally and are complete period slices. Local table filtering is appropriate there; this differs from filtering just one page of a server-paginated operational list.
- Warranty identifiers come from `item_instances` and ACTIVE `physical_codes` for item IDs on the already authorized warranty-case page. Scope joins remain on warranty cases; no customer PII fields were added or unmasked. The warranty response cache namespace was versioned to avoid old payloads without identifiers.
- Backend import-request matching only examines import-row payloads belonging to the selected import query/period and checks request_no specifically, avoiding arbitrary JSON-field matches.

## Translation requests sent to root

No shared catalogs were edited here. Root owns these precise corrections:

| Key | VI | EN | ZH |
| --- | --- | --- | --- |
| `updatedUi.text_35f2275a1d2b`, `updatedUi.text_b4e6c9c5842a` | Tìm tên tệp nhập… | Search import file name… | 搜索导入文件名… |
| `updatedUi.text_863fd52b84b2` | Tìm chứng từ, SKU, người thao tác, đối tác… | Search document, SKU, operator, partner… | 搜索单据、SKU、操作员、往来单位… |
| `reports.ioHistory.quickSearchPlaceholder` | Mã phiếu / người thao tác / người nhận | Document no. / operator / recipient | 单据编号 / 操作员 / 收件人 |

## Verification and limits

Red tests reproduced: missing import source-request match; absent history rich search helper; incomplete-page source helper; recipient search loses a receiver on a later document; warranty report returns null for actual item serial. Tests were added before their fixes.

Focused green results:

- New source/history/import regressions: 3 files, 4 tests.
- Final changed-function run after loader hardening: 5 files, 6 tests pass (source completeness, real agency/import hooks, all warranty identifiers, full history search, import request search).
- Report agency/import source hook integration plus existing import-match and RPT08 filter/drawer tests: 4 files, 9 tests.
- Recipient report including later-receiver regression: 11 tests pass.
- Warranty current serial search: 1 test passes (10 unrelated tests skipped).
- SQLite backend import keyword tests: 2 tests / 5 assertions pass.
- SQLite backend warranty identifier and existing breakdown tests: 2 tests / 7 assertions pass, including two active tag codes and authoritative serial.
- `php -l` on both changed backend controllers and targeted `git diff --check` pass.

All PHP runs explicitly used `APP_ENV=testing`, `DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`, `DB_URL=''` with `php vendor/phpunit/phpunit/phpunit`. No live DB verification was performed.

Known broader legacy failures were captured, not hidden: the existing `WarrantyComponentsReport.test.tsx` had six assertions for older donut/SKU-filter/card/detail UI that the unchanged current component no longer renders; four existing tests passed. `wwhn-258-report-pii-rbac.test.tsx` had nine failures expecting old inline export-reason/PII surfaces. These were not rewritten during a search audit. That broader attempt finished with 15 failures and 16 passes; one stale dialog wait was very slow. The narrowly relevant serial and identifier checks pass. No further broad reruns, full suite, or typecheck were started by this audit agent; root owns final integration/typecheck.

Remaining limits: source inspection and mocked UI tests do not certify live account datasets, production collation or every browser viewport. Lookup-source errors remain query errors; not every existing dropdown renders a dedicated source-error message. Existing capped report sources are explicitly incomplete rather than globally searchable beyond their bound. New identifier payload fields are additive and do not redesign report exports.
