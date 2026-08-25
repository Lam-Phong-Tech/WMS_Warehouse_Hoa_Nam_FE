import { describe, expect, it } from "vitest";
import { translateUserFacingText } from "@/shared/localization/VietnameseUiBoundary";

describe("translateUserFacingText", () => {
  it("localizes the inbound/outbound blockers from the localization checklist", () => {
    expect(translateUserFacingText("Quét & Full Post Receipt")).toBe(
      "Quét & hoàn tất nhập kho",
    );
    expect(translateUserFacingText("Evidence Full Post Receipt")).toBe(
      "Kết quả hoàn tất nhập kho",
    );
    expect(translateUserFacingText("Request ID")).toBe("Mã yêu cầu");
    expect(translateUserFacingText("Item mới · chờ Post")).toBe(
      "Sản phẩm mới · chờ ghi nhận",
    );
    expect(
      translateUserFacingText(
        "Scan đủ → Preview Packing Label → Post Issue",
      ),
    ).toBe("Quét đủ → Xem trước Nhãn đóng gói → Hoàn tất xuất kho");
  });

  it("localizes raw business states without changing contract values in code", () => {
    expect(translateUserFacingText("MATCH")).toBe("Khớp");
    expect(translateUserFacingText("MISMATCH")).toBe("Có chênh lệch");
    expect(translateUserFacingText("NOT_APPLICABLE")).toBe("Không áp dụng");
    expect(translateUserFacingText("AVAILABLE")).toBe("Khả dụng");
    expect(translateUserFacingText("QUARANTINE")).toBe("Chờ kiểm tra");
    expect(translateUserFacingText("RECEIVED_PENDING_PUTAWAY")).toBe(
      "Chờ xếp khay",
    );
  });

  it("keeps approved technical identifiers that users may legitimately need", () => {
    expect(translateUserFacingText("SKU · QR · RFID")).toBe("SKU · QR · RFID");
    expect(translateUserFacingText("sku.manage")).toBe("sku.manage");
    expect(translateUserFacingText("published_to_app")).toBe("published_to_app");
  });
});
