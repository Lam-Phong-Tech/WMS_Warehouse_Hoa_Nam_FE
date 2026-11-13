import { expect, it } from "vitest";
import { historySearchText, mapLiveRow } from "./model";
import type { IoHistoryRow } from "../io-history-api";

it("indexes every SKU line, party and original document without leaking internal IDs", () => {
  const row = mapLiveRow({
    id: "INTERNAL-UUID",
    documentNo: "PN-01",
    type: "INBOUND",
    status: "POSTED",
    createdAt: "2026-11-13",
    postedAt: "2026-11-13",
    qty: 2,
    actor: "Operator",
    department: "Warehouse",
    party: "Supplier",
    movementCount: 1,
    movementNo: "MV-01",
    originalDocumentNo: "SOURCE-01",
    skuLines: ["SKU-FIRST · First", "SKU-SECOND · Second"],
    lines: [
      { code: "SKU-FIRST", name: "First", qty: 1 },
      { code: "SKU-SECOND", name: "Second", qty: 1 },
    ],
  } satisfies IoHistoryRow)!;
  const text = historySearchText(row).join(" ");
  for (const term of ["SKU-SECOND", "Second", "Supplier", "SOURCE-01"])
    expect(text).toContain(term);
  expect(text).not.toContain("INTERNAL-UUID");
});
