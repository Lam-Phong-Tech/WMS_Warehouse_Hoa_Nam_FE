import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./import-quality-api", () => ({
  useImportQualityIssues: () => ({
    data: { rows: [
      { rowNo: 32, field: "sku_name", code: "REQUIRED", message: "Thiếu tên SKU", rawValue: "", severity: "ERROR", suggestedAction: "Bổ sung tên trong tệp nguồn." },
      { rowNo: 45, field: "sku_code", code: "DUPLICATE", message: "Mã SKU trùng trong tệp", rawValue: "HN-DRV-001", severity: "WARNING", suggestedAction: "Đổi mã SKU bị trùng." },
    ], total: 2, lastPage: 1 },
    isLoading: false,
    error: null,
  }),
}));

import { ImportQualityIssuePanel } from "./ImportQualityIssuePanel";

describe("Import quality issue detail", () => {
  it("shows source rows and changes the detail panel with the selected issue", async () => {
    const user = userEvent.setup();
    render(<ImportQualityIssuePanel batchId="batch-1" sourceFile="danh-muc-sku.xlsx" />);
    expect(screen.getByText("Dòng 32")).toBeInTheDocument();
    expect(screen.getByText("Dòng 45")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chi tiết dòng cần kiểm tra" })).toBeInTheDocument();
    expect(screen.getByText("Bổ sung tên trong tệp nguồn.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Dòng 45/ }));
    expect(screen.getByText("Đổi mã SKU bị trùng.")).toBeInTheDocument();
    expect(screen.getByText("HN-DRV-001")).toBeInTheDocument();
  });
});
