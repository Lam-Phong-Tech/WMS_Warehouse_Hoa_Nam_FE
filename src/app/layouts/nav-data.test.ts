/**
 * Hợp đồng ICON của menu điều hướng.
 *
 * Bối cảnh (phản hồi người dùng 2026-08-29): nhóm "Nhập kho" và trang con
 * "Danh sách phiếu nhập" dùng CHUNG icon `inbox`, nhìn vào không phân biệt được
 * đang ở cấp cha hay cấp con. Kiểm kê ra 7 chỗ trùng như vậy.
 *
 * Ba test dưới đây khoá lại:
 *  1. icon của trang con KHÔNG được trùng icon nhóm chứa nó,
 *  2. các nhóm không trùng icon nhau,
 *  3. toàn bộ menu mỗi icon chỉ xuất hiện một lần.
 *
 * Slug có tồn tại trong bộ font hay không là việc của guard `yarn ui:icons`
 * (đối chiếu với CSS của package đang cài) — ở đây chỉ lo tính phân biệt.
 */
import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "./nav-data";

describe("nav-data — icon menu phải phân biệt được cấp", () => {
  it("icon trang con khác icon của nhóm cha", () => {
    const collisions = NAV_GROUPS.flatMap((group) =>
      group.items
        .filter((item) => item.icon === group.icon)
        .map((item) => `${group.name} ↔ ${item.label} (cùng "${item.icon}")`),
    );
    expect(collisions, "trang con trùng icon với nhóm cha").toEqual([]);
  });

  it("các nhóm không trùng icon nhau", () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const group of NAV_GROUPS) {
      const owner = seen.get(group.icon);
      if (owner)
        collisions.push(`${owner} ↔ ${group.name} (cùng "${group.icon}")`);
      else seen.set(group.icon, group.name);
    }
    expect(collisions, "hai nhóm dùng chung icon").toEqual([]);
  });

  it("mỗi icon chỉ xuất hiện một lần trong toàn bộ menu", () => {
    const all = NAV_GROUPS.flatMap((group) => [
      { label: `NHÓM ${group.name}`, icon: group.icon },
      ...group.items.map((item) => ({ label: item.label, icon: item.icon })),
    ]);
    const byIcon = new Map<string, string[]>();
    for (const entry of all) {
      byIcon.set(entry.icon, [...(byIcon.get(entry.icon) ?? []), entry.label]);
    }
    const duplicated = [...byIcon.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([icon, owners]) => `"${icon}": ${owners.join(" | ")}`);

    expect(duplicated, "icon bị dùng lại ở nhiều mục menu").toEqual([]);
    // Chốt số lượng để việc thêm mục menu mới buộc phải nghĩ tới icon riêng.
    expect(new Set(all.map((e) => e.icon)).size).toBe(all.length);
  });
});
