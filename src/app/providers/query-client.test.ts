import { describe, expect, it } from "vitest";
import { queryClient } from "./query-client";

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
