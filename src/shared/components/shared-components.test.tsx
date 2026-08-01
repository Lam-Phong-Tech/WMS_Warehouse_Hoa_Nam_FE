import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PageHeader,
  AppShell,
  EmptyState,
  ScanInput,
  StatusBadge,
  StatCard,
} from "@/shared/components";
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

describe("AppShell", () => {
  it("renders reusable frame slots and body wrapper", () => {
    render(
      <AppShell
        sider={<nav>Menu</nav>}
        header={<header>Header</header>}
        breadcrumb={<div>Breadcrumb</div>}
        footer={<footer>Footer</footer>}
        bodyStyle={{ minHeight: 120 }}
      >
        <main>Page body</main>
      </AppShell>,
    );

    expect(screen.getByText("Menu")).toBeInTheDocument();
    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Breadcrumb")).toBeInTheDocument();
    expect(screen.getByText("Page body")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("hiển thị mô tả mặc định khi rỗng", () => {
    render(<EmptyState />);
    expect(screen.getByText(/không có dữ liệu/i)).toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("hiển thị nhãn theo trạng thái active", () => {
    const { rerender } = render(<StatusBadge active />);
    expect(screen.getByText(/hoạt động/i)).toBeInTheDocument();
    rerender(<StatusBadge active={false} />);
    expect(screen.getByText(/ngừng/i)).toBeInTheDocument();
  });
});

describe("StatCard", () => {
  it("hiển thị tiêu đề và số liệu (định dạng vi-VN)", () => {
    render(
      <StatCard
        title="Nhân viên"
        value={1234}
        icon={<span>i</span>}
        color="#000"
      />,
    );
    expect(screen.getByText(/nhân viên/i)).toBeInTheDocument();
    expect(screen.getByText("1.234")).toBeInTheDocument();
  });
});

describe("ScanInput", () => {
  it("normalizes scan value and clears the field after submit", async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();
    render(<ScanInput onScan={onScan} />);

    const input = screen.getByLabelText(/scan code/i);
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
      screen.getByLabelText(/scan code/i),
      "carton-hn-0007{enter}",
    );

    expect(onScan).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/vừa được scan/i);
  });
});
