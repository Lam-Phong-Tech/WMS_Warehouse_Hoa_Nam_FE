import { z } from "zod";
import { EMAIL_REGEX } from "@/shared/constants/validation.constants";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Vui lòng nhập email")
    .regex(EMAIL_REGEX, "Email không hợp lệ, chỉ chấp nhận địa chỉ @gmail.com"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
