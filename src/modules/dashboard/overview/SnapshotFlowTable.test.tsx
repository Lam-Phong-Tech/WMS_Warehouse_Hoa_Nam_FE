import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SnapshotFlowTable } from "./SnapshotFlowTable";

const rows = Array.from({ length: 12 }, (_, index) => ({
  date: `2026-11-${String(index + 1).padStart(2, "0")}`,
  label: String(index + 1),
  inbound: index + 1,
  receiptProduct: index + 1,
  receiptComponent: 0,
  product: 0,
  component: 0,
  reversal: 0,
}));
const trend = rows.map((row) => ({
  date: row.date,
  label: row.label,
  closing: 100,
}));

afterEach(cleanup);

describe("SnapshotFlowTable pagination", () => {
  it("pages daily rows while retaining totals for the entire selected period", () => {
    render(<SnapshotFlowTable rows={rows} trend={trend} />);
    const table = screen.getByRole("table");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(within(table).getByText("01/11/2026")).toBeInTheDocument();
    expect(within(table).queryByText("06/11/2026")).not.toBeInTheDocument();
    expect(table.querySelector("tfoot")).toHaveTextContent("78");

    fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
    expect(within(table).getByText("06/11/2026")).toBeInTheDocument();
    expect(within(table).queryByText("01/11/2026")).not.toBeInTheDocument();
    expect(table.querySelector("tfoot")).toHaveTextContent("78");
    expect(screen.getByText("Hiển thị 6–10 / 12 bản ghi")).toBeInTheDocument();
  });

  it("resets to the first page when changing page size and clamps after data shrinks", () => {
    const { rerender } = render(
      <SnapshotFlowTable rows={rows} trend={trend} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /page 3/i }));
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(
      2,
    );
    fireEvent.change(screen.getByLabelText("Số dòng mỗi trang"), {
      target: { value: "10" },
    });
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(
      10,
    );
    expect(screen.getByText("Hiển thị 1–10 / 12 bản ghi")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
    rerender(
      <SnapshotFlowTable rows={rows.slice(0, 2)} trend={trend.slice(0, 2)} />,
    );
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(
      2,
    );
    expect(screen.getByText("Hiển thị 1–2 / 2 bản ghi")).toBeInTheDocument();
  });
});
