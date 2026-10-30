import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import type { FlowDocument, InventoryFlowSnapshot } from "./inventory-flow-api";

const documents: FlowDocument[] = Array.from({ length: 6 }, (_, index) => ({
  id: `doc-${index + 1}`,
  document_no: `PN-${String(index + 1).padStart(4, "0")}`,
  doc_type: "INBOUND",
  status: "POSTED",
  warehouse_code: "KHO-HN",
  counterpart: "NCC Alpha",
  created_by_name: "Nguyễn Kho",
  posted_at: `2026-10-30 ${String(index + 8).padStart(2, "0")}:00:00`,
  document_date: "2026-10-30",
  drillKey: "",
}));

const snapshot: InventoryFlowSnapshot = {
  snapshot_id: "test-snapshot",
  as_of: "2026-10-30T14:00:00",
  source_watermark: "2026-10-30T13:00:00",
  warehouse_code: "KHO-HN",
  rows: [],
  summary: {
    opening: 0,
    receiptNet: 0,
    issueNet: 0,
    componentNet: 0,
    reversalUnlinked: 0,
    closing: 0,
  },
  ledger: [],
  documents,
  daily: [],
};

vi.mock("./inventory-flow-api", () => ({
  ISO_DATE: "YYYY-MM-DD",
  useInventoryFlowSnapshot: () => ({
    snapshot,
    loading: false,
    fetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import InboundFlowReport from "./InboundFlowReport";

describe("RPT-01 · sắp xếp ngày nhập", () => {
  it("đổi giữa mới nhất và cũ nhất trước khi phân trang", () => {
    renderWithProviders(<InboundFlowReport />, [
      "/reports/inventory-flow?screen=RPT-01",
    ]);

    const firstRow = () =>
      within(document.querySelector(".inbound-table-wrap tbody")!).getAllByRole(
        "row",
      )[0];
    const sortButton = screen.getByRole("button", {
      name: "Sắp xếp ngày nhập: mới nhất trước",
    });

    fireEvent.click(sortButton);
    expect(firstRow()).toHaveTextContent("PN-0006");
    expect(sortButton.closest("th")).toHaveAttribute("aria-sort", "descending");

    fireEvent.click(sortButton);
    expect(firstRow()).toHaveTextContent("PN-0001");
    expect(sortButton.closest("th")).toHaveAttribute("aria-sort", "ascending");
  });

  it("chọn 5, 8, 10 hoặc 15 phiếu mỗi trang và quay về trang đầu", () => {
    renderWithProviders(<InboundFlowReport />, [
      "/reports/inventory-flow?screen=RPT-01",
    ]);

    const rows = () =>
      within(document.querySelector(".inbound-table-wrap tbody")!).getAllByRole(
        "row",
      );
    const pageSize = screen.getByRole("combobox", {
      name: "Số dòng mỗi trang",
    });
    expect(
      within(pageSize)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["5", "8", "10", "15"]);
    expect(rows()).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(rows()).toHaveLength(1);

    for (const size of [8, 10, 15]) {
      fireEvent.change(pageSize, { target: { value: String(size) } });
      expect(rows()).toHaveLength(6);
      expect(rows()[0]).toHaveTextContent("PN-0001");
    }

    fireEvent.change(pageSize, { target: { value: "5" } });
    expect(rows()).toHaveLength(5);
    expect(rows()[0]).toHaveTextContent("PN-0001");
  });
});
