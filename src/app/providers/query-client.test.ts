import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryClient } from "./query-client";

// Bọc bằng ĐÚNG queryClient singleton của app (không phải một QueryClient mới
// dựng riêng cho test) — phải là instance có mutationCache thật đang cấu hình
// lưới an toàn thì mới kiểm chứng đúng cơ chế đang chạy trong app. File này là
// .ts (không phải .tsx) nên dùng createElement thay vì cú pháp JSX.
function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

/**
 * Bug thật gặp trong app: một hành động lỗi hiện ĐÚNG 2 toast (một câu sạch từ
 * xử lý riêng của màn hình, một câu chung chung kèm chuỗi kỹ thuật thô từ lưới
 * an toàn toàn cục ở dưới đây). Nguyên nhân: hook `useMutation({...})` không
 * tự khai `onError` — điều kiện DUY NHẤT khiến safety net tự bắn thêm toast
 * (xem `if (mutation.options.onError) return;` trong query-client.ts).
 *
 * Hai test dưới đây khoá đúng cơ chế: khai `onError` (dù rỗng) NGAY TRONG
 * `useMutation({...})` là cách DUY NHẤT chặn được safety net — không phải cứ
 * xử lý lỗi kiểu gì đó (vd truyền onError qua `mutate(vars, {onError})`) cũng
 * chặn được, vì đó là callback per-call tách biệt hoàn toàn khỏi
 * `mutation.options.onError`.
 */
describe("WWHN mutation safety-net toast dedupe", () => {
  // Mock toàn cục của "sonner" (src/test/setup.ts) khai toast.error bằng hàm
  // thường (không phải vi.fn()) — phải tự spy ở đây mới đếm được số lần gọi,
  // và phải restore sau mỗi test để không rò rỉ spy sang các test khác dùng
  // chung module "sonner" đã mock.
  let toastErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    toastErrorSpy = vi.spyOn(toast, "error").mockImplementation(() => "");
  });
  afterEach(() => {
    toastErrorSpy.mockRestore();
  });

  it("mutation KHÔNG khai onError: safety net tự bắn toast chung", async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => Promise.reject(new Error("boom")),
        }),
      { wrapper },
    );

    result.current.mutate();

    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalledTimes(1));
  });

  it("mutation CÓ khai onError (dù rỗng): safety net im lặng, không bắn thêm toast", async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => Promise.reject(new Error("boom")),
          onError: () => {
            // Component tự lo hiển thị lỗi ở nơi khác (banner/toast riêng) —
            // không liên quan tới test này, chỉ cần onError tồn tại.
          },
        }),
      { wrapper },
    );

    result.current.mutate();

    // Đợi mutation thật sự chuyển sang trạng thái lỗi rồi mới khẳng định
    // KHÔNG có toast nào — nếu không, assertion có thể "pass giả" vì chạy
    // trước khi promise reject kịp lan tới safety net.
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastErrorSpy).not.toHaveBeenCalled();
  });
});

describe("WWHN-325 query client offline invariants", () => {
  it("mutations dùng networkMode always để guard offline chạy ngay, không pause/replay", () => {
    // networkMode mặc định "online" pause mutation khi offline rồi tự resume
    // khi có mạng — chính là queue+replay mà chính sách WWHN-325 cấm. Guard
    // OFFLINE_MUTATION_BLOCKED ở axios chỉ chạy được nếu mutationFn được gọi
    // ngay cả khi navigator.onLine=false.
    expect(queryClient.getDefaultOptions().mutations?.networkMode).toBe(
      "always",
    );
  });

  it("mutations không tự retry để tránh lặp side effect", () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(0);
  });
});
