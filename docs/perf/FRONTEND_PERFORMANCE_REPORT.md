# FRONTEND_PERFORMANCE_REPORT — Hoà Nam WMS (07/09/2026)

> **Mức tin cậy.** Các phát hiện dưới đây do một luồng audit chỉ-đọc lập, có bằng
> chứng file:dòng / câu SQL / EXPLAIN. Vòng phản biện độc lập chỉ chạy được 1/42
> mục trước khi phiên chạm hạn mức, nên **trừ những mục ghi rõ "ĐÃ SỬA" (đã có số
> đo trước/sau), phần còn lại là CHƯA ĐƯỢC XÁC NHẬN ĐỘC LẬP** — hãy đọc như đầu
> mối điều tra, không phải kết luận.

## 1. Mạng & tải dữ liệu — tổng quan

Boot and per-page data loading were traced from source (FE working copy C:/LAM_PHONG_TECH/HoaNam_FE/WMS_Warehouse_Hoa_Nam_FE, BE C:/LAM_PHONG_TECH/HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE). The FE network layer is in good shape structurally: global refetchOnWindowFocus=false (src/app/providers/query-client.ts:52), per-root staleTime/gcTime from cache-policy.ts applied via setQueryDefaults, shared reference keys (`ref`), report pages kept alive (no remount/refetch when returning within staleTime — recorded 0 API calls on return in build/perf/transitions-final-cpu1.json), 4xx never retried, mutations never retried, parallel page crawling capped at 6.

Boot sequences from code: (1) Hard reload while logged in: main.tsx:35 → bootstrap-auth.ts:35 POST /auth/refresh (cookie-based rotation) → refresh `user` seeded into ["auth","me",token] so /auth/me is skipped → ProtectedRoute waits IndexedDB restore (≤1.5 s) → shell fan-out: /notifications/unread-count ∥ /notifications?per_page=5 ∥ POST /broadcasting/auth (Echo) ∥ page queries. Depth = 2 hops, no waterfall beyond that. (2) Login: POST /auth/login → navigate → GET /auth/me (serial, redundant — login already returns the identical payload; FE only seeds on the refresh path) → IDB restore → fan-out. (3) Any anonymous load (/login first visit, or after logout which expires the cookie): the unconditional POST /auth/refresh has no body and no cookie → BE `validate(['refresh_token'=>'required'])` → 422. That is the §7.4 console error: it is produced by `page.goto('/login')` in scripts/perf/verify-keep-alive.mjs:61, not by an F5 after login.

The material network risks at 10k users are concentrated in the report family and the dashboard: whole-period, unpaginated report payloads (document-history 461 KB, movement-trace 2.1–4.3 MB recorded) that are additionally fetched under three different query roots so they are re-downloaded when moving between report pages; four full-table crawls that are not period-filtered and grow without bound (warranty-cases, component-issue-documents, label-print-events, users); a dashboard that polls 4 endpoints every 60 s including the 159 KB XNT ledger while the BE caches that report for 300 s; and a redundant serial /auth/me on every login. Secondary items: N+1 case lookups on the component-issue list, dual-tab prefetch on Inventory/Putaway, whole-table dropdowns (/users per_page=200), a 365-day coverage probe on the heaviest endpoints, and no AbortSignal on debounced searches. Findings are ranked below; anything not backed by a recorded number is marked NOT MEASURED.

## 2. Kiểm kê theo màn hình

### Global policy (applies to every row)
| Item | Value | Evidence |
|---|---|---|
| refetchOnWindowFocus | false globally | src/app/providers/query-client.ts:52 |
| refetchOnReconnect | default (true) — all mounted stale queries refetch after a network blip | not overridden anywhere |
| staleTime by root | list/detail 30 s, inventory 15 s, realtime 30 s, dashboard 60 s, report 5 min, rbac 5 min, master 10 min, reference 30 min, static 12 h | src/shared/cache/cache-policy.ts:65-255 |
| Persist (IndexedDB) | ref/master/report/dashboard/static only; report+dashboard hydrate with dataUpdatedAt=0 → refetch on first mount after F5 (`revalidateOnRestore`) | query-persister.ts:207-228 |
| Remount behaviour | Operational pages remount on every navigation (MainLayout.tsx:204-207 key by pathname); 9 `/reports/*` routes kept alive via `<Activity>` LRU 6 (KeepAliveOutlet, keep-alive.ts:16-26) → 0 requests on return within staleTime (build/perf/transitions-final-cpu1.json rounds 2-3) |
| Cross-module invalidation | `invalidateStockDerived` refetches every mounted query under inventory/dashboard/putaway/all report roots; `invalidateMasterDerived` under ref/mvp-master/catalog-master/warehouse/warehouses/report roots — 23 call sites | src/shared/cache/invalidation.ts:22-42 |
| Retry | queries: 4xx none, 5xx/network 1; mutations 0 | query-client.ts:15-19,55 |
| Chunk preload | hover/focus preload + idle preload of 12 route chunks starting 3 s after shell, 1 per idle tick | src/app/router/route-preload.ts:83-96,128-160 |

Payload class legend: S <20 KB, M 20–200 KB, L 200 KB–1 MB, XL >1 MB; numbers only where recorded (docs/cache/CACHE_POLICY.md:87-89, FE_PERF_AUDIT §6); otherwise NM = NOT MEASURED.

### Boot / shell
| Page or step | API calls on mount | Refetch triggers | Payload | Duplicates / overlap | Over-fetch | Search | Stale handling |
|---|---|---|---|---|---|---|---|
| Cold load, logged in (main.tsx:35 → bootstrap-auth.ts) | POST /auth/refresh (rotates token; `user` seeded into ["auth","me",token] → no /auth/me) | every full page load; single-flight per tab | S | none | — | — | 401 interceptor refresh is single-flight (axios.ts:65-89) |
| Cold load, anonymous (/login, or after logout) | POST /auth/refresh → **422** (no cookie, `required` validation) | every anonymous load | S | wasted request | yes (see FE-NETWORK-02) | — | 422 treated as invalid session → clear hint |
| Login (use-login.ts:27-51) | POST /auth/login → **GET /auth/me (serial, redundant)** → IDB restore → fan-out | per login | S | login.user == me payload (AuthController.php:433-439 vs 300-304) | yes (FE-NETWORK-01) | — | — |
| MainLayout / AppTopbar (every authenticated route) | GET /notifications/unread-count, GET /notifications?per_page=5, POST /broadcasting/auth (if VITE_REVERB_APP_KEY) | unread/list: 30 s stale, invalidated on every Echo `.notification.created` and after mark-read; socket re-auths on reconnect | S | NotificationBell.tsx is an orphan (never rendered) — no double list fetch | list of 5 for a badge popover is fine | — | — |
| ProtectedRoute gate | none extra; waits bootstrap → me → IDB (≤1.5 s timeout) | kiosk mode retries bootstrap/me every 5 s on error (ProtectedRoute.tsx:19-34,55-60) | — | — | — | — | — |

### Operational pages
| Route | API calls on mount | Refetch triggers | Payload | Duplicates | Over-fetch | Search / debounce | Stale handling |
|---|---|---|---|---|---|---|---|
| /dashboard | GET /reports/dashboard-overview (widened range), /reports/inventory-xnt-enhanced (period, default last7), /reports/inventory-xnt-daily (7 d), /reports/dashboard-quick — recorded api=4 | **refetchInterval 60 s while visible & online** (overview-data.ts:178,191; DashboardPage.tsx:147-152); 60 s stale; revalidateOnRestore | overview/quick S (5–20 KB); XNT M (159 KB recorded) | XNT also fetched under `rpt-ops`/`rpt-xnt-01` on report pages with other ranges | client computes equation/top-5/in-stock from full XNT lines (overview-data.ts:391-460) | — | none needed |
| /inbound | GET /inbound-documents (page, per_page) — api=1 | 30 s stale; remount on nav; invalidate on inbound mutations | S | — | modals: detail + scan-entries + active warehouses on open only | 250 ms local debounce (InboundPage.tsx:51,119-126); no AbortSignal | no placeholderData → table blanks on page/search change |
| /outbound | GET /outbound-documents — api=1 | 30 s | S | — | detail modal: detail + packing-labels?outbound_document_id + printers + availability (AlignedOutboundDetailModal.tsx:202-231) — fixed per FE doc §4b | 250 ms debounce | no placeholderData |
| /inventory | GET /inventory/balances **and** GET /stock-movements both on mount (InventoryPage.tsx:183-197) — api=2 | 15 s stale (inventory class); remount | S | — | hidden tab fetched (tabs at :601-754, no `enabled`) | 250 ms debounce; no signal | no placeholderData |
| /warranty | GET /warranty-cases (list), GET /defect-catalogs?status=ACTIVE&per_page=100 — api=2 | 30 s | S | defects key shared with modals (dedup) | — | 250 ms debounce | no placeholderData |
| /warranty/component-issues | GET /component-issue-documents, GET /warehouses?per_page=200 (ref), **N× GET /warranty-cases/{id}** (useQueries per row, ≤perPage) | 30 s | S | — | N+1 (FE-NETWORK-06) | 250 ms debounce | — |
| /reverse | GET /reversal-documents | 30 s | S | — | — | 250 ms debounce | — |
| /putaway | GET putaway tasks, history, trays all on mount (MvpPutawayPage.tsx:208-219) | 30 s; invalidateStockDerived after each mutation | S/NM | — | history tab hidden until selected (:752,801) | 250 ms | — |
| /putaway/trays | GET trays | 30 s | NM | — | — | — | — |
| /scan | GET /warehouses?status=ACTIVE (ref) + manual fetch (no React Query) of physical codes or batches+events per active tab (PhysicalCodesPage.tsx:243-300) | on every tab/page/perPage change; no cache | S | — | — | client-side filter only | manual `cancelled` flag; no abort |
| /master-data/skus | GET /skus (list) + product catalogs — recorded api=6 (first visit incl. shared refs) | 10 min master stale | S | — | "SKU chờ điền thông tin" mode sets per_page=PENDING_INFO_SCAN_LIMIT (ApiMasterScreens.tsx:399-408) | keyword typed straight into key (no debounce found in ApiMasterScreens) | — |
| /master-data/agencies, /defects, /catalog, /warehouse, /pv-products | 1 list + 1–3 option lists (brand/industries/tags per_page 100) | master/list stale | S | warehouse directory shared (`ref`) | pv-products loads industries(100)+tags(100)+profiles+skus(20) | — | — |
| /system/users | GET /users, /roles?per_page=100, /departments?status=ACTIVE, /warehouses (ref), /permissions?per_page=200 (IamUserScreen.tsx:348-359) | `iam` = list 30 s | S | /system/roles tab uses /permissions?per_page=100 and /users?per_page=100 → different keys, refetched on tab switch | whole roles/permissions tables for pickers | keyword in key, no debounce seen | — |
| /system/roles | /roles (page), /permissions?per_page=100, /users?per_page=100 | 30 s | S | see above | — | — | — |
| /audit-logs | GET /audit-logs (filters), **GET /users?per_page=200** for a dropdown (AuditLogsPage.tsx:117) | 30 s | S | /users also fetched as `rpt-ops user-directory` (per_page 200) on 4 report pages — different keys | whole users table for a filter; BE lists /users as uncached (PERF_AUDIT §4 D) | 250 ms debounce | — |
| /notifications | GET /notifications?page&per_page | 30 s; Echo invalidation | S | — | — | — | — |
| /profile | GET /audit-logs/me?per_page=20 | volatile | S | — | — | — | — |
| /pv (public) | GET /pv/products (page), /pv/industries, /pv/recommendations, **GET /pv/products?per_page=200** (taxonomy snapshot, PvCatalogPage.tsx:71-78) | `pv` list 30 s | S/NM | two product-list calls per view | 200-row list only to derive dropdown options | keyword via URL param | — |
| /pv/products/:skuId | /pv/products/by-code (if code), /pv/products/{id}, /pv/recommendations | 30 s | S | — | — | — | — |
| /pv-admin | 4 admin lists (industries, tags, rules, profiles) | 30 s | S | — | — | — | — |

