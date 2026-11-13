import { describe, expect, it } from "vitest";
import { createNotificationToastBudget } from "./notification-toast-budget";

describe("sliding individual toast budget", () => {
  it("allocates only three individuals over ten seconds", () => {
    let now = 0;
    const budget = createNotificationToastBudget({ now: () => now });
    expect(budget.take(120)).toBe(3);
    now = 9999;
    expect(budget.take(120)).toBe(0);
    now = 10000;
    expect(budget.take(120)).toBe(3);
  });

  it("expires individual slots independently rather than resetting the whole window", () => {
    let now = 0;
    const budget = createNotificationToastBudget({ now: () => now });
    expect(budget.take(1)).toBe(1);
    now = 400;
    expect(budget.take(2)).toBe(2);
    now = 10000;
    expect(budget.take(3)).toBe(1);
    now = 10400;
    expect(budget.take(3)).toBe(2);
  });

  it("clears claims on a presentation reset and ignores invalid counts", () => {
    const budget = createNotificationToastBudget({ now: () => 0 });
    expect(budget.take(-1)).toBe(0);
    expect(budget.take(Number.NaN)).toBe(0);
    expect(budget.take(3)).toBe(3);
    budget.reset();
    expect(budget.take(1)).toBe(1);
  });
});
