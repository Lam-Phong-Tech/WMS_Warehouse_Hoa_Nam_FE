import { describe, expect, it } from "vitest";
import { buildCacheNamespace, type CacheIdentity } from "./cache-namespace";

const BASE: CacheIdentity = {
  userId: "user-a",
  warehouseScopeIds: ["wh-1", "wh-2"],
  contextRef: "role:STAFF",
  permissionCodes: ["inventory.view", "report.view"],
  isSuperAdmin: false,
};

/**
 * Đây là lớp phòng thủ chống rò dữ liệu chéo trên MÁY DÙNG CHUNG của kho: ca
 * sáng và ca chiều đăng nhập hai tài khoản khác nhau trên cùng trình duyệt. Nếu
 * khoá lưu trữ không phân biệt được danh tính thì dữ liệu người trước hiện ra
 * cho người sau.
 */
describe("namespace của persisted cache", () => {
  it("ổn định với cùng một danh tính", () => {
    expect(buildCacheNamespace(BASE)).toBe(buildCacheNamespace({ ...BASE }));
  });

  it("không phụ thuộc thứ tự của scope và permission", () => {
    const shuffled: CacheIdentity = {
      ...BASE,
      warehouseScopeIds: ["wh-2", "wh-1"],
      permissionCodes: ["report.view", "inventory.view"],
    };

    expect(buildCacheNamespace(shuffled)).toBe(buildCacheNamespace(BASE));
  });

  it("đổi khi đổi người dùng", () => {
    expect(buildCacheNamespace({ ...BASE, userId: "user-b" })).not.toBe(
      buildCacheNamespace(BASE),
    );
  });

  it("đổi khi đổi warehouse scope", () => {
    expect(
      buildCacheNamespace({ ...BASE, warehouseScopeIds: ["wh-9"] }),
    ).not.toBe(buildCacheNamespace(BASE));
  });

  it("đổi khi đổi context đang chọn", () => {
    expect(buildCacheNamespace({ ...BASE, contextRef: "role:ADMIN" })).not.toBe(
      buildCacheNamespace(BASE),
    );
  });

  it("đổi khi bộ permission đổi — cache của quyền cũ hết hiệu lực ngay", () => {
    expect(
      buildCacheNamespace({
        ...BASE,
        permissionCodes: ["inventory.view"],
      }),
    ).not.toBe(buildCacheNamespace(BASE));
  });

  it("đổi khi cờ super admin đổi", () => {
    expect(buildCacheNamespace({ ...BASE, isSuperAdmin: true })).not.toBe(
      buildCacheNamespace(BASE),
    );
  });

  it("giữ nguyên văn userId trong khoá — va chạm băm không thể trộn hai tài khoản", () => {
    expect(buildCacheNamespace(BASE)).toContain("user-a");
  });

  it("làm sạch ký tự lạ trong userId để không phá cấu trúc khoá", () => {
    const namespace = buildCacheNamespace({
      ...BASE,
      userId: "a:b/c d",
    });

    expect(namespace).toContain("a_b_c_d");
    // 6 phần: schema | env | build | user | scope | perms
    expect(namespace.split(":")).toHaveLength(6);
  });

  it("mang schema version và build id để bản cũ/khác build không được hydrate", () => {
    const namespace = buildCacheNamespace(BASE);
    expect(namespace.startsWith("s1:")).toBe(true);
    expect(namespace).toContain("test-build");
  });
});