### Report pages (all kept alive; all report queries use `placeholderData: previous`; staleTime 5 min = BE TTL 300 s)
| Route | API calls on first mount | Payload | Duplicates across report roots | Over-fetch | Search |
|---|---|---|---|---|---|
| /reports/inventory-flow and /reports/outbound-flow (same hooks) | /reports/inventory-xnt-enhanced, /reports/inventory-ledger (no per_page), /reports/document-history?doc_type=all, /reversal-documents?per_page=200, /skus/lookup, /warehouses (ref) (+coverage probe when period empty) — recorded api=8 first visit | XNT M (159 KB), document-history L (461 KB), ledger NM | ledger duplicated under `rpt-io-01`; document-history under `rpt-mov-01`/`rpt-io-01`; reversal-documents under `rpt-mov-01` | whole period, client pagination by design | local, startTransition |
| /reports/stock-reconcile | /reports/inventory-balance or /reports/inventory-reconciliation (+ catalog/warehouses/categories shared) — api=1 after refs cached; SKU drill-down = **/reports/movement-trace for 90 days, unfiltered, filtered client-side to one SKU** (stock-reconcile-api.ts:293,304-311) | balance NM; drill XL (movement-trace 4.3 MB at 5,956 rows) | — | drill-down over-fetch (BE accepts product_id) | local |
| /reports/traceability | /reports/movement-trace (whole period), /reports/document-history?doc_type=all, /reversal-documents?per_page=200, /skus/lookup — api=3 | movement-trace XL (2.1–4.3 MB recorded), document-history L | document-history + reversal-documents re-fetched under `rpt-mov-01` keys even if `rpt-ops` copies exist | KPI/timeline computed client-side from the full ledger (known residual, FE doc §6) | local |
| /reports/import-quality | /reports/import-match, /sku-import-reports?per_page=100, /skus/lookup, /users?per_page=200 — api=3 | NM | users directory duplicated with /audit-logs `iam` key | — | local |
| /reports/packing-label | /reports/label-log (period), **/label-print-events all pages (≤20×100, no date param)**, /printer-configs?per_page=100, /users?per_page=200 — api=3 today | NM (grows with print history) | — | unbounded crawl (FE-NETWORK-04) | local |
| /reports/warranty | /reports/warranty-defects (≤10×100, period), **/warranty-cases all pages (≤10×100, no period)**, **/component-issue-documents all pages (≤10×100, no period)**, /skus/lookup, /users?per_page=200, per-case events on drill — api=5 today | NM | — | unbounded crawls | local |
| /reports/recipient | /reports/outbound-by-recipient (≤10×100, period), /reports/document-history?doc_type=outbound, /reversal-documents?per_page=200, /agencies?status=ACTIVE&per_page=200, /skus/lookup, /users?per_page=200 — api=7 recorded; comparison tab adds a double-window crawl ≤30 pages | document-history L | document-history/reversal shared with other pages only when period+docType match | — | local |
| /reports/pending-evidence (IoHistoryReport) | /reports/document-history?doc_type&status=..., /reports/inventory-ledger, /reversal-documents (conditional), /users?per_page=200 — api=2 recorded | L | ledger duplicated with `rpt-xnt-01`; document-history has an extra `status` param so not shareable as-is | — | local |
| Coverage probe (any report, when selected period has 0/sparse data) | same endpoint with from/to = last 365 days; movement-trace/ledger/document-history unpaginated, warranty-defects/outbound-by-recipient ≤10×100 (report-coverage.ts:36,96-130; report-probes.ts) | potentially XL | cached 5 min per key | yes (FE-NETWORK-08) | — |

## 3. Dựng hình, gói JS & Web Vitals — tổng quan

Frontend rendering/bundle lens, read-only, against the existing production build in dist/ (built 2026-09-07 01:15, sourceSha local-uncommitted). Route-level code splitting is real (38 lazy routes; ApexCharts 888 KB, xlsx 282 KB, vn-wards 301 KB and the EN dictionary 198 KB are all dynamic-only) and the earlier audit's fixes (60-row render window, keep-alive, lazy charts) are in place. What is NOT in good shape for a 10k-user target: (1) the entry graph every user downloads before any route renders is 32 files / 1,236 KB raw / 400 KB gz plus a 185 KB render-blocking CSS of which 82% (28 KB of 34 KB gz) is a 3,586-glyph icon sheet backing 56 used icons, and a 386 KB icon woff2 that is fetched on the login page; (2) roughly 19% of the entry gz is antd runtime (ConfigProvider/App/cssinjs, ~217 KB raw) mounted at the root although only 8 source files use antd, and ~80-95 KB raw of pusher-js + laravel-echo ride in the entry graph through a static import in auth.store.ts; (3) every F5 on an authenticated page is a five-hop serial chain (entry graph -> POST /auth/refresh -> IndexedDB restore gate -> MainLayout chunk -> page chunk -> 4-7 API calls) because the lazy shell/page chunks are neither modulepreloaded nor started in parallel with the refresh, and the login page itself is three serial rounds with its LCP image discovered only after the LoginPage chunk executes; (4) the dashboard polls four of the heaviest report endpoints every 60 s per open tab, which at scale is a continuous background load the BE has to absorb regardless of user activity; (5) one Reverb WebSocket + one channel-auth POST per authenticated tab against a single reverb:start process; (6) IoHistoryReport (/reports/pending-evidence) still renders its full unpaginated document set into a hand-built table with no render window, unlike every sibling report; (7) there is no field Web Vitals reporting at all, so LCP/INP/CLS at 10k users are NOT MEASURED. Memory-leak sweep: all 13 addEventListener sites, 2 intervals, 3 IntersectionObservers, 2 ResizeObservers and the Echo subscription have matching cleanup; the only deliberate retention is KeepAliveOutlet holding up to 6 hidden report pages (bounded, dropped on logout). Compression/immutable caching of static assets is outside both repos (already known) and remains unverified for the production host.

## A. Performance budget — current values from `dist/` (raw bytes / gzip bytes measured with `gzip -c`)

| Budget item | Current (login `/login`) | Current (`/dashboard` after F5) | Proposed ceiling for 10k users | Evidence |
|---|---|---|---|---|
| JS before any route renders (entry static graph) | 32 files, 1,236,465 / 399,514 gz | same | ≤ 300 KB gz, ≤ 15 files | closure of `dist/index.html` modulepreload list (32 links) |
| JS for the route (entry + route graph) | 49 files, 1,430,572 / 464,657 gz | 58 files, 1,493,716 / 484,213 gz | ≤ 400 KB gz per route | closure script over static `import` headers of chunks |
| Render-blocking CSS | 1 file `index-*.css` 184,908 / 34,306 gz (icon sheet 154,778 / 28,052 gz = 82%) | 3 files 246,421 / 46,222 gz (`DashboardPage-*.css` 46,910, `MainLayout-*.css` 14,603) | ≤ 40 KB gz initial | `wc -c`, `gzip -c` on `node_modules/@flaticon/flaticon-uicons/css/regular/rounded.css` |
| Web fonts | text: 0 B (system stack, `--wms-font-family` in `src/shared/ui/tokens/css-vars.css:11`); icon woff2 385,636 B (fetched on login: password eye icon `UiFormText.tsx:110`) | same | ≤ 60 KB (subset) | `dist/assets/uicons-regular-rounded-*.woff2`; also emitted: woff 521,880, eot 1,092,772 |
| Images on first paint | login illustration PNG 53,223 B (desktop ≥ lg only, `AuthShell.tsx:158`); mask PNG 1,284 B inlined | none above the fold (hand-drawn SVG charts) | ≤ 60 KB | `dist/assets/auth-v2-login-illustration-light-*.png` |
| Total bytes over the wire (approx.) | ≈ 938 KB compressed (2.05 MB raw), ≈ 52 requests | ≈ 0.95 MB compressed + API payloads | ≤ 500 KB | matches FE audit §6 "52 file / ~2 MB" |
| HTTP API calls before first meaningful paint | 1: `POST /auth/refresh` (always, even logged out — `bootstrap-auth.ts:33`) + SW register | `POST /auth/refresh` (seeds `/auth/me`, `bootstrap-auth.ts:47-51`), then 4 dashboard GETs (`overview-data.ts:222-261`), `GET /notifications?per_page=5` (`AppTopbar.tsx:161`), `POST /api/v1/broadcasting/auth` + 1 WebSocket (`echo.ts:32-59`) | ≤ 3 serial hops | see finding FE-RENDER-01 |
| Serial network rounds before content | 3 (entry graph → LoginPage graph of 17 chunks → PNG + icon font) | 5 (entry → refresh → IDB restore ≤1.5 s cap → MainLayout chunk → DashboardPage chunk → data) | ≤ 3 | `router/index.tsx:18-20,44-48,238-243`; `ProtectedRoute.tsx:62,109,114,116` |
| Field Web Vitals (LCP/INP/CLS p75) | NOT MEASURED — no RUM | NOT MEASURED | LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 | no `web-vitals`, `performance-monitor.ts` unreferenced |

## B. Entry chunk composition (loaded on every page, `dist/index.html` modulepreload set)

| Chunk | Raw | Gz | What it is | Needed on login? |
|---|---|---|---|---|
| `routes-JjAtcDvK.js` | 237,357 | 65,491 | ROUTES + cache policy + **full VI dictionary `MESSAGES_VI`** (est. ~226 KB of it, by ratio of `messages.en.ts` 241,503 B → `messages.en-*.js` 198,267 B; `messages.ts` is 275,589 B) | partially (auth strings only) |
| `vendor-react-DmsXvmXh.js` | 181,724 | 56,530 | react, react-dom, react-router-dom (`vite.config.ts:58-64`) | yes |
| `axios-By3HSJZM.js` | 142,279 | 41,689 | axios **+ pusher-js + laravel-echo** (markers: 100×`pusher`, 16×`Pusher`, 10×`WebSocket`; `pusher.min.js` 60,621 B, `echo.js` 22,381 B, `axios.min.js` 45,585 B) | axios only |
| `Box-CTINM4WO.js` | 104,000 | 36,637 | MUI system + emotion + design tokens | yes |
| `index-BUYY3orM.js` | 92,047 | 30,690 | app entry, providers, router, zustand stores | yes |
| `ContextIsolator-pgcfM9K5.js` | 90,919 | 31,451 | antd core (`ant-`, `rc-`, `anticon`) | **no** |
| `chunk-4ZMWKKQ3-CmBQvOd1.js` | 90,688 | 29,654 | unnamed shared chunk (router hooks + app glue) | yes |
| `vendor-data-DpHAv_ed.js` | 84,821 | 28,868 | @tanstack/react-query (+ shared runtime) | yes |
| `compact-item-DKLv6e8i.js` | 75,326 | 28,810 | antd + `@ant-design/cssinjs` (7 markers) | **no** |
| `useModal-BmzB_vM1.js` | 40,414 | 13,183 | antd `App`/modal | **no** |
| `Button-BZvTXUgb.js` / `Button-DjLZn_y6.js` | 23,369 / 12,033 | 7,548 / 3,497 | MUI ButtonBase / Button | yes |
| `config-provider-hJncvHxa.js`, `zoom-peffDNgI.js` | 7,706 / 2,815 | 3,201 / 738 | antd ConfigProvider, motion | **no** |
| 18 small chunks (< 6 KB each) | ~50 KB | ~22 KB | auth.service, http, access, theme.store, UiText… | yes |

antd subtotal on the entry graph: **217,180 B raw / 77,383 B gz (19% of entry gz)**; antd is imported by only 8 source files: `UiDatePicker.tsx`, `UiFormDate.tsx`, `ScanInput.tsx`, `CameraScanModal.tsx`, `FilterBar.tsx`, `PageHeader.tsx`, `antd-adapter.ts`, `AppThemeProvider.tsx` (vs 60 files importing `@mui/material`).

## C. Largest route / lazy chunks (raw bytes)

| Chunk | Raw | Gz | Loader | Notes |
|---|---|---|---|---|
| `react-apexcharts.esm-*.js` | 888,292 | 251,825 | dynamic only (`LazyApexChart.tsx:27`) | IntersectionObserver-gated, animations off; not used by dashboard (hand SVG `OverviewFlowChart.tsx:217`) |
| `vn-wards-*.js` | 301,172 | 47,989 | dynamic only (`vn-address.api.ts:92`) | good |
| `vendor-xlsx-*.js` | 282,251 | 92,539 | **static** importer: `AuditLogsPage-*.js`; reports use `report-export` chunk | AuditLogs downloads xlsx on entry to page |
| `FoundationCatalogPage-*.js` | 206,292 | 47,125 | never loaded in prod (route DEV-gated `router/index.tsx:443-461`, but `lazy()` at :184 is unconditional) | dist bloat only |
| `messages.en-*.js` | 198,267 | 58,963 | dynamic (`english-messages.ts`) | good |
| `RecipientReportPage-*.js` | 104,591 | 26,536 | route | largest real page chunk |
| `JsBarcode-*.js` (jsbarcode + qrcode) | 87,604 | 19,506 | **static** importers: `OutboundPage-*.js`, `WarrantyPage-*.js` (via `PackingLabelPreviewDialog.tsx:2-3`, `WarrantyReturnLabelDialog.tsx:2-3`) | loaded on every Outbound/Warranty visit, used only when a label preview opens |
| `WarrantyPage` 67,951 · `MainLayout` 62,129 · `OutboundPage` 60,138 · `MvpMasterScreens` 58,253 · `DashboardPage` 56,611 (+46,910 CSS) · `StockReconcileReportPage` 44,514 (+27,020 CSS) · `InventoryFlowXntReport` 38,736 (+38,030 CSS) · `PendingEvidenceReportPage` 31,050 (+23,874 CSS) | | | route | per-page CSS ports of mockups (`dashboard-overview.css` 65,155 B source) |

