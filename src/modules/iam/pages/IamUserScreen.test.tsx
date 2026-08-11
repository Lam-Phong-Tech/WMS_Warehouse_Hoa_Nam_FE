import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IamUserScreen } from "@/modules/iam/pages/IamUserScreen";
import { useAuthStore } from "@/shared/store/auth.store";

const mutation = () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) });

vi.mock("@/modules/iam/hooks/use-iam", () => ({
  useIamUsers: () => ({
    data: {
      data: [
        {
          user_id: "user-1",
          display_name: "Nguyễn Văn Kho",
          username: "nvkho01",
          phone: "0901234567",
          email: "nvkho01@hoanam.vn",
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
  useCreateIamUser: mutation,
  useUpdateIamUser: mutation,
}));

describe("IamUserScreen", () => {
  beforeEach(() => {
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
  });

  it("renders backend users and opens create inside IAM-01", () => {
    render(<IamUserScreen />);
    expect(screen.getByText("Nguyễn Văn Kho")).toBeInTheDocument();
    expect(screen.getByText("Nhân viên kho")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Thêm người dùng" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens edit with server data and optimistic-lock version", () => {
    render(<IamUserScreen />);
    const row = screen.getByText("Nguyễn Văn Kho").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLTableRowElement).getByRole("button", { name: "Sửa" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Họ và tên *")).toHaveValue("Nguyễn Văn Kho");
    expect(within(dialog).getByText("2")).toBeInTheDocument();
  });

  it("converts legacy IAM-02 into the IAM-01 create modal", () => {
    render(<IamUserScreen openCreateOnMount />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn Kho")).toBeInTheDocument();
  });
});
