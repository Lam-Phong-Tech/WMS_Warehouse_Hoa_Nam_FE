# Operational table synchronization

The Web WMS must show committed Mini App inbound/outbound changes without a page reload, including when the same account performs the action or business notifications are disabled. Related operational lists, stock, putaway, physical codes, warranty, labels, master lists and reports must follow the same read synchronization path.

Remove the healthy Dashboard metadata row (today/data-as-of/trend) and its refresh button. The shell synchronization owns automatic updates, including recovery reads; remove the old separate Dashboard interval. Keep error/partial-data retry controls for recovery. Preserve the greeting, period selector, chart/table selection and pagination.

Use an authenticated, preference-independent `warehouse-data` private channel. The `.warehouse.data.changed` event contains only `{ domain: "warehouse" }`; existing HTTP APIs remain responsible for authorization and warehouse scope. Emit after committed read-cache invalidation, including stock-neutral edits and putaway create/cancel. Realtime failures must not fail a committed mutation.

The frontend batches signals and refreshes existing safe read queries. It marks inactive queries stale but fetches only active observers; React Activity detaches hidden-page observers. Never reset filters, page, selected tab, or editable drafts. Exclude queries that hydrate unsaved editors until their own ownership/version semantics are safe. Convert manually loaded physical-code tables to the shared query path and resolve selected read-only records from refreshed rows.

Reconcile after subscription/reconnection, focus/visibility restoration and network recovery. Use a 30-second fallback only while visible, online and authenticated. Pending work is cancelled across authentication/scope changes. A signal arriving during an existing request must result in a fresh subsequent read rather than being lost to an older response.

Validate live table updates, actor/preferences independence, commit/rollback ordering, bursts, in-flight requests, inactive pages, offline/hidden behavior, account/context changes, and draft preservation. Use controlled API/socket fixtures for UI checks; do not create test business records in the live database.
