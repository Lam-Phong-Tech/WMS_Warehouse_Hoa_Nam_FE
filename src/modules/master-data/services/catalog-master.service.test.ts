import { beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api/http";
import { getActiveBrandOptions } from "./catalog-master.service";

vi.mock("@/shared/api/http", () => ({ http: { getPage: vi.fn() } }));

describe("catalog model brand search choices", () => {
  beforeEach(() => vi.mocked(http.getPage).mockReset());

  it("loads later pages so local code/name search can find every active brand", async () => {
    vi.mocked(http.getPage).mockImplementation(async (_url, options) => {
      const page = Number(options?.params?.page ?? 1);
      return {
        data: [
          {
            id: `brand-${page}`,
            brand_code: `BR-${page}`,
            brand_name: page === 1 ? "Hãng Việt" : "中文品牌",
            status: "ACTIVE",
          },
        ],
        meta: { current_page: page, per_page: 1, last_page: 2, total: 2 },
      } as never;
    });
    expect(await getActiveBrandOptions()).toEqual([
      expect.objectContaining({
        id: "brand-1",
        code: "BR-1",
        name: "Hãng Việt",
      }),
      expect.objectContaining({
        id: "brand-2",
        code: "BR-2",
        name: "中文品牌",
      }),
    ]);
    expect(http.getPage).toHaveBeenLastCalledWith(expect.any(String), {
      params: { status: "ACTIVE", per_page: 200, page: 2 },
    });
  });
});
