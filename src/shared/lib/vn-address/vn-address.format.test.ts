import { describe, expect, it } from "vitest";
import {
  formatAddress,
  parseAddress,
  serializeAddress,
} from "./vn-address.format";

const HN = {
  detail: "Số 12 Kim Mã",
  ward_code: 4,
  ward: "Phường Ba Đình",
  province_code: 1,
  province: "Thành phố Hà Nội",
};

describe("vn-address format", () => {
  it("serialize → parse giữ nguyên dữ liệu và đặt detail TRƯỚC, province SAU CÙNG", () => {
    const json = serializeAddress(HN);
    expect(json.startsWith('{"detail":')).toBe(true);
    expect(json.endsWith('"province":"Thành phố Hà Nội"}')).toBe(true);
    expect(parseAddress(json)).toEqual({ ...HN, legacy: false });
  });

  it("rỗng hoàn toàn → chuỗi rỗng (BE nhận null)", () => {
    expect(
      serializeAddress({
        detail: "  ",
        ward_code: null,
        ward: "",
        province_code: null,
        province: "",
      }),
    ).toBe("");
    expect(parseAddress("")).toBeNull();
    expect(parseAddress(null)).toBeNull();
    expect(formatAddress(undefined)).toBe("");
  });

  it("chuỗi cũ nhập tự do → legacy, toàn bộ nằm ở detail, hiển thị nguyên vẹn", () => {
    const parsed = parseAddress("Hải Châu, Đà Nẵng");
    expect(parsed).toEqual({
      detail: "Hải Châu, Đà Nẵng",
      ward_code: null,
      ward: "",
      province_code: null,
      province: "",
      legacy: true,
    });
    expect(formatAddress("Hải Châu, Đà Nẵng")).toBe("Hải Châu, Đà Nẵng");
  });

  it("formatAddress ghép 'detail, ward, province' và bỏ phần trống", () => {
    expect(formatAddress(serializeAddress(HN))).toBe(
      "Số 12 Kim Mã, Phường Ba Đình, Thành phố Hà Nội",
    );
    expect(formatAddress(serializeAddress({ ...HN, detail: "" }))).toBe(
      "Phường Ba Đình, Thành phố Hà Nội",
    );
  });

  it("nhận diện chuỗi đã bị BE che, không lộ JSON thô", () => {
    // mask chung: ký tự đầu + ***
    expect(formatAddress("{***")).toBe("***");
    // WarrantyPiiMasker::address cắt theo dấu phẩy, giữ phần cuối
    expect(formatAddress('***, "province":"Thành phố Hà Nội"}')).toBe(
      "***, Thành phố Hà Nội",
    );
    expect(formatAddress("***, Đà Nẵng")).toBe("***, Đà Nẵng");
  });

  it("JSON hỏng / không phải object → coi là chuỗi cũ", () => {
    expect(formatAddress("{không phải json}")).toBe("{không phải json}");
    expect(parseAddress("[1,2]")?.legacy).toBe(true);
  });

  it("mã dạng chuỗi số vẫn đọc được", () => {
    const parsed = parseAddress(
      '{"detail":"x","ward_code":"4","ward":"P","province_code":"1","province":"T"}',
    );
    expect(parsed?.ward_code).toBe(4);
    expect(parsed?.province_code).toBe(1);
  });
});
