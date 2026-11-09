import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IamUserScreen } from "@/modules/iam/pages/IamUserScreen";
import { useAuthStore } from "@/shared/store/auth.store";

vi.unmock("antd");

const { mutation, updateSpy, createSpy } = vi.hoisted(() => ({
  updateSpy: vi.fn().mockResolvedValue({}),
  createSpy: vi.fn().mockResolvedValue({}),
  mutation: () => ({
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("@/modules/iam/hooks/use-iam", () => ({
  useIamUsers: () => ({
    data: {
      data: [
        {
          user_id: "user-1",
          display_name: "Nguyễn Văn Kho",
          username: "nvkho01",
          phone: "0901234567",
          email: "nvkho01@gmail.com",
          status: "ACTIVE",
          version: 2,
          last_login_at: "2026-08-10T08:14:00+07:00",
          roles: [
            {
              role_id: "role-warehouse",
              role_code: "WAREHOUSE_STAFF",
              role_name: "Nhân viên kho",
              scope_type: "WAREHOUSE",
              status: "ACTIVE",
              pivot: { scope_ref: null },
            },
          ],
        },
      ],
      meta: {},
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useIamRoles: () => ({
    data: [
      {
        role_id: "role-warehouse",
        role_code: "WAREHOUSE_STAFF",
        role_name: "Nhân viên kho",
        scope_type: "WAREHOUSE",
        status: "ACTIVE",
      },
    ],
    isLoading: false,
    error: null,
  }),
  // BR-IAM-08: IAM-02 chọn phạm vi dữ liệu theo kho.
  useIamScopeWarehouses: () => ({
    data: [{ id: "wh-1", code: "KHO-TONG-HN", name: "Kho tổng Hoa Nam" }],
    isLoading: false,
    error: null,
  }),
  // REQ-011: dropdown Phòng ban (lọc + gán) trên màn User.
  useIamDepartments: () => ({
    data: [
      {
        department_id: "dept-1",
        department_code: "KHO",
        department_name: "Phòng Kho vận",
        status: "ACTIVE",
      },
    ],
    isLoading: false,
    error: null,
  }),
  useCreateIamUser: () => ({ isPending: false, mutateAsync: createSpy }),
  useUpdateIamUser: () => ({ isPending: false, mutateAsync: updateSpy }),
  // Quyền cấp riêng theo tài khoản (yêu cầu #2/#4) — không dùng trong các test
  // hiện có nên trả dữ liệu rỗng/no-op là đủ.
  useIamPermissions: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useIamUserPermissionOverrides: () => ({
    data: [
      {
        user_permission_id: "override-1",
        permission_id: "permission-report",
        permission_key: "report.export",
        permission_name: "Xuất báo cáo",
      },
    ],
    isLoading: false,
    error: null,
  }),
  useGrantIamUserPermission: mutation,
  useRevokeIamUserPermission: mutation,
}));

describe("IamUserScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
  });

  it("renders backend users and opens create inside IAM-01", () => {
    render(<IamUserScreen />);
    const row = screen.getByText("Nguyễn Văn Kho").closest("tr");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLTableRowElement).getByText("Nhân viên kho"),
    ).toBeInTheDocument();

    // Nút dùng icon PlusOutlined + label (redesign "thêm icon full cho các hành động").
    fireEvent.click(screen.getByRole("button", { name: /Thêm người dùng/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelector("#iam-email")).toBeRequired();
    expect(dialog.querySelector("#iam-username")).toBeNull();
  });

  it("opens the user detail from anywhere on a row", async () => {
    render(<IamUserScreen />);
    fireEvent.click(screen.getByText("Nguyễn Văn Kho"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("opens edit with server data and optimistic-lock version", async () => {
    render(<IamUserScreen />);
    const row = screen.getByText("Nguyễn Văn Kho").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(
      within(row as HTMLTableRowElement).getByRole("button", {
        name: "Chi tiết người dùng",
      }),
    );

    fireEvent.click(
      await within(screen.getByRole("dialog")).findByRole("button", {
        name: "Sửa",
      }),
    );
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByLabelText("Họ và tên *")).toHaveValue(
      "Nguyễn Văn Kho",
    );
    expect(dialog.querySelector("#iam-email")).toHaveValue("nvkho01@gmail.com");
  });

  it("converts legacy IAM-02 into the IAM-01 create modal", () => {
    render(<IamUserScreen openCreateOnMount />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn Kho")).toBeInTheDocument();
  });
  it("keeps page size in the footer and clears active filters", () => {
    render(<IamUserScreen />);
    expect(
      screen.getByRole("navigation", { name: /Phân trang/ }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm người dùng" }), {
      target: { value: "Kho" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    expect(screen.getByRole("textbox", { name: "Tìm người dùng" })).toHaveValue(
      "",
    );
  });

  it("saves a reviewed profile update with the original optimistic version", async () => {
    render(<IamUserScreen />);
    fireEvent.click(
      screen.getByRole("button", { name: "Chi tiết người dùng" }),
    );
    fireEvent.click(
      await within(screen.getByRole("dialog")).findByRole("button", {
        name: "Sửa",
      }),
    );
    let dialog = screen.getByRole("dialog");
    fireEvent.change(await within(dialog).findByLabelText("Họ và tên *"), {
      target: { value: "Tên mới" },
    });
    fireEvent.click(
      await within(dialog).findByRole("tab", { name: "Xem lại & lưu" }),
    );
    dialog = screen.getByRole("dialog");
    fireEvent.change(dialog.querySelector("#iam-reason")!, {
      target: { value: "Cập nhật thông tin liên hệ" },
    });
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          payload: expect.objectContaining({
            version: 2,
            display_name: "Tên mới",
          }),
          assignment: expect.objectContaining({ role_id: "role-warehouse" }),
        }),
      ),
    );
  });

  it("returns to the invalid field step instead of leaving hidden errors", async () => {
    render(<IamUserScreen />);
    fireEvent.click(screen.getByRole("button", { name: /Thêm người dùng/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      await within(dialog).findByRole("tab", { name: "Xem lại & lưu" }),
    );
    fireEvent.submit(dialog.querySelector("form")!);
    expect(
      within(dialog).getByRole("tab", { name: "Thông tin tài khoản" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByLabelText("Họ và tên *")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(createSpy).not.toHaveBeenCalled();
  });
  it("labels direct grants and keeps revoke available without unsupported override fields", async () => {
    render(<IamUserScreen />);
    fireEvent.click(
      screen.getByRole("button", { name: "Chi tiết người dùng" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      await within(dialog).findByRole("tab", { name: "Quyền hiệu lực" }),
    );
    expect(await within(dialog).findByText("Cấp riêng")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Thu hồi" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Xuất báo cáo")).toBeInTheDocument();
  });
});