Duplicated packages (yarn.lock): only `react-is` ×4 (16.13.1 / 17.0.2 / 18.3.1 / 19.2.8, tiny). No duplicate react, emotion, dayjs, zod, axios. The material duplication is architectural: **two UI frameworks (MUI 9 + antd 6) on every page**.

## D. Fonts and icons

| Item | Value |
|---|---|
| Text font | `"Public Sans", system-ui, …` declared (`css-vars.css:11-13`) but Public Sans is never loaded → system font; index.html comment says intentional. 0 B, no FOUT. |
| Icon strategy | CSS icon font `@flaticon/flaticon-uicons/css/regular/rounded.css` imported globally (`main.tsx:9`): 154,778 B CSS, 3,586 `.fi-rr-*` rules, `font-display: swap`, no `<link rel=preload>`; distinct slugs used in `src/`: 56 (icon-family.ts comment claims 113). Nav icons are inline SVG paths (`vuexy-nav-icon-paths.ts`) — the better pattern already exists. |
| Font files emitted | woff2 385,636 · woff 521,880 · eot 1,092,772 (eot/woff dead weight for evergreen browsers) |

## E. Boot / hydration work on the main thread (`src/main.tsx`)

| Step | Where | Cost class |
|---|---|---|
| `bootstrapAuth()` — zustand cookie rehydrate (sync `js-cookie`), then `POST /auth/refresh`; seeds `["auth","me",token]` so `/auth/me` is skipped | `main.tsx:35`, `bootstrap-auth.ts:24-58` | 1 network RTT, single-flight |
| `registerPwa()` (prod only) | `register-pwa.ts:10-20` | async, off critical path |
| `initializeLanguage()` / `initializeTheme()` — localStorage reads, `matchMedia` listener | `language.store.ts:68-72`, `theme.store.ts:86-94` | µs |
| Providers: `QueryClientProvider` → `MuiThemeProvider` (prebuilt `MUI_THEMES`, 18 styleOverrides) → antd `ConfigProvider` + `App` with `viVN` locale → `ErrorBoundary` → sonner `Toaster` → `App key={language}` → `RouterProvider` | `AppProviders.tsx:19-38`, `AppThemeProvider.tsx:14-52` | antd cssinjs style injection at boot on every page |
| `ProtectedRoute` gates: `isBootstrapped` → `isAuthenticated` → profile → **IndexedDB restore** (`RESTORE_TIMEOUT_MS` 1,500 ms `query-persister.ts:59`; `openDb` timeout 3,000 ms `idb.ts:56`; hydrate ≤ 120 queries / ≤ 4 MB) | `ProtectedRoute.tsx:62-116` | blocks first data screen; parallel with nothing after refresh |
| `MainLayout` mount: `useMe()`, `useNotificationSocket()` (WS + channel auth), `preloadCommonRoutesWhenIdle()` (rIC, 3 s delay, 12 report/ops chunks one per idle tick) | `MainLayout.tsx:93-111`, `route-preload.ts:128-160` | good |
| No `CssBaseline`, no custom emotion cache, `StrictMode` (no prod cost), no `preconnect`/`preload` hints in `index.html` | | |

## F. LCP element by markup

| Page | Viewport | LCP candidate | Discoverability |
|---|---|---|---|
| `/login` | ≥ lg (1200px) | `<img>` illustration 945×1069 rendered ≤ 560 px tall (`AuthIllustration.tsx:33-47`) | URL lives inside `LoginPage` chunk graph → requested only after entry graph + LoginPage chunk execute (3rd network round); no `fetchpriority`, no `<link rel=preload>`, no `width/height` attrs |
| `/login` | < lg | `<h1>` 26 px "Đăng nhập" (`AuthShell.tsx:210-223`), system font | paints when LoginPage chunk executes |
| `/dashboard` | any | text blocks: `.page-header h1/p` paint after `Loading` gate; largest content = KPI grid (`OverviewKpiGrid.tsx`, skeleton until `overview` resolves) / section text; inline `<svg>` charts do not count for LCP | LCP time ≥ refresh + IDB + MainLayout chunk + DashboardPage chunk + first API |

## G. Memory-leak sweep (non-test source)

| Mechanism | Sites | Cleanup |
|---|---|---|
| `addEventListener` | 13 files (KeepAliveOutlet, AppTopbar, OverviewFilters, DashboardPage, 2× report overlays, IoHistoryReport, useReducedMotion, useOverlayBackDismiss, PwaStatus, register-pwa, theme.store, print-html) | all paired with `removeEventListener`/unsubscribe; `print-html.ts:100-101,283` use `{ once: true }` + timed iframe cleanup (`:293`); `register-pwa.ts` listeners are app-lifetime by design |
| `setInterval` | `ProtectedRoute.tsx:29` (kiosk retry), `ForgotPasswordPage.tsx:58` (OTP countdown) | both cleared in effect cleanup |
| `IntersectionObserver` | `use-lazy-reveal.ts:47`, `LazyApexChart.tsx:44`, `useRenderWindow.ts:96` | all `disconnect()` |
| `ResizeObserver` | `IoHistoryReport.tsx:330`, `use-chart-width.ts:29` | both `disconnect()` |
| Echo/WebSocket | `useNotificationSocket.ts:21-47` | `echo.leave()` on unmount, `disconnectEcho()` on logout (`auth.store.ts:134`); socket persists for the session (intended) |
| Retained by design | `KeepAliveOutlet.tsx:57` MAX_KEPT = 6 hidden report pages (each "3–10k DOM nodes" per FE audit §7.1) | dropped on logout / language change (`App.tsx key={language}`) |

## H. Tables / lists vs row windowing

| Component | Rows source | Windowed / paginated |
|---|---|---|
| `ResponsiveDataTable.tsx:162` | any | `useRenderWindow` chunk 60, threshold 150 |
| `InventoryFlowXntReport.tsx`, `StockReconcileReport.tsx`, `WarrantyComponentsReport.tsx`, `MovementTraceReport.tsx` | full filtered set | `WindowedRowsFooter`/`WindowedMore` (7 / 9 / 5 / 4 usages) |
| **`IoHistoryReport.tsx:1219`** (`/reports/pending-evidence`, RPT-08 port) | full `document-history` set, deliberately no `per_page` (`io-history-api.ts:152`) | **none** — every filtered row is a `<tr>` |
| `IamUserScreen.tsx`, `ApiMasterScreens.tsx`, operational pages | server-paginated | n/a |
| Dashboard `Overview*` | bounded by construction (5 KPI, 7-day rows, top-5) | n/a |
| `PackingLabelPreviewDialog.tsx` | labels of one document | bounded |

## I. Polling / push

| Source | Interval | Scope |
|---|---|---|
| Dashboard 4 queries (`overview-data.ts:178,191`): `reports/dashboard-overview`, `reports/inventory-xnt-enhanced`, xnt-daily, dashboard KPI | `refetchInterval` 60,000 ms per open tab (paused when tab hidden — RQ default) | every user on `/dashboard` |
| Reverb private channel `user.{id}` (`echo.ts:50-59`, single `reverb:start` in `docker-compose.yml:113-119`) | persistent WS + `POST /api/v1/broadcasting/auth` per subscribe | every authenticated tab |
| Notifications bell `GET /notifications?per_page=5` (`AppTopbar.tsx:161`) | on mount, invalidated by WS event | every authenticated tab |

## 4. Ngân sách gói (đo trên `dist/` của bản build production)

| Hạng mục | Giá trị đo được | Ghi chú |
|---|---|---|
| Đồ thị tải của trang đầu (entry graph trong `index.html`) | **1.453 KB thô** (33 file) | gồm cả antd runtime (`compact-item` 76 KB, `config-provider`), MUI `Box` 104 KB, `vendor-react` 180 KB, `axios` 140 KB, CSS 184 KB |
| Chunk lớn nhất toàn dự án | `react-apexcharts` 868 KB | **đã tách khỏi đường tải** (LazyApexChart, đợt 1) |
| `vn-wards` (danh mục phường/xã) | 296 KB | tải theo yêu cầu |
| `vendor-xlsx` | 276 KB | chỉ dùng ở xuất Excel |
| `messages.en` | 196 KB | tách chunk riêng |

## 4b. Core Web Vitals — SỐ ĐO THẬT (07/09/2026)

Đo bằng `scripts/perf/measure-web-vitals.mjs` (Chromium/Playwright, bản build
production tại `localhost:5199`, backend thật, 1440×900). LCP/CLS/TBT đọc từ
`PerformanceObserver` khi TẢI LẠI trang; INP đo trên THAO TÁC THẬT bằng entry
`event` + `first-input` với `durationThreshold: 0` — đúng cách Chrome tính INP,
không phải ước lượng bằng TBT như Lighthouse.

### Tải lại trang (CPU x1)

| Trang | Cache | TTFB | FCP | **LCP** | **CLS** | TBT | Request | KB | DOM | Phần tử LCP |
|---|---|---|---|---|---|---|---|---|---|---|
| /dashboard | nguội | 6 ms | 204 ms | **600 ms** | 0,000 | 0 ms | 70 | 383 | 1.041 | `span.card-subtitle` |
| /dashboard | ấm | 5 ms | 168 ms | **544 ms** | 0,000 | 0 ms | 70 | 383 | 1.041 | như trên |
| /inventory | nguội | 5 ms | 184 ms | **564 ms** | 0,000 | 13 ms | 106 | 393 | 932 | `h1` "Tra cứu tồn & đối soát" |
| /inventory | ấm | 4 ms | 132 ms | **476 ms** | 0,000 | 0 ms | 106 | 393 | 932 | như trên |
| /inbound | nguội | 4 ms | 156 ms | **472 ms** | 0,000 | 0 ms | 113 | 394 | 741 | `h1` "Danh sách phiếu nhập" |
| /outbound | nguội | 9 ms | 152 ms | **488 ms** | 0,000 | 0 ms | 114 | 395 | 782 | `h1` "Danh sách phiếu xuất" |
| /warranty | nguội | 4 ms | 172 ms | **504 ms** | 0,000 | 0 ms | 127 | 394 | 831 | `h1` "Danh sách bảo hành" |
| /reports/inventory-flow | nguội | 4 ms | 128 ms | **632 ms** | 0,003 | 0 ms | 92 | 388 | 3.948 | `div.report-snapshot` |
| /login | nguội | 4 ms | 432 ms | **432 ms** | 0,000 | 0 ms | 159 | 823 | 137 | `img` (logo) |

**Kết quả so với ngưỡng:** LCP **432–640 ms** (ngưỡng ≤ 1,5 s) — **ĐẠT, dư biên
rộng**. CLS **0,000–0,003** (ngưỡng ≤ 0,1) — **ĐẠT**. TBT 0–13 ms.

### Tương tác thật (INP, CPU x1)

| Thao tác | **INP** | Ghi chú |
|---|---|---|
| Bấm tab trong báo cáo Tồn kho & đối soát | **64 ms** | 7 tương tác, chậm nhất `pointerdown` |
| Gõ vào ô lọc của báo cáo Truy vết | **72 ms** | 14 tương tác |
| Mở modal chi tiết ở Tồn kho | **72 ms** | 4 tương tác |
| Mở menu điều hướng và bấm mục | **24 ms** | 7 tương tác |
| Chuyển trang (pagination) ở Nhập kho | **CHƯA ĐO** | nút phân trang không khớp bộ chọn của script — lỗi của bộ đo, không phải của trang |

**INP 24–72 ms** so với ngưỡng ≤ 100 ms — **ĐẠT**. Đối chiếu: trước đợt 1, thao
tác gõ một phím ở màn Truy vết là **14.666 ms**.

### Máy yếu (CPU chậm 4×) — đây mới là bài kiểm thật

Yêu cầu §42 của đề bài: một trang đạt trên máy dev mạnh nhưng hỏng trên thiết bị
phổ thông vẫn là lỗi hiệu năng. Cùng bộ đo, thêm `CPU=4`:

