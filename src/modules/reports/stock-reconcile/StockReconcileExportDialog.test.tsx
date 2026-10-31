import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("xlsx", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  writeFile: vi.fn(),
}));

import * as XLSX from "xlsx";
import { StockReconcileExportDialog } from "./StockReconcileExportDialog";

describe("StockReconcileExportDialog", () => {
  afterEach(cleanupTestState);

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

    expect(XLSX.writeFile).toHaveBeenCalledOnce();
    const [workbook, filename] = vi.mocked(XLSX.writeFile).mock.calls[0];
    expect(filename).toBe("DoiSoat-CanKiemTra.xlsx");
    expect(workbook.SheetNames).toEqual(["Chi tiết đối soát"]);
    const exported = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets["Chi tiết đối soát"],
      { header: 1 },
    );
    expect(exported.flat()).toContain("A");
    expect(exported.flat()).not.toContain("B");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
