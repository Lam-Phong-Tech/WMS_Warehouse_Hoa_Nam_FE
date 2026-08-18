import { describe, expect, it } from "vitest";
import {
  WARRANTY_DIAGNOSIS_REQUIRED_TARGETS,
  WARRANTY_NEXT_STATUS,
  WARRANTY_NOTE_REQUIRED_LABELS,
  maskWarrantyAddress,
  maskWarrantyName,
  maskWarrantyPhone,
  warrantyPiiText,
} from "@/modules/warranty/constants";

/**
 * WWHN-244 — DEC-WAR-STATE-001 và §13.8.
 * Ma trận FE phải khớp 1-1 CurrentBaselineWarrantyController::TRANSITIONS, và
 * PII không được lọt raw lên DOM khi actor thiếu warranty.pii.view.
 */
describe("DEC-WAR-STATE-001 · ma trận transition FE", () => {
  it("khớp đúng ma trận backend, gồm cả CHECKING → COMPLETED", () => {
    expect(WARRANTY_NEXT_STATUS).toEqual({
      RECEIVED: ["CHECKING", "CANCELLED"],
      CHECKING: ["REPAIRING", "COMPLETED", "CANCELLED"],
      REPAIRING: ["COMPLETED", "CANCELLED"],
      COMPLETED: ["RETURNED", "CANCELLED"],
    });
  });

  it("không mở transition nào ra khỏi trạng thái terminal", () => {
    expect(WARRANTY_NEXT_STATUS.RETURNED).toBeUndefined();
    expect(WARRANTY_NEXT_STATUS.CANCELLED).toBeUndefined();
  });

  it("khai đúng ba guard nghiệp vụ mà BE enforce", () => {
    expect(WARRANTY_DIAGNOSIS_REQUIRED_TARGETS).toEqual([
      "REPAIRING",
      "COMPLETED",
    ]);
    expect(Object.keys(WARRANTY_NOTE_REQUIRED_LABELS).sort()).toEqual([
      "COMPLETED",
      "RETURNED",
    ]);
  });
});

describe("§13.8 · mask PII ở tầng render", () => {
  it("giữ đúng shape mask của backend WarrantyPiiMasker", () => {
    expect(maskWarrantyName("Nguyễn Văn A")).toBe("N*** V*** A***");
    expect(maskWarrantyPhone("0901234567")).toBe("*******567");
    expect(maskWarrantyAddress("12 Lê Lợi, Quận 1, TP.HCM")).toBe(
      "***, TP.HCM",
    );
    expect(maskWarrantyAddress("Hà Nội")).toBe("***");
  });

  it("che số điện thoại rất ngắn hoàn toàn thay vì để lộ", () => {
    expect(maskWarrantyPhone("12")).toBe("**");
    expect(maskWarrantyPhone("123")).toBe("***");
  });

  it("idempotent với chuỗi đã mask sẵn từ backend", () => {
    expect(maskWarrantyName("N*** V*** A***")).toBe("N*** V*** A***");
    expect(maskWarrantyPhone("*******567")).toBe("*******567");
    expect(maskWarrantyAddress("***, TP.HCM")).toBe("***, TP.HCM");
  });

  it("fail-closed: PII thô lọt từ API vẫn bị che khi thiếu quyền", () => {
    expect(warrantyPiiText("Nguyễn Văn A", false, "name")).toBe(
      "N*** V*** A***",
    );
    expect(warrantyPiiText("0901234567", false, "phone")).toBe("*******567");
    expect(warrantyPiiText("12 Lê Lợi, TP.HCM", false, "address")).toBe(
      "***, TP.HCM",
    );
  });

  it("giữ nguyên giá trị khi actor có warranty.pii.view", () => {
    expect(warrantyPiiText("Nguyễn Văn A", true, "name")).toBe("Nguyễn Văn A");
    expect(warrantyPiiText("0901234567", true, "phone")).toBe("0901234567");
  });

  it("không dựng chuỗi mask từ giá trị rỗng", () => {
    expect(warrantyPiiText("", false, "name")).toBe("");
    expect(warrantyPiiText(undefined, false, "phone")).toBe("");
    expect(warrantyPiiText(null, false, "address")).toBe("");
  });
});
