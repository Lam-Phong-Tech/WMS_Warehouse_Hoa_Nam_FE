import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ContextSwitcher } from "@/modules/auth/components/ContextSwitcher";
import { useAuthStore } from "@/shared/store/auth.store";
import { authService } from "@/modules/auth/services/auth.service";
import { renderWithProviders } from "@/test/test-utils";
import type { AuthContext } from "@/modules/auth/types/auth.types";

const CTX_A: AuthContext = {
  role_id: "role-a",
  role_name: "Nhân viên kho",
  scope_type: "kho",
  org_unit_id: null,
  org_unit_name: null,
  department_id: null,
  department_name: null,
  warehouse_id: null,
  warehouse_name: "WH-A",
  context_type: "WAREHOUSE",
  context_id: "WH-A",
  scope_ref: "WH-A",
};

const CTX_B: AuthContext = {
  ...CTX_A,
  role_id: "role-b",
  role_name: "Quản lý kho",
  warehouse_name: "WH-B",
  context_id: "WH-B",
  scope_ref: "WH-B",
};

describe("ContextSwitcher", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    vi.restoreAllMocks();
  });

  it("chỉ có 1 context → hiển thị tĩnh, không có dropdown", () => {
    useAuthStore.setState({ contexts: [CTX_A], currentContext: CTX_A });
    renderWithProviders(<ContextSwitcher />);
    expect(screen.getByText("Nhân viên kho")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("chọn kho khác gọi đúng payload BE và lưu token/context mới", async () => {
    const switchContextSpy = vi
      .spyOn(authService, "switchContext")
      .mockResolvedValue({
        access_token: "new-jwt",
        token_type: "bearer",
        expires_in: 3600,
        active_context: {
          context_type: "WAREHOUSE",
          context_id: "WH-B",
          scope_ref: "WH-B",
        },
      });
    const user = userEvent.setup();
    useAuthStore.setState({
      token: "old-jwt",
      contexts: [CTX_A, CTX_B],
      currentContext: CTX_A,
    });
    renderWithProviders(<ContextSwitcher />);

    await user.click(screen.getByText("Nhân viên kho"));
    await user.click(await screen.findByText("Quản lý kho"));

    await waitFor(() => {
      expect(switchContextSpy).toHaveBeenCalledWith({
        context_type: "WAREHOUSE",
        context_id: "WH-B",
        scope_ref: "WH-B",
      });
    });
    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("new-jwt");
      expect(useAuthStore.getState().currentContext).toEqual(CTX_B);
    });
  });

  it("không có currentContext → không render gì", () => {
    useAuthStore.setState({ contexts: [], currentContext: null });
    renderWithProviders(<ContextSwitcher />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/nhân viên kho|quản lý kho/i),
    ).not.toBeInTheDocument();
  });
});
