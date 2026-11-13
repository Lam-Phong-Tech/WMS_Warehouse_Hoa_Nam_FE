import { expect, it } from "vitest";
import { countPostedSkus } from "./posted-sku-count";
import type { FlowDocument, LedgerMovement } from "./inventory-flow-api";

it("counts distinct posted SKU across lines and movements, restricted to filtered documents and movement types", () => {
  const document = {
    document_no: "PN-1",
    reportLines: [
      { sku: "A", posted: 2 },
      { sku: "B", posted: 1 },
      { sku: "NOT-POSTED", posted: 0 },
    ],
  } as FlowDocument;
  const movement = (source: string, sku: string, type = "RECEIPT", qty = 1) =>
    ({
      source_document_no: source,
      sku_code: sku,
      movement_type: type,
      qty_delta: qty,
    }) as LedgerMovement;
  expect(
    countPostedSkus(
      [document],
      [
        movement("PN-1", "A"),
        movement("PN-1", "C"),
        movement("OTHER", "EXCLUDED"),
        movement("PN-1", "ISSUED", "ISSUE", -1),
        movement("PN-1", "ZERO", "RECEIPT", 0),
      ],
      ["RECEIPT"],
    ),
  ).toBe(3);
  expect(countPostedSkus([], [movement("PN-1", "A")], ["RECEIPT"])).toBe(0);
  expect(
    countPostedSkus(
      [{ document_no: "CID-1" } as FlowDocument],
      [movement("CID-1", "COMP", "COMPONENT_ISSUE", -4)],
      ["ISSUE", "COMPONENT_ISSUE"],
    ),
  ).toBe(1);
});
