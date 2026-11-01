import { z } from "zod";
import { tStatic, type TranslateFn } from "@/shared/i18n/useT";
import type { LoginRequest } from "@/modules/auth/types/auth.types";
import { getAuthUatCopy, type AuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";

export const PASSWORD_MAX_LENGTH = 128;

const EMAIL_REGEX =
  /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function isValidEmail(value: string): boolean {
  const [localPart = "", domain = "", extraPart] = value.split("@");
  return extraPart === undefined && localPart.length > 0 && localPart.length <= 64 &&
    domain.length > 0 && !value.includes("..") && !localPart.startsWith(".") &&
    !localPart.endsWith(".") && EMAIL_REGEX.test(value);
}

/** Login accepts an email address only. */
export function buildLoginSchema(t: TranslateFn, copy: AuthUatCopy = getAuthUatCopy()) {
  return z.object({
    identifier: z.string().trim().superRefine((value, ctx) => {
      let message: string | undefined;
      if (!value) message = copy.identifierRequired;
      else if (value.length > 200) message = t("auth.validation.emailTooLong");
      else if (!isValidEmail(value)) message = copy.emailInvalid;
      if (message) ctx.addIssue({ code: "custom", message });
    }),
    password: z.string()
      .min(1, t("auth.validation.passwordRequired"))
      .max(PASSWORD_MAX_LENGTH, t("auth.validation.passwordTooLong")),
    remember: z.boolean().optional(),
  });
}
export const loginSchema = buildLoginSchema(tStatic);
export type LoginFormValues = z.infer<typeof loginSchema>;

/** The backend accepts only a normalized email. */
export function toLoginRequest(values: LoginFormValues): LoginRequest {
  return { email: values.identifier.trim().toLowerCase(), password: values.password };
}
