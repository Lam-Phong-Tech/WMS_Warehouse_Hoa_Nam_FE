# Outbound NFC Design

## Intent

Bring NFC lookup into the existing Xuất kho flow so warehouse staff can inspect each shipped or matched item, its active chip UID, and link history without leaving the outbound context. Remove the separate NFC screen and navigation entry. The Scanner App remains responsible for physical chip writing, confirmation, and revocation.

## Decisions

- Preserve the current outbound list, intake, scan, packing-label, and Post Issue actions. Add a Sản phẩm đã xuất & NFC view inside Xuất kho and a Sản phẩm & NFC tab inside the existing detail dialog.
- The global product view includes only POSTED outbound documents. A specific DRAFT document has no matched items, SCANNING shows its active matches, POSTED shows posted matches, and CANCELLED has no exported-product classification.
- The backend provides one paginated, warehouse-scoped read endpoint for the global view and document view. It filters by document, search text (item code, serial, SKU, UID), and NFC status. Counts are calculated on the complete filtered set, before pagination and before the NFC status chip filter.
- An active NFC tag means ASSIGNED. A successfully read item with no active tag means UNASSIGNED. Failed NFC reads are shown as UNKNOWN with a retry; errors never become UNASSIGNED.
- NFC detail and history stay read-only in the outbound UI. History must include assignment and revocation across all tags that belonged to the item, not only the current chip.
- A user with outbound.view may read NFC data for items in outbound documents within the user's warehouse scope. Existing App Scanner write permissions and routes remain unchanged.
- The old `/nfc` URL redirects to the new outbound product view to preserve bookmarks; its independent page and sidebar entry are removed.

## Approaches considered

1. Make one request per item to existing Mini App tag APIs. This needs extra permissions, scales poorly, and cannot produce authoritative global totals.
2. Reuse the current `/nfc` page inside outbound. It defaults to stock items, has no document filter, and cannot distinguish issued items by phiếu.
3. **Chosen:** Add a bounded outbound read contract and build on the current outbound UI components. This provides correct scope, totals, and UID search while keeping existing operations.

## Visual structure

- Outbound header and status cards stay in place. A two-tab switch sits above the main content: Phiếu xuất kho and Sản phẩm đã xuất & NFC.
- The product tab follows the current table, filter, badge, pagination, and feedback styles. It shows item/serial, SKU, phiếu, UID, NFC state, and Xem. It never presents a chip-write action.
- Detail dialog adds an NFC tab with counts and the per-document product table. Xem opens a read-only product detail with UID, assignment time and actor, and full item NFC history.
- Loading, no data, no search results, list error, and NFC-only error are visually distinct. Counts and item status remain visible if only the NFC request fails.

## Constraints

- Do not change stock movements, Post Issue prerequisites, or existing outbound write paths.
- Do not equate NFC with the legacy RFID endpoint.
- Keep existing Vietnamese copy and responsive design tokens; add English and Chinese translations for new strings using the project's i18n pattern.
- No deployment is part of this change. The two Git worktrees are reviewable outputs.
