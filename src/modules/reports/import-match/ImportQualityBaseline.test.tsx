import { afterEach, expect, it, vi } from "vitest";
import dayjs from "dayjs";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
vi.mock("react-apexcharts", () => ({ default: () => <div /> }));
vi.mock("@/modules/reports/operations/report-data", () => ({
  useSkuCatalog: () => ({ kindOfCode: () => "PRODUCT" }),
  useUserDirectory: () => ({ entries: [] }),
}));
vi.mock("./import-quality-api", async (original) => ({
  ...(await original<object>()),
  useImportQualityBatches: () => ({
    data: Array.from({ length: 12 }, (_, index) => ({
      import_report_id: `batch-${index}`,
      file_name: `FILE-${String(index).padStart(2, "0")}.xlsx`,
      created_at: dayjs().startOf("day").add(index, "minute").toISOString(),
      total_rows: 5,
      valid_rows: 5,
      error_rows: 0,
    })),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
import ImportQualityBaseline from "./ImportQualityBaseline";
afterEach(cleanupTestState);
it("numbers records across pages and resets numbering after filtering or changing page size", async () => {
  await act(async () => {
    renderWithProviders(<ImportQualityBaseline />);
  });
  const table = screen.getByRole("table");
  expect(
    within(table).getByRole("columnheader", { name: "STT" }),
  ).toBeInTheDocument();
  const numbers = () =>
    within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0].textContent);
  expect(numbers()).toEqual(
    Array.from({ length: 10 }, (_, i) => String(i + 1)),
  );
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  expect(numbers()).toEqual(["11", "12"]);
  fireEvent.change(
    screen.getByRole("combobox", { name: "Số dòng mỗi trang" }),
    { target: { value: "20" } },
  );
  expect(numbers()).toEqual(
    Array.from({ length: 12 }, (_, i) => String(i + 1)),
  );
  fireEvent.change(document.querySelector("#rpt04-results input")!, {
    target: { value: "FILE-03" },
  });
  expect(numbers()).toEqual(["1"]);
});
