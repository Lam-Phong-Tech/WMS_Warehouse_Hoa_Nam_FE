import { z } from "zod";
import { tStatic, type TranslateFn } from "@/shared/i18n/useT";

// Rule khớp đúng API thật (POST /auth/change-password, xem
// docs/employee-account-provisioning-flow.md mục 5): tối thiểu 8 ký tự, có ít
// nhất 1 hoa, 1 thường, 1 ký tự đặc biệt, không khoảng trắng đầu/cuối.
export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

/**
 * Factory nhận `t` để lỗi validate đổi theo ngôn ngữ — component dựng schema
 * bằng `useMemo(() => buildChangePasswordSchema(t), [t])`.
 */
export function buildChangePasswordSchema(t: TranslateFn) {
  return z
    .object({
      currentPassword: z
        .string()
        .min(1, t("auth.validation.currentPasswordRequired")),
      newPassword: z
        .string()
        .min(8, t("auth.validation.newPasswordMin"))
        .refine(
          (v) => v === v.trim(),
          t("auth.validation.passwordNoEdgeSpaces"),
        )
        .refine(
          (v) => STRONG_PASSWORD_REGEX.test(v),
          t("auth.validation.passwordStrength"),
        ),
      newPasswordConfirmation: z
        .string()
        .min(1, t("auth.validation.confirmPasswordRequired")),
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
