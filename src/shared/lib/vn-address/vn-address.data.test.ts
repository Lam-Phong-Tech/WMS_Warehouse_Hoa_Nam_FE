/**
 * Danh mục địa giới đọc từ JSON trong repo — KHÔNG được chạm tới mạng.
 *
 * Hai bất biến quan trọng nhất ở đây:
 *  1) Không có một lời gọi `fetch` nào (đây là lý do tính năng tồn tại).
 *  2) Danh sách phường/xã RỖNG luôn là LỖI, không bao giờ được cache — bản
 *     gọi API cũ cache `[]` rồi im lặng, người dùng chỉ thấy "Không có lựa
 *     chọn" cho tới khi tải lại trang.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import provincesDoc from "./data/vn-provinces.json";
import wardsJson from "./data/vn-wards.json";
import {
  VN_ADDRESS_DATA_VERSION,
  __resetVnAddressCache,
  fetchProvinces,
  fetchWards,
  peekProvinces,
  peekWards,
  stripDivisionPrefix,
} from "./vn-address.api";

interface WardRow {
  code: number;
  name: string;
}

// JSON literal của 3321 xã suy ra kiểu "khoá cố định" — thu về map thường để
// tra bằng mã tỉnh động, đồng thời khỏi bắt tsc gánh kiểu khổng lồ ở mọi chỗ.
const wardsByProvince = wardsJson.wardsByProvince as unknown as Record<
  string,
  WardRow[]
>;
const wardCount: number = wardsJson.count;

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetVnAddressCache();
  fetchSpy = vi.fn(() => {
    throw new Error("vn-address KHÔNG được gọi mạng lúc chạy");
  });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  __resetVnAddressCache();
});

describe("danh mục cục bộ", () => {
  it("tỉnh/thành có ngay lập tức, đồng bộ, không gọi mạng", () => {
    const provinces = peekProvinces();
    expect(provinces.length).toBe(provincesDoc.provinces.length);
    expect(provinces.length).toBeGreaterThanOrEqual(30);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sắp xếp theo tên riêng, bỏ tiền tố đơn vị", () => {
    const names = peekProvinces().map((p) => stripDivisionPrefix(p.name));
    expect([...names].sort((a, b) => a.localeCompare(b, "vi"))).toEqual(names);
    expect(peekProvinces().some((p) => p.name === "Thành phố Hà Nội")).toBe(
      true,
    );
  });

  it("phường/xã nạp từ chunk cục bộ, cũng không gọi mạng", async () => {
    expect(peekWards(1)).toBeNull();
    const wards = await fetchWards(1);
    expect(wards.length).toBe(wardsByProvince["1"].length);
    expect(wards.every((w) => w.province_code === 1)).toBe(true);
    expect(peekWards(1)).toHaveLength(wards.length);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetchProvinces/fetchWards không chạm mạng dù gọi lặp", async () => {
    await fetchProvinces();
    await fetchWards(1);
    await fetchWards(1);
    await fetchWards(48);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("mã tỉnh không có trong dữ liệu → LỖI, không cache rỗng", async () => {
    await expect(fetchWards(999_999)).rejects.toThrow(/không có phường\/xã/);
    expect(peekWards(999_999)).toBeNull();
    // Lần gọi sau vẫn lỗi (không nuốt), hook vì thế hiện được cảnh báo.
    await expect(fetchWards(999_999)).rejects.toThrow();
  });
});

describe("toàn vẹn dữ liệu", () => {
  it("mỗi tỉnh đều có phường/xã và mọi mã đều duy nhất", () => {
    const provinceCodes = new Set<number>();
    const wardCodes = new Set<number>();
    let wardTotal = 0;

    for (const province of provincesDoc.provinces) {
      expect(province.name.trim()).not.toBe("");
      expect(provinceCodes.has(province.code)).toBe(false);
      provinceCodes.add(province.code);

      const wards = wardsByProvince[String(province.code)];
      expect(wards, `tỉnh ${province.name} thiếu phường/xã`).toBeDefined();
      expect(wards.length).toBeGreaterThan(0);
      for (const ward of wards) {
        expect(ward.name.trim()).not.toBe("");
        expect(wardCodes.has(ward.code)).toBe(false);
        wardCodes.add(ward.code);
        wardTotal += 1;
      }
    }
    expect(wardTotal).toBe(wardCount);
    expect(wardTotal).toBeGreaterThanOrEqual(2500);
  });

  it("không có mã tỉnh lạ trong bảng phường/xã", () => {
    const codes = new Set(provincesDoc.provinces.map((p) => p.code));
    for (const key of Object.keys(wardsByProvince)) {
      expect(codes.has(Number(key)), `mã tỉnh lạ: ${key}`).toBe(true);
    }
  });

  it("có mốc phiên bản để biết dữ liệu sinh ngày nào", () => {
    expect(VN_ADDRESS_DATA_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
