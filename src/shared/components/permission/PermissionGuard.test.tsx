import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "antd";
import { PermissionGuard } from "./PermissionGuard";
import { useAuthStore } from "@/shared/store/auth.store";

describe("PermissionGuard", () => {
  beforeEach(() => {
    useAuthStore.setState({ permissionCodes: [], isSuperAdmin: false });
  });

  it('mode="hide" (mặc định): ẩn hoàn toàn children khi thiếu quyền', () => {
    render(
      <PermissionGuard module="org_units" action="create">
        <Button>Thêm mới</Button>
      </PermissionGuard>,
    );
    expect(screen.queryByText("Thêm mới")).not.toBeInTheDocument();
  });

  it('mode="hide": render children khi có quyền', () => {
    useAuthStore.setState({ permissionCodes: ["ORG_CREATE"] });
    render(
      <PermissionGuard module="org_units" action="create">
        <Button>Thêm mới</Button>
      </PermissionGuard>,
    );
    expect(screen.getByText("Thêm mới")).toBeInTheDocument();
  });

  it('mode="hide": render fallback khi thiếu quyền và có truyền fallback', () => {
    render(
      <PermissionGuard
        module="org_units"
        action="create"
        fallback={<span>Không có quyền</span>}
      >
        <Button>Thêm mới</Button>
      </PermissionGuard>,
    );
    expect(screen.getByText("Không có quyền")).toBeInTheDocument();
    expect(screen.queryByText("Thêm mới")).not.toBeInTheDocument();
  });

  it('mode="disable": disable button + hiện tooltip mặc định khi thiếu quyền', () => {
    render(
      <PermissionGuard module="org_units" action="edit" mode="disable">
        <Button>Sửa</Button>
      </PermissionGuard>,
    );
    const button = screen.getByText("Sửa").closest("button");
    expect(button).toBeDisabled();
    const wrapper = screen.getByTitle(
      "Bạn không có quyền thực hiện thao tác này",
    );
    expect(wrapper).toBeInTheDocument();
  });

  it('mode="disable": custom disabledTooltip', () => {
    render(
      <PermissionGuard
        module="org_units"
        action="delete"
        mode="disable"
        disabledTooltip="Cần quyền xóa vĩnh viễn"
      >
        <Button>Xóa</Button>
      </PermissionGuard>,
    );
    expect(screen.getByTitle("Cần quyền xóa vĩnh viễn")).toBeInTheDocument();
  });

  it('mode="disable": button không bị disable khi có quyền', () => {
    useAuthStore.setState({ permissionCodes: ["ORG_EDIT"] });
    render(
      <PermissionGuard module="org_units" action="edit" mode="disable">
        <Button>Sửa</Button>
      </PermissionGuard>,
    );
    const button = screen.getByText("Sửa").closest("button");
    expect(button).not.toBeDisabled();
  });

  it("permissionCode tùy biến: ưu tiên hơn module+action", () => {
    useAuthStore.setState({ permissionCodes: ["ORG_FORCE_DELETE"] });
    render(
      <PermissionGuard permissionCode="ORG_FORCE_DELETE">
        <Button>Xóa vĩnh viễn</Button>
      </PermissionGuard>,
    );
    expect(screen.getByText("Xóa vĩnh viễn")).toBeInTheDocument();
  });

  it("super admin: luôn render dù không có permissionCodes", () => {
    useAuthStore.setState({ permissionCodes: [], isSuperAdmin: true });
    render(
      <PermissionGuard module="org_units" action="create">
        <Button>Thêm mới</Button>
      </PermissionGuard>,
    );
    expect(screen.getByText("Thêm mới")).toBeInTheDocument();
  });
});
