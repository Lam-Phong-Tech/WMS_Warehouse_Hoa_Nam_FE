import { describe, expect, it } from "vitest";
import { tStatic } from "@/shared/i18n/useT";
import { buildChangePasswordSchema } from "./change-password.schema";

const identity = {
  username: "u-11a24255-3967-4dd5-b3ca-2178b714ec5c",
  email: "danghong2003@example.test",
};

const schema = buildChangePasswordSchema(tStatic, identity);

function fieldMessage(
  values: {
    currentPassword: string;
    newPassword: string;
    newPasswordConfirmation: string;
  },
  field: string,
) {
  const result = schema.safeParse(values);
  expect(result.success).toBe(false);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("change-password schema copy and policy", () => {
  it("returns the exact blank-field messages", () => {
    const result = schema.safeParse({
      currentPassword: "",
      newPassword: "",
      newPasswordConfirmation: "",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.find((issue) => issue.path[0] === "currentPassword")
        ?.message,
    ).toBe("Vui lòng nhập mật khẩu hiện tại");
    expect(
      result.error.issues.find((issue) => issue.path[0] === "newPassword")
        ?.message,
    ).toBe("Vui lòng nhập mật khẩu mới");
    expect(
      result.error.issues.find(
        (issue) => issue.path[0] === "newPasswordConfirmation",
      )?.message,
    ).toBe("Vui lòng xác nhận mật khẩu");
  });

  it.each([
    ["short", "Abc1!", "Mật khẩu mới tối thiểu 8 ký tự"],
    [
      "over 64 characters",
      `Aa1!${"x".repeat(61)}`,
      "Mật khẩu mới không được vượt quá 64 ký tự",
    ],
    [
      "missing uppercase",
      "lowercase1!",
      "Mật khẩu phải bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
    ],
    [
      "missing lowercase",
      "UPPERCASE1!",
      "Mật khẩu phải bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
    ],
    [
      "missing digit",
      "NoDigits!!",
      "Mật khẩu phải bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
    ],
    [
      "missing special",
      "NoSpecial123",
      "Mật khẩu phải bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
    ],
    ["space anywhere", "Has Space1!A", "Mật khẩu không được chứa khoảng trắng"],
    ["tab anywhere", "Tabbed\t1!A", "Mật khẩu không được chứa khoảng trắng"],
  ])("rejects a password that is %s", (_case, password, message) => {
    expect(
      fieldMessage(
        {
          currentPassword: "Strong#Pass2026",
          newPassword: password,
          newPasswordConfirmation: password,
        },
        "newPassword",
      ),
    ).toBe(message);
  });

  it("rejects the username and the email local part", () => {
    const usernameSchema = buildChangePasswordSchema(tStatic, {
      username: "warehouse.admin",
      email: "operator@example.test",
    });
    const usernameResult = usernameSchema.safeParse({
      currentPassword: "Strong#Pass2026",
      newPassword: "Warehouse.Admin#1",
      newPasswordConfirmation: "Warehouse.Admin#1",
    });
    expect(usernameResult.success).toBe(false);
    if (!usernameResult.success) {
      expect(
        usernameResult.error.issues.find(
          (issue) => issue.path[0] === "newPassword",
        )?.message,
      ).toBe("Mật khẩu mới không được chứa tên đăng nhập");
    }

    expect(
      fieldMessage(
        {
          currentPassword: "Strong#Pass2026",
          newPassword: "Danghong2003@123",
          newPasswordConfirmation: "Danghong2003@123",
        },
        "newPassword",
      ),
    ).toBe("Mật khẩu mới không được chứa tên đăng nhập");
  });

  it("rejects reusing the current password and a mismatched confirmation", () => {
    expect(
      fieldMessage(
        {
          currentPassword: "Strong#Pass2026",
          newPassword: "Strong#Pass2026",
          newPasswordConfirmation: "Strong#Pass2026",
        },
        "newPassword",
      ),
    ).toBe("Mật khẩu mới không được trùng với mật khẩu hiện tại");

    expect(
      fieldMessage(
        {
          currentPassword: "Strong#Pass2026",
          newPassword: "Another#Pass2026",
          newPasswordConfirmation: "Different#Pass2026",
        },
        "newPasswordConfirmation",
      ),
    ).toBe("Mật khẩu xác nhận không khớp với mật khẩu mới");
  });

  it("accepts a strong password that is not personal", () => {
    expect(
      schema.safeParse({
        currentPassword: "Strong#Pass2026",
        newPassword: "Another#Pass2027",
        newPasswordConfirmation: "Another#Pass2027",
      }).success,
    ).toBe(true);
  });
});
