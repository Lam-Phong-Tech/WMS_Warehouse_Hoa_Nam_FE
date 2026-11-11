import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
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
  type PutawayEvent,
  type PutawayHistory,
  type PutawayTask,
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
const pendingTwo: PutawayTask = {
  ...pending,
  id: "pending-3",
  box_container_id: "container-3",
  box_code: "BOX-PENDING-003",
  sku_id: "sku-3",
  sku_code: "LK-003",
  sku_name: "Long đền",
  quantity: 15,
  receipt_code: "PN-2026-003",
};
const draftTwo: PutawayTask = {
  ...draft,
  id: "pending-4",
  box_container_id: "container-4",
  box_code: "BOX-DRAFT-003",
  draft_id: "draft-9",
  draft_version: 2,
  to_tray_code: "TRAY-B-02",
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

const historyRow: PutawayHistory = {
  id: "history-1",
  box_container_id: "container-9",
  box_code: "BOX-HIST-001",
  box_status: "STORED",
  sku_id: "sku-9",
  sku_code: "COMP-HIST-001",
  sku_name: "Linh kiện lịch sử",
  unit: "cai",
  quantity: 12,
  receipt_code: "PN-HIST-001",
  old_tray_code: null,
  new_tray_code: "TRAY-HIST-01",
  actor_name: "Quản trị viên",
  created_at: "2026-11-11T09:06:00Z",
  location_hint: "Kệ A-01",
  note: "Ghi chú lịch sử",
  stock_effect: "NONE",
  movement_created: false,
};

let liveClient: QueryClient;
function CaptureQueryClient() {
  const client = useQueryClient();
  useEffect(() => {
    liveClient = client;
  }, [client]);
  return null;
}

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
  it("closes the read drawer when a stored BOX leaves the pending results without reopening it later", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <CaptureQueryClient />
        <MvpPutawayPage />
      </>,
      ["/putaway?screen=PTW-00"],
    );
    await user.click(
      await screen.findByRole("button", { name: pending.box_code }),
    );
    await screen.findByRole("dialog");
    await act(async () => {
      liveClient.setQueryData(["putaway", "tasks", ""], []);
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await act(async () => {
      liveClient.setQueryData(["putaway", "tasks", ""], [pending, draft]);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("refreshes the read drawer without rehydrating an open putaway draft", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <CaptureQueryClient />
        <MvpPutawayPage />
      </>,
      ["/putaway?screen=PTW-00"],
    );
    await user.click(
      await screen.findByRole("button", { name: pending.box_code }),
    );
    let dialog = await screen.findByRole("dialog");
    await act(async () => {
      liveClient.setQueryData(
        ["putaway", "tasks", ""],
        [{ ...pending, location_hint: "Live read location" }, draft],
      );
    });
    expect(
      await within(dialog).findByText("Live read location"),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getAllByRole("button", { name: "Đóng" }).at(-1)!,
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Tạo lệnh" }));
    dialog = await screen.findByRole("dialog");
    const note = await within(dialog).findByRole("textbox", {
      name: "Ghi chú",
    });
    await user.type(note, "Unsaved note");
    await act(async () => {
      liveClient.setQueryData(
        ["putaway", "tasks", ""],
        [
          {
            ...pending,
            location_hint: "Other operator location",
            container_version: 7,
          },
          draft,
        ],
      );
    });
    expect(note).toHaveValue("Unsaved note");
    expect(
      within(dialog).getByRole("textbox", { name: "Vị trí gợi ý" }),
    ).toHaveValue("Live read location");
  });
  it("shows the page title without its descriptive subtitle", () => {
    renderWithProviders(<MvpPutawayPage />, ["/putaway?screen=PTW-00"]);
    expect(
      screen.getByRole("heading", { level: 1, name: "Linh kiện chờ xếp khay" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Theo dõi BOX đã nhập kho và tạo lệnh xếp khay"),
    ).not.toBeInTheDocument();
  });

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

  it("packs multiple selected BOX into one tray and creates one draft per BOX", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPutawayTasks).mockResolvedValue([
      pending,
      pendingTwo,
      draft,
    ]);
    renderWithProviders(<MvpPutawayPage />, ["/putaway?screen=PTW-00"]);
    await screen.findByRole("button", { name: pending.box_code });
    await user.click(
      screen.getByRole("checkbox", { name: `Chọn BOX ${pending.box_code}` }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: `Chọn BOX ${pendingTwo.box_code}` }),
    );
    await user.click(
      screen.getByRole("button", { name: "Xếp nhiều hộp vào 1 khay" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", {
        level: 2,
        name: "Xếp Hộp 1, Hộp 2 vào khay",
      }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Hộp 1")).toBeInTheDocument();
    expect(within(dialog).getByText("Hộp 2")).toBeInTheDocument();
    expect(within(dialog).getByText("Khay đích")).toBeInTheDocument();
    expect(within(dialog).getByText("Chưa chọn")).toBeInTheDocument();

    const scan = within(dialog).getByPlaceholderText(
      "Quét/nhập mã khay, VD: TRAY-A-01",
    );
    await user.type(scan, "tray-a-01{Enter}");
    await user.click(
      within(dialog).getByRole("button", { name: "Tạo lệnh xếp khay" }),
    );

    await waitFor(() => expect(createPutawayTask).toHaveBeenCalledTimes(2));
    expect(createPutawayTask).toHaveBeenNthCalledWith(
      1,
      {
        box_container_id: "container-1",
        to_tray_id: "tray-1",
        location_hint: null,
        note: null,
      },
      expect.anything(),
    );
    expect(createPutawayTask).toHaveBeenNthCalledWith(
      2,
      {
        box_container_id: "container-3",
        to_tray_id: "tray-1",
        location_hint: null,
        note: null,
      },
      expect.anything(),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("retries only the BOX that failed without resubmitting one already created", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPutawayTasks).mockResolvedValue([pending, pendingTwo]);
    vi.mocked(createPutawayTask)
      .mockResolvedValueOnce(stockNeutral)
      .mockRejectedValueOnce(new Error("Kết nối tạm thời bị gián đoạn"));
    renderWithProviders(<MvpPutawayPage />, ["/putaway?screen=PTW-00"]);
    await screen.findByRole("button", { name: pending.box_code });
    await user.click(
      screen.getByRole("checkbox", { name: `Chọn BOX ${pending.box_code}` }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: `Chọn BOX ${pendingTwo.box_code}` }),
    );
    await user.click(
      screen.getByRole("button", { name: "Xếp nhiều hộp vào 1 khay" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText("Quét/nhập mã khay, VD: TRAY-A-01"),
      "tray-a-01{Enter}",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Tạo lệnh xếp khay" }),
    );

    await waitFor(() => expect(createPutawayTask).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(within(dialog).getByText(pendingTwo.box_code)).toBeInTheDocument(),
    );
    expect(
      within(dialog).queryByText(pending.box_code),
    ).not.toBeInTheDocument();

    vi.mocked(createPutawayTask).mockResolvedValue(stockNeutral);
    await user.click(
      within(dialog).getByRole("button", { name: "Tạo lệnh xếp khay" }),
    );
    await waitFor(() => expect(createPutawayTask).toHaveBeenCalledTimes(3));
    const calls = vi.mocked(createPutawayTask).mock.calls;
    expect(
      calls.filter(([payload]) => payload.box_container_id === "container-1"),
    ).toHaveLength(1);
    expect(
      calls.filter(([payload]) => payload.box_container_id === "container-3"),
    ).toHaveLength(2);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("confirms and cancels multiple draft orders with bulk actions", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPutawayTasks).mockResolvedValue([draft, draftTwo]);
    renderWithProviders(<MvpPutawayPage />, ["/putaway?screen=PTW-00"]);
    await screen.findByRole("button", { name: "Lệnh xếp khay" });
    await user.click(screen.getByRole("button", { name: "Lệnh xếp khay" }));
    await screen.findByRole("button", { name: draft.box_code });
    await user.click(
      screen.getByRole("checkbox", { name: `Chọn BOX ${draft.box_code}` }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: `Chọn BOX ${draftTwo.box_code}` }),
    );

    await user.click(screen.getByRole("button", { name: "Xác nhận xếp khay" }));
    let dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Xác nhận xếp khay cho 2 BOX?"),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận" }));
    await waitFor(() => expect(confirmPutawayTask).toHaveBeenCalledTimes(2));
    expect(confirmPutawayTask).toHaveBeenNthCalledWith(1, "draft-8", 3);
    expect(confirmPutawayTask).toHaveBeenNthCalledWith(2, "draft-9", 2);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Hủy lệnh nháp" }));
    dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Hủy 2 lệnh xếp khay nháp?"),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Hủy lệnh" }));
    await waitFor(() => expect(cancelPutawayTask).toHaveBeenCalledTimes(2));
    expect(cancelPutawayTask).toHaveBeenNthCalledWith(1, "draft-8", 3);
    expect(cancelPutawayTask).toHaveBeenNthCalledWith(2, "draft-9", 2);
  });

  it("continues bulk confirm when one draft fails and reports the rest", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPutawayTasks).mockResolvedValue([draft, draftTwo]);
    vi.mocked(confirmPutawayTask)
      .mockResolvedValueOnce({ ...stockNeutral, status: "CONFIRMED" })
      .mockRejectedValueOnce(new Error("Kết nối tạm thời bị gián đoạn"));
    renderWithProviders(<MvpPutawayPage />, ["/putaway?screen=PTW-00"]);
    await screen.findByRole("button", { name: "Lệnh xếp khay" });
    await user.click(screen.getByRole("button", { name: "Lệnh xếp khay" }));
    await screen.findByRole("button", { name: draft.box_code });
    await user.click(
      screen.getByRole("checkbox", { name: `Chọn BOX ${draft.box_code}` }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: `Chọn BOX ${draftTwo.box_code}` }),
    );
    await user.click(screen.getByRole("button", { name: "Xác nhận xếp khay" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(confirmPutawayTask).toHaveBeenCalledTimes(2));
    expect(confirmPutawayTask).toHaveBeenNthCalledWith(2, "draft-9", 2);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
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

  it("recovers the task list through its retry button and searches the API as the user types", async () => {
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
    const search = screen.getByRole("searchbox", { name: "Tìm kiếm" });
    await user.type(search, "  BOX-PENDING  ");
    await waitFor(() =>
      expect(fetchPutawayTasks).toHaveBeenLastCalledWith({
        search: "BOX-PENDING",
      }),
    );
    await user.clear(search);
    await waitFor(() => expect(fetchPutawayTasks).toHaveBeenLastCalledWith({}));
  });
  it("resets receipt and selection when switching from pending BOX to draft orders", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPutawayTasks).mockResolvedValue([
      { ...pending, receipt_code: "PN-A" },
      { ...draft, receipt_code: "PN-B" },
    ]);
    renderWithProviders(<MvpPutawayPage />);
    await screen.findByRole("button", { name: pending.box_code });
    expect(
      screen.queryByRole("combobox", { name: "Trạng thái BOX" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("combobox", { name: "Phiếu nhập nguồn" }),
    );
    await user.click(screen.getByRole("option", { name: "PN-A" }));
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
      screen.queryByRole("combobox", { name: "Trạng thái BOX" }),
    ).not.toBeInTheDocument();
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

  it("opens a read-only history drawer from the detail arrow and hides the old tray column", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPutawayHistory).mockResolvedValue([historyRow]);
    renderWithProviders(<MvpPutawayPage />, ["/putaway?screen=PTW-00"]);

    await user.click(screen.getByRole("button", { name: "Lịch sử" }));
    expect(
      screen.queryByRole("columnheader", { name: "Khay cũ" }),
    ).not.toBeInTheDocument();

    const arrow = await screen.findByRole("button", {
      name: "Xem chi tiết xếp khay BOX-HIST-001",
    });
    await user.click(arrow);

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("BOX-HIST-001")).toBeInTheDocument();
    expect(within(drawer).getByText("TRAY-HIST-01")).toBeInTheDocument();
    expect(within(drawer).getByText("Kệ A-01")).toBeInTheDocument();
    expect(within(drawer).getByText("Quản trị viên")).toBeInTheDocument();
    expect(within(drawer).getByText("PN-HIST-001")).toBeInTheDocument();
    expect(within(drawer).getByText("COMP-HIST-001")).toBeInTheDocument();
    expect(within(drawer).getByText("Linh kiện lịch sử")).toBeInTheDocument();
    expect(within(drawer).getByText("12")).toBeInTheDocument();
    expect(within(drawer).getByText("Ghi chú lịch sử")).toBeInTheDocument();

    await user.click(within(drawer).getByRole("button", { name: "Đóng" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("changes the page title to match the active putaway tab", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MvpPutawayPage />, ["/putaway?screen=PTW-00"]);
    expect(
      screen.getByRole("heading", { level: 1, name: "Linh kiện chờ xếp khay" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lệnh xếp khay" }));
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Danh sách lệnh xếp khay",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Lịch sử" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Lịch sử xếp khay" }),
    ).toBeInTheDocument();
  });
});
