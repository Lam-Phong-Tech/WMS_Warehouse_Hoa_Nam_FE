import { beforeAll, describe, expect, it } from "vitest";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { translate, type TranslateFn } from "@/shared/i18n/useT";
import { buildChangePasswordSchema } from "./change-password.schema";

const english: TranslateFn = (key, vars) => translate("en", key, vars);
const values = {
  currentPassword: "Current#Pass2026",
  newPassword: "Another#Pass2027",
  newPasswordConfirmation: "Another#Pass2027",
};

beforeAll(async () => {
  await ensureEnglishMessages();
});

describe("change-password English validation", () => {
  it("shows English required errors for all three empty fields", () => {
    const result = buildChangePasswordSchema(english).safeParse({
      currentPassword: "",
      newPassword: "",
      newPasswordConfirmation: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    for (const [field, message] of Object.entries({
      currentPassword: "Please enter your current password",
      newPassword: "Please enter your new password",
      newPasswordConfirmation: "Please confirm the password",
    })) {
      expect(
        result.error.issues.find((issue) => issue.path[0] === field)?.message,
      ).toBe(message);
    }
  });

  it.each([
    ["Abc1!", "New password must be at least 8 characters"],
    [`Aa1!${"x".repeat(61)}`, "New password must not exceed 64 characters"],
    ["Has Space1!A", "Password must not contain whitespace"],
    ["Tabbed\t1!A", "Password must not contain whitespace"],
    [
      "NoDigits!!",
      "Password must contain uppercase and lowercase letters, a number and a special character",
    ],
    [
      "lowercase1!",
      "Password must contain uppercase and lowercase letters, a number and a special character",
    ],
    [
      "UPPERCASE1!",
      "Password must contain uppercase and lowercase letters, a number and a special character",
    ],
    [
      "NoSpecial123",
      "Password must contain uppercase and lowercase letters, a number and a special character",
    ],
    ["Warehouse.Admin#1", "New password must not contain your username"],
    ["Operator#123", "New password must not contain your username"],
    [
      values.currentPassword,
      "New password must differ from the current password",
    ],
  ])("localizes the policy error for %s", (password, message) => {
    const schema = buildChangePasswordSchema(english, {
      username: "warehouse.admin",
      email: "operator@example.test",
    });
    const result = schema.safeParse({
      ...values,
      newPassword: password,
      newPasswordConfirmation: password,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.find((issue) => issue.path[0] === "newPassword")
        ?.message,
    ).toBe(message);
  });

  it("shows an English confirmation mismatch", () => {
    const result = buildChangePasswordSchema(english).safeParse({
      ...values,
      newPasswordConfirmation: "Different#Pass2027",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.find(
        (issue) => issue.path[0] === "newPasswordConfirmation",
      )?.message,
    ).toBe("Password confirmation does not match");
  });
});
