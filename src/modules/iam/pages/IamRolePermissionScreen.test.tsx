import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useAuthStore } from "@/shared/store/auth.store";
import { createMockAxiosError } from "@/shared/api/api-error";

vi.mock("../hooks/use-iam", () => ({
  useIamRolesPage: vi.fn(),
  useIamPermissions: vi.fn(),
  useIamUsers: vi.fn(),
  useCreateIamRole: vi.fn(),
  useUpdateIamRole: vi.fn(),
  useDeleteIamRole: vi.fn(),
  useSyncIamRolePermissions: vi.fn(),
}));
vi.mock("../services/iam.service", () => ({ getIamRole: vi.fn() }));
vi.mock("@/shared/components/permission", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/components/permission")>();
  return {
    ...actual,
    useCan: (code: string) => {
      const state = useAuthStore.getState();
      return state.isSuperAdmin || state.permissionCodes.includes(code);
    },
  };
});
vi.mock("@/modules/audit-logs/services/audit-logs.service", () => ({
  auditLogService: { getAuditLogs: vi.fn() },
}));

import {
  useCreateIamRole,
  useDeleteIamRole,
  useIamPermissions,
  useIamRolesPage,
  useIamUsers,
  useSyncIamRolePermissions,
  useUpdateIamRole,
} from "../hooks/use-iam";
import { getIamRole } from "../services/iam.service";
import { auditLogService } from "@/modules/audit-logs/services/audit-logs.service";
import type { IamPermission, IamRole } from "../types/iam.types";
import { IamRolePermissionScreen } from "./IamRolePermissionScreen";

const VIEW: IamPermission = {
  permission_id: "p-view",
  permission_key: "inbound.view",
  permission_name: "Xem phiếu nhập",
  status: "ACTIVE",
};
const CREATE: IamPermission = {
  permission_id: "p-create",
  permission_key: "inbound.create",
  permission_name: "Tạo phiếu nhập",
  status: "ACTIVE",
};
const POST: IamPermission = {
  permission_id: "p-post",
  permission_key: "inbound.post",
  permission_name: "Ghi sổ phiếu nhập",
  status: "ACTIVE",
};
const LOCKED: IamPermission = {
  permission_id: "p-locked",
  permission_key: "iam.user.manage",
  permission_name: "Quản lý người dùng",
  status: "ACTIVE",
};
const RETIRED: IamPermission = {
  permission_id: "p-retired",
  permission_key: "legacy.manage",
  permission_name: "Quyền cũ",
  status: "ACTIVE",
  is_enforced: false,
};
const ROLE: IamRole = {
  role_id: "role-warehouse",
  role_code: "WAREHOUSE_MANAGER",
  role_name: "Quản lý kho",
  scope_type: "FUNCTION",
  status: "ACTIVE",
  permissions: [VIEW, LOCKED, RETIRED],
};
const sync = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const refetch = vi.fn();
const query = (data: unknown, extra = {}) => ({
  data,
  isLoading: false,
  isError: false,
  refetch,
  ...extra,
});

function mockRoles(roles = [ROLE]) {
  vi.mocked(useIamRolesPage).mockReturnValue(
    query({ data: roles, meta: { total: roles.length } }) as never,
  );
}
function renderScreen() {
  return renderWithProviders(
    <IamRolePermissionScreen
      navigation={<nav aria-label="IAM navigation">Tabs</nav>}
    />,
  );
}
async function toggleCreate() {
  fireEvent.click(
    await screen.findByRole("checkbox", {
      name: "Tạo phiếu nhập (inbound.create)",
    }),
  );
}
async function openReview() {
  fireEvent.click(screen.getByRole("button", { name: "Xem lại & lưu" }));
  const review = await screen.findByRole("dialog", {
    name: "Xem lại thay đổi quyền",
  });
  await within(review).findByRole("textbox", { name: /Lý do thay đổi/ });
  return review;
}

