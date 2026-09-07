import { z } from "zod";
import { tStatic, type TranslateFn } from "@/shared/i18n/useT";
import type { LoginRequest } from "@/modules/auth/types/auth.types";

/**
 * Ký tự hợp lệ của TÊN ĐĂNG NHẬP (cột `username`) — chỉ còn dùng ở màn tạo/sửa
 * tài khoản (IAM). Đăng nhập KHÔNG nhận username: xem chú thích của
 * `toLoginRequest`.
 */
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;
/** Tên đăng nhập tối đa 100 ký tự (BE StoreUserRequest max:100). */
export const USERNAME_MAX_LENGTH = 100;
/** Mật khẩu tối đa 128 ký tự (BE LoginRequest max:128). */
export const PASSWORD_MAX_LENGTH = 128;

const EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * Email hợp lệ theo đúng luật BE `LoginRequest`: chữ thường, không khoảng
 * trắng, một dấu `@`, có tên miền. Thiếu `@` cũng rơi vào đây (domain rỗng) —
 * nhập "admin" là email sai định dạng, không phải tên đăng nhập.
 */
function isValidEmail(value: string): boolean {
  const [localPart = "", domain = "", extraPart] = value.split("@");

  return (
    extraPart === undefined &&
    localPart.length > 0 &&
    localPart.length <= 64 &&
    domain.length > 0 &&
    !value.includes("..") &&
    !localPart.startsWith(".") &&
    !localPart.endsWith(".") &&
    value === value.toLowerCase() &&
    EMAIL_REGEX.test(value)
  );
}

/**
 * Factory nhận `t` để thông báo lỗi validate đổi theo ngôn ngữ đang chọn —
 * component gọi với `useT()` (bọc `useMemo` dep `[t]`); message của Zod là
 * chuỗi tĩnh nên schema phải được dựng lại mỗi khi đổi ngôn ngữ.
 */
export function buildLoginSchema(t: TranslateFn) {
  return z.object({
    identifier: z
      .string()
      .trim()
      .min(1, t("auth.validation.emailRequired"))
      .max(254, t("auth.validation.emailTooLong"))
      .refine(isValidEmail, t("auth.validation.emailInvalid")),
    password: z
      .string()
      .min(1, t("auth.validation.passwordRequired"))
      .max(PASSWORD_MAX_LENGTH, t("auth.validation.passwordTooLong")),
    /** "Ghi nhớ đăng nhập" — chỉ lưu identifier phía client, không vào payload. */
    remember: z.boolean().optional(),
  });
}

/** Bản tĩnh cho test/nơi ngoài React — message đóng băng theo ngôn ngữ lúc import. */
export const loginSchema = buildLoginSchema(tStatic);

export type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * BE `/auth/login` nhận `email` HOẶC `username`, nhưng FE chỉ gửi `email`:
 * một tài khoản có hai định danh đăng nhập (`admin` và `admin@gmail.com` cùng
 * vào được) gây nhầm lẫn và làm rộng bề mặt dò tài khoản. Giữ mapping ở một
 * chỗ để wording của UI không trôi khỏi payload API.
 */
export function toLoginRequest(values: LoginFormValues): LoginRequest {
  return { email: values.identifier.trim(), password: values.password };
}
