/**
 * Cột "Nguồn" của bảng drill-down từng in nguyên `source_type` của sổ biến động
 * (`STOCK_DOCUMENT`, `OPENING_ADJUSTMENT`…) — cột `movement_type` ngay bên trái
 * đã đi qua bảng nhãn từ lâu nên chỗ này lọt rất lâu mà không ai thấy. Bảng
 * này hiển thị ở 4 màn (TabInventoryFlow ×3, TabWarranty ×1), nên khoá lại.
 */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { MovementTable } from "./report-drilldown";

const ROWS = [
  {
    id: "mv-1",
    occurred_at: "2026-09-09 08:00:00",
    movement_type: "RECEIPT",
    product_code: "DCA-AJZ04-10",
    product_name: "Máy khoan pin",
    warehouse_code: "KHO-HN",
    qty_delta: 5,
    actor: "Nguyễn Văn A",
    source_type: "STOCK_DOCUMENT",
  },
  {
    id: "mv-2",
    occurred_at: "2026-09-08 08:00:00",
    movement_type: "ADJUSTMENT",
    product_code: "DCA-AJZ04-11",
    product_name: "Máy mài góc",
    warehouse_code: "KHO-HN",
    qty_delta: -2,
    actor: "Trần Thị B",
    source_type: "OPENING_ADJUSTMENT",
  },
];

describe("MovementTable · cột Nguồn", () => {
  it("hiện nhãn tiếng Việt thay vì mã enum của sổ biến động", async () => {
    renderWithProviders(<MovementTable rows={ROWS} />);

    expect(await screen.findByText("Phiếu nhập / xuất kho")).toBeInTheDocument();
    expect(screen.getByText("Điều chỉnh tồn đầu kỳ")).toBeInTheDocument();
    expect(screen.queryByText("STOCK_DOCUMENT")).not.toBeInTheDocument();
    expect(screen.queryByText("OPENING_ADJUSTMENT")).not.toBeInTheDocument();
  });

  it("mã lạ vẫn đọc được, không hiện nguyên dạng gạch dưới", async () => {
    renderWithProviders(
      <MovementTable
        rows={[{ ...ROWS[0], id: "mv-3", source_type: "SOME_NEW_SOURCE" }]}
      />,
    );

    await screen.findByText("DCA-AJZ04-10");
    expect(screen.queryByText("SOME_NEW_SOURCE")).not.toBeInTheDocument();
    expect(screen.getByText("Some New Source")).toBeInTheDocument();
  });
});
