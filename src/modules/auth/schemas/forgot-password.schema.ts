import { z } from "zod";
import { STRONG_PASSWORD_REGEX } from "@/modules/auth/schemas/change-password.schema";

export const forgotPasswordEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email")
    .email("Email không hợp lệ"),
});

export type ForgotPasswordEmailFormValues = z.infer<
  typeof forgotPasswordEmailSchema
>;

export const otpSchema = z.object({
  otp: z
    .string()
    .trim()
    .length(6, "Mã OTP gồm đúng 6 chữ số")
    .regex(/^\d{6}$/, "Mã OTP chỉ gồm chữ số"),
});

export type OtpFormValues = z.infer<typeof otpSchema>;

/** Cùng rule "mật khẩu mạnh" với change-password.schema.ts — mật khẩu đặt qua
 * quên-mật-khẩu không được yếu hơn mật khẩu đổi thủ công. */
export const resetPasswordFormSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Mật khẩu mới tối thiểu 8 ký tự")
      .refine(
        (v) => v === v.trim(),
        "Mật khẩu không được có khoảng trắng đầu/cuối",
      )
      .refine(
        (v) => STRONG_PASSWORD_REGEX.test(v),
        "Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 ký tự đặc biệt",
      ),
    newPasswordConfirmation: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
  })
  .refine((v) => v.newPassword === v.newPasswordConfirmation, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["newPasswordConfirmation"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
