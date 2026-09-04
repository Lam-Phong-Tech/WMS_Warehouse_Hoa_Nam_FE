/**
 * Địa chỉ Việt Nam theo địa giới SAU SÁP NHẬP (2 cấp: Tỉnh/Thành → Phường/Xã,
 * không còn Quận/Huyện).
 *
 * Cột `address` / `customer_address` / `recipient_address` ở BE vẫn là chuỗi
 * (500–1000 ký tự). FE lưu một CHUỖI JSON vào đúng cột đó, shape
 * {@link StructuredAddress}. Mọi nơi hiển thị phải đi qua {@link formatAddress}
 * để người dùng thấy "Số nhà, Phường/Xã, Tỉnh/Thành" chứ không thấy JSON thô;
 * chuỗi cũ (nhập tự do trước khi có tính năng) vẫn hiển thị nguyên vẹn.
 *
 * THỨ TỰ KHÓA KHI SERIALIZE CÓ CHỦ ĐÍCH: `detail` đứng đầu, `province` đứng
 * cuối. BE che PII địa chỉ bằng cách cắt theo dấu phẩy và giữ lại phần cuối
 * (WarrantyPiiMasker::address) — với thứ tự này phần được giữ lại luôn là
 * tỉnh/thành, không bao giờ lộ số nhà.
 */

export interface StructuredAddress {
  /** Số nhà, đường, thôn/xóm… — phần người dùng gõ tự do. */
  detail: string;
  ward_code: number | null;
  ward: string;
  province_code: number | null;
  province: string;
}

export interface ParsedAddress extends StructuredAddress {
  /**
   * true = chuỗi gốc KHÔNG phải JSON của FE (dữ liệu cũ nhập tự do) — toàn bộ
   * chuỗi được đưa vào `detail` để người dùng thấy và bổ sung tỉnh/xã.
   */
  legacy: boolean;
}

export const EMPTY_STRUCTURED_ADDRESS: StructuredAddress = {
  detail: "",
  ward_code: null,
  ward: "",
  province_code: null,
  province: "",
};

const MASK_TOKEN = "***";

function asCode(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Đọc chuỗi lưu trong cột địa chỉ. Trả về null khi rỗng; JSON hợp lệ → shape
 * chuẩn; chuỗi tự do → `legacy: true` với toàn bộ chuỗi nằm ở `detail`.
 */
export function parseAddress(
  raw: string | null | undefined,
): ParsedAddress | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return {
          // detail giữ nguyên khoảng trắng — xem ghi chú ở serializeAddress.
          detail: typeof data.detail === "string" ? data.detail : "",
          ward_code: asCode(data.ward_code),
          ward: asText(data.ward),
          province_code: asCode(data.province_code),
          province: asText(data.province),
          legacy: false,
        };
      }
    } catch {
      // không phải JSON → rơi xuống nhánh legacy
    }
  }
  return { ...EMPTY_STRUCTURED_ADDRESS, detail: text, legacy: true };
}

export function isAddressEmpty(address: StructuredAddress): boolean {
  return (
    !address.detail.trim() &&
    !address.ward.trim() &&
    !address.province.trim() &&
    address.ward_code === null &&
    address.province_code === null
  );
}

/**
 * Chuỗi JSON để ghi vào cột địa chỉ. Rỗng hoàn toàn → "" (BE nhận null).
 * Xem ghi chú đầu file về thứ tự khóa.
 *
 * KHÔNG trim `detail` ở đây: ô nhập là controlled (value ↔ JSON), trim mỗi
 * lần gõ sẽ nuốt mất dấu cách người dùng vừa gõ. Khoảng trắng thừa được bỏ
 * lúc hiển thị (joinAddressParts) — phần dữ liệu chấp nhận vài ký tự trắng.
 */
export function serializeAddress(address: StructuredAddress): string {
  if (isAddressEmpty(address)) return "";
  return JSON.stringify({
    detail: address.detail,
    ward_code: address.ward_code,
    ward: address.ward.trim(),
    province_code: address.province_code,
    province: address.province.trim(),
  });
}

/** "Số nhà, Phường/Xã, Tỉnh/Thành" — bỏ phần trống. */
export function joinAddressParts(address: StructuredAddress): string {
  return [address.detail, address.ward, address.province]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Chuỗi hiển thị cho MỌI nơi render địa chỉ (bảng, nhãn in, báo cáo, chi tiết).
 * - JSON của FE → "detail, ward, province"
 * - chuỗi cũ nhập tự do → giữ nguyên
 * - chuỗi đã bị BE che theo cách chung (ký tự đầu + "***", vd "{***") → "***"
 * - chuỗi đã bị BE che theo dấu phẩy ('***, "province":"Hà Nội"}') → "***, Hà Nội"
 */
/**
 * Chuẩn hoá để tìm kiếm không dấu: bỏ dấu thanh/mũ, "đ" → "d", chữ thường.
 * MUI chỉ bỏ dấu tổ hợp (NFD) nên "Đà Nẵng" gõ "da nang" sẽ KHÔNG khớp nếu
 * không xử lý riêng chữ Đ/đ.
 */
export function normalizeVietnamese(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function formatAddress(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "";
  const parsed = parseAddress(text);
  if (parsed && !parsed.legacy) return joinAddressParts(parsed);

  if (text.startsWith("{") && text.endsWith(MASK_TOKEN)) return MASK_TOKEN;
  const maskedTail = /^\*\*\*,\s*"province"\s*:\s*"([^"]*)"\s*\}$/.exec(text);
  if (maskedTail) {
    const province = maskedTail[1].trim();
    return province ? `${MASK_TOKEN}, ${province}` : MASK_TOKEN;
  }
  return text;
}
