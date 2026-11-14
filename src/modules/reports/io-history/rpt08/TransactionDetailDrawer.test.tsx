import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import type { IoHistoryRow } from "../io-history-api";
import { mapLiveRow } from "./model";
import { TransactionDetailDrawer } from "./TransactionDetailDrawer";

function CurrentLocation() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}

function renderDetail(type: IoHistoryRow["type"], id = "document/id &other=1") {
  const source: IoHistoryRow = {
    id,
    type,
    documentNo: "DOC-001",
    status: "POSTED",
    createdAt: "2026-11-12T04:41:00+07:00",
    postedAt: "2026-11-12T04:41:00+07:00",
    qty: 1,
    actor: "Người ghi nhận",
    department: "Kho",
    party: "Kho Hoa Nam",
    movementCount: 1,
    movementNo: "MV-001",
    originalDocumentNo: "PX-001",
    skuLines: [],
    lines: [],
  };
  renderWithProviders(
    <>
      <TransactionDetailDrawer row={mapLiveRow(source)!} onClose={() => {}} />
      <CurrentLocation />
    </>,
    ["/reports/pending-evidence?screen=RPT-08"],
  );
}

describe("transaction source document navigation", () => {
  afterEach(cleanupTestState);

  it.each([
    ["INBOUND", "Xem chi tiết phiếu nhập", "/inbound", "IN-03"],
    ["OUTBOUND", "Xem chi tiết phiếu xuất", "/outbound", "OUT-02"],
    ["REVERSAL", "Xem chi tiết phiếu đảo", "/reverse", "REV-02"],
  ] as const)(
    "opens the exact %s document using the existing detail screen",
    async (type, name, pathname, detailScreen) => {
      renderDetail(type);
      await waitFor(() =>
        expect(screen.getByText("Người ghi nhận")).toBeVisible(),
      );
      fireEvent.click(screen.getByRole("button", { name }));
      const location = new URL(
        screen.getByTestId("location").textContent!,
        "https://wms.test",
      );
      expect(location.pathname).toBe(pathname);
      expect(location.searchParams.get("screen")).toBe(detailScreen);
      expect(location.searchParams.get("id")).toBe("document/id &other=1");
      expect(location.searchParams.has("other")).toBe(false);
    },
  );

  it.each(["INBOUND", "OUTBOUND", "REVERSAL"] as const)(
    "does not offer a broken %s document link without a source id",
    async (type) => {
      renderDetail(type, "");
      await waitFor(() =>
        expect(screen.getByText("Người ghi nhận")).toBeVisible(),
      );
      expect(
        screen.queryByRole("button", { name: /Xem chi tiết phiếu/ }),
      ).not.toBeInTheDocument();
    },
  );
});
