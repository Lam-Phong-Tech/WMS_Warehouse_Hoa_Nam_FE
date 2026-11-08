/**
 * Hồi quy hiệu năng: gõ vào ô nhập của form xếp khay (state nằm ở page) không
 * được phép kích hoạt `ApexCharts.updateOptions()`.
 *
 * Vì sao cần test ở mức PAGE chứ không chỉ ở `TraySelectionGrid`: bug gốc nằm ở
 * chuỗi page → grid → chart. Page giữ state form và từng truyền `onSelect`
 * inline; mỗi phím gõ tạo closure mới → `chartOptions` mất memo → ApexCharts
 * dựng lại toàn bộ SVG (đo thật: ~25ms/lần cho lưới 4×4). Test này dùng engine
 * giả để đếm đúng số lần `updateOptions` — không đo thời gian, nên không flaky.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useAuthStore } from "@/shared/store/auth.store";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

const engine = vi.hoisted(() => ({
  renders: 0,
  updates: 0,
  destroys: 0,
}));

vi.mock("apexcharts/client", () => ({
  default: class {
    render() {
      engine.renders += 1;
      return Promise.resolve();
    }
    updateOptions() {
      engine.updates += 1;
      return Promise.resolve();
    }
    destroy() {
      engine.destroys += 1;
    }
  },
}));

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

import {
  fetchPutawayHistory,
  fetchPutawayTasks,
  fetchPutawayTrays,
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

beforeEach(() => {
  vi.resetAllMocks();
  engine.renders = 0;
  engine.updates = 0;
  engine.destroys = 0;
  useAuthStore.setState({
    isSuperAdmin: false,
    permissionCodes: [P.PUTAWAY_VIEW, P.PUTAWAY_MANAGE],
  });
  vi.mocked(fetchPutawayTasks).mockResolvedValue([pending]);
  vi.mocked(fetchPutawayHistory).mockResolvedValue([]);
  vi.mocked(fetchPutawayTrays).mockResolvedValue([
    {
      container_id: "tray-1",
      container_code: "TRAY-A-01",
      status: "EMPTY",
      zone_code: "ZONE-A",
      location_hint: null,
      version: 1,
    },
    {
      container_id: "tray-2",
      container_code: "TRAY-A-02",
      status: "EMPTY",
      zone_code: "ZONE-A",
      location_hint: null,
      version: 1,
    },
  ]);
});
afterEach(cleanupTestState);

describe("PTW-01 form typing", () => {
  it("gõ vào ô Ghi chú không dựng lại lưới khay", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MvpPutawayPage />, ["/putaway?screen=PTW-00"]);
    await screen.findByRole("button", { name: pending.box_code });
    await user.click(screen.getByRole("button", { name: "Tạo lệnh" }));
    const dialog = await screen.findByRole("dialog");

    await waitFor(() => expect(engine.renders).toBeGreaterThanOrEqual(1));
    expect(engine.updates).toBe(0);

    const note = await within(dialog).findByRole("textbox", {
      name: "Ghi chú",
    });
    await user.type(note, "abcd");

    expect(note).toHaveValue("abcd");
    expect(engine.updates).toBe(0);
    expect(engine.destroys).toBe(0);
  });
});
