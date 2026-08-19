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
  putawayIdempotencyKey,
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

  it("creates a stock-neutral Putaway DRAFT through Annex C /putaway-tasks", async () => {
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

    expect(http.post).toHaveBeenCalledWith("/putaway-tasks", {
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
    expect(() =>
      resolvePutawayTrayByScanCode(trays, "TRAY-CLOSED"),
    ).toThrowError(/Không tìm thấy TRAY khả dụng/);
    expect(() =>
      resolvePutawayTrayByScanCode(trays, "TRAY-UNKNOWN"),
    ).toThrowError(/Không tìm thấy TRAY khả dụng/);
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

    // DEC-PTW-RETRY-001: khoá idempotency suy diễn từ (operation, id, version) để lần gửi
    // lại sau khi mất response được BE replay thay vì trả 409.
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
      "/putaway-tasks/PTW-1/cancel",
      undefined,
      {
        headers: {
          "If-Match": "1",
          "Idempotency-Key": "ptw-cancel-PTW-1-v1",
        },
      },
    );
    expect(result.status).toBe("CANCELLED");
  });

  // ── WWHN-193 · DEV193-P1-03R · DEC-PTW-RETRY-001 ───────────────────────────

  it("phục hồi 409 STATE_CONFLICT khi chính mình đã xác nhận xong trước đó", async () => {
    vi.mocked(http.post).mockRejectedValue({
      data: {
        success: false,
        message: "Tác vụ putaway này đã được xác nhận trước đó",
        error: {
          code: "STATE_CONFLICT",
          details: {
            putaway_event_id: "PTW-9",
            box_container_id: "BOX-9",
            to_tray_id: "TRAY-9",
            current_status: "CONFIRMED",
            current_version: 2,
            expected_version: 1,
            recovery: {
              contract: "DEC-PTW-RETRY-001",
              outcome: "ALREADY_APPLIED_BY_CALLER",
              applied_by_caller: true,
              safe_to_treat_as_success: true,
              next_action: "RELOAD_AND_CONTINUE",
            },
          },
        },
      },
    });

    const result = await confirmPutawayTask("PTW-9", 1);

    expect(result.status).toBe("CONFIRMED");
    expect(result.version).toBe(2);
    expect(result.stock_effect).toBe("NONE");
    expect(result.movement_created).toBe(false);
    expect(result.recovery?.outcome).toBe("ALREADY_APPLIED_BY_CALLER");
  });

  it("phục hồi cả khi người khác đã xác nhận đúng tác vụ đó (AxiosError shape)", async () => {
    vi.mocked(http.post).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          success: false,
          error_code: "STATE_CONFLICT",
          errors: {
            current_status: "CONFIRMED",
            current_version: 2,
            recovery: {
              contract: "DEC-PTW-RETRY-001",
              outcome: "ALREADY_APPLIED_BY_OTHER",
              applied_by_caller: false,
              safe_to_treat_as_success: true,
              next_action: "RELOAD_AND_CONTINUE",
            },
          },
        },
      },
    });

    const result = await confirmPutawayTask("PTW-10", 1);

    expect(result.recovery?.outcome).toBe("ALREADY_APPLIED_BY_OTHER");
    expect(result.recovery?.applied_by_caller).toBe(false);
  });

  it("KHÔNG nuốt 409 khi tác vụ đã kết thúc ở trạng thái khác", async () => {
    const conflict = {
      data: {
        success: false,
        error: {
          code: "STATE_CONFLICT",
          details: {
            current_status: "CONFIRMED",
            current_version: 2,
            recovery: {
              contract: "DEC-PTW-RETRY-001",
              outcome: "FINALIZED_DIFFERENT_OUTCOME",
              applied_by_caller: false,
              safe_to_treat_as_success: false,
              next_action: "RELOAD_AND_REVIEW",
            },
          },
        },
      },
    };
    vi.mocked(http.post).mockRejectedValue(conflict);

    await expect(cancelPutawayTask("PTW-11", 1)).rejects.toBe(conflict);
  });

  it("KHÔNG nuốt các lỗi khác 409 recovery (403/412/500 vẫn nổi lên)", async () => {
    const denied = {
      data: { success: false, error: { code: "ACCESS_DENIED", details: {} } },
    };
    vi.mocked(http.post).mockRejectedValue(denied);

    await expect(confirmPutawayTask("PTW-12", 1)).rejects.toBe(denied);

    const stale = {
      isAxiosError: true,
      response: { status: 412, data: { error_code: "STALE_VERSION" } },
    };
    vi.mocked(http.post).mockRejectedValue(stale);

    await expect(confirmPutawayTask("PTW-12", 3)).rejects.toBe(stale);
  });

  it("khoá idempotency ổn định theo version, đổi khi thao tác đổi", () => {
    expect(putawayIdempotencyKey("confirm", "PTW-1", 1)).toBe(
      putawayIdempotencyKey("confirm", "PTW-1", 1),
    );
    expect(putawayIdempotencyKey("confirm", "PTW-1", 1)).not.toBe(
      putawayIdempotencyKey("confirm", "PTW-1", 2),
    );
    expect(putawayIdempotencyKey("confirm", "PTW-1", 1)).not.toBe(
      putawayIdempotencyKey("cancel", "PTW-1", 1),
    );
    // Contract BE: Idempotency-Key dài 8..100 ký tự sau khi trim.
    const key = putawayIdempotencyKey(
      "confirm",
      "0f2f0f1e-5a1e-4a5a-9c3d-1f2e3d4c5b6a",
      12,
    );
    expect(key.length).toBeGreaterThanOrEqual(8);
    expect(key.length).toBeLessThanOrEqual(100);
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
