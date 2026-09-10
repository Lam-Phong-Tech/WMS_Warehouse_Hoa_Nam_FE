import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { authService } from "@/modules/auth/services/auth.service";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

// Cần `isAxiosError` THẬT để LoginPage đi đúng nhánh "không có response".
vi.unmock("axios");

vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: { login: vi.fn(), verifyMfa: vi.fn() },
}));

function renderLogin() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function submit() {
  await userEvent.type(screen.getByLabelText("Email"), "operator@example.test");
  await userEvent.type(screen.getByLabelText("Mật khẩu"), "Test#Password-2026");
  await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
}

/**
 * Màn trong ảnh chụp của tester chỉ có câu "Không kết nối được hệ thống" — không
 * gì phân biệt được mất mạng thật, request bị huỷ, hay kết nối bị cắt. Dòng mã chẩn
 * đoán phải hiện KÈM câu đó (và chỉ khi lỗi thật sự không có HTTP response).
 */
describe("LoginPage · mã chẩn đoán lỗi vận chuyển", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: true });
  });

  it("lỗi mạng không có response: hiện câu mất kết nối kèm mã chẩn đoán", async () => {
    vi.mocked(authService.login).mockRejectedValue({
      isAxiosError: true,
      code: "ERR_NETWORK",
      message: "Network Error",
      wmsTransport: {
        summary: "ERR_NETWORK/network | 812ms | +1.4s | online | h2",
      },
    });

    renderLogin();
    await submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không kết nối được hệ thống");
    expect(screen.getByTestId("login-transport-diagnostic")).toHaveTextContent(
      "Mã chẩn đoán: ERR_NETWORK/network | 812ms | +1.4s | online | h2",
    );
  });

  it("sai mật khẩu (401 có response): không có dòng mã chẩn đoán", async () => {
    vi.mocked(authService.login).mockRejectedValue({
      isAxiosError: true,
      code: "ERR_BAD_REQUEST",
      message: "Request failed with status code 401",
      response: { status: 401, data: {} },
    });

    renderLogin();
    await submit();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      screen.queryByTestId("login-transport-diagnostic"),
    ).not.toBeInTheDocument();
  });
});
