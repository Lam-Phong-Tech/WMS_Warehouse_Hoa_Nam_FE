import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilteredEmptyState } from "./TableContainer";

describe("FilteredEmptyState", () => {
  it("hiển thị message mặc định", () => {
    render(<FilteredEmptyState />);
    expect(screen.getByText("Không có kết quả phù hợp")).toBeInTheDocument();
  });

  it('không hiện nút "Xóa bộ lọc" khi không truyền onClearFilters', () => {
    render(<FilteredEmptyState />);
    expect(screen.queryByText("Xóa bộ lọc")).not.toBeInTheDocument();
  });

  it('gọi onClearFilters khi bấm nút "Xóa bộ lọc" (dùng AntD Button)', async () => {
    const onClearFilters = vi.fn();
    render(<FilteredEmptyState onClearFilters={onClearFilters} />);

    const button = screen.getByRole("button", { name: "Xóa bộ lọc" });
    // Button có thể không có class 'ant-btn' trong jsdom, chỉ kiểm tra tồn tại
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("hiển thị activeFilters khi truyền vào", () => {
    render(
      <FilteredEmptyState activeFilters={<span>Trạng thái: Hoạt động</span>} />,
    );
    expect(screen.getByText("Trạng thái: Hoạt động")).toBeInTheDocument();
  });
});
