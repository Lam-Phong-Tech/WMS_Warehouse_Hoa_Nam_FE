import { z } from "zod";
import { tStatic, type TranslateFn } from "@/shared/i18n/useT";

export const NEW_PASSWORD_MIN_LENGTH = 8;
export const NEW_PASSWORD_MAX_LENGTH = 64;

/**
 * Mật khẩu mới phải có đủ chữ hoa, chữ thường, số và ký tự đặc biệt. Dấu cách
 * được kiểm tra riêng để báo đúng thông điệp thay vì gộp vào lỗi độ mạnh.
 */
export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function hasPasswordWhitespace(value: string): boolean {
  return /[\s\p{Z}]/u.test(value);
}

export type ChangePasswordIdentity = {
  username?: string | null;
  email?: string | null;
};

function personalFragments(identity: ChangePasswordIdentity): string[] {
  const username = identity.username?.trim().toLowerCase() ?? "";
  const email = identity.email?.trim().toLowerCase() ?? "";
  const localPart = email.includes("@")
    ? email.slice(0, email.indexOf("@"))
    : email;

  return [username, localPart].filter((fragment) => fragment.length >= 3);
}

/**
 * Factory nhận `t` để lỗi validate đổi theo ngôn ngữ — component dựng schema
 * bằng `useMemo(() => buildChangePasswordSchema(t, user), [t, user])`.
 *
 * Tài khoản tạo tự động có username dạng UUID; khi đó phần local của email là
 * thứ người dùng nhận ra, nên kiểm tra cả hai giống backend.
 */
export function buildChangePasswordSchema(
  t: TranslateFn,
  identity: ChangePasswordIdentity = {},
) {
  const fragments = personalFragments(identity);

  return z
    .object({
      currentPassword: z
        .string()
        .min(1, t("auth.validation.currentPasswordRequired")),
      newPassword: z
        .string()
        .min(1, t("auth.validation.newPasswordRequired"))
        .max(NEW_PASSWORD_MAX_LENGTH, t("auth.validation.newPasswordTooLong"))
        .refine(
          (value) => value.length >= NEW_PASSWORD_MIN_LENGTH,
          t("auth.validation.newPasswordMin"),
        )
        .refine(
          (value) => !hasPasswordWhitespace(value),
          t("auth.validation.passwordWhitespace"),
        )
        .refine(
          (value) => STRONG_PASSWORD_REGEX.test(value),
          t("auth.validation.passwordStrength"),
        )
        .refine(
          (value) =>
            !fragments.some((fragment) =>
              value.toLowerCase().includes(fragment),
            ),
          t("auth.validation.passwordContainsUsername"),
        ),
      newPasswordConfirmation: z
        .string()
        .min(1, t("auth.validation.confirmPasswordRequired"))
        .max(NEW_PASSWORD_MAX_LENGTH, t("auth.validation.newPasswordTooLong")),
    })
    .refine((v) => v.newPassword === v.newPasswordConfirmation, {
      message: t("auth.validation.confirmPasswordMismatch"),
      path: ["newPasswordConfirmation"],
    })
    .refine((v) => v.newPassword !== v.currentPassword, {
      message: t("auth.validation.newPasswordSameAsCurrent"),
      path: ["newPassword"],
    });
}

/** Bản tĩnh cho test/nơi ngoài React — message đóng băng theo ngôn ngữ lúc import. */
export const changePasswordSchema = buildChangePasswordSchema(tStatic);

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
