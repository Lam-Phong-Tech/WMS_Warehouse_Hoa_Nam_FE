import { describe, expect, it } from "vitest";
import { translateUserFacingText } from "@/shared/localization/VietnameseUiBoundary";

const EXPECTED_EXACT_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["Save", "Lưu"],
  ["Cancel", "Hủy"],
  ["Print", "In"],
  ["Close", "Đóng"],
  ["Search", "Tìm kiếm"],
  ["Loading", "Đang tải"],
  ["Create", "Tạo mới"],
  ["Update", "Cập nhật"],
  ["Delete", "Xóa"],
  ["Approve", "Phê duyệt"],
  ["Reject", "Từ chối"],
  ["Submit", "Gửi xử lý"],
  ["Archive", "Lưu trữ"],
  ["Restore", "Khôi phục"],
  ["PENDING", "Chờ duyệt"],
  ["APPROVED", "Đã duyệt"],
  ["CONVERTED", "Đã tạo phiếu kho"],
  ["IN_TRANSIT", "Đang vận chuyển"],
  ["RETURN_IN_TRANSIT", "Đang vận chuyển hoàn"],
  ["COMPLETED_WITH_LOSS", "Hoàn tất, có thiếu hụt"],
  ["REVERSED", "Đã điều chỉnh"],
  ["REMOVED", "Đã bỏ khỏi phiếu"],
  ["PASS", "Khớp"],
  ["FAIL", "Có chênh lệch"],
  ["NEW", "Mới tạo"],
  ["ISSUED", "Đã xuất cho khách"],
  ["CREATE", "Tạo mới"],
  ["UPDATE", "Cập nhật"],
  ["DELETE", "Xóa"],
  ["SUBMIT", "Gửi xử lý"],
  ["ARCHIVE", "Lưu trữ"],
  ["RESTORE", "Khôi phục"],
];

describe("VietnameseUiBoundary full localization checklist", () => {
  it.each(EXPECTED_EXACT_LABELS)("maps %s to Vietnamese", (source, expected) => {
    expect(translateUserFacingText(source)).toBe(expected);
  });

  it("covers the original P0/P1 workflow terminology", () => {
    expect(translateUserFacingText("Quét & Full Post Receipt")).toBe(
      "Quét & hoàn tất nhập kho",
    );
    expect(
      translateUserFacingText("Scan đủ → Preview Packing Label → Post Issue"),
    ).toBe("Quét đủ → Xem trước Nhãn đóng gói → Hoàn tất xuất kho");
    expect(translateUserFacingText("Movement / Trace")).toBe(
      "Biến động / Truy vết",
    );
    expect(translateUserFacingText("Product Master")).toBe(
      "Danh mục sản phẩm",
    );
    expect(translateUserFacingText("System scope")).toBe("Toàn hệ thống");
    expect(translateUserFacingText("runtime")).toBe("khi vận hành");
  });

  it("maps enum tokens embedded in user-facing sentences", () => {
    expect(translateUserFacingText("Trạng thái PENDING của yêu cầu")).toBe(
      "Trạng thái chờ duyệt của yêu cầu",
    );
    expect(translateUserFacingText("Kết quả FAIL sau reconcile")).toBe(
      "Kết quả có chênh lệch sau đối chiếu",
    );
    expect(translateUserFacingText("Action DELETE đã được chọn")).toBe(
      "thao tác xóa đã được chọn",
    );
  });

  it("preserves approved technical contract identifiers", () => {
    expect(translateUserFacingText("SKU · QR · RFID")).toBe("SKU · QR · RFID");
    expect(translateUserFacingText("sku.manage")).toBe("sku.manage");
    expect(translateUserFacingText("inbound.post")).toBe("inbound.post");
    expect(translateUserFacingText("published_to_app")).toBe("published_to_app");
  });
});
