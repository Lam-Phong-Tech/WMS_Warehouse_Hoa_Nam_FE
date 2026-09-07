/**
 * Test `useOptionWindow` — cửa sổ dựng của mọi danh sách lựa chọn dài.
 *
 * Ba điều phải đúng, vì cả ba đều đã từng là lỗi thật ở các bản tự viết:
 * cắt từ đầu, cuộn tới đáy mới nới, và ĐỔI DANH SÁCH thì quay về nhịp đầu.
 */
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { UIEvent } from "react";
import { OPTION_RENDER_CHUNK, useOptionWindow } from "./option-window";

/** Giả một lần cuộn: `atBottom` quyết định có chạm đáy hay không. */
function scroll(
  window: ReturnType<typeof useOptionWindow>,
  atBottom: boolean,
): void {
  const element = {
    scrollTop: atBottom ? 400 : 0,
    clientHeight: 180,
    scrollHeight: 580,
  };
  act(() => {
    window.onListScroll({
      currentTarget: element,
    } as unknown as UIEvent<HTMLElement>);
  });
}

describe("useOptionWindow", () => {
  it("mở ra chỉ cho dựng một nhịp đầu", () => {
    const { result } = renderHook(() => useOptionWindow(500));
    expect(result.current.limit).toBe(OPTION_RENDER_CHUNK);
    expect(result.current.hidden).toBe(500 - OPTION_RENDER_CHUNK);
  });

  it("cuộn CHƯA tới đáy thì không dựng thêm", () => {
    const { result } = renderHook(() => useOptionWindow(500));
    scroll(result.current, false);
    expect(result.current.limit).toBe(OPTION_RENDER_CHUNK);
  });

  it("cuộn tới đáy thì nới thêm đúng một nhịp mỗi lần", () => {
    const { result } = renderHook(() => useOptionWindow(500));
    scroll(result.current, true);
    expect(result.current.limit).toBe(OPTION_RENDER_CHUNK * 2);
    scroll(result.current, true);
    expect(result.current.limit).toBe(OPTION_RENDER_CHUNK * 3);
  });

  it("danh sách ngắn hơn một nhịp thì không giấu dòng nào", () => {
    const { result } = renderHook(() => useOptionWindow(3));
    expect(result.current.hidden).toBe(0);
  });

  it("dựng hết rồi thì cuộn tiếp không nới thêm nữa", () => {
    const { result } = renderHook(() =>
      useOptionWindow(OPTION_RENDER_CHUNK - 1),
    );
    scroll(result.current, true);
    expect(result.current.limit).toBe(OPTION_RENDER_CHUNK);
  });

  it("đổi từ khoá tìm thì quay về nhịp đầu", () => {
    const { result, rerender } = renderHook(
      ({ keyword }: { keyword: string }) => useOptionWindow(500, keyword),
      { initialProps: { keyword: "" } },
    );
    scroll(result.current, true);
    expect(result.current.limit).toBe(OPTION_RENDER_CHUNK * 2);

    rerender({ keyword: "honda" });
    expect(result.current.limit).toBe(OPTION_RENDER_CHUNK);
  });

  it("đổi số lượng option (tải xong danh mục) cũng quay về nhịp đầu", () => {
    const { result, rerender } = renderHook(
      ({ total }: { total: number }) => useOptionWindow(total),
      { initialProps: { total: 500 } },
    );
    scroll(result.current, true);
    expect(result.current.limit).toBe(OPTION_RENDER_CHUNK * 2);

    rerender({ total: 900 });
    expect(result.current.limit).toBe(OPTION_RENDER_CHUNK);
  });

  /**
   * Bẫy đã tránh: mốc theo IDENTITY của mảng option thì mọi lần render lại đều
   * đặt lại cửa sổ (rất nhiều ô select dựng mảng option ngay trong JSX), và
   * người dùng cuộn mãi không qua được nhịp đầu.
   */
  it("render lại mà danh sách không đổi thì giữ nguyên chỗ đang cuộn", () => {
    const { result, rerender } = renderHook(() => useOptionWindow(500));
    scroll(result.current, true);
    rerender();
    rerender();
    expect(result.current.limit).toBe(OPTION_RENDER_CHUNK * 2);
  });
});
