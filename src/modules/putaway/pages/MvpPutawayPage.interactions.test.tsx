import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useAuthStore } from "@/shared/store/auth.store";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

vi.mock("@/modules/putaway/services/putawayService", async () => ({
  ...(await vi.importActual<
    typeof import("@/modules/putaway/services/putawayService")
  >("@/modules/putaway/services/putawayService")),
  fetchPutawayTasks: vi.fn(),
  fetchPutawayHistory: vi.fn(),
  fetchPutawayTrays: vi.fn(),
  createPutawayTask: vi.fn(),
  confirmPutawayTask: vi.fn(),
  cancelPutawayTask: vi.fn(),
}));
// The heatmap has its own coverage. Keep the real scan/selection state and dialogs.
vi.mock("@/shared/components/charts/LazyApexChart", () => ({
  LazyApexChart: () => null,
}));

import {
  fetchPutawayHistory,
  fetchPutawayTasks,
  fetchPutawayTrays,
  createPutawayTask,
  confirmPutawayTask,
  cancelPutawayTask,
  type PutawayTask,
  type PutawayEvent,
} from "@/modules/putaway/services/putawayService";
import MvpPutawayPage from "./MvpPutawayPage";

const pending: PutawayTask = {
  id: "pending-1",
  box_container_id: "container-1",
  box_code: "BOX-PENDING-001",
  sku_id: "sku-1",
  sku_code: "LK-001",
  sku_name: "Ốc vít",
  quantity: 25,
  receipt_code: "PN-2026-001",
  status: "RECEIVED_PENDING_PUTAWAY",
  container_version: 2,
};
const draft: PutawayTask = {
  ...pending,
  id: "pending-2",
  box_container_id: "container-2",
  box_code: "BOX-DRAFT-002",
  draft_id: "draft-8",
  draft_version: 3,
  to_tray_id: "tray-1",
  to_tray_code: "TRAY-A-01",
};
const stockNeutral: PutawayEvent = {
  id: "draft-8",
  box_container_id: "container-1",
  to_tray_id: "tray-1",
  status: "DRAFT",
  version: 1,
  stock_effect: "NONE",
  movement_created: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({
    isSuperAdmin: false,
    permissionCodes: [P.PUTAWAY_VIEW, P.PUTAWAY_MANAGE],
  });
  vi.mocked(fetchPutawayTasks).mockResolvedValue([pending, draft]);
  vi.mocked(fetchPutawayHistory).mockResolvedValue([]);
  vi.mocked(fetchPutawayTrays).mockResolvedValue([
    {
      container_id: "tray-1",
      container_code: "TRAY-A-01",
      status: "EMPTY",
      version: 1,
    },
  ]);
  vi.mocked(createPutawayTask).mockResolvedValue(stockNeutral);
  vi.mocked(confirmPutawayTask).mockResolvedValue({
    ...stockNeutral,
    status: "CONFIRMED",
  });
  vi.mocked(cancelPutawayTask).mockResolvedValue({
    ...stockNeutral,
    status: "CANCELLED",
  });
});
afterEach(cleanupTestState);

