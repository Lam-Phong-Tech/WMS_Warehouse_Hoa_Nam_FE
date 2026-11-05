import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/reports/operations/report-data", async (original) => ({
  ...(await original<object>()),
  useSkuCatalog: () => ({ kindOfCode: () => "PRODUCT" }),
  useUserDirectory: () => ({ entries: [] }),
}));
vi.mock("@/shared/components/charts/MultiSeriesBarChart", () => ({
  MultiSeriesBarChart: () => <div />,
}));
vi.mock("./import-quality-api", async (original) => ({
  ...(await original<object>()),
  useImportQualityBatches: () => ({
    data: [
      {
        import_report_id: "batch-1",
        file_name: "danh-muc-sku.xlsx",
        mode: "DRY_RUN",
        status: "VALID",
        total_rows: 5,
        valid_rows: 4,
        error_rows: 1,
        created_at: dayjs().toISOString(),
      },
    ],
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useImportQualityIssues: () => ({
    data: {
      rows: [
        {
          rowNo: 2,
          field: "sku_code",
          code: "INVALID_CODE_FORMAT",
          message: "Mã SKU không hợp lệ",
          rawValue: "???",
          severity: "ERROR",
          suggestedAction: "Kiểm tra mã trong tệp nguồn.",
        },
      ],
      total: 1,
      lastPage: 1,
    },
    isLoading: false,
    error: null,
  }),
}));

import ImportQualityBaseline from "./ImportQualityBaseline";

describe("import quality batch drawer", () => {
  afterEach(cleanupTestState);
  it("opens the selected batch in a drawer and keeps its report mounted", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportQualityBaseline />);
    const reportTable = await screen.findByRole("table");
    const opener = within(reportTable).getByRole("button", {
      name: /danh-muc-sku.xlsx/,
    });
    await user.click(opener);
    const drawer = await screen.findByRole("dialog", { name: /Chi tiết/ });
    expect(drawer.closest(".MuiDrawer-root")).toBeInTheDocument();
    expect(reportTable).toBeInTheDocument();
    expect(
      await within(drawer).findByText("Kiểm tra mã trong tệp nguồn."),
    ).toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBe(reportTable);
  });
});
