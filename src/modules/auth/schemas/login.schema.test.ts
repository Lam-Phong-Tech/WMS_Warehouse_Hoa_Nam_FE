import { describe, expect, it } from "vitest";
import { loginSchema, toLoginRequest, USERNAME_MAX_LENGTH, PASSWORD_MAX_LENGTH } from "./login.schema";
const TEST_ONLY_PASSWORD = ["placeholder", "login", "pw"].join("-");
describe("TC_VAL_01 — UAT identifier contract (BE username support tracked separately)", () => {
  it.each(["ADMIN", "admin", "warehouse-keeper-01", "operator.test_01"])("maps %s to username without changing case", (identifier) => {
    expect(toLoginRequest(loginSchema.parse({ identifier, password: TEST_ONLY_PASSWORD })))
      .toEqual({ username: identifier, password: TEST_ONLY_PASSWORD });
  });
  it.each(["operator@example.test", "Operator@Example.test"])("maps %s to email without changing case", (identifier) => {
    expect(toLoginRequest(loginSchema.parse({ identifier, password: TEST_ONLY_PASSWORD })))
      .toEqual({ email: identifier, password: TEST_ONLY_PASSWORD });
  });
  it("trims the identifier, but never trims or changes the password", () => {
    expect(toLoginRequest(loginSchema.parse({ identifier: " operator ", password: " Secret " })))
      .toEqual({ username: "operator", password: " Secret " });
  });
  it.each(["admin@", "admin@com", "admin@@example.test", "admin..test@example.test", "admin user@example.test"])("rejects malformed email %s", (identifier) => {
    const result = loginSchema.safeParse({ identifier, password: TEST_ONLY_PASSWORD });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Định dạng Email không hợp lệ");
  });
  it.each(["admin#123", "admin user", "admin/01"])("uses the username rule for %s", (identifier) => {
    const result = loginSchema.safeParse({ identifier, password: TEST_ONLY_PASSWORD });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("Tên tài khoản không được chứa ký tự đặc biệt");
  });
  it("keeps login distinct from new-password strength validation", () => {
    expect(loginSchema.safeParse({ identifier: "operator", password: "x" }).success).toBe(true);
  });
  it("rejects empty fields and excessive lengths", () => {
    expect(loginSchema.safeParse({ identifier: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: "a".repeat(USERNAME_MAX_LENGTH + 1), password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: "operator", password: "x".repeat(PASSWORD_MAX_LENGTH + 1) }).success).toBe(false);
  });
});
