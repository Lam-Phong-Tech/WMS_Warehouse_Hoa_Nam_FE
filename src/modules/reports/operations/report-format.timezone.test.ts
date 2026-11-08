import { afterEach, expect, it, vi } from "vitest";
import { dayKey, minuteOfDay, presetRange } from "./report-format";

afterEach(() => vi.useRealTimers());

it("groups UTC ledger timestamps by Vietnam business day and hour", () => {
  expect(dayKey("2026-11-05T20:05:00Z")).toBe("2026-11-06");
  expect(minuteOfDay("2026-11-05T20:05:00Z")).toBe(185);
  expect(dayKey("2026-11-06")).toBe("2026-11-06");
  expect(minuteOfDay("2026-11-06")).toBeNull();
});

it("computes today in Vietnam when the device is still on the previous day", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T20:05:00Z"));
  expect(presetRange("today").map((date) => date.format("YYYY-MM-DD"))).toEqual(
    ["2026-11-06", "2026-11-06"],
  );
  expect(presetRange("today")[0].valueOf()).toBe(
    new Date(2026, 10, 6).getTime(),
  );
});
