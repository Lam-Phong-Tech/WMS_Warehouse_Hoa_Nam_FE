import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLimitBrowserInspection } from "./use-limit-browser-inspection";

function keyDown(key: string, modifiers: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, cancelable: true, bubbles: true, ...modifiers });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("authentication page browser shortcuts", () => {
  it("blocks common inspection shortcuts and the context menu only while mounted", () => {
    const { unmount } = renderHook(() => useLimitBrowserInspection());

    expect(keyDown("F12")).toBe(true);
    expect(keyDown("I", { ctrlKey: true, shiftKey: true })).toBe(true);
    expect(keyDown("C", { metaKey: true, altKey: true })).toBe(true);
    expect(keyDown("u", { ctrlKey: true })).toBe(true);
    expect(keyDown("v", { ctrlKey: true })).toBe(false);

    const contextMenu = new MouseEvent("contextmenu", { cancelable: true, bubbles: true });
    window.dispatchEvent(contextMenu);
    expect(contextMenu.defaultPrevented).toBe(true);

    unmount();
    expect(keyDown("F12")).toBe(false);
    const nextContextMenu = new MouseEvent("contextmenu", { cancelable: true, bubbles: true });
    window.dispatchEvent(nextContextMenu);
    expect(nextContextMenu.defaultPrevented).toBe(false);
  });
});
