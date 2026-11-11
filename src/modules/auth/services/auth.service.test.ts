import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, patchMock, refreshSessionMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  refreshSessionMock: vi.fn(),
}));

vi.mock("@/shared/api/http", () => ({
  http: { get: getMock, post: postMock, patch: patchMock },
}));

vi.mock("@/shared/api/axios", () => ({
  refreshSession: refreshSessionMock,
  withAuthSessionLock: <T>(task: () => Promise<T>) => task(),
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

  it("login giữ tín hiệu backend đã đăng xuất phiên trước", async () => {
    postMock.mockResolvedValue({ access_token: "access-token", expires_in: 3600,
      user: USER, replaced_existing_session: true });

    const result = await authService.login({ email: "qa@example.com", password: "secret" });

    expect(result.kind).toBe("authenticated");
    if (result.kind !== "authenticated") throw new Error("unreachable");
    expect(result.replaced_existing_session).toBe(true);
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

  it("PATCH /auth/me sends only editable fields with the current version", async () => {
    patchMock.mockResolvedValue({
      ...USER,
      display_name: "Tên mới",
      phone: "0912345678",
      version: 4,
    });

    const result = await authService.updateMe(
      { display_name: "Tên mới", phone: "0912345678" },
      3,
    );

    expect(patchMock).toHaveBeenCalledWith(
      "/auth/me",
      { display_name: "Tên mới", phone: "0912345678" },
      { headers: { "If-Match": "3" } },
    );
    expect(result).toMatchObject({
      display_name: "Tên mới",
      phone: "0912345678",
      version: 4,
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

  it("keeps step-up and device challenges out of the authenticated result", async () => {
    postMock.mockResolvedValueOnce({
      step_up_required: true,
      step_up_token: "s",
      method: "email",
      masked_email: "a***@b.test",
      expires_in: 300,
    });
    const result = await authService.login({
      email: "a@b.test",
      password: "<password>",
    });
    expect(result.kind).toBe("step_up_required");
    expect("access_token" in result).toBe(false);

    postMock.mockResolvedValueOnce({
      device_verification_required: true,
      device_token: "d-token",
      masked_email: "a***@b.test",
      expires_in: 300,
    });
    const deviceResult = await authService.login({
      email: "a@b.test",
      password: "<password>",
    });
    expect(deviceResult.kind).toBe("device_verification_required");
    expect("access_token" in deviceResult).toBe(false);
  });

  it("supports verifyStepUp, resendStepUp, verifyDevice, resendDevice, and powChallenge endpoints", async () => {
    postMock.mockResolvedValueOnce({
      step_up_verified: true,
      password_attempts_left: 3,
      expires_in: 300,
    });
    const stepUp = await authService.verifyStepUp("step-tok", "123456");
    expect(postMock).toHaveBeenCalledWith("/auth/step-up/verify", {
      step_up_token: "step-tok",
      code: "123456",
    });
    expect(stepUp).toEqual({
      step_up_verified: true,
      password_attempts_left: 3,
      expires_in: 300,
    });

    postMock.mockResolvedValueOnce({ sent: true, expires_in: 300 });
    await authService.resendStepUp("step-tok");
    expect(postMock).toHaveBeenCalledWith("/auth/step-up/resend", {
      step_up_token: "step-tok",
    });

    postMock.mockResolvedValueOnce({
      access_token: "<device-access-token>",
      token_type: "bearer",
      expires_in: 3600,
      user: USER,
    });
    const verifiedDevice = await authService.verifyDevice(
      "dev-tok",
      "654321",
    );
    expect(postMock).toHaveBeenCalledWith("/auth/device/verify", {
      device_token: "dev-tok",
      code: "654321",
    });
    expect(verifiedDevice.kind).toBe("authenticated");
    expect(verifiedDevice.access_token).toBe("<device-access-token>");

    postMock.mockResolvedValueOnce({ sent: true, expires_in: 300 });
    await authService.resendDevice("dev-tok");
    expect(postMock).toHaveBeenCalledWith("/auth/device/resend", {
      device_token: "dev-tok",
    });

    postMock.mockResolvedValueOnce({
      challenge_id: "ch-1",
      nonce: "abcd",
      difficulty: 16,
      algorithm: "sha256-leading-zero-bits",
      expires_in: 120,
    });
    const challenge = await authService.powChallenge("a@b.test");
    expect(postMock).toHaveBeenCalledWith("/auth/login/pow-challenge", {
      email: "a@b.test",
    });
    expect(challenge.challenge_id).toBe("ch-1");
  });
});
