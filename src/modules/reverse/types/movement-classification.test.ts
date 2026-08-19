import { describe, expect, it } from "vitest";
import { isStockRestoringMovement } from "./index";

/**
 * WWHN-266 · BE266-D03 / DEC-REV-COMPONENT-001.
 *
 * BE mở phạm vi reversal cho movement COMPONENT_ISSUE (phiếu xuất linh kiện bảo
 * hành). Trước fix, ReversalCreateModal rẽ nhánh bằng
 * `movement_type === "ISSUE"` nên COMPONENT_ISSUE bị phân loại nhầm sang nhánh
 * receipt-reversal: preview hiển thị TRỪ tồn (thực tế BE cộng lại), form không
 * hiện return_condition + checkbox xác nhận hàng vật lý, và payload thiếu hai
 * field đó → BE 409 PHYSICAL_RETURN_REQUIRED ở bước Post dù UI cho submit.
 *
 * Không có test nào khác bảo vệ nhánh phân loại này (khảo sát 19/08: các test
 * reversal chỉ dùng movement_type làm fixture data), nên bộ này khoá hợp đồng
 * phân loại ở mức helper.
 */
describe("isStockRestoringMovement (DEC-REV-COMPONENT-001)", () => {
  it("ISSUE là reversal cộng-lại-tồn (BR-REV-06/07)", () => {
    expect(isStockRestoringMovement("ISSUE")).toBe(true);
  });

  it("COMPONENT_ISSUE cùng chiều với ISSUE — không được rơi sang nhánh receipt", () => {
    expect(isStockRestoringMovement("COMPONENT_ISSUE")).toBe(true);
  });

  it("RECEIPT đảo theo chiều trừ tồn", () => {
    expect(isStockRestoringMovement("RECEIPT")).toBe(false);
  });

  it("movement lạ/không chọn không được coi là cộng-lại-tồn", () => {
    expect(isStockRestoringMovement("REVERSAL")).toBe(false);
    expect(isStockRestoringMovement("OPENING")).toBe(false);
    expect(isStockRestoringMovement(undefined)).toBe(false);
    expect(isStockRestoringMovement(null)).toBe(false);
    expect(isStockRestoringMovement("")).toBe(false);
  });
});
