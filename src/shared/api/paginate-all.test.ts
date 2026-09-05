import { describe, expect, it } from "vitest";
import { fetchAllPages } from "@/shared/api/paginate-all";

type Page = { page: number; last_page: number };

/**
 * Helper này thay cho 7 vòng lặp `for (page) { await ... }` rải khắp các màn báo
 * cáo. Vòng lặp cũ khiến trang sau chờ trang trước: đo thật là 9 vòng mạng nối
 * tiếp (~2,1s) chỉ để lấy danh mục SKU. Test chốt hai điều quan trọng nhất: kết
 * quả PHẢI y hệt bản tuần tự, và các trang sau trang 1 PHẢI chạy chồng nhau.
 */
function makeFetcher(lastPage: number, delayMs = 0) {
  const startedAt: number[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const fetchPage = async (page: number): Promise<Page> => {
    startedAt.push(page);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    inFlight -= 1;
    return { page, last_page: lastPage };
  };

  return {
    fetchPage,
    order: startedAt,
    get maxInFlight() {
      return maxInFlight;
    },
  };
}

describe("fetchAllPages", () => {
  it("trả đủ mọi trang theo ĐÚNG thứ tự 1..n", async () => {
    const f = makeFetcher(5);
    const pages = await fetchAllPages(f.fetchPage, (p) => p.last_page, 20);

    expect(pages.map((p) => p.page)).toEqual([1, 2, 3, 4, 5]);
  });

  it("chỉ gọi một lần khi chỉ có một trang", async () => {
    const f = makeFetcher(1);
    const pages = await fetchAllPages(f.fetchPage, (p) => p.last_page, 20);

    expect(pages).toHaveLength(1);
    expect(f.order).toEqual([1]);
  });

  it("các trang sau trang 1 chạy CHỒNG NHAU, không xếp hàng", async () => {
    const f = makeFetcher(5, 20);
    await fetchAllPages(f.fetchPage, (p) => p.last_page, 20);

    // Bản tuần tự cũ luôn có maxInFlight === 1. Chính con số này là bằng chứng
    // waterfall đã bị gỡ.
    expect(f.maxInFlight).toBeGreaterThan(1);
  });

  it("KHÔNG bắn quá 6 request cùng lúc — chống dội vào VPS khi nhiều người mở", async () => {
    const f = makeFetcher(20, 15);
    await fetchAllPages(f.fetchPage, (p) => p.last_page, 20);

    expect(f.maxInFlight).toBeLessThanOrEqual(6);
  });

  it("tôn trọng trần số trang dù máy chủ báo nhiều hơn", async () => {
    const f = makeFetcher(100);
    const pages = await fetchAllPages(f.fetchPage, (p) => p.last_page, 3);

    expect(pages).toHaveLength(3);
  });

  it("last_page lỗi/0/âm vẫn trả đúng một trang, không lặp vô hạn", async () => {
    for (const bad of [0, -5, Number.NaN]) {
      const f = makeFetcher(bad);
      const pages = await fetchAllPages(f.fetchPage, () => bad, 20);
      expect(pages).toHaveLength(1);
    }
  });

  it("lỗi ở một trang nổi lên ngoài, không nuốt thành dữ liệu thiếu", async () => {
    const fetchPage = async (page: number): Promise<Page> => {
      if (page === 3) throw new Error("trang 3 hỏng");
      return { page, last_page: 4 };
    };

    // Nuốt lỗi sẽ cho ra báo cáo THIẾU DÒNG mà không ai biết — tệ hơn nhiều so
    // với việc màn hình báo lỗi và người dùng bấm thử lại.
    await expect(
      fetchAllPages(fetchPage, (p) => p.last_page, 20),
    ).rejects.toThrow("trang 3 hỏng");
  });
});
