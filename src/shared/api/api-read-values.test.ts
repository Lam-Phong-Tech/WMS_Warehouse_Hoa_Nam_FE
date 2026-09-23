import { describe, expect, it } from "vitest";
import {
  nullableApiNumber,
  requiredApiNumber,
  requiredApiState,
  requiredApiIdentity,
} from "./api-read-values";
describe("API read values are never invented", () => {
  it.each([
    null,
    undefined,
    "",
    " ",
    false,
    true,
    {},
    [],
    "not-a-number",
    Infinity,
    NaN,
  ])("keeps absent or invalid numbers unknown (%s)", (value) => {
    expect(nullableApiNumber(value)).toBeNull();
    expect(() => requiredApiNumber(value)).toThrow();
  });
  it.each([0, -1, 2.5, "0", "-1", "2.5"])(
    "preserves a supplied finite number (%s)",
    (value) => {
      expect(nullableApiNumber(value)).toBe(Number(value));
      expect(requiredApiNumber(value)).toBe(Number(value));
    },
  );
  it("does not assume a missing API status is active or posted", () => {
    expect(() => requiredApiState(undefined, ["ACTIVE", "INACTIVE"])).toThrow();
    expect(() => requiredApiState("", ["DRAFT", "POSTED"])).toThrow();
    expect(requiredApiState("inactive", ["ACTIVE", "INACTIVE"])).toBe(
      "INACTIVE",
    );
  });
  it.each([null, undefined, "", " ", {}, NaN])(
    "does not fabricate server identity (%s)",
    (value) => {
      expect(() => requiredApiIdentity(value)).toThrow();
    },
  );
});
