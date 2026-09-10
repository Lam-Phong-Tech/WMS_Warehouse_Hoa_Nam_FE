import { bilingual, enumLabelOrText } from "@/shared/constants/business-labels";
import { peekProvinces, stripDivisionPrefix } from "@/shared/lib/vn-address";

/**
 * NHÃN "Thị trường" / "Khu vực" CỦA ĐỐI TƯỢNG NHẬN HÀNG (agencies.market /
 * agencies.region) — đổi mã ASCII viết hoa sang tên tiếng Việt có dấu.
 *
 * Vì sao cần lớp này: hai cột đó ở BE là VARCHAR(120) TỰ DO, không phải enum có
 * ràng buộc. Bộ seeder ghi mã kiểu `MIEN_BAC` / `CAN_THO`, còn ô nhập ở màn
 * Danh mục đối tượng nhận hàng lại là ô chữ tự do nên người dùng có thể gõ
 * thẳng "Miền Bắc". Vì vậy KHÔNG được dịch mù:
 *
 *  1. trùng khoá bảng nhãn → trả nhãn (kể cả khi BE ghi thường: `can_tho`);
 *  2. không trùng nhưng CÓ hình dạng mã (HOA + gạch dưới) → tách gạch dưới cho
 *     đọc được (`FOO_BAR` → "Foo Bar") thay vì giấu đi, đây là dữ liệu danh mục
 *     nên mất chữ là mất luôn đầu mối;
 *  3. còn lại (người dùng đã gõ tiếng Việt) → giữ nguyên từng ký tự.
 *
 * Tên tỉnh/thành lấy từ chính danh mục địa giới trong repo
 * (`@/shared/lib/vn-address`, cập nhật bằng `yarn vn-address:sync`) nên khi địa
 * giới đổi thì bảng này tự đúng theo, không phải sửa tay.
 */

export const AGENCY_MARKET_LABELS: Readonly<Record<string, string>> = bilingual(
  {
    MIEN_BAC: "Miền Bắc",
    MIEN_TRUNG: "Miền Trung",
    MIEN_NAM: "Miền Nam",
  },
  {
    MIEN_BAC: "Northern region",
    MIEN_TRUNG: "Central region",
    MIEN_NAM: "Southern region",
  },
);

/**
 * Tỉnh/thành ĐÃ SÁP NHẬP hoặc đổi tên năm 2025 — không còn trong
 * `vn-provinces.json` (34 đơn vị) nhưng vẫn nằm trong dữ liệu đại lý cũ.
 *
 * Giữ ĐÚNG tên tại thời điểm bản ghi được tạo: đây là dữ liệu lịch sử của danh
 * mục, đổi sang tên đơn vị mới sẽ khiến người dùng không đối chiếu được với
 * hợp đồng / chứng từ cũ. Tên riêng nên không song ngữ.
 */
const LEGACY_PROVINCE_LABELS: Readonly<Record<string, string>> = {
  HA_GIANG: "Hà Giang",
  BAC_KAN: "Bắc Kạn",
  YEN_BAI: "Yên Bái",
  HOA_BINH: "Hòa Bình",
  VINH_PHUC: "Vĩnh Phúc",
  BAC_GIANG: "Bắc Giang",
  HAI_DUONG: "Hải Dương",
  THAI_BINH: "Thái Bình",
  HA_NAM: "Hà Nam",
  NAM_DINH: "Nam Định",
  QUANG_BINH: "Quảng Bình",
  THUA_THIEN_HUE: "Thừa Thiên Huế",
  QUANG_NAM: "Quảng Nam",
  BINH_DINH: "Bình Định",
  PHU_YEN: "Phú Yên",
  NINH_THUAN: "Ninh Thuận",
  BINH_THUAN: "Bình Thuận",
  KON_TUM: "Kon Tum",
  DAK_NONG: "Đắk Nông",
  BINH_PHUOC: "Bình Phước",
  BINH_DUONG: "Bình Dương",
  BA_RIA_VUNG_TAU: "Bà Rịa - Vũng Tàu",
  LONG_AN: "Long An",
  TIEN_GIANG: "Tiền Giang",
  BEN_TRE: "Bến Tre",
  TRA_VINH: "Trà Vinh",
  SOC_TRANG: "Sóc Trăng",
  BAC_LIEU: "Bạc Liêu",
  KIEN_GIANG: "Kiên Giang",
  HAU_GIANG: "Hậu Giang",
};

/**
 * MÃ (viết hoa) → tên tỉnh/thành đã bỏ tiền tố "Tỉnh"/"Thành phố".
 *
 * `codename` của danh mục đúng bằng mã ASCII snake_case mà dữ liệu đại lý đang
 * dùng (`can_tho` ↔ `CAN_THO`), nên chỉ cần viết hoa là khớp. Danh mục hiện
 * hành ghi SAU bảng lịch sử để một mã trùng tên thì tên đang có hiệu lực thắng.
 */
const PROVINCE_LABEL_BY_CODE: ReadonlyMap<string, string> = new Map<
  string,
  string
>([
  ...Object.entries(LEGACY_PROVINCE_LABELS),
  ...peekProvinces().map(
    (province) =>
      [province.codename.toUpperCase(), stripDivisionPrefix(province.name)] as [
        string,
        string,
      ],
  ),
]);

/**
 * Nhãn hiển thị cho MỘT giá trị thị trường hoặc khu vực. Chuỗi rỗng vào thì
 * chuỗi rỗng ra — nơi gọi tự quyết định in `EMPTY_TEXT`.
 *
 * Dùng chung một hàm cho cả hai cột: tập mã thị trường (`MIEN_*`) và tập mã
 * tỉnh/thành không giao nhau, tách đôi chỉ tạo thêm chỗ để gọi nhầm.
 */
export function agencyPlaceLabel(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (raw === "") return "";
  const province = PROVINCE_LABEL_BY_CODE.get(raw.toUpperCase());
  if (province !== undefined) return province;
  return enumLabelOrText(AGENCY_MARKET_LABELS, raw);
}

/** "Miền Nam · Cần Thơ" — bỏ phần trống, dùng cho dòng chú thích của đại lý. */
export function agencyPlaceLine(
  market: string | null | undefined,
  region: string | null | undefined,
): string {
  return [agencyPlaceLabel(market), agencyPlaceLabel(region)]
    .filter(Boolean)
    .join(" · ");
}