| Trang | Cache | FCP | **LCP** | CLS | TBT | Đạt LCP ≤ 1,5 s? |
|---|---|---|---|---|---|---|
| /login | nguội | 1.320 ms | **1.320 ms** | 0,000 | 126 ms | ĐẠT |
| /inventory | nguội / ấm | 596 / 448 ms | **1.232 / 1.072 ms** | 0,000 | 642 / 467 ms | ĐẠT |
| /outbound | nguội / ấm | 580 / 484 ms | **1.168 / 1.008 ms** | 0,000 | 299 / 223 ms | ĐẠT |
| /warranty | nguội / ấm | 616 / 656 ms | **1.184 / 1.300 ms** | 0,000 | 683 / 481 ms | ĐẠT |
| /inbound | nguội / ấm | 628 / 584 ms | **1.260 / 1.432 ms** | 0,000 | 391 / 399 ms | ĐẠT (sát) |
| **/reports/inventory-flow** | nguội / ấm | 552 / 548 ms | **1.844 / 1.596 ms** | 0,000 | 694 / 499 ms | **KHÔNG ĐẠT** |
| **/dashboard** | nguội / ấm | 928 / 524 ms | **1.972 / 1.800 ms** | 0,000 | 275 / 187 ms | **KHÔNG ĐẠT** |

| Thao tác | **INP (CPU x4)** | Đạt ≤ 100 ms? |
|---|---|---|
| Mở menu điều hướng và bấm mục | **88 ms** | ĐẠT |
| Bấm tab trong báo cáo Tồn kho & đối soát | **208 ms** | **KHÔNG ĐẠT** |
| Mở modal chi tiết ở Tồn kho | **320 ms** | **KHÔNG ĐẠT** |
| Gõ vào ô lọc của báo cáo Truy vết | **360 ms** | **KHÔNG ĐẠT** |

**Kết luận thẳng:** trên máy văn phòng phổ thông (CPU chậm 4× so với máy đo),
**LCP hỏng ở 2/7 trang** và **INP hỏng ở 3/4 thao tác**. Hai trang hỏng LCP đúng
là hai trang nặng nhất: dashboard (nhiều thẻ KPI + biểu đồ) và báo cáo
Nhập–Xuất–Tồn (3.948 node DOM). CLS đạt tuyệt đối ở mọi nơi (0,000).

Nguyên nhân còn lại là **thời gian CPU dựng hình**, không phải mạng: TBT
187–694 ms trên các trang này trong khi TTFB chỉ 3–10 ms. Hướng xử lý tiếp
(chưa làm, xếp theo lợi ích/rủi ro): FE-RENDER-03 (cắt bộ icon font 3.586 glyph
xuống ~56 icon dùng thật — bỏ được ~155 KB CSS chặn render + 386 KB woff2),
FE-RENDER-02 (gỡ runtime antd khỏi đồ thị tải đầu), FE-RENDER-08 (tách từ điển
tiếng Việt khỏi chunk vào).

### Ba điều phải nói rõ khi đọc bảng trên

1. **TTFB 4–9 ms không phải TTFB production.** FE được phục vụ bởi máy chủ tĩnh
   ngay trên máy đo, không qua mạng, không qua CDN. Trên hạ tầng thật con số này
   sẽ là hàng chục tới hàng trăm ms và **cộng thẳng vào LCP**. Dư biên hiện tại
   (LCP ~600 ms so với ngưỡng 1.500 ms) đủ chỗ cho ~900 ms TTFB, nhưng phải đo lại
   trên môi trường thật mới kết luận được.
2. **Trang /login tải 159 request / 823 KB** — nặng nhất trong các trang, dù DOM
   chỉ 137 node. Phần lớn là bộ icon font đầy đủ (xem FE-RENDER-03: CSS 155 KB với
   3.586 quy tắc + woff2 386 KB cho ~56 icon thực dùng) và đồ thị tải chung.
   LCP vẫn đạt vì tải cục bộ; trên mạng thật đây là rủi ro LCP lớn nhất còn lại.
3. **Không có đối chứng "trước"** cho LCP/CLS: bộ đo này mới viết trong đợt 07/09.
   Chỉ INP có số trước (14.666 ms → 24–72 ms).

## 5. Phát hiện

