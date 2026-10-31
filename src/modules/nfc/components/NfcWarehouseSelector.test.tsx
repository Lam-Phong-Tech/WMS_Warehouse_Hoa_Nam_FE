import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { http } from "@/shared/api/http";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
import { NfcWarehouseSelector } from "./NfcWarehouseSelector";

vi.mock("@/shared/api/http", () => ({
  http: { get: vi.fn() },
}));
vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: { switchContext: vi.fn() },
}));

const warehouses = [
  {
    warehouse_id: "wh-1",
    code: "HN01",
    name: "Kho tổng Hoa Nam",
    status: "ACTIVE",
  },
  {
    warehouse_id: "wh-2",
    code: "HN02",
    name: "Kho chi nhánh",
    status: "ACTIVE",
  },
];

describe("NFC warehouse selector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    useAuthStore.setState({
      token: "old-token",
      currentContext: {
        role_id: "admin",
        role_name: "Super Admin",
        scope_type: "he_thong",
        org_unit_id: null,
        org_unit_name: null,
        department_id: null,
        department_name: null,
        warehouse_id: null,
        warehouse_name: null,
        context_type: "SYSTEM",
        context_id: null,
        scope_ref: null,
      },
    });
    vi.mocked(http.get).mockResolvedValue({ available_warehouses: warehouses });
  });

  it("shows the warehouse picker and switches only after choosing a warehouse", async () => {
    vi.mocked(authService.switchContext).mockResolvedValue({
      access_token: "warehouse-token",
      token_type: "bearer",
      expires_in: 3600,
      active_context: {
        context_type: "WAREHOUSE",
        context_id: "wh-1",
        scope_ref: "wh-1",
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<NfcWarehouseSelector />);

    const picker = screen.getByRole("button", { name: "Kho làm việc" });
    expect(picker).toHaveTextContent("Chọn kho làm việc");
    expect(authService.switchContext).not.toHaveBeenCalled();
    await user.click(picker);
    await user.click(
      await screen.findByRole("menuitem", { name: /Kho tổng Hoa Nam/ }),
    );

    await waitFor(() =>
      expect(authService.switchContext).toHaveBeenCalledWith({
        context_type: "WAREHOUSE",
        context_id: "wh-1",
        scope_ref: "wh-1",
      }),
    );
    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe("warehouse-token");
      expect(useAuthStore.getState().currentContext?.warehouse_name).toBe(
        "Kho tổng Hoa Nam",
      );
    });
  });

  it("keeps the current context when switching fails", async () => {
    vi.mocked(authService.switchContext).mockRejectedValue(new Error("failed"));
    const user = userEvent.setup();
    renderWithProviders(<NfcWarehouseSelector />);
    await user.click(screen.getByRole("button", { name: "Kho làm việc" }));
    await user.click(
      await screen.findByRole("menuitem", { name: /Kho chi nhánh/ }),
    );

    await waitFor(() => expect(authService.switchContext).toHaveBeenCalled());
    expect(useAuthStore.getState().currentContext?.context_type).toBe("SYSTEM");
    expect(useAuthStore.getState().token).toBe("old-token");
  });
});
