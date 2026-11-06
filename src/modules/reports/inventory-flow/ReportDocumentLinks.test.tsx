import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import InboundFlowReport from "./InboundFlowReport";
import OutboundFlowReport from "./OutboundFlowReport";

vi.mock("./inventory-flow-api", () => ({
  ISO_DATE: "YYYY-MM-DD",
  useInventoryFlowSnapshot: () => ({
    snapshot: {
      rows: [],
      documents: [],
      ledger: [],
      daily: [],
      summary: {
        opening: 0,
        receiptNet: 0,
        issueNet: 0,
        componentNet: 0,
        reversalUnlinked: 0,
        closing: 0,
      },
      snapshot_id: "links",
      as_of: "2026-11-06T10:00:00Z",
      source_watermark: "",
      warehouse_code: "HN",
    },
    loading: false,
    fetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock("./InboundReportDetail", () => ({
  InboundReportDetail: ({
    document,
    onBack,
  }: {
    document: { id: string };
    onBack: () => void;
  }) => (
    <section data-testid="inbound-detail" data-document-id={document.id}>
      <button onClick={onBack}>Đóng chi tiết</button>
    </section>
  ),
}));
vi.mock("@/modules/outbound/components/AlignedOutboundDetailModal", () => ({
  AlignedOutboundDetailModal: ({
    documentId,
    onClose,
  }: {
    documentId: string;
    onClose: () => void;
  }) => (
    <section data-testid="outbound-detail" data-document-id={documentId}>
      <button onClick={onClose}>Đóng chi tiết</button>
    </section>
  ),
}));
vi.mock("@/modules/outbound/services/alignedOutboundService", () => ({
  fetchOutboundDocuments: vi.fn(async () => ({
    data: [],
    meta: { last_page: 1 },
  })),
}));

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

afterEach(cleanupTestState);

describe("report document deep links", () => {
  it.each([
    ["inbound", "/reports/inventory-flow?screen=RPT-01&document=selected-id"],
    ["outbound", "/reports/outbound-flow?screen=RPT-01B&document=selected-id"],
  ])(
    "opens and closes the exact %s document even outside the loaded report list",
    async (direction, route) => {
      renderWithProviders(
        <>
          {direction === "inbound" ? (
            <InboundFlowReport />
          ) : (
            <OutboundFlowReport />
          )}
          <CurrentLocation />
        </>,
        [route],
      );
      expect(await screen.findByTestId(`${direction}-detail`)).toHaveAttribute(
        "data-document-id",
        "selected-id",
      );
      fireEvent.click(screen.getByRole("button", { name: "Đóng chi tiết" }));
      expect(
        screen.queryByTestId(`${direction}-detail`),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("location").textContent).toContain(
        "screen=RPT-01",
      );
      expect(screen.getByTestId("location").textContent).not.toContain(
        "document=",
      );
    },
  );
});
