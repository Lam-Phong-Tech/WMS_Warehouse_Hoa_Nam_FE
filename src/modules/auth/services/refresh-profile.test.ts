import { describe, expect, it } from "vitest";
import { meResponseFromRefreshUser } from "@/modules/auth/services/auth.service";

/**
 * `/auth/refresh` trả kèm hồ sơ đầy đủ của đúng JWT vừa cấp, nên bootstrap dùng
 * luôn nó và BỎ được vòng mạng `/auth/me` nối tiếp sau đó — thứ nằm trên đường
 * tới hạn của MỌI lần F5.
 *
 * Vì đây là đường quyết định quyền, test dưới đây chốt ranh giới fail-closed:
 * chỉ dựng hồ sơ khi máy chủ thực sự khẳng định danh sách quyền; mọi payload
 * thiếu/hỏng phải trả `null` để nơi gọi rơi về `/auth/me` thay vì đoán.
 */
const SERVER_USER = {
  id: 7,
  user_id: "01a06dae-063f-7032-ade3-9043910ffc32",
  username: "admin01",
  display_name: "Quản trị viên",
  name: "Quản trị viên",
  email: "admin-01@gmail.com",
  code: "AD01",
  status: "ACTIVE",
  roles: [
    {
      role_id: "r-1",
      role_code: "ADMIN",
      role_name: "Quản trị viên",
      scope_ref: null,
    },
  ],
  permissions: ["report.view", "inventory.view"],
  warehouse_scope_ids: ["wh-1"],
};

describe("hồ sơ suy ra từ /auth/refresh", () => {
  it("dựng đủ quyền và data-scope khi máy chủ trả hồ sơ hợp lệ", () => {
    const profile = meResponseFromRefreshUser(SERVER_USER);

    expect(profile).not.toBeNull();
    expect(profile?.permissions).toEqual(["report.view", "inventory.view"]);
    expect(profile?.warehouse_scope_ids).toEqual(["wh-1"]);
    expect(profile?.roles[0]?.role_code).toBe("ADMIN");
    // available_contexts phải được dựng sẵn: auth.store đọc phần tử [0] của nó,
    // để undefined là ném TypeError ngay giữa luồng khởi động.
    expect(Array.isArray(profile?.available_contexts)).toBe(true);
  });

  it("FAIL-CLOSED khi payload không có danh sách quyền", () => {
    const { permissions, ...withoutPermissions } = SERVER_USER;
    void permissions;

    expect(meResponseFromRefreshUser(withoutPermissions)).toBeNull();
  });

  it("FAIL-CLOSED với payload rỗng, null hoặc sai kiểu", () => {
    expect(meResponseFromRefreshUser(null)).toBeNull();
    expect(meResponseFromRefreshUser(undefined)).toBeNull();
    expect(meResponseFromRefreshUser("không phải object")).toBeNull();
    expect(meResponseFromRefreshUser({})).toBeNull();
    expect(
      meResponseFromRefreshUser({ ...SERVER_USER, permissions: "read" }),
    ).toBeNull();
  });

  it("không ném lỗi ra ngoài khi hợp đồng lệch — trả null để đi tiếp bằng /auth/me", () => {
    expect(() =>
      meResponseFromRefreshUser({ permissions: [], roles: null }),
    ).not.toThrow();
  });

  it("hồ sơ rỗng quyền vẫn hợp lệ: đó là câu trả lời THẬT của máy chủ, không phải thiếu dữ liệu", () => {
    const profile = meResponseFromRefreshUser({
      ...SERVER_USER,
      permissions: [],
    });

    expect(profile).not.toBeNull();
    expect(profile?.permissions).toEqual([]);
  });
});
