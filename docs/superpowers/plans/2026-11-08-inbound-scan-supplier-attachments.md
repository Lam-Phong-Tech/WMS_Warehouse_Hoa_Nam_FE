# Inbound scan drawer: supplier + attachments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the supplier and read-only attachments (only when present) in the inbound scan drawer.

**Architecture:** Reuse the shared `DocumentAttachmentsPanel` with a new `hideWhenEmpty` prop; add a supplier cell to the existing info grid. No API changes.

**Tech Stack:** React + MUI + TanStack Query, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-08-inbound-scan-supplier-attachments-design.md`

## Global Constraints

- Attachments in the drawer are view/download only (`disabled`).
- Attachments block renders only when the receipt has at least one file.
- Supplier label: `MÃ - Tên`, fallback `Tên`, empty → `—` (`EMPTY_TEXT`).
- All user-facing strings go through i18n (vi/en/zh).

## Review Focus

- Panel still shows its normal empty state everywhere `hideWhenEmpty` is not set.
- Hooks keep running unconditionally before the early return.
- Drawer layout does not push the scan input off-screen on mobile widths.
- Supplier is absent on old receipts → cell shows `—`, no crash.
- Attachment fetch failure in the drawer does not hide the rest of the drawer.

---

### Task 1: `hideWhenEmpty` on `DocumentAttachmentsPanel`

**Files:**
- Modify: `src/shared/components/DocumentAttachmentsPanel.tsx:56-63, 233-240`
- Test: `src/shared/components/DocumentAttachmentsPanel.test.tsx`

**Interfaces:**
- Produces: `DocumentAttachmentsPanelProps.hideWhenEmpty?: boolean`.

- [ ] **Step 1: Write failing tests**

In `DocumentAttachmentsPanel.test.tsx`, add a describe block:

```tsx
describe("DocumentAttachmentsPanel — hideWhenEmpty", () => {
  it("không render gì khi phiếu chưa có chứng từ", async () => {
    vi.mocked(fetchDocumentAttachments).mockResolvedValue({
      attachments: [],
      evidence_status: "NOT_REQUIRED",
    } as never);
    const { container } = renderWithProviders(
      <DocumentAttachmentsPanel
        documentType="INBOUND"
        documentId="doc-1"
        disabled
        hideWhenEmpty
      />,
    );
    await waitFor(() =>
      expect(fetchDocumentAttachments).toHaveBeenCalledWith("INBOUND", "doc-1"),
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("vẫn render khối khi phiếu có chứng từ", async () => {
    vi.mocked(fetchDocumentAttachments).mockResolvedValue({
      attachments: [
        {
          id: "att-1",
          document_type: "INBOUND",
          document_id: "doc-1",
          attachment_type: "SOURCE_DOCUMENT",
          file_name: "chung-tu.pdf",
          content_type: "application/pdf",
          file_size_bytes: 2048,
          status: "ACTIVE",
        },
      ],
      evidence_status: "PROVIDED",
    } as never);
    renderWithProviders(
      <DocumentAttachmentsPanel
        documentType="INBOUND"
        documentId="doc-1"
        disabled
        hideWhenEmpty
      />,
    );
    expect(
      await screen.findByText("Chứng từ đính kèm (1)"),
    ).toBeInTheDocument();
  });
});
```

Add `screen` to the existing `@testing-library/react` import.

- [ ] **Step 2: Run tests, expect failure**

`npx vitest run src/shared/components/DocumentAttachmentsPanel.test.tsx -t "hideWhenEmpty"`
Expected: FAIL (unknown prop / panel still renders).

- [ ] **Step 3: Implement**

Add to props + destructuring:

```ts
/** Chỉ hiện khối khi phiếu đã có ít nhất một chứng từ. */
hideWhenEmpty?: boolean;
```

After `const attachments = ...`:

```ts
if (hideWhenEmpty && query.isSuccess && attachments.length === 0) return null;
```

- [ ] **Step 4: Run tests, expect pass**

`npx vitest run src/shared/components/DocumentAttachmentsPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/DocumentAttachmentsPanel.tsx src/shared/components/DocumentAttachmentsPanel.test.tsx
git commit -m "feat(attachments): add hideWhenEmpty to document attachments panel"
```

---

### Task 2: Supplier + attachments in the scan drawer

**Files:**
- Modify: `src/modules/inbound/pages/MvpInboundScreens.tsx` (imports, info grid, block after summary)
- Modify: `src/modules/inbound/pages/inbound-scan-drawer.css`
- Modify: `src/shared/i18n/messages.ts`, `messages.en.ts`, `messages.zh.ts`
- Test: `src/modules/inbound/pages/InboundScanModal.test.tsx`

**Interfaces:**
- Consumes: `DocumentAttachmentsPanel` with `hideWhenEmpty` (Task 1); `InboundDetail.supplier`.

- [ ] **Step 1: Write failing tests**

Mock the panel in `InboundScanModal.test.tsx`:

```tsx
vi.mock("@/shared/components/DocumentAttachmentsPanel", () => ({
  DocumentAttachmentsPanel: (props: {
    documentType: string;
    documentId: string;
    disabled?: boolean;
    hideWhenEmpty?: boolean;
  }) => (
    <div
      data-testid="attachments-panel"
      data-document-type={props.documentType}
      data-document-id={props.documentId}
      data-disabled={String(props.disabled)}
      data-hide-when-empty={String(props.hideWhenEmpty)}
    />
  ),
}));
```

Tests:

```tsx
it("hiển thị nhà cung cấp của phiếu", async () => {
  mockHooks();
  vi.mocked(useInboundDetail).mockReturnValue({
    data: {
      ...DETAIL,
      supplier: { id: "SUP-3", code: "NCC-003", name: "Kubota Việt Nam" },
    },
    isLoading: false,
    isError: false,
  } as never);
  renderWithProviders(<InboundScanModal documentId="IN-1" onClose={vi.fn()} />);
  expect(await screen.findByText("Nhà cung cấp")).toBeInTheDocument();
  expect(screen.getByText("NCC-003 - Kubota Việt Nam")).toBeInTheDocument();
});

it("hiển thị — khi phiếu không có nhà cung cấp", async () => {
  mockHooks();
  renderWithProviders(<InboundScanModal documentId="IN-1" onClose={vi.fn()} />);
  expect(await screen.findByText("Nhà cung cấp")).toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
});

it("gắn khối chứng từ đính kèm chế độ chỉ xem, ẩn khi rỗng", async () => {
  mockHooks();
  renderWithProviders(<InboundScanModal documentId="IN-1" onClose={vi.fn()} />);
  const panel = await screen.findByTestId("attachments-panel");
  expect(panel).toHaveAttribute("data-document-type", "INBOUND");
  expect(panel).toHaveAttribute("data-document-id", "IN-1");
  expect(panel).toHaveAttribute("data-disabled", "true");
  expect(panel).toHaveAttribute("data-hide-when-empty", "true");
});
```

- [ ] **Step 2: Run tests, expect failure**

`npx vitest run src/modules/inbound/pages/InboundScanModal.test.tsx -t "nhà cung cấp|chứng từ đính kèm"`
Expected: FAIL.

- [ ] **Step 3: Implement drawer + i18n**

- Add `fieldSupplier: "Nhà cung cấp"` / `"Supplier"` / `"供应商"` under `inbound.detail`.
- Import `DocumentAttachmentsPanel`.
- Compute:

```ts
const supplier = detail?.supplier;
const supplierLabel = supplier
  ? [supplier.code, supplier.name].filter(Boolean).join(" - ")
  : "";
```

- Insert a `<Grid size={{ xs: 6, sm: 3 }}>` cell after the warehouse cell with
  label `t("inbound.detail.fieldSupplier")` and value
  `supplierLabel || EMPTY_TEXT`; change the note cell to `size={{ xs: 12 }}`.
- After the summary `</Box>`, before `{isMutable ? (`:

```tsx
<Box className="hn-inbound-scan-attachments">
  <DocumentAttachmentsPanel
    documentType="INBOUND"
    documentId={documentId}
    disabled
    hideWhenEmpty
  />
</Box>
```

- CSS:

```css
.hn-inbound-scan-attachments {
  margin-bottom: 16px;
}

.hn-inbound-scan-attachments:empty {
  display: none;
}
```

- [ ] **Step 4: Run tests, expect pass**

`npx vitest run src/modules/inbound src/shared/components/DocumentAttachmentsPanel.test.tsx --maxWorkers=2`
Expected: PASS (except pre-existing upstream failures unrelated to this change).

- [ ] **Step 5: Commit**

```bash
git add src/modules/inbound/pages/MvpInboundScreens.tsx \
  src/modules/inbound/pages/inbound-scan-drawer.css \
  src/modules/inbound/pages/InboundScanModal.test.tsx \
  src/shared/i18n/messages.ts src/shared/i18n/messages.en.ts src/shared/i18n/messages.zh.ts
git commit -m "feat(inbound): show supplier and attachments in scan drawer"
```

---

### Task 3: Verify and push

- [ ] **Step 1:** `npx tsc -b --pretty false` → OK.
- [ ] **Step 2:** `npx eslint --config eslint.config.js src/modules/inbound/pages/MvpInboundScreens.tsx src/shared/components/DocumentAttachmentsPanel.tsx` → OK.
- [ ] **Step 3:** `git fetch origin dev`; confirm `origin/dev` is an ancestor of HEAD.
- [ ] **Step 4:** `git push origin HEAD:dev`.
