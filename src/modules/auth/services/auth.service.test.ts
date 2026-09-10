import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, refreshSessionMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  refreshSessionMock: vi.fn(),
}));

vi.mock("@/shared/api/http", () => ({
  http: { get: getMock, post: postMock },
}));

vi.mock("@/shared/api/axios", () => ({
  refreshSession: refreshSessionMock,
}));

import {
  AuthContractError,
  authService,
} from "@/modules/auth/services/auth.service";

const USER = {
  user_id: "user-1",
  username: "warehouse01",
  email: "qa@example.com",
  display_name: "QA",
  roles: [],
  permissions: [],
  warehouse_scope_ids: [],
};

describe("authService contract — BE m1 /api/v1/auth/*", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /auth/login gửi đúng email + password và KHÔNG giữ refresh token (P1)", async () => {
    postMock.mockResolvedValue({
      access_token: "access-token",
      // BE cũ còn trả trường này: FE phải bỏ qua, không mang vào kết quả.
      refresh_token: "<must-not-be-kept>",
      token_type: "bearer",
      expires_in: 3600,
      user: USER,
    });

    const result = await authService.login({
      email: "qa@example.com",
      password: "secret",
    });

    expect(postMock).toHaveBeenCalledWith("/auth/login", {
      email: "qa@example.com",
      password: "secret",
    });
    // WWHN-SEC-08: login tra ve union — phai thu hep truoc khi doc token.
    // Chinh viec TypeScript bat buoc buoc nay la thu chan duoc lop loi
    // "tuong da dang nhap" o nhanh MFA.
    expect(result.kind).toBe("authenticated");
    if (result.kind !== "authenticated") throw new Error("unreachable");
    expect(result.access_token).toBe("access-token");
    expect(result).not.toHaveProperty("refresh_token");
    expect(JSON.stringify(result)).not.toContain("must-not-be-kept");
  });

  it("login fail-closed khi thiếu access_token", async () => {
    postMock.mockResolvedValue({
      expires_in: 3600,
      user: { id: 1, email: "qa@example.com", code: "QA" },
    });

    await expect(
      authService.login({ email: "qa@example.com", password: "secret" }),
    ).rejects.toBeInstanceOf(AuthContractError);
  });

  it("login fail-closed khi user không có stable identifier", async () => {
    postMock.mockResolvedValue({
      access_token: "token",
      expires_in: 3600,
      user: { email: "qa@example.com" },
    });

    await expect(
      authService.login({ email: "qa@example.com", password: "secret" }),
    ).rejects.toMatchObject({ field: "user.id" });
  });

  it("POST /auth/mfa/verify dựng phiên từ user trả kèm, không giữ refresh token", async () => {
    postMock.mockResolvedValue({
      access_token: "access-mfa",
      refresh_token: "<must-not-be-kept>",
      token_type: "bearer",
      expires_in: 3600,
      second_factor: "totp",
      user: USER,
    });

    const result = await authService.verifyMfa("challenge-token", "123456");

    expect(postMock).toHaveBeenCalledWith("/auth/mfa/verify", {
      mfa_token: "challenge-token",
      code: "123456",
    });
    expect(result.access_token).toBe("access-mfa");
    expect(result).not.toHaveProperty("refresh_token");
  });

  it("POST /auth/refresh đi qua refreshSession (chỉ cookie) và fail-closed với response sai", async () => {
    refreshSessionMock.mockResolvedValue({
      access_token: "",
      token_type: "bearer",
      expires_in: 0,
    });

    await expect(authService.refresh()).rejects.toBeInstanceOf(
      AuthContractError,
    );
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    expect(postMock).not.toHaveBeenCalled();
  });

  it("POST /auth/refresh trả access token + hồ sơ, không có refresh token", async () => {
    refreshSessionMock.mockResolvedValue({
      access_token: "<access-from-cookie>",
      token_type: "bearer",
      expires_in: 3600,
      user: USER,
    });

    const result = await authService.refresh();

    expect(result.access_token).toBe("<access-from-cookie>");
    expect(result.user).toMatchObject({ user_id: "user-1" });
    expect(result).not.toHaveProperty("refresh_token");
  });

  it("POST /auth/logout gửi body rỗng kèm credentials để BE thu hồi đúng phiên theo cookie", async () => {
    postMock.mockResolvedValue(null);

    await authService.logout();

    expect(postMock).toHaveBeenCalledWith(
      "/auth/logout",
      {},
      { withCredentials: true },
    );
  });

  it("GET /auth/me dựng context kho từ warehouse_scope_ids và permission top-level", async () => {
    getMock.mockResolvedValue({
      user_id: "user-1",
      username: "warehouse01",
      display_name: "QA",
      email: "qa@example.com",
      status: "ACTIVE",
      roles: [
        {
          role_id: "role-1",
          role_code: "WAREHOUSE_STAFF",
          role_name: "Nhân viên kho",
          scope_ref: "WH-HN-01",
        },
      ],
      permissions: ["inventory.view", "stock_movement.view"],
      warehouse_scope_ids: ["WH-HN-01"],
    });

    const result = await authService.me();

    expect(getMock).toHaveBeenCalledWith("/auth/me");
    expect(result.permissions).toEqual([
      "inventory.view",
      "stock_movement.view",
    ]);
    expect(result.available_contexts).toHaveLength(1);
    expect(result.available_contexts[0]).toMatchObject({
      context_type: "WAREHOUSE",
      context_id: "WH-HN-01",
      scope_ref: "WH-HN-01",
      warehouse_name: "WH-HN-01",
    });
  });

  it("POST /auth/change-password gửi đúng Laravel confirmed payload", async () => {
    postMock.mockResolvedValue(null);
    const payload = {
      current_password: "old-secret",
      new_password: "NewSecret@123",
      new_password_confirmation: "NewSecret@123",
    };

    await authService.changePassword(payload);

    expect(postMock).toHaveBeenCalledWith("/auth/change-password", payload);
  });

  it("POST /auth/switch-context gửi warehouse scope và nhận access token mới", async () => {
    postMock.mockResolvedValue({
      access_token: "<access-warehouse-2>",
      token_type: "bearer",
      expires_in: 3600,
      active_context: {
        context_type: "WAREHOUSE",
        context_id: "WH-HN-02",
        scope_ref: "WH-HN-02",
      },
      user: {
        user_id: "user-1",
        username: "warehouse01",
        email: "qa@example.com",
      },
    });

    const payload = {
      context_type: "WAREHOUSE",
      context_id: "WH-HN-02",
      scope_ref: "WH-HN-02",
    };
    const result = await authService.switchContext(payload);

    expect(postMock).toHaveBeenCalledWith("/auth/switch-context", payload);
    expect(result).toMatchObject({
      access_token: "<access-warehouse-2>",
      token_type: "bearer",
      expires_in: 3600,
      active_context: payload,
    });
  });
});
