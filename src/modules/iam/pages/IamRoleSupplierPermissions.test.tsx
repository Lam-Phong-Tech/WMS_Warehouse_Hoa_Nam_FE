import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/shared/store/auth.store";
import { IamRolePermissionScreen } from "./IamRolePermissionScreen";

const fixtures = vi.hoisted(() => ({
  role: {
    role_id: "supplier-role",
    role_code: "SUPPLIER_OPERATOR",
    role_name: "Nhân viên NCC",
    status: "ACTIVE",
    scope_type: "FUNCTION",
    permissions: [],
  },
  permissions: ["view", "create", "update"].map((action) => ({
    permission_id: action,
    permission_key: `supplier.${action}`,
    permission_name: action,
    scope_type: "FUNCTION",
    status: "ACTIVE",
    is_enforced: true,
  })),
}));
vi.mock("@/modules/iam/hooks/use-iam", () => ({
  useIamPermissions: () => ({
    data: fixtures.permissions,
    isLoading: false,
    isError: false,
  }),
  useIamRolesPage: () => ({
    data: {
      data: [fixtures.role],
      meta: { total: 1, current_page: 1, per_page: 10, last_page: 1 },
    },
    isLoading: false,
    isError: false,
  }),
  useIamUsers: () => ({ data: { data: [], meta: {} }, isLoading: false }),
  useUpdateIamRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIamRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSyncIamRolePermissions: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
describe("supplier permissions in the role matrix", () => {
  beforeEach(() =>
    useAuthStore.setState({
      isSuperAdmin: true,
      permissionCodes: [],
      isProfileLoaded: true,
    }),
  );
  it("shows the Nhà cung cấp group with independent assignable view/create/update checkboxes", async () => {
    render(<IamRolePermissionScreen />);
    expect(
      await screen.findByText("Nhà cung cấp (NCC)", { exact: true }),
    ).toBeInTheDocument();
    const view = screen.getByRole("checkbox", { name: /supplier\.view/ });
    const create = screen.getByRole("checkbox", { name: /supplier\.create/ });
    const update = screen.getByRole("checkbox", { name: /supplier\.update/ });
    expect(view).toBeEnabled();
    expect(create).toBeEnabled();
    expect(update).toBeEnabled();
    fireEvent.click(create);
    expect(create).toBeChecked();
    expect(update).not.toBeChecked();
    expect(view).not.toBeChecked();
  });
});
