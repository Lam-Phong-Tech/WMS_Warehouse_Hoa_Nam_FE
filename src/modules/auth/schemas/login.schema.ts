import { z } from "zod";
import type { LoginRequest } from "@/modules/auth/types/auth.types";

const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;
const EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

export const loginSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập email hoặc tên đăng nhập")
      .max(254, "Email hoặc tên đăng nhập quá dài"),
    password: z.string().min(1, "Vui lòng nhập mật khẩu"),
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
          message: "Email không hợp lệ",
        });
      }
      return;
    }

    if (identifier.length > 100) {
      context.addIssue({
        code: "custom",
        path: ["identifier"],
        message: "Tên đăng nhập không được vượt quá 100 ký tự",
      });
      return;
    }

    if (!USERNAME_REGEX.test(identifier)) {
      context.addIssue({
        code: "custom",
        path: ["identifier"],
        message:
          "Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang",
      });
    }
  });

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
