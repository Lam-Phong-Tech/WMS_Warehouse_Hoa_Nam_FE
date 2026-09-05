import { z } from "zod";
import { tStatic, type TranslateFn } from "@/shared/i18n/useT";
import type { LoginRequest } from "@/modules/auth/types/auth.types";

/** Ký tự hợp lệ của tên đăng nhập — dùng chung với màn tạo tài khoản (IAM). */
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;
/** Tên đăng nhập tối đa 100 ký tự (BE LoginRequest / StoreUserRequest max:100). */
export const USERNAME_MAX_LENGTH = 100;
/** Mật khẩu tối đa 128 ký tự (BE LoginRequest max:128). */
export const PASSWORD_MAX_LENGTH = 128;
const EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

/**
 * Factory nhận `t` để thông báo lỗi validate đổi theo ngôn ngữ đang chọn —
 * component gọi với `useT()` (bọc `useMemo` dep `[t]`); message của Zod là
 * chuỗi tĩnh nên schema phải được dựng lại mỗi khi đổi ngôn ngữ.
 */
export function buildLoginSchema(t: TranslateFn) {
  return z
    .object({
      identifier: z
        .string()
        .trim()
        .min(1, t("auth.validation.identifierRequired"))
        .max(254, t("auth.validation.identifierTooLong")),
      password: z
        .string()
        .min(1, t("auth.validation.passwordRequired"))
        .max(PASSWORD_MAX_LENGTH, t("auth.validation.passwordTooLong")),
      /** "Ghi nhớ đăng nhập" — chỉ lưu identifier phía client, không vào payload. */
      remember: z.boolean().optional(),
    })
    .superRefine(({ identifier }, context) => {
      if (isEmailIdentifier(identifier)) {
        const [localPart = "", domain = "", extraPart] = identifier.split("@");
        const hasInvalidFormat =
          extraPart !== undefined ||
          localPart.length === 0 ||
          domain.length === 0 ||
          localPart.length > 64 ||
          identifier.includes("..") ||
          localPart.startsWith(".") ||
          localPart.endsWith(".") ||
          identifier !== identifier.toLowerCase() ||
          !EMAIL_REGEX.test(identifier);

        if (hasInvalidFormat) {
          context.addIssue({
            code: "custom",
            path: ["identifier"],
            message: t("auth.validation.emailInvalid"),
          });
        }
        return;
      }

      if (identifier.length > USERNAME_MAX_LENGTH) {
        context.addIssue({
          code: "custom",
          path: ["identifier"],
          message: t("auth.validation.usernameTooLong"),
        });
        return;
      }

      if (!USERNAME_REGEX.test(identifier)) {
        context.addIssue({
          code: "custom",
          path: ["identifier"],
          message: t("auth.validation.usernameFormat"),
        });
      }
    });
}

/** Bản tĩnh cho test/nơi ngoài React — message đóng băng theo ngôn ngữ lúc import. */
export const loginSchema = buildLoginSchema(tStatic);

export type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * BE m1 accepts exactly one identifier: email OR username, plus password.
 * Keep this mapping in one place so UI wording cannot drift from API payload.
 */
export function toLoginRequest(values: LoginFormValues): LoginRequest {
  const identifier = values.identifier.trim();
  return isEmailIdentifier(identifier)
    ? { email: identifier, password: values.password }
    : { username: identifier.toLowerCase(), password: values.password };
}
