/**
 * LUẬT NHẬP SỐ DÙNG CHUNG — một nguồn duy nhất cho trần/sàn của mọi ô số.
 *
 * Vì sao cần: ô `type="number"` của trình duyệt KHÔNG chặn gì ngoài ký tự —
 * nó nhận "1e30", "-5", "10000000000000" và cả "0,5" tuỳ locale. Mỗi màn tự
 * viết `Number(value) < 0` thì màn sau lại quên trần trên (phản hồi người dùng
 * 05/09/2026: "định mức tối đa nhập 10000000000000 vẫn được"). Mọi màn gọi
 * `checkNumber()` với một `NumberRule`, còn ngưỡng tuyệt đối nằm ở
 * `NUMBER_LIMITS` để đổi một chỗ là đổi cả dự án.
 *
 * Ngưỡng tuyệt đối chọn theo nghiệp vụ kho máy nông nghiệp (máy bơm, máy gặt,
 * động cơ): đếm theo CÁI, không kho nào giữ tới một triệu hiện vật một SKU.
 * DB phía BE là numeric(18,3) nên trần này chỉ chặt hơn BE, không bao giờ
 * làm một giá trị BE chấp nhận bị FE từ chối sai.
 */
import { tStatic } from "@/shared/i18n/useT";

export const NUMBER_LIMITS = {
  /** Số lượng hiện vật / định mức tồn / số lượng trên phiếu. */
  quantityMax: 1_000_000,
  /** Số chữ số thập phân tối đa cho số lượng (khớp numeric(18,3) của BE). */
  quantityDecimals: 3,
  /** Số ngày (thời hạn bảo hành, hạn xử lý…): 10 năm. */
  daysMax: 3_650,
  /** Số tháng (thời hạn bảo hành theo tháng): 10 năm. */
  monthsMax: 120,
  /** Thứ tự hiển thị / độ ưu tiên. */
  sortOrderMax: 9_999,
  /** Phần trăm. */
  percentMax: 100,
} as const;

export interface NumberRule {
  /** Sàn (bao gồm). Bỏ trống = không chặn dưới. */
  min?: number;
  /** Trần (bao gồm). Bỏ trống = không chặn trên. */
  max?: number;
  /** Chỉ nhận số nguyên. */
  integer?: boolean;
  /** Số chữ số thập phân tối đa (bỏ qua khi `integer`). */
  decimals?: number;
  /** Bắt buộc nhập (rỗng là lỗi). */
  required?: boolean;
}

/** Luật mẫu dùng lại ở nhiều màn — đừng chép số 1_000_000 ra ngoài file này. */
export const NUMBER_RULES = {
  /** Số lượng hiện vật trên phiếu/dòng: nguyên, ≥ 1. */
  quantity: {
    min: 1,
    max: NUMBER_LIMITS.quantityMax,
    integer: true,
  } satisfies NumberRule,
  /** Số lượng cho phép 0 (điều chỉnh, kiểm đếm). */
  quantityOrZero: {
    min: 0,
    max: NUMBER_LIMITS.quantityMax,
    integer: true,
  } satisfies NumberRule,
  /** Định mức tồn tối thiểu: ≥ 0, tối đa 3 số lẻ (BE numeric(18,3)). */
  stockMin: {
    min: 0,
    max: NUMBER_LIMITS.quantityMax,
    decimals: NUMBER_LIMITS.quantityDecimals,
  } satisfies NumberRule,
  /** Định mức tồn tối đa: ≥ 1 (BE `min:1`), tối đa 3 số lẻ. */
  stockMax: {
    min: 1,
    max: NUMBER_LIMITS.quantityMax,
    decimals: NUMBER_LIMITS.quantityDecimals,
  } satisfies NumberRule,
  /** Số ngày: nguyên, 0…10 năm. */
  days: {
    min: 0,
    max: NUMBER_LIMITS.daysMax,
    integer: true,
  } satisfies NumberRule,
  /** Số tháng: nguyên, 0…120. */
  months: {
    min: 0,
    max: NUMBER_LIMITS.monthsMax,
    integer: true,
  } satisfies NumberRule,
  /** Thứ tự/ưu tiên: nguyên, 0…9999. */
  sortOrder: {
    min: 0,
    max: NUMBER_LIMITS.sortOrderMax,
    integer: true,
  } satisfies NumberRule,
  /** Phần trăm: 0…100. */
  percent: {
    min: 0,
    max: NUMBER_LIMITS.percentMax,
    decimals: 2,
  } satisfies NumberRule,
} as const;

export type NumberCheck =
  | { ok: true; value: number | null }
  | { ok: false; message: string };

