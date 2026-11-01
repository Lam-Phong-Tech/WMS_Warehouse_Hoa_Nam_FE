import { describe, expect, it } from "vitest";
import { greetingKeyForHour } from "./greeting";

describe("lời chào trên tổng quan", () => {
  it.each([
    [8, "greeting"],
    [12, "greetingNoon"],
    [13, "greetingNoon"],
    [15, "greetingAfternoon"],
    [20, "greetingEvening"],
  ])("chọn lời chào cho %i giờ Việt Nam", (hour, suffix) => {
    expect(greetingKeyForHour(hour)).toBe(`dashboard.snapshot.${suffix}`);
  });
});
