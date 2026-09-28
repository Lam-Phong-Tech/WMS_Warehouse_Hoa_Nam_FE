import { z } from "zod";
import { tStatic, type TranslateFn } from "@/shared/i18n/useT";
import type { LoginRequest } from "@/modules/auth/types/auth.types";
import { getAuthUatCopy, type AuthUatCopy } from "@/modules/auth/utils/auth-uat-copy";

/** Shared IAM username rules remain unchanged. Login preserves case exactly. */
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;
export const USERNAME_MAX_LENGTH = 100;
export const PASSWORD_MAX_LENGTH = 128;

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function isValidEmail(value: string): boolean {
  const [localPart = "", domain = "", extraPart] = value.split("@");
  return extraPart === undefined && localPart.length > 0 && localPart.length <= 64 &&
    domain.length > 0 && !value.includes("..") && !localPart.startsWith(".") &&
    !localPart.endsWith(".") && EMAIL_REGEX.test(value);
}

/** TC_VAL_01: @ selects Email validation; otherwise use Username validation.
 * Do not lowercase either identity or alter the password. BE owns case matching.
 */
export function buildLoginSchema(t: TranslateFn, copy: AuthUatCopy = getAuthUatCopy()) {
  return z.object({
    identifier: z.string().trim().superRefine((value, ctx) => {
      let message: string | undefined;
      if (!value) message = copy.identifierRequired;
      else if (value.includes("@")) {
        if (value.length > 254) message = t("auth.validation.emailTooLong");
        else if (!isValidEmail(value)) message = copy.emailInvalid;
      } else if (value.length > USERNAME_MAX_LENGTH) message = copy.identifierTooLong;
      else if (!USERNAME_REGEX.test(value)) message = copy.usernameInvalid;
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

/** Send exactly ONE identity field. Never manufacture an email from a username.
 * BE/dev currently prohibits username; see docs/uat/AUTH-UAT-new-v1.md.
 */
export function toLoginRequest(values: LoginFormValues): LoginRequest {
  const identifier = values.identifier.trim();
  return identifier.includes("@")
    ? { email: identifier, password: values.password }
    : { username: identifier, password: values.password };
}
