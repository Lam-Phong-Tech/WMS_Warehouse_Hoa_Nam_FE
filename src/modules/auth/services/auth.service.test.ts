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

describe("authService contract WWHN-165", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("refresh gửi refresh_token trong body và fail-closed với response sai", async () => {
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

  it("login lưu refresh token do BE phát hành", async () => {
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

    expect(result.access_token).toBe("access-token");
    expect(memoryStorage.setRefreshToken).toHaveBeenCalledWith("refresh-token");
  });

  it("/auth/me dựng context kho từ warehouse_scope_ids và dùng permission top-level", async () => {
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
});
