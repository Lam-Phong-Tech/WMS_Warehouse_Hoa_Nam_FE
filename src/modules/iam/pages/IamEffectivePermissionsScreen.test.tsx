import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import type { IamUser } from "@/modules/iam/types/iam.types";

const mocks = vi.hoisted(() => ({
  users: vi.fn(),
  roles: vi.fn(),
  permissions: vi.fn(),
  overrides: vi.fn(),
}));
vi.mock("@/modules/iam/hooks/use-iam", () => ({
  useIamUsers: mocks.users,
  useIamRolesPage: mocks.roles,
  useIamPermissions: mocks.permissions,
  useIamUserPermissionOverrides: mocks.overrides,
  useIamScopeWarehouses: () => ({
    data: [{ id: "kho-a", name: "Kho A" }],
    isLoading: false,
  }),
}));
import { IamEffectivePermissionsScreen } from "./IamEffectivePermissionsScreen";
const permission = {
  permission_id: "p1",
  permission_key: "inbound.view",
  permission_name: "Xem phiếu nhập",
  status: "ACTIVE" as const,
};
const denied = {
  ...permission,
  permission_id: "p2",
  permission_key: "outbound.view",
  permission_name: "Xem phiếu xuất",
};
const role = {
  role_id: "r1",
  role_name: "Nhân viên kho A",
  role_code: "STAFF",
  status: "ACTIVE" as const,
  scope_type: "WAREHOUSE" as const,
  permissions: [permission],
  pivot: { scope_ref: "kho-a" },
};
const user: IamUser = {
  user_id: "u1",
  username: "minh",
  display_name: "Nguyễn Minh",
  email: "minh@example.com",
  status: "ACTIVE",
  version: 1,
  roles: [role],
};
function setup(overridesError = false) {
  const common = {
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  };
  mocks.users.mockReturnValue({
    ...common,
    data: { data: [user], meta: { total: 1 } },
  });
  mocks.roles.mockReturnValue({
    ...common,
    data: { data: [role], meta: { total: 1 } },
  });
  mocks.permissions.mockReturnValue({ ...common, data: [permission, denied] });
  mocks.overrides.mockReturnValue({
    ...common,
    isError: overridesError,
    data: [],
  });
}
async function pickUser() {
  const picker = screen.getByRole("combobox", {
    name: "Chọn hoặc tìm người dùng",
  });
  if (picker.getAttribute("aria-expanded") !== "true")
    fireEvent.mouseDown(picker);
  fireEvent.click(await screen.findByRole("option", { name: /Nguyễn Minh/ }));
}
afterEach(cleanupTestState);
describe("IamEffectivePermissionsScreen", () => {
  it("hiện email và tìm người dùng bằng email qua máy chủ", async () => {
    setup();
    renderWithProviders(<IamEffectivePermissionsScreen />);
    const picker = screen.getByRole("combobox", {
      name: "Chọn hoặc tìm người dùng",
    });
    fireEvent.mouseDown(picker);
    expect(
      await screen.findByRole("option", {
        name: "Nguyễn Minh · minh@example.com",
      }),
    ).toBeInTheDocument();

    fireEvent.change(picker, { target: { value: "minh@example.com" } });
    await waitFor(() => {
      expect(mocks.users).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: "minh@example.com" }),
      );
    });
    // Server đã lọc; client không được lọc lại bằng nhãn (email không nằm
    // trong username) làm mất kết quả.
    expect(
      await screen.findByRole("option", {
        name: "Nguyễn Minh · minh@example.com",
      }),
    ).toBeInTheDocument();
  });

  it("refreshes the selected user from query data and retains that refreshed selection outside search results", async () => {
    setup();
    const onViewUser = vi.fn();
    const { rerender } = renderWithProviders(
      <IamEffectivePermissionsScreen onViewUser={onViewUser} />,
    );
    await pickUser();
    const refreshed = { ...user, display_name: "Nguyễn Minh mới", roles: [] };
    const previousResult = mocks.users.mock.results.at(-1)?.value;
    mocks.users.mockReturnValue({
      ...previousResult,
      data: { data: [refreshed], meta: { total: 1 } },
    });
    rerender(<IamEffectivePermissionsScreen onViewUser={onViewUser} />);
    expect(
      within(screen.getByRole("row", { name: /Xem phiếu nhập/ })).getAllByText(
        "Chưa được cấp",
      ),
    ).toHaveLength(2);
    mocks.users.mockReturnValue({
      ...previousResult,
      data: { data: [], meta: { total: 0 } },
    });
    rerender(<IamEffectivePermissionsScreen onViewUser={onViewUser} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Xem chi tiết người dùng" }),
    );
    expect(onViewUser).toHaveBeenLastCalledWith(refreshed);
  });

  it("uses refreshed catalog permissions including an authoritative empty array instead of stale embedded grants", async () => {
    setup();
    const { rerender } = renderWithProviders(<IamEffectivePermissionsScreen />);
    await pickUser();
    expect(
      within(screen.getByRole("row", { name: /Xem phiếu nhập/ })).getByText(
        "Được cấp",
      ),
    ).toBeInTheDocument();
    const previousResult = mocks.roles.mock.results.at(-1)?.value;
    mocks.roles.mockReturnValue({
      ...previousResult,
      data: { data: [{ ...role, permissions: [] }], meta: { total: 1 } },
    });
    rerender(<IamEffectivePermissionsScreen />);
    const row = screen.getByRole("row", { name: /Xem phiếu nhập/ });
    expect(within(row).getAllByText("Chưa được cấp")).toHaveLength(2);
    expect(within(row).queryByText("Nhân viên kho A")).not.toBeInTheDocument();
  });

  it("server-searches accounts, shows per-role scope and distinguishes a missing grant", async () => {
    setup();
    renderWithProviders(<IamEffectivePermissionsScreen />);
    const picker = screen.getByRole("combobox", {
      name: "Chọn hoặc tìm người dùng",
    });
    fireEvent.change(picker, { target: { value: "Minh" } });
    await waitFor(() =>
      expect(mocks.users).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: "Minh", per_page: 20 }),
      ),
    );
    await pickUser();
    const row = screen.getByRole("row", { name: /Xem phiếu nhập/ });
    expect(within(row).getByText("Nhân viên kho A")).toBeInTheDocument();
    expect(within(row).getByText("Kho A")).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Xem phiếu xuất/ })).getAllByText(
        "Chưa được cấp",
      ),
    ).toHaveLength(2);
  });
  it("does not report not-granted when direct-grant evidence failed to load", async () => {
    setup(true);
    renderWithProviders(<IamEffectivePermissionsScreen />);
    await pickUser();
    expect(screen.getByText(/Chưa tải đủ dữ liệu/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Xem phiếu xuất/ })).getAllByText(
        "Chưa xác định",
      ),
    ).toHaveLength(2);
  });
  it("opens the selected actual user through the supplied callback without mutations", async () => {
    setup();
    const onViewUser = vi.fn();
    renderWithProviders(
      <IamEffectivePermissionsScreen onViewUser={onViewUser} />,
    );
    await pickUser();
    fireEvent.click(
      screen.getByRole("button", { name: "Xem chi tiết người dùng" }),
    );
    expect(onViewUser).toHaveBeenCalledWith(user);
  });
});
