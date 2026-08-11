import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IamUserScreen } from "@/modules/iam/pages/IamUserScreen";

describe("IamUserScreen", () => {
  it("opens create user as a modal without leaving the user list", () => {
    render(<IamUserScreen />);

    expect(screen.getByText("Nguyễn Văn Kho")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "+ Thêm người dùng" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Thêm người dùng")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn Kho")).toBeInTheDocument();
  });

  it("opens edit with the selected user data and saves back into the list", () => {
    render(<IamUserScreen />);

    const firstRow = screen.getByText("Nguyễn Văn Kho").closest("tr");
    expect(firstRow).not.toBeNull();
    fireEvent.click(within(firstRow as HTMLTableRowElement).getByRole("button", { name: "Sửa" }));

    const dialog = screen.getByRole("dialog");
    const displayName = within(dialog).getByLabelText("Họ và tên *");
    expect(displayName).toHaveValue("Nguyễn Văn Kho");

    fireEvent.change(displayName, { target: { value: "Nguyễn Văn Kho Mới" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu người dùng" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn Kho Mới")).toBeInTheDocument();
  });

  it("converts the legacy IAM-02 entry into the create modal on IAM-01", () => {
    render(<IamUserScreen openCreateOnMount />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn Kho")).toBeInTheDocument();
  });
});
