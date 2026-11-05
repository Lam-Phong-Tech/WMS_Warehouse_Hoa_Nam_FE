import { describe, expect, it } from "vitest";
import {
  goodsTraceSourcePath,
  normalizeGoodsTraceData,
  goodsTraceParams,
} from "./goods-trace-api";

const payload = () => ({
  events: [
    {
      id: "movement-1",
      entity_key: "serial-1",
      qty_delta: -1,
      quantity: 1,
      qty_before: null,
      qty_after: null,
      event_type: "ISSUE",
      source_quantity: "2",
    },
  ],
  entities: [{ key: "serial-1", code: "SN-001", current_quantity: null }],
  relations: [],
  resolved: true,
  complete: true,
  loaded_count: 1,
  total_count: 1,
  data_as_of: "2026-11-05T10:00:00+07:00",
  warnings: [],
});

describe("goods trace read contract", () => {
  it("keeps unknown stock unknown and reads numeric database quantities", () => {
    const result = normalizeGoodsTraceData(payload());
    expect(result.entities[0].current_quantity).toBeNull();
    expect(result.events[0].qty_before).toBeNull();
    expect(result.events[0].source_quantity).toBe(2);
    expect(result.events[0].qty_delta).toBe(-1);
  });
  it("keeps selected entity quantities unknown while preserving source ledger delta and associations", () => {
    const result = normalizeGoodsTraceData({
      ...payload(),
      events: [
        {
          id: "serial-event",
          qty_delta: null,
          source_qty_delta: -10,
          related_entity_keys: ["ITEM:1", "CONTAINER:2"],
        },
      ],
    });
    expect(result.events[0].qty_delta).toBeNull();
    expect(result.events[0].source_qty_delta).toBe(-10);
    expect(result.events[0].related_entity_keys).toEqual([
      "ITEM:1",
      "CONTAINER:2",
    ]);
  });
  it("does not certify completeness when loaded events differ from total", () => {
    expect(
      normalizeGoodsTraceData({ ...payload(), total_count: 3 }).complete,
    ).toBe(false);
    expect(
      normalizeGoodsTraceData({ ...payload(), loaded_count: 0 }).complete,
    ).toBe(false);
    expect(
      normalizeGoodsTraceData({ ...payload(), complete: undefined }).complete,
    ).toBe(false);
  });
  it("distinguishes a recognized code with no period events from an unknown code", () => {
    const empty = { ...payload(), events: [], loaded_count: 0, total_count: 0 };
    expect(normalizeGoodsTraceData(empty).resolved).toBe(true);
    expect(
      normalizeGoodsTraceData({ ...empty, entities: [], resolved: false })
        .resolved,
    ).toBe(false);
  });
  it("rejects malformed responses rather than displaying fabricated zero totals", () => {
    expect(() => normalizeGoodsTraceData({})).toThrow();
    expect(() =>
      normalizeGoodsTraceData({
        ...payload(),
        events: [{ id: "bad", qty_delta: "bad" }],
      }),
    ).toThrow();
  });
  it("keeps all server filters and sends booleans in Laravel's accepted representation", () => {
    expect(
      goodsTraceParams({
        code: " SN-001 ",
        code_type: "serial",
        actor: "Nguyễn",
        source: "PX-01",
        relation: "reversal",
        stock_only: true,
        from_date: "2026-11-01",
        to_date: "2026-11-05",
      }),
    ).toEqual({
      code: "SN-001",
      code_type: "serial",
      actor: "Nguyễn",
      source: "PX-01",
      relation: "reversal",
      stock_only: 1,
      from_date: "2026-11-01",
      to_date: "2026-11-05",
    });
    expect(goodsTraceParams({ stock_only: false, code: "" })).toEqual({
      stock_only: 0,
    });
  });
  it("links only to source routes whose detail parameters are supported", () => {
    expect(goodsTraceSourcePath("REVERSAL_DOCUMENT", "a&b")).toBe(
      "/reverse?screen=REV-02&id=a%26b",
    );
    expect(goodsTraceSourcePath("WARRANTY", "case-1")).toBe(
      "/warranty?screen=WAR-03&id=case-1",
    );
    expect(goodsTraceSourcePath("PUTAWAY", "id-1")).toBeNull();
    expect(goodsTraceSourcePath("REVERSAL", "")).toBeNull();
  });
});