/**
 * Chuẩn hoá chuỗi người dùng gõ về dạng `Number()` hiểu được: bỏ khoảng trắng,
 * dấu phẩy thập phân kiểu Việt ("1,5") → chấm. KHÔNG bỏ dấu chấm ngăn nghìn —
 * ô số của dự án không hiện ngăn nghìn khi gõ nên "1.000" là 1,000 (một).
 */
export function normalizeNumberText(raw: string): string {
  return raw.trim().replace(",", ".");
}

/** Định dạng số trong thông báo lỗi: 1000000 → "1.000.000" theo locale vi. */
function formatBound(value: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(
    value,
  );
}

function countDecimals(text: string): number {
  const dot = text.indexOf(".");
  if (dot < 0) return 0;
  // Bỏ phần mũ nếu có ("1.5e3") — đã bị chặn ở dưới nhưng đếm cho chắc.
  const tail = text.slice(dot + 1).replace(/e.*$/i, "");
  return tail.length;
}

/**
 * Kiểm tra một giá trị số theo luật. Nhận cả chuỗi (ô nhập tự do) lẫn số
 * (form RHF). Trả `value` đã parse để màn hình gửi thẳng lên API — không parse
 * lại lần hai ở nơi gọi (đó là chỗ hai lần parse lệch nhau sinh bug).
 */
export function checkNumber(
  raw: string | number | null | undefined,
  rule: NumberRule,
): NumberCheck {
  const text =
    raw == null
      ? ""
      : typeof raw === "number"
        ? String(raw)
        : normalizeNumberText(raw);

  if (text === "") {
    if (rule.required) {
      return {
        ok: false,
        message: tStatic("shared.validation.numberRequired"),
      };
    }
    return { ok: true, value: null };
  }

  // Chỉ nhận dạng thập phân thường: tuỳ chọn dấu âm, chữ số, tuỳ chọn ".số".
  // Loại thẳng "1e5", "0x10", "Infinity", "--1", "1.2.3" — Number() nhận vài
  // dạng trong số đó nhưng người dùng kho không bao giờ cố ý gõ chúng.
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    return { ok: false, message: tStatic("shared.validation.numberInvalid") };
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { ok: false, message: tStatic("shared.validation.numberInvalid") };
  }

  if (rule.integer && !Number.isInteger(value)) {
    return { ok: false, message: tStatic("shared.validation.numberInteger") };
  }

  if (
    !rule.integer &&
    rule.decimals != null &&
    countDecimals(text) > rule.decimals
  ) {
    return {
      ok: false,
      message: tStatic("shared.validation.numberDecimals", {
        decimals: rule.decimals,
      }),
    };
  }

  if (rule.min != null && value < rule.min) {
    return {
      ok: false,
      message: tStatic("shared.validation.numberMin", {
        min: formatBound(rule.min),
      }),
    };
  }

  if (rule.max != null && value > rule.max) {
    return {
      ok: false,
      message: tStatic("shared.validation.numberMax", {
        max: formatBound(rule.max),
      }),
    };
  }

  return { ok: true, value };
}

/**
 * Lọc ký tự khi đang GÕ (onChange) — không thay validate lúc submit, chỉ để
 * ô không bao giờ chứa "e", "+", khoảng trắng hay dấu âm khi luật không cho
 * âm. Giữ lại chuỗi đang gõ dở như "1." hay "-" để không giật ô.
 */
export function sanitizeNumberTyping(raw: string, rule: NumberRule): string {
  const allowNegative = rule.min == null || rule.min < 0;
  const allowDecimal = !rule.integer;
  let out = "";
  let seenDot = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
    } else if ((ch === "." || ch === ",") && allowDecimal && !seenDot) {
      out += ".";
      seenDot = true;
    } else if (ch === "-" && allowNegative && out === "") {
      out += "-";
    }
    // mọi ký tự khác bị bỏ
  }
  // Chặn số quá dài ngay khi gõ: nhiều hơn số chữ số của trần + 1 là vô nghĩa.
  if (rule.max != null) {
    const maxDigits = String(Math.floor(Math.abs(rule.max))).length + 1;
    const [intPart, fracPart] = out.replace("-", "").split(".");
    if (intPart.length > maxDigits) {
      const sign = out.startsWith("-") ? "-" : "";
      out =
        sign +
        intPart.slice(0, maxDigits) +
        (fracPart != null ? "." + fracPart : "");
    }
  }
  if (rule.decimals != null && !rule.integer) {
    const dot = out.indexOf(".");
    if (dot >= 0 && out.length - dot - 1 > rule.decimals) {
      out = out.slice(0, dot + 1 + rule.decimals);
    }
  }
  return out;
}

/** `inputMode` cho bàn phím di động theo luật. */
export function numberInputMode(rule: NumberRule): "numeric" | "decimal" {
  return rule.integer ? "numeric" : "decimal";
}
