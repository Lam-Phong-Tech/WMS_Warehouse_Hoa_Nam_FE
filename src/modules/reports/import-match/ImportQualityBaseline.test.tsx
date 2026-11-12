import { afterEach, expect, it, vi } from "vitest";
import dayjs from "dayjs";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
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
it("i18n: switches all three KPI hints without remounting", async () => {
  renderWithProviders(<ImportQualityBaseline />);
  expect(await screen.findByText("Trong kỳ báo cáo")).toBeVisible();
  await act(async () => {
    await ensureEnglishMessages();
    useLanguageStore.getState().setLanguage("en");
  });
  expect(screen.getByText("In reporting period")).toBeVisible();
  expect(screen.getByText("Needs review")).toBeVisible();
  expect(screen.getByText("Cannot reconcile")).toBeVisible();
  expect(screen.getByRole("button", { name: "View 0 records" })).toBeVisible();
  expect(screen.queryByText("Trong kỳ báo cáo")).not.toBeInTheDocument();
  act(() => useLanguageStore.getState().setLanguage("vi"));
  expect(screen.getByText("Không thể đối chiếu")).toBeVisible();
});

it("numbers records across pages and resets numbering after filtering or changing page size", async () => {
  await act(async () => {
    renderWithProviders(<ImportQualityBaseline />);
  });
  const table = screen.getByRole("table");
  expect(
    within(table).getByRole("columnheader", { name: "#" }),
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
  fireEvent.mouseDown(
    screen.getByRole("combobox", { name: "Số dòng mỗi trang" }),
  );
  fireEvent.click(screen.getByRole("option", { name: "20 / trang" }));
  expect(numbers()).toEqual(
    Array.from({ length: 12 }, (_, i) => String(i + 1)),
  );
  fireEvent.change(document.querySelector("#rpt04-results input")!, {
    target: { value: "FILE-03" },
  });
  expect(numbers()).toEqual(["1"]);
});
