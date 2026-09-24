/** Real refresh lifetime, coordinated loading and truthful response feedback. */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useReportRefresh } from "./report-refresh";

function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((yes) => { resolve = yes; });
  return { promise, resolve };
}

describe("useReportRefresh", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it("finishes when the real read settles, without a minimum-duration timer", async () => {
    vi.useFakeTimers();
    const read = deferred();
    const refetch = vi.fn(() => read.promise);
    const { result } = renderHook(() => useReportRefresh({ refetch }));
    act(() => { result.current.refresh(); });
    expect(result.current.refreshing).toBe(true);
    expect(refetch).toHaveBeenCalledTimes(1);
    await act(async () => { read.resolve(undefined); });
    // No advanceTimersByTime: a hidden 420ms minimum would fail this check.
    expect(result.current.refreshing).toBe(false);
  });

  it("calls beforeRefetch before reading", async () => {
    const order: string[] = [];
    const { result } = renderHook(() => useReportRefresh({
      beforeRefetch: () => { order.push("reset"); },
      refetch: async () => { order.push("refetch"); },
    }));
    act(() => { result.current.refresh(); });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(order).toEqual(["reset", "refetch"]);
  });

  it("reports success after completion", async () => {
    const success = vi.spyOn(toast, "success");
    const { result } = renderHook(() => useReportRefresh({ refetch: async () => undefined }));
    act(() => { result.current.refresh(); });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(success).toHaveBeenCalledTimes(1);
    expect(String(success.mock.calls[0][0])).toContain("Đã cập nhật số liệu");
  });

  it("keeps the fallback readError contract for plain services", async () => {
    const success = vi.spyOn(toast, "success"), error = vi.spyOn(toast, "error");
    const { result } = renderHook(() => useReportRefresh({
      refetch: async () => undefined,
      readError: () => new Error("Máy chủ từ chối"),
    }));
    act(() => { result.current.refresh(); });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(error).toHaveBeenCalledTimes(1); expect(success).not.toHaveBeenCalled();
  });

  it("settles and reports rejected requests", async () => {
    const error = vi.spyOn(toast, "error");
    const { result } = renderHook(() => useReportRefresh({
      refetch: async () => { throw new Error("mất mạng"); },
    }));
    act(() => { result.current.refresh(); });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("suppresses duplicate clicks while the actual request is running", async () => {
    const read = deferred(); const refetch = vi.fn(() => read.promise);
    const { result } = renderHook(() => useReportRefresh({ refetch }));
    act(() => { result.current.refresh(); result.current.refresh(); result.current.refresh(); });
    expect(refetch).toHaveBeenCalledTimes(1);
    await act(async () => { read.resolve(undefined); });
    expect(result.current.refreshing).toBe(false);
  });

  it("does not announce success for a resolved React Query error", async () => {
    const success = vi.spyOn(toast, "success"), error = vi.spyOn(toast, "error");
    const { result } = renderHook(() => useReportRefresh({
      refetch: async () => ({ status: "error", isError: true, error: new Error("failed") }),
      readError: () => null,
    }));
    act(() => { result.current.refresh(); });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(error).toHaveBeenCalledTimes(1); expect(success).not.toHaveBeenCalled();
  });

  it("a successful retry is not failed by the old render's error", async () => {
    const success = vi.spyOn(toast, "success"), error = vi.spyOn(toast, "error");
    const { result } = renderHook(() => useReportRefresh({
      refetch: async () => ({ status: "success", isError: false, error: null }),
      readError: () => new Error("previous request"),
    }));
    act(() => { result.current.refresh(); });
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(success).toHaveBeenCalledTimes(1); expect(error).not.toHaveBeenCalled();
  });

  it("uses the latest fallback error callback after a re-render", async () => {
    const success = vi.spyOn(toast, "success"), error = vi.spyOn(toast, "error");
    const read = deferred();
    const { result, rerender } = renderHook(({ failed }) => useReportRefresh({
      refetch: () => read.promise,
      readError: () => failed ? new Error("new error") : null,
    }), { initialProps: { failed: false } });
    act(() => { result.current.refresh(); }); rerender({ failed: true });
    await act(async () => { read.resolve(undefined); });
    expect(error).toHaveBeenCalledTimes(1); expect(success).not.toHaveBeenCalled();
  });

  it("does not send a stale notification after the screen unmounts", async () => {
    const success = vi.spyOn(toast, "success"), error = vi.spyOn(toast, "error");
    const read = deferred();
    const { result, unmount } = renderHook(() => useReportRefresh({ refetch: () => read.promise }));
    act(() => { result.current.refresh(); }); unmount();
    await act(async () => { read.resolve(undefined); });
    expect(success).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  });
});
