import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  CACHE_POLICIES,
  PERSISTABLE_ROOTS,
  QUERY_CACHE_REGISTRY,
  classOfQueryKey,
  isPersistDenied,
  policyOfQueryKey,
} from "./cache-policy";
import {
  applyQueryCacheDefaults,
  assertNoNestedPrefixes,
} from "./apply-query-defaults";
import { INVALIDATION_ROOTS } from "./invalidation";

/**
 * TTL cache tương ứng ở BE (config/wms_cache.php). Staleness người dùng thấy
 * được là TỔNG của hai lớp, nên test này giữ cho phía FE không âm thầm phá trần
 * nghiệp vụ khi ai đó nới staleTime.
 */
const BE_TTL_SECONDS = {
  stockShort: 20,
  dashboard: 60,
  report: 300,
  master: 1800,
  reference: 3600,
  rbac: 300,
};

/** NFR-SRS-016: read model tồn kho có max staleness <= 60s. */
const INVENTORY_MAX_STALENESS_MS = 60_000;

describe("chính sách cache", () => {
  it("tồn kho không bao giờ vượt trần staleness của NFR-SRS-016", () => {
    const feStale = CACHE_POLICIES.inventory.staleTime;
    const beTtl = BE_TTL_SECONDS.stockShort * 1000;

    expect(feStale + beTtl).toBeLessThan(INVENTORY_MAX_STALENESS_MS);
  });

  it("không nhóm nào có staleTime dài hơn TTL tương ứng ở BE mà không có lý do", () => {
    // Dashboard/report được canh đúng bằng TTL của BE: refetch sớm hơn chỉ nhận
    // lại đúng bytes đang nằm trong Valkey, tốn một vòng request cho không.
    expect(CACHE_POLICIES.dashboard.staleTime).toBe(
      BE_TTL_SECONDS.dashboard * 1000,
    );
    expect(CACHE_POLICIES.report.staleTime).toBe(BE_TTL_SECONDS.report * 1000);
    expect(CACHE_POLICIES.rbac.staleTime).toBe(BE_TTL_SECONDS.rbac * 1000);
    expect(CACHE_POLICIES.master.staleTime).toBeLessThanOrEqual(
      BE_TTL_SECONDS.master * 1000,
    );
    expect(CACHE_POLICIES.reference.staleTime).toBeLessThanOrEqual(
      BE_TTL_SECONDS.reference * 1000,
    );
  });

  it("đúng 5 nhóm được ghi xuống máy người dùng, không hơn", () => {
    const persisted = Object.entries(CACHE_POLICIES)
      .filter(([, policy]) => policy.persist)
      .map(([name]) => name)
      .sort();

    // report/dashboard được mở persist theo quyết định vận hành, kèm hai chốt
    // chặn: revalidateOnRestore + trần dung lượng từng query (query-persister).
    expect(persisted).toEqual([
      "dashboard",
      "master",
      "reference",
      "report",
      "static",
    ]);
  });

  it("dữ liệu nhạy cảm/realtime tuyệt đối không persist", () => {
    for (const cacheClass of [
      "rbac",
      "inventory",
      "list",
      "detail",
      "search",
      "realtime",
      "volatile",
    ] as const) {
      expect(CACHE_POLICIES[cacheClass].persist).toBe(false);
      expect(CACHE_POLICIES[cacheClass].persistTtl).toBe(0);
    }
  });

  it("mọi nhóm persist đều có persistTtl > 0 và gcTime >= staleTime", () => {
    for (const [name, policy] of Object.entries(CACHE_POLICIES)) {
      expect(policy.gcTime, `${name}.gcTime`).toBeGreaterThanOrEqual(
        policy.staleTime,
      );
      if (policy.persist) {
        expect(policy.persistTtl, `${name}.persistTtl`).toBeGreaterThan(0);
      }
    }
  });

  it("registry không khai trùng root", () => {
    expect(() => assertNoNestedPrefixes()).not.toThrow();
  });

  it("PERSISTABLE_ROOTS được suy ra từ registry, không khai tay", () => {
    const expected = QUERY_CACHE_REGISTRY.filter(
      ([, cacheClass]) => CACHE_POLICIES[cacheClass].persist,
    ).map(([root]) => root);

    expect([...PERSISTABLE_ROOTS].sort()).toEqual([...expected].sort());
    // Chốt cứng hai thứ tuyệt đối không được ghi đĩa, dù chính sách khác có đổi:
    // số tồn kho và hồ sơ/quyền của người đăng nhập.
    expect(PERSISTABLE_ROOTS.has("inventory")).toBe(false);
    expect(PERSISTABLE_ROOTS.has("auth")).toBe(false);
    // Báo cáo thì ĐƯỢC, nhưng chỉ vì đi kèm revalidateOnRestore + trần dung lượng.
    expect(PERSISTABLE_ROOTS.has("rpt-ops")).toBe(true);
  });

  it("nhóm nào ghi đĩa mà là dữ liệu nghiệp vụ thì BẮT BUỘC gọi lại sau khi nạp", () => {
    // Ranh giới an toàn của quyết định mở persist cho báo cáo: bản trên đĩa chỉ
    // được dùng để lấp chỗ màn hình chờ, không bao giờ là câu trả lời cuối cùng.
    expect(CACHE_POLICIES.report.revalidateOnRestore).toBe(true);
    expect(CACHE_POLICIES.dashboard.revalidateOnRestore).toBe(true);
    // Master/reference thì không cần: chúng chỉ đổi qua mutation của chính app,
    // và invalidation đã lo phần tức thì.
    expect(CACHE_POLICIES.master.revalidateOnRestore).toBe(false);
    expect(CACHE_POLICIES.reference.revalidateOnRestore).toBe(false);
  });

  it("danh bạ người dùng bị chặn ghi đĩa dù nhóm `report` cho phép", () => {
    // Dữ liệu cá nhân (tên, email, phòng ban) không được nằm trên đĩa máy kho
    // dùng chung — danh sách chặn theo khoá phải thắng chính sách nhóm.
    expect(classOfQueryKey(["rpt-ops", "user-directory"])).toBe("report");
    expect(CACHE_POLICIES.report.persist).toBe(true);
    expect(isPersistDenied(["rpt-ops", "user-directory"])).toBe(true);
    // Báo cáo khác cùng nhóm thì không bị chặn.
    expect(isPersistDenied(["rpt-ops", "xnt", "a", "b"])).toBe(false);
    expect(isPersistDenied(["dashboard", "overview-quick"])).toBe(false);
  });

  it("phân loại đúng các khoá tiêu biểu", () => {
    expect(classOfQueryKey(["ref", "warehouses", "active"])).toBe("reference");
    expect(classOfQueryKey(["inventory", "balances", {}])).toBe("inventory");
    expect(classOfQueryKey(["inventory", "sku-has-stock", "x"])).toBe(
      "inventory",
    );
    expect(classOfQueryKey(["auth", "me", "token"])).toBe("rbac");
    expect(classOfQueryKey(["rpt-ops", "xnt", "a", "b"])).toBe("report");
    expect(classOfQueryKey(["dashboard", "overview-quick"])).toBe("dashboard");
    expect(classOfQueryKey(["notifications"])).toBe("realtime");
  });

  it("coverage uses report freshness and invalidation but never persists its raw payload", () => {
    const keys = [
      ["rpt-coverage", "warranty-defects", "2026-01-01", "2026-09-23", "{}"],
      [
        "rpt-coverage",
        "outbound-by-recipient",
        "2026-01-01",
        "2026-09-23",
        "{}",
      ],
    ];
    expect(QUERY_CACHE_REGISTRY).toContainEqual(["rpt-coverage", "report"]);
    for (const key of keys) {
      expect(policyOfQueryKey(key)).toBe(CACHE_POLICIES.report);
      expect(isPersistDenied(key)).toBe(true);
    }
    expect(INVALIDATION_ROOTS.stock).toContain("rpt-coverage");
    expect(INVALIDATION_ROOTS.master).toContain("rpt-coverage");
  });

  it("khoá lạ rơi về nhóm an toàn nhất chứ không ném lỗi", () => {
    expect(classOfQueryKey(["khong-ton-tai"])).toBe("list");
    expect(policyOfQueryKey([]).persist).toBe(false);
    expect(policyOfQueryKey(["khong-ton-tai"]).persist).toBe(false);
  });

  it("applyQueryCacheDefaults đặt đúng staleTime/gcTime cho từng root", () => {
    const client = new QueryClient();
    applyQueryCacheDefaults(client);

    const inventory = client.getQueryDefaults(["inventory", "balances"]);
    expect(inventory.staleTime).toBe(CACHE_POLICIES.inventory.staleTime);
    expect(inventory.gcTime).toBe(CACHE_POLICIES.inventory.gcTime);

    const reference = client.getQueryDefaults(["ref", "warehouses"]);
    expect(reference.staleTime).toBe(CACHE_POLICIES.reference.staleTime);
    expect(reference.gcTime).toBe(CACHE_POLICIES.reference.gcTime);
  });
});
