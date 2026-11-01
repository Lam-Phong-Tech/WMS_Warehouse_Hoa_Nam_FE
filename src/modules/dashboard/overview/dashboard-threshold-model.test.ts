import { describe, expect, it } from "vitest";
import { buildDashboardThresholds } from "./dashboard-threshold-model";

describe("dashboard threshold aggregation", () => {
  it("cộng khả dụng của cùng SKU qua kho, phân biệt min = 0 với chưa đặt", () => {
    const result = buildDashboardThresholds(
      [
        {
          sku_code: "SP-A",
          sku_name: "Sản phẩm A",
          item_kind: "PRODUCT",
          available_qty: 3,
        },
        {
          sku_code: "SP-A",
          sku_name: "Sản phẩm A",
          item_kind: "PRODUCT",
          available_qty: 4,
        },
        {
          sku_code: "LK-B",
          sku_name: "Linh kiện B",
          item_kind: "COMPONENT",
          available_qty: 1,
        },
      ],
      new Map([
        ["SP-A", { min_qty: 10, max_qty: 20 }],
        ["LK-B", { min_qty: 0, max_qty: 0 }],
        ["SP-C", { min_qty: null, max_qty: null }],
      ]),
    );

    expect(result).toMatchObject({
      configured: 2,
      unconfigured: 1,
      below: 1,
      above: 1,
    });
    expect(result.rows.find((row) => row.sku === "SP-A")).toMatchObject({
      available: 7,
      state: "low",
    });
    expect(result.rows.find((row) => row.sku === "LK-B")).toMatchObject({
      available: 1,
      state: "high",
    });
    expect(result.rows.some((row) => row.sku === "SP-C")).toBe(false);
  });
});