describe("IamRolePermissionScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: [
        "iam.role.view",
        "iam.role.manage",
        "iam.permission.view",
        "inbound.view",
        "inbound.create",
      ],
    });
    mockRoles();
    vi.mocked(useIamPermissions).mockReturnValue(
      query([VIEW, CREATE, POST, LOCKED, RETIRED]) as never,
    );
    vi.mocked(useIamUsers).mockReturnValue(
      query({
        data: [
          {
            user_id: "user-1",
            username: "keeper",
            display_name: "Nguyễn Thủ Kho",
            roles: [ROLE],
          },
        ],
        meta: { total: 1 },
      }) as never,
    );
    sync.mockReset().mockResolvedValue({
      ...ROLE,
      permissions: [VIEW, CREATE, LOCKED, RETIRED],
    });
    create.mockReset().mockResolvedValue({
      ...ROLE,
      role_id: "role-created",
      role_code: "NEW_ROLE",
    });
    update.mockReset().mockResolvedValue(ROLE);
    remove.mockReset().mockResolvedValue(undefined);
    refetch.mockReset().mockResolvedValue({ data: { data: [ROLE] } });
    vi.mocked(useSyncIamRolePermissions).mockReturnValue({
      mutateAsync: sync,
      isPending: false,
    } as never);
    vi.mocked(useCreateIamRole).mockReturnValue({
      mutateAsync: create,
      isPending: false,
    } as never);
    vi.mocked(useUpdateIamRole).mockReturnValue({
      mutateAsync: update,
      isPending: false,
    } as never);
    vi.mocked(useDeleteIamRole).mockReturnValue({
      mutateAsync: remove,
      isPending: false,
    } as never);
    vi.mocked(getIamRole).mockResolvedValue(ROLE);
    vi.mocked(auditLogService.getAuditLogs).mockResolvedValue({
      data: [],
      meta: {},
    });
  });
  afterEach(() => cleanupTestState());

  it("restores role cards and grouped permission tiles while preserving delegation and retired locks", async () => {
    const { container } = renderScreen();
    expect(
      screen.getByRole("heading", { level: 1, name: "Vai trò & quyền" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "IAM navigation" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".hn-iam-role-card")).toHaveTextContent(
      "WAREHOUSE_MANAGER",
    );
    expect(
      container.querySelector(".hn-iam-permission-cell"),
    ).toBeInTheDocument();
    expect(screen.queryByText("inbound.create")).not.toBeInTheDocument();
    expect(
      container.querySelector(".hn-iam-matrix-table"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Chọn vai trò" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("checkbox", {
        name: "Quản lý người dùng (iam.user.manage)",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Quyền cũ (legacy.manage)" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Ghi sổ phiếu nhập (inbound.post)",
      }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Chọn tất cả quyền nhóm Nhập kho" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "Tạo phiếu nhập (inbound.create)" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Ghi sổ phiếu nhập (inbound.post)",
      }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Quản lý người dùng (iam.user.manage)",
      }),
    ).toBeChecked();
    expect(screen.getByText("1 thay đổi chưa lưu")).toBeInTheDocument();
    const group = screen.getByRole("checkbox", {
      name: "Chọn tất cả quyền nhóm Nhập kho",
    });
    expect(group).toBeChecked();
    fireEvent.click(group);
    expect(
      screen.getByRole("checkbox", { name: "Tạo phiếu nhập (inbound.create)" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Xem phiếu nhập (inbound.view)" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Ghi sổ phiếu nhập (inbound.post)",
      }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Quản lý người dùng (iam.user.manage)",
      }),
    ).toBeChecked();
  });

  it("preserves granted locked permissions when clearing a restored module group", async () => {
    mockRoles([{ ...ROLE, permissions: [VIEW, POST, LOCKED, RETIRED] }]);
    renderScreen();
    const group = screen.getByRole("checkbox", {
      name: "Chọn tất cả quyền nhóm Nhập kho",
    });
    fireEvent.click(group);
    fireEvent.click(group);
    expect(
      screen.getByRole("checkbox", { name: "Tạo phiếu nhập (inbound.create)" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Xem phiếu nhập (inbound.view)" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Ghi sổ phiếu nhập (inbound.post)",
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Quyền cũ (legacy.manage)" }),
    ).toBeChecked();
  });

  it("reviews actual additions and submits sorted ids and a trimmed reason without changing locked assignments", async () => {
    renderScreen();
    await toggleCreate();
    const review = await openReview();
    expect(within(review).getByText("Tạo phiếu nhập")).toBeInTheDocument();
    expect(within(review).getByText("Nguyễn Thủ Kho")).toBeInTheDocument();
    expect(sync).not.toHaveBeenCalled();
    fireEvent.click(
      within(review).getByRole("button", { name: "Xác nhận lưu" }),
    );
    expect(sync).not.toHaveBeenCalled();
    fireEvent.change(
      within(review).getByRole("textbox", { name: /Lý do thay đổi/ }),
      { target: { value: "  Điều chuyển nhiệm vụ  " } },
    );
    fireEvent.click(
      within(review).getByRole("button", { name: "Xác nhận lưu" }),
    );
    await waitFor(() =>
      expect(sync).toHaveBeenCalledWith({
        roleId: "role-warehouse",
        permissionIds: ["p-create", "p-locked", "p-retired", "p-view"],
        reason: "Điều chuyển nhiệm vụ",
      }),
    );
  });

  it("keeps draft changes on a save conflict and loads real latest data for comparison", async () => {
    sync.mockRejectedValue(
      createMockAxiosError({
        status: 412,
        data: { message: "Vai trò đã thay đổi" },
      }),
    );
    renderScreen();
    await toggleCreate();
    const review = await openReview();
    fireEvent.change(
      within(review).getByRole("textbox", { name: /Lý do thay đổi/ }),
      { target: { value: "Điều chuyển nhiệm vụ" } },
    );
    fireEvent.click(
      within(review).getByRole("button", { name: "Xác nhận lưu" }),
    );
    expect(
      await within(review).findByText("Vai trò đã được cập nhật ở phiên khác"),
    ).toBeInTheDocument();
    expect(
      within(review).getByRole("textbox", { name: /Lý do thay đổi/ }),
    ).toHaveValue("Điều chuyển nhiệm vụ");
    expect(
      within(review).getByRole("button", { name: "Xác nhận lưu" }),
    ).toBeDisabled();
    fireEvent.click(
      within(review).getByRole("button", { name: "Tải bản mới để đối chiếu" }),
    );
    await waitFor(() =>
      expect(getIamRole).toHaveBeenCalledWith("role-warehouse"),
    );
    expect(
      await within(review).findByText("Dữ liệu mới nhất"),
    ).toBeInTheDocument();
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite an unsaved draft when query data changes in the background", async () => {
    const result = renderScreen();
    await toggleCreate();
    mockRoles([{ ...ROLE, permissions: [VIEW, POST, LOCKED, RETIRED] }]);
    result.rerender(<IamRolePermissionScreen />);
    expect(
      screen.getByRole("checkbox", { name: "Tạo phiếu nhập (inbound.create)" }),
    ).toBeChecked();
    expect(
      screen.getByText("Vai trò đã được cập nhật ở phiên khác"),
    ).toBeInTheDocument();
    expect(sync).not.toHaveBeenCalled();
  });

  it("protects the system role from permission and metadata mutations", async () => {
    mockRoles([{ ...ROLE, role_code: "SUPER_ADMIN" }]);
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
    renderScreen();
    expect(
      await screen.findByRole("checkbox", {
        name: "Tạo phiếu nhập (inbound.create)",
      }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Xem lại & lưu" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thông tin vai trò" }));
    const drawer = await screen.findByRole("dialog", { name: "Sửa vai trò" });
    expect(
      await within(drawer).findByRole("textbox", { name: /Mã vai trò/ }),
    ).toBeDisabled();
    expect(
      within(drawer).queryByRole("button", { name: "Lưu vai trò" }),
    ).not.toBeInTheDocument();
  });

  it("creates a role with only supported, normalized metadata", async () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Tạo vai trò" }));
    const drawer = await screen.findByRole("dialog", { name: "Tạo vai trò" });
    await within(drawer).findByRole("textbox", { name: /Mã vai trò/ });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Tạo vai trò" }),
    );
    expect(create).not.toHaveBeenCalled();
    fireEvent.change(
      within(drawer).getByRole("textbox", { name: /Mã vai trò/ }),
      { target: { value: " new_role " } },
    );
    fireEvent.change(
      within(drawer).getByRole("textbox", { name: /Tên vai trò/ }),
      { target: { value: "  Điều phối kho  " } },
    );
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Tạo vai trò" }),
    );
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        role_code: "NEW_ROLE",
        role_name: "Điều phối kho",
        scope_type: "FUNCTION",
        status: "ACTIVE",
      }),
    );
  });

  it("shows a retryable load failure without an editable matrix", async () => {
    vi.mocked(useIamPermissions).mockReturnValue(
      query(undefined, { isError: true, error: new Error("offline") }) as never,
    );
    renderScreen();
    expect(
      await screen.findByText("Chưa tải được dữ liệu phân quyền"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("never requests audit history without its separate permission", async () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử thay đổi" }));
    expect(
      await screen.findByText("Bạn không có quyền xem lịch sử thay đổi."),
    ).toBeInTheDocument();
    expect(auditLogService.getAuditLogs).not.toHaveBeenCalled();
  });

  it("loads only the selected role history and preserves real permission and metadata diffs", async () => {
    useAuthStore.setState({
      permissionCodes: [
        ...useAuthStore.getState().permissionCodes,
        "audit_log.view",
      ],
    });
    vi.mocked(auditLogService.getAuditLogs).mockResolvedValue({
      data: [
        {
          id: "audit-1",
          object_type: "role",
          object_id: ROLE.role_id,
          action: "ASSIGN_PERMISSIONS",
          result: null,
          actor: null,
          reason: "Bổ sung nhiệm vụ",
          before_data: { permission_ids: [VIEW.permission_id] },
          after_data: {
            permission_ids: [VIEW.permission_id, CREATE.permission_id],
          },
          created_at: "2026-11-04T09:00:00+07:00",
        },
        {
          id: "audit-2",
          object_type: "role",
          object_id: ROLE.role_id,
          action: "UPDATE",
          result: null,
          actor: null,
          reason: "Đổi tên vai trò",
          before_data: { role_name: "Tên vai trò cũ" },
          after_data: { role_name: "Tên vai trò mới" },
          created_at: "2026-11-04T10:00:00+07:00",
        },
        {
          id: "audit-other",
          object_type: "role",
          object_id: "another-role",
          reason: "Không phải vai trò này",
        },
      ],
      meta: { total: 2 },
    } as never);
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử thay đổi" }));
    const drawer = await screen.findByRole("dialog", {
      name: "Lịch sử thay đổi phân quyền",
    });
    await within(drawer).findByText("Bổ sung nhiệm vụ");
    await waitFor(() =>
      expect(within(drawer).getByText("Bổ sung nhiệm vụ")).toBeVisible(),
    );
    expect(auditLogService.getAuditLogs).toHaveBeenCalledWith({
      q: ROLE.role_id,
      page: 1,
      limit: 10,
      date_from: undefined,
      date_to: undefined,
    });
    for (const summary of within(drawer).getAllByText("Xem thay đổi"))
      fireEvent.click(summary);
    expect(within(drawer).getByText("+ Tạo phiếu nhập")).toBeVisible();
    expect(within(drawer).getByText("Tên vai trò cũ")).toBeVisible();
    expect(within(drawer).getByText("Tên vai trò mới")).toBeVisible();
    expect(
      within(drawer).queryByText("Không phải vai trò này"),
    ).not.toBeInTheDocument();
    expect(within(drawer).queryByText("Thành công")).not.toBeInTheDocument();
  });

  it("shows a short affected-user preview and expands it without losing the permission draft", async () => {
    vi.mocked(useIamUsers).mockReturnValue(
      query({
        data: Array.from({ length: 5 }, (_, index) => ({
          user_id: "user-" + index,
          username: "keeper" + index,
          display_name: "Nhân viên " + index,
          roles: [ROLE],
        })),
        meta: { total: 5 },
      }) as never,
    );
    renderScreen();
    await toggleCreate();
    const review = await openReview();
    expect(within(review).getByText("Nhân viên 2")).toBeInTheDocument();
    expect(within(review).queryByText("Nhân viên 3")).not.toBeInTheDocument();
    fireEvent.click(
      within(review).getByRole("button", { name: "Xem danh sách người dùng" }),
    );
    expect(within(review).getByText("Nhân viên 4")).toBeInTheDocument();
    expect(within(review).getByText("Tạo phiếu nhập")).toBeInTheDocument();
    expect(sync).not.toHaveBeenCalled();
  });

  it("closes metadata after a status action so a stale form cannot revert the server status", async () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Thông tin vai trò" }));
    const drawer = await screen.findByRole("dialog", { name: "Sửa vai trò" });
    await within(drawer).findByRole("textbox", { name: /Mã vai trò/ });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Vô hiệu hóa" }),
    );
    const confirmation = await screen.findByRole("dialog", {
      name: "Vô hiệu hóa vai trò?",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Vô hiệu hóa" }),
    );
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        roleId: ROLE.role_id,
        payload: {
          role_code: ROLE.role_code,
          role_name: ROLE.role_name,
          scope_type: "FUNCTION",
          status: "INACTIVE",
        },
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Sửa vai trò" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("reports dirty state for guarded external navigation without clearing it on unmount", async () => {
    const onDirtyChange = vi.fn();
    const result = renderWithProviders(
      <IamRolePermissionScreen onDirtyChange={onDirtyChange} />,
    );
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await toggleCreate();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    result.unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("preserves the role page-size control and sends the selected size to the existing lookup", async () => {
    renderScreen();
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "Số dòng mỗi trang" }),
    );
    fireEvent.click(await screen.findByRole("option", { name: "20 / trang" }));
    await waitFor(() =>
      expect(useIamRolesPage).toHaveBeenLastCalledWith({
        keyword: undefined,
        page: 1,
        per_page: 20,
      }),
    );
  });
});
