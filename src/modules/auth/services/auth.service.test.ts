import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/shared/api/http", () => ({
  http: { get: getMock, post: postMock },
}));

vi.mock("@/shared/lib/memory-storage", () => ({
  memoryStorage: {
    getRefreshToken: vi.fn(() => "refresh-current"),
    setRefreshToken: vi.fn(),
    removeRefreshToken: vi.fn(),
  },
}));

import {
  AuthContractError,
  authService,
} from "@/modules/auth/services/auth.service";
import { memoryStorage } from "@/shared/lib/memory-storage";

describe("authService contract — BE m1 /api/v1/auth/*", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(memoryStorage.getRefreshToken).mockReturnValue("refresh-current");
  });

  it("POST /auth/login gửi đúng email + password và lưu refresh token", async () => {
    postMock.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      user: {
        user_id: "user-1",
        username: "warehouse01",
        email: "qa@example.com",
        display_name: "QA",
        roles: [],
        permissions: [],
        warehouse_scope_ids: [],
      },
    });

    const result = await authService.login({
      email: "qa@example.com",
      password: "secret",
    });

    expect(postMock).toHaveBeenCalledWith("/auth/login", {
      email: "qa@example.com",
      password: "secret",
    });
    expect(result.access_token).toBe("access-token");
    expect(memoryStorage.setRefreshToken).toHaveBeenCalledWith("refresh-token");
  });

  it("login fail-closed khi thiếu access_token", async () => {
    postMock.mockResolvedValue({
      refresh_token: "refresh-token",
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
      refresh_token: "refresh-token",
      expires_in: 3600,
      user: { email: "qa@example.com" },
    });

    await expect(
      authService.login({ email: "qa@example.com", password: "secret" }),
    ).rejects.toMatchObject({ field: "user.id" });
  });

  it("POST /auth/refresh gửi memory refresh_token trong body và fail-closed với response sai", async () => {
    postMock.mockResolvedValue({
      access_token: "",
      refresh_token: "refresh-next",
      token_type: "bearer",
      expires_in: 0,
    });

    await expect(authService.refresh()).rejects.toBeInstanceOf(
      AuthContractError,
    );
    expect(postMock).toHaveBeenCalledWith("/auth/refresh", {
      refresh_token: "refresh-current",
    });
  });

  it("POST /auth/refresh không có memory token vẫn gọi API để browser gửi HttpOnly cookie", async () => {
    vi.mocked(memoryStorage.getRefreshToken).mockReturnValue(null);
    postMock.mockResolvedValue({
      access_token: "<access-from-cookie>",
      refresh_token: "<refresh-rotated-from-cookie>",
      token_type: "bearer",
      expires_in: 3600,
    });

    const result = await authService.refresh();

    expect(postMock).toHaveBeenCalledWith("/auth/refresh", {});
    expect(result.access_token).toBe("<access-from-cookie>");
    expect(memoryStorage.setRefreshToken).toHaveBeenCalledWith(
      "<refresh-rotated-from-cookie>",
    );
  });

  it("POST /auth/refresh lưu refresh token mới sau rotation", async () => {
    postMock.mockResolvedValue({
      access_token: "access-next",
      refresh_token: "refresh-next",
      token_type: "bearer",
      expires_in: 3600,
    });

    const result = await authService.refresh();

    expect(result.access_token).toBe("access-next");
    expect(memoryStorage.setRefreshToken).toHaveBeenCalledWith("refresh-next");
  });

  it("POST /auth/logout gửi refresh token hiện tại để BE revoke đúng phiên", async () => {
    postMock.mockResolvedValue(null);

    await authService.logout();

    expect(postMock).toHaveBeenCalledWith("/auth/logout", {
      refresh_token: "refresh-current",
    });
    expect(memoryStorage.removeRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("POST /auth/logout không có memory token vẫn gọi API để BE dùng cookie", async () => {
    vi.mocked(memoryStorage.getRefreshToken).mockReturnValue(null);
    postMock.mockResolvedValue(null);

    await authService.logout();

    expect(postMock).toHaveBeenCalledWith("/auth/logout", {});
    expect(memoryStorage.removeRefreshToken).toHaveBeenCalledTimes(1);
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
