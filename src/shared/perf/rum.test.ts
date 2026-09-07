/**
 * Hàng rào cho lớp RUM.
 *
 * Ba phép tính dưới đây là chỗ DỄ SAI NHẤT và cũng là chỗ khiến số liệu vô
 * nghĩa nếu sai — không phải phần gọi API:
 *  · CLS là cửa sổ phiên LỚN NHẤT, không phải tổng cả trang (cộng tất cả sẽ phạt
 *    oan các phiên mở lâu — chính là 9 màn báo cáo giữ sống của app này);
 *  · INP lấy tương tác chậm thứ (n/50), không phải chậm nhất;
 *  · mẫu route phải cắt sạch đoạn định danh động trước khi rời máy người dùng.
 */
import { describe, expect, it } from "vitest";
import { clsFrom, inpFrom, routePatternOf } from "./rum";

describe("routePatternOf", () => {
  it("giữ nguyên route tĩnh", () => {
    expect(routePatternOf("/reports/traceability")).toBe(
      "/reports/traceability",
    );
    expect(routePatternOf("/dashboard")).toBe("/dashboard");
  });

  it("cắt tại đoạn UUID — id không được rời máy người dùng", () => {
    expect(routePatternOf("/pv/01a07b0e-9607-7301-ac1b-4076fd6543e3")).toBe(
      "/pv",
    );
  });

  it("cắt tại đoạn số dài (id dạng số)", () => {
    expect(routePatternOf("/inbound/123456/lines")).toBe("/inbound");
  });

  it("route gốc trả về '/'", () => {
    expect(routePatternOf("/")).toBe("/");
  });

  it("không cắt nhầm từ tiếng Anh ngắn trông giống hex", () => {
    // "added"/"face" toàn ký tự hex nhưng ngắn hơn 8 — không được coi là id.
    expect(routePatternOf("/reports/added")).toBe("/reports/added");
  });
});

describe("clsFrom", () => {
  it("lấy cửa sổ lớn nhất chứ không cộng dồn cả trang", () => {
    expect(clsFrom([{ value: 0.05 }, { value: 0.12 }, { value: 0.03 }])).toBe(
      0.12,
    );
  });

  it("không có dịch chuyển nào thì CLS = 0", () => {
    expect(clsFrom([])).toBe(0);
  });
});

describe("inpFrom", () => {
  it("dưới 50 tương tác thì lấy đúng cú chậm nhất", () => {
    expect(inpFrom([40, 120, 80], 3)).toBe(120);
  });

  it("100 tương tác thì bỏ qua cú chậm nhất, lấy cú chậm thứ hai", () => {
    // floor(100/50) = 2 -> phần tử thứ 3 tính từ chậm nhất (index 2).
    expect(inpFrom([300, 250, 90, 60], 100)).toBe(90);
  });

  it("không có tương tác nào thì INP = 0 (không gửi chỉ số rỗng)", () => {
    expect(inpFrom([], 0)).toBe(0);
  });

  it("chỉ số mẫu vượt quá số đang giữ thì kẹp về phần tử cuối", () => {
    expect(inpFrom([300, 250], 5000)).toBe(250);
  });
});
