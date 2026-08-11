import { describe, expect, it } from "vitest";
import {
  loginSchema,
  toLoginRequest,
} from "@/modules/auth/schemas/login.schema";

describe("loginSchema — BE m1 auth identifier contract", () => {
  it("accepts non-gmail business email and maps it to email payload", () => {
    const values = loginSchema.parse({
      identifier: "Test-Super-Admin@HoaNam.com",
      password: "Cntt@1234",
    });

    expect(toLoginRequest(values)).toEqual({
      email: "test-super-admin@hoanam.com",
      password: "Cntt@1234",
    });
  });

  it("accepts username and maps it to username payload", () => {
    const values = loginSchema.parse({
      identifier: "ADMIN",
      password: "Cntt@1234",
    });

    expect(toLoginRequest(values)).toEqual({
      username: "admin",
      password: "Cntt@1234",
    });
  });

  it("does not impose password-strength rules on login", () => {
    expect(
      loginSchema.safeParse({ identifier: "admin", password: "x" }).success,
    ).toBe(true);
  });

  it("rejects malformed email and invalid username characters", () => {
    expect(
      loginSchema.safeParse({ identifier: "admin@", password: "secret" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ identifier: "admin user", password: "secret" }).success,
    ).toBe(false);
  });
});
