import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getState: vi.fn(),
}));

vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: {
    getState: authMocks.getState,
  },
}));
vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
    postWithMeta: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    downloadBlob: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import {
  fetchWarrantyCase,
  fetchWarrantyCases,
} from "@/modules/warranty/services/warrantyService";
import {
  maskWarrantyAddress,
  maskWarrantyName,
  maskWarrantyPhone,
  WARRANTY_BASELINE_STATUSES,
  WARRANTY_NEXT_STATUS,
} from "@/modules/warranty/constants";

/** Payload PII THÔ — mô phỏng BE hồi quy / alias chưa mask / cache cũ. */
const RAW_PII_ROW = {
  warranty_case_id: "wc-247",
  warranty_case_code: "BH-0247",
  status: "CHECKING",
  customer_name: "Nguyễn Văn An",
  customer_phone: "0909129922",
  customer_address: "12 Nguyễn Trãi, Thanh Xuân, Hà Nội",
  version: 2,
};

function grant(codes: string[]): void {
  authMocks.getState.mockReturnValue({
    isSuperAdmin: false,
    permissionCodes: codes,
  });
}

describe("WWHN-247 · §13.8 PII fail-closed ở tầng service", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
  });

  it("actor thiếu warranty.pii.view: PII thô từ API KHÔNG bao giờ ra khỏi service", async () => {
    grant(["warranty.manage"]);
    vi.mocked(http.getPage).mockResolvedValue({
      data: [RAW_PII_ROW],
      meta: { total: 1 },
    });

    const page = await fetchWarrantyCases();
    const row = page.data[0];

    expect(row.pii_masked).toBe(true);
    expect(row.customer_name).toBe("N*** V*** A***");
    expect(row.customer_phone).toBe("*******922");
    expect(row.customer_address).toBe("***, Hà Nội");
    // Không còn mảnh PII thô nào trong object trả về.
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain("Nguyễn Văn An");
    expect(serialized).not.toContain("0909129922");
    expect(serialized).not.toContain("Nguyễn Trãi");
  });

  it("actor có warranty.pii.view và BE không báo mask: trả nguyên văn để nghiệp vụ dùng được", async () => {
    grant(["warranty.manage", "warranty.pii.view"]);
    vi.mocked(http.get).mockResolvedValue(RAW_PII_ROW);

    const detail = await fetchWarrantyCase("wc-247");

    expect(detail.pii_masked).toBe(false);
    expect(detail.customer_name).toBe("Nguyễn Văn An");
    expect(detail.customer_phone).toBe("0909129922");
  });

  it("BE báo pii_masked=true thì FE tôn trọng, kể cả khi client tưởng mình có quyền", async () => {
    grant(["warranty.manage", "warranty.pii.view"]);
    vi.mocked(http.get).mockResolvedValue({
      ...RAW_PII_ROW,
      pii_masked: true,
    });

    const detail = await fetchWarrantyCase("wc-247");

    expect(detail.pii_masked).toBe(true);
    expect(detail.customer_name).toBe("N*** V*** A***");
  });

  it("case không có PII vẫn giữ placeholder, không sinh chuỗi mask giả", async () => {
    grant(["warranty.manage"]);
    vi.mocked(http.get).mockResolvedValue({
      warranty_case_id: "wc-empty",
      status: "RECEIVED",
      version: 1,
    });

    const detail = await fetchWarrantyCase("wc-empty");

    expect(detail.customer_name).toBe("-");
    expect(detail.customer_phone).toBeUndefined();
    expect(detail.customer_address).toBeUndefined();
  });
});

describe("WWHN-247 · shape mask khớp App\\Support\\WarrantyPiiMasker", () => {
  it("đúng shape §13.8 / NFR-SRS-015", () => {
    expect(maskWarrantyName("Nguyễn Văn An")).toBe("N*** V*** A***");
    expect(maskWarrantyPhone("0909129922")).toBe("*******922");
    expect(maskWarrantyPhone("12")).toBe("**");
    expect(maskWarrantyAddress("12 Nguyễn Trãi, Thanh Xuân, Hà Nội")).toBe(
      "***, Hà Nội",
    );
    expect(maskWarrantyAddress("Hà Nội")).toBe("***");
  });

  it("idempotent: mask lại chuỗi BE đã mask không lộ thêm ký tự và không đổi giá trị", () => {
    const name = maskWarrantyName("Nguyễn Văn An");
    const phone = maskWarrantyPhone("0909129922");
    const address = maskWarrantyAddress("12 Nguyễn Trãi, Thanh Xuân, Hà Nội");

    expect(maskWarrantyName(name)).toBe(name);
    expect(maskWarrantyPhone(phone)).toBe(phone);
    expect(maskWarrantyAddress(address)).toBe(address);
  });
});

/**
 * SRS v1.12 §6 + DEC-WAR-STATE-001 (WWHN-244) — ma trận chốt.
 * Nguồn BE: CurrentBaselineWarrantyController::TRANSITIONS, khoá bằng
 * tests/Feature/Wwhn244WarrantyStateMatrixTest::test_full_transition_matrix_*.
 */
const DECIDED_TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ["CHECKING", "CANCELLED"],
  CHECKING: ["REPAIRING", "COMPLETED", "CANCELLED"],
  REPAIRING: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["RETURNED", "CANCELLED"],
};

describe("WWHN-247 · ma trận trạng thái FE khớp BE/SRS §6", () => {
  it("§6 chỉ có đúng 6 trạng thái baseline", () => {
    expect(WARRANTY_BASELINE_STATUSES).toEqual([
      "RECEIVED",
      "CHECKING",
      "REPAIRING",
      "COMPLETED",
      "RETURNED",
      "CANCELLED",
    ]);
  });

  it("WARRANTY_NEXT_STATUS trùng khít ma trận đã chốt (không thiếu, không thừa cạnh)", () => {
    const feMatrix = Object.fromEntries(
      Object.entries(WARRANTY_NEXT_STATUS).map(([from, targets]) => [
        from,
        [...(targets ?? [])].sort(),
      ]),
    );
    const decided = Object.fromEntries(
      Object.entries(DECIDED_TRANSITIONS).map(([from, targets]) => [
        from,
        [...targets].sort(),
      ]),
    );

    expect(feMatrix).toEqual(decided);
  });

  it("RETURNED/CANCELLED là terminal: không khai báo cạnh đi tiếp", () => {
    expect(WARRANTY_NEXT_STATUS.RETURNED).toBeUndefined();
    expect(WARRANTY_NEXT_STATUS.CANCELLED).toBeUndefined();
  });
});
