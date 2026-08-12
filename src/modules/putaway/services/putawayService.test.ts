import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
  },
}));
vi.mock("@/shared/api/wms-action-permission", () => ({
  assertWmsActionPermission: vi.fn(),
}));

import { http } from "@/shared/api/http";
import {
  cancelPutawayTask,
  confirmPutawayTask,
  createPutawayTask,
  fetchPutawayHistory,
  fetchPutawayTrays,
  resolvePutawayTrayByScanCode,
  type TrayOption,
} from "./putawayService";

const trays: TrayOption[] = [
  {
    container_id: "TRAY-ID-1",
    container_code: "TRAY-A-01",
    container_type: "TRAY",
    status: "EMPTY",
    zone_code: "A",
    version: 1,
  },
  {
    container_id: "TRAY-ID-CLOSED",
    container_code: "TRAY-CLOSED",
    container_type: "TRAY",
    status: "CLOSED",
    version: 1,
  },
];

describe("putaway real API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a stock-neutral Putaway DRAFT through /putaway/tasks", async () => {
    vi.mocked(http.post).mockResolvedValue({
      id: "PTW-1",
      box_container_id: "BOX-1",
      to_tray_id: "TRAY-1",
      status: "DRAFT",
      version: 1,
      stock_effect: "NONE",
      movement_created: false,
    });

    const result = await createPutawayTask({
      box_container_id: "BOX-1",
      to_tray_id: "TRAY-1",
    });

    expect(http.post).toHaveBeenCalledWith("/putaway/tasks", {
      box_container_id: "BOX-1",
      to_tray_id: "TRAY-1",
    });
    expect(result).toMatchObject({ status: "DRAFT", stock_effect: "NONE" });
  });

  it("resolves manual/camera scan to exactly one usable TRAY", () => {
    expect(resolvePutawayTrayByScanCode(trays, " tray-a-01 ")).toMatchObject({
      container_id: "TRAY-ID-1",
      status: "EMPTY",
    });
    expect(() => resolvePutawayTrayByScanCode(trays, "TRAY-CLOSED")).toThrowError(
      /Không tìm thấy TRAY khả dụng/,
    );
    expect(() => resolvePutawayTrayByScanCode(trays, "TRAY-UNKNOWN")).toThrowError(
      /Không tìm thấy TRAY khả dụng/,
    );
  });

  it("fails closed when a scan code is ambiguous", () => {
    expect(() =>
      resolvePutawayTrayByScanCode(
        [
          ...trays,
          {
            container_id: "TRAY-ID-2",
            container_code: "TRAY-A-01",
            container_type: "TRAY",
            status: "PARTIAL",
            version: 1,
          },
        ],
        "TRAY-A-01",
      ),
    ).toThrowError(/khớp nhiều TRAY/);
  });

  it("filters terminal TRAY states returned by the API", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: trays,
      meta: {},
    });

    const result = await fetchPutawayTrays();

    expect(result.map((row) => row.container_code)).toEqual(["TRAY-A-01"]);
  });

  it("confirms Putaway with If-Match and rejects any stock effect", async () => {
    vi.mocked(http.post).mockResolvedValue({
      id: "PTW-1",
      box_container_id: "BOX-1",
      to_tray_id: "TRAY-1",
      status: "CONFIRMED",
      version: 2,
      stock_effect: "NONE",
      movement_created: false,
    });

    await confirmPutawayTask("PTW-1", 1);

    expect(http.post).toHaveBeenCalledWith(
      "/putaway/tasks/PTW-1/confirm",
      undefined,
      { headers: { "If-Match": "1" } },
    );

    vi.mocked(http.post).mockResolvedValueOnce({
      id: "PTW-2",
      box_container_id: "BOX-2",
      to_tray_id: "TRAY-2",
      status: "CONFIRMED",
      version: 2,
      stock_effect: "INCREASE",
      movement_created: true,
    });

    await expect(confirmPutawayTask("PTW-2", 1)).rejects.toMatchObject({
      code: "WMS_FE_PUTAWAY_STOCK_EFFECT_VIOLATION",
    });
  });

  it("cancels a DRAFT with If-Match and remains stock-neutral", async () => {
    vi.mocked(http.post).mockResolvedValue({
      id: "PTW-1",
      box_container_id: "BOX-1",
      to_tray_id: "TRAY-1",
      status: "CANCELLED",
      version: 2,
      stock_effect: "NONE",
      movement_created: false,
    });

    const result = await cancelPutawayTask("PTW-1", 1);

    expect(http.post).toHaveBeenCalledWith(
      "/putaway/tasks/PTW-1/cancel",
      undefined,
      { headers: { "If-Match": "1" } },
    );
    expect(result.status).toBe("CANCELLED");
  });

  it("fails closed if Putaway history reports a movement", async () => {
    vi.mocked(http.get).mockResolvedValue([
      {
        id: "H-1",
        box_code: "BOX-1",
        created_at: "2026-08-12T00:00:00Z",
        stock_effect: "INCREASE",
        movement_created: true,
      },
    ]);

    await expect(fetchPutawayHistory()).rejects.toMatchObject({
      code: "WMS_FE_PUTAWAY_STOCK_EFFECT_VIOLATION",
    });
  });
});