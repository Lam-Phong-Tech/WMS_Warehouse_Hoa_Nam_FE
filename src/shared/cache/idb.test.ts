import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { idbSet, resetIdbForTests } from "./idb";

describe("IndexedDB commit acknowledgement", () => {
  beforeEach(() => {
    resetIdbForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    resetIdbForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function storage() {
    const request = {
      result: "cache-key",
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    const tx = {
      objectStore: () => ({ put: () => request }),
      oncomplete: null as (() => void) | null,
      onabort: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    const open = {
      result: { transaction: () => tx },
      onsuccess: null as (() => void) | null,
    };
    vi.stubGlobal("indexedDB", { open: () => open });
    return { request, tx, open };
  }

  it("reports blocked/unavailable storage as failure", async () => {
    vi.stubGlobal("indexedDB", undefined);
    expect(await idbSet("cache-key", {})).toBe(false);
  });

  it("waits for commit even after the write request succeeds", async () => {
    const { open, request, tx } = storage();
    const done = vi.fn();
    const saving = idbSet("cache-key", {}).then(done);
    open.onsuccess?.();
    await Promise.resolve();
    request.onsuccess?.();
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    tx.oncomplete?.();
    await saving;
    expect(done).toHaveBeenCalledWith(true);
  });

  it("reports an aborted transaction as failure after a successful request", async () => {
    const { open, request, tx } = storage();
    const saving = idbSet("cache-key", {});
    open.onsuccess?.();
    await Promise.resolve();
    request.onsuccess?.();
    tx.onabort?.();
    expect(await saving).toBe(false);
  });
});
