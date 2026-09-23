import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RowActionButton } from "./RowActionButton";
import { RowActionGroup } from "./RowActionGroup";
import { useAuthStore } from "@/shared/store/auth.store";

describe("RowActionButton", () => {
  beforeEach(() => {
    useAuthStore.setState({ permissionCodes: [], isSuperAdmin: false });
  });

  it("keeps view text and a decorative chevron with one accessible name", () => {
    render(<RowActionButton kind="view" label="Xem SKU" />);
    const button = screen.getByRole("button", { name: "Xem SKU" });
    expect(button).toHaveTextContent("Xem SKU");
    expect(
      button.querySelector('.MuiButton-endIcon [aria-hidden="true"]'),
    ).toHaveTextContent("›");
  });

  it("uses the action label as the name and tooltip of compact icon buttons", () => {
    render(<RowActionButton kind="edit">Sửa SKU A</RowActionButton>);
    const button = screen.getByRole("button", { name: "Sửa SKU A" });
    expect(button).toHaveAttribute("title", "Sửa SKU A");
    expect(button).not.toHaveTextContent("Sửa SKU A");
  });

  it("preserves explicit context labels and disabled explanations", () => {
    render(
      <RowActionButton
        kind="publish"
        aria-label="Công bố SKU A"
        title="SKU chưa hoạt động"
        disabled
      />,
    );
    const button = screen.getByRole("button", { name: "Công bố SKU A" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "SKU chưa hoạt động");
  });

  it("retains hidden and disabled permission behavior", () => {
    render(
      <RowActionGroup>
        <RowActionButton kind="edit" module="org_units" action="edit" />
        <RowActionButton
          kind="delete"
          module="org_units"
          action="delete"
          mode="disable"
          label="Xóa đơn vị"
        />
      </RowActionGroup>,
    );
    expect(
      screen.queryByRole("button", { name: "Sửa" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xóa đơn vị" })).toBeDisabled();
  });

  it("prevents repeat actions while loading", () => {
    const onClick = vi.fn();
    render(
      <RowActionButton kind="print" label="In tem" loading onClick={onClick} />,
    );
    const button = screen.getByRole("button", { name: "In tem" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("supports keyboard activation without triggering the parent row handler", async () => {
    const onRowClick = vi.fn();
    const onAction = vi.fn();
    render(
      <div onClick={onRowClick}>
        <RowActionGroup onClick={(event) => event.stopPropagation()}>
          <RowActionButton kind="edit" label="Sửa SKU" onClick={onAction} />
        </RowActionGroup>
      </div>,
    );
    screen.getByRole("button", { name: "Sửa SKU" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sửa SKU" }));
    expect(onAction).toHaveBeenCalledTimes(2);
  });
});
