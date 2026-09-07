import { describe, expect, it } from "vitest";
import type { Query } from "@tanstack/react-query";
import { __persisterInternals } from "./query-persister";
import { INVALIDATION_ROOTS } from "./invalidation";

const { isPersistable, capSize } = __persisterInternals();

function fakeQuery(
  queryKey: unknown[],
  overrides: Partial<Query["state"]> = {},
): Query {
  return {
    queryKey,
    state: {
      status: "success",
      fetchStatus: "idle",
      data: { rows: [1, 2, 3] },
      error: null,
      dataUpdatedAt: Date.now(),
      ...overrides,
    },
  } as unknown as Query;
}

describe("bộ lọc ghi xuống IndexedDB", () => {
  it("cho phép danh mục dùng chung và master", () => {
    expect(isPersistable(fakeQuery(["ref", "warehouses", "active"]))).toBe(
      true,
    );
    expect(isPersistable(fakeQuery(["mvp-master", "skus", {}]))).toBe(true);
    expect(isPersistable(fakeQuery(["catalog-master", "brand-options"]))).toBe(
      true,
    );
  });

  it("cho phép báo cáo/bảng điều khiển (đã kèm revalidate + trần dung lượng)", () => {
    expect(isPersistable(fakeQuery(["dashboard", "overview-quick"]))).toBe(
      true,
    );
    expect(isPersistable(fakeQuery(["rpt-ops", "xnt", "a", "b"]))).toBe(true);
  });

  it("CHẶN danh bạ người dùng dù cùng nhóm report — đó là dữ liệu cá nhân", () => {
    expect(isPersistable(fakeQuery(["rpt-ops", "user-directory"]))).toBe(false);
  });

  it("CHẶN tồn kho, hồ sơ/quyền, chứng từ", () => {
    expect(isPersistable(fakeQuery(["inventory", "balances", {}]))).toBe(false);
    expect(isPersistable(fakeQuery(["inventory", "sku-has-stock", "x"]))).toBe(
      false,
    );
    expect(isPersistable(fakeQuery(["auth", "me", "jwt"]))).toBe(false);
    expect(isPersistable(fakeQuery(["warranty", "list", {}]))).toBe(false);
    expect(isPersistable(fakeQuery(["notifications"]))).toBe(false);
  });

  it("chặn query chưa thành công hoặc đang lỗi", () => {
    expect(
      isPersistable(fakeQuery(["ref", "warehouses"], { status: "pending" })),
    ).toBe(false);
    expect(
      isPersistable(fakeQuery(["ref", "warehouses"], { data: undefined })),
    ).toBe(false);
    expect(
      isPersistable(
        fakeQuery(["ref", "warehouses"], { error: new Error("boom") }),
      ),
    ).toBe(false);
    expect(
      isPersistable(
        fakeQuery(["ref", "warehouses"], { fetchStatus: "fetching" }),
      ),
    ).toBe(false);
  });

  it("bỏ qua khoá không phải chuỗi ở vị trí root", () => {
    expect(isPersistable(fakeQuery([{ weird: true }]))).toBe(false);
    expect(isPersistable(fakeQuery([]))).toBe(false);
  });
});

describe("khống chế dung lượng bản ghi persisted", () => {
  it("giữ query nhỏ và loại query quá khổ", () => {
    const small = { queryKey: ["ref", "small"], state: { data: "x" } };
    const huge = {
      queryKey: ["ref", "huge"],
      state: { data: "y".repeat(2_000_000) },
    };

    const capped = capSize({
      queries: [huge, small] as never,
      mutations: [],
    });

    expect(capped.queries).toHaveLength(1);
    expect(capped.queries[0].queryKey).toEqual(["ref", "small"]);
  });

  it("loại báo cáo khổng lồ theo trần TỪNG query, không chờ trần tổng", () => {
    // Đo trên dữ liệu thật: movement-trace 2,1 MB, document-history 461 KB, còn
    // bảng điều khiển chỉ 5-20 KB. Nếu chỉ có trần TỔNG thì một báo cáo 400 KB
    // vẫn lọt và chiếm chỗ của hàng chục danh mục nhỏ người dùng chạm liên tục.
    const bigReport = {
      queryKey: ["rpt-ops", "movement-trace"],
      state: { data: "z".repeat(300_000) },
    };
    const dashboard = {
      queryKey: ["dashboard", "overview-quick"],
      state: { data: "d".repeat(5_000) },
    };

    const capped = capSize({
      queries: [bigReport, dashboard] as never,
      mutations: [],
    });

    expect(capped.queries).toHaveLength(1);
    expect(capped.queries[0].queryKey).toEqual(["dashboard", "overview-quick"]);
  });

  it("không bao giờ ghi mutation xuống đĩa", () => {
    const capped = capSize({
      queries: [] as never,
      mutations: [{ anything: true }] as never,
    });

    expect(capped.mutations).toEqual([]);
  });

  it("chặn trần số lượng query", () => {
    const many = Array.from({ length: 500 }, (_, index) => ({
      queryKey: ["ref", `item-${index}`],
      state: { data: index },
    }));

    const capped = capSize({ queries: many as never, mutations: [] });

    expect(capped.queries.length).toBeLessThanOrEqual(120);
  });
});

describe("phạm vi invalidation liên module", () => {
  it("thay đổi tồn kho làm mới cả tồn, dashboard và mọi báo cáo", () => {
    expect(INVALIDATION_ROOTS.stock).toContain("inventory");
    expect(INVALIDATION_ROOTS.stock).toContain("dashboard");
    expect(INVALIDATION_ROOTS.stock).toContain("rpt-ops");
    expect(INVALIDATION_ROOTS.stock).toContain("rpt-xnt-01");
    expect(INVALIDATION_ROOTS.stock).toContain("reports");
  });

  it("thay đổi master làm mới danh mục dùng chung `ref`", () => {
    // Không có dòng này thì sửa tên kho ở màn Cấu hình kho sẽ không tới được
    // dropdown ở các màn khác cho tới khi hết TTL 30 phút.
    expect(INVALIDATION_ROOTS.master).toContain("ref");
    expect(INVALIDATION_ROOTS.master).toContain("warehouse");
    expect(INVALIDATION_ROOTS.master).toContain("mvp-master");
    expect(INVALIDATION_ROOTS.master).toContain("catalog-master");
  });
});
