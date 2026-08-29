import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "./ResponsiveDataTable";

type Row = { id: string; code: string };

const ROWS: Row[] = [
  { id: "r1", code: "PN-001" },
  { id: "r2", code: "PN-002" },
];

const COLUMNS: ResponsiveTableColumn<Row>[] = [
  { key: "code", header: "Phiếu", render: (row) => row.code },
];

/** Bọc hook chọn dòng đúng như các trang danh sách đang dùng. */
function Harness({ onRowClick }: { onRowClick?: (row: Row) => void }) {
  const rowSelection = useRowSelection(ROWS, (row) => row.id);
  return (
    <ResponsiveDataTable<Row>
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(row) => row.id}
      rowSelection={rowSelection}
      selectionLabel={(row) => `Chọn phiếu ${row.code}`}
      onRowClick={onRowClick}
    />
  );
}

describe("ResponsiveDataTable · hợp đồng ui-state (WWHN-268)", () => {
  it("branch loading phát data-ui-state + spinner + aria-busy", () => {
    render(
      <ResponsiveDataTable<Row>
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
        loading
      />,
    );
    const surface = screen.getByTestId("ui-state-loading-table");
    expect(surface).toHaveAttribute("data-ui-state", "loading");
    expect(surface).toHaveAttribute("aria-busy", "true");
    expect(surface).toHaveTextContent("Đang tải...");
    // UiSpinner phát role="progressbar" — bằng chứng có affordance quay.
    expect(surface.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it("branch empty mặc định (chuỗi thuần) phát data-ui-state=empty", () => {
    render(
      <ResponsiveDataTable<Row>
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
      />,
    );
    const surface = screen.getByTestId("ui-state-empty-table");
    expect(surface).toHaveAttribute("data-ui-state", "empty");
    expect(surface).toHaveTextContent("Không có dữ liệu");
  });

  it("emptyText là ReactNode (đã tự mang hook) thì KHÔNG double-wrap", () => {
    render(
      <ResponsiveDataTable<Row>
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
        emptyText={
          <div data-ui-state="empty" data-testid="ui-state-empty-table">
            Trống (tự phát hook)
          </div>
        }
      />,
    );
    // Nếu bảng bọc thêm lớp hook nữa thì testid trùng → getByTestId ném lỗi.
    const surface = screen.getByTestId("ui-state-empty-table");
    expect(surface).toHaveTextContent("Trống (tự phát hook)");
    expect(document.querySelectorAll('[data-ui-state="empty"]')).toHaveLength(
      1,
    );
  });
});

describe("ResponsiveDataTable · chọn nhiều dòng", () => {
  it("không có cột checkbox khi không truyền rowSelection", () => {
    render(
      <ResponsiveDataTable<Row>
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
      />,
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("hiện checkbox từng dòng + checkbox chọn tất cả", () => {
    render(<Harness />);
    expect(
      screen.getByRole("checkbox", { name: "Chọn tất cả dòng trong trang" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Chọn phiếu PN-001" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Chọn phiếu PN-002" }),
    ).toBeInTheDocument();
  });

  it("chọn tất cả rồi bỏ chọn qua thanh tóm tắt", async () => {
    render(<Harness />);
    const all = screen.getByRole("checkbox", {
      name: "Chọn tất cả dòng trong trang",
    });

    await userEvent.click(all);
    expect(
      screen.getByRole("checkbox", { name: "Chọn phiếu PN-001" }),
    ).toBeChecked();
    expect(screen.getByText("Đã chọn 2 dòng")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Bỏ chọn" }));
    expect(
      screen.getByRole("checkbox", { name: "Chọn phiếu PN-001" }),
    ).not.toBeChecked();
    expect(screen.queryByText(/Đã chọn/)).not.toBeInTheDocument();
  });

  it("tick 1 dòng KHÔNG kích hoạt onRowClick (không mở modal chi tiết)", async () => {
    const onRowClick = vi.fn();
    render(<Harness onRowClick={onRowClick} />);

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Chọn phiếu PN-001" }),
    );

    expect(
      screen.getByRole("checkbox", { name: "Chọn phiếu PN-001" }),
    ).toBeChecked();
    expect(screen.getByText("Đã chọn 1 dòng")).toBeInTheDocument();
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
