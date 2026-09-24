import { describe, expect, it } from "vitest";
import {
  nullableApiBoolean, optionalApiState, requiredApiBoolean,
  requiredApiRows, requiredApiVersion,
} from "./api-read-values";

describe("explicit API read evidence", () => {
  it("preserves both server boolean values", () => {
    expect(nullableApiBoolean(true)).toBe(true);
    expect(nullableApiBoolean(false)).toBe(false);
    expect(requiredApiBoolean(false, "required")).toBe(false);
  });
  it.each([undefined, null, "false", "true", 0, 1, {}, []])("does not invent a boolean for %j", value => {
    expect(nullableApiBoolean(value)).toBeNull();
    expect(() => requiredApiBoolean(value, "required")).toThrow();
  });
  it("keeps optional state absent without selecting a default", () => {
    expect(optionalApiState(undefined, ["ACTIVE", "INACTIVE"] as const, "status")).toBeUndefined();
    expect(optionalApiState("inactive", ["ACTIVE", "INACTIVE"] as const, "status")).toBe("INACTIVE");
    expect(() => optionalApiState("OTHER", ["ACTIVE", "INACTIVE"] as const, "status")).toThrow();
  });
  it("accepts an explicit empty array in either supported response form", () => {
    expect(requiredApiRows([])).toEqual([]);
    expect(requiredApiRows({ data: [] })).toEqual([]);
  });
  it.each([undefined, null, {}, { data: null }, "[]"])("rejects malformed list %j instead of reporting no rows", value => {
    expect(() => requiredApiRows(value)).toThrow();
  });
  it("accepts a real positive server version", () => {
    expect(requiredApiVersion(7)).toBe(7);
    expect(requiredApiVersion("7")).toBe(7);
  });
  it.each([undefined, null, 0, -1, 0.5, true, "", "invalid", Number.MAX_SAFE_INTEGER + 1])("does not create a version from %j", value => {
    expect(() => requiredApiVersion(value)).toThrow();
  });
});
