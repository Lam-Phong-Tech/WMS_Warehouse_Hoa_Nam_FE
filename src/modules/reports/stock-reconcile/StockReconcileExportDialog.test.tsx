import { useAuthStore } from "@/shared/store/auth.store";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/shared/utils/report-excel-style", () => ({
  saveStyledReportWorkbook: vi.fn().mockResolvedValue(undefined),
}));
import { saveStyledReportWorkbook } from "@/shared/utils/report-excel-style";

import * as XLSX from "xlsx";
import { StockReconcileExportDialog } from "./StockReconcileExportDialog";

describe("StockReconcileExportDialog", () => {
  afterEach(cleanupTestState);
  beforeEach(() => useAuthStore.setState({ isSuperAdmin: true }));

  it.each([
    ["2026-11-06T03:49:55.937Z", "06/11/2026 10:49:55 (UTC+7)"],
    ["2026-11-05T20:30:00Z", "06/11/2026 03:30:00 (UTC+7)"],
    ["2026-11-06T10:49:55+07:00", "06/11/2026 10:49:55 (UTC+7)"],
    ["2026-11-06 10:49:55", "06/11/2026 10:49:55 (UTC+7)"],
    ["", "2026-11-06"],
    ["invalid", "2026-11-06"],
  ])(
    "displays data timestamp %s in Vietnam time or the report end date",
    (asOf, expected) => {
      renderWithProviders(
        <StockReconcileExportDialog
          rows={[]}
          from="2026-10-31"
          to="2026-11-06"
          asOf={asOf}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText(expected, { exact: true })).toBeInTheDocument();
    },
  );

  it("exports only review SKUs and the selected sheets", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <StockReconcileExportDialog
        rows={[
          {
            skuCode: "A",
            skuName: "Pin A",
            warehouse: "HN01",
            kind: "COMPONENT",
            opening: 10,
            inbound: 0,
            productOutbound: 0,
            componentOutbound: 0,
            reversal: 0,
            closing: 10,
            ledgerStock: 10,
            actual: 9,
            delta: -1,
            mismatch: true,
          },
          {
            skuCode: "B",
            skuName: "Pin B",
            warehouse: "HN01",
            kind: "COMPONENT",
            opening: 5,
            inbound: 0,
            productOutbound: 0,
            componentOutbound: 0,
            reversal: 0,
            closing: 5,
            ledgerStock: 5,
            actual: 5,
            delta: 0,
            mismatch: false,
          },
        ]}
        from="2026-10-24"
        to="2026-10-30"
        asOf="2026-10-30T14:30:00Z"
        onClose={onClose}
      />,
    );

    fireEvent.click(
      await screen.findByRole("radio", { name: /Chỉ SKU cần kiểm tra/ }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Tổng hợp tồn" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Nhập – Xuất – Tồn" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Tên tệp xuất" }), {
      target: { value: "DoiSoat-CanKiemTra" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xuất Excel" }));

    expect(saveStyledReportWorkbook).toHaveBeenCalledOnce();
    const [workbook, filename] = vi.mocked(saveStyledReportWorkbook).mock
      .calls[0];
    expect(filename).toBe("DoiSoat-CanKiemTra.xlsx");
    expect(workbook.SheetNames).toEqual(["Chi tiết đối soát"]);
    const exported = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets["Chi tiết đối soát"],
      { header: 1 },
    );
    expect(exported.flat()).toContain("A");
    expect(exported.flat()).not.toContain("B");
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
