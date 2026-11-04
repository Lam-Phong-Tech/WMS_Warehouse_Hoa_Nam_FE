# UI work in Hoa Nam WMS

Before changing UI, read [the canonical UI guide](docs/ui/DESIGN_FOUNDATIONS.md). Use its source hierarchy and the existing project components/tokens.

- For tables, filters and pagination, follow [the user's SKU specification](docs/ui/sku-list-filter-table-style.md); it takes priority over the UI Kit's Data table, filters & pagination section.
- For toasts, follow the supplied HTML reference contract consolidated in section 9 of the canonical guide.
- Keep new shared design decisions in the canonical guide. Do not create another competing design standard.
- Check every explicit user requirement against the resulting code. Report the screens and states actually verified, any remaining mismatch, and verification limits. A changed shared component or an active design document alone does not prove every existing screen conforms.
