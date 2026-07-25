import { z } from 'zod';

// Rule khớp đúng API thật (POST /auth/change-password, xem
// docs/employee-account-provisioning-flow.md mục 5): tối thiểu 8 ký tự, có ít
// nhất 1 hoa, 1 thường, 1 ký tự đặc biệt, không khoảng trắng đầu/cuối.
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới tối thiểu 8 ký tự')
      .refine(
        (v) => v === v.trim(),
        'Mật khẩu không được có khoảng trắng đầu/cuối',
      )
      .refine(
        (v) => STRONG_PASSWORD_REGEX.test(v),
        'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 ký tự đặc biệt',
      ),
    newPasswordConfirmation: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((v) => v.newPassword === v.newPasswordConfirmation, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['newPasswordConfirmation'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'Mật khẩu mới không được trùng mật khẩu hiện tại',
    path: ['newPassword'],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
