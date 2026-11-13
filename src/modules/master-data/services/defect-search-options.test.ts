import { expect, it, vi } from "vitest";
import { http } from "@/shared/api/http";
import { getAllMvpDefects } from "./mvp-master.service";

vi.mock("@/shared/api/http", () => ({ http: { getPage: vi.fn() } }));

it("loads later defect pages for warranty searchable selectors", async () => {
  vi.mocked(http.getPage).mockImplementation(async (_url, options) => {
    const page = Number(options?.params?.page);
    return {
      data: [
        {
          defect_id: `defect-${page}`,
          defect_code: `D${page}`,
          defect_name: `Defect ${page}`,
          status: "ACTIVE",
        },
      ],
      meta: { current_page: page, per_page: 1, last_page: 2, total: 2 },
    } as never;
  });
  const result = await getAllMvpDefects({ status: "ACTIVE", per_page: 100 });
  expect(result.data.map((row) => row.defect_code)).toEqual(["D1", "D2"]);
  expect(http.getPage).toHaveBeenLastCalledWith(expect.any(String), {
    params: { status: "ACTIVE", per_page: 100, page: 2 },
  });
});
