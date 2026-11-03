import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { ComponentIssueFilters } from "./ComponentIssueFilters";

describe("ComponentIssueFilters", () => {
  it("filters immediately with inline controls and keeps sorting inside the filter row", async () => {
    const onSearchChange = vi.fn();
    const onStatusChange = vi.fn();
    const onTrackingChange = vi.fn();
    const onSortChange = vi.fn();
    const onClear = vi.fn();

    renderWithProviders(
      <ComponentIssueFilters
        search=""
        status=""
        tracking=""
        sortOrder="desc"
        statusOptions={[{ value: "POSTED", label: "Đã ghi sổ" }]}
        hasFilters={false}
        onSearchChange={onSearchChange}
        onStatusChange={onStatusChange}
        onTrackingChange={onTrackingChange}
        onSortChange={onSortChange}
        onClear={onClear}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "CI-0001" },
    });
    expect(onSearchChange).toHaveBeenCalledWith("CI-0001");
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    expect(
      screen.queryByRole("button", { name: /áp dụng|đặt lại/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /xóa lọc/i })).toBeNull();

    fireEvent.mouseDown(screen.getAllByRole("combobox")[0]);
    fireEvent.click(
      await screen.findByRole("option", { name: /trạng thái: đã ghi sổ/i }),
    );
    expect(onStatusChange).toHaveBeenCalledWith("POSTED");

    fireEvent.mouseDown(screen.getAllByRole("combobox")[1]);
    fireEvent.click(
      await screen.findByRole("option", { name: /theo dõi: serial/i }),
    );
    expect(onTrackingChange).toHaveBeenCalledWith("SERIAL");

    fireEvent.mouseDown(screen.getAllByRole("combobox")[2]);
    fireEvent.click(await screen.findByRole("option", { name: /cũ nhất/i }));
    expect(onSortChange).toHaveBeenCalledWith("asc");
  });

  it("shows a clear control only when a filter is active", () => {
    const onClear = vi.fn();
    renderWithProviders(
      <ComponentIssueFilters
        search="CI-0001"
        status="POSTED"
        tracking=""
        sortOrder="desc"
        statusOptions={[{ value: "POSTED", label: "Đã ghi sổ" }]}
        hasFilters
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        onTrackingChange={vi.fn()}
        onSortChange={vi.fn()}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /xóa lọc/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