| ID | Mức | Thành phần | Vấn đề | Trạng thái 07/09 |
|---|---|---|---|---|
| FE-NETWORK-01 | P1 | FE auth boot (src/modules/auth/hooks/use-login | Login path issues a redundant serial GET /auth/me although POST /auth/login already returns the identical profile payload | chưa xử lý |
| FE-NETWORK-02 | P1 | FE src/main.tsx + src/app/bootstrap-auth.ts +  | Unconditional POST /auth/refresh on every page load: guaranteed 422 on anonymous loads (root cause of FE docs §7.4), and one DB-write token rotation + synchronous audit insert per F5 with no cross-tab coordination | chưa xử lý |
| FE-NETWORK-03 | P1 | src/modules/reports/operations/report-data.ts, | Whole-period report ledgers (document-history 461 KB, inventory-ledger, reversal-documents, movement-trace 2.1–4.3 MB) are fetched unpaginated and additionally under three different query roots, so moving between report pages re-downloads the same payloads | chưa xử lý |
| FE-NETWORK-04 | P1 | src/modules/reports/operations/report-data.ts, | Four report inputs crawl entire tables without a period filter (warranty-cases, component-issue-documents, label-print-events, users) — request count and bytes grow with history and then silently truncate at the page cap | chưa xử lý |
| FE-NETWORK-05 | P1 | src/modules/dashboard/overview/overview-data.t | Dashboard polls four endpoints every 60 s while visible, including the full XNT ledger (159 KB) that the BE caches for 300 s, and derives KPIs client-side from it | chưa xử lý |
| FE-NETWORK-06 | P2 | src/modules/warranty/pages/WarrantyComponentIs | Component-issue list performs an N+1 GET /warranty-cases/{id} per visible row to render case labels | chưa xử lý |
| FE-NETWORK-07 | P2 | InventoryPage.tsx, MvpPutawayPage.tsx, AuditLo | Mount-time over-fetch: hidden tabs fetched eagerly (Inventory, Putaway), whole tables loaded for dropdowns (/users per_page=200, roles/permissions), a 90-day unfiltered movement ledger for a one-SKU drill-down, and a 200-row public product list used only to build filter options | chưa xử lý |
| FE-NETWORK-08 | P2 | src/modules/reports/operations/report-coverage | Empty-period coverage probe re-queries the report's own endpoint over a 365-day window — for movement-trace, inventory-ledger and document-history that is an unpaginated whole-year ledger | chưa xử lý |
| FE-NETWORK-09 | P2 | list pages (InboundPage, AlignedMvpOutboundPag | Search/typeahead: local 250 ms debounce but no AbortSignal, no keepPreviousData on paged lists, and a dormant useAutocomplete that retries aborted requests | chưa xử lý |
| FE-NETWORK-10 | P2 | src/modules/notifications/hooks/useNotificatio | Realtime channel: each notification broadcast triggers two REST refetches per recipient, and every WebSocket (re)connect costs a POST /broadcasting/auth — Reverb capacity at 10k concurrent sockets is unverified | chưa xử lý |
| FE-RENDER-01 | P1 | src/app/router/index.tsx, src/app/router/Prote | Five-hop serial waterfall on every authenticated F5 (and three on /login): shell and page chunks start only after the auth/IDB gate | chưa xử lý |
| FE-RENDER-03 | P1 | src/main.tsx:9, src/shared/ui/icons/icon-famil | Full 3,586-glyph icon font + its 155 KB CSS are render-blocking on every page for 56 used icons; woff2 (386 KB) is fetched on the login page | chưa xử lý |
| FE-RENDER-02 | P1 | src/shared/ui/theme/AppThemeProvider.tsx, src/ | antd runtime (ConfigProvider + App + cssinjs, ~217 KB raw / 77 KB gz) is mounted at the root and shipped in the entry graph although only 8 files use antd | chưa xử lý |
| FE-RENDER-05 | P1 | src/modules/dashboard/overview/overview-data.t | Dashboard polls four heavy report endpoints every 60 s per open tab — a fixed background load that scales with concurrent users, not with activity | chưa xử lý |
| FE-RENDER-04 | P2 | src/shared/store/auth.store.ts, src/shared/lib | On-demand libraries are statically imported into hot paths: pusher-js + laravel-echo on /login (via auth.store), jsbarcode + qrcode on every Outbound/Warranty visit, xlsx on AuditLogs entry | chưa xử lý |
| FE-RENDER-07 | P2 | src/modules/reports/io-history/IoHistoryReport | IoHistoryReport (/reports/pending-evidence) renders the full unpaginated document-history set into a hand-built table with no render window — the one report screen the 06/09 fix did not cover | chưa xử lý |
| FE-RENDER-08 | P2 | src/shared/i18n/useT.ts, src/shared/i18n/messa | The entire Vietnamese dictionary (~226 KB, est.) ships in the entry graph of every page including /login | chưa xử lý |
| FE-RENDER-06 | P2 | src/shared/lib/echo.ts, src/modules/notificati | One persistent WebSocket + one channel-auth POST per authenticated tab against a single Reverb process; reconnect storms are unmitigated on the client | chưa xử lý |
| FE-RENDER-09 | P2 | src/main.tsx, src/shared/utils/performance-mon | No field Web Vitals / RUM: LCP, INP and CLS at scale cannot be observed; the only performance monitor in the codebase is dead code | chưa xử lý |


### FE-NETWORK-01 — Login path issues a redundant serial GET /auth/me although POST /auth/login already returns the identical profile payload

**Bằng chứng:** use-login.ts:27-32 onSuccess only calls setAuth (auth.store.ts:60-75 sets isProfileLoaded:false) then navigate; ProtectedRoute.tsx:50 useMe() fires GET /auth/me because token is set and profile is not (use-me.ts:12-17), and :109/:114 block the Outlet (and the IndexedDB restore, use-persisted-cache.ts:28-60) until it returns. BE login response is `'user' => $this->userPayload($user)` (AuthController.php ~190) and me() returns `...userProfilePayload + ...userAuthorizationPayload` (AuthController.php:300-304, 433-439, 456-470: roles, permissions, warehouse_scope_ids) — the same shape. FE already has `meResponseFromRefreshUser` (auth.service.ts:266-280) and uses it only in bootstrap-auth.ts:46-49 for the F5 path. BE PERF_AUDIT §4 B lists /auth/me as deliberately uncached, and CACHE_POLICY.md §5 records 170–380 ms per extra RTT on the F5 path before the same fix was applied there.

**Nguyên nhân:** The refresh-path optimisation (seed ['auth','me',token] from the token response) was never applied to the login path; useLogin stores the token and user but leaves the profile empty, so the fail-closed guard has to fetch it again.

**Ở 10k người dùng:** Every login costs one extra uncached, DB-backed request (roles + permissions + scope queries) and one extra network round trip on the critical path before the first data screen; at shift start (login storm) auth-path request volume is doubled. Exact server cost per /auth/me: NOT MEASURED.

**Sửa thế nào:** In useLogin.onSuccess, after setAuth, seed `queryClient.setQueryData(['auth','me', data.access_token], meResponseFromRefreshUser(rawUser))` and call `setProfile(...)` exactly as bootstrap-auth.ts:46-49 does (keep the raw `user` object from the login response available to the hook — normalizeLoginResponse currently discards the raw shape, so pass it through or normalise once). Keep the null fallback (missing `permissions` → still call /auth/me). Do NOT weaken fail-closed: profile still comes from the server response that issued the JWT; do not persist it to disk (rbac class stays persist:false).

**Kiểm chứng:** Before/after in DevTools or Playwright: count requests between POST /auth/login and first page query; expect GET /auth/me to disappear and time-to-first-data-request to drop by one RTT. Re-run e2e/auth-role-navigation-qa2.spec.ts and the RBAC guards (403 page, PASSWORD_CHANGE_REQUIRED) to confirm fail-closed behaviour is unchanged.


### FE-NETWORK-02 — Unconditional POST /auth/refresh on every page load: guaranteed 422 on anonymous loads (root cause of FE docs §7.4), and one DB-write token rotation + synchronous audit insert per F5 with no cross-tab coordination

**Bằng chứng:** main.tsx:35 `void bootstrapAuth()` runs on every load; bootstrap-auth.ts:30-35 'Always attempt one refresh'; auth.service.ts:323-334 sends `{}` when memoryStorage has no token (always true after reload). BE PersistRefreshTokenCookie.php:27-33 merges the HttpOnly cookie into the request only if it exists; :45-48 expires the cookie on logout/changePassword; AuthController.php:222 `validate(['refresh_token' => ['required',...]])` → 422 when neither body nor cookie carries a token. So any first visit to /login, any load after logout, and any load in a browser without the cookie yields exactly one 422 — which is what scripts/perf/verify-keep-alive.mjs:61 (`page.goto('/login')`) observes; FE_PERF_AUDIT §7.4 attributes it to 'lần F5 đầu'. bootstrap-auth.ts:16-19 treats 422 as an invalid session and clears the cookie hint (functionally harmless). For logged-in reloads: RefreshTokenService.php:45-70 runs DB::transaction + SELECT ... FOR UPDATE + UPDATE revoked_at + INSERT new token, and AuthController.php:238 logs TOKEN_REFRESH through AuditLogger.php:78 (`DB::transaction(fn () => AuditLog::create(...))`, synchronous). RefreshTokenService.php:52-56: a second use of the same cookie value (two tabs reloading concurrently, browser session restore) is treated as replay and revokes all tokens for the user; bootstrapAuth is single-flight per tab only (bootstrap-auth.ts:64-72).

**Nguyên nhân:** The FE cannot see the HttpOnly cookie, so it always tries; nothing on the client side (public route detection, persisted auth hint) short-circuits the attempt, and no cross-tab lock serialises rotation.

**Ở 10k người dùng:** (a) Every anonymous or post-logout load = 1 wasted POST through the auth route group ending in a validation exception (cheap per request, but on the same php-fpm pool as everything else). (b) Every reload by an authenticated user = 2 row-locked writes on refresh_tokens + 1 audit_logs insert; at 10k users the write rate is proportional to reload frequency (NOT MEASURED). (c) Concurrent multi-tab reload → whole session revoked → forced re-login → +login +me +dashboard fan-out per affected user; on warehouse PCs with several tabs this is a plausible daily event, frequency NOT MEASURED.

**Sửa thế nào:** FE: (1) skip the refresh attempt on public routes (/login, /forgot-password, /pv/*) when the rehydrated auth hint (auth.store.ts:139-146 persists `user` in the erp-auth cookie) is empty — i.e. only attempt when either the hint exists or the route is protected; keep fail-closed semantics for protected routes (still always try there). (2) Serialise rotation across tabs with `navigator.locks.request('wms-refresh', ...)` (fallback BroadcastChannel) and share the new access token with other tabs via BroadcastChannel so only one tab rotates per reload burst. BE (out of FE scope, note only): a short grace window that returns the already-rotated pair for the same token hash within N seconds would remove the replay false-positive; do not weaken replay detection beyond that. Do NOT reintroduce trusting the cookie hint as proof of authentication.

**Kiểm chứng:** Playwright: cold `goto('/login')` must produce 0 POST /auth/refresh; reload while logged in must produce exactly 1; open two tabs and reload both within 100 ms → both stay logged in and only one TOKEN_REFRESH audit row appears (query audit_logs by request_id). Load test: compare refresh_tokens/audit_logs insert rate per simulated reload before/after.


### FE-NETWORK-03 — Whole-period report ledgers (document-history 461 KB, inventory-ledger, reversal-documents, movement-trace 2.1–4.3 MB) are fetched unpaginated and additionally under three different query roots, so moving between report pages re-downloads the same payloads

**Bằng chứng:** Same request, different keys: `/reports/document-history` under ['rpt-ops','document-history',from,to,docType] (report-data.ts:439-455, used by inventory-flow-api.ts:377 and recipient-agency-api.ts:462-467,632-637,714-719), under ['rpt-mov-01','document-history',from,to] with doc_type=all (movement-trace-api.ts:203-216), and under ['rpt-io-01','document-history',...] with an extra status param (io-history-api.ts:167-181). `/reports/inventory-ledger` identical params under ['rpt-xnt-01','inventory-ledger',from,to] (inventory-flow-api.ts:304-311) and ['rpt-io-01','inventory-ledger',from,to] (io-history-api.ts:194-201). `/reversal-documents?per_page=200` under rpt-ops (report-data.ts:465-476) and rpt-mov-01 (movement-trace-api.ts:218-231). React Query dedups only on identical keys, so a user opening Traceability then Inventory-flow then Pending-evidence downloads document-history up to three times for the same period. Recorded sizes: docs/cache/CACHE_POLICY.md:87-89 (movement-trace 2.1 MB, document-history 461 KB, XNT 159 KB); FE_PERF_AUDIT §6 (movement-trace 4.3 MB at 5,956 rows, 'tăng tuyến tính'); report-data.ts:15-20 documents the deliberate no-per_page contract. gzip is on at nginx (docker/nginx/default.conf.template:44-49) — compressed size NOT MEASURED.

**Nguyên nhân:** Each report module declared its own root (rpt-xnt-01, rpt-mov-01, rpt-io-01) for the same endpoints; the cache registry forbids nested prefixes but does not detect same-endpoint duplicates. The unpaginated contract is intentional (chart == table invariant) and needs server-side aggregation to change.

**Ở 10k người dùng:** The heaviest per-user transfers in the app, multiplied by the number of report pages visited per 5-minute window. BE returns cached bytes on hit (report TTL 300 s) but still serialises and streams multi-MB JSON per request; per-request PHP/nginx cost and egress at 10k users NOT MEASURED. Traceability alone is 4.3 MB per open on today's dataset and grows with movements.

**Sửa thế nào:** Step 1 (FE-only, safe): collapse to one hook per endpoint under a single root: `useDocumentHistory({from,to,docType,status?})`, `useInventoryLedger({from,to})`, `useReversalDocuments({from,to})` in report-data.ts (`rpt-ops`), and make movement-trace-api.ts / io-history-api.ts / inventory-flow-api.ts consume them; keep io-history's status filter as an explicit key segment so its request stays distinct only when the param differs. Step 2 (contract change, already listed as residual in FE docs): server-side KPI + timeline aggregation for movement-trace and document-history with paginated rows; FE keeps client filtering only on the aggregated set. Do NOT paginate the rows alone — the chart/table invariant the pages rely on would break.

**Kiểm chứng:** Playwright network log: visit /reports/traceability → /reports/inventory-flow → /reports/pending-evidence with the same period; count GET /reports/document-history and /reports/inventory-ledger (expect 1 each after step 1, 3 today). Add a guard test that scans hooks for duplicate endpoint+params under different roots. After step 2, measure bytes per open of /reports/traceability (today 4.3 MB).


### FE-NETWORK-04 — Four report inputs crawl entire tables without a period filter (warranty-cases, component-issue-documents, label-print-events, users) — request count and bytes grow with history and then silently truncate at the page cap

**Bằng chứng:** report-data.ts:660-681 `useWarrantyCases` → fetchAllPages(/warranty-cases, per_page 100, ≤10 pages), no from_date/to_date; :684-710 `useComponentIssueDocuments` same; packing-label-api.ts:215-240 `useLabelPrintEvents` → /label-print-events ≤20×100 with the comment 'BE không có tham số ngày cho endpoint này' and a `capped` flag when truncated; report-data.ts:206-216 `useUserDirectory` → /users?per_page=200 (not persisted, PII) on 4 report pages, plus AuditLogsPage.tsx:117 /users?per_page=200 under a different (`iam`) key. paginate-all.ts:19 caps concurrency at 6, so a full crawl is 1 + ceil((N-1)/6) round trips. Recorded today: /reports/warranty api=5, /reports/packing-label api=3 (transitions-final-cpu1.json lines 57-77) because tables are small.

**Nguyên nhân:** The report needs fields only the raw list endpoints expose (created_by, item_id, print events), and those endpoints have no date filter, so the FE fetches everything and filters client-side.

**Ở 10k người dùng:** Per open of /reports/warranty up to 1+10+10+10 requests and of /reports/packing-label up to 1+20 requests every 5 minutes per user, growing linearly with case/print history until the cap is hit — after which the report is quietly wrong (capped). Bytes per crawl NOT MEASURED.

**Sửa thế nào:** BE: add `from_date/to_date` (and `warranty_case_ids[]` for component issues) to /warranty-cases, /component-issue-documents, /label-print-events; add a slim `/users/lookup` (id, display_name, department) analogous to /skus/lookup with master-class caching. FE: pass the report period to those hooks and key the queries on it; keep the 100/page cap and the `capped` flag. Do NOT drop the truncation flag or raise MAX_PAGES as a substitute.

**Kiểm chứng:** Seed-scale check: with HoaNamBulkDemoSeeder data, record request count and total bytes for /reports/warranty and /reports/packing-label before/after; assert `capped` never becomes true for a one-month period. Grep guard: no fetchAllPages call without a date-bounded param set.


### FE-NETWORK-05 — Dashboard polls four endpoints every 60 s while visible, including the full XNT ledger (159 KB) that the BE caches for 300 s, and derives KPIs client-side from it

**Bằng chứng:** overview-data.ts:178 AUTO_REFRESH_MS = 60_000; :187-199 reportQueryOptions sets refetchInterval when autoRefresh; DashboardPage.tsx:147-152 passes `!offline` → polling is on for every online viewer, no user toggle in code. Four queries: :222-229 dashboard-overview (widened range), :231-238 inventory-xnt-enhanced for the KPI period (default 'last7', DashboardPage.tsx:110), :241-253 inventory-xnt-daily (7 d), :255-262 dashboard-quick. XNT is consumed only to compute equation totals, top-5 SKUs and in-stock counts client-side (:391-460). BE TTLs: dashboard 60 s, report 300 s (config/wms_cache.php:17-18) → the two XNT polls return identical cached bytes 4 of every 5 ticks. Recorded XNT payload 159 KB (CACHE_POLICY.md:89) for the measured range; dashboard payloads 5–20 KB. React Query default refetchIntervalInBackground=false so hidden tabs do not poll.

**Nguyên nhân:** The demo's '60-second auto refresh' was implemented uniformly on all four sources; XNT was bolted on because dashboard-overview does not publish the equation/top-5 fields.

**Ở 10k người dùng:** Steady-state load proportional to concurrent dashboard viewers: 4 requests/min/viewer and ~159 KB/min/viewer uncompressed for XNT alone (e.g. 1,000 viewers ≈ 67 req/s and ≈2.6 MB/s uncompressed before gzip). Whether load/k6 flows model this cadence: NOT MEASURED.

**Sửa thế nào:** (1) BE: publish `equation` (opening/receipt/issue/component/reversal/closing), `top_issue_skus` (5) and `skus_in_stock` in /reports/dashboard-overview (it already aggregates per period) and drop the XNT + XNT-daily calls from the dashboard. (2) Until then, set refetchInterval per query: 60 s only for dashboard-overview/dashboard-quick, ≥300 s for XNT/XNT-daily (their BE TTL), and consider 120 s overall with jitter to spread ticks across users. Keep the dashboard cache class at 60 s (NFR staleness) and keep refetchIntervalInBackground=false.

**Kiểm chứng:** Open /dashboard for 5 minutes in a browser and count requests per endpoint (expect 20 today; ≤10 after). In k6, add a dashboard-viewer flow with the real interval and measure req/s and bytes/s at 1k and 10k VUs before/after.


### FE-NETWORK-06 — Component-issue list performs an N+1 GET /warranty-cases/{id} per visible row to render case labels

**Bằng chứng:** WarrantyComponentIssueListPage.tsx:135-155: `caseIds` derived from the current page rows, then `useQueries` with one `fetchWarrantyCase(caseId)` per id (up to perPage = 10–50, MVP_PAGE_SIZE_OPTIONS) on every page load/search change; results are used only for display via `caseById`.

**Nguyên nhân:** The list endpoint returns warranty_case_id but not the case code/customer the table needs.

**Ở 10k người dùng:** perPage+1 requests per page view of this screen instead of 1; per-request cost of a case detail (joins, attachments count) NOT MEASURED.

**Sửa thế nào:** BE: embed `warranty_case.{code, customer_name, status}` in /component-issue-documents rows (or support `include=warranty_case`). FE: read the embedded fields and drop useQueries; keep `warrantyKeys.detail(id)` for the modal. Do not batch by issuing /warranty-cases?ids= unless BE supports it.

**Kiểm chứng:** Network log on /warranty/component-issues with perPage=50: expect 2 requests (list + warehouses) instead of up to 52.


### FE-NETWORK-07 — Mount-time over-fetch: hidden tabs fetched eagerly (Inventory, Putaway), whole tables loaded for dropdowns (/users per_page=200, roles/permissions), a 90-day unfiltered movement ledger for a one-SKU drill-down, and a 200-row public product list used only to build filter options

**Bằng chứng:** InventoryPage.tsx:183-197 both `useInventoryBalances` and `useStockMovements` run on mount with no `enabled`, while only one tab renders (:601-754) — recorded api=2. MvpPutawayPage.tsx:208-219 tasks + history + trays on mount; history is only rendered for activeTab==='history' (:752,801). AuditLogsPage.tsx:117 `/users?per_page=200` for a filter dropdown (BE PERF_AUDIT §4 D: /users uncached). IamUserScreen.tsx:348-359 users + roles(100) + departments + warehouses + permissions(200) on mount; /system/roles loads /permissions?per_page=100 and /users?per_page=100 under different keys. stock-reconcile-api.ts:293 MOVEMENT_TRACE_DAYS=90 and :304-311 `useSkuMovements` fetches /reports/movement-trace for 90 days with no SKU filter then filters `product_code` client-side, although the endpoint accepts `product_id` (OperationalReportController.php:546 OA params). PvCatalogPage.tsx:62-78: a second `usePvProducts({industry_id, per_page:200})` purely to derive category/tag options on the anonymous PV app.

**Nguyên nhân:** Convenience loading patterns: queries declared at page level without `enabled`, and option lists derived from full list endpoints because no lookup endpoints exist.

**Ở 10k người dùng:** Each is a 1–2× multiplier on a page's mount requests or a large payload for a small need; the movement-trace drill-down is the worst single item (a 90-day ledger — multi-MB at current data — per SKU click). Per-item cost NOT MEASURED.

**Sửa thế nào:** InventoryPage/MvpPutawayPage: `enabled: activeTab === 'balance'` / `'movements'` / `'history'` (keep keys so switching back is cached). Stock-reconcile: pass `product_id` (catalog.byCode) to useMovementTrace for the drill-down. Audit-logs/reports: use a slim `/users/lookup` (see FE-NETWORK-04) under the `ref` root and denylist persistence (already in PERSIST_DENYLIST for rpt-ops). PV: add `/pv/taxonomy?industry_id=` returning categories/tags, or cache the snapshot under the `reference` class since it is anonymous and rarely changes. Do not change business filtering semantics (server still filters).

**Kiểm chứng:** Per page, count mount requests before/after in Playwright (Inventory 2→1, Putaway 3→2, Audit 2→1+lookup). For the SKU drill-down, record response bytes of /reports/movement-trace with and without product_id.


### FE-NETWORK-08 — Empty-period coverage probe re-queries the report's own endpoint over a 365-day window — for movement-trace, inventory-ledger and document-history that is an unpaginated whole-year ledger

**Bằng chứng:** report-coverage.ts:36 COVERAGE_WINDOW_DAYS=365; :96-130 useReportCoverage fires when `shouldProbeCoverage` (report-range-advice.ts:286-304: true whenever the selected period has zero data days, or is long and sparse); probes: report-probes.ts:24-25 inventory-ledger, :37-38 document-history, :44-47 movement-trace (no `paginate` → full-year payload), :80-82 warranty-defects and :94-96 outbound-by-recipient paginated ≤10×100. Only ImportMatchReport passes `knownCoverageDays` to skip the probe (ImportMatchReport.tsx:770). Cached 5 min per key, retry:false.

**Nguyên nhân:** No BE endpoint answers 'which dates have data', so the FE reuses the heaviest read endpoints with a maximal window.

**Ở 10k người dùng:** Every user who selects a period with no activity (a future week, a holiday, a freshly-created scope) triggers a full-year read of the heaviest report endpoints once per 5 minutes; BE report cache absorbs repeats within TTL per scope, but the first miss is a full-year scan. Frequency in real usage and payload size NOT MEASURED (today's 3-month movement-trace is already 4.3 MB).

**Sửa thế nào:** BE: add a cheap `GET /reports/coverage?report=<key>&from&to` returning distinct activity dates (GROUP BY date, cached master/report class). FE: point CoverageProbe at it, or as an interim limit probes to endpoints that support `per_page` with a minimal page plus a `dates` aggregate. Keep the 'per-report own source' rule the file documents.

**Kiểm chứng:** Select an empty future week on /reports/traceability and capture the probe request's response size and duration before/after; assert the new probe returns <10 KB.


### FE-NETWORK-09 — Search/typeahead: local 250 ms debounce but no AbortSignal, no keepPreviousData on paged lists, and a dormant useAutocomplete that retries aborted requests

**Bằng chứng:** SEARCH_DEBOUNCE_MS=250 in 8 pages (e.g. InboundPage.tsx:51 with the setTimeout effect at :119-126); service functions never forward the queryFn `signal` (use-inbound.ts:38-41, use-inventory.ts:32-42, use-warranty.ts:58-61, use-reversal.ts:34-37 — `signal` appears only in pv image upload code), so superseded keyword requests complete server-side and are cached under dead keys. No list hook sets `placeholderData` (only report hooks do: report-data.ts:420-733), so every page/search change renders an empty table until the new page arrives. use-autocomplete.ts:137,155-167 creates its own AbortController inside queryFn and aborts the previous one, while `retry: 1` (:187) turns each abort into a failed query that is retried after the backoff — an extra request per keystroke window; its only consumer is UiAddressField (static JSON), so this is dormant today.

**Nguyên nhân:** The shared http wrapper accepts AxiosRequestConfig but hooks never pass the React Query signal through; list pages were written before the report layer adopted placeholderData.

**Ở 10k người dùng:** Each abandoned keystroke window still costs a full list query on the BE (search class cached 120 s only for endpoints that use it); user-visible flicker on every page change encourages repeated clicks. Wasted-request ratio NOT MEASURED.

**Sửa thế nào:** Pass `{ signal }` from the queryFn context into `http.getPage(url, { params, signal })` in list/search services (axios supports AbortSignal); add `placeholderData: keepPreviousData` to paged list hooks (inbound, outbound, inventory, warranty, reversal, audit-logs, iam, mvp-master); in useAutocomplete drop the manual controller and use the context signal (React Query then treats aborts as cancellations, not failures). Keep the 250 ms debounce and the RBAC/business filters untouched.

**Kiểm chứng:** Type a 5-character keyword at ~150 ms per key on /inbound and count GET /inbound-documents in the network log before/after (expect fewer completed requests; aborted ones show as cancelled). Confirm no retries of cancelled requests in the log.


### FE-NETWORK-10 — Realtime channel: each notification broadcast triggers two REST refetches per recipient, and every WebSocket (re)connect costs a POST /broadcasting/auth — Reverb capacity at 10k concurrent sockets is unverified

**Bằng chứng:** useNotificationSocket.ts:27-35 subscribes `user.{id}` and on `.notification.created` calls `increment()` AND `queryClient.invalidateQueries({queryKey:['notifications']})`, which refetches both ['notifications','unread-count'] and ['notifications',{per_page:5}] mounted in AppTopbar.tsx:160-161 — i.e. the payload already carried by the socket is discarded and re-read over REST. echo.ts:26-40 authoriser posts /broadcasting/auth per channel subscription; pusher-js reconnects automatically after drops, re-authorising each time. Config: FE .env sets VITE_REVERB_APP_KEY (empty in .env.example); BE .env.example REVERB_APP_KEY blank — production realtime wiring unknown. BE unread-count is cached per actor (NotificationController.php:103-115) so the refetch is cheap on hit, but the cache is bumped on write.

**Nguyên nhân:** Invalidate-on-event pattern instead of applying the pushed payload to the cache; no backoff/jitter on reconnect-driven auth.

**Ở 10k người dùng:** A fan-out broadcast to N users (e.g. SecurityAlertRaised) produces 2N REST requests within a second; a Reverb restart or Wi-Fi blip produces N POST /broadcasting/auth in a burst plus N×(unread-count+list) refetches on reconnect. Reverb memory/CPU per 10k sockets and the burst size: NOT MEASURED.

**Sửa thế nào:** On `.notification.created`, `setQueryData(['notifications',{per_page:5}], prepend payload)` and `setQueryData(unread-count, +1)` instead of invalidating; invalidate only on mark-read. Add jittered delay (e.g. 0–5 s) before any reconnect-triggered refetch. Confirm production REVERB_* values and size Reverb (or disable the app key so the FE degrades to badge bootstrap only, which the code already supports: echo.ts:44-47).

**Kiểm chứng:** Trigger one broadcast to 50 test users and count REST requests at the BE (expect 0 list/unread refetches after the change). Load test Reverb separately: 10k idle sockets + reconnect storm, measuring /broadcasting/auth req/s and Reverb memory.


### FE-RENDER-01 — Five-hop serial waterfall on every authenticated F5 (and three on /login): shell and page chunks start only after the auth/IDB gate

**Bằng chứng:** router/index.tsx:18-20 (`MainLayout = lazy(...)`), :44-48 (`DashboardPage = lazy(...)`), :238-243 (`MainLayout` is a child of `<ProtectedRoute/>`); ProtectedRoute.tsx:62 `if (!isBootstrapped) return <Loading/>`, :109, :114 `if (!isCacheReady) return <Loading/>`, :116 `<Outlet/>` — the lazy import() of MainLayout is first invoked by that Outlet render, and DashboardPage's import() only when MainLayout renders its outlet. dist/index.html carries 32 `modulepreload` links, none for `MainLayout-*.js` (62,129 B) or `DashboardPage-*.js` (56,611 B + 46,910 B CSS); `index-BUYY3orM.js` lists them only in `__vite__mapDeps` (dynamic). bootstrap-auth.ts:33 `authService.refresh()` runs at module eval (main.tsx:35) — nothing else network-bound is started alongside it. IDB restore gate: query-persister.ts:59 `RESTORE_TIMEOUT_MS = 1_500`, idb.ts:56 3,000 ms open timeout. Login: LoginPage chunk graph = 17 chunks / 194 KB raw not in the modulepreload list; illustration URL is inside that graph (AuthIllustration.tsx:2,33-47), no fetchpriority/preload; index.html has no preconnect/preload hints (grep returned nothing). Lab numbers already recorded: first entry to a screen 349–711 ms at CPU x1 on LAN (FE audit §7.3) — cold F5 including refresh not measured.

**Nguyên nhân:** Route-level `lazy()` is correct for bytes, but the fail-closed auth gate serialises chunk discovery behind two network/IO waits (refresh, IDB) that do not depend on the chunks, and Vite only emits modulepreload for the static graph. The idle prefetcher (`route-preload.ts`) starts after MainLayout mounts, i.e. after the waterfall it could have shortened.

**Ở 10k người dùng:** Per-user latency rather than server load: on a WAN with 40–80 ms RTT + TLS the two extra chunk hops add ~150–300 ms and the IDB gate up to 1.5 s worst case on every F5, in addition to the API time. At 10k users mostly on warehouse PCs (FE audit measured CPU x4 as the realistic profile) this is the dominant part of 'time to first data' that the BE fixes (32–90 ms endpoints) cannot recover. Login page LCP (illustration) sits at the third serial round.

**Sửa thế nào:** 1) In main.tsx, next to `bootstrapAuth()`, fire `void import('@/app/layouts/MainLayout')` and a `preloadRoute(window.location.pathname)` (reuse route-preload.ts LOADERS) so the shell + target page chunks download in parallel with POST /auth/refresh; keep ProtectedRoute's gate order unchanged (do NOT render Outlet before profile + cache — that is a data-scope guarantee). 2) Warm `openDb()` (idb.ts) at boot so the restore after /auth/me is a single get, not open+get. 3) Add `<link rel="preconnect" href="<API origin>" crossorigin>` in index.html (API is cross-origin per CORS preflight note in FE audit §5). 4) For /login desktop, either `<link rel="preload" as="image">` the illustration from index.html (hash the path at build via a small plugin) or add `fetchpriority="high"` + explicit width/height; keep it hidden < lg. Do not move LoginPage back to a static import (that regression was measured and reverted, router/index.tsx:10-12).

**Kiểm chứng:** Before/after with Chromium CDP or Playwright `page.on('request')`: on a cold-cache F5 of /dashboard, record the ordered timeline of index.html → last modulepreload → /auth/refresh → MainLayout-*.js → DashboardPage-*.js → first dashboard GET → first KPI paint; count serial rounds (expect 5 → 3). Extend scripts/perf/measure-transitions.mjs with a `coldF5` round at CPU x1 and x4 with 50 ms injected RTT; report 'time to first KPI paint' p50/p95 over ≥ 5 runs. For /login: Lighthouse LCP and 'LCP resource load delay' before/after.


### FE-RENDER-03 — Full 3,586-glyph icon font + its 155 KB CSS are render-blocking on every page for 56 used icons; woff2 (386 KB) is fetched on the login page

**Bằng chứng:** main.tsx:9 `import "@flaticon/flaticon-uicons/css/regular/rounded.css"` (global). node_modules/@flaticon/flaticon-uicons/css/regular/rounded.css = 154,778 B raw / 28,052 B gz with 3,586 `.fi-rr-*:before` rules; all 3,586 are present in dist/assets/index-MlGUkuqS.css (184,908 B / 34,306 B gz) → 82% of the only render-blocking stylesheet. @font-face in that CSS: `font-display:swap`, woff2 dist/assets/uicons-regular-rounded-J3WOUERV-*.woff2 = 385,636 B (also emitted: woff 521,880 B, eot 1,092,772 B). Distinct icon slugs used across src (createFlatIcon/flatIconClass/startIcon/icon: props/fi-rr- literals): 56; icon-family.ts comment counts 113. On /login the password field renders `flatIconClass("eye")` (UiFormText.tsx:110) so the woff2 is downloaded before login. index.html has no `<link rel=preload as=font>`. Nav icons already use inline SVG paths (vuexy-nav-icon-paths.ts).

**Nguyên nhân:** The icon package is consumed as a monolithic CSS+font instead of a subset; the ui:icons guard enforces family consistency but not glyph subsetting.

**Ở 10k người dùng:** Every first visit / every deploy (SW cache name changes per build, service-worker.js:18-22) pays ~28 KB gz CSS parse + 386 KB font per user: 10k users ≈ 4.1 GB of font egress per deploy wave and ~0.3 GB CSS; CSS blocks first paint on every page; `swap` on an icon font renders empty boxes/tofu until the font lands, a visible layout/flash on slow links.

**Sửa thế nào:** Generate a subset at build or check-in time: `pyftsubset uicons-regular-rounded.woff2 --unicodes=<codepoints of the 56–113 used slugs> --flavor=woff2` plus a generated CSS containing only those classes (a script under scripts/ can derive the slug list the same way `check-ui-icons.mjs` does); keep `flatIconClass()` API unchanged so no screen changes. Alternatively migrate to inline SVG via the existing VuexyNavIcon pattern. If the font stays: add `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the hashed file and use `font-display: block` for the icon face (icons have no meaningful fallback glyph). Drop eot/woff from the build (they are dead for supported browsers).

**Kiểm chứng:** Compare dist sizes: index CSS gz (34 KB → ≈8 KB expected), woff2 (386 KB → < 30 KB for ~100 glyphs). `yarn ui:icons` self-test must still pass. Network waterfall on /login: font request size and start time; Lighthouse 'Ensure text remains visible' + CLS before/after; visual check that no icon renders as a box (e2e/ui-foundation.spec.ts snapshot).


### FE-RENDER-02 — antd runtime (ConfigProvider + App + cssinjs, ~217 KB raw / 77 KB gz) is mounted at the root and shipped in the entry graph although only 8 files use antd

**Bằng chứng:** AppThemeProvider.tsx:14 `import { App as AntdApp, ConfigProvider } from "antd"`, :16 `import viVN from "antd/locale/vi_VN"`, :47-50 wraps every route in `<ConfigProvider><AntdApp>`. Entry graph chunks identified as antd by markers (`ant-`, `rc-`, `anticon`, `cssinjs`/`useStyleRegister`): ContextIsolator-pgcfM9K5.js 90,919 B / 31,451 gz; compact-item-DKLv6e8i.js 75,326 / 28,810 (7 cssinjs markers); useModal-BmzB_vM1.js 40,414 / 13,183; config-provider-hJncvHxa.js 7,706 / 3,201; zoom-peffDNgI.js 2,815 / 738 → 217,180 B raw / 77,383 B gz = 19% of the 399,514 B gz entry graph; all five are in dist/index.html's modulepreload list, so they are fetched and evaluated on /login. antd consumers: 8 files (UiDatePicker.tsx, UiFormDate.tsx, ScanInput.tsx, CameraScanModal.tsx, FilterBar.tsx, PageHeader.tsx, antd-adapter.ts, AppThemeProvider.tsx) vs 60 files importing @mui/material. vite.config.ts:92-95 comment explicitly relies on Rollup to keep antd out of the login graph — the root provider defeats that.

**Nguyên nhân:** Two UI frameworks coexist after the Vuexy/MUI migration; the antd ConfigProvider was kept as a global composition root (architecture guard requires a single ThemeProvider), so antd's runtime and cssinjs style injection execute on every page including ones with zero antd components.

**Ở 10k người dùng:** ~77 KB gz extra download and antd/cssinjs JS evaluation on every session start and every deploy wave for all 10k users (≈ 0.8 GB per deploy just for antd), plus main-thread parse/compile of ~217 KB of unused code on low-end warehouse PCs before the login form can render.

**Sửa thế nào:** Preferred: finish the migration of the 5 remaining antd components (date pickers → MUI X DatePicker or the existing native-input path, ScanInput/CameraScanModal/FilterBar/PageHeader → @/shared/ui primitives), then remove antd, antd-adapter.ts and the viVN locale. Interim, zero-behaviour-change: move `<ConfigProvider theme={ANTD_THEMES[mode]} locale={locale}><AntdApp>` into a `lazy()`-loaded `AntdScope` component and mount it only around the five antd-using components (or the routes that render them), keeping AppThemeProvider MUI-only; update the provider-uniqueness test/allowlist (docs/ui/vuexy-sync/allowlists/themeprovider-exceptions.json) rather than disabling it. Keep token parity (buildAntdTheme) for the interim scope.

**Kiểm chứng:** Rebuild and re-run the static-import closure: entry graph must not contain ContextIsolator/compact-item/useModal/config-provider chunks; expected entry gz ≈ 322 KB (from 399.5 KB). Lighthouse on /login: TBT and 'Reduce unused JavaScript' before/after; Playwright coverage (`page.coverage.startJSCoverage`) on /login to confirm unused-byte ratio drops. Regression: yarn ui:guards, e2e/ui-foundation.spec.ts, date-picker screens (Inbound/Outbound filters) visual check.


### FE-RENDER-05 — Dashboard polls four heavy report endpoints every 60 s per open tab — a fixed background load that scales with concurrent users, not with activity

**Bằng chứng:** overview-data.ts:178 `const AUTO_REFRESH_MS = 60_000;`, :191 `refetchInterval: autoRefresh ? AUTO_REFRESH_MS : (false as const)` applied to all four queries (:222-261): `API_ENDPOINTS.REPORTS_DASHBOARD_OVERVIEW`, `REPORTS_XNT_ENHANCED`, `OPERATIONS_REPORT_ENDPOINTS.XNT_DAILY`, `API_ENDPOINTS.DASHBOARD_KPI`. `autoRefresh` is `!offline` (DashboardPage.tsx:147-152) — always on while online. FE staleTime = `CACHE_POLICIES.dashboard.staleTime` (:176) with the source comment tying it to a 60 s BE cache TTL (config/wms_cache.php ttl.dashboard — not re-verified here). React Query default `refetchIntervalInBackground: false` (query-client.ts has no override) so hidden tabs pause. A Reverb push channel already exists per user (useNotificationSocket.ts:27) but is not used for data invalidation. Payload sizes recorded in query-persister.ts:45-46 comments: dashboard 5–20 KB, xnt 159 KB.

**Nguyên nhân:** Port of the demo's 'auto refresh after 60 s' banner as literal client polling on all four sources, independent of whether anything changed and independent of the BE cache window.

**Ở 10k người dùng:** Background request rate = (tabs on /dashboard) × 4 / 60 s. If 20% of 10k users keep the dashboard visible: ≈ 133 req/s (10,000 → ≈ 667 req/s) on the four most expensive read endpoints, continuously, on top of the k6-modelled flows; the ~159 KB xnt payload alone is ≈ 21 MB/s egress at 133 req/s. With a 60 s BE TTL aligned to a 60 s client interval, each user's tick lands at a random phase so the BE cache serves most, but every TTL expiry becomes a stampede window guarded only by rememberStampede's lock.

**Sửa thế nào:** Keep the manual 'Làm mới' button and the offline pause. Replace the 60 s interval with either (a) push invalidation: broadcast a lightweight `dashboard.updated` event on the existing `user.{id}`/a shared `warehouse.{id}` channel when a Post/movement commits, and call `queryClient.invalidateQueries({queryKey:['dashboard']})` in useNotificationSocket; or (b) at minimum raise to 180–300 s with ±20% jitter and `refetchInterval` returning false while `document.visibilityState !== 'visible'` (already default) and while `busy`. Do not change the FE staleTime/BE TTL relationship documented in cache-policy.ts (NFR-SRS-016).

**Kiểm chứng:** Before/after on the perf compose profile: k6 scenario with N virtual users parked on /dashboard for 10 min (flows.js can replay the four GETs on the FE's cadence); measure req/s and p95 on those four endpoints from nginx access logs plus Valkey hit ratio; then the same with the new cadence/push. In the browser: count dashboard GETs over 10 min on one tab (expect 40 → ≤ 14 or event-driven).


### FE-RENDER-04 — On-demand libraries are statically imported into hot paths: pusher-js + laravel-echo on /login (via auth.store), jsbarcode + qrcode on every Outbound/Warranty visit, xlsx on AuditLogs entry

**Bằng chứng:** auth.store.ts:8 `import { disconnectEcho } from "@/shared/lib/echo"` (used once at :134 on logout) → echo.ts:1-2 static `import Echo from "laravel-echo"; import Pusher from "pusher-js"`; auth.store is in the entry graph (main.tsx → bootstrap-auth.ts:6). Result: dist/assets/axios-By3HSJZM.js (142,279 B / 41,689 gz, in the modulepreload list) contains pusher (markers: 100×`pusher`, 16×`Pusher`, 10×`WebSocket`); node_modules sizes pusher.min.js 60,621 B, laravel-echo/dist/echo.js 22,381 B vs axios.min.js 45,585 B → ≈ 80–95 KB raw of that chunk is Echo/Pusher that /login never uses (the only consumer is useNotificationSocket.ts:4 inside MainLayout). JsBarcode-BzYRHmQC.js (87,604 B / 19,506 gz, jsbarcode+qrcode) is a STATIC import of OutboundPage-*.js and WarrantyPage-*.js because PackingLabelPreviewDialog.tsx:2-3 and WarrantyReturnLabelDialog.tsx:2-3 import them at module top and the dialogs are statically imported by the pages. vendor-xlsx-CI0oAJXo.js (282,251 B / 92,539 gz) is a STATIC import of AuditLogsPage-CG1dHFHh.js (export-xlsx.ts:1 `import * as XLSX from "xlsx"`), whereas the report screens reach it through the separate report-export chunk.

**Nguyên nhân:** Top-level imports of libraries whose only use is behind a user action (logout, open label preview, export).

**Ở 10k người dùng:** /login: ≈ 25 KB gz extra for every user and every deploy wave; Outbound/Warranty (the two busiest operational screens by role) each carry 19.5 KB gz + parse of barcode/QR code that only the label dialog needs; AuditLogs pays 92.5 KB gz of xlsx on entry. Small individually but they sit on the paths with the highest visit counts.

**Sửa thế nào:** echo.ts: keep `getEcho()` static for the socket hook but make auth.store's logout call `void import('@/shared/lib/echo').then(m => m.disconnectEcho())` (or have echo.ts subscribe to the auth store itself), so laravel-echo/pusher-js only load with MainLayout. Label dialogs: `const JsBarcode = await import('jsbarcode')` / `import('qrcode')` inside the effect that draws the preview (both already run in effects), or lazy() the two dialogs themselves. AuditLogs export: route through the same dynamic `import('xlsx')` path the reports use (report-export chunk). No business-rule or RBAC changes.

**Kiểm chứng:** Re-run the static closure script on a new build: `axios-*` chunk must lose the `Pusher` markers and shrink to ≈ 45–50 KB raw; OutboundPage/WarrantyPage graphs must not list JsBarcode-*.js; AuditLogsPage graph must not list vendor-xlsx. Network tab on /login: total JS gz before/after (expect ≈ −25 KB).


### FE-RENDER-07 — IoHistoryReport (/reports/pending-evidence) renders the full unpaginated document-history set into a hand-built table with no render window — the one report screen the 06/09 fix did not cover

**Bằng chứng:** IoHistoryReport.tsx:1219 `documentFilter.rows.map((row, index) => (<tr …>` inside a raw `<table>`; :464 `const documentFilter = useSectionFilter(rows, documentFilterConfig)` — the full filtered set; io-history-api.ts:152 and IoHistoryReport.tsx:22-25 state the screen intentionally sends no `per_page`. grep for useRenderWindow/WindowedRowsFooter/WindowedMore/useAutoLoadMore/ResponsiveDataTable in this file: 0 matches, versus InventoryFlowXntReport (7), StockReconcileReport (9), WarrantyComponentsReport (5), MovementTraceReport (4). The DOM count of 1,884 nodes in FE audit §4 was measured on 06/09 before this route became the RPT-08 port (memory note rpt08-io-history-83-port); document-history payload was measured at 461 KB (query-persister.ts:44 comment).

**Nguyên nhân:** The RPT-08 port arrived after the windowing sweep and rebuilt its table by hand instead of via ResponsiveDataTable or the WindowedRowsFooter helper.

**Ở 10k người dùng:** Not a server-side multiplier (one request per open) but a client-side re-creation of the exact INP failure class already fixed elsewhere: rows grow with warehouse history, each filter keystroke re-renders every `<tr>`; on CPU x4 machines this is the same 'long task per keystroke' pattern the audit measured at 14.7 s for 5,956 rows. Also 461 KB per open is above the 256 KB persist cap so it is refetched on every F5.

**Sửa thế nào:** Wrap `documentFilter.rows` with `useRenderWindow(rows)` and render `<WindowedRowsFooter>` after the tbody exactly as StockReconcileReport does; keep KPI/chart/filters computed on the full set (the business invariant at line 22-25 stays intact — only the painted rows are windowed). Keep `index + 1` for STT (it is already O(1)). Optionally add the STT/row-index Map if any `indexOf` appears on drill-down.

**Kiểm chứng:** Same method as FE audit §1/§3: open /reports/pending-evidence with a 90-day range on the seeded DB, record `document.querySelectorAll('*').length` and a `PerformanceObserver('longtask')` while typing one character in the section filter; expect DOM nodes bounded (~60 rows) and long tasks < 50 ms; confirm 'Đang hiển thị 60/N dòng' footer appears and totals/KPI unchanged.


### FE-RENDER-08 — The entire Vietnamese dictionary (~226 KB, est.) ships in the entry graph of every page including /login

**Bằng chứng:** useT.ts:12 `import { MESSAGES_VI, type MessageKey } from "./messages"` (static); i18n/index.ts:2 re-exports it; messages.ts = 275,589 B source. In dist the VI strings live in routes-JjAtcDvK.js (237,357 B / 65,491 gz — the largest entry chunk; `grep -l "Đăng nhập"` and the report string "Sổ tồn kho" both hit that file), which every chunk statically imports and which is in dist/index.html's modulepreload list. Size attribution is an estimate by proportion: messages.en.ts 241,503 B → messages.en-*.js 198,267 B (0.82), so MESSAGES_VI ≈ 226 KB of the 237 KB chunk ≈ 62 KB gz ≈ 15.5% of entry gz. The EN dictionary is already split and loaded on demand (english-messages.ts, language.store.ts:48), proving the pattern is available.

**Nguyên nhân:** A single monolithic message tree for 38 screens is read through one static import; only the secondary language was split.

**Ở 10k người dùng:** ≈ 62 KB gz per user per session start / deploy wave (≈ 0.6 GB per deploy for 10k users) and parse of a ~226 KB object literal before the login form can render, for a page that needs ~30 auth/shared keys.

**Sửa thế nào:** Split messages.ts into a small core (auth, shared, topbar, nav) kept static and per-module namespaces (reports.*, dashboard.*, warranty.*, …) loaded with the route chunk — either by having each route module `import('./messages.<module>')` and merging into the live tree the same way ensureEnglishMessages() does, or by generating per-namespace files with a script and a typed `MessageKey` union preserved via `keyof` on the merged type. Keep the fail-safe (never render a raw key) and the `useT` API unchanged.

**Kiểm chứng:** Rebuild; routes-*.js (or its successor) in the entry graph should drop to < 40 KB raw; /login total JS gz −55..−62 KB; i18n.test.ts and the nav-label tests must still pass; spot-check EN/VI toggling on three screens.


### FE-RENDER-06 — One persistent WebSocket + one channel-auth POST per authenticated tab against a single Reverb process; reconnect storms are unmitigated on the client

**Bằng chứng:** MainLayout.tsx:94 `useNotificationSocket()` runs for every authenticated route; useNotificationSocket.ts:24-29 `getEcho()` then `echo.private(`user.${userId}`)`; echo.ts:26-41 custom authorizer issues `POST /broadcasting/auth` through the axios instance for each subscribe, :50-59 `new Echo({ broadcaster: "reverb", enabledTransports: ["ws","wss"] })` with default pusher-js reconnect settings (no jitter/activityTimeout tuning). Cleanup is correct: :37-40 `echo.leave()` on unmount, :43-47 `disconnectEcho()` on logout; auth.store.ts:134. BE side: docker-compose.yml:113-119 a single `php artisan reverb:start --port=6001`; LOAD_TEST_2026-09-07.md:123 budgets one Postgres connection for reverb; no k6 flow exercises the WS or /broadcasting/auth (load/k6/lib/flows.js is HTTP-only per the known-facts docs). Capacity per connection: NOT MEASURED.

**Nguyên nhân:** Realtime bell is implemented as a per-tab private channel; fine functionally, but the client has no reconnect jitter and every reconnect re-authorises through php-fpm.

**Ở 10k người dùng:** 10k concurrent users ≈ 10k open WS on one Reverb process plus 10k `POST /api/v1/broadcasting/auth` (each a JWT-authenticated PHP request) at login wave; a Reverb restart/deploy makes all clients reconnect within pusher-js's default backoff and re-fire the auth POST — a synchronized burst onto php-fpm that no cache absorbs. Multi-tab users multiply this.

**Sửa thế nào:** Client: pass pusher-js options through Echo (`activityTimeout`, `pongTimeout`) and add randomized reconnect delay (pusher-js `connection.bind('state_change')` with a jittered `disconnect()/connect()` on `unavailable`), and consider connecting only after the shell is idle (rIC) rather than on MainLayout mount; keep the leave/disconnect cleanup as is. Infra (other lens): enable Reverb scaling (`REVERB_SCALING_ENABLED` with the existing Valkey) and run ≥ 2 reverb replicas behind the LB; add a k6 WS scenario. No change to channel authorization rules.

**Kiểm chứng:** k6 `ws` scenario: ramp 1k→10k connections to Reverb, subscribe `user.{id}` with real JWTs, measure connection success rate, p95 subscribe time, and php-fpm req/s on /broadcasting/auth; then restart reverb and measure the reconnect burst width (auth req/s over 30 s) before/after jitter. Browser: confirm exactly one WS per tab and zero WS on /login.


### FE-RENDER-09 — No field Web Vitals / RUM: LCP, INP and CLS at scale cannot be observed; the only performance monitor in the codebase is dead code

**Bằng chứng:** grep for `web-vitals`, `onLCP`, `onINP`, `onCLS`, `PerformanceObserver` in non-test src: no hits. performance-monitor.ts exists (custom chunk/API timers gated by `VITE_ENABLE_PERF_MONITOR`, env.ts:184-186) but `grep -rn "performance-monitor" src` finds no importer; preload-manager.ts likewise unreferenced and its route lists are empty. All numbers in FE_PERF_AUDIT_2026-09-06.md are lab (Playwright/CDP on one machine); §7.3 explicitly discards the CPU x4 runs as noisy and §7.6 notes FE was not re-measured on the fixed BE stack.

**Nguyên nhân:** Performance work has been driven by ad-hoc lab scripts (scripts/perf/*.mjs); nothing reports from real users' browsers.

**Ở 10k người dùng:** The 10k target cannot be verified from the client side: regressions in INP (the class of bug found at 14.7 s) or LCP on warehouse hardware will only be found by user complaints, and there is no way to attribute slowness to network (VPS/CDN), BE latency, or main-thread work per route.

**Sửa thế nào:** Add the `web-vitals` package (≈ 2 KB gz) in main.tsx after first paint: `onLCP/onINP/onCLS/onTTFB` with attribution build, sample 2–5% of sessions, batch via `navigator.sendBeacon` to a tiny BE endpoint (or the existing audit/log sink) tagged with route, build id (`__APP_BUILD_ID__`), and device memory/hardwareConcurrency; delete performance-monitor.ts and preload-manager.ts (dead). Respect the SW denylist (beacon goes to /api, which the SW already ignores).

**Kiểm chứng:** Dashboard of p75 LCP/INP/CLS per route and per build id; assert p75 INP < 200 ms and LCP < 2.5 s on /dashboard and the 8 report routes over a week of real traffic; use it as the acceptance gate for FE-RENDER-01/02/03 instead of lab-only numbers.


## 6. Chưa đo được

- Actual response sizes for /reports/inventory-ledger, /reports/inventory-balance, /reports/warranty-defects pages, /label-print-events, /reports/outbound-by-recipient, /warranty-cases, /component-issue-documents and /users?per_page=200 — only dashboard (5–20 KB), inventory-xnt-enhanced (159 KB), document-history (461 KB) and movement-trace (2.1–4.3 MB) have recorded numbers (docs/cache/CACHE_POLICY.md:87-89, FE_PERF_AUDIT §6).
- Compressed (gzip) wire size of the report payloads; nginx gzip is enabled (docker/nginx/default.conf.template:44-49) but no compressed sizes are recorded.
- Whether load/k6/lib/flows.js models the dashboard 60 s polling cadence, report-page revisits, or the per-reload /auth/refresh rotation; not read in this lens.
- Server cost per GET /auth/me and per POST /auth/refresh (row-locked rotation + synchronous audit insert) at 10k users; reload frequency of warehouse staff is unknown.
- Frequency of concurrent multi-tab reloads (refresh-token replay → whole-session revoke) in real usage.
- How often the 365-day coverage probe fires in practice and its payload for movement-trace over a full year.
- Reverb capacity (memory/CPU) at 10k concurrent WebSocket connections and the size of the /broadcasting/auth burst on reconnect; production REVERB_* configuration is not visible in either repo.
- Cross-page dedup benefit of unifying report query keys (depends on how often a user opens several report pages within the 5-minute staleTime).
- Bytes wasted by superseded search requests (no AbortSignal) — depends on typing patterns.
- Whether every /reports/* and list endpoint referenced here is among the 55/84 cached BE endpoints — only the ones checked in this lens (dashboard, report TTLs, notifications unread-count, /users uncached per PERF_AUDIT §4 D) are confirmed.
- Field LCP / INP / CLS / TTFB on any page (no RUM; only lab transition timings exist in docs/perf/FE_PERF_AUDIT_2026-09-06.md §3/§7.3, and the CPU x4 runs there are flagged as noisy).
- Cold-F5 waterfall timing (index.html → refresh → IDB → MainLayout → page chunk → data) on the fixed /srv/app BE stack — FE audit §7.6 says FE was not re-measured after the BE fix; the five-hop chain in FE-RENDER-01 is established from source/dist, its duration is not.
- Main-thread parse/compile/evaluate time of the 1.24 MB entry graph and of antd cssinjs style injection at boot on a CPU x4 profile (Lighthouse/CDP trace not run — no builds/browsers started per the read-only rule).
- Production static hosting of khohoanamfe.bigk.click: compression (gzip/brotli), `Cache-Control: immutable` for hashed assets, HTTP/2 or HTTP/3 — the FE repo has no server config; the BE nginx template (docker/nginx/default.conf.template:44-56) gzips but has no `expires`/`immutable` and serves /var/www/html/public, not the FE dist. Already flagged as out-of-repo in the FE audit §6.
- Exact byte share of MESSAGES_VI inside routes-JjAtcDvK.js (estimated by the EN source→dist ratio; a build with `--sourcemap` + source-map-explorer would give the exact figure).
- Retained heap of KeepAliveOutlet's up to 6 hidden report pages (each holding full row sets such as 5,956 movement-trace rows) on 4 GB warehouse PCs.
- Reverb capacity per connection, memory per WS, and reconnect-burst width after a Reverb restart (no WS scenario in load/k6).
- Real user distribution across routes at 10k concurrency (needed to turn the dashboard polling formula in FE-RENDER-05 into an absolute req/s).
- Icon glyph usage from dynamic slugs (icons chosen from API data, e.g. `icon:` fields coming from nav/config JSON) — the 56-slug count covers string literals in src only; the icon-family.ts comment's 113 suggests a broader registry the guard script sees.
- Emotion runtime style-insertion cost for the ~87 inline `sx` props in MovementTraceReport.tsx (1,539 lines) — noted as ~200 ms/re-render in the FE audit §1.3, accepted there, not re-measured.
