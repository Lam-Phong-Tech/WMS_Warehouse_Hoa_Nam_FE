import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import dayjs from "dayjs";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useIoHistorySnapshot } from "../io-history-api";
import Rpt08HistoryReport from "./Rpt08HistoryReport";

vi.mock("../io-history-api", () => ({
  ISO_DATE: "YYYY-MM-DD",
  IO_HISTORY_EXPORT_CODE: "io-history",
  useIoHistorySnapshot: vi.fn(() => ({
    snapshot: { rows: [], dataAsOf: null },
    loading: false,
    fetching: false,
    error: null,
    refetch: vi.fn(),
  })),
}));
afterEach(cleanupTestState);
it("applies transaction type immediately to the report query", () => {
  renderWithProviders(<Rpt08HistoryReport />);
  fireEvent.click(screen.getByRole("combobox", { name: "Loại giao dịch" }));
  fireEvent.click(screen.getByRole("option", { name: /Xuất kho$/ }));
  expect(useIoHistorySnapshot).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: "OUTBOUND" }),
  );
});
it("applies dates automatically without an Apply button", async () => {
  renderWithProviders(<Rpt08HistoryReport />);
  fireEvent.click(screen.getByRole("button", { name: "Từ ngày" }));
  const panel = await screen.findByRole("dialog");
  expect(
    within(panel).queryByRole("button", { name: "Áp dụng" }),
  ).not.toBeInTheDocument();
  fireEvent.click(within(panel).getByRole("button", { name: "Hôm qua" }));
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
  expect(useIoHistorySnapshot).toHaveBeenLastCalledWith(
    expect.objectContaining({ from: yesterday, to: yesterday }),
  );
});

it("opens the date picker from the empty table without resetting the current range", async () => {
  renderWithProviders(<Rpt08HistoryReport />);
  fireEvent.click(screen.getByRole("button", { name: "Từ ngày" }));
  fireEvent.click(screen.getByRole("button", { name: "Hôm qua" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Điều chỉnh khoảng thời gian" }),
  );
  const panel = await screen.findByRole("dialog");
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
  expect(useIoHistorySnapshot).toHaveBeenLastCalledWith(
    expect.objectContaining({ from: yesterday, to: yesterday }),
  );
  fireEvent.click(within(panel).getByRole("button", { name: "Hôm nay" }));
  const today = dayjs().format("YYYY-MM-DD");
  expect(useIoHistorySnapshot).toHaveBeenLastCalledWith(
    expect.objectContaining({ from: today, to: today }),
  );
});
