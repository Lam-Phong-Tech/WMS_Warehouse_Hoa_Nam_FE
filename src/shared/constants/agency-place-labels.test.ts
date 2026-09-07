import { afterEach, describe, expect, it } from "vitest";
import {
  agencyPlaceLabel,
  agencyPlaceLine,
} from "@/shared/constants/agency-place-labels";
import { useLanguageStore } from "@/shared/i18n/language.store";

afterEach(() => {
  useLanguageStore.getState().setLanguage("vi");
});

describe("nhãn thị trường / khu vực của đối tượng nhận hàng", () => {
  it("đổi mã thị trường sang tiếng Việt", () => {
    expect(agencyPlaceLabel("MIEN_BAC")).toBe("Miền Bắc");
    expect(agencyPlaceLabel("MIEN_TRUNG")).toBe("Miền Trung");
    expect(agencyPlaceLabel("MIEN_NAM")).toBe("Miền Nam");
  });

  it("đổi mã tỉnh/thành theo danh mục địa giới, bỏ tiền tố Tỉnh / Thành phố", () => {
    expect(agencyPlaceLabel("CAN_THO")).toBe("Cần Thơ");
    expect(agencyPlaceLabel("HO_CHI_MINH")).toBe("Hồ Chí Minh");
    expect(agencyPlaceLabel("DAK_LAK")).toBe("Đắk Lắk");
    expect(agencyPlaceLabel("HAI_PHONG")).toBe("Hải Phòng");
  });

  it("vẫn đọc được tỉnh đã sáp nhập năm 2025 (không còn trong danh mục)", () => {
    expect(agencyPlaceLabel("THAI_BINH")).toBe("Thái Bình");
    expect(agencyPlaceLabel("BINH_DUONG")).toBe("Bình Dương");
    expect(agencyPlaceLabel("QUANG_NAM")).toBe("Quảng Nam");
    expect(agencyPlaceLabel("TIEN_GIANG")).toBe("Tiền Giang");
  });

  it("không phân biệt hoa thường vì BE có thể ghi codename thường", () => {
    expect(agencyPlaceLabel("can_tho")).toBe("Cần Thơ");
    expect(agencyPlaceLabel("mien_bac")).toBe("Miền Bắc");
  });

  it("giữ nguyên chuỗi người dùng tự gõ ở ô Thị trường / Khu vực", () => {
    // Hai cột này là VARCHAR tự do, màn Danh mục cho gõ tay — dịch mù sẽ bóp
    // méo đúng thứ người dùng vừa nhập.
    expect(agencyPlaceLabel("Miền Nam")).toBe("Miền Nam");
    expect(agencyPlaceLabel("TP.HCM")).toBe("TP.HCM");
    expect(agencyPlaceLabel("Khu vực Tây Nguyên")).toBe("Khu vực Tây Nguyên");
  });

  it("mã lạ vẫn đọc được thay vì bị giấu đi", () => {
    expect(agencyPlaceLabel("KHU_VUC_MOI")).toBe("Khu Vuc Moi");
  });

  it("rỗng vào thì rỗng ra, nơi gọi tự quyết định in Chưa có", () => {
    expect(agencyPlaceLabel("")).toBe("");
    expect(agencyPlaceLabel(null)).toBe("");
    expect(agencyPlaceLabel(undefined)).toBe("");
    expect(agencyPlaceLabel("   ")).toBe("");
  });

  it("ghép dòng thị trường · khu vực, bỏ vế trống", () => {
    expect(agencyPlaceLine("MIEN_NAM", "CAN_THO")).toBe("Miền Nam · Cần Thơ");
    expect(agencyPlaceLine("MIEN_BAC", null)).toBe("Miền Bắc");
    expect(agencyPlaceLine(null, "HA_NOI")).toBe("Hà Nội");
    expect(agencyPlaceLine(null, null)).toBe("");
  });

  it("sang English thì thị trường đổi, tên tỉnh giữ nguyên (danh từ riêng)", () => {
    useLanguageStore.getState().setLanguage("en");
    expect(agencyPlaceLabel("MIEN_BAC")).toBe("Northern region");
    expect(agencyPlaceLabel("CAN_THO")).toBe("Cần Thơ");
  });
});
