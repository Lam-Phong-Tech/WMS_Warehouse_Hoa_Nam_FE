# SKU usage and information completeness

User authorized implementation and push to dev following the investigation.

Separate usage status (all/ACTIVE/INACTIVE) from information completeness (all/PENDING/COMPLETE). A SKU is pending when any of brand_id, category_id or model_id is null; complete requires all three. Both filters combine with keyword, type and brand. Show pending status and missing field names alongside the usage badge. Dashboard counts active pending SKUs; its deep link selects ACTIVE and PENDING.

Approaches: client filtering across every page avoids backend changes but transfers the entire catalog. Server filtering before pagination is chosen to give accurate totals and avoid the existing backend cap of 100 rows. Keep shared UI components, semantic colors and responsive filter layout.

No data migration, changes to inbound receipt validation, or automatic activation/deactivation. Deploy backend before frontend.
