import { describe, expect, it } from "vitest";
import { translateUserFacingText } from "@/shared/localization/translateUserFacingText";

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
      translateUserFacingText("Scan đủ → Preview Packing Label → Post Issue"),
    ).toBe("Quét đủ → Xem trước Nhãn đóng gói → Hoàn tất xuất kho");
  });

  it("keeps outbound detail sentences natural after enum localization", () => {
    expect(translateUserFacingText("Packing Label chưa PRINTED.")).toBe(
      "Nhãn đóng gói chưa được in.",
    );
    expect(
      translateUserFacingText(
        "Phiếu POSTED là bất biến; sửa sai dùng Reversal.",
      ),
    ).toBe(
      "Phiếu đã xuất kho không được chỉnh sửa trực tiếp; sửa sai dùng Điều chỉnh tồn kho.",
    );
    expect(translateUserFacingText("RFID mapping là stock-neutral.")).toBe(
      "Việc gán RFID không làm thay đổi tồn kho.",
    );
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
    expect(translateUserFacingText("BOX")).toBe("Hộp");
    expect(translateUserFacingText("TRAY")).toBe("Khay");
  });

  it("closes the remaining putaway/report/shell terminology register", () => {
    const cases: Array<[string, string]> = [
      ["Movement / Trace", "Biến động / Truy vết"],
      ["Packing Label", "Nhãn đóng gói"],
      ["Serial", "Số sê-ri"],
      ["Ledger", "Sổ tồn kho"],
      ["Putaway", "Xếp khay"],
      ["Reversal", "Điều chỉnh tồn kho"],
      ["Product Master", "Danh mục sản phẩm"],
      ["Version", "Phiên bản"],
      ["Publish", "Đưa lên ứng dụng"],
      ["Unpublish", "Gỡ khỏi ứng dụng"],
      ["runtime", "khi vận hành"],
      ["CRUD", "Tạo / Xem / Sửa / Xóa"],
      ["System scope", "Toàn hệ thống"],
    ];

    for (const [source, expected] of cases) {
      expect(translateUserFacingText(source)).toBe(expected);
    }
  });

  it("localizes browser/network errors that do not come from the backend", () => {
    expect(translateUserFacingText("Network Error")).toBe(
      "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
    );
    expect(translateUserFacingText("Failed to fetch")).toBe(
      "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
    );
    expect(translateUserFacingText("timeout of 10000ms exceeded")).toBe(
      "Yêu cầu quá thời gian, vui lòng thử lại.",
    );
  });

  it("keeps approved technical identifiers that users may legitimately need", () => {
    expect(translateUserFacingText("SKU · QR · RFID")).toBe("SKU · QR · RFID");
    expect(translateUserFacingText("sku.manage")).toBe("sku.manage");
    expect(translateUserFacingText("published_to_app")).toBe(
      "published_to_app",
    );
  });
});
