import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import dayjs from "dayjs";
import { cleanupTestState } from "@/test/setup";
import { renderWithProviders } from "@/test/test-utils";
import type { FlowDocument, InventoryFlowSnapshot } from "./inventory-flow-api";

const report = vi.hoisted(() => ({ useInventoryFlowSnapshot: vi.fn() }));
vi.mock("./inventory-flow-api", () => ({
  ISO_DATE: "YYYY-MM-DD",
  useInventoryFlowSnapshot: report.useInventoryFlowSnapshot,
}));

import InboundFlowReport from "./InboundFlowReport";

const baseDocument = {
  doc_type: "INBOUND" as const,
  warehouse_code: "KHO-HN",
  created_by_name: "Nguyễn Kho",
  posted_at: "2026-11-03 08:00:00",
  document_date: "2026-11-03",
  drillKey: "",
};
const documents: FlowDocument[] = [
  {
    ...baseDocument,
    id: "alpha",
    document_no: "PN-ALPHA",
    counterpart: "NCC Alpha",
    status: "POSTED",
  },
  {
    ...baseDocument,
    id: "beta",
    document_no: "PN-BETA",
    counterpart: "NCC Beta",
    status: "DRAFT",
  },
];
const laterDocument: FlowDocument = {
  ...baseDocument,
  id: "older",
  document_no: "PN-OLDER",
  counterpart: "NCC Older",
  status: "POSTED",
};
const snapshot = (rows: FlowDocument[]): InventoryFlowSnapshot => ({
  snapshot_id: "test-snapshot",
  as_of: "2026-11-03T14:00:00",
  source_watermark: "2026-11-03T13:00:00",
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
  documents: rows,
  daily: [],
});

function table() {
  return document.querySelector<HTMLTableSectionElement>(
    ".inbound-table-wrap tbody",
  )!;
}

beforeEach(() => {
  report.useInventoryFlowSnapshot
    .mockReset()
    .mockImplementation((range: { from: string }) => ({
      snapshot: snapshot(
        range.from === dayjs().subtract(29, "day").format("YYYY-MM-DD")
          ? [laterDocument]
          : documents,
      ),
      loading: false,
      fetching: false,
      error: null,
      refetch: vi.fn(),
    }));
});
afterEach(() => cleanupTestState());

describe("RPT-01 inbound filters", () => {
  it("applies supplier and status choices immediately without action buttons", () => {
    renderWithProviders(<InboundFlowReport />, [
      "/reports/inventory-flow?screen=RPT-01",
    ]);

    expect(
      screen.queryByText(/ngày gần nhất · Múi giờ Việt Nam/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Khoảng thời gian")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Áp dụng" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Đặt lại" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("combobox", { name: /Chọn nhà cung cấp/ }),
    );
    fireEvent.click(screen.getByRole("option", { name: "NCC Beta" }));
    expect(within(table()).getByText("PN-BETA")).toBeInTheDocument();
    expect(within(table()).queryByText("PN-ALPHA")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("combobox", { name: /Chọn trạng thái phiếu nhập/ }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Chờ duyệt" }));
    expect(within(table()).getByText("PN-BETA")).toBeInTheDocument();
    expect(within(table()).queryByText("PN-ALPHA")).not.toBeInTheDocument();
  });

  it("applies a picked date preset without an Apply click", async () => {
    renderWithProviders(<InboundFlowReport />, [
      "/reports/inventory-flow?screen=RPT-01",
    ]);
    expect(within(table()).getByText("PN-ALPHA")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Từ ngày" }));
    fireEvent.click(screen.getByRole("button", { name: /30 ngày qua/ }));

    expect(await within(table()).findByText("PN-OLDER")).toBeInTheDocument();
    expect(within(table()).queryByText("PN-ALPHA")).not.toBeInTheDocument();
  });

  it("keeps the report range unchanged while only the first date is edited", () => {
    renderWithProviders(<InboundFlowReport />, [
      "/reports/inventory-flow?screen=RPT-01",
    ]);
    const callsBefore = report.useInventoryFlowSnapshot.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Từ ngày" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: dayjs().subtract(1, "day").format("DD/MM/YYYY"),
      }),
    );

    expect(report.useInventoryFlowSnapshot).toHaveBeenCalledTimes(callsBefore);
    expect(within(table()).getByText("PN-ALPHA")).toBeInTheDocument();
  });

  it("applies a complete custom date range without a second Apply button", async () => {
    report.useInventoryFlowSnapshot.mockImplementation(
      (range: { from: string }) => ({
        snapshot: snapshot(
          range.from === dayjs().subtract(2, "day").format("YYYY-MM-DD")
            ? [laterDocument]
            : documents,
        ),
        loading: false,
        fetching: false,
        error: null,
        refetch: vi.fn(),
      }),
    );
    renderWithProviders(<InboundFlowReport />, [
      "/reports/inventory-flow?screen=RPT-01",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Từ ngày" }));
    const calendar = screen.getByRole("dialog", { name: "Khoảng thời gian" });
    expect(
      within(calendar).queryByRole("button", { name: "Áp dụng" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(calendar).getByRole("button", {
        name: dayjs().subtract(2, "day").format("DD/MM/YYYY"),
      }),
    );
    expect(within(table()).getByText("PN-ALPHA")).toBeInTheDocument();
    fireEvent.click(
      within(calendar).getByRole("button", {
        name: dayjs().subtract(1, "day").format("DD/MM/YYYY"),
      }),
    );

    expect(await within(table()).findByText("PN-OLDER")).toBeInTheDocument();
  });

  it("keeps a selected filter visible when a new period has no matching options", () => {
    renderWithProviders(<InboundFlowReport />, [
      "/reports/inventory-flow?screen=RPT-01",
    ]);
    fireEvent.click(
      screen.getByRole("combobox", { name: /Chọn nhà cung cấp/ }),
    );
    fireEvent.click(screen.getByRole("option", { name: "NCC Beta" }));
    fireEvent.click(
      screen.getByRole("combobox", { name: /Chọn trạng thái phiếu nhập/ }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Chờ duyệt" }));

    fireEvent.click(screen.getByRole("button", { name: "Từ ngày" }));
    fireEvent.click(screen.getByRole("button", { name: /30 ngày qua/ }));

    expect(
      screen.getByRole("combobox", { name: "Chọn nhà cung cấp: NCC Beta" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", {
        name: "Chọn trạng thái phiếu nhập: Chờ duyệt",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("PN-OLDER")).not.toBeInTheDocument();
  });

  it.each([
    ["Chọn nhà cung cấp", "NCC Beta"],
    ["Chọn trạng thái phiếu nhập", "Chờ duyệt"],
  ])("resets the document page when %s changes", (filterName, optionName) => {
    const manyDocuments: FlowDocument[] = [
      ...Array.from({ length: 10 }, (_, index) => ({
        ...documents[0],
        id: `alpha-${index}`,
        document_no: `PN-ALPHA-${index}`,
      })),
      documents[1],
    ];
    report.useInventoryFlowSnapshot.mockImplementation(() => ({
      snapshot: snapshot(manyDocuments),
      loading: false,
      fetching: false,
      error: null,
      refetch: vi.fn(),
    }));
    renderWithProviders(<InboundFlowReport />, [
      "/reports/inventory-flow?screen=RPT-01",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(within(table()).getByText("PN-BETA")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("combobox", { name: new RegExp(filterName) }),
    );
    fireEvent.click(screen.getByRole("option", { name: optionName }));
    expect(within(table()).getByText("PN-BETA")).toBeInTheDocument();
  });
});
