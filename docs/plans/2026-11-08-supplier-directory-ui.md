# Supplier directory UI

Build the requested SKU-style list under Danh mục at `/master-data/suppliers`.
Reference: user screenshot, `docs/ui/DESIGN_FOUNDATIONS.md` and
`docs/ui/sku-list-filter-table-style.md` as supplied (preserve their pending edits).

- Add lazy route, navigation/breadcrumb, preload and translated menu labels.
- Use existing shell, semantic operations tokens, UiTextField/UiSelect,
  ActionButton, UiDialog and SKU footer pagination arrangement.
- Table: STT, Mã NCC, Tên nhà cung cấp, Trạng thái, Cập nhật cuối, action.
- Query the authenticated P04 supplier API with server search/pagination.
  Default ACTIVE; offer ACTIVE/INACTIVE, since API has no ALL status contract.
- Gate page/read by inbound.view, writes by catalog.manage. Preserve UUID and
  version; create sends name/status only, edit supplies If-Match.
- Form: automatic read-only code, name (required, max 200), status. Show pending,
  empty, network/API errors, field errors and stale edit recovery. Never retry
  creation automatically after an ambiguous response.
- Test transport and UI behaviors first, run focused tests, typecheck/build,
  lint on changed files and responsive browser checks at 1440/1024/768/390/320.
- User subsequently authorized pushing the supplier changes to dev. Preserve all unrelated
  working changes already present in this checkout.
