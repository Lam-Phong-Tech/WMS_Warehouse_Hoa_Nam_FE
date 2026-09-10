import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { ROUTES } from "@/shared/constants/routes";

vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: {
    login: vi.fn(),
    verifyMfa: vi.fn(),
  },
}));

const CONTEXT = {
  role_id: "r1",
  role_name: "SUPER_ADMIN",
  scope_type: "GLOBAL",
  org_unit_id: null,
  org_unit_name: null,
  department_id: null,
  department_name: null,
  warehouse_id: null,
  warehouse_name: null,
  context_type: null,
  context_id: null,
  scope_ref: "",
};

function renderLogin() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.DASHBOARD} element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * WWHN-SEC-08 — bước 2 của đăng nhập ở phía giao diện.
 *
 * Điều PHẢI được khoá lại bằng test: sau khi mật khẩu đúng nhưng chưa qua MFA,
 * store xác thực vẫn RỖNG. Đây là chỗ dễ hỏng nhất khi ai đó "tối ưu" bằng cách
 * lưu tạm phiên để đỡ phải gọi lại — và khi hỏng thì giao diện vẫn hiện màn nhập
 * mã, nhìn bằng mắt không thấy gì sai.
 */
describe("LoginPage · xác thực hai bước", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: true });
  });

  it("mật khẩu đúng nhưng cần MFA thì chuyển sang bước nhập mã và CHƯA lưu phiên", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      kind: "mfa_required",
      mfa_required: true,
      mfa_token: "challenge-token",
      expires_in: 300,
    });

    renderLogin();

    await userEvent.type(
      screen.getByLabelText("Email"),
      "admin@example.com",
    );
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "Test#Password-2026");
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));

    expect(await screen.findByLabelText("Mã xác thực")).toBeInTheDocument();

    // Điểm cốt lõi: chưa có token nào trong store.
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("nhập mã đúng thì hoàn tất đăng nhập", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      kind: "mfa_required",
      mfa_required: true,
      mfa_token: "challenge-token",
      expires_in: 300,
    });
    vi.mocked(authService.verifyMfa).mockResolvedValue({
      kind: "authenticated",
      access_token: "access-token",
      token_type: "bearer",
      expires_in: 3600,
      available_contexts: [CONTEXT],
      user: { id: 1, name: "Admin", email: "admin@example.com", code: "HN-01" },
    } as never);

    renderLogin();

    await userEvent.type(screen.getByLabelText("Email"), "admin@example.com");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "Test#Password-2026");
    await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));

    const codeField = await screen.findByLabelText("Mã xác thực");
    await userEvent.type(codeField, "123456");
    await userEvent.click(screen.getByRole("button", { name: /xác nhận/i }));

    await waitFor(() => {
      expect(authService.verifyMfa).toHaveBeenCalledWith(
        "challenge-token",
        "123456",
      );
    });

    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe("access-token");
  });
});
