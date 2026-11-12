import { z } from "zod";
import { tStatic, type TranslateFn } from "@/shared/i18n/useT";
import {
  hasPasswordWhitespace,
  NEW_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_REGEX,
} from "@/modules/auth/schemas/change-password.schema";
import { EMAIL_MAX_LENGTH } from "@/shared/constants/validation.constants";

/**
 * Các factory nhận `t` để lỗi validate đổi theo ngôn ngữ — component dựng
 * schema bằng `useMemo(() => build...(t), [t])`. Bản export tĩnh bên dưới giữ
 * cho test/nơi ngoài React (message đóng băng theo ngôn ngữ lúc import).
 */
export function buildForgotPasswordEmailSchema(t: TranslateFn) {
  return z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, t("auth.validation.emailRequired"))
      .max(EMAIL_MAX_LENGTH, t("auth.validation.emailTooLong"))
      .email(t("auth.validation.emailInvalid")),
  });
}

export const forgotPasswordEmailSchema =
  buildForgotPasswordEmailSchema(tStatic);

export type ForgotPasswordEmailFormValues = z.infer<
  typeof forgotPasswordEmailSchema
>;

export function buildOtpSchema(t: TranslateFn) {
  return z.object({
    otp: z
      .string()
      .trim()
      .length(6, t("auth.validation.otpLength"))
      .regex(/^\d{6}$/, t("auth.validation.otpDigitsOnly")),
  });
}

export const otpSchema = buildOtpSchema(tStatic);

export type OtpFormValues = z.infer<typeof otpSchema>;

/** Cùng rule "mật khẩu mạnh" với change-password.schema.ts — mật khẩu đặt qua
 * quên-mật-khẩu không được yếu hơn mật khẩu đổi thủ công. */
export function buildResetPasswordFormSchema(t: TranslateFn) {
  return z
    .object({
      newPassword: z
        .string()
        .min(1, t("auth.validation.newPasswordRequired"))
        .max(NEW_PASSWORD_MAX_LENGTH, t("auth.validation.newPasswordTooLong"))
        .refine((v) => v.length >= 8, t("auth.validation.newPasswordMin"))
        .refine(
          (v) => !hasPasswordWhitespace(v),
          t("auth.validation.passwordWhitespace"),
        )
        .refine(
          (v) => STRONG_PASSWORD_REGEX.test(v),
          t("auth.validation.passwordStrength"),
        ),
      newPasswordConfirmation: z
        .string()
        .min(1, t("auth.validation.confirmPasswordRequired"))
        .max(NEW_PASSWORD_MAX_LENGTH, t("auth.validation.newPasswordTooLong")),
    })
    .refine((v) => v.newPassword === v.newPasswordConfirmation, {
      message: t("auth.validation.confirmPasswordMismatch"),
      path: ["newPasswordConfirmation"],
    });
}

export const resetPasswordFormSchema = buildResetPasswordFormSchema(tStatic);

export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
