import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionDropdown } from "./ActionDropdown";
import { useAuthStore } from "@/shared/store/auth.store";

describe("ActionDropdown row mode", () => {
  beforeEach(() => {
    useAuthStore.setState({ permissionCodes: [], isSuperAdmin: false });
  });

  it("opens from the compact trigger and invokes the selected action", async () => {
    const onEdit = vi.fn();
    render(
      <ActionDropdown
        row
        tooltip="Thao tác SKU A"
        items={[
          { key: "edit", kind: "edit", label: "Sửa SKU", onClick: onEdit },
        ]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Thao tác SKU A" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(screen.getByRole("menuitem", { name: "Sửa SKU" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("hides the menu when every action is denied", () => {
    render(
      <ActionDropdown
        row
        items={[
          {
            key: "edit",
            kind: "edit",
            module: "org_units",
            action: "edit",
            onClick: vi.fn(),
          },
        ]}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("retains locked menu items and their handler guards", async () => {
    const onEdit = vi.fn();
    render(
      <ActionDropdown
        row
        items={[
          {
            key: "edit",
            kind: "edit",
            label: "Sửa SKU",
            disabled: true,
            onClick: onEdit,
          },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("menuitem", { name: "Sửa SKU" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.keyboard("{Enter}");
    expect(onEdit).not.toHaveBeenCalled();
  });
});
