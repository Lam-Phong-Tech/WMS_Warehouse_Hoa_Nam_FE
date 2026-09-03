import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { LoginPage } from "@/modules/auth/pages/LoginPage";

describe("LoginPage", () => {
  it("hiển thị form đăng nhập", () => {
    renderWithProviders(<LoginPage />);
    expect(
      screen.getByRole("heading", { name: /chào mừng đến với hoa nam/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /đăng nhập/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /ghi nhớ đăng nhập/i }),
    ).toBeInTheDocument();
  });

  it("báo lỗi validation khi submit form trống", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));

    expect(
      await screen.findByText(/vui lòng nhập email hoặc tên đăng nhập/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/vui lòng nhập mật khẩu/i),
    ).toBeInTheDocument();
  });

  it("báo lỗi khi email sai định dạng", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(
      screen.getByPlaceholderText(/your@gmail\.com/i),
      "not-an-email@",
    );
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));

    expect(await screen.findByText(/email không hợp lệ/i)).toBeInTheDocument();
  });
});
