/**
 * Hợp đồng của nút "Làm mới" dùng chung cho cả 8 màn Báo cáo.
 *
 * Vì sao cần test này: khiếu nại của người dùng ("ấn vào cảm giác như không có
 * gì cả") không phải lỗi logic — `refetch()` vẫn chạy — mà là lỗi PHẢN HỒI.
 * Loại lỗi đó không có test nào bắt được, và rất dễ tái diễn khi ai đó tối ưu
 * bỏ `MIN_BUSY_MS` vì "chờ vô ích". Bộ test này chốt đúng ba điều người dùng
 * cảm nhận được: nút có báo bận, có báo xong, và báo đúng khi hỏng.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useReportRefresh } from "./report-refresh";

describe("useReportRefresh", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("giữ trạng thái bận CẢ SAU KHI dữ liệu đã về, đủ lâu để người dùng thấy", async () => {
    // Đây chính là điều kiện gây khiếu nại: nguồn trả về gần như tức thì
    // (localhost ~50ms), nên nếu trạng thái bận tắt ngay khi promise resolve
    // thì spinner nhấp nháy vài chục mili-giây — mắt không kịp thấy và nút bị
    // hiểu là chết. Test dùng đồng hồ giả để chốt: dữ liệu về rồi mà chưa hết
    // MIN_BUSY_MS thì nút VẪN phải đang bận.
    vi.useFakeTimers();
    try {
      const refetch = vi.fn(() => Promise.resolve("done"));
      const { result } = renderHook(() => useReportRefresh({ refetch }));

      expect(result.current.refreshing).toBe(false);
      act(() => {
        result.current.refresh();
      });
      expect(result.current.refreshing).toBe(true);
      expect(refetch).toHaveBeenCalledTimes(1);

      // Xả hết microtask: promise của `refetch` đã resolve xong tại đây.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.refreshing).toBe(true);

      // Đi được 200ms — vẫn dưới ngưỡng hiển thị, nút PHẢI còn bận. Chính assert
      // này đỏ nếu ai đó bỏ `MIN_BUSY_MS` hoặc hạ nó xuống dưới mức mắt thấy được.
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.refreshing).toBe(true);

      // Qua ngưỡng thì mới được tắt.
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.refreshing).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gọi `beforeRefetch` trước khi gọi lại dữ liệu", async () => {
    const order: string[] = [];
    const { result } = renderHook(() =>
      useReportRefresh({
        beforeRefetch: () => order.push("reset"),
        refetch: () => {
          order.push("refetch");
          return Promise.resolve();
        },
      }),
    );

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    expect(order).toEqual(["reset", "refetch"]);
  });

  it("xong thì báo thành công bằng toast", async () => {
    const success = vi.spyOn(toast, "success");
    const { result } = renderHook(() =>
      useReportRefresh({ refetch: () => Promise.resolve() }),
    );

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    expect(success).toHaveBeenCalledTimes(1);
    expect(String(success.mock.calls[0][0])).toContain("Đã cập nhật số liệu");
  });

  it("`readError` có lỗi thì báo lỗi, KHÔNG báo thành công", async () => {
    // React Query không reject khi request hỏng — lỗi nằm trong `query.error`.
    // Nếu hook chỉ bắt exception thì màn sẽ báo "đã cập nhật" cho một lượt gọi
    // thất bại, tức là nói dối người dùng.
    const success = vi.spyOn(toast, "success");
    const error = vi.spyOn(toast, "error");
    const { result } = renderHook(() =>
      useReportRefresh({
        refetch: () => Promise.resolve(),
        readError: () => new Error("Máy chủ từ chối"),
      }),
    );

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    expect(error).toHaveBeenCalledTimes(1);
    expect(success).not.toHaveBeenCalled();
  });

  it("`refetch` ném lỗi thì vẫn thoát trạng thái bận và báo lỗi", async () => {
    const error = vi.spyOn(toast, "error");
    const { result } = renderHook(() =>
      useReportRefresh({
        refetch: () => Promise.reject(new Error("mất mạng")),
      }),
    );

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    expect(error).toHaveBeenCalledTimes(1);
  });

  it("bấm dồn khi đang chạy thì bỏ qua, không xếp thêm lượt gọi", async () => {
    const refetch = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useReportRefresh({ refetch }));

    act(() => {
      result.current.refresh();
      result.current.refresh();
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
