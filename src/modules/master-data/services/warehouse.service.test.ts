import { describe, expect, it } from "vitest";
import {
  assertCanonicalActiveWarehouse,
  CANONICAL_WAREHOUSE_CODE,
} from "./warehouse.service";

describe("canonical warehouse guard", () => {
  it("returns exactly the canonical ACTIVE warehouse", () => {
    const result = assertCanonicalActiveWarehouse([
      {
        warehouse_id: "WH-1",
        warehouse_code: CANONICAL_WAREHOUSE_CODE,
        warehouse_name: "Kho tổng Hòa Nam",
        status: "ACTIVE",
      },
      {
        warehouse_id: "WH-OLD",
        warehouse_code: "KHO-CU",
        warehouse_name: "Kho cũ",
        status: "INACTIVE",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ warehouse_id: "WH-1" });
  });

  it("fails closed when the ACTIVE warehouse is not KHO-TONG-HN", () => {
    expect(() =>
      assertCanonicalActiveWarehouse([
        {
          warehouse_id: "WH-OTHER",
          warehouse_code: "KHO-KHAC",
          status: "ACTIVE",
        },
      ]),
    ).toThrowError(/KHO-TONG-HN/);
  });

  it("fails closed when canonical ACTIVE data is ambiguous", () => {
    expect(() =>
      assertCanonicalActiveWarehouse([
        {
          warehouse_id: "WH-1",
          code: CANONICAL_WAREHOUSE_CODE,
          status: "ACTIVE",
        },
        {
          warehouse_id: "WH-2",
          code: CANONICAL_WAREHOUSE_CODE,
          status: "ACTIVE",
        },
      ]),
    ).toThrowError(/received 2/);
  });
});
