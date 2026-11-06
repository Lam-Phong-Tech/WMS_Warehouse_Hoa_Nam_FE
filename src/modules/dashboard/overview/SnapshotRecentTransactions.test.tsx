import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIoHistorySnapshot } from "@/modules/reports/io-history/io-history-api";
import { SnapshotRecentTransactions } from "./SnapshotRecentTransactions";

vi.mock("@/modules/reports/io-history/io-history-api", () => ({
  useIoHistorySnapshot: vi.fn(),
}));

afterEach(cleanup);

describe("recent transaction report links", () => {
  it.each([
    ["INBOUND", "/reports/inventory-flow?screen=RPT-01&document=selected-id"],
    ["OUTBOUND", "/reports/outbound-flow?screen=RPT-01B&document=selected-id"],
    [
      "REVERSAL",
      "/reports/pending-evidence?screen=RPT-08",
    ],
  ])("opens the selected %s document in its matching view", (type, route) => {
    vi.mocked(useIoHistorySnapshot).mockReturnValue({
      snapshot: {
        rows: [
          {
            id: "another-id",
            documentNo: "OTHER",
            type: "INBOUND",
            postedAt: "2026-11-06T04:00:00Z",
            qty: 1,
          },
          {
            id: "selected-id",
            documentNo: "SELECTED",
            type,
            postedAt: "2026-11-06T04:30:00Z",
            qty: 1,
          },
        ],
      },
      loading: false,
      error: null,
    } as never);
    const navigate = vi.fn();
    render(<SnapshotRecentTransactions onNavigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Xem SELECTED" }));
    expect(navigate).toHaveBeenCalledExactlyOnceWith(route);
  });
});
