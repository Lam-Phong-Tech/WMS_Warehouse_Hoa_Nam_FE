import { afterEach, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("../io-history-api", () => ({
  ISO_DATE: "YYYY-MM-DD",
  IO_HISTORY_EXPORT_CODE: "io-history",
  useIoHistorySnapshot: vi.fn(() => ({
    snapshot: {
      rows: [
        {
          id: "out-1",
          documentNo: "PX-20261105-001",
          type: "OUTBOUND",
          status: "POSTED",
          createdAt: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          qty: -1,
          actor: "Quản trị viên 02",
          department: "Kho",
          party: "Đại lý",
          movementCount: 1,
          movementNo: "MV-001",
          originalDocumentNo: "",
          skuLines: ["D034514 · Bộ đầu tuýp 14 chi tiết"],
        },
      ],
      dataAsOf: new Date().toISOString(),
    },
    loading: false,
    fetching: false,
    error: null,
    refetch: vi.fn(async () => {}),
  })),
}));
import Rpt08HistoryReport from "./Rpt08HistoryReport";

afterEach(cleanupTestState);
it("opens transaction details in a right drawer and restores the same report after Escape", async () => {
  const user = userEvent.setup();
  renderWithProviders(<Rpt08HistoryReport />);
  const table = await screen.findByRole("table");
  await user.click(within(table).getByRole("button", { name: "Xem" }));
  const drawer = await screen.findByRole("dialog", {
    name: /Chi tiết giao dịch/,
  });
  expect(drawer.closest(".MuiDrawer-root")).toBeInTheDocument();
  expect(table).toBeInTheDocument();
  expect(
    await within(drawer).findByText(/D034514 · Bộ đầu tuýp 14 chi tiết/),
  ).toBeInTheDocument();
  expect(within(drawer).getByText("Quản trị viên 02")).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("table")).toBe(table);
});
