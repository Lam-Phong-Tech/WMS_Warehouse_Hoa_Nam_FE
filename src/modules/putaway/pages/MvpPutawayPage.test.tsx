import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/putaway/services/putawayService", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/putaway/services/putawayService")
  >("@/modules/putaway/services/putawayService");
  return {
    ...actual,
    fetchPutawayTasks: vi.fn(),
    fetchPutawayHistory: vi.fn(),
    fetchPutawayTrays: vi.fn(),
  };
});
vi.mock("@/shared/api/http", () => ({
  http: { get: vi.fn(), getPage: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import {
  fetchPutawayHistory,
  fetchPutawayTasks,
  fetchPutawayTrays,
  confirmPutawayTask,
} from "@/modules/putaway/services/putawayService";
import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import {
  hasAnyWmsPermission,
  WMS_ACTION_PERMISSIONS,
  WMS_PERMISSION_CATALOG as P,
  canonicalizeWmsPermission,
} from "@/shared/constants/wms-permissions";
import MvpPutawayPage from "./MvpPutawayPage";

const TASK = {
  id: "PTW-1",
  box_container_id: "BOX-1",
  box_code: "BOX-COMP-0012",
  sku_id: "SKU-COMP",
  sku_code: "LK-DCH-OC-VIT-M2-V1",
  sku_name: "Ốc vít M2",
  quantity: 100,
  status: "RECEIVED_PENDING_PUTAWAY" as const,
  location_hint: "Khu linh kiện",
  container_version: 1,
};

function grant(permissionCodes: string[]) {
  useAuthStore.setState({ isSuperAdmin: false, permissionCodes });
}

/**
 * SRS §3: "Putaway task list/create/confirm/cancel" -> permission key
 * `putaway.manage`, NV kho = A*. Trước đây FE gate theo `container.manage` và còn
 * có alias coi `putaway.manage` là bí danh của `container.manage`, nên nhân viên
 * kho được cấp đúng quyền theo SRS vẫn bị chặn ở cả UI và service layer.
 */
describe("PTW-00/PTW-01 · quyền Putaway theo SRS §3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchPutawayTasks).mockResolvedValue([TASK] as never);
    vi.mocked(fetchPutawayHistory).mockResolvedValue([] as never);
    vi.mocked(fetchPutawayTrays).mockResolvedValue([] as never);
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("putaway.manage KHÔNG được coi là bí danh của container.manage", () => {
    // Gộp hai quyền là leo quyền phía UI: container.manage là CRUD container.
    expect(canonicalizeWmsPermission(P.PUTAWAY_MANAGE)).toBe("putaway.manage");
    expect(canonicalizeWmsPermission(P.PUTAWAY_MANAGE)).not.toBe(
      P.CONTAINER_MANAGE,
    );
  });

  it("hành động Putaway nhận cả putaway.manage và container.manage (khớp route BE)", () => {
    expect(
      hasAnyWmsPermission(
        [P.PUTAWAY_MANAGE],
        WMS_ACTION_PERMISSIONS.PUTAWAY_CONTAINER,
      ),
    ).toBe(true);
    expect(
      hasAnyWmsPermission(
        [P.CONTAINER_MANAGE],
        WMS_ACTION_PERMISSIONS.PUTAWAY_CONTAINER,
      ),
    ).toBe(true);
    // Chỉ có quyền xem thì không được thao tác.
    expect(
      hasAnyWmsPermission(
        [P.PUTAWAY_VIEW, P.CONTAINER_VIEW],
        WMS_ACTION_PERMISSIONS.PUTAWAY_CONTAINER,
      ),
    ).toBe(false);
  });

  it("service layer cho Confirm Putaway đi qua khi chỉ có putaway.manage", async () => {
    grant([P.PUTAWAY_VIEW, P.PUTAWAY_MANAGE]);
    vi.mocked(http.post).mockResolvedValue({
      id: "PTW-1",
      status: "CONFIRMED",
      version: 2,
      stock_effect: "NONE",
      movement_created: false,
    } as never);

    await expect(confirmPutawayTask("PTW-1", 1)).resolves.toMatchObject({
      status: "CONFIRMED",
    });
    // Annex C confirmPutawayTask: path canonical /putaway-tasks + If-Match; kèm
    // Idempotency-Key suy diễn của DEC-PTW-RETRY-001 (tuỳ chọn theo Annex C, bắt buộc theo
    // hợp đồng phục hồi sau mất response của WWHN-193).
    expect(http.post).toHaveBeenCalledWith(
      "/putaway-tasks/PTW-1/confirm",
      undefined,
      {
        headers: {
          "If-Match": "1",
          "Idempotency-Key": "ptw-confirm-PTW-1-v1",
        },
      },
    );
  });

  it("service layer chặn Confirm Putaway khi chỉ có quyền xem", async () => {
    grant([P.PUTAWAY_VIEW, P.CONTAINER_VIEW]);

    await expect(confirmPutawayTask("PTW-1", 1)).rejects.toMatchObject({
      code: "WMS_FE_PERMISSION_REQUIRED",
    });
    expect(http.post).not.toHaveBeenCalled();
  });

  it("màn PTW-00 render danh sách box chờ xếp khay cho người chỉ có putaway.manage", async () => {
    grant([P.PUTAWAY_VIEW, P.PUTAWAY_MANAGE]);

    renderWithProviders(<MvpPutawayPage />);

    await waitFor(() => {
      expect(screen.getByText("BOX-COMP-0012")).toBeInTheDocument();
    });
    expect(screen.getByText("LK-DCH-OC-VIT-M2-V1")).toBeInTheDocument();
  });
});
