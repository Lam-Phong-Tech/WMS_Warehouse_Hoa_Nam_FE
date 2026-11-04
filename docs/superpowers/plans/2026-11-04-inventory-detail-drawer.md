# Inventory detail drawer implementation plan

**Goal:** Right-side stock detail with readable products and no horizontal scrolling.

**Architecture:** Keep the current hooks, API fields, permissions and BOX/trace actions. Use the shared UiDrawer at 800px, compact identity, and four tabs. A local record-list component replaces wide tables with expandable label/value records and local pagination.

**Design source:** docs/ui/DESIGN_FOUNDATIONS.md, sections 4–6; user request and screenshots dated 04/11/2026.

- [x] Convert BalanceDetailModal.tsx to the shared drawer with overview/products/containers/movements tabs. Retain all quantities and metadata; add translated labels.
- [x] Add InventoryRecordList.tsx and scoped CSS. Preserve every record field, expand vertically, wrap long identifiers, paginate locally, and keep one main scroll region.
- [x] Adapt existing unit checks for tab navigation, empty/error/loading states, BOX links and trace permissions. Verify real browser layout at 1440/1024/768/390/320px including long codes and expanded products.
- [x] Record the reusable narrow-drawer rule in the canonical guide; review production changes.
- [x] Finish shared-component verification and document unrelated failures. Delivery uses the SHA-bound dev CI/deploy pipeline after commit and push.

## Verification notes

- Inventory page: 15 tests passed. Detail drawer: 11 tests passed.
- Typecheck and focused ESLint passed.
- Browser cases passed at light 1440/1024/768/390/320 and dark 390; targeted mobile checks repeated after header/contrast refinements.
- UI token audit reports 35 existing violations in untouched files; the inventory drawer changes add no reported token violations.
- Shared UI checks: 317 passed, 6 failed outside inventory. Five UiAddressField cases fail in setup because window.localStorage is undefined under local Node 26; the unchanged nav-icon test expects 10 entries while its unchanged registry has 11.
