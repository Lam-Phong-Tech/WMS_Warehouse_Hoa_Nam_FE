import { describe, it, expect } from "vitest";
import { LoadingOverlayStack } from "./loading-stack";

describe("loading overlay ownership", () => {
  it("prioritizes nesting depth, not React's child-first effect order", () => {
    const stack = new LoadingOverlayStack();
    const closeChild = stack.add("child", 2);
    const closeParent = stack.add("parent", 1);
    expect(stack.getSnapshot()).toBe("child");
    closeChild(); expect(stack.getSnapshot()).toBe("parent");
    closeParent(); expect(stack.getSnapshot()).toBeUndefined();
  });
  it("prioritizes the last open sibling and releases its registration", () => {
    const stack = new LoadingOverlayStack();
    const closeFirst = stack.add("first", 1);
    const closeSecond = stack.add("second", 1);
    expect(stack.getSnapshot()).toBe("second");
    closeSecond(); expect(stack.getSnapshot()).toBe("first");
    closeFirst(); expect(stack.getSnapshot()).toBeUndefined();
  });
});