describe("PTW-00 page workflows", () => {
  it("opens real BOX detail and creates a stock-neutral draft from a validated tray scan", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MvpPutawayPage />, ["/putaway?screen=PTW-00"]);
    await user.click(
      await screen.findByRole("button", { name: pending.box_code }),
    );
    const detail = await screen.findByRole("dialog");
    expect(
      within(detail).getByText("Chi tiết xếp khay · BOX-PENDING-001"),
    ).toBeInTheDocument();
    expect(within(detail).getByText("PN-2026-001")).toBeInTheDocument();
    await user.click(
      within(detail).getAllByRole("button", { name: "Đóng" }).at(-1)!,
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Tạo lệnh" }));
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", {
      name: "Tạo lệnh xếp khay",
    });
    expect(submit).toBeDisabled();
    const scan = within(dialog).getByPlaceholderText(
      "Quét/nhập mã khay, VD: TRAY-A-01",
    );
    await user.type(scan, "tray-a-01{Enter}");
    expect(submit).toBeEnabled();
    await user.type(
      within(dialog).getByRole("textbox", { name: "Vị trí gợi ý" }),
      "  Kệ A-3  ",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: "Ghi chú" }),
      "  Đặt cùng linh kiện  ",
    );
    await user.click(submit);
    await waitFor(() =>
      expect(createPutawayTask).toHaveBeenCalledWith(
        {
          box_container_id: "container-1",
          to_tray_id: "tray-1",
          location_hint: "Kệ A-3",
          note: "Đặt cùng linh kiện",
        },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(confirmPutawayTask).not.toHaveBeenCalled();
    expect(cancelPutawayTask).not.toHaveBeenCalled();
    expect(
      vi.mocked(fetchPutawayTasks).mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("keeps confirm failures retryable and preserves draft id/version for confirm and cancel", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmPutawayTask).mockRejectedValueOnce(
      new Error("Kết nối tạm thời bị gián đoạn"),
    );
    renderWithProviders(<MvpPutawayPage />);
    await screen.findByRole("button", { name: pending.box_code });
    expect(
      screen.queryByRole("button", { name: draft.box_code }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lệnh xếp khay" }));
    expect(
      screen.queryByRole("button", { name: pending.box_code }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: `Thao tác ${draft.box_code}` }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Xác nhận xếp khay" }),
    );
    let dialog = await screen.findByRole("dialog");
    expect(confirmPutawayTask).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận" }));
    await waitFor(() =>
      expect(confirmPutawayTask).toHaveBeenCalledWith("draft-8", 3),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Xác nhận" }),
      ).toBeEnabled(),
    );
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(confirmPutawayTask).toHaveBeenCalledTimes(2);
    await user.click(
      screen.getByRole("button", { name: `Thao tác ${draft.box_code}` }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Hủy lệnh nháp" }));
    dialog = await screen.findByRole("dialog");
    expect(cancelPutawayTask).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Hủy lệnh" }));
    await waitFor(() =>
      expect(cancelPutawayTask).toHaveBeenCalledWith("draft-8", 3),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("recovers the task list through its retry button and applies the user's search to the API", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPutawayTasks).mockRejectedValueOnce(
      new Error("Danh sách tạm thời không khả dụng"),
    );
    renderWithProviders(<MvpPutawayPage />);
    await user.click(await screen.findByRole("button", { name: "Thử lại" }));
    await screen.findByRole("button", { name: pending.box_code });
    expect(
      vi.mocked(fetchPutawayTasks).mock.calls.length,
    ).toBeGreaterThanOrEqual(2);
    await user.type(
      screen.getByRole("searchbox", { name: "Tìm kiếm" }),
      "  BOX-PENDING  ",
    );
    await user.click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() =>
      expect(fetchPutawayTasks).toHaveBeenLastCalledWith({
        search: "BOX-PENDING",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Đặt lại" }));
    await waitFor(() => expect(fetchPutawayTasks).toHaveBeenLastCalledWith({}));
  });
  it("resets receipt, status and selection when switching from pending BOX to draft orders", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPutawayTasks).mockResolvedValue([
      { ...pending, receipt_code: "PN-A" },
      { ...draft, receipt_code: "PN-B" },
    ]);
    renderWithProviders(<MvpPutawayPage />);
    await screen.findByRole("button", { name: pending.box_code });
    await user.click(
      screen.getByRole("combobox", { name: "Phiếu nhập nguồn" }),
    );
    await user.click(screen.getByRole("option", { name: "PN-A" }));
    await user.click(screen.getByRole("combobox", { name: "Trạng thái BOX" }));
    await user.click(screen.getByRole("option", { name: "Tất cả" }));
    await user.click(screen.getByRole("button", { name: "Áp dụng" }));
    await user.click(
      screen.getByRole("checkbox", { name: `Chọn BOX ${pending.box_code}` }),
    );
    expect(screen.getByText("Đã chọn 1 BOX")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lệnh xếp khay" }));
    expect(
      screen.getByRole("button", { name: draft.box_code }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Phiếu nhập nguồn" }),
    ).toHaveTextContent("Tất cả");
    expect(
      screen.getByRole("combobox", { name: "Trạng thái BOX" }),
    ).toHaveTextContent("Chờ xếp khay");
    expect(screen.queryByText("Đã chọn 1 BOX")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("combobox", { name: "Phiếu nhập nguồn" }),
    );
    expect(screen.getByRole("option", { name: "PN-B" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "PN-A" }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Hàng chờ" }));
    expect(
      screen.getByRole("checkbox", { name: `Chọn BOX ${pending.box_code}` }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("combobox", { name: "Phiếu nhập nguồn" }),
    ).toHaveTextContent("Tất cả");
  });
});
