import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionButton } from "./ActionButton";
import { useAuthStore } from "@/shared/store/auth.store";

describe("ActionButton", () => {
  beforeEach(() => {
    useAuthStore.setState({ permissionCodes: [], isSuperAdmin: false });
  });

  it('mode="hide" (mặc định): không render gì khi thiếu quyền', () => {
    render(
      <ActionButton module="org_units" action="create">
        Thêm mới
      </ActionButton>,
    );
    expect(screen.queryByText("Thêm mới")).not.toBeInTheDocument();
  });

  it('mode="hide": render button khi có quyền', () => {
    useAuthStore.setState({ permissionCodes: ["ORG_CREATE"] });
    render(
      <ActionButton module="org_units" action="create">
        Thêm mới
      </ActionButton>,
    );
    expect(screen.getByText("Thêm mới")).toBeInTheDocument();
  });

  it('mode="disable": render button disabled + tooltip mặc định khi thiếu quyền', () => {
    render(
      <ActionButton module="org_units" action="edit" mode="disable">
        Sửa
      </ActionButton>,
    );
    const button = screen.getByText("Sửa").closest("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "Bạn không có quyền thực hiện thao tác này",
    );
  });

  it('mode="disable": custom disabledTooltip', () => {
    render(
      <ActionButton
        module="org_units"
        action="delete"
        mode="disable"
        disabledTooltip="Cần quyền xóa vĩnh viễn"
      >
        Xóa vĩnh viễn
      </ActionButton>,
    );
    const button = screen.getByText("Xóa vĩnh viễn").closest("button");
    expect(button).toHaveAttribute("title", "Cần quyền xóa vĩnh viễn");
  });

  it('mode="disable": không có title khi button enabled (có quyền)', () => {
    useAuthStore.setState({ permissionCodes: ["ORG_EDIT"] });
    render(
      <ActionButton module="org_units" action="edit" mode="disable">
        Sửa
      </ActionButton>,
    );
    const button = screen.getByText("Sửa").closest("button");
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute("title");
  });

  it("permissionCode tùy biến: dùng mã custom thay vì suy ra từ module+action", () => {
    useAuthStore.setState({ permissionCodes: ["ORG_FORCE_DELETE"] });
    render(
      <ActionButton
        module="org_units"
        action="delete"
        permissionCode="ORG_FORCE_DELETE"
        mode="disable"
      >
        Xóa vĩnh viễn
      </ActionButton>,
    );
    const button = screen.getByText("Xóa vĩnh viễn").closest("button");
    expect(button).not.toBeDisabled();
  });

  it("super admin: luôn render/enable dù không có permissionCodes", () => {
    useAuthStore.setState({ permissionCodes: [], isSuperAdmin: true });
    render(
      <ActionButton module="org_units" action="create" mode="disable">
        Thêm mới
      </ActionButton>,
    );
    const button = screen.getByText("Thêm mới").closest("button");
    expect(button).not.toBeDisabled();
  });
  it("keeps caller disabled state even when permission passes", () => {
    useAuthStore.setState({ permissionCodes: ["REPORT_EXPORT"] });
    render(
      <ActionButton module="reports" action="export" mode="disable" disabled>
        Export
      </ActionButton>,
    );
    const button = screen.getByText("Export").closest("button");
    expect(button).toBeDisabled();
  });
});
