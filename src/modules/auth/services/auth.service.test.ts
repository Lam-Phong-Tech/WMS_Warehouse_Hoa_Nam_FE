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
    getRefreshToken: vi.fn(() => null),
    setRefreshToken: vi.fn(),
    removeRefreshToken: vi.fn(),
  },
}));

import {
  AuthContractError,
  authService,
} from "@/modules/auth/services/auth.service";

describe("authService contract WWHN-165", () => {
  beforeEach(() => vi.clearAllMocks());

  it("login fail-closed khi thiếu access_token", async () => {
    postMock.mockResolvedValue({
      expires_in: 3600,
      user: { id: 1, email: "qa@example.com", code: "QA" },
      available_contexts: [],
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
      available_contexts: [],
    });

    await expect(
      authService.login({ email: "qa@example.com", password: "secret" }),
    ).rejects.toMatchObject({ field: "user.id" });
  });

  it("refresh fail-closed khi token rỗng hoặc expires_in không hợp lệ", async () => {
    postMock.mockResolvedValue({
      access_token: "",
      token_type: "bearer",
      expires_in: 0,
    });

    await expect(authService.refresh()).rejects.toBeInstanceOf(
      AuthContractError,
    );
  });

  it("/auth/me chuẩn hóa context nhưng không tự cấp permission", async () => {
    getMock.mockResolvedValue({
      id: 1,
      email: "qa@example.com",
      code: "QA",
      name: "QA",
      active_context: {
        role_id: 10,
        role_name: "Kho",
        scope_type: "kho",
        org_unit_id: null,
        department_id: null,
        warehouse_id: 20,
      },
      available_contexts: [],
      company: null,
      branch: null,
      department: null,
      position: null,
      role: { id: 10, name: "Kho", permissions: [] },
    });

    const result = await authService.me();
    expect(result.active_context?.permission_codes).toEqual([]);
    expect(result.active_context?.warehouse_id).toBe(20);
  });
});
