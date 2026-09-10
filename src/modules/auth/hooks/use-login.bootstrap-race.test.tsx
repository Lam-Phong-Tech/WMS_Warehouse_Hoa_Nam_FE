import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/app/providers/query-client";
import { bootstrapAuth } from "@/app/bootstrap-auth";
import { useLogin } from "@/modules/auth/hooks/use-login";
import { authService } from "@/modules/auth/services/auth.service";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: { login: vi.fn(), refresh: vi.fn() },
  meResponseFromRefreshUser: vi.fn(() => null),
}));

/**
 * Race khởi động phiên ↔ đăng nhập tay (10/09/2026).
 *
 * `/login` render ngay, KHÔNG chờ `bootstrapAuth`. Khi trình duyệt còn dấu vết
 * phiên cũ, bootstrap gọi `/auth/refresh` song song với lúc người dùng gõ. Nếu
 * người dùng bấm đăng nhập trước khi refresh trả về thì trước đây hai thao tác
 * cùng đổi phiên chạy song song:
 *  - refresh trả 401 SAU khi login xong → `clearSessionHint()` → `logout()` xoá
 *    luôn phiên VỪA đăng nhập → người dùng bị đá về /login mà không có lỗi nào;
 *  - refresh lỗi mạng SAU khi login xong → `bootstrapError` bị ghi đè lên phiên
 *    mới → ProtectedRoute dựng thẻ "không khôi phục được phiên" dù đã đăng nhập.
 *
 * Dùng ĐÚNG `queryClient` dùng chung của app: `logout()` gọi `queryClient.clear()`
 * trên chính client đó, nên test phải chứng minh mutation đăng nhập đang chờ vẫn
 * sống sót qua lần clear ấy.
 */

const CONTEXT = {
  role_id: "role-warehouse",
  role_name: "Quản lý kho",
  scope_type: "kho",
  org_unit_id: null,
  org_unit_name: null,
  department_id: null,
  department_name: null,
  warehouse_id: null,
  warehouse_name: "WH-HN-01",
  context_type: "WAREHOUSE",
  context_id: "WH-HN-01",
  scope_ref: "WH-HN-01",
};

const LOGIN_OK = {
  kind: "authenticated" as const,
  access_token: "<fresh-login-token>",
  token_type: "bearer",
  expires_in: 3600,
  available_contexts: [CONTEXT],
  user: {
    id: 7,
    name: "Kho",
    email: "operator@example.test",
    code: "HN-FE-07",
  },
};

function LoginHarness() {
  const login = useLogin();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          login.mutate({
            email: "operator@example.test",
            password: "<irrelevant>",
          })
        }
      >
        Login
      </button>
      {login.isError ? <div>Login failed</div> : null}
    </>
  );
}

function renderLogin() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginHarness />} />
          <Route path={ROUTES.DASHBOARD} element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

type Settle = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

let heldRefresh: Settle | null = null;
let booting: Promise<void> | null = null;

/** Refresh treo cho tới khi test tự quyết định kết quả. */
function holdRefresh(): Settle {
  let settle!: Settle;
  const pending = new Promise((resolve, reject) => {
    settle = { resolve, reject };
  });
  // Test trượt giữa chừng thì có thể không ai còn chờ promise này — đánh dấu đã
  // xử lý để lỗi hiện đúng ở test đó, không thành "Unhandled Rejection" ở test sau.
  pending.catch(() => undefined);
  vi.mocked(authService.refresh).mockReturnValue(pending as never);
  heldRefresh = settle;
  return settle;
}

describe("đăng nhập tay không chạy song song với bootstrap refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: true, bootstrapError: null });
    vi.mocked(authService.login).mockResolvedValue(LOGIN_OK as never);
  });

  afterEach(async () => {
    // Refresh còn treo phải được giải phóng: `bootstrapAuth` là single-flight, một
    // lượt không bao giờ xong sẽ bị test sau dùng lại thay vì mở lượt mới.
    heldRefresh?.reject(new Error("test cleanup"));
    heldRefresh = null;
    await booting;
    booting = null;
    useAuthStore.getState().logout();
    queryClient.clear();
  });

  it("chưa gửi mật khẩu khi refresh của bootstrap còn đang bay", async () => {
    const refresh = holdRefresh();
    booting = bootstrapAuth();
    renderLogin();

    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    // Vài vòng microtask/macrotask là quá đủ để mutationFn chạy nếu không có cổng chờ.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(authService.login).not.toHaveBeenCalled();

    refresh.reject({ isAxiosError: true, response: { status: 401 } });
    await booting;
    await waitFor(() => expect(authService.login).toHaveBeenCalledTimes(1));
  });

  it("refresh trả 401 sau khi bấm đăng nhập: phiên mới vẫn còn, không bị đá về /login", async () => {
    const refresh = holdRefresh();
    booting = bootstrapAuth();
    renderLogin();

    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    refresh.reject({ isAxiosError: true, response: { status: 401 } });
    await booting;

    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe("<fresh-login-token>");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("refresh lỗi mạng sau khi bấm đăng nhập: không để lại bootstrapError trên phiên mới", async () => {
    const refresh = holdRefresh();
    booting = bootstrapAuth();
    renderLogin();

    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    refresh.reject(new Error("Network Error"));
    await booting;

    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe("<fresh-login-token>");
    expect(useAuthStore.getState().bootstrapError).toBeNull();
  });
});
