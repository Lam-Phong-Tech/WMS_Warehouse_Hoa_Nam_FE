import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { http } from "@/shared/api/http";
import NfcPage from "./NfcPage";
import { authService } from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/shared/store/auth.store";
vi.mock("@/modules/auth/services/auth.service", () => ({
  authService: { switchContext: vi.fn() },
}));

const access = vi.hoisted(() => ({ permissions: new Set<string>() }));
vi.mock("@/shared/components/permission", () => ({
  useCan: (code: string) => access.permissions.has(code),
  useCanAny: (codes: string[]) =>
    codes.some((code) => access.permissions.has(code)),
}));
vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const tag = {
  physical_code_id: "chip-1",
  hardware_uid: "04A1B2C3D4",
  code_value: "NFC-04A1B2C3D4",
  status: "ACTIVE",
  serial_number: "SN-001",
  sku_code: "SKU-01",
  sku_name: "Máy khoan pin",
  assigned_at: "2026-10-31T08:30:00+07:00",
};
const unassigned = {
  item_id: "item-2",
  serial_number: "SN-002",
  item_status: "IN_STOCK",
  sku: { sku_code: "SKU-01", sku_name: "Máy khoan pin" },
  nfc_status: "UNASSIGNED",
  nfc: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  access.permissions = new Set([
    "physical_code.assign_rfid",
    "inventory.view",
    "inventory.trace",
  ]);
  vi.mocked(http.get).mockResolvedValue(tag);
  vi.mocked(http.getPage).mockImplementation(async (url) => {
    if (url.endsWith("/events"))
      return {
        data: [
          {
            id: "event-1",
            action: "ASSIGN_ITEM_NFC",
            actor_name: "Người gán chip",
            reason: null,
            result: "SUCCESS",
            created_at: "2026-10-31T08:30:00+07:00",
          },
        ],
        meta: { total: 21 },
      };
    if (url === "/mini-app/nfc-tags")
      return { data: [tag], meta: { total: 41 } };
    return {
      data: [
        unassigned,
        {
          ...unassigned,
          item_id: "item-1",
          serial_number: "SN-001",
          nfc_status: "ASSIGNED",
          nfc: tag,
        },
      ],
      meta: {
        total: 41,
        tab_totals: { ALL: 41, ASSIGNED: 30, UNASSIGNED: 11 },
      },
    };
  });
});

