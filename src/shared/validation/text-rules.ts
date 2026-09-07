/**
 * LUẬT NHẬP VĂN BẢN DÙNG CHUNG — bắt buộc / sàn / trần / định dạng cho ô chữ.
 *
 * Vì sao cần (hai lỗi thật, 06/09/2026):
 *  1. Đếm độ dài KHÔNG trim. `ReversalCreateModal` hiện lỗi đỏ theo
 *     `reason.length` nhưng khoá nút theo `reason.trim().length` — gõ 5 dấu
 *     cách thì ô sạch sẽ mà nút Tạo vẫn xám, người dùng không biết vì sao.
 *  2. Sàn độ dài mỗi màn một kiểu. Lý do huỷ ở xuất kho / đảo kho / đồng bộ
 *     quyền đều bắt ≥ 5 ký tự, riêng modal cấp linh kiện chỉ cần khác rỗng —
 *     gõ đúng một chữ "x" là huỷ được hồ sơ.
 *
 * Quy ước: MỌI phép đo đều chạy trên chuỗi ĐÃ TRIM, và `checkText` trả luôn
 * chuỗi đã trim trong `value` để nơi gọi gửi thẳng lên API, không trim lại lần
 * hai (đó là chỗ hai lần chuẩn hoá lệch nhau sinh bug).
 */
import { tStatic } from "@/shared/i18n/useT";

/** Ngưỡng tuyệt đối theo cột của BE — đừng chép số ra ngoài file này. */
export const TEXT_LIMITS = {
  /** Mã nghiệp vụ (SKU, nơi nhận, bệnh lỗi, vai trò…). */
  codeMax: 100,
  /** Tên hiển thị / tên đối tượng. */
  nameMax: 255,
  /** Ghi chú, mô tả — cột text dài nhất của BE. */
  noteMax: 2_000,
  /** Lý do huỷ/đảo/đổi quyền: BE `cancel_reason` max 1000. */
  reasonMax: 1_000,
  /** Sàn cho lý do: dưới 5 ký tự thì không phải "lý do", chỉ là ký tự rác. */
  reasonMin: 5,
} as const;

/**
 * Ký tự hợp lệ của MÃ nghiệp vụ. Cùng bộ với `USERNAME_REGEX` (login.schema)
 * và luật `role_code` của màn phân quyền — dự án chỉ có duy nhất một định
 * nghĩa "mã". Không cho khoảng trắng/dấu tiếng Việt: mã còn được in lên nhãn,
 * quét bằng máy và ghép vào mã hộp `BOX-<SKU>-<seq>`.
 */
export const CODE_REGEX = /^[A-Za-z0-9._-]+$/;

export interface TextRule {
  /** Bắt buộc nhập — chuỗi rỗng SAU KHI TRIM là lỗi. */
  required?: boolean;
  /** Sàn độ dài (đếm sau trim). */
  min?: number;
  /** Trần độ dài (đếm sau trim). */
  max?: number;
  /** Định dạng bắt buộc (đối chiếu trên chuỗi đã trim). */
  pattern?: RegExp;
  /**
   * Câu lỗi riêng khi lệch `pattern` — bỏ trống thì dùng câu chung
   * "Giá trị không đúng định dạng cho phép".
   */
  patternMessage?: string;
}

/** Luật mẫu dùng lại ở nhiều màn. */
export const TEXT_RULES = {
  /** Lý do huỷ/đảo/đổi quyền: bắt buộc, 5…1000 ký tự. */
  reason: {
    required: true,
    min: TEXT_LIMITS.reasonMin,
    max: TEXT_LIMITS.reasonMax,
  } satisfies TextRule,
  /** Ghi chú tự do: không bắt buộc, ≤ 2000 ký tự. */
  note: { max: TEXT_LIMITS.noteMax } satisfies TextRule,
  /** Mã nghiệp vụ: bắt buộc, ≤ 100 ký tự, đúng bộ ký tự mã. */
  code: {
    required: true,
    max: TEXT_LIMITS.codeMax,
    pattern: CODE_REGEX,
  } satisfies TextRule,
  /** Tên hiển thị: bắt buộc, ≤ 255 ký tự. */
  name: { required: true, max: TEXT_LIMITS.nameMax } satisfies TextRule,
} as const;

export type TextCheck =
  | { ok: true; value: string }
  | {
      ok: false;
      reason: "required" | "min" | "max" | "pattern";
      message: string;
    };

/**
 * Kiểm tra một ô chữ theo luật. `value` trả về là chuỗi ĐÃ TRIM — dùng thẳng
 * cho payload.
 *
 * Nơi gọi nào đã có sẵn câu lỗi riêng (đúng ngữ cảnh nghiệp vụ) thì đọc
 * `reason` để chọn câu của mình; nơi mới cứ dùng thẳng `message`.
 */
export function checkText(
  raw: string | null | undefined,
  rule: TextRule,
): TextCheck {
  const value = (raw ?? "").trim();

  if (value === "") {
    if (rule.required) {
      return {
        ok: false,
        reason: "required",
        message: tStatic("shared.validation.textRequired"),
      };
    }
    // Ô không bắt buộc và bỏ trống: mọi luật còn lại không áp dụng.
    return { ok: true, value };
  }

  if (rule.min != null && value.length < rule.min) {
    return {
      ok: false,
      reason: "min",
      message: tStatic("shared.validation.textMinLength", { min: rule.min }),
    };
  }

  if (rule.max != null && value.length > rule.max) {
    return {
      ok: false,
      reason: "max",
      message: tStatic("shared.validation.textMaxLength", { max: rule.max }),
    };
  }

  if (rule.pattern && !rule.pattern.test(value)) {
    return {
      ok: false,
      reason: "pattern",
      message: rule.patternMessage ?? tStatic("shared.validation.textPattern"),
    };
  }

  return { ok: true, value };
}

/**
 * Kiểm ĐỊNH DẠNG MÃ nghiệp vụ, chỉ khi mã thực sự được nhập mới hoặc bị đổi.
 *
 * Vì sao có tham số `previous`: bản ghi cũ trong DB có thể mang mã lệch chuẩn
 * (nhập trước khi có luật này, hoặc nhập thẳng bằng seeder). Nếu kiểm vô điều
 * kiện thì màn Sửa bị khoá cứng — người dùng không đổi được TÊN chỉ vì MÃ cũ
 * có khoảng trắng, mà nhiều màn còn khoá ô mã khi hàng đã có tồn nên không sửa
 * mã được nữa. Truyền `previous` = mã đang lưu để bỏ qua đúng trường hợp đó.
 *
 * Trả về câu lỗi, hoặc null khi hợp lệ.
 */
export function codeFormatError(
  next: string,
  previous?: string,
): string | null {
  if (previous !== undefined && next === previous) return null;
  return CODE_REGEX.test(next)
    ? null
    : tStatic("shared.validation.codePattern");
}

/**
 * Chỉ hỏi "đã hợp lệ chưa" — dùng cho `disabled` của nút lưu. Luôn đi cùng
 * `checkText` (cùng một `rule`) ở hàm validate để nút xám và câu lỗi dưới ô
 * không bao giờ nói hai chuyện khác nhau.
 */
export function isTextValid(
  raw: string | null | undefined,
  rule: TextRule,
): boolean {
  return checkText(raw, rule).ok;
}
