import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader, EmptyState, ScanInput } from "@/shared/components";
import userEvent from "@testing-library/user-event";

describe("PageHeader", () => {
  it("hiển thị tiêu đề, mô tả và vùng thao tác", () => {
    render(
      <PageHeader
        title="Người dùng"
        subtitle="Danh sách tài khoản"
        extra={<button>Thêm mới</button>}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /người dùng/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/danh sách tài khoản/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /thêm mới/i }),
    ).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("hiển thị mô tả mặc định khi rỗng", () => {
    render(<EmptyState />);
    expect(screen.getByText(/không có dữ liệu/i)).toBeInTheDocument();
  });
});

describe("ScanInput", () => {
  it("normalizes scan value and clears the field after submit", async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<ScanInput onScan={onScan} />);

    const input = screen.getByLabelText(/quét mã/i);
    await user.type(input, " carton-hn-0007 {enter}");

    expect(onScan).toHaveBeenCalledWith("CARTON-HN-0007");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("blocks duplicate scans before calling onScan", async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<ScanInput recentCodes={["CARTON-HN-0007"]} onScan={onScan} />);

    await user.type(
      screen.getByLabelText(/quét mã/i),
      "carton-hn-0007{enter}",
    );

    expect(onScan).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/vừa được scan/i);
  });
});