describe("NFC web read-only", { timeout: 60000 }, () => {
  it("recovers a missing warehouse session only after explicit confirmation, then reloads NFC", async () => {
    useAuthStore.setState({ currentContext: null });
    vi.mocked(http.getPage).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          message: "Xác nhận lại kho làm việc.",
          error: { code: "WAREHOUSE_CONTEXT_REQUIRED" },
        },
      },
    });
    const warehouseId = "11111111-1111-4111-8111-111111111111";
    vi.mocked(http.get).mockResolvedValue({
      available_warehouses: [
        {
          warehouse_id: warehouseId,
          code: "HN01",
          name: "Kho Hoa Nam",
          status: "ACTIVE",
        },
      ],
    });
    vi.mocked(authService.switchContext).mockResolvedValue({
      access_token: "<confirmed-context>",
      token_type: "bearer",
      expires_in: 3600,
      active_context: {
        context_type: "WAREHOUSE",
        context_id: warehouseId,
        scope_ref: warehouseId,
      },
    });
    renderWithProviders(<NfcPage />);
    const confirm = await screen.findByRole("button", { name: "Xác nhận kho" });
    expect(confirm).toBeDisabled();
    expect(authService.switchContext).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Kho làm việc" }));
    fireEvent.click(
      await screen.findByRole("option", { name: "HN01 · Kho Hoa Nam" }),
    );
    fireEvent.click(confirm);
    expect(await screen.findByText("SN-002")).toBeVisible();
    expect(authService.switchContext).toHaveBeenCalledWith({
      context_type: "WAREHOUSE",
      context_id: warehouseId,
      scope_ref: warehouseId,
    });
    expect(useAuthStore.getState().currentContext?.context_id).toBe(
      warehouseId,
    );
  });
  it("all physical chip actions show the exact app notice without writing to the backend", async () => {
    renderWithProviders(<NfcPage />);
    await screen.findByText("SN-002");
    for (const label of ["Gán chip", "Quét chip NFC"]) {
      fireEvent.click(screen.getAllByRole("button", { name: label })[0]);
      await waitFor(() =>
        expect(screen.getByText("Vui lòng thao tác qua app")).toBeVisible(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Đã hiểu" }));
      await waitFor(() =>
        expect(
          screen.queryByText("Vui lòng thao tác qua app"),
        ).not.toBeInTheDocument(),
      );
    }
    fireEvent.click(screen.getByRole("button", { name: "Xem chip" }));
    await screen.findByText(/Người gán chip/);
    for (const label of ["Thu hồi chip", "Thay chip mới"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      await waitFor(() =>
        expect(screen.getByText("Vui lòng thao tác qua app")).toBeVisible(),
      );
      fireEvent.click(screen.getByRole("button", { name: "Đã hiểu" }));
      await waitFor(() =>
        expect(
          screen.queryByText("Vui lòng thao tác qua app"),
        ).not.toBeInTheDocument(),
      );
    }
    expect(http.post).not.toHaveBeenCalled();
    expect(http.patch).not.toHaveBeenCalled();
    expect(http.delete).not.toHaveBeenCalled();
  });

  it("keeps help hidden until the info icon is clicked", async () => {
    renderWithProviders(<NfcPage />);
    await screen.findByText("SN-002");
    expect(screen.queryByText(/Web dùng để xem/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thông tin NFC" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Web dùng để xem",
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Thông tin NFC" }), {
      key: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
    );
  });

  it("applies item keyword through the documented API and paginates on the server", async () => {
    renderWithProviders(<NfcPage />);
    await screen.findByText("SN-002");
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm hiện vật" }), {
      target: { value: "  SN-002  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() =>
      expect(http.getPage).toHaveBeenLastCalledWith(
        "/mini-app/items",
        expect.objectContaining({
          params: {
            keyword: "SN-002",
            item_status: "IN_STOCK",
            nfc_status: "ALL",
            page: 1,
            per_page: 20,
          },
        }),
      ),
    );
    fireEvent.click(await screen.findByRole("button", { name: /2/ }));
    await waitFor(() =>
      expect(http.getPage).toHaveBeenLastCalledWith(
        "/mini-app/items",
        expect.objectContaining({
          params: expect.objectContaining({ page: 2, keyword: "SN-002" }),
        }),
      ),
    );
  });

  it("loads registered chips, full UID search, details and paginated history from GET APIs", async () => {
    renderWithProviders(<NfcPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Chip đã đăng ký" }));
    await screen.findByText("04A1B2C3D4");
    fireEvent.change(screen.getByRole("textbox", { name: "UID chip" }), {
      target: { value: "  04a1b2c3d4 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() =>
      expect(http.getPage).toHaveBeenLastCalledWith(
        "/mini-app/nfc-tags",
        expect.objectContaining({
          params: expect.objectContaining({
            hardware_uid: "04A1B2C3D4",
            page: 1,
          }),
        }),
      ),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Xem chi tiết" }),
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/Người gán chip/);
    expect(http.get).toHaveBeenCalledWith(
      "/mini-app/nfc-tags/chip-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    fireEvent.click(await within(dialog).findByRole("button", { name: /2/ }));
    await waitFor(() =>
      expect(http.getPage).toHaveBeenLastCalledWith(
        "/mini-app/nfc-tags/chip-1/events",
        expect.objectContaining({ params: { page: 2, per_page: 10 } }),
      ),
    );
  });

  it("inventory readers only fetch items and cannot open chip details or assignment actions", async () => {
    access.permissions = new Set(["inventory.view"]);
    renderWithProviders(<NfcPage />);
    await screen.findByText("SN-002");
    expect(
      screen.queryByRole("tab", { name: "Chip đã đăng ký" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Gán chip" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Xem chip" }),
    ).not.toBeInTheDocument();
    expect(http.getPage).toHaveBeenCalledTimes(1);
  });

  it("trace-only readers start on chips and never request the forbidden item list", async () => {
    access.permissions = new Set(["inventory.trace"]);
    renderWithProviders(<NfcPage />);
    await screen.findByText("04A1B2C3D4");
    expect(
      screen.queryByRole("tab", { name: "Hiện vật" }),
    ).not.toBeInTheDocument();
    expect(http.getPage).toHaveBeenCalledTimes(1);
    expect(http.getPage).toHaveBeenCalledWith(
      "/mini-app/nfc-tags",
      expect.anything(),
    );
  });

  it("shows a failed request with retry instead of treating it as an empty list", async () => {
    vi.mocked(http.getPage).mockRejectedValueOnce(
      new Error("Không tải được NFC"),
    );
    renderWithProviders(<NfcPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không tải được NFC",
    );
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("SN-002")).toBeVisible();
  });
});
