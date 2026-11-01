import { describe, expect, it } from "vitest";
import { loginSchema, toLoginRequest, PASSWORD_MAX_LENGTH } from "./login.schema";

const TEST_ONLY_PASSWORD = ["placeholder", "login", "pw"].join("-");
const UNTRIMMED_PASSWORD = [" ", "Secret", " "].join("");
const SHORT_PASSWORD = "x";

describe("email-only login contract", () => {
  it("normalizes email without changing the password", () => {
    expect(toLoginRequest(loginSchema.parse({ identifier: " Operator@Example.test ", password: UNTRIMMED_PASSWORD })))
      .toEqual({ email: "operator@example.test", password: UNTRIMMED_PASSWORD });
  });

  it.each(["admin", "warehouse-keeper-01", "operator.test_01"])("rejects username %s", (identifier) => {
    const result = loginSchema.safeParse({ identifier, password: TEST_ONLY_PASSWORD });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Định dạng Email không hợp lệ");
  });

  it.each(["admin@", "admin@com", "admin@@example.test", "admin..test@example.test", "admin user@example.test"])("rejects malformed email %s", (identifier) => {
    const result = loginSchema.safeParse({ identifier, password: TEST_ONLY_PASSWORD });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Định dạng Email không hợp lệ");
  });

  it("keeps login distinct from new-password strength validation", () => {
    expect(loginSchema.safeParse({ identifier: "operator@example.test", password: SHORT_PASSWORD }).success).toBe(true);
  });

  it("rejects empty fields and excessive lengths", () => {
    expect(loginSchema.safeParse({ identifier: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: `${"a".repeat(190)}@example.test`, password: SHORT_PASSWORD }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: "operator@example.test", password: SHORT_PASSWORD.repeat(PASSWORD_MAX_LENGTH + 1) }).success).toBe(false);
  });
});
