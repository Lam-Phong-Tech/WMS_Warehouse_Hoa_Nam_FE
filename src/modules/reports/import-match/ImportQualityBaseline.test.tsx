import { afterEach, expect, it, vi } from "vitest";
import dayjs from "dayjs";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import userEvent from "@testing-library/user-event";
import { useAuthStore } from "@/shared/store/auth.store";
const modeMocks = vi.hoisted(() => ({
  download: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/shared/components/charts/MultiSeriesBarChart", () => ({
  MultiSeriesBarChart: ({ series }: { series: { data: number[] }[] }) => (
    <output data-testid="mode-trend">
      {JSON.stringify(series.map((item) => item.data))}
    </output>
  ),
}));
vi.mock("react-apexcharts", () => ({ default: () => <div /> }));
vi.mock("@/modules/reports/operations/report-data", () => ({
  useSkuCatalog: () => ({ kindOfCode: () => "PRODUCT" }),
  useUserDirectory: () => ({ entries: [] }),
}));
vi.mock("./import-quality-api", async (original) => ({
  ...(await original<object>()),
  downloadImportQualityExport: modeMocks.download,
  useImportQualityBatches: () => ({
    data: Array.from({ length: 12 }, (_, index) => ({
      import_report_id: `batch-${index}`,
      file_name: `FILE-${String(index).padStart(2, "0")}.xlsx`,
      created_at: dayjs().startOf("day").add(index, "minute").toISOString(),
      total_rows: 5,
      valid_rows: 5,
      error_rows: 0,
      mode: index % 2 === 0 ? "DRY_RUN" : "COMMIT",
      status: index % 2 === 0 ? "VALID" : "COMMITTED",
    })),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
import ImportQualityBaseline from "./ImportQualityBaseline";
afterEach(cleanupTestState);
it("replaces SKU type with import mode and keeps rows, metrics, trend, export and reset consistent", async () => {
  modeMocks.download.mockClear();
  useAuthStore.setState({ isSuperAdmin: true });
  const user = userEvent.setup();
  renderWithProviders(<ImportQualityBaseline />);
  const mode = await screen.findByRole("combobox", { name: "Chế độ nhập" });
  expect(
    screen.queryByRole("combobox", { name: "Loại dữ liệu" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "2" }));
  const select = async (label: string) => {
    await user.click(mode);
    await user.click(
      screen.getByRole("option", { name: `Chế độ nhập: ${label}` }),
    );
  };
  await select("Chạy thử");
  let rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  expect(rows).toHaveLength(6);
  expect(
    rows.map((row) => within(row).getAllByRole("cell")[0].textContent),
  ).toEqual(["1", "2", "3", "4", "5", "6"]);
  expect(
    rows.every((row) => /FILE-(00|02|04|06|08|10)/.test(row.textContent ?? "")),
  ).toBe(true);
  expect(screen.getByTestId("mode-trend")).toHaveTextContent("[[30],[0],[0]]");
  expect(screen.getByText("Tổng dòng dữ liệu").parentElement).toHaveTextContent(
    "30",
  );
  await select("Ghi thật");
  rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  expect(rows).toHaveLength(6);
  expect(
    rows.every((row) => /FILE-(01|03|05|07|09|11)/.test(row.textContent ?? "")),
  ).toBe(true);
  await user.click(screen.getByRole("button", { name: "Xuất báo cáo" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Xuất Excel" }));
  expect(modeMocks.download).toHaveBeenCalledWith(
    expect.objectContaining({ mode: "COMMIT" }),
    expect.objectContaining({
      match: expect.objectContaining({
        values: expect.arrayContaining([
          "batch-1",
          "batch-3",
          "batch-5",
          "batch-7",
          "batch-9",
          "batch-11",
        ]),
      }),
    }),
  );
  await user.click(screen.getByRole("button", { name: "Xóa lọc" }));
  expect(mode).toHaveTextContent("Chế độ nhập: Tất cả");
  expect(screen.getByTestId("mode-trend")).toHaveTextContent("[[60],[0],[0]]");
  expect(
    within(screen.getByRole("table")).getAllByRole("row").slice(1),
  ).toHaveLength(10);
});
it("i18n: switches all three KPI hints without remounting", async () => {
  renderWithProviders(<ImportQualityBaseline />);
  expect(await screen.findByText("Trong kỳ báo cáo")).toBeVisible();
  await act(async () => {
    await ensureEnglishMessages();
    useLanguageStore.getState().setLanguage("en");
  });
  expect(screen.getByText("In reporting period")).toBeVisible();
  expect(screen.getByText("Needs review")).toBeVisible();
  expect(screen.getByText("Data to fix before import")).toBeVisible();
  expect(screen.getByRole("button", { name: "View 0 records" })).toBeVisible();
  expect(screen.queryByText("Trong kỳ báo cáo")).not.toBeInTheDocument();
  act(() => useLanguageStore.getState().setLanguage("vi"));
  expect(screen.getByText("Dữ liệu cần sửa trước khi nhập")).toBeVisible();
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
