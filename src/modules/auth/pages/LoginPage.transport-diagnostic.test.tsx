import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { authService } from "@/modules/auth/services/auth.service";
import type { BackendProbe } from "@/shared/api/backend-availability";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

// Cần `isAxiosError` THẬT để LoginPage đi đúng nhánh "không có response".
vi.unmock("axios");

vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: { login: vi.fn(), verifyMfa: vi.fn() },
}));

/**
 * Kết quả dò /health do từng test quyết định. Đồng hồ giả: vòng chờ 15–45 s của
 * backend-availability chạy xong tức thì nhưng vẫn đi đúng ngân sách thật.
 */
const probes = vi.hoisted(() => ({
  queue: [] as string[],
  fallback: "unreachable",
  hold: null as Promise<string> | null,
}));

vi.mock("@/shared/api/backend-availability", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/shared/api/backend-availability")>();
  return {
    ...actual,
    withBackendRecovery: <T,>(task: () => Promise<T>) => {
      let clock = 0;
      return actual.withBackendRecovery(task, {
        probe: async () => {
          const held = probes.hold;
          if (held) {
            probes.hold = null;
            return (await held) as BackendProbe;
          }
          return (probes.queue.shift() ?? probes.fallback) as BackendProbe;
        },
        sleep: async (ms: number) => {
          clock += ms;
        },
        now: () => clock,
      });
    },
  };
});

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

const LOGIN_OK = {
  kind: "authenticated" as const,
  access_token: "access-token",
  token_type: "bearer",
  expires_in: 3600,
  available_contexts: [CONTEXT],
  user: { id: 1, name: "Kho", email: "operator@example.test", code: "HN-01" },
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

async function submit() {
  await userEvent.type(screen.getByLabelText("Email"), "operator@example.test");
  await userEvent.type(screen.getByLabelText("Mật khẩu"), "Test#Password-2026");
  await userEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
}

/** 503 do nginx của BE tự sinh khi php-fpm chưa nghe cổng (backend đang khởi động lại). */
function gatewayUnavailable() {
  return {
    isAxiosError: true,
    code: "ERR_BAD_RESPONSE",
    message: "Request failed with status code 503",
    response: {
      status: 503,
      data: { success: false, error_code: "BACKEND_UNAVAILABLE" },
    },
  };
}

/**
 * Màn trong ảnh chụp của tester chỉ có câu "Không kết nối được hệ thống" — không
 * gì phân biệt được mất mạng thật, request bị huỷ, hay kết nối bị cắt. Dòng mã chẩn
 * đoán phải hiện KÈM câu đó (và chỉ khi lỗi thật sự không có HTTP response hoặc là
 * lỗi gateway).
 *
 * Ticket 10/09/2026 "ERR_NETWORK/network | 13ms | ... | cross-origin": backend đang
 * khởi động lại. Màn đăng nhập nay tự chờ máy chủ rồi gửi lại, chỉ báo lỗi khi hết
 * thời gian — với câu nói đúng điều dò được.
 */
describe("LoginPage · mã chẩn đoán lỗi vận chuyển", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    probes.queue = [];
    probes.fallback = "unreachable";
    probes.hold = null;
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: true });
  });

  it("lỗi mạng không có response, dò /health cũng không tới được: câu mất kết nối kèm mã chẩn đoán", async () => {
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
      "Mã chẩn đoán: ERR_NETWORK/network | 812ms | +1.4s | online | h2 | probe:unreachable",
    );
    expect(authService.login).toHaveBeenCalledTimes(1);
  });

  it("sai mật khẩu (401 có response): không chờ máy chủ, không có dòng mã chẩn đoán", async () => {
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
    expect(authService.login).toHaveBeenCalledTimes(1);
  });

  it("máy chủ đang khởi động lại: báo đang chờ rồi TỰ đăng nhập lại khi /health trả lời", async () => {
    let release!: (probe: string) => void;
    probes.hold = new Promise<string>((resolve) => {
      release = resolve;
    });
    vi.mocked(authService.login)
      .mockRejectedValueOnce(gatewayUnavailable())
      .mockResolvedValueOnce(LOGIN_OK as never);

    renderLogin();
    await submit();

    expect(
      await screen.findByText(/Máy chủ chưa sẵn sàng/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    release("ready");

    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
    expect(authService.login).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().token).toBe("access-token");
  });

  it("gateway 503 kéo dài quá thời gian chờ: báo máy chủ đang khởi động lại kèm mã HTTP", async () => {
    probes.fallback = "unavailable";
    vi.mocked(authService.login).mockRejectedValue(gatewayUnavailable());

    renderLogin();
    await submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Máy chủ đang khởi động lại hoặc tạm gián đoạn",
    );
    expect(alert).not.toHaveTextContent("Kiểm tra kết nối mạng");
    expect(screen.getByTestId("login-transport-diagnostic")).toHaveTextContent(
      "Mã chẩn đoán: HTTP 503 BACKEND_UNAVAILABLE | probe:unavailable",
    );
    expect(authService.login).toHaveBeenCalledTimes(1);
  });
});
